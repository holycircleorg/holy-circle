// ================================================
// PUBLIC EVENTS API
// /api/events
// ================================================

import express from "express";
import db from "../db.js";
import { createNotification } from "../utils/notifications.js";
import { triggerEmailAutomation } from "./email.js";


const router = express.Router();




// ------------------------------------------------
// GET /api/events
// Public: returns all visible events
// ------------------------------------------------
router.get("/", (req, res) => {
  db.all(
    `
    SELECT id, name, date, time, location, type, status, description
    FROM events
    WHERE status = 'upcoming'
    ORDER BY date ASC, time ASC

    `,
    [],
    (err, rows) => {
      if (err) {
        console.error("Error loading events:", err);
        return res.status(500).json({ success: false, message: "..." }
);
      }
      res.json({ success: true, events: rows || [] });

    }
  );
});

// ------------------------------------------------
// GET /api/events/:id
// Public: single event
// ------------------------------------------------
router.get("/:id", (req, res) => {
  const eventId = Number(req.params.id);
if (!Number.isInteger(eventId)) {
  return res.status(400).json({ success: false, message: "Invalid event id" });
}


  db.get(
    `
    SELECT id, name, date, time, location, type, status, description
    FROM events
    WHERE id = ?
    `,
    [eventId],
    (err, row) => {
      if (err) {
        console.error("Error loading event:", err);
        return res.status(500).json({ success: false, message: "..." }
);
      }
      if (!row) return res.status(404).json({ success: false, message: "Event not found" });

      res.json({
        id: row.id,
        name: row.name,
        date: row.date,
        time: row.time,
        location: row.location,
        type: row.type,
        status: row.status,
        description: row.description
      });

    }
  );
});

// ------------------------------------------------
// POST /api/events/:id/rsvps
// Guest RSVP
// ------------------------------------------------
router.post("/:id/rsvps", (req, res) => {
  const eventId = req.params.id;
  const { name, email, guests, comments } = req.body;
  const safeGuests = Math.max(1, Math.min(10, Number(guests) || 1));
  const safeComments = String(comments || "").slice(0, 1000);


  if (!name || !email) {
    return res.status(400).json({ success: false, message: "Name and email required" });
  }

  db.get(`SELECT id FROM events WHERE id = ?`, [eventId], (errEvent, eventRow) => {
    if (errEvent) {
      console.error("Event lookup error:", errEvent);
      return res.status(500).json({ success: false, message: "..." }
);
    }
    if (!eventRow) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    db.run(
      `
      INSERT INTO event_rsvp_guest (event_id, name, email, guests, comments, created_at)
      VALUES (?, ?, ?, ?, ?, strftime('%s','now'))
      `,
      [eventId, name, email, guests || 1, comments || ""],
      function (errInsert) {
        if (errInsert) {
          console.error("Error inserting guest RSVP:", errInsert);
          return res.status(500).json({ success: false, message: "..." }
);
        }

        triggerEmailAutomation("event_rsvp", {
        eventId,
        email: email,
        name: name
      });


        // 🔥 Notify admin
        createNotification({
          type: "event_rsvp_guest",
          message: `${name} RSVP’d as a guest.`,
          metadata: { eventId, name, email, guests }
        });

        res.json({
          success: true,
          message: "Guest RSVP received",
          rsvpId: this.lastID
        });
      }
    );
  });
});

// ------------------------------------------------
// POST /api/events/:id/rsvp-member
// Member RSVP
// ------------------------------------------------
router.post("/:id/rsvp-member", (req, res) => {
  if (!req.member) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const eventId = Number(req.params.id);
  const memberId = req.member.id;

  if (!Number.isInteger(eventId)) {
    return res.status(400).json({ success: false, message: "Invalid event id" });
  }

  db.run(
    `
    INSERT OR IGNORE INTO event_rsvp_member (event_id, member_id, created_at)
    VALUES (?, ?, strftime('%s','now'))
    `,
    [eventId, memberId],
    function (err) {
      if (err) {
        console.error("Member RSVP error:", err);
        return res.status(500).json({ success: false });
      }

      // Notify admin
      createNotification({
        type: "event_rsvp_member",
        message: `Member RSVP’d to event #${eventId}`,
        metadata: { eventId, memberId }
      });

      res.json({ success: true });
    }
  );
});

export default router;

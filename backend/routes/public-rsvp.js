// backend/routes/public-rsvps.js
import express from "express";
import db from "../db.js";
import { createNotification } from "../utils/notifications.js";


const router = express.Router();

/**
 * POST /api/events/:id/rsvp
 * Body: { name, email, guests?, comments? }
 */
router.post("/events/:id/rsvp", express.json(), (req, res) => {
  const eventId = Number(req.params.id);
  const { name, email, guests = 1, comments = "" } = req.body || {};

  if (!eventId || !name || !email) {
    return res
      .status(400)
      .json({ success: false, error: "Name, email, and eventId are required." });
  }

  const createdAt = Date.now();

  db.run(
    `
      INSERT INTO event_rsvps
        (event_id, name, email, guests, comments, contacted, created_at)
      VALUES (?, ?, ?, ?, ?, 'NO', ?)
    `,
    [eventId, name.trim(), email.trim().toLowerCase(), guests || 1, comments || "", createdAt],
    function (err) {
      if (err) {
        console.error("Error inserting RSVP:", err);
        return res.status(500).json({ success: false, error: "Database error" });
      }

      const rsvpId = this.lastID;

      // 🔔 Admin Notification
      createNotification({
        type: "rsvp",
        message: `${name} RSVP’d to event #${eventId}.`,
        metadata: { eventId, rsvpId, email },
      });

      return res.json({ success: true, rsvpId });
    }
  );
});

export default router;

import express from "express";
import db from "../db.js";
import requireMember from "../middleware/requireMember.js";
import { createMemberNotification } from "../utils/member-notifications.js";
import { createNotification } from "../utils/notifications.js";
import { awardBadgeIfNeeded } from "../utils/awardBadge.js";


const router = express.Router();

/**
 * HELPERS
 */
function getMemberInfo(memberId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT first_name, last_name, email FROM members WHERE id = ?`,
      [memberId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

function getExistingRsvp(memberId, eventId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM event_rsvps WHERE member_id = ? AND event_id = ?`,
      [memberId, eventId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

/**
 * GET RSVP STATUS
 */
router.get("/events/:eventId/status", requireMember, async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    const memberId = req.memberId;

    const existing = await getExistingRsvp(memberId, eventId);

    res.json({
      success: true,
      hasRsvp: !!existing,
      rsvp: existing || null,
    });
  } catch (err) {
    console.error("RSVP status error:", err);
    res.status(500).json({ success: false });
  }
});

/**
 * MEMBER RSVP
 */
router.post("/events/:eventId/rsvp", requireMember, express.json(), async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    const memberId = req.memberId;
    const { guests = 1, comments = "" } = req.body;

    if (!eventId || !memberId) {
      return res.status(400).json({ success: false, error: "Invalid input" });
    }

    // validate event
    const event = await new Promise((resolve, reject) =>
      db.get(`SELECT * FROM events WHERE id = ?`, [eventId], (err, row) =>
        err ? reject(err) : resolve(row)
      )
    );

    if (!event) {
      return res.json({ success: false, error: "Event not found" });
    }

    // member info
    const user = await getMemberInfo(memberId);
    const fullName = `${user.first_name} ${user.last_name}`.trim();
    const createdAt = Date.now();

    // check existing
    const existing = await getExistingRsvp(memberId, eventId);

    if (existing) {
      // update
      db.run(
        `
        UPDATE event_rsvps
        SET guests = ?, comments = ?, created_at = ?
        WHERE id = ?
      `,
        [guests, comments, createdAt, existing.id],
        async (err2) => {
          if (err2) {
            console.error("RSVP update error:", err2);
            return res.status(500).json({ success: false });
          }

          // Award badges
          await awardBadgeIfNeeded(memberId, "First Event");

          db.get(
            `SELECT COUNT(*) AS total FROM event_rsvps WHERE member_id = ?`,
            [memberId],
            async (err3, row) => {
              if (row.total >= 5)
                await awardBadgeIfNeeded(memberId, "Community Regular");
              if (row.total >= 10)
                await awardBadgeIfNeeded(memberId, "Event Supporter");
            }
          );

          return res.json({
            success: true,
            updated: true,
            rsvpId: existing.id
          });
        }
      );
      return;
    }

    // insert new rsvp
    db.run(
      `
      INSERT INTO event_rsvps 
        (event_id, member_id, name, email, guests, comments, contacted, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'NO', ?)
      `,
      [eventId, memberId, fullName, user.email, guests, comments, createdAt],
      function (err2) {
        if (err2) {
          console.error("RSVP insert error:", err2);
          return res.status(500).json({ success: false });
        }

        const rsvpId = this.lastID;

        createNotification({
          type: "rsvp",
          message: `${fullName} RSVP’d to event #${eventId}.`,
          metadata: { memberId, eventId, rsvpId },
        });

        createMemberNotification({
        memberId,
        category: "event",
        type: "event_rsvp",
        message: `You RSVP’d for "${event.title}"`,
        link: `/member-events.html`,
        io: req.app.get("io"),
      });

        res.json({ success: true, rsvpId });
      }
    );
  } catch (err) {
    console.error("Member RSVP error:", err);
    res.status(500).json({ success: false });
  }
});



/**
 * CANCEL RSVP
 */
router.post("/events/:eventId/cancel", requireMember, async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    const memberId = req.memberId;

    db.run(
      `DELETE FROM event_rsvps WHERE member_id = ? AND event_id = ?`,
      [memberId, eventId],
      (err) => {
        if (err) {
          console.error("Cancel RSVP error:", err);
          return res.status(500).json({ success: false });
        }
        res.json({ success: true });
      }
    );
  } catch (err) {
    console.error("Cancel error:", err);
    res.status(500).json({ success: false });
  }
});

export default router;

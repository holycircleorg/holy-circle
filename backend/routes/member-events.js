import express from "express";
import db from "../db.js";
import requireMember from "../middleware/requireMember.js";

const router = express.Router();

/* --------------------------------------------------
   GET /api/members/events
   Returns upcoming + past events for this member
-------------------------------------------------- */
router.get("/events", requireMember, (req, res) => {
  const memberId = req.memberId;

  const sql = `
    SELECT e.id, e.title, e.date, e.location
    FROM event_rsvps r
    JOIN events e ON e.id = r.event_id
    WHERE r.member_id = ?
    ORDER BY e.date ASC
  `;

  db.all(sql, [memberId], (err, rows) => {
    if (err) return res.json({ success: false });

    const now = new Date();

    const upcoming = rows.filter(e => new Date(e.date) >= now);
    const past = rows.filter(e => new Date(e.date) < now);

    res.json({
      success: true,
      upcoming,
      past
    });
  });
});


/* --------------------------------------------------
   POST /api/members/events/:id/cancel
-------------------------------------------------- */
router.post("/events/:id/cancel", requireMember, (req, res) => {
  const memberId = req.memberId;
  const eventId = req.params.id;

  const sql = `
    DELETE FROM event_rsvps
    WHERE member_id = ? AND event_id = ?
  `;

  db.run(sql, [memberId, eventId], err => {
    if (err) return res.json({ success: false });
    res.json({ success: true });
  });
});

export default router;

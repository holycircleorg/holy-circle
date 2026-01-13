import express from "express";
import db from "../../db.js";
import requireAdmin from "../../middleware/requireAdmin.js";





const router = express.Router();

/**
 * GET /api/admin/rsvp-advanced
 * Returns:
 *  - leaderboard: RSVPs per event
 *  - types: RSVP counts grouped by event.type
 *  - conversions: page views → RSVPs
 *  - topEvents: top 5 events by RSVPs
 */
router.get("/", requireAdmin, async (req, res) => {
  try {
    // 1) RSVPs per event leaderboard
    const leaderboard = await new Promise((resolve, reject) => {
      db.all(
        `
        SELECT e.id, e.name, e.type, COUNT(r.id) AS total
        FROM events e
        LEFT JOIN event_rsvps r ON r.event_id = e.id
        GROUP BY e.id
        ORDER BY total DESC
        `,
        [],
        (err, rows) => (err ? reject(err) : resolve(rows))
      );
    });

    // 2) RSVPs by event type
    const rsvpByType = await new Promise((resolve, reject) => {
      db.all(
        `
        SELECT e.type, COUNT(r.id) AS total
        FROM events e
        LEFT JOIN event_rsvps r ON r.event_id = e.id
        GROUP BY e.type
        ORDER BY total DESC
        `,
        [],
        (err, rows) => (err ? reject(err) : resolve(rows))
      );
    });

    // 3) Conversion rate (page views → RSVPs)
    const conversions = await new Promise((resolve, reject) => {
      db.all(
        `
        SELECT 
          e.id,
          e.name,
          e.page_views AS views,
          COUNT(r.id) AS rsvps,
          ROUND(
            (COUNT(r.id) * 100.0) / 
            CASE WHEN e.page_views > 0 THEN e.page_views ELSE 1 END,
          2) AS conversion_rate
        FROM events e
        LEFT JOIN event_rsvps r ON r.event_id = e.id
        GROUP BY e.id
        ORDER BY conversion_rate DESC
        `,
        [],
        (err, rows) => (err ? reject(err) : resolve(rows))
      );
    });

    // 4) Top 5 events by RSVP volume
    const topEvents = leaderboard.slice(0, 5);

    return res.json({
      success: true,
      leaderboard,
      rsvpByType,
      conversions,
      topEvents,
    });

  } catch (err) {
    console.error("RSVP analytics error:", err);
    res.json({ success: false, error: "RSVP analytics failed." });
  }
});

export default router;

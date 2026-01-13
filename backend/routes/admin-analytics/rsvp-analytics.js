import express from "express";
import db from "../../db.js";
import requireAdmin from "../../middleware/requireAdmin.js";





const router = express.Router();

/**
 * GET /api/admin/rsvp-analytics
 * Returns:
 *  {
 *    success: true,
 *    totalRsvps: number,
 *    weekTotal: number,
 *    labels: string[],   // last 7 days (oldest → newest)
 *    values: number[]    // RSVP counts per day
 *  }
 */
router.get("/", requireAdmin, (req, res) => {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const start = now - 6 * DAY; // last 7 days including today

  // 1) Bucket for last 7 days
  const buckets = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(start + i * DAY);
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    buckets[key] = 0;
  }

  db.all(
    `
      SELECT created_at
      FROM event_rsvps
      WHERE created_at >= ?
    `,
    [start],
    (err, rows) => {
      if (err) {
        console.error("RSVP analytics (week) error:", err);
        return res.json({ success: false, error: "Database error" });
      }

      // Fill buckets
      (rows || []).forEach((r) => {
        const d = new Date(r.created_at);
        const key = d.toISOString().slice(0, 10);
        if (Object.prototype.hasOwnProperty.call(buckets, key)) {
          buckets[key]++;
        }
      });

      // Build ordered labels + values
      const bucketKeys = Object.keys(buckets).sort();
      const labels = [];
      const values = [];

      bucketKeys.forEach((key) => {
        const d = new Date(key);
        const label = `${d.getMonth() + 1}/${d.getDate()}`; // M/D
        labels.push(label);
        values.push(buckets[key]);
      });

      const weekTotal = values.reduce((sum, v) => sum + v, 0);

      // 2) Get all-time total RSVPs
      db.get(
        `SELECT COUNT(*) AS total FROM event_rsvps`,
        [],
        (err2, row) => {
          if (err2) {
            console.error("RSVP analytics (total) error:", err2);
            return res.json({ success: false, error: "Database error" });
          }

          const totalRsvps = row?.total || 0;

          return res.json({
            success: true,
            totalRsvps,
            weekTotal,
            labels,
            values,
          });
        }
      );
    }
  );
});

export default router;

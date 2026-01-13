import express from "express";
import db from "../../db.js";
import requireAdmin from "../../middleware/requireAdmin.js";





const router = express.Router();
// TRACK GENERIC EVENTS (PUBLIC)
router.post("/event", (req, res) => {
  try {
    const { event, page, meta } = req.body;
    if (!event) {
      return res.status(400).json({ success: false });
    }

    db.run(
      `
      INSERT INTO traffic_events
      (event, page, meta, created_at)
      VALUES (?, ?, ?, ?)
      `,
      [
        event,
        page || null,
        meta ? JSON.stringify(meta) : null,
        Date.now()
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Traffic event error:", err);
    res.status(500).json({ success: false });
  }
});

// TRAFFIC TIMELINE (last 30 days)
router.get("/timeline", requireAdmin, (req, res) => {
  const now = Date.now();
  const daysAgo30 = now - 30 * 24 * 60 * 60 * 1000;

  db.all(
    `SELECT created_at FROM page_views WHERE created_at >= ?`,
    [daysAgo30],
    (err, rows) => {
      if (err) {
        console.error("Timeline error:", err);
        return res.json({ success: false });
      }

      const buckets = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        buckets[key] = 0;
      }

      rows.forEach((r) => {
        const d = new Date(r.created_at);
        const key = d.toISOString().slice(0, 10);
        if (buckets[key] !== undefined) buckets[key]++;
      });

      // 🔽 ADD FORUM WAITLIST COUNT HERE
      db.get(
        `SELECT COUNT(*) AS count FROM forum_launch_notify`,
        [],
        (err2, row) => {
          if (err2) {
            console.error("Forum waitlist count error:", err2);
          }

          res.json({
            success: true,
            labels: Object.keys(buckets),
            values: Object.values(buckets),
            forum_waitlist: row?.count || 0
          });
        }
      );
    }
  );
});




// TOP PAGES
router.get("/pages", requireAdmin, (req, res) => {
  db.all(
    `
    SELECT path, COUNT(*) as views
    FROM page_views
    GROUP BY path
    ORDER BY views DESC
    LIMIT 10
    `,
    [],
    (err, rows) => {
      if (!rows) return res.json({ success: false });
      res.json({ success: true, pages: rows });
    }
  );
});

// TOP REFERRERS
router.get("/sources", requireAdmin, (req, res) => {
  db.all(
    `
    SELECT referrer, COUNT(*) as hits
    FROM page_views
    WHERE referrer IS NOT NULL
    GROUP BY referrer
    ORDER BY hits DESC
    LIMIT 10
    `,
    [],
    (err, rows) => {
      if (!rows) return res.json({ success: false });
      res.json({ success: true, sources: rows });
    }
  );
});

export default router;

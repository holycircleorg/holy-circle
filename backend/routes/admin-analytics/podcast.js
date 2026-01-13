import express from "express";
import db from "../../db.js";
import requireAdmin from "../../middleware/requireAdmin.js";




const router = express.Router();

// This pulls internal data only.
// YouTube analytics will be merged by frontend.
router.get("/", requireAdmin, (req, res) => {
  db.all(
    `SELECT title, youtubeUrl, status, createdAt, publishedAt FROM episodes`,
    [],
    (err, rows) => {
      if (err) return res.json({ success: false });

      const published = rows.filter((e) => e.status === "published").length;
      const drafts = rows.filter((e) => e.status === "draft").length;

      const monthly = {};

      rows.forEach((e) => {
        if (!e.publishedAt) return;
        const d = new Date(e.publishedAt);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        monthly[key] = (monthly[key] || 0) + 1;
      });

      const labels = Object.keys(monthly).sort();
      const values = labels.map((l) => monthly[l]);

      res.json({
        success: true,
        totalEpisodes: rows.length,
        published,
        drafts,
        labels,
        values,
        episodes: rows,
      });
    }
  );
});

export default router;

import express from "express";
import db from "../../db.js";
import requireAdmin from "../../middleware/requireAdmin.js";





const router = express.Router();

router.get("/", requireAdmin, (req, res) => {
  const now = new Date();
  const sixMonthsAgo = now.getTime() - 180 * 24 * 60 * 60 * 1000;

  db.all(
    `
    SELECT created_at FROM members
    WHERE created_at >= ?
    `,
    [sixMonthsAgo],
    (err, rows) => {
      if (err) return res.json({ success: false });

      const buckets = {};

      for (let i = 0; i < 6; i++) {
        const d = new Date(
          now.getFullYear(),
          now.getMonth() - i,
          1
        );
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        buckets[key] = 0;
      }

      rows.forEach((m) => {
        const d = new Date(m.created_at);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (buckets[key] !== undefined) buckets[key]++;
      });

      const labels = Object.keys(buckets).sort();
      const values = labels.map((l) => buckets[l]);

      res.json({
        success: true,
        labels,
        values,
      });
    }
  );
});

export default router;

import express from "express";
import db from "../db.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = express.Router();


router.get("/badge-analytics", requireAdmin, (req, res) => {
  const results = {
    success: true,
    totals: {},
    distribution: { labels: [], values: [] },
    topMembers: [],
  };

  // TOTAL BADGES EARNED
  db.get(
    `SELECT COUNT(*) AS totalBadges FROM member_badges`,
    [],
    (err1, row1) => {
      if (err1) {
        console.error("badge analytics error 1:", err1);
        return res.json({ success: false });
      }

      results.totals.totalBadges = row1.totalBadges;

      // ACTIVE BADGE TYPES
      db.get(
        `SELECT COUNT(*) AS activeTypes FROM badges WHERE is_active = 1`,
        [],
        (err2, row2) => {
          if (err2) {
            console.error("badge analytics error 2:", err2);
            return res.json({ success: false });
          }

          results.totals.activeTypes = row2.activeTypes;

          // MOST EARNED BADGE
          db.get(
            `
            SELECT b.name, COUNT(*) AS qty
            FROM member_badges mb
            JOIN badges b ON b.id = mb.badge_id
            GROUP BY mb.badge_id
            ORDER BY qty DESC
            LIMIT 1
          `,
            [],
            (err3, row3) => {
              if (err3) {
                console.error("badge analytics error 3:", err3);
                return res.json({ success: false });
              }

              results.totals.topBadgeName = row3 ? row3.name : null;

              // BADGE DISTRIBUTION
              db.all(
                `
                SELECT b.name, COUNT(*) AS total
                FROM member_badges mb
                JOIN badges b ON b.id = mb.badge_id
                WHERE b.is_active = 1
                GROUP BY mb.badge_id
                ORDER BY total DESC
              `,
                [],
                (err4, rows4) => {
                  if (err4) {
                    console.error("badge analytics error 4:", err4);
                    return res.json({ success: false });
                  }

                  results.distribution.labels = rows4.map((r) => r.name);
                  results.distribution.values = rows4.map((r) => r.total);

                  // TOP MEMBERS BY BADGES
                  db.all(
                    `
                    SELECT 
                      (m.first_name || ' ' || m.last_name) AS name,
                      COUNT(mb.badge_id) AS total
                    FROM members m
                    LEFT JOIN member_badges mb ON mb.member_id = m.id
                    WHERE m.role != 'guest'
                    GROUP BY m.id
                    ORDER BY total DESC
                    LIMIT 10
                  `,
                    [],
                    (err5, rows5) => {
                      if (err5) {
                        console.error("badge analytics error 5:", err5);
                        return res.json({ success: false });
                      }

                      results.topMembers = rows5;

                      return res.json(results);
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

export default router;

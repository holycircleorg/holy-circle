// backend/routes/admin-email.js

import express from "express";
import db from "../db.js";
import requireAdmin from "../middleware/requireAdmin.js";



const router = express.Router();

/**
 * Small helper to compute a timestamp N days ago
 */
function daysAgo(days) {
  const now = Date.now();
  return now - days * 24 * 60 * 60 * 1000;
}

/**
 * ----------------------------------------------
 * GET /api/admin/email-signups
 * List + search + optional date/source filters
 * ----------------------------------------------
 * Query params:
 *   search  = filter by email OR name (LIKE)
 *   limit   = max rows (default 50)
 *   offset  = for pagination (default 0)
 *   range   = "7d" | "30d" | "90d" | "all" (default "all")
 *   source  = optional exact source_page filter
 */
router.get("/email-signups", requireAdmin, (req, res) => {
  const {
    search = "",
    limit = 50,
    offset = 0,
    range = "all",
    source = "",
  } = req.query;

  const params = [];
  const whereParts = [];

  // Date-range filter
  if (range && range !== "all") {
    let fromTs = null;
    if (range === "7d") fromTs = daysAgo(7);
    else if (range === "30d") fromTs = daysAgo(30);
    else if (range === "90d") fromTs = daysAgo(90);

    if (fromTs != null) {
      whereParts.push("created_at >= ?");
      params.push(fromTs);
    }
  }

  // Source filter
  if (source) {
    whereParts.push("source_page = ?");
    params.push(source);
  }

  // Search (email OR name)
  if (search) {
    whereParts.push("(email LIKE ? OR IFNULL(name,'') LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = whereParts.length
    ? "WHERE " + whereParts.join(" AND ")
    : "";

  const sql = `
    SELECT id, email, name, source_page, created_at
    FROM email_signups
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;

  params.push(Number(limit), Number(offset));

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("Error loading email signups:", err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json({
      success: true,
      signups: rows || [],
    });
  });
});

/**
 * ----------------------------------------------
 * GET /api/admin/email-signups/summary
 * Small snapshot used on the admin Email page
 * ----------------------------------------------
 * Returns:
 *   {
 *     total: number,
 *     last7: number,
 *     last30: number,
 *     bySource: [{ source_page, count }]
 *   }
 */
router.get("/email-signups/summary", requireAdmin, (req, res) => {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const summary = {
    total: 0,
    last7: 0,
    last30: 0,
    bySource: [],
  };

  db.serialize(() => {
    // Total
    db.get(
      `SELECT COUNT(*) AS cnt FROM email_signups`,
      [],
      (err, row) => {
        if (err) {
          console.error("Summary total error:", err);
        } else {
          summary.total = row?.cnt || 0;
        }

        // Last 7 days
        db.get(
          `SELECT COUNT(*) AS cnt FROM email_signups WHERE created_at >= ?`,
          [sevenDaysAgo],
          (err2, row2) => {
            if (err2) {
              console.error("Summary last7 error:", err2);
            } else {
              summary.last7 = row2?.cnt || 0;
            }

            // Last 30 days
            db.get(
              `SELECT COUNT(*) AS cnt FROM email_signups WHERE created_at >= ?`,
              [thirtyDaysAgo],
              (err3, row3) => {
                if (err3) {
                  console.error("Summary last30 error:", err3);
                } else {
                  summary.last30 = row3?.cnt || 0;
                }

                // By source
                db.all(
                  `
                    SELECT source_page, COUNT(*) AS count
                    FROM email_signups
                    GROUP BY source_page
                    ORDER BY count DESC
                  `,
                  [],
                  (err4, rows) => {
                    if (err4) {
                      console.error("Summary bySource error:", err4);
                      return res
                        .status(500)
                        .json({ error: "Database error" });
                    }

                    summary.bySource = rows || [];
                    return res.json(summary);
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

/**
 * ----------------------------------------------
 * GET /api/admin/email-analytics
 * Overall email + member growth analytics
 * ----------------------------------------------
 * Used by Analytics page.
 *
 * Returns:
 *   {
 *     success: true,
 *     analytics: {
 *       totals: {
 *         emailSignups: number,
 *         members: number
 *       },
 *       growth: {
 *         last30Days: number,
 *         byMonth: [{ label: "2025-01", count }]
 *       }
 *     }
 *   }
 */
router.get("/email-analytics", requireAdmin, (req, res) => {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const sixMonthsAgo = now - 180 * 24 * 60 * 60 * 1000;

  const analytics = {
    totals: {
      emailSignups: 0,
      members: 0,
      forumWaitlist: 0,
    },
    growth: {
      last30Days: 0,
      byMonth: [],
    },
  };

  db.serialize(() => {

    // 1️⃣ Total email signups
    db.get(`SELECT COUNT(*) AS cnt FROM email_signups`, [], (err, row) => {
      if (!err) analytics.totals.emailSignups = row?.cnt || 0;

      // 2️⃣ Forum waitlist total
      db.get(
        `SELECT COUNT(*) AS cnt FROM email_signups WHERE intent = 'forum_waitlist'`,
        [],
        (errW, rowW) => {
          if (!errW)
            analytics.totals.forumWaitlist = rowW?.cnt || 0;

          // 3️⃣ Total members
          db.get(`SELECT COUNT(*) AS cnt FROM members`, [], (err2, row2) => {
            if (!err2) analytics.totals.members = row2?.cnt || 0;

            // 4️⃣ Email signups in last 30 days
            db.get(
              `
              SELECT COUNT(*) AS cnt
              FROM email_signups
              WHERE created_at >= ?
              `,
              [thirtyDaysAgo],
              (err3, row3) => {
                if (!err3)
                  analytics.growth.last30Days = row3?.cnt || 0;

                // 5️⃣ Growth by month (last ~6 months)
                db.all(
                  `
                  SELECT created_at
                  FROM email_signups
                  WHERE created_at >= ?
                  `,
                  [sixMonthsAgo],
                  (err4, rows) => {
                    if (err4) {
                      console.error("Email analytics byMonth error:", err4);
                      return res
                        .status(500)
                        .json({ error: "Database error" });
                    }

                    const buckets = new Map();

                    (rows || []).forEach((r) => {
                      const ts = Number(r.created_at);
                      if (!ts) return;
                      const d = new Date(ts);
                      const label = `${d.getFullYear()}-${String(
                        d.getMonth() + 1
                      ).padStart(2, "0")}`;
                      buckets.set(label, (buckets.get(label) || 0) + 1);
                    });

                    analytics.growth.byMonth = Array.from(
                      buckets.entries()
                    )
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([label, count]) => ({ label, count }));

                    // ✅ ONLY PLACE res.json() SHOULD EVER BE
                    return res.json({ success: true, analytics });
                  }
                );
              }
            );
          });
        }
      );
    });
  });
});


router.post("/admin/launch-forum", requireAdmin, async (req, res) => {
  try {
    const now = Date.now();

    const waitlist = await db.all(
      `
      SELECT email
      FROM email_signups
      WHERE intent = 'forum_waitlist'
        AND notified_at IS NULL
      `
    );

    if (!waitlist.length) {
      return res.json({ success: true, sent: 0 });
    }

    for (const row of waitlist) {
      await sendEmail({
        to: row.email,
        subject: "🎉 The Holy Circle Forum Is Live",
        html: `
          <h2>The Forum Is Open</h2>
          <p>
            You asked to be notified — and we’re excited to invite you.
          </p>
          <p>
            👉 <a href="https://holycircle.org/forum.html">
              Enter the Holy Circle Forum
            </a>
          </p>
          <p>
            We’re grateful you’re part of this community.
          </p>
        `
      });

      await db.run(
        `
        UPDATE email_signups
        SET notified_at = ?
        WHERE email = ?
        `,
        [now, row.email]
      );
    }

    res.json({ success: true, sent: waitlist.length });
  } catch (err) {
    console.error("Forum launch email failed:", err);
    res.status(500).json({ success: false });
  }
});

/**
 * ----------------------------------------------
 * DELETE /api/admin/email-signups/:id
 * Remove a single email signup
 * ----------------------------------------------
 */
router.delete("/email-signups/:id", requireAdmin, (req, res) => {
  const { id } = req.params;

  db.run(
    "DELETE FROM email_signups WHERE id = ?",
    [id],
    function (err) {
      if (err) {
        console.error("Error deleting email signup:", err);
        return res.status(500).json({ error: "Database error" });
      }
      return res.json({ success: true });
    }
  );
});

/**
 * ----------------------------------------------
 * GET /api/admin/email-signups/export
 * Returns CSV of all signups
 * ----------------------------------------------
 */
router.get("/email-signups/export", requireAdmin, (req, res) => {
  db.all(
    `
      SELECT id, email, name, source_page, created_at
      FROM email_signups
      ORDER BY created_at DESC
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error("Error exporting email signups:", err);
        return res.status(500).send("Database error");
      }

      const header = "id,email,name,source_page,created_at\n";
      const csv = (rows || [])
        .map((r) =>
          [
            r.id,
            `"${(r.email || "").replace(/"/g, '""')}"`,
            `"${(r.name || "").replace(/"/g, '""')}"`,
            `"${(r.source_page || "").replace(/"/g, '""')}"`,
            r.created_at,
          ].join(",")
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=email_signups.csv"
      );
      res.send(header + csv);
    }
  );
});

export default router;

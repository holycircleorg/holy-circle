import express from "express";
import db from "../db.js";
import requireMember from "../middleware/requireMember.js";

const router = express.Router();

/* ----------------------------------------------
   GET /api/members/dashboard
   Returns ALL dashboard analytics for a member
---------------------------------------------- */
router.get("/dashboard", requireMember, async (req, res) => {
  const memberId = req.memberId;

  const data = {
    profile: {},
    giving: {
      total: 0,
      recent: 0,
      recurring: 0
    },
    events: [],
    forum: {
      posts: 0,
      replies: 0,
      likes: 0
    }
  };

  /* -------------------------
     PROFILE INFO
  ------------------------- */
  await new Promise(resolve => {
    db.get(
      `SELECT first_name, last_name, created_at, last_login
       FROM members WHERE id = ?`,
      [memberId],
      (err, row) => {
        if (!err && row) {
          data.profile = {
            first_name: row.first_name,
            last_name: row.last_name,
            member_since: row.created_at,
            last_login: row.last_login
          };
        }
        resolve();
      }
    );
  });

  /* -------------------------
     TOTAL GIVING
  ------------------------- */
  await new Promise(resolve => {
    db.get(
      `SELECT SUM(amount) AS total
       FROM donations
       WHERE member_id = ?`,
      [memberId],
      (err, row) => {
        data.giving.total = row?.total || 0;
        resolve();
      }
    );
  });

  /* -------------------------
     MOST RECENT GIFT
  ------------------------- */
  await new Promise(resolve => {
    db.get(
      `SELECT amount
       FROM donations
       WHERE member_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [memberId],
      (err, row) => {
        data.giving.recent = row?.amount || 0;
        resolve();
      }
    );
  });

  /* -------------------------
     RECURRING GIFTS
  ------------------------- */
  await new Promise(resolve => {
    db.get(
      `SELECT amount
       FROM recurring_gifts
       WHERE member_id = ?
       AND status = "active"
       LIMIT 1`,
      [memberId],
      (err, row) => {
        data.giving.recurring = row?.amount || 0;
        resolve();
      }
    );
  });

  /* -------------------------
     UPCOMING EVENTS THEY RSVPED
  ------------------------- */
/* -------------------------
   UPCOMING EVENTS THEY RSVPED
------------------------- */
await new Promise(resolve => {
  db.all(
    `
    SELECT
      e.id,
      e.name,
      e.date,
      e.time,
      e.location
    FROM event_rsvp_member r
    JOIN events e ON e.id = r.event_id
    WHERE r.member_id = ?
      AND e.status = 'upcoming'
    ORDER BY e.date ASC
    `,
    [memberId],
    (err, rows) => {
      if (err) {
        console.error("Dashboard events error:", err);
      }
      data.events = rows || [];
      resolve();
    }
  );
});

  /* -------------------------
     FORUM ACTIVITY
  ------------------------- */
  await new Promise(resolve => {
    db.get(
      `SELECT COUNT(*) AS posts
       FROM forum_posts WHERE member_id = ?`,
      [memberId],
      (err, row) => {
        data.forum.posts = row?.posts || 0;
        resolve();
      }
    );
  });

  await new Promise(resolve => {
    db.get(
      `SELECT COUNT(*) AS replies
       FROM forum_replies WHERE member_id = ?`,
      [memberId],
      (err, row) => {
        data.forum.replies = row?.replies || 0;
        resolve();
      }
    );
  });

  await new Promise(resolve => {
    db.get(
      `SELECT COUNT(*) AS likes
       FROM forum_likes WHERE member_id = ?`,
      [memberId],
      (err, row) => {
        data.forum.likes = row?.likes || 0;
        resolve();
      }
    );
  });

  return res.json({ success: true, data });
});

export default router;

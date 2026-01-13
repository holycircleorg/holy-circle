// backend/routes/notifications.js
import express from "express";
import requireMember from "../middleware/requireMember.js";
import db from "../db.js";

const router = express.Router();

/* ===============================
   GET forum notifications
================================ */
router.get("/", requireMember, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 25, 100);

  const memberId = Number(req.memberId);
  if (!Number.isInteger(memberId)) {
    return res.json({ notifications: [], unread_count: 0 });
  }

  db.all(
    `
    SELECT *
    FROM forum_notifications
    WHERE member_id = ?
    ORDER BY created_at DESC
    LIMIT ?
    `,
    [memberId, limit],

    (err, rows) => {
      if (err) {
        console.error("Failed to load forum notifications:", err);
        return res.status(500).json({ error: "Failed to load notifications" });
      }

      const unreadCount = rows.filter(n => !n.read).length;

      res.json({
        notifications: rows,
        unread_count: unreadCount,
      });
    }
  );
});

/* ===============================
   Mark all as read
================================ */
router.post("/mark-all-read", requireMember, (req, res) => {
 const memberId = Number(req.memberId);
if (!Number.isInteger(memberId)) {
  return res.json({ success: true });
}
  db.run(
    `
    UPDATE forum_notifications
    SET read = 1
    WHERE member_id = ?
    `,
    [memberId],
    (err) => {
      if (err) {
        console.error("Failed to mark notifications read:", err);
        return res.status(500).json({ error: "Failed to update notifications" });
      }
      res.json({ success: true });
    }
  );
});

/* ===============================
   Clear all forum notifications
================================ */
router.post("/clear-all", requireMember, (req, res) => {
  const memberId = Number(req.memberId);
  if (!Number.isInteger(memberId)) {
    return res.json({ success: true });
  }

  db.run(
    `
    DELETE FROM forum_notifications
    WHERE member_id = ?
    `,
    [memberId],

    (err) => {
      if (err) {
        console.error("Failed to clear notifications:", err);
        return res.status(500).json({ error: "Failed to clear notifications" });
      }
      res.json({ success: true });
    }
  );
});

export default router;

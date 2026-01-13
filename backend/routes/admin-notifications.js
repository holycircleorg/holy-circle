// backend/routes/admin-notifications.js
import express from "express";
import db from "../db.js";
import requireAdmin from "../middleware/requireAdmin.js";
import { createNotification } from "../utils/notifications.js";




const router = express.Router();

/**
 * GET /api/admin/notifications
 * ?limit=20
 * ?unreadOnly=1
 */
router.get("/", requireAdmin, (req, res) => {
  const limit = Number(req.query.limit) || 20;
  const unreadOnly = req.query.unreadOnly === "1";

  const where = [];
  const params = [];

  if (unreadOnly) {
    where.push("is_read = 0");
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  db.all(
    `
      SELECT id, type, message, metadata, created_at, is_read
      FROM admin_notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?
    `,
    [...params, limit],
    (err, rows) => {
      if (err) {
        console.error("Error loading admin notifications:", err);
        return res.status(500).json({ success: false, error: "Database error" });
      }

      const notifications = (rows || []).map((n) => ({
        ...n,
        metadata: n.metadata ? safeParseJSON(n.metadata) : null,
      }));

      res.json({ success: true, notifications });
    }
  );
});

/**
 * POST /api/admin/notifications/:id/read
 */
router.post("/:id/read", requireAdmin, (req, res) => {
  const { id } = req.params;
  db.run(
    `UPDATE admin_notifications SET is_read = 1 WHERE id = ?`,
    [id],
    (err) => {
      if (err) {
        console.error("Error marking notification read:", err);
        return res.status(500).json({ success: false });
      }
      res.json({ success: true });
    }
  );
});

/**
 * POST /api/admin/notifications/read-all
 */
router.post("/read-all", requireAdmin, (req, res) => {
  db.run(
    `UPDATE admin_notifications SET is_read = 1 WHERE is_read = 0`,
    [],
    (err) => {
      if (err) {
        console.error("Error marking all notifications read:", err);
        return res.status(500).json({ success: false });
      }
      res.json({ success: true });
    }
  );
});

function safeParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}


export default router;

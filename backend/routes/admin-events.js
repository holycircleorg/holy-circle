import express from "express";
import path from "path";
import multer from "multer";
import db from "../db.js";
import { fileURLToPath } from "url";
import requireAdmin from "../middleware/requireAdmin.js";

const router = express.Router();

// Needed for ES module path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage for badge icons
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads/badges"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    const base = file.originalname.replace(/\W+/g, "-").toLowerCase();
    const ts = Date.now();
    cb(null, `${base}-${ts}${ext}`);
  }
});

const upload = multer({ storage });

/* GET all active badges */
router.get("/list", (req, res) => {
  db.all(
    `SELECT id, name, icon_url AS icon, category
     FROM badges
     WHERE is_active = 1
       AND (expires_at IS NULL OR expires_at > strftime('%s','now'))
     ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error("Error loading badges:", err);
        return res.status(500).json({ error: "Failed to load badges" });
      }
      res.json(rows);
    }
  );
});

/* GET badges for a member */
router.get("/user/:memberId", requireAdmin, (req, res) => {
  const memberId = req.params.memberId;

  db.all(
    `
    SELECT b.id, b.name, b.icon_url AS icon, b.category
    FROM member_badges mb
    JOIN badges b ON b.id = mb.badge_id
    WHERE mb.member_id = ? AND b.is_active = 1
    ORDER BY mb.granted_at DESC
    `,
    [memberId],
    (err, rows) => {
      if (err) {
        console.error("Error loading member badges:", err);
        return res.status(500).json({ error: "Failed to load member badges" });
      }
      res.json(rows);
    }
  );
});

/* Add or remove badge */
router.post("/toggle", requireAdmin, express.json(), (req, res) => {
  const { memberId, badgeId } = req.body;

  if (!memberId || !badgeId) {
    return res.status(400).json({ error: "memberId and badgeId required" });
  }

  db.get(
    `SELECT id FROM member_badges WHERE member_id = ? AND badge_id = ?`,
    [memberId, badgeId],
    (err, row) => {
      if (err) {
        console.error("Error checking badge:", err);
        return res.status(500).json({ error: "Failed to toggle badge" });
      }

      const now = Date.now();

      if (row) {
        // remove badge
        db.run(
          `DELETE FROM member_badges WHERE id = ?`,
          [row.id],
          (err2) => {
            if (err2) {
              console.error("Error removing badge:", err2);
              return res.status(500).json({ error: "Failed to remove badge" });
            }
            res.json({ success: true, action: "removed" });
          }
        );
      } else {
        // add badge
        db.run(
          `INSERT INTO member_badges (member_id, badge_id, granted_at)
           VALUES (?, ?, ?)`,
          [memberId, badgeId, now],
          (err2) => {
            if (err2) {
              console.error("Error adding badge:", err2);
              return res.status(500).json({ error: "Failed to add badge" });
            }
            res.json({ success: true, action: "added" });
          }
        );
      }
    }
  );
});

/* Create badge */
router.post("/create", requireAdmin, upload.single("icon"), (req, res) => {
  const { name, expires_at } = req.body;
  const file = req.file;

  if (!name || !file) {
    return res.status(400).json({ success: false, error: "Name and icon required" });
  }

  const now = Date.now();
  const iconUrl = `/uploads/badges/${file.filename}`;

  db.run(
    `
    INSERT INTO badges (name, icon_url, category, is_active, expires_at, created_at, updated_at)
    VALUES (?, ?, NULL, 1, ?, ?, ?)
    `,
    [name, iconUrl, expires_at ? Number(expires_at) : null, now, now],
    function (err) {
      if (err) {
        console.error("Error creating badge:", err);
        return res.status(500).json({ success: false, error: "Failed to create badge" });
      }
      res.json({ success: true, id: this.lastID, icon: iconUrl });
    }
  );
});

/* Edit badge */
router.post("/edit", requireAdmin, upload.single("icon"), (req, res) => {
  const { id, name, expires_at } = req.body;
  const file = req.file;

  if (!id || !name) {
    return res.status(400).json({ success: false, error: "id and name required" });
  }

  const now = Date.now();

  if (file) {
    const iconUrl = `/uploads/badges/${file.filename}`;
    db.run(
      `
      UPDATE badges
      SET name = ?, icon_url = ?, expires_at = ?, updated_at = ?
      WHERE id = ?
      `,
      [name, iconUrl, expires_at ? Number(expires_at) : null, now, id],
      (err) => {
        if (err) {
          console.error("Error updating badge:", err);
          return res.status(500).json({ success: false, error: "Failed to update badge" });
        }
        res.json({ success: true });
      }
    );
  } else {
    db.run(
      `
      UPDATE badges
      SET name = ?, expires_at = ?, updated_at = ?
      WHERE id = ?
      `,
      [name, expires_at ? Number(expires_at) : null, now, id],
      (err) => {
        if (err) {
          console.error("Error updating badge:", err);
          return res.status(500).json({ success: false, error: "Failed to update badge" });
        }
        res.json({ success: true });
      }
    );
  }
});

/* Soft delete badge */
router.post("/delete", requireAdmin, express.json(), (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, error: "id required" });
  }

  const now = Date.now();

  db.run(
    `
    UPDATE badges
    SET is_active = 0, updated_at = ?
    WHERE id = ?
    `,
    [now, id],
    function (err) {
      if (err) {
        console.error("Error deleting badge:", err);
        return res.status(500).json({ success: false, error: "Failed to delete badge" });
      }
      res.json({ success: true });
    }
  );
});

export default router;

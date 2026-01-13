import express from "express";
import db from "../db.js";
import requireMember from "../middleware/requireMember.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = express.Router();

/**
 * GET my profile
 */
router.get("/me/profile", requireMember, (req, res) => {
  db.get(
    `SELECT id, first_name, last_name, testimony, favorite_verse,
            favorite_verse_ref, profile_visibility, profile_status,
            created_at, last_login, avatar_url
     FROM members WHERE id = ?`,
    [req.member.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(row);
    }
  );
});

/**
 * GET any profile (admin or public-safe)
 */
router.get("/:id/profile", requireMember, (req, res) => {
  const id = Number(req.params.id);

  db.get(
    `SELECT id, first_name, last_name, testimony, favorite_verse,
            favorite_verse_ref, profile_visibility, profile_status,
            created_at, last_login, avatar AS avatar_url
     FROM members WHERE id = ?`,
    [id],
    (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: "Profile not found" });
      }

      if (
        row.profile_visibility !== "public" &&
        req.member.role !== "admin" &&
        req.member.id !== id
      ) {
        return res.status(403).json({ error: "Private profile" });
      }

      res.json(row);
    }
  );
});

export default router;

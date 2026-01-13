import express from "express";
import db from "../db.js";
import requireMember from "../middleware/requireMember.js";

const router = express.Router();

/**
 * UPDATE my profile
 */
router.post("/me/profile", requireMember, (req, res) => {
  const {
    first_name,
    last_name,
    testimony,
    favorite_verse,
    favorite_verse_ref,
    profile_visibility,
  } = req.body;

  db.run(
    `
    UPDATE members SET
      first_name = ?,
      last_name = ?,
      testimony = ?,
      favorite_verse = ?,
      favorite_verse_ref = ?,
      profile_visibility = ?
    WHERE id = ?
    `,
    [
      first_name,
      last_name,
      testimony,
      favorite_verse,
      favorite_verse_ref,
      profile_visibility,
      req.member.id,
    ],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to update profile" });
      }
      res.json({ success: true });
    }
  );
});

export default router;

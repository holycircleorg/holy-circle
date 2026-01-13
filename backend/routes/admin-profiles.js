import express from "express";
import db from "../db.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = express.Router();

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes });
    });
  });
}



// List profiles for moderation
router.get("/profiles", requireAdmin, async (req, res) => {
  const rows = await all(
    `
    SELECT id, first_name, last_name, username, email,
           profile_visibility, profile_status,
           moderated_at, moderation_reason
    FROM members
    ORDER BY id DESC
    LIMIT 250
    `
  );
  res.json({ profiles: rows });
});

// Moderate a profile
router.post("/admin/profiles/:id/moderate", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { profile_status, moderation_reason } = req.body || {};

  if (!["active", "hidden", "flagged"].includes(profile_status)) {
    return res.status(400).json({ error: "Invalid profile_status" });
  }

  await run(
    `
    UPDATE members
    SET profile_status = ?,
        moderation_reason = ?,
        moderated_at = ?,
        moderated_by = ?
    WHERE id = ?
    `,
    [
      profile_status,
      moderation_reason || "",
      Date.now(),
      req.session.member.id,
      id,
    ]
  );

  res.json({ success: true });
});




export default router;

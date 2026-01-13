import express from "express";
import db from "../db.js";

const router = express.Router();

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

// PUBLIC VIEW: safe fields only + respects profile_visibility + moderation state
router.get("/members/:id/public", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });

    const p = await get(
      `
      SELECT
        id, first_name, last_name, username,
        avatar_url, banner_url,
        bio, featured_verse, featured_verse_ref, testimony,
        profile_visibility,
        member_since, created_at,
        profile_status
      FROM members
      WHERE id = ?
      `,
      [id]
    );

    if (!p) return res.status(404).json({ error: "Not found" });

    // Moderation lock
    if (p.profile_status === "hidden") {
      return res.status(404).json({ error: "Not found" });
    }

    // Private profile = not publicly viewable
    if ((p.profile_visibility || "public") !== "public") {
      return res.status(403).json({ error: "This profile is private." });
    }

    // Optional public stats (non-sensitive)
    const stats = await get(
      `
      SELECT
        (SELECT COUNT(*) FROM forum_threads WHERE member_id = ?) AS total_threads,
        (SELECT COUNT(*) FROM forum_replies WHERE member_id = ?) AS total_replies
      `,
      [id, id]
    );

    // Optional recent activity (public-safe)
    const threads = await all(
      `
      SELECT id, title, created_at
      FROM forum_threads
      WHERE member_id = ?
      ORDER BY created_at DESC
      LIMIT 5
      `,
      [id]
    );

    res.json({
      profile: {
        ...p,
        total_threads: stats?.total_threads || 0,
        total_replies: stats?.total_replies || 0,
      },
      activity: { threads },
    });
  } catch (e) {
    console.error("Public profile failed:", e);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;

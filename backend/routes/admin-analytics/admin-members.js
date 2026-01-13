// Hide / moderate member avatar
router.post(
  "/members/:id/avatar/hide",
  requireAdmin,
  (req, res) => {
    db.run(
      `
      UPDATE members
      SET
        avatar_url = NULL,
        profile_status = 'flagged',
        moderated_at = strftime('%s','now'),
        moderated_by = ?
      WHERE id = ?
      `,
      [req.user.id, req.params.id],
      (err) => {
        if (err) {
          console.error("Hide avatar error:", err);
          return res.status(500).json({ error: "Failed to hide avatar" });
        }

        res.json({ success: true });
      }
    );
  }
);
export default router;
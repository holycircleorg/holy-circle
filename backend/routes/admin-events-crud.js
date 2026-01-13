import express from "express";
import db from "../db.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = express.Router();

// CREATE
router.post("/", requireAdmin, express.json(), (req, res) => {
  const { name, date, time, location, type, status, description } = req.body;
  if (!name || !date || !time) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const now = Date.now();
  db.run(
    `
    INSERT INTO events
    (name, date, time, location, type, status, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [name, date, time, location, type, status, description, now, now],
    function (err) {
      if (err) return res.status(500).json({ error: "Create failed" });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// UPDATE
router.put("/:id", requireAdmin, express.json(), (req, res) => {
  const id = Number(req.params.id);
  const { name, date, time, location, type, status, description } = req.body;

  db.run(
    `
    UPDATE events SET
      name = ?, date = ?, time = ?, location = ?, type = ?, status = ?, description = ?, updated_at = ?
    WHERE id = ?
    `,
    [name, date, time, location, type, status, description, Date.now(), id],
    (err) => {
      if (err) return res.status(500).json({ error: "Update failed" });
      res.json({ success: true });
    }
  );
});

// ARCHIVE (delete)
router.delete("/:id", requireAdmin, (req, res) => {
  db.run(
    `UPDATE events SET status = 'archived', updated_at = ? WHERE id = ?`,
    [Date.now(), Number(req.params.id)],
    (err) => {
      if (err) return res.status(500).json({ error: "Delete failed" });
      res.json({ success: true });
    }
  );
});

export default router;

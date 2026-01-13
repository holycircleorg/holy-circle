import express from "express";
import db from "./db.js";
import multer from "multer";
import cloudinary from "./cloudinary.js"; // You already have cloudinary.js in backend
import requireAdmin from "./middleware/requireAdmin.js";

const upload = multer({ dest: "uploads/" });
const router = express.Router();


// Small helper to map DB row into clean JSON
function mapFollowupRow(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    status: row.status,
    priority: row.priority,
    due_date: row.due_date,
    notes: row.notes,
    assigned_to_user_id: row.assigned_to_user_id,
    assigned_to_name: row.assigned_to_name || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ===============================
// GET /api/followups
// Optional query params: category, status, search
// ===============================
router.get("/", (req, res) => {
  const { category, status, search } = req.query;

  const params = [];
  const where = [];

  if (category && category !== "All") {
    where.push("f.category = ?");
    params.push(category);
  }

  if (status && status !== "All") {
    where.push("f.status = ?");
    params.push(status);
  }

  if (search) {
    where.push("(f.title LIKE ? OR f.notes LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      f.*,
      u.name AS assigned_to_name
    FROM followups f
    LEFT JOIN users u ON u.id = f.assigned_to_user_id
    ${whereClause}
    ORDER BY
      CASE f.status
        WHEN 'open' THEN 0
        WHEN 'in_progress' THEN 1
        WHEN 'done' THEN 2
        ELSE 3
      END,
      f.due_date IS NULL,
      f.due_date ASC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("Error fetching followups:", err);
      return res.status(500).json({ error: "Failed to load follow-ups" });
    }
    res.json(rows.map(mapFollowupRow));
  });
});

// ===============================
// GET /api/followups/users
// Return list of users for "Assigned To" dropdown
// ===============================
router.get("/users", (req, res) => {
  const sql = `
    SELECT id, name, email
    FROM users
    ORDER BY name ASC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Error fetching users for follow-up:", err);
      return res.status(500).json({ error: "Failed to load users" });
    }
    res.json(rows);
  });
});

// ===============================
// POST /api/followups
// Create new follow-up
// ===============================
router.post("/", (req, res) => {
  const {
    title,
    category,
    status = "open",
    priority = "normal",
    assigned_to_user_id = null,
    due_date = null,
    notes = "",
  } = req.body || {};

  if (!title || !category) {
    return res.status(400).json({ error: "Title and category are required." });
  }

  const now = Date.now();

  const sql = `
    INSERT INTO followups
    (title, category, status, priority, assigned_to_user_id, due_date, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    title,
    category,
    status,
    priority,
    assigned_to_user_id || null,
    due_date || null,
    notes || "",
    now,
    now,
  ];

  db.run(sql, params, function (err) {
    if (err) {
      console.error("Error creating follow-up:", err);
      return res.status(500).json({ error: "Failed to create follow-up" });
    }

    const newId = this.lastID;

    db.get(
      `
      SELECT f.*, u.name AS assigned_to_name
      FROM followups f
      LEFT JOIN users u ON u.id = f.assigned_to_user_id
      WHERE f.id = ?
    `,
      [newId],
      (err2, row) => {
        if (err2 || !row) {
          return res.json({ id: newId });
        }
        res.status(201).json(mapFollowupRow(row));
      }
    );
  });
});

// ===============================
// PUT /api/followups/:id
// Full update for follow-up
// ===============================
router.put("/:id", (req, res) => {
  const followupId = req.params.id;
  const {
    title,
    category,
    status,
    priority,
    assigned_to_user_id,
    due_date,
    notes,
  } = req.body || {};

  if (!title || !category || !status || !priority) {
    return res
      .status(400)
      .json({ error: "Title, category, status, and priority are required." });
  }

  const now = Date.now();

  const sql = `
    UPDATE followups
    SET
      title = ?,
      category = ?,
      status = ?,
      priority = ?,
      assigned_to_user_id = ?,
      due_date = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?
  `;

  const params = [
    title,
    category,
    status,
    priority,
    assigned_to_user_id || null,
    due_date || null,
    notes || "",
    now,
    followupId,
  ];

  db.run(sql, params, function (err) {
    if (err) {
      console.error("Error updating follow-up:", err);
      return res.status(500).json({ error: "Failed to update follow-up" });
    }

    db.get(
      `
      SELECT f.*, u.name AS assigned_to_name
      FROM followups f
      LEFT JOIN users u ON u.id = f.assigned_to_user_id
      WHERE f.id = ?
    `,
      [followupId],
      (err2, row) => {
        if (err2 || !row) {
          return res.json({ success: true });
        }
        res.json(mapFollowupRow(row));
      }
    );
  });
});

// ===============================
// PATCH /api/followups/:id/status
// Quickly update status (open / in_progress / done)
// ===============================
router.patch("/:id/status", (req, res) => {
  const followupId = req.params.id;
  const { status } = req.body || {};

  if (!status) {
    return res.status(400).json({ error: "Status is required." });
  }

  const now = Date.now();

  db.run(
    `
    UPDATE followups
    SET status = ?, updated_at = ?
    WHERE id = ?
  `,
    [status, now, followupId],
    function (err) {
      if (err) {
        console.error("Error updating follow-up status:", err);
        return res
          .status(500)
          .json({ error: "Failed to update follow-up status" });
      }

      db.get(
        `
        SELECT f.*, u.name AS assigned_to_name
        FROM followups f
        LEFT JOIN users u ON u.id = f.assigned_to_user_id
        WHERE f.id = ?
      `,
        [followupId],
        (err2, row) => {
          if (err2 || !row) {
            return res.json({ success: true });
          }
          res.json(mapFollowupRow(row));
        }
      );
    }
  );
});

// ===============================
// DELETE /api/followups/:id
// ===============================
router.delete("/:id", (req, res) => {
  const followupId = req.params.id;

  db.run(
    `
    DELETE FROM followups
    WHERE id = ?
  `,
    [followupId],
    function (err) {
      if (err) {
        console.error("Error deleting follow-up:", err);
        return res.status(500).json({ error: "Failed to delete follow-up" });
      }
      res.json({ success: true });
    }
  );
});

router.get("/:id/comments", (req, res) => {
  db.all(
    `SELECT c.*, u.name AS user_name
     FROM followup_comments c
     JOIN users u ON u.id = c.user_id
     WHERE followup_id = ?
     ORDER BY created_at ASC`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

// ===============================
// GET /api/followups/stats
// Used for dashboard overview
// ===============================
router.get("/stats", (req, res) => {
  const today = new Date().toISOString().split("T")[0];

  const sql = `
    SELECT
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN due_date < ? AND status != 'done' THEN 1 ELSE 0 END) AS overdue,
      COUNT(*) AS total
    FROM followups
  `;

  db.get(sql, [today], (err, row) => {
    if (err) return res.status(500).json({ error: "Failed to load stats" });
    res.json(row);
  });
});

// ===============================
// GET /api/followups/notifications
// ===============================
router.get("/notifications", (req, res) => {
  const today = new Date().toISOString().split("T")[0];

  const sql = `
    SELECT id, title, category, status, due_date, created_at, updated_at
    FROM followups
    ORDER BY updated_at DESC
    LIMIT 20
  `;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Failed to load notifications" });

    const notifications = rows.map(f => {
      const due = f.due_date ? new Date(f.due_date) : null;
      const now = new Date();
      const overdue = due && due < now && f.status !== "done";

      return {
        id: f.id,
        title: f.title,
        overdue,
        category: f.category,
        status: f.status,
        due_date: f.due_date,
        type:
          overdue
            ? "overdue"
            : f.status === "done"
            ? "completed"
            : "update",
        timestamp: f.updated_at,
      };
    });

    res.json(notifications);
  });
});

router.post("/:id/comments", requireAdmin, (req, res) => {
  const { comment } = req.body;
  const created_at = Date.now();

  db.run(
    `INSERT INTO followup_comments (followup_id, user_id, comment, created_at)
     VALUES (?, ?, ?, ?)`,
    [req.params.id, req.user.id, comment, created_at],
    function () {
      db.run(
        `INSERT INTO followup_activity (followup_id, user_id, action, details, created_at)
         VALUES (?, ?, 'comment_added', ?, ?)`,
        [req.params.id, req.user.id, comment, created_at]
      );
      res.json({ success: true, id: this.lastID });
    }
  );
});

router.post(
  "/:id/files",
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    const file = req.file;
    const followupId = req.params.id;
    const userId = req.user.id;

    try {
      const uploaded = await cloudinary.uploader.upload(file.path, {
        folder: "holy-circle/followups",
      });

      db.run(
        `INSERT INTO followup_files (followup_id, user_id, file_url, original_name, uploaded_at)
         VALUES (?, ?, ?, ?, ?)`,
        [followupId, userId, uploaded.secure_url, file.originalname, Date.now()]
      );

      db.run(
        `INSERT INTO followup_activity (followup_id, user_id, action, details, created_at)
         VALUES (?, ?, 'file_uploaded', ?, ?)`,
        [followupId, userId, file.originalname, Date.now()]
      );

      res.json({ success: true, url: uploaded.secure_url });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "File upload failed" });
    }
  }
);

router.get("/:id/files", (req, res) => {
  db.all(
    `SELECT * FROM followup_files
     WHERE followup_id = ?
     ORDER BY uploaded_at DESC`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "File fetch error" });
      res.json(rows);
    }
  );
});


router.get("/:id/activity", (req, res) => {
  db.all(
    `SELECT a.*, u.name AS user_name
     FROM followup_activity a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.followup_id = ?
     ORDER BY a.created_at DESC`,
    [req.params.id],
    (err, rows) => res.json(rows)
  );
});



export default router;


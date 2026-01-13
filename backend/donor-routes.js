// FILE: backend/donor-routes.js
import express from "express";
import jwt from "jsonwebtoken";
import db from "./db.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// -----------------------------
// AUTH MIDDLEWARE
// -----------------------------
function authRequired(req, res, next) {
  const token = req.cookies?.["hc_admin_token"];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// -----------------------------
// HELPER — MAP DONOR
// -----------------------------
function mapDonor(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    notes: row.notes,
    created_at: row.created_at,
    last_donation_at: row.last_donation_at,
    donation_count: row.donation_count || 0,
    total_amount_cents: row.total_amount_cents || 0
  };
}

// ======================================================
// GET /api/donors  → full list, searchable, paginated
// ======================================================
router.get("/donors", authRequired, (req, res) => {
  const { q = "", page = 1, pageSize = 25 } = req.query;
  const limit = Number(pageSize) || 25;
  const offset = (Number(page) - 1) * limit;

  const where = q
    ? `WHERE d.name LIKE ? OR d.email LIKE ? OR d.phone LIKE ?`
    : "";
  const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];

  const sql = `
    SELECT
      d.*,
      COUNT(n.id) AS donation_count,
      COALESCE(SUM(
        CASE WHEN n.status IN ('paid','succeeded')
        THEN n.amount_cents ELSE 0 END
      ), 0) AS total_amount_cents,
      MAX(n.created_at) AS last_donation_at
    FROM donors d
    LEFT JOIN donations n ON n.donor_id = d.id
    ${where}
    GROUP BY d.id
    ORDER BY last_donation_at DESC NULLS LAST, d.created_at DESC
    LIMIT ? OFFSET ?
  `;

  db.all(sql, [...params, limit, offset], (err, rows) => {
    if (err) {
      console.error("Error fetching donors:", err);
      return res.status(500).json({ error: "Failed to load donors" });
    }
    res.json(rows.map(mapDonor));
  });
});

// ======================================================
// GET /api/donors/:id  → detailed donor profile
// ======================================================
router.get("/donors/:id", authRequired, (req, res) => {
  const donorId = req.params.id;

  const mainSql = `
    SELECT
      d.*,
      COUNT(n.id) AS donation_count,
      COALESCE(SUM(
        CASE WHEN n.status IN ('paid','succeeded')
        THEN n.amount_cents ELSE 0 END
      ), 0) AS total_amount_cents,
      MAX(n.created_at) AS last_donation_at
    FROM donors d
    LEFT JOIN donations n ON n.donor_id = d.id
    WHERE d.id = ?
    GROUP BY d.id
  `;

  db.get(mainSql, [donorId], (err, donor) => {
    if (err) {
      console.error("Error fetching donor:", err);
      return res.status(500).json({ error: "Failed to load donor" });
    }
    if (!donor) return res.status(404).json({ error: "Donor not found" });

    res.json(mapDonor(donor));
  });
});

// ======================================================
// GET /api/donors/:id/donations → donation history
// ======================================================
router.get("/donors/:id/donations", authRequired, (req, res) => {
  db.all(
    `
    SELECT
      id,
      amount_cents,
      currency,
      status,
      frequency,
      fund,
      note,
      created_at
    FROM donations
    WHERE donor_id = ?
    ORDER BY created_at DESC
  `,
    [req.params.id],
    (err, rows) => {
      if (err) {
        console.error("Error fetching donor donations:", err);
        return res.status(500).json({ error: "Failed to load donor donations" });
      }

      res.json(
        rows.map((r) => ({
          ...r,
          amount_dollars: (r.amount_cents || 0) / 100,
        }))
      );
    }
  );
});

// ======================================================
// POST /api/donors → create donor manually
// ======================================================
router.post("/donors", authRequired, (req, res) => {
  const {
    name,
    email,
    phone,
    address,
    city,
    state,
    zip,
    notes,
  } = req.body;

  if (!email) return res.status(400).json({ error: "Email is required" });

  db.run(
    `
    INSERT INTO donors
      (name, email, phone, address, city, state, zip, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      name || "",
      email,
      phone || null,
      address || null,
      city || null,
      state || null,
      zip || null,
      notes || null,
      Date.now(),
    ],
    function (err) {
      if (err) {
        console.error("Error inserting donor:", err);
        return res.status(500).json({ error: "Failed to create donor" });
      }
      res.status(201).json({ id: this.lastID });
    }
  );
});

// ======================================================
// PUT /api/donors/:id → update donor
// ======================================================
router.put("/donors/:id", authRequired, (req, res) => {
  const { id } = req.params;
  const { name, email, phone, address, city, state, zip, notes } = req.body;

  db.run(
    `
    UPDATE donors
    SET
      name = COALESCE(?, name),
      email = COALESCE(?, email),
      phone = COALESCE(?, phone),
      address = COALESCE(?, address),
      city = COALESCE(?, city),
      state = COALESCE(?, state),
      zip = COALESCE(?, zip),
      notes = COALESCE(?, notes)
    WHERE id = ?
  `,
    [name, email, phone, address, city, state, zip, notes, id],
    function (err) {
      if (err) {
        console.error("Error updating donor:", err);
        return res.status(500).json({ error: "Failed to update donor" });
      }
      if (this.changes === 0)
        return res.status(404).json({ error: "Donor not found" });

      res.json({ updated: true });
    }
  );
});

// ======================================================
// DELETE /api/donors/:id
// ======================================================
router.delete("/donors/:id", authRequired, (req, res) => {
  db.run(`DELETE FROM donors WHERE id = ?`, [req.params.id], function (err) {
    if (err) {
      console.error("Error deleting donor:", err);
      return res.status(500).json({ error: "Failed to delete donor" });
    }
    res.json({ deleted: this.changes > 0 });
  });
});

// ======================================================
// GET /api/donations/summary → dashboard totals
// ======================================================
router.get("/donations/summary", authRequired, (req, res) => {
  const result = {};

  db.get(
    `
      SELECT COUNT(DISTINCT donor_id) AS total_donors,
             COUNT(*) AS total_donations,
             COALESCE(SUM(
                CASE WHEN status IN ('paid','succeeded')
                THEN amount_cents ELSE 0 END
             ), 0) AS total_amount_cents
      FROM donations
    `,
    [],
    (err, row1) => {
      if (err) {
        console.error("Error summary 1:", err);
        return res.status(500).json({ error: "Failed to load summary" });
      }

      result.total_donors = row1.total_donors;
      result.total_donations = row1.total_donations;
      result.total_amount_cents = row1.total_amount_cents;

      db.get(
        `
        SELECT COALESCE(SUM(
          CASE WHEN status IN ('paid','succeeded')
          THEN amount_cents ELSE 0 END
        ), 0) AS last30_amount_cents
        FROM donations
        WHERE created_at >= datetime('now', '-30 days')
      `,
        [],
        (err2, row2) => {
          if (err2) {
            console.error("Error summary 2:", err2);
            return res.status(500).json({ error: "Failed to load summary" });
          }

          result.last30_amount_cents = row2.last30_amount_cents;
          res.json(result);
        }
      );
    }
  );
});

export default router;

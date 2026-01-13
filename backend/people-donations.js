// FILE: backend/people-donations.js
import express from "express";
import jwt from "jsonwebtoken";
import db from "./db.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// -----------------------------
// AUTH MIDDLEWARE
// -----------------------------
function authRequired(req, res, next) {
  const token = req.cookies["hc_admin_token"];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// =====================================================
// 1️⃣ GET donations FOR A PERSON using person_id
//     (primary People → Donations tab)
// =====================================================
router.get("/people/:id/donations", authRequired, (req, res) => {
  const personId = req.params.id;

  const sql = `
    SELECT
      donations.id,
      donations.donor_id,
      donations.amount_cents,
      donations.currency,
      donations.status,
      donations.frequency,
      donations.fund,
      donations.note,
      donations.created_at,
      donors.name AS donor_name,
      donors.email AS donor_email
    FROM donations
    JOIN donors ON donors.id = donations.donor_id
    WHERE donors.person_id = ?
    ORDER BY donations.created_at DESC
  `;

  db.all(sql, [personId], (err, rows) => {
    if (err) {
      console.error("Error loading person donations:", err);
      return res.status(500).json({ error: "Failed to load donations" });
    }

    res.json(
      rows.map((r) => ({
        ...r,
        amount_dollars: (r.amount_cents || 0) / 100,
      }))
    );
  });
});

// =====================================================
// 2️⃣ GET donations for a person using EMAIL
//     (fallback for people not linked yet)
//     /api/people/email/:email/donations
// =====================================================
router.get("/people/email/:email/donations", authRequired, (req, res) => {
  const email = req.params.email;

  const sql = `
    SELECT
      donations.id,
      donations.donor_id,
      donations.amount_cents,
      donations.currency,
      donations.status,
      donations.frequency,
      donations.fund,
      donations.note,
      donations.created_at,
      donors.name AS donor_name,
      donors.email AS donor_email
    FROM donations
    JOIN donors ON donors.id = donations.donor_id
    WHERE donors.email = ?
    ORDER BY donations.created_at DESC
  `;

  db.all(sql, [email], (err, rows) => {
    if (err) {
      console.error("Error loading email donations:", err);
      return res.status(500).json({ error: "Failed to load donations" });
    }

    res.json(
      rows.map((r) => ({
        ...r,
        amount_dollars: (r.amount_cents || 0) / 100,
      }))
    );
  });
});

// =====================================================
// 3️⃣ LINK a donor to a person profile
//     POST /api/people/:id/link-donor
// =====================================================
router.post("/people/:id/link-donor", authRequired, (req, res) => {
  const personId = req.params.id;
  const { email } = req.body;

  if (!email)
    return res.status(400).json({ error: "Email is required to link donor." });

  db.run(
    `UPDATE donors SET person_id = ? WHERE email = ?`,
    [personId, email],
    function (err) {
      if (err) {
        console.error("Link donor error:", err);
        return res.status(500).json({ error: "Database error linking donor." });
      }

      if (this.changes === 0)
        return res.status(400).json({ error: "No donor with that email found." });

      res.json({ linked: true, email, person_id: personId });
    }
  );
});

export default router;

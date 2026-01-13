import express from "express";
import db from "../db.js";
import requireMember from "../middleware/requireMember.js";
import { awardBadgeIfNeeded } from "../utils/awardBadge.js";

const router = express.Router();

// --------------------------------------------
// GET /api/members/giving-history
// Member-facing giving analytics (CENT-BASED)
// --------------------------------------------
router.get("/giving-history", requireMember, async (req, res) => {
  const memberId = req.memberId;

  try {
    // --------------------------------------------
    // 1️⃣ Load donation history (most recent first)
    // --------------------------------------------
    const donations = await new Promise((resolve, reject) => {
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
        WHERE member_id = ?
        AND payment_status IN ('paid', 'succeeded')
        ORDER BY created_at DESC
        `,
        [memberId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });

    // --------------------------------------------
    // 2️⃣ Aggregate totals (CENT-SAFE)
    // --------------------------------------------
    const totals = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT
          COUNT(*) AS donation_count,
          COALESCE(SUM(amount_cents), 0) AS total_cents
        FROM donations
        WHERE member_id = ?
          AND status IN ('paid', 'succeeded')
        `,
        [memberId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });

    const donationCount = totals?.donation_count || 0;
    const totalCents = totals?.total_cents || 0;

    // --------------------------------------------
    // 3️⃣ Badge logic (safe + async)
    // --------------------------------------------
    if (donationCount >= 1)
      await awardBadgeIfNeeded(memberId, "First Time Giver");

    if (donationCount >= 5)
      await awardBadgeIfNeeded(memberId, "Faithful Giver");

    if (donationCount >= 10)
      await awardBadgeIfNeeded(memberId, "Kingdom Builder");

    // --------------------------------------------
    // 4️⃣ Shape response for frontend usability
    // --------------------------------------------
    res.json({
      success: true,

      summary: {
        donation_count: donationCount,
        total_cents: totalCents,
        total_dollars: Number((totalCents / 100).toFixed(2)),
      },

      donations: donations.map((d) => ({
        id: d.id,
        amount_cents: d.amount_cents,
        amount_dollars: Number((d.amount_cents / 100).toFixed(2)),
        currency: d.currency,
        status: d.status,
        frequency: d.frequency,
        fund: d.fund || "General Fund",
        note: d.note,
        created_at: d.created_at,
      })),
    });
  } catch (err) {
    console.error("❌ Member giving history error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to load giving history",
    });
  }
});

// --------------------------------------------
// Placeholder receipt endpoint (future PDF)
// --------------------------------------------
router.get("/giving-history/:id/receipt", requireMember, (req, res) => {
  res.json({
    success: true,
    message: "Receipt endpoint ready. Connect PDF generator here.",
  });
});

// routes/member-analytics.js
router.get("/members/me/giving-summary", requireMember, async (req, res) => {
  const memberId = req.memberId;

  try {
    const summary = await getMemberGivingSummary(memberId);
    res.json({ success: true, summary });
  } catch (err) {
    console.error("Member giving summary error:", err);
    res.status(500).json({ success: false });
  }
});


export default router;

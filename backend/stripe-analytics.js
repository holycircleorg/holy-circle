// backend/stripe-analytics.js
// Purpose: Fetch donation analytics directly from Stripe

import Stripe from "stripe";
import express from "express";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Convert cents -> dollars as NUMBER
function toDollars(amount) {
  if (!amount) return 0;
  return Math.round((amount / 100) * 100) / 100;
}

// GET /api/stripe/analytics
// Returns BOTH monthly and daily giving analytics
router.get("/analytics", async (req, res) => {
  try {
    // 1. Load recent charges (you can increase limit later if needed)
    const charges = await stripe.charges.list({ limit: 100 });

    // 2. Total Revenue (all paid charges)
    let totalCents = 0;
    charges.data.forEach((c) => {
      if (c.paid && c.amount) totalCents += c.amount;
    });

    // 3. Monthly Revenue (last 12 months)
    const now = new Date();
    const monthTotalsCents = {};
    const monthKeys = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`; // e.g. "2026-2"
      monthKeys.push(key);
      monthTotalsCents[key] = 0;
    }

    charges.data.forEach((charge) => {
      if (!charge.created || !charge.paid || !charge.amount) return;
      const d = new Date(charge.created * 1000);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (monthTotalsCents[key] !== undefined) {
        monthTotalsCents[key] += charge.amount;
      }
    });

    // 4. Daily Revenue (last 30 days)
    const dailyTotalsCents = {};
    const dailyLabels = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - i
      );
      const key = d.toISOString().slice(0, 10); // "YYYY-MM-DD"
      dailyLabels.push(key);
      dailyTotalsCents[key] = 0;
    }

    charges.data.forEach((charge) => {
      if (!charge.created || !charge.paid || !charge.amount) return;
      const d = new Date(charge.created * 1000);
      const key = d.toISOString().slice(0, 10);
      if (dailyTotalsCents[key] !== undefined) {
        dailyTotalsCents[key] += charge.amount;
      }
    });

    // 5. Recurring Revenue (subscriptions)
    const subs = await stripe.subscriptions.list({ limit: 100 });
    let recurringCents = 0;
    subs.data.forEach((s) => {
      const unit = s.items.data[0]?.price?.unit_amount;
      if (unit) recurringCents += unit;
    });

    // 6. Top Funds (using Stripe metadata.fund)
    const fundTotalsCents = {};
    charges.data.forEach((charge) => {
      if (!charge.paid || !charge.amount) return;
      const fund = charge.metadata?.fund || "General Fund";
      if (!fundTotalsCents[fund]) fundTotalsCents[fund] = 0;
      fundTotalsCents[fund] += charge.amount;
    });

    // Build monthly arrays (in order of monthKeys)
    const monthlyLabels = monthKeys;
    const monthlyTotals = monthKeys.map((key) =>
      toDollars(monthTotalsCents[key] || 0)
    );

    // Build daily totals array (in order of dailyLabels)
    const dailyTotals = dailyLabels.map((key) =>
      toDollars(dailyTotalsCents[key] || 0)
    );

    // Build fund breakdown in dollars
    const fundBreakdown = Object.entries(fundTotalsCents).map(
      ([fund, amt]) => ({
        fund,
        amount: toDollars(amt),
      })
    );

    return res.json({
      success: true,
      totalRevenue: toDollars(totalCents),
      recurringRevenue: toDollars(recurringCents),
      monthlyLabels,
      monthlyTotals,
      dailyLabels,
      dailyTotals,
      fundBreakdown,
    });
  } catch (err) {
    console.error("Stripe analytics error:", err);
    res.status(500).json({ error: "Failed to load Stripe analytics" });
  }
});

// stripe-analytics.js
export async function getMemberGivingSummary(memberId) {
  return new Promise((resolve, reject) => {
    db.get(
      `
      SELECT
        COUNT(*) AS donation_count,
        SUM(amount_cents) AS total_cents,
        MAX(created_at) AS last_donation_at
      FROM donations
      WHERE member_id = ?
        AND status = 'succeeded'
      `,
      [memberId],
      (err, row) => {
        if (err) return reject(err);

        resolve({
          donationCount: row.donation_count || 0,
          totalCents: row.total_cents || 0,
          lastDonationAt: row.last_donation_at || null,
        });
      }
    );
  });
}


export default router;

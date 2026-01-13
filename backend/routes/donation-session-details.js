import db from "../db.js";
import express from "express";
import Stripe from "stripe";


const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// GET /api/donations/session-details?session_id=cs_xxx
router.get("/donations/session-details", (req, res) => {
  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({ success: false });
  }

  db.get(
    `
    SELECT *
    FROM donations
    WHERE stripe_session_id = ?
    `,
    [session_id],
    (err, row) => {
      if (err || !row) {
        return res.json({ success: false });
      }

      res.json({
        success: true,
        session: {
          charge_id: row.charge_id,
          receipt_url: row.receipt_url,
          payment_intent_id: row.payment_intent_id,
          payment_intent_status: row.payment_status,
          payment_status: row.payment_status,
          amount_total: row.amount_cents,
          currency: row.currency,
          created: row.created_at,
          customer_details: {
            name: row.email
          }
        }
      });
    }
  );
});


export default router;

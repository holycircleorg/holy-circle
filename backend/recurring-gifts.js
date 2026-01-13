// FILE: backend/recurring-gifts.js
import express from "express";
import Stripe from "stripe";
import db from "./db.js";
import jwt from "jsonwebtoken";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const JWT_SECRET = process.env.JWT_SECRET;

// -----------------------------
// AUTH MIDDLEWARE
// -----------------------------
function authRequired(req, res, next) {
  const token = req.cookies?.["hc_admin_token"];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ---------------------------------------------------------------------
// 1️⃣ GET ALL RECURRING GIFTS (Admin Dashboard List)
//     GET /api/recurring-gifts
// ---------------------------------------------------------------------
router.get("/recurring-gifts", authRequired, async (req, res) => {
  try {
    const subs = await stripe.subscriptions.list({
      limit: 100,
      expand: ["data.customer"],
    });

    const mapped = subs.data.map((s) => {
      const customer = s.customer;
      const email =
        typeof customer === "object" ? customer.email : s.metadata?.donor_email;

      const name =
        typeof customer === "object" ? customer.name : s.metadata?.donor_name;

      return {
        id: s.id,
        status: s.status,
        interval: s.items.data[0]?.plan?.interval || null,
        amount_dollars:
          (s.items.data[0]?.plan?.amount || 0) / 100,
        current_period_end: s.current_period_end * 1000,
        donor_email: email || null,
        donor_name: name || null,
        donor_id: s.metadata?.donor_id || null,
      };
    });

    res.json(mapped);
  } catch (err) {
    console.error("Error loading recurring gifts:", err);
    res.status(500).json({ error: "Failed to load recurring gifts" });
  }
});

// ---------------------------------------------------------------------
// 2️⃣ GET RECURRING GIFTS FOR A SPECIFIC DONOR
//     GET /api/donors/:id/recurring
// ---------------------------------------------------------------------
router.get("/donors/:id/recurring", authRequired, async (req, res) => {
  const donorId = req.params.id;

  db.get(`SELECT stripe_customer_id FROM donors WHERE id = ?`, [donorId], async (err, row) => {
    if (err) {
      console.error("Error fetching donor:", err);
      return res.status(500).json({ error: "Failed to load donor" });
    }

    if (!row || !row.stripe_customer_id) {
      return res.json([]); // donor has not given via subscription yet
    }

    try {
      const subs = await stripe.subscriptions.list({
        customer: row.stripe_customer_id,
        status: "active",
        expand: ["data.customer"],
      });

      res.json(
        subs.data.map((s) => ({
          id: s.id,
          status: s.status,
          interval: s.items.data[0]?.plan?.interval || null,
          amount_dollars:
            (s.items.data[0]?.plan?.amount || 0) / 100,
          current_period_end: s.current_period_end * 1000,
          donor_id: donorId,
          donor_name: s.metadata?.donor_name || null,
          donor_email: s.metadata?.donor_email || null,
        }))
      );
    } catch (err2) {
      console.error("Error loading donor subscriptions:", err2);
      res.status(500).json({ error: "Failed to load subscriptions" });
    }
  });
});

// ---------------------------------------------------------------------
// 3️⃣ CANCEL A RECURRING GIFT
//     POST /api/recurring-gifts/:id/cancel
// ---------------------------------------------------------------------
router.post("/recurring-gifts/:id/cancel", authRequired, async (req, res) => {
  try {
    const subscriptionId = req.params.id;

    const canceled = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    res.json({
      canceled: true,
      subscription: canceled,
    });
  } catch (err) {
    console.error("Error canceling subscription:", err);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

// ---------------------------------------------------------------------
// 4️⃣ AUTO-LINK DONOR TO STRIPE CUSTOMER (when subscribing)
//     POST /api/recurring-gifts/link-customer
//     { donor_id, customer_id }
// ---------------------------------------------------------------------
router.post("/recurring-gifts/link-customer", authRequired, (req, res) => {
  const { donor_id, customer_id } = req.body;

  if (!donor_id || !customer_id)
    return res.status(400).json({ error: "donor_id and customer_id required" });

  db.run(
    `UPDATE donors SET stripe_customer_id = ? WHERE id = ?`,
    [customer_id, donor_id],
    function (err) {
      if (err) {
        console.error("Error linking stripe customer:", err);
        return res.status(500).json({ error: "Database error linking customer" });
      }
      res.json({ linked: true });
    }
  );
});

// ---------------------------------------------------------------------
// 5️⃣ CREATE SUBSCRIPTION (Admin)
//     POST /api/recurring-gifts/create
//     Useful if you want to create recurring giving from admin.
// ---------------------------------------------------------------------
router.post("/recurring-gifts/create", authRequired, async (req, res) => {
  try {
    const { donor_id, price_id, metadata = {} } = req.body;

    if (!donor_id || !price_id)
      return res.status(400).json({ error: "Missing donor_id or price_id" });

    // get donor email
    const donor = await new Promise((resolve, reject) =>
      db.get(`SELECT email, name, stripe_customer_id FROM donors WHERE id = ?`, [donor_id],
        (err, row) => (err ? reject(err) : resolve(row)))
    );

    let customerId = donor.stripe_customer_id;

    if (!customerId) {
      // Create customer in Stripe
      const customer = await stripe.customers.create({
        email: donor.email,
        name: donor.name,
        metadata: { donor_id },
      });
      customerId = customer.id;

      // Save back to DB
      db.run(
        `UPDATE donors SET stripe_customer_id = ? WHERE id = ?`,
        [customerId, donor_id]
      );
    }

    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price_id }],
      metadata: {
        donor_id,
        donor_email: donor.email,
        donor_name: donor.name,
        ...metadata,
      },
    });

    res.json(sub);
  } catch (err) {
    console.error("Error creating subscription:", err);
    res.status(500).json({ error: "Failed to create recurring gift" });
  }
});

export default router;

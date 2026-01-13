// FILE: backend/stripe-donations.js
import express from "express";
import Stripe from "stripe";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Helper: fee calculation
function calculateAmountCents(amount, coverFees) {
  const cents = Math.round(Number(amount) * 100);
  if (!coverFees) return cents;

  // Stripe fee formula: (amount + fixed) / (1 - percent)
  const fixed = 30; // 30¢
  const percent = 0.029; // 2.9%

  return Math.round((cents + fixed) / (1 - percent));
}

router.post("/create-session", async (req, res) => {
  try {
    const {
      amount,
      donorName,
      donorEmail,
      fund,
      frequency,
      note,
      coverFees,
    } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({ error: "Invalid amount." });
    }
    if (!donorEmail) {
      return res.status(400).json({ error: "Email required." });
    }

    const finalAmount = calculateAmountCents(amount, coverFees);
    const isOneTime =
      !frequency || frequency === "once" || frequency === "one_time";

    // Build line item
    const lineItem = {
      price_data: {
        currency: "usd",
        unit_amount: finalAmount,
        product_data: {
          name: isOneTime ? "Donation" : "Monthly Donation",
          description: note || "",
        },
        ...(isOneTime ? {} : { recurring: { interval: "month" } }),
      },
      quantity: 1,
    };

    const session = await stripe.checkout.sessions.create({
      mode: isOneTime ? "payment" : "subscription",
      payment_method_types: ["card"],
      customer_email: donorEmail,
      line_items: [lineItem],
      success_url: `${process.env.CLIENT_ORIGIN}/complete.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_ORIGIN}/cancel.html`,
      metadata: {
        donor_name: donorName || "",
        donor_note: note || "",
        frequency: isOneTime ? "one_time" : "monthly",
        fund: fund || "",
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe session error:", err);
    res.status(500).json({ error: "Unable to create donation session." });
  }
});

export default router;

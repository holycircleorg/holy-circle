import Stripe from "stripe";
import db from "./db.js";
import { generateDonationReceiptPDF } from "./receipts.js";
import { sendDonationReceiptEmail } from "./email.js";
import { enqueueAutomationForTrigger } from "./email-automation.js";
import { broadcastRealtime } from "./realtime/realtime-server.js";
import { broadcast } from "./socket.js";



const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ------------------------------------------------------
// Helper: Insert donation into SQLite (SAFE)
// ------------------------------------------------------
function insertDonation({ memberId = null, session, charge }) {
  db.run(
    `
    INSERT OR IGNORE INTO donations (
      member_id,
      email,
      stripe_session_id,
      payment_intent_id,
      charge_id,
      amount_cents,
      currency,
      receipt_url,
      payment_status,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      memberId,
      session.customer_details?.email || null,
      session.id,
      session.payment_intent,
      charge?.id || null,
      session.amount_total,
      session.currency,
      charge?.receipt_url || null,
      session.payment_status,
      session.created
    ],
    (err) => {
      if (err) {
        console.error("❌ Donation insert failed:", err);
        return;
      }
      broadcastRealtime({
        donation: {
          amountCents: session.amount_total,
          currency: session.currency,
          memberId,
          donorEmail: session.customer_details?.email || null,
          createdAt: Date.now(),
        },
      });

    }
  );
}


// ------------------------------------------------------
// Helper: Send receipt email + PDF (SAFE)
// ------------------------------------------------------
async function sendReceipt({ session, donorEmail, donorName }) {
  if (!donorEmail) {
    console.warn("⚠ No donor email; skipping receipt");
    return;
  }

  try {
    const paymentIntentId = session.payment_intent;

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["charges"],
    });

    const charge = pi.charges?.data?.[0];
    if (!charge) {
      console.warn("⚠ No charge found for receipt");
      return;
    }
    const memberId = await resolveMemberIdByEmail(donorEmail);

  insertDonation({
    memberId,
    session,
    charge
  });


    const pdfBuffer = await generateDonationReceiptPDF({
      donorEmail,
      donorName,
      amount: session.amount_total,
      currency: session.currency,
      donationDate: new Date(pi.created * 1000),
      paymentIntentId,
      chargeId: charge.id,
    });

    await sendDonationReceiptEmail({
      to: donorEmail,
      pdfBuffer,
      amount: session.amount_total,
      currency: session.currency,
      donationDate: new Date(pi.created * 1000),
    });

    console.log("📧 Donation receipt sent:", donorEmail);
  } catch (err) {
    console.error("❌ Receipt send failed:", err);
  }
}

function resolveMemberIdByEmail(email) {
  return new Promise((resolve) => {
    if (!email) return resolve(null);

    db.get(
      `SELECT id FROM members WHERE email = ?`,
      [email],
      (err, row) => {
        if (err || !row) return resolve(null);
        resolve(row.id);
      }
    );
  });
}

// ------------------------------------------------------
// MAIN WEBHOOK HANDLER (Stripe-Safe)
// ------------------------------------------------------
export default async function stripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // --------------------------------------------------
  // Handle successful Checkout
  // --------------------------------------------------
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("✅ checkout.session.completed webhook received:", session.id);


    const donorEmail =
      session.customer_email ||
      session.customer_details?.email ||
      null;

    const donorName =
      session.metadata?.donor_name ||
      session.customer_details?.name ||
      "Supporter";

   
    // ----------------------------------------------
    // Find or create donor (SAFE UPSERT)
    // ----------------------------------------------
    db.get(
      `SELECT id FROM donors WHERE email = ?`,
      [donorEmail],
      (err, donor) => {
        if (err) {
          console.error("❌ Donor lookup failed:", err);
          return;
        }

        if (donor) {
          // Existing donor
        (async () => {
        const memberId = await resolveMemberIdByEmail(donorEmail);


        sendReceipt({ session, donorEmail, donorName });

        enqueueAutomationForTrigger("donation", {
          donorId: donor.id,
          memberId,
        });
      })();

          sendReceipt({ session, donorEmail, donorName });

          enqueueAutomationForTrigger("donation", {
            donorId: donor.id,
            memberId: null,
          });
        } else {
          // New donor
          db.run(
            `INSERT INTO donors (name, email, created_at) VALUES (?, ?, ?)`,
            [donorName, donorEmail, Date.now()],
            function (err2) {
              if (err2) {
                console.error("❌ Donor insert failed:", err2);
                return;
              }

              const newDonorId = this.lastID;



              sendReceipt({ session, donorEmail, donorName });

              enqueueAutomationForTrigger("first_donation", {
                donorId: newDonorId,
                memberId: null,
              });
            }
          );
        }
      }
    );
  }

  // Stripe requires a 200 response
  res.sendStatus(200);
}

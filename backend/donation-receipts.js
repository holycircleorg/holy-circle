// ============================================================
//  HOLY CIRCLE — SINGLE DONATION PDF RECEIPT (Matches Backend)
//  Route: GET /api/donation-receipt/pdf?charge=ch_xxx
// ============================================================

import express from "express";
import PDFDocument from "pdfkit";
import Stripe from "stripe";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

function formatAmount(cents) {
  return (cents / 100).toFixed(2);
}

function formatStripeDate(ts) {
  return new Date(ts * 1000).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

router.get("/donation-receipt/pdf", async (req, res) => {
  try {
    const chargeId = req.query.charge;

    if (!chargeId) {
      return res.status(400).json({ error: "Missing charge parameter" });
    }

    const charge = await stripe.charges.retrieve(chargeId);

    if (!charge) {
      return res.status(404).json({ error: "Charge not found" });
    }

    // Extract fields from Stripe charge
    const donorName =
      charge.billing_details?.name ||
      charge.metadata?.name ||
      "Generous Donor";

    const email =
      charge.billing_details?.email ||
      charge.receipt_email ||
      "Not provided";

    const amount = formatAmount(charge.amount);
    const createdAt = formatStripeDate(charge.created);
    const cardLast4 =
      charge.payment_method_details?.card?.last4 || "••••";
    const cardBrand =
      charge.payment_method_details?.card?.brand?.toUpperCase() ||
      "CARD";

    const transactionId = charge.id;
    const currency = charge.currency.toUpperCase();

    // Set PDF headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=HolyCircle-Receipt-${transactionId}.pdf`
    );

    // Create doc
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // ===========================================
    // HEADER
    // ===========================================
    doc
      .fontSize(24)
      .fillColor("#002e6b")
      .text("Holy Circle", { align: "left" });

    doc
      .fontSize(10)
      .fillColor("#666")
      .text("Faith • Media • Community");

    doc.moveDown(1);

    doc
      .fontSize(18)
      .fillColor("#000")
      .text("Donation Receipt", { align: "right" });

    doc
      .fontSize(10)
      .fillColor("#555")
      .text("EIN: 33-3661912", { align: "right" })
      .text("501(c)(3) Nonprofit Organization", { align: "right" });

    doc.moveDown(1);

    // Line
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#cccccc")
      .lineWidth(1)
      .stroke();

    doc.moveDown(1.5);

    // ===========================================
    // DONOR INFO
    // ===========================================
    doc
      .fontSize(14)
      .fillColor("#000")
      .text("Donor Information", { underline: true });

    doc.moveDown(0.5).fontSize(11);

    doc.text(`Name: ${donorName}`);
    doc.text(`Email: ${email}`);

    doc.moveDown(1);

    // ===========================================
    // DONATION SUMMARY
    // ===========================================
    doc
      .fontSize(14)
      .text("Donation Summary", { underline: true });

    doc.moveDown(0.5).fontSize(11);

    doc.text(`Amount: $${amount} ${currency}`);
    doc.text(`Date: ${createdAt}`);
    doc.text(`Payment Method: ${cardBrand} ending in ${cardLast4}`);
    doc.text(`Transaction ID: ${transactionId}`);

    doc.moveDown(1.5);

    // ===========================================
    // THANK YOU + IMPACT
    // ===========================================
    doc
      .fontSize(14)
      .text("Message from Holy Circle", { underline: true });

    doc.moveDown(0.5).fontSize(11);

    doc.text(
      "Thank you for sowing into God's Kingdom through Holy Circle. Your generosity fuels ministry, discipleship, outreach, and Gospel-centered media.",
      { align: "left" }
    );

    doc.moveDown(0.5);

    doc.text("Your gift helps us:", { align: "left" });

    doc.moveDown(0.3);
    doc.list(
      [
        "Create Christ-centered media that spreads the Gospel",
        "Host worship gatherings and community outreach events",
        "Support believers and families growing in their faith",
        "Develop biblical tools, resources, and discipleship teachings",
      ],
      { bulletRadius: 2 }
    );

    doc.moveDown(0.8);

    doc.text("“Give, and it will be given to you.” — Luke 6:38", {
      align: "left",
      oblique: true,
    });

    doc.moveDown(1.5);

    // ===========================================
    // TAX INFO
    // ===========================================
    doc
      .fontSize(14)
      .text("Tax Information", { underline: true });

    doc.moveDown(0.5).fontSize(11);

    doc.text(
      "Holy Circle is a registered 501(c)(3) nonprofit organization. Your donation is tax-deductible to the fullest extent of the law."
    );
    doc.text(
      "No goods or services were provided in exchange for this contribution."
    );

    doc.moveDown(2);

    // ===========================================
    // FOOTER
    // ===========================================
    doc
      .fontSize(10)
      .fillColor("#777")
      .text("Holy Circle", { align: "center" })
      .text("Faith • Media • Community", { align: "center" })
      .text("holycircle.org", { align: "center" });

    doc.end();
  } catch (err) {
    console.error("PDF ERROR:", err);
    return res.status(500).json({ error: "Failed to generate receipt PDF" });
  }
});

export default router;

// ================================
// /backend/routes/receipts.js (Unified ESM Version)
// ================================

import express from "express";
import db, { dbRun, dbGet, dbAll } from "./db.js";
import requireAdmin from "./middleware/requireAdmin.js";
import requireMember from "./middleware/requireMember.js";


import PDFDocument from "pdfkit";
import getStream from "get-stream";

const router = express.Router();

// --------------------------------
// PDF Generator (kept inside this file)
// --------------------------------
export async function generateDonationReceiptPDF({
  donorEmail,
  donorName,
  amount,
  currency,
  donationDate,
  paymentIntentId,
  chargeId
}) {
  const doc = new PDFDocument({ margin: 40 });
  const pdfStream = getStream.buffer(doc);

  doc.fontSize(20).text("Donation Receipt", { align: "center" }).moveDown();

  doc.fontSize(12).text(`Donor Name: ${donorName}`);
  doc.text(`Donor Email: ${donorEmail}`);
  doc.text(`Amount: ${amount} ${currency}`);
  doc.text(`Donation Date: ${new Date(donationDate).toLocaleString()}`);
  doc.text(`Payment Intent ID: ${paymentIntentId}`);
  doc.text(`Charge ID: ${chargeId}`);
  doc.moveDown().text("Thank you for your generosity!", { align: "center" });

  doc.end();
  return pdfStream;
}

// --------------------------------
// ADMIN: List all receipts
// --------------------------------
router.get("/", requireAdmin, async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT r.id, r.amount, r.currency, r.donation_date,
             m.email AS donorEmail, m.name AS donorName
      FROM donation_receipts r
      LEFT JOIN members m ON r.member_id = m.id
      ORDER BY r.donation_date DESC
    `);

    res.json({ success: true, receipts: rows });
  } catch (err) {
    console.error("Receipt list error:", err);
    res.status(500).json({ success: false });
  }
});

// --------------------------------
// MEMBER: Download own receipt
// --------------------------------
router.get("/:id/download", requireMember, async (req, res) => {
  const receiptId = req.params.id;

  try {
    const row = await dbGet(
      `
      SELECT r.*, m.email AS donorEmail, m.name AS donorName
      FROM donation_receipts r
      LEFT JOIN members m ON m.id = r.member_id
      WHERE r.id = ? AND r.member_id = ?
      `,
      [receiptId, req.memberId]
    );

    if (!row) {
      return res.status(404).json({ success: false, message: "Receipt not found" });
    }

    const pdfBuffer = await generateDonationReceiptPDF({
      donorEmail: row.donorEmail,
      donorName: row.donorName,
      amount: row.amount,
      currency: row.currency,
      donationDate: row.donation_date,
      paymentIntentId: row.payment_intent_id || "",
      chargeId: row.charge_id || ""
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="receipt-${receiptId}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Receipt PDF error:", err);
    res.status(500).json({ success: false });
  }
});

// --------------------------------
// ADMIN: Download any receipt
// --------------------------------
router.get("/:id/admin-download", requireAdmin, async (req, res) => {
  const receiptId = req.params.id;

  try {
    const row = await dbGet(
      `
      SELECT r.*, m.email AS donorEmail, m.name AS donorName
      FROM donation_receipts r
      LEFT JOIN members m ON m.id = r.member_id
      WHERE r.id = ?
      `,
      [receiptId]
    );

    if (!row) {
      return res.status(404).json({ success: false, message: "Receipt not found" });
    }

    const pdfBuffer = await generateDonationReceiptPDF({
      donorEmail: row.donorEmail,
      donorName: row.donorName,
      amount: row.amount,
      currency: row.currency,
      donationDate: row.donation_date,
      paymentIntentId: row.payment_intent_id || "",
      chargeId: row.charge_id || ""
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="receipt-${receiptId}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Admin receipt download error:", err);
    res.status(500).json({ success: false });
  }
});

export default router;

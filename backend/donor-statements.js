// FILE: backend/donor-statements.js
import express from "express";
import PDFDocument from "pdfkit";
import db from "./db.js";

const router = express.Router();
const EIN = "33-3661912"; // Holy Circle EIN

// ------------------------------------------------------
// Helper: Load donor + donations for a given year
// ------------------------------------------------------
function loadDonorAndDonations(donorId, year, cb) {
  db.get(`SELECT * FROM donors WHERE id = ?`, [donorId], (err, donor) => {
    if (err) return cb(err);
    if (!donor) return cb(new Error("DONOR_NOT_FOUND"));

    const sql = `
      SELECT *
      FROM donations
      WHERE donor_id = ?
      AND strftime('%Y', datetime(created_at / 1000, 'unixepoch')) = ?
      AND status IN ('paid','succeeded')
      ORDER BY created_at ASC;
    `;

    db.all(sql, [donorId, String(year)], (err2, rows) => {
      if (err2) return cb(err2);
      cb(null, { donor, donations: rows });
    });
  });
}

// ------------------------------------------------------
// GET /api/donors/:id/statement?year=2026&format=json|pdf
// ------------------------------------------------------
router.get("/donors/:id/statement", (req, res) => {
  const donorId = req.params.id;
  const year = req.query.year || new Date().getFullYear();
  const format = (req.query.format || "pdf").toLowerCase();

  loadDonorAndDonations(donorId, year, (err, data) => {
    if (err) {
      if (err.message === "DONOR_NOT_FOUND")
        return res.status(404).json({ error: "Donor not found" });

      return res.status(500).json({ error: "Failed to load statement data" });
    }

    const { donor, donations } = data;

    const totalCents = donations.reduce(
      (sum, d) => sum + (d.amount_cents || 0),
      0
    );
    const totalDollars = (totalCents / 100).toFixed(2);

    // --------------------------------------------------
    // JSON MODE (useful for Admin UI previews)
    // --------------------------------------------------
    if (format === "json") {
      return res.json({
        donor: {
          id: donor.id,
          name: donor.name,
          email: donor.email,
          address: donor.address,
          city: donor.city,
          state: donor.state,
          zip: donor.zip,
        },
        year,
        total_dollars: totalDollars,
        donations: donations.map((d) => ({
          id: d.id,
          amount_dollars: (d.amount_cents || 0) / 100,
          date: d.created_at,
          fund: d.fund,
        })),
      });
    }

    // --------------------------------------------------
    // PDF MODE
    // --------------------------------------------------
    const doc = new PDFDocument({ margin: 50 });
    const filename = `HolyCircle_Statement_${donor.id}_${year}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    doc.pipe(res);

    // --------------------------------------------------
    // HEADER
    // --------------------------------------------------
    doc
      .fontSize(22)
      .fillColor("#002e6b")
      .text("Holy Circle", { align: "left" });

    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .fillColor("#555")
      .text("Year-End Giving Statement", { align: "left" });
    doc.text(`Tax Year: ${year}`);

    doc.moveDown(1);

    // --------------------------------------------------
    // DONOR INFO
    // --------------------------------------------------
    doc.fontSize(12).fillColor("#002e6b").text("Donor Information", {
      underline: true,
    });

    doc.moveDown(0.3).fontSize(11).fillColor("#333");

    doc.text(`Name: ${donor.name || "—"}`);
    doc.text(`Email: ${donor.email || "—"}`);

    if (donor.address) doc.text(`Address: ${donor.address}`);
    if (donor.city || donor.state || donor.zip)
      doc.text(
        `${donor.city || ""}, ${donor.state || ""} ${donor.zip || ""}`.trim()
      );

    doc.moveDown(1);

    // --------------------------------------------------
    // TAX LANGUAGE (IRS REQUIRED)
    // --------------------------------------------------
    doc.fontSize(12).fillColor("#002e6b").text("Tax Information", {
      underline: true,
    });

    doc.moveDown(0.4).fontSize(11).fillColor("#333");
    doc.text(`Holy Circle EIN: ${EIN}`);
    doc.moveDown(0.3);

    doc.text(
      "Holy Circle is a registered 501(c)(3) nonprofit organization. Your donations are tax-deductible to the extent allowed by law."
    );

    doc.moveDown(0.3);
    doc.text(
      "No goods or services were provided in exchange for these donations unless otherwise noted."
    );

    doc.moveDown(1);

    // --------------------------------------------------
    // SUMMARY TOTAL
    // --------------------------------------------------
    doc
      .fontSize(14)
      .fillColor("#bf9745")
      .text(`Total Given in ${year}: $${totalDollars}`);

    doc.moveDown(1);

    // --------------------------------------------------
    // DONATION TABLE
    // --------------------------------------------------
    doc
      .fontSize(12)
      .fillColor("#002e6b")
      .text("Donation Breakdown", { underline: true });

    doc.moveDown(0.5);

    // Table header
    doc.fontSize(10).fillColor("#333");
    doc.text("Date", 50, doc.y, { width: 120 });
    doc.text("Fund", 200, doc.y, { width: 120 });
    doc.text("Amount", 400, doc.y, { width: 100, align: "right" });
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

    doc.moveDown(0.5);

    donations.forEach((d) => {
      const date = new Date(d.created_at).toLocaleDateString();
      const fund = d.fund || "General Fund";
      const dollars = (d.amount_cents || 0) / 100;

      doc.fontSize(10).text(date, 50, doc.y, { width: 120 });
      doc.text(fund, 200, doc.y, { width: 120 });
      doc.text(`$${dollars.toFixed(2)}`, 400, doc.y, {
        width: 100,
        align: "right",
      });

      doc.moveDown(0.5);
    });

    doc.moveDown(2);
    doc
      .fontSize(10)
      .fillColor("#777")
      .text(
        "Thank you for your faithful generosity. Your giving helps fuel media, outreach, and ministry worldwide.",
        { align: "center" }
      );

    doc.end();
  });
});

export default router;

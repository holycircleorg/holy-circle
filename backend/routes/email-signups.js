import express from "express";
import db from "../db.js";
import { triggerEmailAutomation } from "./email.js";



const router = express.Router();
router.post("/email-signups", async (req, res) => {
  try {
    const { email, source_page, intent } = req.body;

    if (!email || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "Invalid email" });
    }

    const source = source_page || "unknown";
    const emailIntent = intent || "newsletter";
    const now = Date.now();

    await db.run(
      `
      INSERT OR IGNORE INTO email_signups
      (email, source, intent, created_at)
      VALUES (?, ?, ?, ?)
      `,
      [email.toLowerCase(), source, emailIntent, now]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Email signup error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});


export default router;

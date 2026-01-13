import express from "express";
import db from "../db.js";
import sgMail from "@sendgrid/mail";

const router = express.Router();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

router.post("/notify-forum-launch", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Invalid email" });
  }

  const now = Date.now();

  // Track forum interest (analytics)
db.run(
  `
  INSERT INTO traffic_events (event, page, meta, created_at)
  VALUES (?, ?, ?, ?)
  `,
  [
    "forum_waitlist",
    "coming-soon",
    JSON.stringify({ source: "email_submit" }),
    now
  ]
);


  try {
    // Store email (ignore duplicates)
    await new Promise((resolve, reject) => {
      db.run(
        `
        INSERT OR IGNORE INTO forum_launch_notify
        (email, created_at)
        VALUES (?, ?)
        `,
        [email, now],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Send confirmation email
    await sgMail.send({
      to: email,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: process.env.SENDGRID_FROM_NAME || "Holy Circle"
      },
      subject: "You’re on the list — Holy Circle Forum",
      html: `
        <div style="font-family:Arial,sans-serif; line-height:1.6; color:#111">
          <h2>You’re on the list</h2>
          <p>
            Thanks for your interest in the Holy Circle Forum.
          </p>
          <p>
            We’re building a thoughtful space for faith, creativity,
            and meaningful conversation.
          </p>
          <p>
            We’ll email you when the forum opens.
          </p>
          <p style="margin-top:32px; font-size:13px; color:#666">
            Holy Circle
          </p>
        </div>
      `
    });

    res.json({ success: true });

  } catch (err) {
    console.error("Forum notify failed:", err);
    res.status(500).json({ error: "Failed to save email" });
  }
});

export default router;

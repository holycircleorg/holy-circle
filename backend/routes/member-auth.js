import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";

import db from "../db.js";
import cloudinary from "../cloudinary.js";
import requireMember from "../middleware/requireMember.js";

import crypto from "crypto";
import { sendGenericEmail } from "../email.js";

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:4000"; // dev

const router = express.Router();
const upload = multer({ dest: "tmp/" });

// ================================
// Helpers
// ================================
function normalizeEmail(email) {
  return (email || "").toLowerCase().trim();
}

function createToken(memberId) {
  return jwt.sign(
    { memberId },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "30d" }
  );
}

function setAuthCookie(res, token) {
  res.cookie("hc_member_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

// ================================
// GET /api/members/search
// Search for members by name/email
// ================================
router.get("/search", (req, res) => {
  const q = (req.query.query || "").trim();
  if (!q) return res.json([]);

  const like = `%${q}%`;

  db.all(
    `
    SELECT id, first_name, last_name, email
    FROM members
    WHERE first_name LIKE ? 
       OR last_name LIKE ? 
       OR email LIKE ?
    ORDER BY created_at DESC
    LIMIT 25
    `,
    [like, like, like],
    (err, rows) => {
      if (err) {
        console.error("Error searching members:", err);
        return res.status(500).json({ error: "Failed to search members" });
      }
      res.json(rows);
    }
  );
});



// ================================
// GET /api/members/auth/me
// Session check (single source of truth)
// ================================
router.get("/me", (req, res) => {
  try {
    const token = req.cookies?.hc_member_token;
    if (!token) {
      return res.json({ loggedIn: false });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    } catch {
      return res.json({ loggedIn: false });
    }

    const memberId = decoded.memberId || decoded.id;
    if (!memberId) {
      return res.json({ loggedIn: false });
    }

    db.get(
      `
      SELECT id, first_name, last_name, email, avatar_url, role
      FROM members
      WHERE id = ?

      `,
      [memberId],
      (err, row) => {
        if (err || !row) {
          return res.json({ loggedIn: false });
        }

        return res.json({
          loggedIn: true,
          member: {
            id: row.id,
            first_name: row.first_name,
            last_name: row.last_name,
            email: row.email,
            avatar_url: row.avatar_url || null,
             role: row.role 
          },
        });
      }
    );
  } catch (err) {
    console.error("GET /api/members/auth/me error:", err);
    return res.json({ loggedIn: false });
  }
});

// ================================
// POST /api/members/register
// ================================
router.post("/register", async (req, res) => {
  const { first_name, last_name, email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const cleanEmail = normalizeEmail(email);

  try {
    db.get(
      `SELECT id FROM members WHERE email = ?`,
      [cleanEmail],
      async (err, existing) => {
        if (err) {
          console.error("DB error on register:", err);
          return res.status(500).json({ error: "Something went wrong." });
        }

        if (existing) {
          return res
            .status(400)
            .json({ error: "An account with that email already exists." });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const created_at = Date.now();

        db.run(
          `
          INSERT INTO members
            (first_name, last_name, email, password_hash, created_at)
          VALUES (?, ?, ?, ?, ?)
        `,
          [first_name || "", last_name || "", cleanEmail, password_hash, created_at],
          function (err2) {
            if (err2) {
              console.error("Error inserting member:", err2);
              return res.status(500).json({ error: "Failed to create account." });
            }

            const newId = this.lastID;

            // Optional: Introduce createNotification only after your followup system is stable
            // createNotification({
            //   type: "member",
            //   message: `New member joined: ${first_name} ${last_name}`,
            //   metadata: { memberId: newId, email: cleanEmail },
            // });

            const token = createToken(newId);
            setAuthCookie(res, token);

            return res.json({
              success: true,
              profile: {
                id: newId,
                first_name: first_name || "",
                last_name: last_name || "",
                email: cleanEmail,
                avatar_url: null,
              },
            });
          }
        );
      }
    );
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Failed to create account." });
  }
});


// ================================
// POST /api/members/login
// ================================
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Email and password are required." });
  }

  const cleanEmail = normalizeEmail(email);

  db.get(
    `
    SELECT id, first_name, last_name, email, password_hash, avatar_url
    FROM members
    WHERE email = ?
  `,
    [cleanEmail],
    async (err, user) => {
      if (err) {
        console.error("Login DB error:", err);
        return res
          .status(500)
          .json({ error: "Something went wrong. Please try again." });
      }

      if (!user) {
        return res
          .status(400)
          .json({ error: "Invalid email or password." });
      }

      try {
        const matches = await bcrypt.compare(password, user.password_hash);
        if (!matches) {
          return res
            .status(400)
            .json({ error: "Invalid email or password." });
        }

        const token = createToken(user.id);
        setAuthCookie(res, token);

        return res.json({
          success: true,
          profile: {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            avatar_url: user.avatar_url || null,
          },
        });
      } catch (err2) {
        console.error("Login compare error:", err2);
        return res
          .status(500)
          .json({ error: "Something went wrong. Please try again." });
      }
    }
  );
});

// ================================
// POST /api/members/forgot
// Start password reset (send email)
// ================================
router.post("/auth/forgot", (req, res) => {
  return router.handle(req, res);
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  const cleanEmail = normalizeEmail(email);
  const now = Date.now();

  // Look up member by email
  db.get(
    `SELECT id, first_name FROM members WHERE email = ?`,
    [cleanEmail],
    (err, member) => {
      if (err) {
        console.error("Forgot password DB error:", err);
        return res
          .status(500)
          .json({ error: "Something went wrong. Please try again." });
      }

      // Always send generic response for security
      const genericResponse = {
        message:
          "If that email exists, we’ll send reset instructions to it shortly.",
      };

      // If no member, just return generic message
      if (!member) {
        return res.json(genericResponse);
      }

      // Create a secure token
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = now + 60 * 60 * 1000; // 1 hour

      // Store in member_password_resets table (already defined in db.js)
      db.run(
        `
        INSERT INTO member_password_resets (member_id, token, expires_at, used, created_at)
        VALUES (?, ?, ?, 0, ?)
        `,
        [member.id, token, expiresAt, now],
        async (err2) => {
          if (err2) {
            console.error("Insert reset token error:", err2);
            return res
              .status(500)
              .json({ error: "Could not start reset. Please try again." });
          }

          const resetUrl = `${CLIENT_ORIGIN}/reset-password.html?token=${token}`;
          console.log("🔐 Member reset link:", resetUrl);

          try {
            await sendGenericEmail({
              to: cleanEmail,
              subject: "Reset your Holy Circle password",
              html: `
                <p>Hi ${member.first_name || "there"},</p>
                <p>We received a request to reset your Holy Circle password.</p>
                <p>
                  <a href="${resetUrl}" style="display:inline-block;padding:10px 18px;background:#bf9745;color:#fff;text-decoration:none;border-radius:6px;">
                    Reset Password
                  </a>
                </p>
                <p>This link will expire in 1 hour. If you didn’t request this, you can ignore this email.</p>
                <p>— Holy Circle</p>
              `,
              text: `
Hi ${member.first_name || "there"},

We received a request to reset your Holy Circle password.

Reset your password: ${resetUrl}

This link will expire in 1 hour. If you didn’t request this, you can ignore this email.

— Holy Circle
              `,
            });

            return res.json(genericResponse);
          } catch (emailErr) {
            console.error("Error sending reset email:", emailErr);
            return res
              .status(500)
              .json({ error: "Could not send reset email. Please try again." });
          }
        }
      );
    }
  );
});




// ================================
// POST /api/members/logout
// ================================
router.post("/logout", (req, res) => {
  res.clearCookie("hc_member_token");
  return res.json({ success: true });
});

// ================================
// GET /api/members/auth/me
// Single source of truth for auth state
// ================================
router.get("/auth/me", (req, res) => {
  try {
    const token = req.cookies?.hc_member_token;
    if (!token) {
      return res.json({ loggedIn: false });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    } catch {
      return res.json({ loggedIn: false });
    }

    const memberId = payload.memberId || payload.id;
    if (!memberId) {
      return res.json({ loggedIn: false });
    }

    db.get(
      `
      SELECT id, first_name, last_name, email, avatar_url, role
      FROM members
      WHERE id = ?

      `,
      [memberId],
      (err, user) => {
        if (err || !user) {
          return res.json({ loggedIn: false });
        }

        return res.json({
          loggedIn: true,
          member: {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            avatar_url: user.avatar_url || null,
             role: row.role 
          },
        });
      }
    );
  } catch (err) {
    console.error("GET /api/members/me error:", err);
    return res.json({ loggedIn: false });
  }
});


// ================================
// PUT /api/members/profile
// Update basic profile (name)
// ================================
router.put("/profile", requireMember, express.json(), (req, res) => {
  const memberId = req.memberId;
  const { first_name, last_name } = req.body || {};

  db.run(
    `UPDATE members SET first_name = ?, last_name = ? WHERE id = ?`,
    [first_name || "", last_name || "", memberId],
    (err) => {
      if (err) {
        console.error("Profile update error:", err);
        return res
          .status(500)
          .json({ error: "Failed to update profile." });
      }
      res.json({ success: true });
    }
  );
});

// ================================
// PUT /api/members/password
// Change password
// ================================
router.put("/password", requireMember, express.json(), (req, res) => {
  const memberId = req.memberId;
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ error: "Both current and new passwords are required." });
  }

  db.get(
    `SELECT password_hash FROM members WHERE id = ?`,
    [memberId],
    async (err, row) => {
      if (err || !row) {
        return res.status(400).json({ error: "User not found." });
      }

      try {
        const matches = await bcrypt.compare(
          currentPassword,
          row.password_hash
        );
        if (!matches) {
          return res
            .status(400)
            .json({ error: "Current password is incorrect." });
        }

        const newHash = await bcrypt.hash(newPassword, 10);

        db.run(
          `UPDATE members SET password_hash = ? WHERE id = ?`,
          [newHash, memberId],
          (err2) => {
            if (err2) {
              console.error("Password update error:", err2);
              return res
                .status(500)
                .json({ error: "Failed to update password." });
            }
            res.json({ success: true });
          }
        );
      } catch (err2) {
        console.error("Password compare/hash error:", err2);
        return res
          .status(500)
          .json({ error: "Something went wrong." });
      }
    }
  );
});

// ================================
// POST /api/members/reset-password
// Complete password reset using token
// ================================
router.post("/reset-password", (req, res) => {
  const { token, password } = req.body || {};

  if (!token || !password) {
    return res
      .status(400)
      .json({ error: "Reset token and new password are required." });
  }

  const now = Date.now();

  // Find valid, unused token
  db.get(
    `
    SELECT r.id AS reset_id, m.id AS member_id
    FROM member_password_resets r
    JOIN members m ON m.id = r.member_id
    WHERE r.token = ?
      AND r.used = 0
      AND r.expires_at > ?
  `,
    [token, now],
    (err, row) => {
      if (err) {
        console.error("Reset password lookup error:", err);
        return res.status(500).json({ error: "Server error." });
      }

      if (!row) {
        return res
          .status(400)
          .json({ error: "This reset link is invalid or has expired." });
      }

      // Hash new password and save
      bcrypt.hash(password, 10, (hashErr, hash) => {
        if (hashErr) {
          console.error("Password hash error:", hashErr);
          return res.status(500).json({ error: "Server error." });
        }

        db.run(
          `UPDATE members SET password_hash = ? WHERE id = ?`,
          [hash, row.member_id],
          (updErr) => {
            if (updErr) {
              console.error("Update member password error:", updErr);
              return res.status(500).json({ error: "Server error." });
            }

            // Mark token as used
            db.run(
              `UPDATE member_password_resets SET used = 1 WHERE id = ?`,
              [row.reset_id],
              (markErr) => {
                if (markErr) {
                  console.error("Mark reset token used error:", markErr);
                }
                return res.json({
                  message: "Your password has been reset. You can now log in.",
                });
              }
            );
          }
        );
      });
    }
  );
});


// ================================
// GET /api/members/:id/badges
// Fetch public badges for a member
// ================================
router.get("/:id/badges", requireMember, (req, res) => {
  const memberId = Number(req.params.id);
  if (!memberId) {
    return res.status(400).json({ error: "Invalid member id" });
  }

  db.all(
    `
    SELECT
      b.id,
      b.name,
      b.badge_key,
      b.icon_url,
      b.category,
      mb.granted_at
    FROM member_badges mb
    JOIN badges b ON b.id = mb.badge_id
    WHERE mb.member_id = ?
      AND b.is_active = 1
      AND (b.expires_at IS NULL OR b.expires_at > ?)
    ORDER BY mb.granted_at ASC
    `,
    [memberId, Date.now()],
    (err, rows) => {
      if (err) {
        console.error("Fetch member badges failed:", err);
        return res.status(500).json({ error: "Failed to load badges" });
      }

      res.json({ badges: rows || [] });
    }
  );
});


export default router;

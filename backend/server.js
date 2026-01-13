// ============================================
//  HOLY CIRCLE — CLEAN SERVER HEADER (FIXED)
// ============================================
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:4000";
const JWT_SECRET = process.env.JWT_SECRET;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;


console.log("Loaded SMTP settings:", process.env.SMTP_HOST);

import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import crypto from "crypto";
import db from "./db.js";
import multer from "multer";
import fs from "fs";
import { v4 as uuid } from "uuid";
import Stripe from "stripe";
import { uploadVideoToYouTube } from "./youtube.js";
import {
  uploadAudioToPodbean,
  publishPodbeanEpisode,
} from "./podbean.js";

import youtubeLatest from "./youtube-latest.js";
import cloudinary from "./cloudinary.js";

import stripeWebhook from "./stripe-webhook.js";
import donationRoutes from "./stripe-donations.js";
import stripeAnalytics from "./stripe-analytics.js";
import donorRoutes from "./donor-routes.js";
import peopleDonationRoutes from "./people-donations.js";
import donorStatementRoutes from "./donor-statements.js";
import recurringGiftRoutes from "./recurring-gifts.js";
import followupRoutes from "./followup-routes.js";


import donationReceiptRoutes from "./donation-receipts.js";


import memberAuthRoutes from "./routes/member-auth.js";

import requireMember from "./middleware/requireMember.js";
import requireAdmin from "./middleware/requireAdmin.js";
import forumNotifyRoutes from "./routes/forum-notify.js";

import receiptsRoutes from "./receipts.js";
import donationSessionDetails from "./routes/donation-session-details.js";


import memberDashboardRoutes from "./routes/member-dashboard.js";
import memberGivingHistory from "./routes/member-giving-history.js";
import memberEventsRoutes from "./routes/member-events.js";
import http from "http";
import startRealtimeServer from "./realtime/realtime-server.js";

import adminEmailRoutes from "./routes/admin-email.js";
import { sendGenericEmail } from "./email.js";
import publicEmailSignupRoutes from "./routes/email-signups.js";
import { trafficTracker } from "./middleware/trafficTracker.js";
import peopleAnalytics from "./routes/admin-analytics/people.js";
import podcastAnalytics from "./routes/admin-analytics/podcast.js";
import trafficAnalytics from "./routes/admin-analytics/traffic.js";
import trafficPublic from "./routes/traffic-public.js";
import forumRoutes from "./routes/forum.js";
import adminAuthRoutes from "./routes/admin-auth.js";

import adminNotificationsRouter from "./routes/admin-notifications.js";
import adminRsvpsRouter from "./routes/admin-rsvp.js";
import adminProfilesRoutes from "./routes/admin-profiles.js";

import publicRsvpsRouter from "./routes/public-rsvp.js";
import memberRsvpsRouter from "./routes/member-rsvp.js";

import rsvpAnalyticsRouter from "./routes/admin-analytics/rsvp-analytics.js";
import rsvpAdvancedAnalytics from "./routes/admin-analytics/rsvp-advanced-analytics.js";


import adminEventsRouter from "./routes/admin-events.js";
import eventsPublicRoutes from "./routes/events.js";
import adminEventsCrud from "./routes/admin-events-crud.js";

import adminBadgeAnalytics from "./routes/admin-badge-analytics.js";
import badgeRoutes from "./routes/badges.js";

import { removeExpiredBadges } from "./utils/removeExpiredBadges.js";
import { createNotification } from "./utils/notifications.js";

import notificationsRoutes from "./routes/notifications.js";

import publicProfileRoutes from "./routes/public-profile.js";

import testProfileRoutes from "./routes/test-profile.js";
import testProfileEditRoutes from "./routes/test-profile-edit.js";
import memberAvatarRoutes from "./routes/member-avatar.js";

import emailRoutes from "./routes/email.js";



// Run at server startup
removeExpiredBadges();

// Auto-run once per day
setInterval(() => {
  console.log("⏱ Running daily badge expiration cleanup…");
  removeExpiredBadges();
}, 24 * 60 * 60 * 1000); // every 24 hours



// ------------------------
// ENV + APP INITIALIZE
// ------------------------
const app = express();

// =======================
//  STRIPE WEBHOOK (RAW BODY)
// =======================
// Stripe webhook MUST NOT go through express.json() or signature breaks.
// We mount it FIRST with express.raw, and skip JSON on this route.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);


// CORE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true,
}));
app.use(trafficTracker);
app.use("/api", trafficPublic);

// STATIC
app.use(express.static(path.join(__dirname, "..")));
app.use("/css", express.static(path.join(__dirname, "../css")));
app.use("/js", express.static(path.join(__dirname, "../js")));
app.use("/images", express.static(path.join(__dirname, "../images")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/admin", express.static(path.join(process.cwd(), "admin")));


 



// 🚀 start the websocket analytics server
const server = http.createServer(app);

startRealtimeServer(server);


// Stripe instance
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});




// =======================================
// MEMBER NOTIFICATION SETTINGS
// =======================================

// GET current notification settings
app.get("/api/notification-settings", requireMember, (req, res) => {
  const memberId = req.memberId;

  db.get(
    `SELECT * FROM notification_settings WHERE member_id = ?`,
    [memberId],
    (err, row) => {
      if (err) {
        console.error("Failed to load notification settings", err);
        return res.status(500).json({ error: "DB error" });
      }

      // If no row exists yet, create defaults
      if (!row) {
        const now = Date.now();

        db.run(
          `
          INSERT INTO notification_settings (
            member_id,
            forum_replies,
            prayer_responses,
            event_rsvp,
            event_updates,
            podcast_new,
            podcast_announcements,
            updated_at
          ) VALUES (?, 1, 1, 1, 1, 0, 0, ?)
        `,
          [memberId, now],
          () => {
            return res.json({
              forum_replies: 1,
              prayer_responses: 1,
              event_rsvp: 1,
              event_updates: 1,
              podcast_new: 0,
              podcast_announcements: 0,
            });
          }
        );
      } else {
        res.json(row);
      }
    }
  );
});

// PUT update notification settings
app.put("/api/notification-settings", requireMember, (req, res) => {
  const memberId = req.memberId;
  const body = req.body || {};

  // Normalize booleans to integers (1/0)
  const opts = {
    forum_replies: body.forum_replies ? 1 : 0,
    prayer_responses: body.prayer_responses ? 1 : 0,
    event_rsvp: body.event_rsvp ? 1 : 0,
    event_updates: body.event_updates ? 1 : 0,
    podcast_new: body.podcast_new ? 1 : 0,
    podcast_announcements: body.podcast_announcements ? 1 : 0,
    updated_at: Date.now(),
  };

  db.get(
    `SELECT member_id FROM notification_settings WHERE member_id = ?`,
    [memberId],
    (err, row) => {
      if (err) return res.status(500).json({ success: false });

      if (row) {
        db.run(
          `
          UPDATE notification_settings SET
            forum_replies = ?,
            prayer_responses = ?,
            event_rsvp = ?,
            event_updates = ?,
            podcast_new = ?,
            podcast_announcements = ?,
            updated_at = ?
          WHERE member_id = ?
          `,
          [
            opts.forum_replies,
            opts.prayer_responses,
            opts.event_rsvp,
            opts.event_updates,
            opts.podcast_new,
            opts.podcast_announcements,
            opts.updated_at,
            memberId,
          ],
          (err2) => {
            if (err2) return res.status(500).json({ success: false });
            res.json({ success: true });
          }
        );
      } else {
        db.run(
          `
          INSERT INTO notification_settings (
            member_id,
            forum_replies,
            prayer_responses,
            event_rsvp,
            event_updates,
            podcast_new,
            podcast_announcements,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            memberId,
            opts.forum_replies,
            opts.prayer_responses,
            opts.event_rsvp,
            opts.event_updates,
            opts.podcast_new,
            opts.podcast_announcements,
            opts.updated_at,
          ],
          (err3) => {
            if (err3) return res.status(500).json({ success: false });
            res.json({ success: true });
          }
        );
      }
    }
  );
});


// Search usernames for @mention autocomplete
app.get("/api/members/search", requireMember, (req, res) => {
  const q = (req.query.q || "").toLowerCase();

  if (q.length < 1) return res.json([]);

  db.all(
    `
    SELECT username
    FROM members
    WHERE LOWER(username) LIKE ?
    LIMIT 8
    `,
    [`${q}%`],
    (err, rows) => {
      if (err) return res.status(500).json([]);
      res.json(rows.map(r => r.username));
    }
  );
});

// --------------------------------------------
// GET /api/members/me/giving-summary
// Returns summarized giving data for the current member
// --------------------------------------------
app.get("/api/members/me/giving-summary", requireMember, async (req, res) => {
  const memberId = req.memberId;

  try {
    const totals = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT
          COUNT(*) AS donation_count,
          COALESCE(SUM(amount_cents), 0) AS total_cents
        FROM donations
        WHERE member_id = ?
          AND status IN ('paid', 'succeeded')
        `,
        [memberId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row || { donation_count: 0, total_cents: 0 });
        }
      );
    });

    const last = await new Promise((resolve, reject) => {
      db.get(
        `SELECT created_at FROM donations WHERE member_id = ? AND status IN ('paid','succeeded') ORDER BY created_at DESC LIMIT 1`,
        [memberId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        }
      );
    });

    const recurring = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COALESCE(SUM(amount_cents),0) AS recurring_cents FROM donations WHERE member_id = ? AND frequency = 'monthly' AND status IN ('paid','succeeded')`,
        [memberId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row || { recurring_cents: 0 });
        }
      );
    });

    const donationCount = totals?.donation_count || 0;
    const totalCents = totals?.total_cents || 0;

    res.json({
      success: true,
      summary: {
        donationCount,
        totalCents,
        totalDollars: Number((totalCents / 100).toFixed(2)),
        lastDonationAt: last?.created_at || null,
        recurringMonthlyCents: recurring?.recurring_cents || 0,
        recurringMonthlyDollars: Number(((recurring?.recurring_cents || 0) / 100).toFixed(2)),
      },
    });
  } catch (err) {
    console.error("Failed to load member giving summary", err);
    res.status(500).json({ success: false, error: "DB error" });
  }
});



// ------------------------
// Upload Banners
// ------------------------
const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/banners/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `banner_${req.memberId}${ext}`);
  }
});

const uploadBanner = multer({ storage: bannerStorage });

app.use("/uploads/banners", express.static("uploads/banners"));

// ===== Request Logger =====
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const ms = Date.now() - start;

    const member =
      req.member?.id ||
      req.memberId ||
      "guest";

    console.log(
      `[${new Date().toISOString()}]`,
      req.method,
      req.originalUrl,
      `→ ${res.statusCode}`,
      `${ms}ms`,
      `member=${member}`
    );
  });

  next();
});

app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    console.log(
      `[${new Date().toISOString()}]`,
      req.method,
      req.originalUrl,
      res.statusCode,
      `${Date.now() - start}ms`,
      Object.keys(req.query || {}).length ? `query=${JSON.stringify(req.query)}` : "",
      req.body && Object.keys(req.body).length ? `body=${JSON.stringify(req.body)}` : ""
    );
  });

  next();
});


// ------------------------
// STATIC FILE SERVING
// ------------------------

// Serve the admin folder (your HTML, CSS, JS)
app.use("/api/members/auth", memberAuthRoutes);


app.use("/api/forum", forumRoutes);
app.use("/api", forumNotifyRoutes);




app.use("/api/members", testProfileRoutes);
app.use("/api/members", testProfileEditRoutes);

app.use("/api/members", memberDashboardRoutes);
app.use("/api/members", memberGivingHistory);
app.use("/api", donationSessionDetails);
app.use("/uploads", express.static("uploads"));
// Member profile routes: mount under the canonical `/api/members` base


// Profile edit routes (update, extended profile fields) — keep under /api/members

app.use("/api/admin", adminEmailRoutes);
app.use("/api", publicEmailSignupRoutes);
app.use("/api/admin/people-analytics", peopleAnalytics);
app.use("/api/admin/podcast-analytics", podcastAnalytics);
app.use("/api/admin/traffic", trafficAnalytics);
app.use("/api/admin/notifications", adminNotificationsRouter);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/admin/rsvps", adminRsvpsRouter);
app.use("/api", publicRsvpsRouter);
app.use("/api/members", memberRsvpsRouter);
app.use("/api/admin/rsvp-analytics", rsvpAnalyticsRouter);
app.use("/api/admin/rsvp-advanced-analytics", rsvpAdvancedAnalytics);
app.use("/api/admin/events", adminEventsRouter);
app.use("/api/events", adminEventsCrud);
app.use("/api/events", eventsPublicRoutes);

app.use("/api/email", emailRoutes);

app.use("/api/admin", adminBadgeAnalytics);
app.use("/api/badges", badgeRoutes);
app.use("/api", publicProfileRoutes);
app.use("/api/members", memberAvatarRoutes);
app.use("/api/admin", adminAuthRoutes);


// =======================================
//  CLEAN ROUTING / FALLBACKS / PROTECTION
// =======================================

// 1. Redirect root → admin dashboard
app.get("/", (req, res) => {
  res.redirect("/admin/admin-dashboard.html");
});

// 2. Fix common mistakes (people go to /admin instead of /admin/page)
app.get("/admin", (req, res) => {
  res.redirect("/admin/admin-dashboard.html");
});

app.get("/admin/*", (req, res, next) => {
  if (!req.cookies.hc_session || req.cookies.role !== "admin") {
    return res.redirect("/login.html");
  }
  next();
});


// ============================================
//  END OF FIXED HEADER — DO NOT DUPLICATE BELOW
// ============================================




// ================================
// AUTH MIDDLEWARE
// ================================
function requireAuth(req, res, next) {
  const token = req.cookies.hc_admin_token;
  if (!token) return res.status(401).json({ error: "Not logged in" });

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    req.admin = decoded; // { id, name, role, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.admin) return res.status(401).json({ error: "Not logged in" });

    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

// ================================
// ADMIN LOGIN
// ================================
app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Missing fields" });

  const sql = `SELECT * FROM users WHERE email = ? LIMIT 1`;

  db.get(sql, [email], async (err, user) => {
    if (err) return res.status(500).json({ error: "DB error" });
    if (!user) return res.status(401).json({ error: "Invalid login" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid login" });

    // JWT payload
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
      },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: "12h" }
    );

    // Send secure cookie
    res.cookie("hc_admin_token", token, {
      httpOnly: true,
      secure: false, // true in production with HTTPS
      sameSite: "lax",
      maxAge: 12 * 60 * 60 * 1000,
      path: "/",
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
      },
    });
  });
});
app.post("/api/admin/logout", (req, res) => {
  res.clearCookie("hc_admin_token");
  res.json({ success: true });
});

app.get("/api/admin/me", requireAuth, (req, res) => {
  res.json({
    id: req.admin.id,
    name: req.admin.name,
    role: req.admin.role,
    email: req.admin.email,
  });
});

app.get(
  "/api/admin/users",
  requireAuth,
  requireRole("owner", "admin"),
  (req, res) => {
    db.all(
      `SELECT id, name, email, role, twofa_enabled, created_at
       FROM users ORDER BY created_at DESC`,
      [],
      (err, rows) => {
        if (err) return res.status(500).json({ error: "DB error" });

        res.json({ users: rows });
      }
    );
  }
);

app.get(
  "/api/admin/users/:id",
  requireAuth,
  requireRole("owner", "admin"),
  (req, res) => {
    db.get(
      `SELECT id, name, email, role, twofa_enabled, created_at
       FROM users WHERE id = ?`,
      [req.params.id],
      (err, user) => {
        if (err) return res.status(500).json({ error: "DB error" });
        if (!user) return res.status(404).json({ error: "User not found" });

        res.json({ user });
      }
    );
  }
);

app.post(
  "/api/admin/users",
  requireAuth,
  requireRole("owner", "admin"),
  async (req, res) => {
    const { name, email, role, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: "Missing fields" });

    const hash = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO users (name, email, role, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.run(sql, [name, email, role, hash, Date.now()], function (err) {
      if (err) return res.status(500).json({ error: "DB error" });

      res.json({
        success: true,
        id: this.lastID,
      });
    });
  }
);
app.put(
  "/api/admin/users/:id",
  requireAuth,
  requireRole("owner", "admin"),
  async (req, res) => {
    const { name, email, role, password } = req.body;

    let params = [name, email, role, req.params.id];
    let sql = `
      UPDATE users
      SET name = ?, email = ?, role = ?
      WHERE id = ?
    `;

    // If password included, update separately
    if (password && password.length > 0) {
      const hash = await bcrypt.hash(password, 10);

      sql = `
        UPDATE users
        SET name = ?, email = ?, role = ?, password_hash = ?
        WHERE id = ?
      `;

      params = [name, email, role, hash, req.params.id];
    }

    db.run(sql, params, function (err) {
      if (err) return res.status(500).json({ error: "DB error" });

      res.json({ success: true });
    });
  }
);
app.delete(
  "/api/admin/users/:id",
  requireAuth,
  requireRole("owner", "admin"),
  (req, res) => {
    if (req.params.id == req.admin.id) {
      return res
        .status(400)
        .json({ error: "You cannot delete your own account." });
    }

    db.run(`DELETE FROM users WHERE id = ?`, [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: "DB error" });

      res.json({ success: true });
    });
  }
);



// =======================
//  End Admin Login Code
// =======================






// File uploads (temp dir)
const upload = multer({ dest: "uploads/" });

// Accept TWO file fields: video AND audio
const episodeUpload = upload.fields([
  { name: "video", maxCount: 1 },
  { name: "audio", maxCount: 1 },
]);

// Protect Member pages
app.get([
  "/member-dashboard.html",
  "/test-profile.html",
  "/member-account.html",
  "/member-events.html",
  "/member-giving-history.html"
], requireMember, (req, res) => {
  res.sendFile(path.join(__dirname, "..", req.path));
});


// Block logged-in users from Join + Login
app.get([
  "/join.html",
  "/login.html"
], (req, res, next) => {
  if (req.cookies.hc_member_token) {
    return res.redirect("/member-dashboard.html");
  }
  next();
});

// =======================
//  HELPERS
// =======================

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "2h" }
  );
}

function authRequired(req, res, next) {
  const token = req.cookies["hc_admin_token"];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function getUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function updateFailedAttempt(user, success) {
  return new Promise((resolve, reject) => {
    if (success) {
      db.run(
        "UPDATE users SET failed_attempts = 0, lock_until = NULL WHERE id = ?",
        [user.id],
        (err) => (err ? reject(err) : resolve())
      );
    } else {
      const now = Date.now();
      let failed = (user.failed_attempts || 0) + 1;
      let lockUntil = user.lock_until;

      // Lock after 5 failed attempts for 15 minutes
      if (failed >= 5) {
        lockUntil = now + 15 * 60 * 1000;
      }

      db.run(
        "UPDATE users SET failed_attempts = ?, lock_until = ? WHERE id = ?",
        [failed, lockUntil, user.id],
        (err) => (err ? reject(err) : resolve())
      );
    }
  });
}

  
  
  

db.all(
  `
  SELECT member_id
  FROM notification_settings
  WHERE podcast_new = 1
`,
  [],
  (err, rows) => {
    if (err) return;

    rows.forEach((r) => {
      createMemberNotification({
        memberId: r.member_id,
        category: "podcast",
        type: "podcast_new",
        message: `New Holy Circle podcast episode is live`,
        link: `/podcast.html`,
        io: app.get("io"),
      });
    });
  }
);




// =======================
//  PODCAST / YOUTUBE / PODBEAN
// =======================

// Get all episodes
app.get("/api/podcast/episodes", authRequired, (req, res) => {
  db.all("SELECT * FROM episodes ORDER BY createdAt DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(rows);
  });
});

// Create new episode
app.post(
  "/api/podcast/episodes",
  authRequired,
  episodeUpload,
  async (req, res) => {
    try {
      const {
        title,
        description = "",
        status = "draft",
        publishedAt,
        duration,
        youtubePublishAt,
      } = req.body;

      if (!title) return res.status(400).json({ error: "Title required" });

      const files = req.files || {};
      const videoFile = files.video?.[0] || null;
      const audioFile = files.audio?.[0] || null;

      let youtubeData = null;
      let podbeanData = null;

      // Upload to YouTube
      if (videoFile) {
        youtubeData = await uploadVideoToYouTube({
          filePath: videoFile.path,
          title,
          description,
          scheduledAt: youtubePublishAt || null,
        });
        fs.unlink(videoFile.path, () => {});
      }

      // Upload to Podbean
      if (audioFile) {
        const fileKey = await uploadAudioToPodbean(audioFile.path, title);
        podbeanData = await publishPodbeanEpisode({
          title,
          description,
          file_key: fileKey,
          publishTime: publishedAt || null,
        });
        fs.unlink(audioFile.path, () => {});
      }

      const episodeId = uuid();
      const now = Date.now();

      db.run(
        `
        INSERT INTO episodes (
          id, title, description, status, duration, publishedAt,
          youtubeUrl, youtubeStatus, youtubePublishAt, youtubeId,
          podbeanUrl, podbeanId, createdAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          episodeId,
          title,
          description,
          status,
          duration || null,
          publishedAt || null,
          youtubeData?.url || null,
          youtubeData?.status || null,
          youtubePublishAt || null,
          youtubeData?.videoId || null,
          podbeanData?.media_url || null,
          podbeanData?.episode_id || null,
          now,
        ],
        (err) => {
          if (err) return res.status(500).json({ error: "DB save error" });

          db.get(
            "SELECT * FROM episodes WHERE id = ?",
            [episodeId],
            (err2, row) => {
              if (err2) {
                return res.status(500).json({ error: "DB read error" });
              }
              res.status(201).json(row);
            }
          );
        }
      );
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to upload episode" });
    }
  }
);

// Update metadata
app.put(
  "/api/podcast/episodes/:id",
  authRequired,
  upload.none(),
  (req, res) => {
    const { id } = req.params;
    const { title, description, status, publishedAt, duration } = req.body;

    db.run(
      `
      UPDATE episodes SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        publishedAt = COALESCE(?, publishedAt),
        duration = COALESCE(?, duration)
      WHERE id = ?
    `,
      [title, description, status, publishedAt, duration, id],
      (err) => {
        if (err) return res.status(500).json({ error: "DB error" });

        db.get("SELECT * FROM episodes WHERE id = ?", [id], (err2, row) => {
          if (err2 || !row)
            return res.status(404).json({ error: "Episode not found" });

          res.json(row);
        });
      }
    );
  }
);

// Delete episode
app.delete("/api/podcast/episodes/:id", authRequired, (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM episodes WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json({ deleted: true });
  });
});



// ================================
// EMAIL CAMPAIGNS (ADMIN ONLY)
// ================================

// Create a new campaign (draft)
app.post(
  "/api/admin/email-campaigns",
  requireAuth,
  requireRole("owner", "admin"),
  (req, res) => {
    const {
      name,
      subject,
      from_email = "",
      body_html = "",
      body_text = "",
      segment = "all",
      scheduled_at = null,
    } = req.body || {};

    if (!name || !subject || (!body_html && !body_text)) {
      return res
        .status(400)
        .json({ error: "Name, subject, and body are required." });
    }

    const now = Date.now();

    db.run(
      `
      INSERT INTO email_campaigns
        (name, subject, from_email, body_html, body_text, status, segment, created_at, scheduled_at)
      VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?)
    `,
      [name, subject, from_email, body_html, body_text, segment, now, scheduled_at],
      function (err) {
        if (err) {
          console.error("Create campaign error:", err);
          return res.status(500).json({ error: "DB error" });
        }

        res.json({
          success: true,
          campaign_id: this.lastID,
        });
      }
    );
  }
);

// List campaigns
app.get(
  "/api/admin/email-campaigns",
  requireAuth,
  requireRole("owner", "admin"),
  (req, res) => {
    db.all(
      `
      SELECT id, name, subject, status, total_recipients, sent_count, error_count, created_at, sent_at
      FROM email_campaigns
      ORDER BY created_at DESC
      LIMIT 50
    `,
      [],
      (err, rows) => {
        if (err) {
          console.error("List campaigns error:", err);
          return res.status(500).json({ error: "DB error" });
        }
        res.json({ campaigns: rows || [] });
      }
    );
  }
);

// Get single campaign (for viewing details later if needed)
app.get(
  "/api/admin/email-campaigns/:id",
  requireAuth,
  requireRole("owner", "admin"),
  (req, res) => {
    db.get(
      `
      SELECT *
      FROM email_campaigns
      WHERE id = ?
    `,
      [req.params.id],
      (err, row) => {
        if (err) {
          console.error("Get campaign error:", err);
          return res.status(500).json({ error: "DB error" });
        }
        if (!row) return res.status(404).json({ error: "Campaign not found" });
        res.json({ campaign: row });
      }
    );
  }
);

// Send a campaign to all email_signups
// ====================================================
// SEGMENT LOADER (Donors, Members, Email Signups, All)
// ====================================================
function loadRecipients(segment, callback) {
  if (segment === "donors") {
    return db.all(
      `SELECT email, name FROM donors WHERE email IS NOT NULL`,
      [],
      callback
    );
  }

  if (segment === "members") {
    return db.all(
      `SELECT email, (first_name || ' ' || last_name) AS name
       FROM members
       WHERE email IS NOT NULL`,
      [],
      callback
    );
  }

  if (segment === "email_signups") {
    return db.all(
      `SELECT email, name FROM email_signups`,
      [],
      callback
    );
  }

  // DEFAULT = all three sources merged, automatically deduped
  db.all(
    `
      SELECT email, name FROM email_signups
      UNION
      SELECT email, (first_name || ' ' || last_name) AS name FROM members
      UNION
      SELECT email, name FROM donors
    `,
    [],
    callback
  );
}


app.post(
  "/api/admin/email-campaigns/:id/send",
  requireAuth,
  requireRole("owner", "admin"),
  (req, res) => {
    const campaignId = req.params.id;

    db.get(
      `SELECT * FROM email_campaigns WHERE id = ?`,
      [campaignId],
      (err, campaign) => {
        if (err) {
          console.error("Load campaign error:", err);
          return res.status(500).json({ error: "DB error" });
        }
        if (!campaign) {
          return res.status(404).json({ error: "Campaign not found" });
        }
        if (campaign.status === "sent") {
          return res.status(400).json({ error: "Campaign already sent." });
        }

        // Load recipients from email_signups
        loadRecipients(campaign.segment, async (err2, rows) => {
          if (err2) {
            console.error("Load recipients error:", err2);
            return res.status(500).json({ error: "DB error" });
          }

          const recipients = rows || [];
          if (recipients.length === 0) {
            return res
              .status(400)
              .json({ error: "No email signups to send to." });
          }

          // Update status to 'sending'
          db.run(
            `UPDATE email_campaigns
             SET status = 'sending', total_recipients = ?
             WHERE id = ?`,
            [recipients.length, campaignId]
          );

          const subject = campaign.subject;
          const from_email = campaign.from_email;
          const html = campaign.body_html;
          const text = campaign.body_text;

          let sentCount = 0;
          let errorCount = 0;

          // NOTE: Simple sequential send to keep it robust for now
          for (const r of recipients) {
            const toEmail = r.email;
            if (!toEmail) continue;

            try {
              await sendGenericEmail({
                to: toEmail,
                subject,
                html,
                text,
              });
              sentCount += 1;
            } catch (sendErr) {
              console.error("Send campaign email error:", sendErr);
              errorCount += 1;
            }
          }

          const sentAt = Date.now();
          const finalStatus = errorCount === 0 ? "sent" : "failed";

          db.run(
            `
            UPDATE email_campaigns
            SET status = ?, sent_count = ?, error_count = ?, sent_at = ?
            WHERE id = ?
          `,
            [finalStatus, sentCount, errorCount, sentAt, campaignId],
            (err3) => {
              if (err3) {
                console.error("Update campaign after send error:", err3);
              }
              return res.json({
                success: true,
                status: finalStatus,
                total_recipients: recipients.length,
                sent_count: sentCount,
                error_count: errorCount,
              });
            }
          );
        });
      }
    );
  }
);

// =======================
//  SETTINGS ROUTES
// =======================

app.get("/api/settings", authRequired, (req, res) => {
  db.get("SELECT * FROM settings WHERE id = 1", (err, row) => {
    if (!row) {
      return res.json({
        ministryName: "",
        websiteURL: "",
        supportEmail: "",
        timezone: "UTC",
      });
    }
    res.json(row);
  });
});

app.post("/api/settings/general", authRequired, (req, res) => {
  const { ministryName, websiteURL, supportEmail, timezone } = req.body;

  db.run(
    `
    INSERT INTO settings (id, ministryName, websiteURL, supportEmail, timezone)
    VALUES (1, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      ministryName = excluded.ministryName,
      websiteURL = excluded.websiteURL,
      supportEmail = excluded.supportEmail,
      timezone = excluded.timezone
  `,
    [ministryName, websiteURL, supportEmail, timezone],
    (err) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ saved: true });
    }
  );
});

setInterval(() => {
  const now = Date.now();

  db.all(
    `
      SELECT q.id, q.email, q.campaign_id, c.subject, c.body_html, c.body_text
      FROM email_automation_queue q
      JOIN email_campaigns c ON c.id = q.campaign_id
      WHERE q.sent = 0 AND q.send_at <= ?
      ORDER BY q.send_at ASC
      LIMIT 20
    `,
    [now],
    async (err, jobs) => {
      if (err) return console.error("Automation error:", err);
      if (!jobs || jobs.length === 0) return;

      for (const job of jobs) {
        try {
          await sendGenericEmail({
            to: job.email,
            subject: job.subject,
            html: job.body_html,
            text: job.body_text,
          });

          db.run(
            `UPDATE email_automation_queue SET sent = 1, sent_at = ? WHERE id = ?`,
            [Date.now(), job.id]
          );
        } catch (e) {
          db.run(
            `UPDATE email_automation_queue SET error = ? WHERE id = ?`,
            [e.message, job.id]
          );
        }
      }
    }
  );
}, 60 * 1000); // every minute


// List templates
app.get("/api/admin/email-templates", requireAuth, requireRole("owner","admin"), (req,res)=>{
  db.all(`SELECT id,name,thumbnail FROM email_templates ORDER BY created_at DESC`,[],(err,rows)=>{
    if(err) return res.status(500).json({error:"DB error"});
    res.json({templates:rows});
  });
});

// Get a single template
app.get("/api/admin/email-templates/:id", requireAuth, requireRole("owner","admin"), (req,res)=>{
  db.get(`SELECT * FROM email_templates WHERE id=?`,[req.params.id],(err,row)=>{
    if(err) return res.status(500).json({error:"DB error"});
    res.json({template:row});
  });
});

// Create template
app.post("/api/admin/email-templates", requireAuth, requireRole("owner","admin"), (req,res)=>{
  const {name,html,thumbnail=null} = req.body;
  if(!name || !html) return res.status(400).json({error:"Name and HTML required"});

  db.run(`
    INSERT INTO email_templates (name,html,thumbnail,created_at)
    VALUES (?, ?, ?, ?)
  `,[name,html,thumbnail,Date.now()],function(err){
    if(err) return res.status(500).json({error:"DB error"});
    res.json({success:true,id:this.lastID});
  });
});

app.post("/api/settings/password", authRequired, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  db.get(
    "SELECT * FROM users WHERE id = ?",
    [req.user.id],
    async (err, row) => {
      if (!row) return res.status(404).json({ error: "User not found" });

      const valid = await bcrypt.compare(currentPassword, row.password_hash);
      if (!valid)
        return res.status(400).json({ error: "Incorrect password" });

      const newHash = await bcrypt.hash(newPassword, 10);

      db.run("UPDATE users SET password_hash = ? WHERE id = ?", [
        newHash,
        req.user.id,
      ]);

      res.json({ updated: true });
    }
  );
});

app.post("/api/settings/clear-trusted", authRequired, (req, res) => {
  res.clearCookie("hc_admin_trusted");
  res.json({ cleared: true });
});

app.post("/api/settings/reset-2fa", authRequired, (req, res) => {
  db.run(
    "UPDATE users SET twofa_secret=NULL, twofa_enabled=0 WHERE id = ?",
    [req.user.id]
  );
  res.json({ reset: true });
});

app.post("/api/settings/logout-all", authRequired, (req, res) => {
  res.clearCookie("hc_admin_trusted");
  res.clearCookie("hc_admin_token");
  res.json({ reset: true });
});

// =======================
// YOUTUBE ROUTES
// =======================


app.use("/api", youtubeLatest);

// =======================
//  STRIPE / DONOR / PEOPLE ROUTES
// =======================

// Donation session creation (Pushpay-style checkout)
app.use("/api/stripe", donationRoutes);

// Stripe Checkout Status (for /complete.js)
app.get("/session-status", async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId) {
      return res.status(400).json({ error: "Missing session_id" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.charges", "customer_details"],
    });

    const pi = typeof session.payment_intent === "object"
      ? session.payment_intent
      : null;

    const charges =
      pi?.charges ||
      session.charges || // fallback if Stripe changes payload
      { data: [] };

    return res.json({
      id: session.id,
      status: session.status,
      payment_status: session.payment_status,
      payment_intent_id:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : pi?.id || null,
      payment_intent_status: pi?.status || null,
      charges,
      customer_details: session.customer_details || null,
    });
  } catch (err) {
    console.error("SESSION-STATUS ERROR:", err);
    return res.status(500).json({ error: "Failed to load session" });
  }
});

// Stripe analytics (admin dashboard)
app.use("/api/stripe", stripeAnalytics);

// Donor API (donor list, summaries, etc.)
app.use("/api", donorRoutes);

// People ↔ Donation API (Donation History tab)
app.use("/api", peopleDonationRoutes);

// Donor Statements (PDF year-end giving)
app.use("/api", donorStatementRoutes);

// Recurring Gifts (Stripe subscriptions dashboard)
app.use("/api", recurringGiftRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({
    error: "API route not found",
    path: req.originalUrl,
  });
});

// 3. Catch missing admin pages and give a clean 404
app.get("/admin/*", (req, res, next) => {
  const filePath = path.join(__dirname, "../admin", req.path.replace("/admin/", ""));

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  console.warn("ADMIN PAGE NOT FOUND:", req.path);

  return res
    .status(404)
    .sendFile(path.join(__dirname, "../admin/404.html"), (err) => {
      if (err) res.status(404).send("Page Not Found");
    });
});



// Serve public member pages
app.get("/join.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../join.html"));
});

app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../login.html"));
});

app.get("/forgot-password.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../forgot-password.html"));
});

// ===== Global Error Handler =====
app.use((err, req, res, next) => {
  console.error("🔥 UNHANDLED ERROR", {
    method: req.method,
    url: req.originalUrl,
    query: req.query,
    body: req.body,
    stack: err.stack,
  });

  res.status(500).json({
    error: "Internal server error",
  });
});


// =======================
//  START SERVER
// =======================

server.listen(PORT, () => {
  console.log(`Holy Circle running at http://localhost:${PORT}`);
});


// middleware/trafficTracker.js
// =======================================================
// Holy Circle Traffic Tracking Middleware (Premium Version)
// =======================================================

import db from "../db.js";
import { v4 as uuidv4 } from "uuid";

// Utility: run DB queries safely without blocking
function runAsync(sql, params = []) {
  return new Promise((resolve) => {
    db.run(sql, params, function (err) {
      resolve({ err, lastID: this?.lastID });
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve) => {
    db.get(sql, params, (err, row) => resolve({ err, row }));
  });
}

export async function trafficTracker(req, res, next) {
  try {
    // IGNORE admin API traffic (optional)
    if (req.path.startsWith("/api/admin")) {
      return next();
    }

    const now = Date.now();

    // ======================================================
    // 1. SESSION HANDLING
    // ======================================================

    let sessionId = req.cookies.hc_session;

    // ---- Create new visitor session ----
    if (!sessionId) {
      sessionId = uuidv4();

      res.cookie("hc_session", sessionId, {
        httpOnly: false,
        maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
        sameSite: "Lax",
        secure: false, // you can set true in production
      });

      await runAsync(
        `INSERT INTO visitor_sessions (id, first_seen, last_seen, member_id)
         VALUES (?, ?, ?, NULL)`,
        [sessionId, now, now]
      );
    } else {
      // ---- Update returning visitor last_seen ----
      await runAsync(
        `UPDATE visitor_sessions SET last_seen = ? WHERE id = ?`,
        [now, sessionId]
      );
    }

    // ======================================================
    // 2. MEMBER SESSION (optional)
    // ======================================================
    const memberId = req.session?.member?.id || null;

    // ======================================================
    // 3. PAGE VIEW TRACKING
    // ======================================================

    // Don’t track static asset requests (CSS, JS, PNG, JPG, SVG…)
    const skipExtensions = [
      ".css", ".js", ".png", ".jpg", ".jpeg", ".svg",
      ".gif", ".webp", ".ico", ".woff", ".woff2", ".ttf"
    ];
    if (skipExtensions.some(ext => req.path.endsWith(ext))) {
      return next();
    }

    const ref = req.get("Referrer") || null;
    const ua = req.get("User-Agent") || null;

    await runAsync(
      `INSERT INTO page_views (session_id, member_id, path, referrer, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionId, memberId, req.path, ref, ua, now]
    );

    // Continue request
    next();

  } catch (err) {
    console.error("trafficTracker error:", err);
    next(); // Don't block requests
  }
}

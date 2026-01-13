// ============================================================================
// HOLY CIRCLE — CLEAN PRODUCTION DATABASE INITIALIZATION
// SQLite + Safe Schema Upgrades
// ============================================================================

import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

// Resolve DB location
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file
const dbPath = path.join(__dirname, "admin.db");
console.log("USING DATABASE FILE:", dbPath);

// Open DB
const db = new sqlite3.Database(dbPath, (err) => {
  console.log("🔥 SQLITE DB PATH:", dbPath);

  if (err) console.error("SQLite connection error:", err);
  else console.log("SQLite connected:", dbPath);
});

// ============================================================================
// SAFE COLUMN ADDITION HELPER
// ============================================================================

function addColumnIfNotExists(table, column, definition) {
  db.all(`PRAGMA table_info(${table})`, (err, info) => {
    if (err || !info) return;

    const exists = info.some((c) => c.name === column);
    if (!exists) {
      db.run(
        `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
        () => console.log(`Added column '${column}' to ${table}`)
      );
    }
  });
}

// ============================================================
// AUTOMATIC BADGE ACHIEVEMENTS ENGINE
// ============================================================

/**
 * Give badge to member (if not already earned)
 */
export function awardBadge(memberId, badgeKey) {
  return new Promise((resolve) => {
    // Check if badge exists
    db.get(
      `SELECT id FROM badges WHERE badge_key = ? AND is_active = 1`,
      [badgeKey],
      (err, badge) => {
        if (err || !badge) return resolve(false);

        const badgeId = badge.id;

        // Check if user already has it
        db.get(
          `SELECT 1 FROM member_badges WHERE member_id = ? AND badge_id = ?`,
          [memberId, badgeId],
          (err2, exists) => {
            if (exists) return resolve(false);

            // Insert new achievement
            db.run(
              `INSERT INTO member_badges (member_id, badge_id, granted_at)
               VALUES (?, ?, strftime('%s','now'))`,
              [memberId, badgeId],
              () => resolve(true)
            );
          }
        );
      }
    );
  });
}

// ============================================================
// BADGE TRIGGERS
// ============================================================

export async function checkRegistrationBadges(memberId) {
  await awardBadge(memberId, "joined_holy_circle");
}

export async function checkRsvpBadges(memberId) {
  db.get(
    `SELECT COUNT(*) AS total FROM event_rsvps WHERE member_id = ?`,
    [memberId],
    async (err, row) => {
      if (!row) return;

      if (row.total >= 1) await awardBadge(memberId, "first_event");
      if (row.total >= 5) await awardBadge(memberId, "event_participant");
    }
  );
}

export async function checkDonationBadges(memberId) {
  db.get(
    `SELECT COUNT(*) AS total FROM donations WHERE member_id = ?`,
    [memberId],
    async (err, row) => {
      if (!row) return;

      if (row.total >= 1) await awardBadge(memberId, "first_gift");
      if (row.total >= 10) await awardBadge(memberId, "faithful_giver");
    }
  );
}

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

db.serialize(() => {
  // ==========================================================================
  // USERS (Admin Accounts)
  // ==========================================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      role TEXT DEFAULT 'admin',
      twofa_secret TEXT,
      twofa_enabled INTEGER DEFAULT 0,
      failed_attempts INTEGER DEFAULT 0,
      lock_until INTEGER,
      created_at INTEGER
    );
  `);

  // Password reset tokens
  db.run(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      token TEXT,
      expires_at INTEGER,
      used INTEGER DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // ==========================================================================
  // MEMBER PASSWORD RESET TOKENS
  // ==========================================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS member_password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(member_id) REFERENCES members(id)
    );
  `);

  // ==========================================================================
  // PODCAST EPISODES
  // ==========================================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      status TEXT,
      duration TEXT,
      publishedAt TEXT,
      youtubeUrl TEXT,
      youtubeStatus TEXT,
      youtubePublishAt TEXT,
      youtubeId TEXT,
      podbeanUrl TEXT,
      podbeanId TEXT,
      createdAt INTEGER
    );
  `);

  // ==========================================================================
  // DONORS & DONATIONS
  // ==========================================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS donors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      phone TEXT,
      person_id INTEGER,
      created_at INTEGER
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_id INTEGER,
      stripe_session_id TEXT,
      stripe_payment_intent_id TEXT,
      amount_cents INTEGER,
      currency TEXT DEFAULT 'usd',
      status TEXT,
      frequency TEXT,
      fund TEXT,
      note TEXT,
      created_at INTEGER,
      FOREIGN KEY (donor_id) REFERENCES donors(id)
    );
  `);

  // ==========================================================================
  // SETTINGS
  // ==========================================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY,
      ministryName TEXT,
      websiteURL TEXT,
      supportEmail TEXT,
      timezone TEXT
    );
  `);

  // ==========================================================================
  // EVENTS & RSVPS
  // ==========================================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      date TEXT,
      time TEXT,
      location TEXT,
      type TEXT,
      status TEXT,
      description TEXT,
      created_at INTEGER
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rsvps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER,
      name TEXT,
      email TEXT,
      guests INTEGER,
      comments TEXT,
      created_at INTEGER,
      FOREIGN KEY(event_id) REFERENCES events(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS event_rsvps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      guests INTEGER DEFAULT 1,
      comments TEXT,
      created_at INTEGER,
      FOREIGN KEY (event_id) REFERENCES events(id),
      FOREIGN KEY (member_id) REFERENCES members(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS event_rsvp_guest (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      name TEXT,
      email TEXT,
      guests INTEGER DEFAULT 1,
      comments TEXT,
      created_at INTEGER,
      FOREIGN KEY(event_id) REFERENCES events(id)
    );
  `);

  // ==========================================================================
  // FOLLOWUPS (CRM)
  // ==========================================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'normal',
      assigned_to_user_id INTEGER,
      due_date TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (assigned_to_user_id) REFERENCES users(id)
    );
  `);

  db.run(`
  CREATE TABLE IF NOT EXISTS followup_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    followup_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    comment TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(followup_id) REFERENCES followups(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  `);

 db.run(`
  CREATE TABLE IF NOT EXISTS followup_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    followup_id INTEGER NOT NULL,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(followup_id) REFERENCES followups(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
   `);


 db.run(`
   CREATE TABLE IF NOT EXISTS followup_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    followup_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    file_url TEXT NOT NULL,
    original_name TEXT,
    uploaded_at INTEGER NOT NULL,
    FOREIGN KEY(followup_id) REFERENCES followups(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
   `);


 db.run(`
   CREATE TABLE IF NOT EXISTS followup_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
   `);
 db.run(`
CREATE TABLE IF NOT EXISTS followup_tag_map (
  followup_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY(followup_id, tag_id),
  FOREIGN KEY(followup_id) REFERENCES followups(id),
  FOREIGN KEY(tag_id) REFERENCES followup_tags(id)
);
`);
 db.run(`
  CREATE TABLE IF NOT EXISTS followup_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  default_category TEXT,
  default_priority TEXT,
  default_notes TEXT,
  created_at INTEGER NOT NULL
);

`);
 db.run(`
CREATE TABLE IF NOT EXISTS followup_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  followup_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  remind_at INTEGER NOT NULL,
  sent INTEGER DEFAULT 0,
  FOREIGN KEY(followup_id) REFERENCES followups(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

`);








  // ==========================================================================
  // MEMBERS (Public Accounts)
  // ==========================================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT,
      last_name TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      avatar TEXT,
      avatar_filename TEXT,
      avatar_updated_at INTEGER,
      role TEXT DEFAULT 'member',
      created_at INTEGER
    );
  `);

  

  // ==========================================================================
  // FORUM TABLES
  // ==========================================================================




  // Communities (DRAFT ONLY for now)
  db.run(`
    CREATE TABLE IF NOT EXISTS forum_communities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      is_private INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft', -- draft | approved | rejected
      created_by INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (created_by) REFERENCES members(id)
    );
  `);


  // ==========================================================
// Forum Community Memberships (REQUIRED)
// ==========================================================
db.run(`
  CREATE TABLE IF NOT EXISTS forum_community_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    community_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,

    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'active',

    joined_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    left_at INTEGER,

    UNIQUE (community_id, member_id),

    FOREIGN KEY (community_id) REFERENCES forum_communities(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
  );
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_ccm_community
  ON forum_community_members (community_id);
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_ccm_member
  ON forum_community_members (member_id);
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_ccm_status
  ON forum_community_members (community_id, status);
`);



  // Threads
  db.run(`
    CREATE TABLE IF NOT EXISTS forum_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      community_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER,
      FOREIGN KEY (community_id) REFERENCES forum_communities(id),
      FOREIGN KEY (member_id) REFERENCES members(id)
    );
  `);

  // Replies
  db.run(`
    CREATE TABLE IF NOT EXISTS forum_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER,
      FOREIGN KEY (thread_id) REFERENCES forum_threads(id),
      FOREIGN KEY (member_id) REFERENCES members(id)
    );
  `);
  // Reply Amens
  db.run(`
  CREATE TABLE IF NOT EXISTS forum_reply_amens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reply_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    created_at INTEGER,
    UNIQUE(reply_id, member_id),
    FOREIGN KEY(reply_id) REFERENCES forum_replies(id),
    FOREIGN KEY(member_id) REFERENCES members(id)
    );
  `);

  // "Amens" (likes)
  db.run(`
    CREATE TABLE IF NOT EXISTS forum_thread_amens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      created_at INTEGER,
      UNIQUE(thread_id, member_id),
      FOREIGN KEY (thread_id) REFERENCES forum_threads(id),
      FOREIGN KEY (member_id) REFERENCES members(id)
    );
  `);

  // Admin notifications
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      message TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      admin_id INTEGER
    );
  `);

  // Forum notifications
  db.run(`
    CREATE TABLE IF NOT EXISTS forum_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      thread_id INTEGER,
      community_id INTEGER,
      message TEXT,
      read INTEGER DEFAULT 0,
      created_at INTEGER,
      FOREIGN KEY (member_id) REFERENCES members(id)
    );
  `);

  // Notification settings
db.run(`
  CREATE TABLE IF NOT EXISTS notification_settings (
    member_id INTEGER PRIMARY KEY,

    forum_replies INTEGER DEFAULT 1,
    forum_mentions INTEGER DEFAULT 1,
    prayer_responses INTEGER DEFAULT 1,

    event_rsvp INTEGER DEFAULT 1,
    event_updates INTEGER DEFAULT 1,

    podcast_new INTEGER DEFAULT 0,
    podcast_announcements INTEGER DEFAULT 0,

    updated_at INTEGER NOT NULL
  );
`);




  // ==========================================================================
  // SAFE SCHEMA UPGRADES (no duplicates, no crashes)
  // ==========================================================================

  // Forum thread flags / stats
  addColumnIfNotExists("forum_threads", "pinned", "INTEGER DEFAULT 0");
  addColumnIfNotExists("forum_threads", "status", "TEXT DEFAULT 'visible'");
  addColumnIfNotExists("forum_threads", "likes_count", "INTEGER DEFAULT 0");
  addColumnIfNotExists("forum_threads", "hidden", "INTEGER DEFAULT 0");
  addColumnIfNotExists("forum_threads", "locked", "INTEGER DEFAULT 0");
  addColumnIfNotExists("forum_threads", "pinned_at", "INTEGER");
  addColumnIfNotExists("forum_threads", "shadowbanned", "INTEGER DEFAULT 0");
  addColumnIfNotExists("forum_threads", "banned", "INTEGER DEFAULT 0");
  addColumnIfNotExists("forum_threads", "community_id", "INTEGER");

  


  // Replies moderation
  addColumnIfNotExists("forum_replies", "hidden", "INTEGER DEFAULT 0");


  // Members banning + autoban
  addColumnIfNotExists("members", "banned", "INTEGER DEFAULT 0");
  addColumnIfNotExists("members", "banned_reason", "TEXT");
  addColumnIfNotExists("members", "banned_at", "INTEGER");
  addColumnIfNotExists("members", "banned_by", "INTEGER");
  addColumnIfNotExists("members", "autoban_score", "INTEGER DEFAULT 0");
  addColumnIfNotExists("members", "autoban_last_post", "INTEGER");
  addColumnIfNotExists("members", "autoban_banned_until", "INTEGER");

  // Avatar URL (Cloudinary)
  addColumnIfNotExists("members", "avatar_url", "TEXT");

  // Shadowbanning
  addColumnIfNotExists("members", "shadowbanned", "INTEGER DEFAULT 0");
  addColumnIfNotExists("members", "shadowban_reason", "TEXT");
  addColumnIfNotExists("members", "shadowban_at", "INTEGER");
  addColumnIfNotExists("members", "shadowban_by", "INTEGER");

  // Members bio / profile
  addColumnIfNotExists("members", "testimony", "TEXT");
  addColumnIfNotExists("members", "website", "TEXT");
  addColumnIfNotExists("members", "profile_visibility", "TEXT DEFAULT 'public'");

  // Profile banner
  addColumnIfNotExists("members", "banner_filename", "TEXT");
  addColumnIfNotExists("members", "banner_updated_at", "INTEGER");

  // User stats
  addColumnIfNotExists("members", "total_threads", "INTEGER DEFAULT 0");
  addColumnIfNotExists("members", "total_replies", "INTEGER DEFAULT 0");
  addColumnIfNotExists("members", "total_likes_received", "INTEGER DEFAULT 0");

  // Badges CSV (legacy)
  addColumnIfNotExists("members", "badges", "TEXT DEFAULT ''");

  // Username / identity
  addColumnIfNotExists("members", "username", "TEXT UNIQUE");

  // Profile moderation / visibility
  
addColumnIfNotExists("members", "profile_status", "TEXT DEFAULT 'active'"); // active | hidden | flagged
addColumnIfNotExists("members", "moderated_at", "INTEGER");
addColumnIfNotExists("members", "moderated_by", "INTEGER");
addColumnIfNotExists("members", "moderation_reason", "TEXT");
// Track last login timestamp
addColumnIfNotExists("members", "last_login", "INTEGER");

  // Social links
  addColumnIfNotExists("members", "social_instagram", "TEXT");
  addColumnIfNotExists("members", "social_tiktok", "TEXT");
  addColumnIfNotExists("members", "social_youtube", "TEXT");
  addColumnIfNotExists("members", "social_x", "TEXT");

  // Notification settings
  addColumnIfNotExists("members", "notify_replies", "INTEGER DEFAULT 1");
  addColumnIfNotExists("members", "notify_mentions", "INTEGER DEFAULT 1");
  addColumnIfNotExists("members", "notify_weekly_summary", "INTEGER DEFAULT 0");

  // Privacy settings
  addColumnIfNotExists("members", "show_online_status", "INTEGER DEFAULT 1");
  addColumnIfNotExists("members", "show_activity_public", "INTEGER DEFAULT 1");

  // Spiritual profile
  addColumnIfNotExists("members", "favorite_verse", "TEXT");
  addColumnIfNotExists("members", "favorite_verse_ref", "TEXT");
  addColumnIfNotExists("members", "spiritual_interests", "TEXT");

  // Appearance / theme
  addColumnIfNotExists("members", "theme", "TEXT DEFAULT 'light'");

  // Blessing stats
  addColumnIfNotExists("members", "stats_amens_given", "INTEGER DEFAULT 0");
  addColumnIfNotExists("members", "stats_amens_received", "INTEGER DEFAULT 0");
  addColumnIfNotExists("members", "stats_prayers_received", "INTEGER DEFAULT 0");

  // Soft delete
  addColumnIfNotExists("members", "deleted_at", "INTEGER");

  // Email signups source
  addColumnIfNotExists("email_signups", "source", "TEXT");

  // Donations link to members (for badges / analytics)
  addColumnIfNotExists("donations", "member_id", "INTEGER");

  // Badges key
  addColumnIfNotExists("badges", "badge_key", "TEXT");

  // Events — type and page_views
  addColumnIfNotExists("events", "type", "TEXT DEFAULT 'general'");
  addColumnIfNotExists("events", "page_views", "INTEGER DEFAULT 0");



db.run(`CREATE INDEX IF NOT EXISTS idx_members_username ON members(username)`);

// ============================================================================
// FORUM INDEXES (PERFORMANCE)
// ============================================================================

db.run(`
  CREATE INDEX IF NOT EXISTS idx_forum_threads_created
  ON forum_threads(created_at)
`);

 db.run(`
  CREATE INDEX IF NOT EXISTS idx_forum_threads_community
  ON forum_threads(community_id)
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_forum_members_active
  ON forum_community_members (community_id, status);
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_forum_communities_status
  ON forum_communities(status)
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_forum_replies_thread
  ON forum_replies(thread_id)
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_forum_thread_amens_thread
  ON forum_thread_amens(thread_id)
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_forum_thread_amens_member
  ON forum_thread_amens(member_id)
`);

  // Reports
  db.run(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER,
      reply_id INTEGER,
      reporter_id INTEGER NOT NULL,
      reason TEXT,
      created_at INTEGER,
      FOREIGN KEY (thread_id) REFERENCES forum_threads(id),
      FOREIGN KEY (reply_id) REFERENCES forum_replies(id),
      FOREIGN KEY (reporter_id) REFERENCES members(id)
    );
  `);

 

  // Moderator actions log
  db.run(`
    CREATE TABLE IF NOT EXISTS forum_mod_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      target_member_id INTEGER,
      thread_id INTEGER,
      reply_id INTEGER,
      action_type TEXT NOT NULL,
      reason TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS mod_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT,
      target_type TEXT,
      target_id INTEGER,
      target_label TEXT,
      admin_id INTEGER,
      reason TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
  `);

  // Page views / sessions
  db.run(`
    CREATE TABLE IF NOT EXISTS page_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      member_id INTEGER,
      path TEXT,
      referrer TEXT,
      user_agent TEXT,
      created_at INTEGER
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS visitor_sessions (
      id TEXT PRIMARY KEY,
      first_seen INTEGER,
      last_seen INTEGER,
      member_id INTEGER
    );
  `);

  // ==========================================================================
  // EMAIL SIGNUP LIST
  // ==========================================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS email_signups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      source_page TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // ==========================================================================
  // EMAIL CAMPAIGNS / TEMPLATES / AUTOMATION
  // ==========================================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS email_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      from_email TEXT,
      body_html TEXT,
      body_text TEXT,
      status TEXT DEFAULT 'draft',
      segment TEXT,
      total_recipients INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      scheduled_at INTEGER,
      sent_at INTEGER
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS email_automation_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      campaign_id INTEGER NOT NULL,
      send_at INTEGER NOT NULL,
      sent INTEGER DEFAULT 0,
      sent_at INTEGER,
      error TEXT,
      FOREIGN KEY(campaign_id) REFERENCES email_campaigns(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      thumbnail TEXT,
      html TEXT NOT NULL,
      created_at INTEGER
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS email_automation_sequences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_config TEXT,
      active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS email_automation_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sequence_id INTEGER NOT NULL,
      step_order INTEGER NOT NULL,
      delay_days INTEGER NOT NULL,
      campaign_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (sequence_id) REFERENCES email_automation_sequences(id),
      FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id)
    );
  `);

  // ==========================================================================
  // BADGES
  // ==========================================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      badge_key TEXT,
      icon_url TEXT NOT NULL,
      category TEXT,
      is_active INTEGER DEFAULT 1,
      expires_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS member_badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      badge_id INTEGER NOT NULL,
      granted_at INTEGER NOT NULL,
      UNIQUE(member_id, badge_id),
      FOREIGN KEY(member_id) REFERENCES members(id),
      FOREIGN KEY(badge_id) REFERENCES badges(id)
    );
  `);


  // ==========================================================================
  // MASTER ACCOUNT SEED (idempotent)
  // ==========================================================================
  db.get(
    `SELECT id FROM members WHERE role = 'master' LIMIT 1`,
    [],
    (err, row) => {
      if (err) {
        console.error("Error checking for master member:", err);
        return;
      }

      if (!row) {
        db.run(
          `
          INSERT INTO members (
            first_name,
            last_name,
            email,
            password_hash,
            username,
            avatar_url,
            role,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))
        `,
          [
            "Holy",
            "Master",
            "holycircleorg@gmail.com",
            // existing bcrypt hash you already had:
            "$2b$10$Z6Nfe3tA44317TzAgVNCueT1zFx1fiGig731dKOc5ZJZg5ab451YO",
            "@holymaster",
            null,
            "master",
          ],
          (err2) => {
            if (err2) {
              console.error("Error inserting master member:", err2);
            } else {
              console.log("Seeded master member @holymaster");
            }
          }
        );
      }
    }
  );
// ============================================================
// Seed default approved communities (idempotent)
// ============================================================
db.get(
  `SELECT id FROM members WHERE role = 'master' LIMIT 1`,
  [],
  (err, master) => {
    if (err || !master) return;

    db.get(
      `SELECT COUNT(*) AS c FROM forum_communities WHERE status = 'approved'`,
      [],
      (err2, row) => {
        if (err2) return;
        if ((row?.c || 0) > 0) return;

        const now = Date.now();
        const seed = [
          ["Prayer", "A place to share prayer requests and pray for others.", 0],
          ["Testimonies", "Share what God has done in your life.", 0],
          ["Bible Study", "Discuss scripture, questions, and insights.", 0],
          ["Life & Faith", "Encouragement and real life conversations through faith.", 0],
        ];

        seed.forEach(([name, description, is_private]) => {
          db.run(
            `
            INSERT INTO forum_communities
              (name, description, is_private, status, created_by, created_at)
            VALUES (?, ?, ?, 'approved', ?, ?)
            `,
            [name, description, is_private, master.id, now]
          );
        });

        console.log("Seeded default approved communities.");
      }
    );
  }
);


}); // END serialize()

// ============================================================
// Promise-based DB helpers (required by forum.js)
// ============================================================

export function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

export function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function (err, row) {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function (err, rows) {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}


export default db;

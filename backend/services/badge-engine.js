import db from "../db.js";

/* ======================================================
   AUTO-BADGE ENGINE
   ====================================================== */

export async function runAutoBadges(memberId) {
  console.log("🏅 runAutoBadges CALLED → memberId:", memberId);
  if (!memberId) return;

  // 1️⃣ FIRST THREAD
  const threadCount = await count(
    `SELECT COUNT(*) AS n FROM forum_threads WHERE member_id = ?`,
    [memberId]
  );

  if (threadCount >= 1) {
    await awardBadgeIfEligible({
      memberId,
      badgeKey: "first_thread",
      reason: "Created first thread",
    });
  }

  // 2️⃣ FIRST REPLY
  const replyCount = await count(
    `SELECT COUNT(*) AS n FROM forum_replies WHERE member_id = ?`,
    [memberId]
  );

  if (replyCount >= 1) {
    await awardBadgeIfEligible({
      memberId,
      badgeKey: "first_reply",
      reason: "Posted first reply",
    });
  }

  // 3️⃣ ACTIVE MEMBER
  if (replyCount >= 20 || threadCount >= 5) {
    await awardBadgeIfEligible({
      memberId,
      badgeKey: "active_member",
      reason: "Consistent participation",
    });
  }
}

/* ======================================================
   BADGE HELPERS
   ====================================================== */

function getBadgeByKey(badgeKey) {
  return new Promise((resolve) => {
    db.get(
      `
      SELECT id, badge_key
      FROM badges
      WHERE badge_key = ?
        AND is_active = 1
        AND (expires_at IS NULL OR expires_at > ?)
      `,
      [badgeKey, Date.now()],
      (err, row) => resolve(row || null)
    );
  });
}

function memberHasBadge(memberId, badgeId) {
  return new Promise((resolve) => {
    db.get(
      `
      SELECT 1
      FROM member_badges
      WHERE member_id = ?
        AND badge_id = ?
      `,
      [memberId, badgeId],
      (err, row) => resolve(!!row)
    );
  });
}

function grantBadge(memberId, badgeId) {
  return new Promise((resolve) => {
    db.run(
      `
      INSERT OR IGNORE INTO member_badges
        (member_id, badge_id, granted_at)
      VALUES (?, ?, ?)
      `,
      [memberId, badgeId, Date.now()],
      function () {
        resolve(this.changes > 0);
      }
    );
  });
}

export async function awardBadgeIfEligible({
  memberId,
  badgeKey,
  reason = null,
}) {
  if (!memberId || !badgeKey) return false;

  const badge = await getBadgeByKey(badgeKey);
  if (!badge) return false;

  const alreadyHas = await memberHasBadge(memberId, badge.id);
  if (alreadyHas) return false;

  const granted = await grantBadge(memberId, badge.id);

  if (granted) {
    console.log(
      `🏅 Badge granted: ${badgeKey} → member ${memberId}` +
        (reason ? ` (${reason})` : "")
    );
  }

  return granted;
}

/* ======================================================
   UTILS
   ====================================================== */

function count(sql, params) {
  return new Promise((resolve) => {
    db.get(sql, params, (err, row) => {
      resolve(row?.n || 0);
    });
  });
}

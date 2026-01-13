import db from "../db.js";

export async function awardBadgeIfNeeded(memberId, badgeName) {
  return new Promise((resolve, reject) => {
    // Step 1 — find badge ID
    db.get(
      `SELECT id FROM badges WHERE name = ? AND is_active = 1`,
      [badgeName],
      (err, badge) => {
        if (err || !badge) return resolve(false);

        // Step 2 — check if the user already has it
        db.get(
          `SELECT id FROM member_badges WHERE member_id = ? AND badge_id = ?`,
          [memberId, badge.id],
          (err2, row) => {
            if (err2) return resolve(false);

            if (row) return resolve(false); // already has it

            const now = Date.now();

            // Step 3 — award badge
            db.run(
              `INSERT INTO member_badges (member_id, badge_id, granted_at)
               VALUES (?, ?, ?)`,
              [memberId, badge.id, now],
              (err3) => {
                if (err3) return resolve(false);
                console.log(`🏅 Auto-awarded badge: ${badgeName} → member ${memberId}`);
                resolve(true);
              }
            );
          }
        );
      }
    );
  });
}

import db from "../db.js";

/**
 * Remove any badges from members when the badge has expired.
 * Expired = expires_at <= now (unix seconds)
 */
export function removeExpiredBadges() {
  const now = Math.floor(Date.now() / 1000);

  // Step 1 — Get expired badge IDs
  db.all(
    `
    SELECT id FROM badges
    WHERE expires_at IS NOT NULL
      AND expires_at <= ?
      AND is_active = 1
    `,
    [now],
    (err, expiredBadges) => {
      if (err) {
        console.error("❌ Error fetching expired badges:", err);
        return;
      }

      if (!expiredBadges.length) return; // nothing to process

      const badgeIds = expiredBadges.map((b) => b.id);

      console.log("⏳ Cleaning expired badges:", badgeIds);

      // Step 2 — Remove these badges from all members
      db.run(
        `
        DELETE FROM member_badges
        WHERE badge_id IN (${badgeIds.map(() => "?").join(",")})
        `,
        badgeIds,
        (err2) => {
          if (err2) {
            console.error("❌ Error removing expired badges from members:", err2);
            return;
          }

          console.log(`🧹 Removed expired badges from members: ${badgeIds.join(", ")}`);
        }
      );

      // OPTIONAL Step 3 — Mark badges as inactive
      db.run(
        `
        UPDATE badges
        SET is_active = 0
        WHERE id IN (${badgeIds.map(() => "?").join(",")})
        `,
        badgeIds,
        (err3) => {
          if (err3) {
            console.error("❌ Error deactivating expired badges:", err3);
            return;
          }

          console.log(`🚫 Deactivated expired badges: ${badgeIds.join(", ")}`);
        }
      );
    }
  );
}

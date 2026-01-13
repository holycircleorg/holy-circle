import db from "./db.js";

const SPAM_KEYWORDS = [
  "viagra","porn","xxx","crypto","bitcoin",
  "telegram","whatsapp","sex","hot girls",
  "free money","scam","nude","follow me"
];

const SUSPICIOUS_LINKS = [
  "bit.ly","tinyurl","t.me","telegram.me","onlyfans","pornhub"
];

const MAX_POSTS_PER_MINUTE = 7;
const MAX_POSTS_PER_10MIN = 20;
const MAX_AUTOBAN_SCORE = 5;

export async function autobanCheck(memberId, textBody) {
  return new Promise((resolve) => {
    db.get(`SELECT * FROM members WHERE id = ?`, [memberId], (err, member) => {
      if (!member) return resolve(false);

      let score = member.autoban_score || 0;
      const timeNow = Math.floor(Date.now() / 1000);
      const lastPost = member.autoban_last_post || 0;
      const delta = timeNow - lastPost;

      // ----------------------------------
      // RATE LIMITING CHECK
      // ----------------------------------
      if (delta < 8) score += 2;        // posting too fast
      if (delta < 3) score += 3;        // dangerously fast

      // ----------------------------------
      // SPAM KEYWORD CHECK
      // ----------------------------------
      const bodyLower = textBody.toLowerCase();
      if (SPAM_KEYWORDS.some(k => bodyLower.includes(k))) {
        score += 5;
      }

      // ----------------------------------
      // SUSPICIOUS LINKS
      // ----------------------------------
      if (SUSPICIOUS_LINKS.some(l => bodyLower.includes(l))) {
        score += 5;
      }

      // Save updated score
      db.run(
        `UPDATE members SET autoban_score=?, autoban_last_post=? WHERE id=?`,
        [score, timeNow, memberId]
      );

      // ----------------------------------
      // AUTO-BAN TRIGGER
      // ----------------------------------
      if (score >= MAX_AUTOBAN_SCORE) {
        db.run(`
          UPDATE members
          SET banned = 1,
              banned_reason = 'Auto-ban: spam detection',
              banned_at = strftime('%s','now'),
              banned_by = NULL,
              autoban_banned_until = NULL
          WHERE id = ?
        `, [memberId]);

        return resolve(true);
      }

      resolve(false);
    });
  });
}

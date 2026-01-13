import db from "../db.js";
import { broadcastNotification } from "../realtime/realtime-server.js";


// Promise helpers (add if you don’t already have them)
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

export async function createMemberNotification({
  memberId,
  category,
  type,
  message,
  link = null,
}) {
  try {
    // 1️⃣ Load member notification settings
    const settings = await dbGet(
      `SELECT * FROM notification_settings WHERE member_id = ?`,
      [memberId]
    );

    // If no settings or toggle off → do nothing
    if (settings && settings[type] === 0) return;


    const createdAt = Date.now();

    // 2️⃣ Insert notification
    const result = await dbRun(
      `
      INSERT INTO forum_notifications
        (member_id, category, type, message, link, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [memberId, category, type, message, link, createdAt]
    );

    // 3️⃣ Emit realtime notification
 broadcastNotification({
  id: result.lastID,
  member_id: memberId,
  category,
  type,
  message,
  link,
  created_at: createdAt,
  read: 0,
});
    
  } catch (err) {
    console.error("Failed to create member notification:", err);
  }
}

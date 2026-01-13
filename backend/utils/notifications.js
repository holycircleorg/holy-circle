import db from "../db.js";
import { getSocketIO } from "./socket.js";

export function createNotification({
  type,
  message,
  metadata = null,
  adminId = null
}) {
  const createdAt = Date.now();
  const metaString = metadata ? JSON.stringify(metadata) : null;

  db.run(
    `
      INSERT INTO admin_notifications
        (type, message, metadata, created_at, is_read, admin_id)
      VALUES (?, ?, ?, ?, 0, ?)
    `,
    [type, message, metaString, createdAt, adminId],
    (err) => {
      if (err) {
        console.error("❌ Error inserting admin notification:", err);
        return;
      }

      // 🔔 Real-time broadcast (SAFE)
      const io = getSocketIO();
      if (io) {
        io.emit("admin:notification:new", {
          type,
          message,
          metadata,
          created_at: createdAt
        });
      }
    }
  );
}

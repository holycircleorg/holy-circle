import sqlite3 from "sqlite3";

// Open the same DB used in db.js
const db = new sqlite3.Database("admin.db", (err) => {
  if (err) {
    return console.error("Migration DB connect error:", err.message);
  }
  console.log("Migration connected → admin.db");
});

// Helper: check if column exists
function columnExists(table, column) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table});`, (err, rows) => {
      if (err) return reject(err);

      const exists = rows.some((row) => row.name === column);
      resolve(exists);
    });
  });
}

(async () => {
  try {
    const exists = await columnExists("donors", "stripe_customer_id");

    if (exists) {
      console.log("✔ Column 'stripe_customer_id' already exists — no changes made.");
    } else {
      console.log("⏳ Adding stripe_customer_id column to donors…");

      db.run(
        `ALTER TABLE donors ADD COLUMN stripe_customer_id TEXT`,
        (err) => {
          if (err) {
            console.error("❌ Migration error:", err.message);
          } else {
            console.log("✅ Column stripe_customer_id added successfully!");
          }
        }
      );
    }
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    db.close(() => {
      console.log("Migration completed. Database closed.");
    });
  }
})();

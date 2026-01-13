import jwt from "jsonwebtoken";
import db from "../db.js";

export default function requireMember(req, res, next) {
  const token = req.cookies?.hc_member_token;

  if (!token) {
    return res.status(401).json({ error: "Not logged in" });
  }

  // ✅ Match your auth routes: allow fallback secret in dev
  const secret = process.env.JWT_SECRET || "dev-secret";

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (err) {
    return res.status(401).json({ error: "Invalid session" });
  }

  // ✅ Match your token payload: { memberId }
  // Also support older payloads: { id }
  const memberId = decoded?.memberId || decoded?.id;

  if (!memberId) {
    return res.status(401).json({ error: "Invalid session" });
  }

  db.get("SELECT * FROM members WHERE id = ?", [memberId], (err, row) => {
    if (err) {
      console.error("requireMember DB error:", err);
      return res.status(500).json({ error: "DB error" });
    }

    if (!row) {
      return res.status(401).json({ error: "Member not found" });
    }

    // ✅ Provide BOTH shapes used across your codebase
    req.memberId = row.id;

    // Ensure req.member exists and has .id even if DB schema changes
    req.member = { ...row, id: row.id };

    return next();
  });
}

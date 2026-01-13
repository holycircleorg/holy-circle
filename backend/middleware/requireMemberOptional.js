import jwt from "jsonwebtoken";
import db from "../db.js";

export default function requireMemberOptional(req, res, next) {
  const token = req.cookies?.hc_member_token;

  // Guest access allowed
  if (!token) {
    req.member = null;
    return next();
  }

  const secret = process.env.JWT_SECRET || "dev-secret";

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (err) {
    // Invalid token → treat as guest, DO NOT block
    req.member = null;
    return next();
  }

  const memberId = decoded?.memberId || decoded?.id;
  if (!memberId) {
    req.member = null;
    return next();
  }

  db.get(
    "SELECT * FROM members WHERE id = ?",
    [memberId],
    (err, row) => {
      if (err || !row) {
        req.member = null;
        return next();
      }

      // ✅ Ensure BOTH access patterns work
      req.member = { ...row, id: row.id };
      req.memberId = row.id;

      return next();
    }
  );
}

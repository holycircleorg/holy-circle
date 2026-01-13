import jwt from "jsonwebtoken";
import db from "../db.js";

function requireAdmin(req, res, next) {
  // Forum/admin moderation uses the MEMBER JWT, not the hc_admin_token.
  const token = req.cookies.hc_member_token;

  if (!token) {
    return res.status(401).json({ error: "Admin login required" });
  }

  let decoded;
  try {
    decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "dev-secret"
    );

  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const memberId = decoded.memberId;
  if (!memberId) {
    return res.status(401).json({ error: "Invalid token payload" });
  }

  db.get(
    `SELECT id, email, role, banned, banned_reason FROM members WHERE id = ?`,
    [memberId],
    (err, member) => {
      if (err) {
        return res.status(500).json({ error: "DB error loading admin" });
      }

      if (!member) {
        return res.status(401).json({ error: "Member not found" });
      }

      // Block banned accounts
      if (member.banned && Number(member.banned) === 1) {
        return res.status(403).json({
          error: "Your account has been banned.",
          reason: member.banned_reason
        });
      }

      const role = (member.role || "").toLowerCase();

      // Allow both ADMIN and MASTER to use protected routes
      if (!["admin", "master"].includes(role)) {
        return res.status(403).json({ error: "Admin access only" });
      }

      // Attach to request
      req.memberId = member.id;
      req.member = member;
      req.memberRole = member.role;
      req.isMaster = role === "master";

      next();
    }
  );
}

export default requireAdmin;

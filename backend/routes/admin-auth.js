import express from "express";
import requireAdmin from "../middleware/requireAdmin.js";

const router = express.Router();

// Admin identity check
router.get("/me", requireAdmin, (req, res) => {
  res.json({
    success: true,
    admin: {
      id: req.member.id,
      email: req.member.email,
      role: req.member.role,
      isMaster: req.isMaster,
    },
  });
});

export default router;

import express from "express";
import db from "../db.js";

const router = express.Router();

console.log("🔥 traffic-public.js LOADED");

router.post("/traffic/event", (req, res) => {
  const { event, page, meta } = req.body;
  if (!event) return res.status(400).json({ success: false });

  db.run(
    `
    INSERT INTO traffic_events (event, page, meta, created_at)
    VALUES (?, ?, ?, ?)
    `,
    [event, page || null, meta ? JSON.stringify(meta) : null, Date.now()]
  );

  res.json({ success: true });
});

export default router;

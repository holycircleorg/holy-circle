// backend/routes/admin-rsvps.js
import express from "express";
import db from "../db.js";
import requireAdmin from "../middleware/requireAdmin.js";



const router = express.Router();

/**
 * GET /api/admin/rsvps/events
 * Returns events with RSVP counts
 */
router.get("/events", requireAdmin, (req, res) => {
  const sql = `
    SELECT
      e.id,
      e.title,
      e.date,
      e.location,
      (
        SELECT COUNT(*)
        FROM event_rsvps r
        WHERE r.event_id = e.id
      ) AS count
    FROM events e
    ORDER BY e.date ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Error loading RSVP events:", err);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    res.json({
      success: true,
      events: rows || [],
    });
  });
});

/**
 * GET /api/admin/rsvps/events/:id
 * Returns event header + filtered RSVP list
 */
router.get("/events/:id", requireAdmin, (req, res) => {
    const eventId = Number(req.params.id);
  
    const {
      search = "",
      contacted = "",
      memberOnly = "",
      from = "",
      to = ""
    } = req.query;
  
    const filters = ["event_id = ?"];
    const params = [eventId];
  
    // Search by name or email
    if (search) {
      filters.push("(name LIKE ? OR email LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
  
    // Contacted filter (YES / NO)
    if (contacted === "YES" || contacted === "NO") {
      filters.push("contacted = ?");
      params.push(contacted);
    }
  
    // Member-only RSVPs
    if (memberOnly === "1") {
      filters.push("member_id IS NOT NULL");
    }
  
    // Date range filters
    if (from) {
      filters.push("created_at >= ?");
      params.push(Number(from));
    }
  
    if (to) {
      filters.push("created_at <= ?");
      params.push(Number(to));
    }
  
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  
    // Load event header
    db.get(
      `SELECT id, title, date, location FROM events WHERE id = ?`,
      [eventId],
      (err, event) => {
        if (err || !event) {
          console.error("Error loading event:", err);
          return res.status(404).json({ success: false, error: "Event not found" });
        }
  
        // Load RSVPs with filters applied
        db.all(
          `
            SELECT
              id,
              name,
              email,
              guests,
              comments,
              contacted,
              created_at,
              member_id
            FROM event_rsvps
            ${where}
            ORDER BY created_at DESC
          `,
          params,
          (err2, rows) => {
            if (err2) {
              console.error("Error loading RSVPs:", err2);
              return res.status(500).json({ success: false, error: "Database error" });
            }
  
            res.json({
              success: true,
              title: event.title,
              date: event.date,
              location: event.location,
              rsvps: rows || [],
            });
          }
        );
      }
    );
  });
  
/**
 * POST /api/admin/rsvps/:id/contacted
 * Body: { contacted: "YES" | "NO" }
 */
router.post("/rsvps/:id/contacted", requireAdmin, express.json(), (req, res) => {
  const rsvpId = Number(req.params.id);
  const { contacted } = req.body || {};

  if (!["YES", "NO"].includes(contacted)) {
    return res
      .status(400)
      .json({ success: false, error: "contacted must be YES or NO." });
  }

  db.run(
    `UPDATE event_rsvps SET contacted = ? WHERE id = ?`,
    [contacted, rsvpId],
    (err) => {
      if (err) {
        console.error("Error updating contacted:", err);
        return res.status(500).json({ success: false, error: "Database error" });
      }

      res.json({ success: true });
    }
  );
});

/**
 * GET /api/admin/rsvps/events/:id/export
 * Returns CSV of RSVPs for this event
 */
router.get("/events/:id/export", requireAdmin, (req, res) => {
  const eventId = Number(req.params.id);

  db.all(
    `
      SELECT id, name, email, guests, comments, contacted, created_at
      FROM event_rsvps
      WHERE event_id = ?
      ORDER BY created_at DESC
    `,
    [eventId],
    (err, rows) => {
      if (err) {
        console.error("Error exporting RSVPs:", err);
        return res.status(500).send("Database error");
      }

      const header =
        "id,name,email,guests,comments,contacted,created_at\n";

      const csv = (rows || [])
        .map((r) =>
          [
            r.id,
            `"${(r.name || "").replace(/"/g, '""')}"`,
            `"${(r.email || "").replace(/"/g, '""')}"`,
            r.guests || 1,
            `"${(r.comments || "").replace(/"/g, '""')}"`,
            r.contacted || "NO",
            r.created_at,
          ].join(",")
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=event_${eventId}_rsvps.csv`
      );
      res.send(header + csv);
    }
  );
});

export default router;

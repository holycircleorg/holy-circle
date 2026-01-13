// In routes/admin-email.js
import express from "express";
import db from "../db.js";
import requireAdmin from "../middleware/requireAdmin.js";


const router = express.Router();

(async function enforceAdminAccess() {
  try {
    const res = await fetch("/api/admin/me", {
      credentials: "include",
    });

    if (!res.ok) throw new Error("Not authorized");

    const data = await res.json();
    if (!data.success) throw new Error("Not admin");

    // Optional: expose admin identity globally
    window.hcAdmin = data.admin;
  } catch (err) {
    console.warn("Admin access denied:", err);
    window.location.href = "/login.html";
  }
})();

// ... your existing email / template routes here ...

// ========================================
// EMAIL ANALYTICS (growth)
// GET /api/admin/email-analytics
// ========================================
router.get("/email-analytics", requireAdmin, (req, res) => {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const result = {
    totals: {
      emailSignups: 0,
      members: 0,
    },
    growth: {
      last30Days: 0,
      byMonth: [], // [{ label: "2025-01", count: 12 }, ...]
    },
  };

  // 1) Total email signups
  db.get(
    `SELECT COUNT(*) AS cnt FROM email_signups`,
    [],
    (err, row) => {
      if (err) {
        console.error("Email analytics total signups error:", err);
      } else {
        result.totals.emailSignups = row?.cnt || 0;
      }

      // 2) Total members
      db.get(`SELECT COUNT(*) AS cnt FROM members`, [], (err2, row2) => {
        if (err2) {
          console.error("Email analytics total members error:", err2);
        } else {
          result.totals.members = row2?.cnt || 0;
        }

        // 3) New signups in last 30 days
        db.get(
          `SELECT COUNT(*) AS cnt
           FROM email_signups
           WHERE created_at >= ?`,
          [thirtyDaysAgo],
          (err3, row3) => {
            if (err3) {
              console.error("Email analytics 30d error:", err3);
            } else {
              result.growth.last30Days = row3?.cnt || 0;
            }

            // 4) Signups per month (last 6 months)
            db.all(
              `
              SELECT
                strftime('%Y-%m', datetime(created_at / 1000, 'unixepoch')) AS month,
                COUNT(*) AS cnt
              FROM email_signups
              WHERE created_at >= strftime('%s', 'now', '-6 months') * 1000
              GROUP BY month
              ORDER BY month ASC
            `,
              [],
              (err4, rows4) => {
                if (err4) {
                  console.error("Email analytics by month error:", err4);
                } else {
                  result.growth.byMonth =
                    (rows4 || []).map((r) => ({
                      label: r.month,
                      count: r.cnt,
                    })) || [];
                }

                return res.json({ success: true, analytics: result });
              }
            );
          }
        );
      });
    }
  );
});


// ========================================
// AUTOMATION SEQUENCES CRUD
// Base path: /api/admin/email/sequences
// ========================================

// List sequences
router.get("/email/sequences", requireAdmin, (req, res) => {
    db.all(
      `
      SELECT id, name, trigger_type, active, created_at, updated_at
      FROM email_automation_sequences
      ORDER BY created_at DESC
    `,
      [],
      (err, rows) => {
        if (err) {
          console.error("List sequences error:", err);
          return res.status(500).json({ error: "DB error" });
        }
        res.json({ success: true, sequences: rows || [] });
      }
    );
  });
  
  // Get one sequence + its steps
  router.get("/email/sequences/:id", requireAdmin, (req, res) => {
    const seqId = Number(req.params.id);
  
    db.get(
      `
      SELECT *
      FROM email_automation_sequences
      WHERE id = ?
    `,
      [seqId],
      (err, seq) => {
        if (err || !seq) {
          return res.status(404).json({ error: "Sequence not found" });
        }
  
        db.all(
          `
          SELECT s.*, c.name AS campaign_name
          FROM email_automation_steps s
          JOIN email_campaigns c ON c.id = s.campaign_id
          WHERE s.sequence_id = ?
          ORDER BY s.step_order ASC
        `,
          [seqId],
          (err2, steps) => {
            if (err2) {
              console.error("Load steps error:", err2);
              return res.status(500).json({ error: "DB error" });
            }
  
            res.json({
              success: true,
              sequence: seq,
              steps: steps || [],
            });
          }
        );
      }
    );
  });
  
  // Create sequence (no steps yet)
  router.post("/email/sequences", requireAdmin, express.json(), (req, res) => {
    const { name, trigger_type } = req.body || {};
  
    if (!name || !trigger_type) {
      return res
        .status(400)
        .json({ error: "Name and trigger_type are required." });
    }
  
    const now = Date.now();
  
    db.run(
      `
      INSERT INTO email_automation_sequences
        (name, trigger_type, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `,
      [name, trigger_type, now, now],
      function (err) {
        if (err) {
          console.error("Create sequence error:", err);
          return res.status(500).json({ error: "Failed to create sequence." });
        }
  
        return res.json({
          success: true,
          id: this.lastID,
        });
      }
    );
  });
  
  // Update sequence basic fields + pause/resume
  router.put(
    "/email/sequences/:id",
    requireAdmin,
    express.json(),
    (req, res) => {
      const seqId = Number(req.params.id);
      const { name, trigger_type, active } = req.body || {};
      const now = Date.now();
  
      db.run(
        `
        UPDATE email_automation_sequences
        SET
          name = COALESCE(?, name),
          trigger_type = COALESCE(?, trigger_type),
          active = COALESCE(?, active),
          updated_at = ?
        WHERE id = ?
      `,
        [name, trigger_type, active, now, seqId],
        (err) => {
          if (err) {
            console.error("Update sequence error:", err);
            return res.status(500).json({ error: "Failed to update sequence." });
          }
          res.json({ success: true });
        }
      );
    }
  );
  
  // Delete sequence + steps
  router.delete("/email/sequences/:id", requireAdmin, (req, res) => {
    const seqId = Number(req.params.id);
  
    db.run(
      `DELETE FROM email_automation_steps WHERE sequence_id = ?`,
      [seqId],
      (err) => {
        if (err) {
          console.error("Delete steps error:", err);
          return res.status(500).json({ error: "DB error" });
        }
  
        db.run(
          `DELETE FROM email_automation_sequences WHERE id = ?`,
          [seqId],
          (err2) => {
            if (err2) {
              console.error("Delete sequence error:", err2);
              return res.status(500).json({ error: "DB error" });
            }
  
            res.json({ success: true });
          }
        );
      }
    );
  });
  
  // Replace all steps for a sequence
  // Body: { steps: [{ campaign_id, delay_days }, ...] }
  router.put(
    "/email/sequences/:id/steps",
    requireAdmin,
    express.json(),
    (req, res) => {
      const seqId = Number(req.params.id);
      const { steps } = req.body || {};
  
      if (!Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({ error: "At least one step is required." });
      }
  
      const now = Date.now();
  
      db.serialize(() => {
        db.run(
          `DELETE FROM email_automation_steps WHERE sequence_id = ?`,
          [seqId],
          (err) => {
            if (err) {
              console.error("Delete old steps error:", err);
              return res.status(500).json({ error: "DB error" });
            }
  
            const stmt = db.prepare(`
              INSERT INTO email_automation_steps
                (sequence_id, step_order, delay_days, campaign_id, created_at)
              VALUES (?, ?, ?, ?, ?)
            `);
  
            steps.forEach((step, index) => {
              stmt.run(
                seqId,
                index + 1,
                Number(step.delay_days || 0),
                Number(step.campaign_id),
                now
              );
            });
  
            stmt.finalize((err2) => {
              if (err2) {
                console.error("Insert steps error:", err2);
                return res.status(500).json({ error: "DB error" });
              }
  
              db.run(
                `
                UPDATE email_automation_sequences
                SET updated_at = ?
                WHERE id = ?
              `,
                [now, seqId],
                () => {
                  res.json({ success: true });
                }
              );
            });
          }
        );
      });
    }
  );
  
  export default router;
  

// ============================================================
//  ADMIN EMAIL JS — Holy Circle
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    loadEmailSummary();
    loadTemplates();
    loadCampaigns();
  
    const form = document.getElementById("campaignForm");
    if (form) form.addEventListener("submit", handleCreateCampaign);
  
    const refreshBtn = document.getElementById("refreshEmailCampaigns");
    if (refreshBtn) refreshBtn.addEventListener("click", loadCampaigns);
  });
  
  // ============================================================
  // 1. LOAD EMAIL LIST SNAPSHOT
  // ============================================================
  
  async function loadEmailSummary() {
    try {
      const res = await fetch("/api/admin/email-signups/summary", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load stats.");
  
      document.getElementById("statEmailTotal").textContent = data.total || 0;
      document.getElementById("statEmail7d").textContent = data.last7 || 0;
      document.getElementById("statEmail30d").textContent = data.last30 || 0;
  
      const topEl = document.getElementById("statEmailTopSource");
      if (data.bySource && data.bySource.length > 0) {
        const top = data.bySource[0];
        const name =
          top.source_page === "homepage"
            ? "Homepage"
            : top.source_page === "donate"
            ? "Donate Page"
            : top.source_page || "Unknown";
        topEl.textContent = `${name} (${top.count})`;
      } else {
        topEl.textContent = "No data yet";
      }
    } catch (err) {
      console.error("Email Summary Error:", err);
    }
  }
  
  // ============================================================
  // 2. LOAD EMAIL TEMPLATES INTO SELECT
  // ============================================================
  
  async function loadTemplates() {
    const select = document.getElementById("campaignTemplate");
    if (!select) return;
  
    try {
      const res = await fetch("/api/admin/email-templates", { credentials: "include" });
      const data = await res.json();
  
      select.innerHTML = `<option value="">— Select a Template —</option>`;
  
      (data.templates || []).forEach((t) => {
        const op = document.createElement("option");
        op.value = t.id;
        op.textContent = t.name;
        select.appendChild(op);
      });
  
      // Template Change → Load Template Content
      select.addEventListener("change", async () => {
        const id = select.value;
        if (!id) return;
  
        const res2 = await fetch(`/api/admin/email-templates/${id}`, {
          credentials: "include",
        });
        const data2 = await res2.json();
  
        if (!data2.template) return;
  
        document.getElementById("campaignBody").value = data2.template.html || "";
        if (data2.template.text) {
          document.getElementById("campaignBodyText").value = data2.template.text;
        }
      });
    } catch (err) {
      console.error("Load Templates Error:", err);
    }
  }
  
  // ============================================================
  // 3. HANDLE CREATE CAMPAIGN
  // ============================================================
  
  async function handleCreateCampaign(e) {
    e.preventDefault();
  
    const name = document.getElementById("campaignName").value.trim();
    const subject = document.getElementById("campaignSubject").value.trim();
    const from_email = document.getElementById("campaignFrom").value.trim();
    const body_html = document.getElementById("campaignBody").value;
    const body_text = document.getElementById("campaignBodyText").value;
    const segment = document.getElementById("campaignSegment").value;
  
    const msg = document.getElementById("campaignMessage");
  
    if (!name || !subject || !body_html) {
      msg.textContent = "Please fill in all required fields.";
      msg.style.color = "#ff4d4d";
      return;
    }
  
    try {
      const res = await fetch("/api/admin/email-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          subject,
          from_email: from_email || null,
          body_html,
          body_text: body_text || null,
          segment,
        }),
      });
  
      const data = await res.json();
  
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save campaign");
      }
  
      msg.textContent = "Campaign saved as draft.";
      msg.style.color = "#22c55e";
  
      // Clear inputs
      document.getElementById("campaignName").value = "";
      document.getElementById("campaignSubject").value = "";
      document.getElementById("campaignFrom").value = "";
      document.getElementById("campaignBody").value = "";
      document.getElementById("campaignBodyText").value = "";
      document.getElementById("campaignTemplate").value = "";
  
      loadCampaigns();
    } catch (err) {
      console.error("Create Campaign Error:", err);
      msg.textContent = err.message || "Error creating campaign.";
      msg.style.color = "#ff4d4d";
    }
  }
  
  // ============================================================
  // 4. LOAD CAMPAIGN HISTORY TABLE
  // ============================================================
  
  async function loadCampaigns() {
    const tbody = document.getElementById("campaignTableBody");
    tbody.innerHTML = `<tr><td colspan="8">Loading...</td></tr>`;
  
    try {
      const res = await fetch("/api/admin/email-campaigns", { credentials: "include" });
      const data = await res.json();
      const list = data.campaigns || [];
  
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8">No campaigns created yet.</td></tr>`;
        return;
      }
  
      tbody.innerHTML = "";
  
      list.forEach((c) => {
        const tr = document.createElement("tr");
  
        const created = c.created_at
          ? new Date(c.created_at).toLocaleDateString()
          : "—";
  
        const status =
          c.status === "sent"
            ? "Sent"
            : c.status === "sending"
            ? "Sending..."
            : c.status === "failed"
            ? "Failed"
            : "Draft";
  
        tr.innerHTML = `
          <td>${c.name}</td>
          <td>${c.subject}</td>
          <td>${c.segment || "all"}</td>
          <td>${status}</td>
          <td>${c.sent_count || 0}/${c.total_recipients || 0}</td>
          <td>${c.error_count || 0}</td>
          <td>${created}</td>
          <td>
            ${
              c.status === "draft"
                ? `<button class="small-btn send-btn" data-id="${c.id}">Send Now</button>`
                : ""
            }
          </td>
        `;
  
        tbody.appendChild(tr);
      });
  
      // Wire send buttons
      document.querySelectorAll(".send-btn").forEach((btn) => {
        btn.addEventListener("click", () => sendCampaign(btn.getAttribute("data-id"), btn));
      });
    } catch (err) {
      console.error("Load Campaigns Error:", err);
      tbody.innerHTML = `<tr><td colspan="8">Error loading campaigns.</td></tr>`;
    }
  }
  
  // ============================================================
  // 5. SEND CAMPAIGN
  // ============================================================
  
  async function sendCampaign(id, btn) {
    if (!confirm("Send this campaign to the selected segment?")) return;
  
    btn.disabled = true;
    btn.textContent = "Sending...";
  
    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}/send`, {
        method: "POST",
        credentials: "include",
      });
  
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Send failed");
      }
  
      alert("Campaign sent successfully.");
      loadCampaigns();
    } catch (err) {
      console.error("Send Campaign Error:", err);
      alert(err.message || "Error sending campaign.");
    }
  }
  
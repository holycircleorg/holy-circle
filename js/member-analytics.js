// js/member-analytics.js
// Single source of truth for member giving analytics

(function () {
  let cached = null;
  let loading = false;

  async function fetchAnalytics() {
    if (cached) return cached;
    if (loading) return null;

    loading = true;

    try {
      // Fetch BOTH summary + history in parallel
      const [summaryRes, historyRes] = await Promise.all([
        fetch("/api/members/me/giving-summary", { credentials: "include" }),
        fetch("/api/members/giving-history", { credentials: "include" })
      ]);

      if (!summaryRes.ok || !historyRes.ok) {
        throw new Error("Analytics fetch failed");
      }

      const summaryJson = await summaryRes.json();
      const historyJson = await historyRes.json();

      const summary = summaryJson.summary || {};
      const donations = historyJson.donations || [];

      // 🔒 NORMALIZED SHAPE (this is the key)
      cached = {
        totals: {
          donationCount: summary.donationCount || 0,
          totalCents: summary.totalCents || 0,
          totalDollars: summary.totalDollars || 0,
          lastDonationAt: summary.lastDonationAt || null,
          recurringMonthlyCents: summary.recurringMonthlyCents || 0,
          recurringMonthlyDollars: summary.recurringMonthlyDollars || 0
        },

        donations: donations.map(d => ({
          id: d.id,
          amountCents: d.amount_cents,
          amountDollars: d.amount_dollars,
          fund: d.fund,
          frequency: d.frequency,
          status: d.status,
          createdAt: d.created_at,
          receiptUrl: d.receipt_url || null
        }))
      };

      return cached;
    } catch (err) {
      console.error("Member analytics error:", err);
      return null;
    } finally {
      loading = false;
    }
  }

  function clearCache() {
    cached = null;
  }

  // Expose globally
  window.MemberAnalytics = {
    fetch: fetchAnalytics,
    refresh: async () => {
      clearCache();
      return fetchAnalytics();
    }
  };

// ===============================
// DEV ANALYTICS INSPECTOR
// ===============================

function isDevEnvironment() {
  return (
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    window.hcUser?.profile?.role === "admin" ||
    window.hcUser?.profile?.role === "master"
  );
}

function mountAnalyticsInspector() {
  if (!isDevEnvironment()) return;
  if (document.getElementById("analyticsInspector")) return;

  const panel = document.createElement("div");
  panel.id = "analyticsInspector";
  panel.style.cssText = `
    position: fixed;
    bottom: 16px;
    right: 16px;
    width: 360px;
    max-height: 70vh;
    background: #0b1f33;
    color: #fff;
    border-radius: 12px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.35);
    font-family: monospace;
    font-size: 12px;
    z-index: 99999;
    overflow: hidden;
  `;

  panel.innerHTML = `
    <div style="
      padding: 10px 12px;
      background: #002e6b;
      display: flex;
      justify-content: space-between;
      align-items: center;
    ">
      <strong>🧪 Analytics Inspector</strong>
      <button id="aiToggle" style="
        background: none;
        border: none;
        color: #fff;
        cursor: pointer;
      ">–</button>
    </div>

    <div id="aiBody" style="padding: 12px; overflow-y: auto; max-height: 60vh;">
      <div id="aiStatus">Loading…</div>

      <pre id="aiPayload" style="
        margin-top: 8px;
        white-space: pre-wrap;
        word-break: break-word;
        background: rgba(255,255,255,0.08);
        padding: 8px;
        border-radius: 6px;
      "></pre>

      <div style="margin-top: 10px; display: flex; gap: 8px;">
        <button id="aiRefresh" style="flex:1;">Refresh</button>
        <button id="aiClear" style="flex:1;">Clear Cache</button>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  const body = panel.querySelector("#aiBody");
  const toggle = panel.querySelector("#aiToggle");
  const status = panel.querySelector("#aiStatus");
  const payload = panel.querySelector("#aiPayload");

  toggle.onclick = () => {
    const open = body.style.display !== "none";
    body.style.display = open ? "none" : "block";
    toggle.textContent = open ? "+" : "–";
  };

  async function render() {
    status.textContent = "Fetching analytics…";
    const data = await window.MemberAnalytics.fetch();

    if (!data) {
      status.textContent = "❌ No analytics data";
      payload.textContent = "";
      return;
    }

    status.textContent = "✅ Analytics Loaded";
    payload.textContent = JSON.stringify(data, null, 2);
  }

  panel.querySelector("#aiRefresh").onclick = async () => {
    status.textContent = "Refreshing…";
    await window.MemberAnalytics.refresh();
    render();
  };

  panel.querySelector("#aiClear").onclick = () => {
    window.MemberAnalytics.refresh();
    payload.textContent = "";
    status.textContent = "🧹 Cache cleared";
  };

  render();
}

// Mount AFTER auth so role is known
window.addEventListener("hc:auth-ready", mountAnalyticsInspector);


})();

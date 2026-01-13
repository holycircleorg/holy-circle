// admin-analytics.js
// Holy Circle – Admin Analytics (Giving + Email + People + Podcast + Traffic)
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

let givingChart = null;
let growthChart = null;
let peopleChart = null;
let podcastChart = null;
let trafficChart = null;
let rsvpAnalyticsChart = null;
let givingMode = "monthly"; // "daily" or "monthly"
let leaderboardChart = null;
let rsvpTypeChart = null;

async function loadAdvancedRsvpAnalytics() {
    const res = await fetch("/api/admin/rsvp-advanced");
    const data = await res.json();
  
    if (!data.success) return;
  
    const { leaderboard, rsvpByType, conversions, topEvents } = data;
  
    // ------- Leaderboard chart -------
    {
      const labels = leaderboard.map(ev => ev.name);
      const values = leaderboard.map(ev => ev.total);
  
      const ctx = document.getElementById("leaderboardChart")?.getContext("2d");
      if (ctx) {
        if (leaderboardChart) leaderboardChart.destroy();
        leaderboardChart = new Chart(ctx, {
          type: "bar",
          data: { labels, datasets: [{ data: values }] },
          options: { plugins: { legend: { display: false } } }
        });
      }
    }
  
    // ------- RSVPs by Type -------
    {
      const labels = rsvpByType.map(t => t.type || "Unknown");
      const values = rsvpByType.map(t => t.total);
  
      const ctx = document.getElementById("rsvpTypeChart")?.getContext("2d");
      if (ctx) {
        if (rsvpTypeChart) rsvpTypeChart.destroy();
        rsvpTypeChart = new Chart(ctx, {
          type: "pie",
          data: { labels, datasets: [{ data: values }] }
        });
      }
    }
  
    // ------- Top 5 Events Table -------
    const tableTop = document.getElementById("topEventsTable");
    if (tableTop) {
      tableTop.innerHTML = topEvents.map(ev => `
        <tr>
          <td>${ev.name}</td>
          <td>${ev.type}</td>
          <td>${ev.total}</td>
        </tr>
      `).join("");
    }
  
    // ------- Conversion Rate Table -------
    const tableConv = document.getElementById("conversionTable");
    if (tableConv) {
      tableConv.innerHTML = conversions.map(ev => `
        <tr>
          <td>${ev.name}</td>
          <td>${ev.views}</td>
          <td>${ev.rsvps}</td>
          <td>${ev.conversion_rate}%</td>
        </tr>
      `).join("");
    }
  }
  

document.addEventListener("DOMContentLoaded", () => {
  // Optional: header name/role
  const headerNameEl = document.getElementById("headerName");
  const headerRoleEl = document.getElementById("headerRole");

  if (headerNameEl) {
    headerNameEl.textContent =
      localStorage.getItem("adminName") ||
      localStorage.getItem("adminEmail") ||
      "Admin";
  }
  if (headerRoleEl) {
    const role = localStorage.getItem("adminRole") || "admin";
    headerRoleEl.textContent = role.toUpperCase();
  }

  // Giving mode toggle (daily/monthly)
  const modeToggle = document.getElementById("givingModeButtons");
  if (modeToggle) {
    modeToggle.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-mode]");
      if (!btn) return;

      givingMode = btn.dataset.mode;

      [...modeToggle.querySelectorAll("button")].forEach((b) =>
        b.classList.remove("chip-active")
      );
      btn.classList.add("chip-active");

      loadGivingAnalytics(); // reload chart in new mode
    });
  }

  // Initial load
  loadAllAnalytics();
});

async function loadAllAnalytics() {
  await Promise.all([
    loadGivingAnalytics(),
    loadEmailAnalytics(),
    loadPeopleAnalytics(),
    loadPodcastAnalytics(),
    loadTrafficAnalytics(),
    loadRsvpAnalyticsAnalyticsPage(), 
    loadAdvancedRsvpAnalytics(),
    loadBadgeAnalytics(),
 
  ]);
}

/* ===========================
   EVENT RSVP ANALYTICS
   /api/admin/rsvp-analytics
   returns: { success, totalRsvps, weekTotal, labels, values }
   =========================== */
   async function loadRsvpAnalyticsAnalyticsPage() {
    const canvas = document.getElementById("rsvpAnalyticsChart");
    if (!canvas) return;
  
    try {
      const res = await fetch("/api/admin/rsvp-analytics", {
        credentials: "include",
      });
      const data = await res.json();
  
      if (!res.ok || !data.success) {
        throw new Error(data.error || "RSVP analytics error");
      }
  
      const labels = data.labels || [];
      const values = data.values || [];
  
      const ctx = canvas.getContext("2d");
      if (rsvpAnalyticsChart) rsvpAnalyticsChart.destroy();
  
      rsvpAnalyticsChart = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "RSVPs",
              data: values,
              tension: 0.3,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true },
          },
        },
      });
    } catch (err) {
      console.error("Error loading RSVP analytics (Analytics page):", err);
    }
  }
  
/* ===========================
   GIVING / STRIPE ANALYTICS
   =========================== */
async function loadGivingAnalytics() {
  const canvas = document.getElementById("givingChart");
  if (!canvas) return;

  try {
    const res = await fetch("/api/stripe/analytics", {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Stripe analytics request failed");

    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Stripe error");

    const {
      totalRevenue,
      recurringRevenue,
      monthlyLabels,
      monthlyTotals,
      dailyLabels,
      dailyTotals,
    } = data;

    // Top metrics
    safeSetCurrency("statTotalGiven", totalRevenue);
    safeSetCurrency("statRecurring", recurringRevenue);

    const latestMonthly =
      Array.isArray(monthlyTotals) && monthlyTotals.length
        ? monthlyTotals[monthlyTotals.length - 1]
        : 0;
    safeSetCurrency("metricMonthlyGiving", latestMonthly);

    // Pick mode
    let labels = [];
    let values = [];

    if (givingMode === "daily" && dailyLabels && dailyTotals) {
      labels = dailyLabels;
      values = dailyTotals;
    } else {
      labels = monthlyLabels || [];
      values = monthlyTotals || [];
    }

    const ctx = canvas.getContext("2d");
    if (givingChart) givingChart.destroy();

    givingChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: givingMode === "daily" ? "Daily Giving" : "Monthly Giving",
            data: values,
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => formatCurrency(v),
            },
          },
        },
      },
    });
  } catch (err) {
    console.error("Error loading giving analytics:", err);
  }
}

/* ===========================
   EMAIL + MEMBER ANALYTICS
   =========================== */
async function loadEmailAnalytics() {
  const canvas = document.getElementById("growthChart");
  if (!canvas) return;

  try {
    const res = await fetch("/api/admin/email-analytics", {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Email analytics request failed");

    const data = await res.json();
    if (!data.success)
      throw new Error(data.error || "Email analytics error");

    const analytics = data.analytics || {};
    const totals = analytics.totals || {};
    const growth = analytics.growth || {};

    safeSetNumber("metricEmailSignups", totals.emailSignups);
    safeSetNumber("metricMembersCount", totals.members);
    safeSetNumber("metricForumWaitlist", totals.forumWaitlist || 0);


    const labels = (growth.byMonth || []).map((m) => m.label);
    const values = (growth.byMonth || []).map((m) => m.count);

    const ctx = canvas.getContext("2d");
    if (growthChart) growthChart.destroy();

    growthChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Email signups",
            data: values,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  } catch (err) {
    console.error("Error loading email analytics:", err);
  }
}

/* ===========================
   PEOPLE GROWTH TIMELINE
   /api/admin/people-analytics
   returns: { success, labels, values }
   =========================== */
async function loadPeopleAnalytics() {
  const canvas = document.getElementById("peopleChart");
  if (!canvas) return;

  try {
    const res = await fetch("/api/admin/people-analytics", {
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success)
      throw new Error(data.error || "People analytics error");

    const labels = data.labels || [];
    const values = data.values || [];

    const ctx = canvas.getContext("2d");
    if (peopleChart) peopleChart.destroy();

    peopleChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "New members",
            data: values,
            tension: 0.3,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  } catch (err) {
    console.error("Error loading people analytics:", err);
  }
}

/* ===========================
   PODCAST ANALYTICS
   /api/admin/podcast-analytics
   returns: { success, totalEpisodes, published, drafts, labels, values, episodes }
   =========================== */
async function loadPodcastAnalytics() {
  const canvas = document.getElementById("podcastChart");
  if (!canvas) return;

  try {
    const res = await fetch("/api/admin/podcast-analytics", {
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success)
      throw new Error(data.error || "Podcast analytics error");

    safeSetNumber("podcastTotalEpisodes", data.totalEpisodes);
    safeSetNumber("podcastPublished", data.published);
    safeSetNumber("podcastDrafts", data.drafts);

    const labels = data.labels || [];
    const values = data.values || [];

    const ctx = canvas.getContext("2d");
    if (podcastChart) podcastChart.destroy();

    podcastChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Episodes published",
            data: values,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  } catch (err) {
    console.error("Error loading podcast analytics:", err);
  }
}

/* ===========================
   TRAFFIC ANALYTICS
   /api/admin/traffic/timeline
   /api/admin/traffic/pages
   /api/admin/traffic/sources
   =========================== */
async function loadTrafficAnalytics() {
  const trafficCanvas = document.getElementById("trafficChart");
  const pagesBody = document.getElementById("trafficPagesBody");
  const sourcesBody = document.getElementById("trafficSourcesBody");

  try {
    const [timelineRes, pagesRes, sourcesRes] = await Promise.all([
      fetch("/api/admin/traffic/timeline", { credentials: "include" }),
      fetch("/api/admin/traffic/pages", { credentials: "include" }),
      fetch("/api/admin/traffic/sources", { credentials: "include" }),
    ]);

    const timelineData = await timelineRes.json();
    const pagesData = await pagesRes.json();
    const sourcesData = await sourcesRes.json();

    // Timeline chart
    if (trafficCanvas && timelineData.success) {
      const labels = timelineData.labels || [];
      const values = timelineData.values || [];

      const ctx = trafficCanvas.getContext("2d");
      if (trafficChart) trafficChart.destroy();

      trafficChart = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Page views",
              data: values,
              tension: 0.3,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
          },
          scales: {
            y: { beginAtZero: true },
          },
        },
      });
    }

    // Top pages table
    if (pagesBody) {
      if (!pagesData.success || !pagesData.pages || !pagesData.pages.length) {
        pagesBody.innerHTML = `<tr><td colspan="2">No data yet.</td></tr>`;
      } else {
        pagesBody.innerHTML = "";
        pagesData.pages.forEach((p) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${escapeHtml(p.path || "/")}</td>
            <td>${Number(p.views || 0).toLocaleString("en-US")}</td>
          `;
          pagesBody.appendChild(tr);
        });
      }
    }

    // Top referrers table
    if (sourcesBody) {
      if (
        !sourcesData.success ||
        !sourcesData.sources ||
        !sourcesData.sources.length
      ) {
        sourcesBody.innerHTML = `<tr><td colspan="2">No data yet.</td></tr>`;
      } else {
        sourcesBody.innerHTML = "";
        sourcesData.sources.forEach((s) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${escapeHtml(s.referrer || "(direct)")}</td>
            <td>${Number(s.hits || 0).toLocaleString("en-US")}</td>
          `;
          sourcesBody.appendChild(tr);
        });
      }
    }
  } catch (err) {
    console.error("Error loading traffic analytics:", err);
    if (pagesBody) {
      pagesBody.innerHTML = `<tr><td colspan="2">Error loading data.</td></tr>`;
    }
    if (sourcesBody) {
      sourcesBody.innerHTML = `<tr><td colspan="2">Error loading data.</td></tr>`;
    }
  }
}

/* ===========================
   BADGE ANALYTICS
   /api/admin/badge-analytics
   returns:
   {
     success,
     totals: { totalBadges, activeTypes, topBadgeName },
     distribution: { labels, values },
     topMembers: [ { name, total } ]
   }
=========================== */
async function loadBadgeAnalytics() {
    try {
      const res = await fetch("/api/admin/badge-analytics", {
        credentials: "include",
      });
      const data = await res.json();
  
      if (typeof data.forum_waitlist === "number") {
      const el = document.getElementById("metricForumWaitlist");
      if (el) el.textContent = data.forum_waitlist;
    }

      if (!data.success) return;
  
      const { totals, distribution, topMembers } = data;
  
      // Top metrics
      safeSetNumber("metricTotalBadges", totals.totalBadges);
      safeSetNumber("metricActiveBadgeTypes", totals.activeTypes);
      document.getElementById("metricTopBadge").textContent =
        totals.topBadgeName || "–";
  
      // Distribution pie chart
      const canvas = document.getElementById("badgeDistributionChart");
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (window.badgeDistributionChart) window.badgeDistributionChart.destroy();
  
        window.badgeDistributionChart = new Chart(ctx, {
          type: "pie",
          data: {
            labels: distribution.labels,
            datasets: [{ data: distribution.values }],
          },
        });
      }
  
      // Top members table
      const table = document.getElementById("badgeTopMembersTable");
      if (table) {
        table.innerHTML = topMembers
          .map(
            (m) => `
          <tr>
            <td>${escapeHtml(m.name)}</td>
            <td>${m.total}</td>
          </tr>
        `
          )
          .join("");
      }
    } catch (err) {
      console.error("Error loading badge analytics:", err);
    }
  }
  

/* ===========================
   HELPERS
   =========================== */

function safeSetNumber(id, value) {
  const el = document.getElementById(id);
  if (!el || value == null) return;
  el.textContent = Number(value).toLocaleString("en-US");
}

function safeSetCurrency(id, value) {
  const el = document.getElementById(id);
  if (!el || value == null) return;
  el.textContent = formatCurrency(value);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/*********************************************
 *  ADMIN DASHBOARD – LIVE DATA VERSION
 *  Replaces all sample / placeholder data
 *********************************************/

requireAuth(["owner", "admin"]);


(async function enforceAdminAccess() {
  try {
    const res = await fetch("/api/members/auth/me", {
      credentials: "include",
    });

    const data = await res.json();

    if (!data.loggedIn) throw new Error("Not logged in");

    const role = data.member?.role;
    if (!["admin", "master"].includes(role)) {
      throw new Error("Not admin");
    }

    // Optional global exposure
    window.hcAdmin = data.member;
  } catch (err) {
    console.warn("Admin access denied:", err);
    window.location.href = "/login.html";
  }
})();


// SET ADMIN NAME + ROLE
document.getElementById("adminName").textContent =
  localStorage.getItem("adminName") || localStorage.getItem("adminEmail") || "Admin";

document.getElementById("adminRole").textContent =
  (localStorage.getItem("adminRole") || "admin").replace("-", " ").toUpperCase();

  let rsvpChart = null;

  (async () => {
  const res = await fetch("/api/members/auth/me", { credentials: "include" });
  const data = await res.json();

  const role = data?.member?.role;
  if (!data.loggedIn || !["admin", "master"].includes(role)) {
    location.href = "/login.html";
  }
})();


/*********************************************
 *  1. STRIPE ANALYTICS (Backend → Dashboard)
 *********************************************/
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

/*********************************************
 *  RSVP ANALYTICS – TOTAL + THIS WEEK CHART
 *********************************************/
async function loadRsvpAnalytics() {
  const canvas = document.getElementById("rsvpChart");
  if (!canvas) return;

  try {
    const res = await fetch("/api/admin/rsvp-analytics", {
      credentials: "include",
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || "RSVP analytics error");
    }

    const { totalRsvps, labels, values } = data;

    // Update "Total RSVPs" stat card
    const totalEl = document.getElementById("statRSVPs");
    if (totalEl) {
      totalEl.textContent = Number(totalRsvps || 0).toLocaleString("en-US");
    }

    const ctx = canvas.getContext("2d");
    if (rsvpChart) rsvpChart.destroy();

    rsvpChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels || [],
        datasets: [
          {
            label: "RSVPs",
            data: values || [],
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
          },
        },
      },
    });
  } catch (err) {
    console.error("Error loading RSVP analytics:", err);
  }
}




/*********************************************
 *  2. LOAD WEEK EVENTS (OPTIONAL)
 *********************************************/

async function loadWeekEvents() {
  const list = document.getElementById("weekEvents");
  list.innerHTML = `
    <li class="placeholder">Auto-load this from your events system later</li>
  `;
}

/*********************************************
 *  3. LOAD STAFF TASKS (You can customize)
 *********************************************/

async function loadTasks() {
  const list = document.getElementById("taskList");
  list.innerHTML = `
    <li><div class="list-main">
      <span class="list-title">Setup Stripe campaigns</span>
      <span class="list-meta">Due: Today</span>
    </div></li>
    <li><div class="list-main">
      <span class="list-title">Check donor follow-ups</span>
      <span class="list-meta">Due: Tomorrow</span>
    </div></li>
  `;
}

/*********************************************
 *  4. NOTIFICATIONS PANEL (Merged system)
 *********************************************/

const PEOPLE_API_URL = "https://script.google.com/macros/s/YOUR_PEOPLE_SCRIPT_ID/exec";
const RSVP_API_URL = "https://script.google.com/macros/s/YOUR_RSVP_SCRIPT_ID/exec";
const DONATION_API_URL = "https://script.google.com/macros/s/YOUR_DONATIONS_SCRIPT_ID/exec";

const notificationsList = document.getElementById("notificationsList");
const noNotifications = document.getElementById("noNotifications");

async function loadNotificationsFull() {
  const notifications = [];

  /* 1. Overdue Follow-Ups */
  try {
    const res = await fetch(PEOPLE_API_URL + "?action=followups");
    const data = await res.json();
    (data.followups || []).forEach(p => {
      notifications.push({
        type: "followup",
        icon: "fa-phone",
        text: `${p.name} needs a follow-up (${p.followStage}).`
      });
    });
  } catch (err) {
    console.error("Follow-ups error:", err);
  }

  /* 2. New RSVPs */
  try {
    const res = await fetch(RSVP_API_URL + "?action=new");
    const data = await res.json();
    (data.newRSVPs || []).forEach(r => {
      notifications.push({
        type: "rsvp",
        icon: "fa-calendar-check",
        text: `${r.name} RSVP’d to ${r.eventTitle}.`
      });
    });
  } catch (err) {
    console.error("RSVP error:", err);
  }

  /* 3. New Donations */
  try {
    const res = await fetch(DONATION_API_URL + "?action=new");
    const data = await res.json();
    (data.newDonations || []).forEach(d => {
      notifications.push({
        type: "donation",
        icon: "fa-hand-holding-dollar",
        text: `${d.name} donated $${d.amount}.`
      });
    });
  } catch (err) {
    console.error("Donation error:", err);
  }

  /* Render */
  notificationsList.innerHTML = "";

  if (notifications.length === 0) {
    noNotifications.classList.remove("hidden");
    return;
  }

  notifications.forEach(n => {
    const div = document.createElement("div");
    div.className = `notification-card notification-${n.type}`;
    div.innerHTML = `
      <i class="fa-solid ${n.icon}"></i>
      <p>${n.text}</p>
    `;
    notificationsList.appendChild(div);
  });
}

/*********************************************
 *  5. INIT (STARTUP)
 *********************************************/

loadStripeAnalytics();       // <— NEW
loadWeekEvents();
loadTasks();
loadNotificationsFull();
loadRsvpAnalytics();   
setInterval(loadNotificationsFull, 30000); // auto-refresh notifications

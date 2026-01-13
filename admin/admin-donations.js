requireAuth(["owner", "admin"]);

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

document.getElementById("adminName").textContent =
  localStorage.getItem("adminName") || localStorage.getItem("adminEmail");

const DONATIONS_API_URL = "https://script.google.com/macros/s/AKfycbyL-APnNTb8cqjCRX8wsKppfOTImGOFrpHM4Luj9eIXJX-GsJFXCiStkph-6szE-cxP/exec"; // same as before

const donationsCountEl = document.getElementById("donationsCount");
const donationsTotalEl = document.getElementById("donationsTotal");
const donationsAvgEl = document.getElementById("donationsAvg");
const donationsTableBody = document.querySelector("#donationsTable tbody");
const donationsEmpty = document.getElementById("donationsEmpty");
const donationSearch = document.getElementById("donationSearch");

let donations = [];
let givingOverTimeChart;
let fundBreakdownChart;

function formatMoney(amount) {
  return "$" + (amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadDonations() {
  try {
    const res = await fetch(DONATIONS_API_URL + "?action=donations");
    const data = await res.json();

    donations = data.donations || [];
    const totalAmount = data.totalAmount || 0;
    const count = data.count || donations.length;

    donationsCountEl.textContent = count;
    donationsTotalEl.textContent = formatMoney(totalAmount);
    donationsAvgEl.textContent = count > 0 ? formatMoney(totalAmount / count) : "$0.00";

    renderDonations(donations);
    renderGivingOverTime(donations);
    renderFundBreakdown(donations);

  } catch (err) {
    console.error("Error loading donations:", err);
    donationsEmpty.textContent = "Error loading donations.";
    donationsEmpty.classList.remove("hidden");
  }
}

function renderDonations(list) {
  donationsTableBody.innerHTML = "";

  if (!list || list.length === 0) {
    donationsEmpty.classList.remove("hidden");
    return;
  } else {
    donationsEmpty.classList.add("hidden");
  }

  list.forEach(d => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.date}</td>
      <td>${d.name}</td>
      <td><a href="admin-people-profile.html?email=${d.email}">${d.email}</a></td>

      <td>${formatMoney(d.amount)}</td>
      <td>${d.fund}</td>
      <td>${d.type}</td>
      <td>${d.txId}</td>
    `;
    donationsTableBody.appendChild(tr);
  });
}

function applyDonationSearch() {
  const q = (donationSearch.value || "").toLowerCase();
  const filtered = donations.filter(d =>
    (d.name || "").toLowerCase().includes(q) ||
    (d.email || "").toLowerCase().includes(q) ||
    (d.fund || "").toLowerCase().includes(q)
  );
  renderDonations(filtered);
}

donationSearch.addEventListener("input", applyDonationSearch);

// Charts
function renderGivingOverTime(list) {
  const byDate = {};
  list.forEach(d => {
    const key = d.date.split(" ")[0]; // "MMM d, yyyy"
    if (!byDate[key]) byDate[key] = 0;
    byDate[key] += d.amount;
  });

  const labels = Object.keys(byDate);
  const data = labels.map(k => byDate[k]);

  const ctx = document.getElementById("givingOverTimeChart");
  if (givingOverTimeChart) givingOverTimeChart.destroy();

  givingOverTimeChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Total Given",
        data,
        borderColor: "#002e6b",
        backgroundColor: "rgba(0,46,107,0.1)",
        tension: 0.3
      }]
    },
    options: {
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          ticks: {
            callback: (value) => "$" + value
          }
        }
      }
    }
  });
}

function renderFundBreakdown(list) {
  const byFund = {};
  list.forEach(d => {
    if (!d.fund) return;
    if (!byFund[d.fund]) byFund[d.fund] = 0;
    byFund[d.fund] += d.amount;
  });

  const labels = Object.keys(byFund);
  const data = labels.map(k => byFund[k]);

  const ctx = document.getElementById("fundBreakdownChart");
  if (fundBreakdownChart) fundBreakdownChart.destroy();

  fundBreakdownChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ["#002e6b", "#bf9745", "#bff1ff", "#f0e990", "#89ddf4"]
      }]
    },
    options: {
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });
}

loadDonations();

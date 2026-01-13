// FILE: admin-donors.js

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

const API_BASE = "http://localhost:4000/api";

const donorsTableBody = document.getElementById("donorsTableBody");
const donorSearchInput = document.getElementById("donorSearch");

const totalDonorsEl = document.getElementById("totalDonors");
const totalDonationsEl = document.getElementById("totalDonations");
const totalAmountEl = document.getElementById("totalAmount");
const last30AmountEl = document.getElementById("last30Amount");

const donorDetailEmpty = document.getElementById("donorDetailEmpty");
const donorDetail = document.getElementById("donorDetail");
const donorDetailName = document.getElementById("donorDetailName");
const donorDetailEmail = document.getElementById("donorDetailEmail");
const donorDetailSummary = document.getElementById("donorDetailSummary");
const donorDonationList = document.getElementById("donorDonationList");

let donors = [];

function formatMoney(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString();
}

async function fetchSummary() {
  const res = await fetch(`${API_BASE}/donations/summary`, {
    credentials: "include",
  });
  if (!res.ok) return;

  const data = await res.json();
  totalDonorsEl.textContent = data.total_donors ?? 0;
  totalDonationsEl.textContent = data.total_donations ?? 0;
  totalAmountEl.textContent = formatMoney(data.total_amount_cents || 0);
  last30AmountEl.textContent = formatMoney(data.last30_amount_cents || 0);
}

async function fetchDonors() {
  const res = await fetch(`${API_BASE}/donors`, {
    credentials: "include",
  });
  if (!res.ok) return;
  donors = await res.json();
  renderDonorsTable();
}

function renderDonorsTable(filterText = "") {
  donorsTableBody.innerHTML = "";

  const ft = filterText.toLowerCase().trim();

  const filtered = donors.filter((d) => {
    if (!ft) return true;
    const name = (d.name || "").toLowerCase();
    const email = (d.email || "").toLowerCase();
    return name.includes(ft) || email.includes(ft);
  });

  filtered.forEach((d) => {
    const tr = document.createElement("tr");
    tr.classList.add("donors-row");
    tr.dataset.id = d.id;

    const lastGift = d.last_donation_at ? formatDate(d.last_donation_at) : "—";

    tr.innerHTML = `
      <td>${d.name || "(Unknown)"}</td>
      <td>${d.email || ""}</td>
      <td>${d.donation_count || 0}</td>
      <td>${formatMoney(d.total_amount_cents || 0)}</td>
      <td>${lastGift}</td>
    `;

    tr.addEventListener("click", () => {
      selectDonor(d.id);
    });

    donorsTableBody.appendChild(tr);
  });
}

async function selectDonor(donorId) {
  donorDetailEmpty.classList.add("hidden");
  donorDetail.classList.remove("hidden");

  // Get donor summary
  const res = await fetch(`${API_BASE}/donors/${donorId}`, {
    credentials: "include",
  });
  if (!res.ok) return;
  const data = await res.json();

  donorDetailName.textContent = data.donor.name || "(Unknown)";
  donorDetailEmail.textContent = data.donor.email || "";
  const total = formatMoney(data.summary.total_amount_cents || 0);
  const count = data.summary.donation_count || 0;
  const last = formatDate(data.summary.last_donation_at);
  donorDetailSummary.textContent = `${count} gifts • ${total} total • Last gift: ${last}`;

  // Get donor donations list
  const res2 = await fetch(`${API_BASE}/donors/${donorId}/donations`, {
    credentials: "include",
  });
  if (!res2.ok) return;

  const history = await res2.json();
  donorDonationList.innerHTML = "";

  if (history.length === 0) {
    donorDonationList.innerHTML =
      "<li>No donations recorded for this donor yet.</li>";
    return;
  }

  history.forEach((donation) => {
    const li = document.createElement("li");

    li.innerHTML = `
      <div class="donation-amount">${formatMoney(
        donation.amount_cents || 0
      )}</div>
      <div class="donation-meta">
        ${formatDate(donation.created_at)} • ${
      donation.frequency === "monthly" ? "Monthly" : "One-time"
    } • Status: ${donation.status || "unknown"}
        ${
          donation.fund
            ? `<br><strong>Fund:</strong> ${donation.fund}`
            : ""
        }
        ${
          donation.note
            ? `<br><strong>Note:</strong> ${donation.note}`
            : ""
        }
      </div>
    `;

    donorDonationList.appendChild(li);
  });
}

// Search
donorSearchInput.addEventListener("input", (e) => {
  renderDonorsTable(e.target.value);
});

// Init
(async function init() {
  await Promise.all([fetchSummary(), fetchDonors()]);
})();

// Only owner/admin
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

const DONATIONS_API_URL = "https://script.google.com/macros/s/AKfycbyL-APnNTb8cqjCRX8wsKppfOTImGOFrpHM4Luj9eIXJX-GsJFXCiStkph-6szE-cxP/exec";

// Get email from URL
const params = new URLSearchParams(window.location.search);
const donorEmail = params.get("email");

const donorNameEl        = document.getElementById("donorName");
const donorEmailEl       = document.getElementById("donorEmail");
const donorEmailLink     = document.getElementById("donorEmailLink");
const donorTotalEl       = document.getElementById("donorTotal");
const donorCountEl       = document.getElementById("donorCount");
const donorFirstGiftEl   = document.getElementById("donorFirstGift");
const donorLastGiftEl    = document.getElementById("donorLastGift");
const donorCampaignsEl   = document.getElementById("donorCampaigns");

const yearSelect         = document.getElementById("yearSelect");
const yearTotalText      = document.getElementById("yearTotalText");

const historyTableBody   = document.querySelector("#donorHistoryTable tbody");
const historyEmpty       = document.getElementById("historyEmpty");

const backToDonorsBtn    = document.getElementById("backToDonors");

function fmtCurrency(x) {
  return "$" + Number(x || 0).toLocaleString(undefined, {minimumFractionDigits: 0});
}
function fmtDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

// Load core donor history
async function loadDonor() {
  if (!donorEmail) {
    donorNameEl.textContent = "No donor selected";
    return;
  }

  donorEmailEl.textContent = donorEmail;
  donorEmailLink.href = "mailto:" + donorEmail;

  try {
    const res = await fetch(DONATIONS_API_URL + "?action=donor&email=" + encodeURIComponent(donorEmail));
    const data = await res.json();

    const donations = data.donations || [];
    const total = Number(data.total || 0);

    if (donations.length === 0) {
      donorNameEl.textContent = "(No name)";
      donorTotalEl.textContent = fmtCurrency(0);
      donorCountEl.textContent = "0";
      historyEmpty.classList.remove("hidden");
      return;
    }

    // Basic info
    donorNameEl.textContent = donations[0].name || "(No name)";
    donorTotalEl.textContent = fmtCurrency(total);
    donorCountEl.textContent = donations.length;

    // First & last gifts
    const sorted = donations
      .map(d => ({...d, dObj: new Date(d.date)}))
      .sort((a, b) => a.dObj - b.dObj);

    const first = sorted[0];
    const last  = sorted[sorted.length - 1];

    donorFirstGiftEl.textContent = `${fmtCurrency(first.amount)} on ${fmtDate(first.date)}`;
    donorLastGiftEl.textContent  = `${fmtCurrency(last.amount)} on ${fmtDate(last.date)}`;

    // Campaigns
    const campaigns = new Set();
    donations.forEach(d => campaigns.add(d.campaign || "General"));
    donorCampaignsEl.textContent = Array.from(campaigns).join(", ");

    // Year select options
    const years = new Set();
    donations.forEach(d => years.add(new Date(d.date).getFullYear()));
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    yearSelect.innerHTML = "";
    sortedYears.forEach(y => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    });
    if (sortedYears.length > 0) {
      loadYearSummary(sortedYears[0]); // auto-load latest year
    }

    // Render history table
    renderHistory(donations);

  } catch (err) {
    console.error("Error loading donor:", err);
    donorNameEl.textContent = "Error loading donor";
  }
}

function renderHistory(donations) {
  historyTableBody.innerHTML = "";

  if (!donations || donations.length === 0) {
    historyEmpty.classList.remove("hidden");
    return;
  } else {
    historyEmpty.classList.add("hidden");
  }

  donations
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach(d => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${fmtDate(d.date)}</td>
        <td>${fmtCurrency(d.amount)}</td>
        <td>${d.campaign || "General"}</td>
        <td>${d.source || ""}</td>
      `;
      historyTableBody.appendChild(tr);
    });
}

// Yearly summary
async function loadYearSummary(year) {
  try {
    const res = await fetch(
      DONATIONS_API_URL +
      "?action=yearlySummary&email=" +
      encodeURIComponent(donorEmail) +
      "&year=" + encodeURIComponent(year)
    );
    const data = await res.json();

    const total = Number(data.total || 0);
    yearTotalText.textContent =
      `In ${year}, this donor gave ${fmtCurrency(total)} across ${ (data.donations || []).length } gifts.`;

  } catch (err) {
    console.error("Error loading yearly summary:", err);
    yearTotalText.textContent = "Error loading yearly summary.";
  }
}

// Events
yearSelect.addEventListener("change", () => {
  const year = yearSelect.value;
  if (year) loadYearSummary(year);
});

backToDonorsBtn.addEventListener("click", () => {
  window.location.href = "admin-donors.html";
});

// Init
loadDonor();

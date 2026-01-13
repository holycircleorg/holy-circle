document.addEventListener("DOMContentLoaded", loadGivingHistory);

let allDonations = [];

async function loadGivingHistory() {
  if (!window.MemberAnalytics) return;

  const data = await window.MemberAnalytics.fetch();
  if (!data) return;

  allDonations = data.donations.map(d => ({
    amount: d.amount_dollars,
    date: d.created_at,
    fund: d.fund,
    receipt_url: d.receipt_url
  }));


  populateYearFilter();
  renderDonations();
  updateTaxSummary();
  setupControls();
}


/* =============================
   FILTERS + SORT + SEARCH
============================= */

function setupControls() {
  document.getElementById("yearFilter").addEventListener("change", () => {
    renderDonations();
    updateTaxSummary();
  });

  document.getElementById("sortFilter").addEventListener("change", renderDonations);

  document.getElementById("givingSearch").addEventListener("input", renderDonations);

  document.getElementById("downloadYearPdf").addEventListener("click", generateYearlyPDF);
}

function populateYearFilter() {
  const yearSelect = document.getElementById("yearFilter");
  const years = [...new Set(allDonations.map(d => new Date(d.date).getFullYear()))]
    .sort((a, b) => b - a);

  years.forEach(y => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  });
}

function getFilteredDonations() {
  const yearFilter = document.getElementById("yearFilter").value;
  const sortFilter = document.getElementById("sortFilter").value;
  const searchVal = document.getElementById("givingSearch").value.toLowerCase();

  let filtered = [...allDonations];

  // Filter by year
  if (yearFilter !== "all") {
    filtered = filtered.filter(d => new Date(d.date).getFullYear() == yearFilter);
  }

  // Search filter
  filtered = filtered.filter(d =>
    d.amount.toString().includes(searchVal) ||
    new Date(d.date).toLocaleDateString().includes(searchVal)
  );

  // Sorting
  filtered.sort((a, b) =>
    sortFilter === "newest"
      ? new Date(b.date) - new Date(a.date)
      : new Date(a.date) - new Date(b.date)
  );

  return filtered;
}

/* =============================
   RENDER DONATIONS
============================= */

function renderDonations() {
  const list = document.getElementById("donationList");
  list.innerHTML = "";

  const items = getFilteredDonations();

  if (items.length === 0) {
    list.innerHTML = `<li>No donations found.</li>`;
    return;
  }

  items.forEach(d => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>$${d.amount.toFixed(2)}</strong><br>
        <small>${new Date(d.date).toLocaleDateString()}</small>
      </div>
      <a href="${d.receipt_url}" class="gold-btn" target="_blank">Receipt</a>
    `;
    list.appendChild(li);
  });
}



/* =============================
   TAX SUMMARY + PDF EXPORT
============================= */

function updateTaxSummary() {
  const year = document.getElementById("yearFilter").value;
  const summaryYear = document.getElementById("summaryYear");
  const summaryTotal = document.getElementById("summaryTotal");

  const filtered = getFilteredDonations();

  const total = filtered.reduce((sum, d) => sum + d.amount, 0);

  summaryYear.textContent = year === "all" ? "All Years" : year;
  summaryTotal.textContent = total.toFixed(2);
}

function generateYearlyPDF() {
  const year = document.getElementById("yearFilter").value;
  
  // If your backend later supports PDF generation:
  // window.location.href = `/api/members/giving-history/pdf?year=${year}`;

  alert("PDF generation coming soon — frontend button is ready!");
}

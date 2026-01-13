/*************************************************
 * Holy Circle Admin - People Management
 *************************************************/
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

// Globals
let people = [];
let currentPersonId = null;

/*************************************************
 * Load Initial Data
 *************************************************/
document.addEventListener("DOMContentLoaded", () => {
  loadAdminName();
  loadPeople();
  setupEventListeners();
});

/*************************************************
 * Load Admin Name (from cookie)
 *************************************************/
function loadAdminName() {
  const nameEl = document.getElementById("adminName");
  // Optional: update via backend auth
  nameEl.textContent = localStorage.getItem("adminName") || "Admin";
}

/*************************************************
 * Fetch People List
 *************************************************/
async function loadPeople() {
  try {
    const res = await fetch("/api/people", { credentials: "include" });
    if (!res.ok) throw new Error("Failed loading people.");

    people = await res.json();
    renderPeopleTable();

  } catch (err) {
    console.error("Error loading people:", err);
  }
}

/*************************************************
 * Render People Table
 *************************************************/
function renderPeopleTable() {
  const tbody = document.querySelector("#peopleTable tbody");
  const emptyState = document.getElementById("peopleEmptyState");

  tbody.innerHTML = "";

  if (people.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  people.forEach((p) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${p.name || ""}</td>
      <td>${p.email || ""}</td>
      <td>${p.phone || ""}</td>
      <td>${p.status || ""}</td>
      <td>${p.tags || ""}</td>
      <td>${p.last_activity || "—"}</td>
      <td>
        <button class="secondary-btn" onclick="openPersonDetail(${p.id})">
          View
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

/*************************************************
 * Open Person Detail Panel
 *************************************************/
async function openPersonDetail(id) {
  currentPersonId = id;

  // Hide form, show detail panel
  document.getElementById("personFormPanel").classList.add("hidden");
  document.getElementById("personDetailPanel").classList.remove("hidden");

  await loadPersonDetail(id);
  loadDonationHistory(id); // ⭐ Load Donation Tab
}

/*************************************************
 * Load Person Detail
 *************************************************/
async function loadPersonDetail(id) {
  try {
    const res = await fetch(`/api/people/${id}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to load person.");

    const person = await res.json();
    document.getElementById("detailPersonName").textContent = person.name;

    // Fill PROFILE TAB
    document.getElementById("tab-profile").innerHTML = `
      <p><strong>Email:</strong> ${person.email || ""}</p>
      <p><strong>Phone:</strong> ${person.phone || ""}</p>
      <p><strong>Status:</strong> ${person.status || ""}</p>
      <p><strong>Tags:</strong> ${person.tags || ""}</p>
      <p><strong>Notes:</strong><br>${person.notes || ""}</p>
    `;

    // ACTIVITY TAB (you can add events later)
    document.getElementById("tab-activity").innerHTML = `
      <p>No activity tracked yet.</p>
    `;

    // NOTES TAB
    document.getElementById("tab-notes").innerHTML = `
      <textarea class="notes-textarea">${person.notes || ""}</textarea>
    `;

  } catch (err) {
    console.error(err);
  }
}

/*************************************************
 * TAB SWITCHING
 *************************************************/
function setupEventListeners() {
  const tabButtons = document.querySelectorAll(".tab-btn");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });

  // Link donor to person
  const linkBtn = document.getElementById("linkDonorBtn");
  if (linkBtn) {
    linkBtn.addEventListener("click", linkDonorToPerson);
  }

  // New person button (optional)
  document.getElementById("newPersonBtn").addEventListener("click", () => {
    openPersonForm();
  });
}

function switchTab(tabName) {
  const contentBoxes = document.querySelectorAll(".tab-content");

  contentBoxes.forEach((box) => {
    box.classList.add("hidden");
  });

  document.getElementById(`tab-${tabName}`).classList.remove("hidden");

  // If donation tab was clicked, reload donation history
  if (tabName === "donations" && currentPersonId) {
    loadDonationHistory(currentPersonId);
  }
}

/*************************************************
 * LOAD DONATION HISTORY (PHASE 4)
 *************************************************/
async function loadDonationHistory(personId) {
  const summaryEl = document.getElementById("donationSummary");
  const listEl = document.getElementById("donationList");

  try {
    const res = await fetch(`/api/people/${personId}/donations`, {
      credentials: "include",
    });

    if (!res.ok) {
      summaryEl.textContent = "No donation data available.";
      listEl.innerHTML = "";
      return;
    }

    const donations = await res.json();

    if (donations.length === 0) {
      summaryEl.textContent = "This person has not given any donations yet.";
      listEl.innerHTML = "";
      return;
    }

    // Summary
    const total = donations.reduce((s, d) => s + d.amount_cents, 0);
    const last = donations[0].created_at
      ? new Date(donations[0].created_at).toLocaleDateString()
      : "—";

    summaryEl.textContent = `${donations.length} gifts • $${(total / 100).toFixed(
      2
    )} total • Last gift: ${last}`;

    // Timeline List
    listEl.innerHTML = donations
      .map(
        (d) => `
        <li>
          <div class="donation-amount">$${(d.amount_cents / 100).toFixed(2)}</div>
          <div class="donation-meta">
            ${new Date(d.created_at).toLocaleDateString()} • ${
          d.frequency === "monthly" ? "Monthly" : "One-time"
        }
            ${d.fund ? `<br><strong>Fund:</strong> ${d.fund}` : ""}
            ${d.note ? `<br><strong>Note:</strong> ${d.note}` : ""}
          </div>
        </li>
      `
      )
      .join("");

  } catch (err) {
    console.error("Donation load error:", err);
  }
}

/*************************************************
 * LINK DONOR → PERSON
 *************************************************/
async function linkDonorToPerson() {
  const email = document.getElementById("linkDonorEmail").value.trim();
  if (!email) return alert("Enter a donor email.");

  try {
    const res = await fetch(`/api/people/${currentPersonId}/link-donor`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Unable to link donor.");
      return;
    }

    alert("Donor linked successfully!");
    loadDonationHistory(currentPersonId);

  } catch (err) {
    console.error(err);
    alert("An error occurred linking donor.");
  }
}

/*************************************************
 * SHOW ADD PERSON FORM
 *************************************************/
function openPersonForm() {
  document.getElementById("personDetailPanel").classList.add("hidden");
  document.getElementById("personFormPanel").classList.remove("hidden");

  document.getElementById("personFormTitle").textContent = "Add Person";

  // Clear fields
  document.getElementById("personId").value = "";
  document.getElementById("personName").value = "";
  document.getElementById("personEmail").value = "";
  document.getElementById("personPhone").value = "";
  document.getElementById("personStatus").value = "Visitor";
  document.getElementById("personTags").value = "";
  document.getElementById("personNotes").value = "";
}

/*************************************************
 * LOGOUT
 *************************************************/
function logoutAdmin() {
  fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(
    () => {
      window.location.href = "admin-login.html";
    }
  );
}

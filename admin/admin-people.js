/**************************************************
 * HOLY CIRCLE — ADMIN PEOPLE PAGE (SAFE VERSION)
 * Fixed so the page ALWAYS opens and JS NEVER breaks
 **************************************************/

console.log("admin-people.js loaded");
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

/**************************************************
 * GLOBAL STATE
 **************************************************/
let PEOPLE = [];
let CURRENT_PERSON = null;


/**************************************************
 * LOAD INITIAL DATA
 **************************************************/
document.addEventListener("DOMContentLoaded", () => {
  loadPeople();
  setupEvents();
});


/**************************************************
 * FETCH PEOPLE LIST
 **************************************************/
async function loadPeople() {
  try {
    const res = await fetch("/api/people");
    if (!res.ok) throw new Error("Failed to load people");

    PEOPLE = await res.json();
    renderPeopleTable();
  } catch (err) {
    console.error("PEOPLE LOAD ERROR:", err);
    document.getElementById("peopleTableBody").innerHTML = `
      <tr><td colspan="5">Failed to load people.</td></tr>
    `;
  }
}


/**************************************************
 * RENDER PEOPLE TABLE
 **************************************************/
function renderPeopleTable() {
  const tbody = document.getElementById("peopleTableBody");
  tbody.innerHTML = "";

  if (!PEOPLE.length) {
    tbody.innerHTML = `
      <tr><td colspan="5">No people found.</td></tr>
    `;
    return;
  }

  PEOPLE.forEach(person => {
    const tr = document.createElement("tr");
    tr.classList.add("people-row");
    tr.dataset.id = person.id;

    tr.innerHTML = `
      <td>${person.name || ""}</td>
      <td>${person.email || ""}</td>
      <td>${person.status || ""}</td>
      <td>${person.membership_status || ""}</td>
      <td>${person.tags || ""}</td>
    `;

    tr.addEventListener("click", () => openPersonDetail(person.id));

    tbody.appendChild(tr);
  });
}


/**************************************************
 * OPEN PERSON DETAIL PANEL
 **************************************************/
async function openPersonDetail(id) {
  CURRENT_PERSON = id;

  document.getElementById("personDetailEmpty").classList.add("hidden");
  document.getElementById("personDetailContent").classList.remove("hidden");

  try {
    const res = await fetch(`/api/people/${id}`);
    if (!res.ok) throw new Error("Failed to load person");
    const person = await res.json();

    // Fill details
    document.getElementById("detailPersonName").innerText = person.name || "";
    document.getElementById("detailPersonMeta").innerText =
      `${person.email || ""} • ${person.status || ""}`;

    // Profile tab
    document.getElementById("tab-profile").innerHTML = `
      <p><strong>Email:</strong> ${person.email || ""}</p>
      <p><strong>Status:</strong> ${person.status || ""}</p>
      <p><strong>Membership:</strong> ${person.membership_status || ""}</p>
      <p><strong>Tags:</strong> ${person.tags || ""}</p>
    `;

    // Notes tab
    document.getElementById("tab-notes").innerHTML = `
      <textarea id="notesArea">${person.notes || ""}</textarea>
      <button id="saveNotesBtn" class="primary-btn small">Save Notes</button>
      <p id="notesStatusMsg"></p>
    `;

    document.getElementById("saveNotesBtn").addEventListener("click", () => {
      saveNotes(person.id);
    });

  } catch (err) {
    console.error("DETAIL LOAD ERROR:", err);
  }
}


/**************************************************
 * SAVE NOTES
 **************************************************/
async function saveNotes(id) {
  const notes = document.getElementById("notesArea").value;
  const msg = document.getElementById("notesStatusMsg");

  try {
    const res = await fetch(`/api/people/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes })
    });

    if (!res.ok) throw new Error("Failed to save notes");

    msg.innerText = "Notes saved!";
    msg.style.color = "green";

  } catch (err) {
    msg.innerText = "Error saving notes";
    msg.style.color = "red";
  }
}


/**************************************************
 * SETUP EVENTS (Tabs, Buttons, Filters)
 **************************************************/
function setupEvents() {
  // Tabs
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");

      const tabName = btn.dataset.tab;

      document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
      document.getElementById(`tab-${tabName}`).classList.remove("hidden");
    });
  });

  // Add Person button (just opens the form panel)
  const newBtn = document.getElementById("newPersonBtn");
  if (newBtn) {
    newBtn.addEventListener("click", () => {
      document.getElementById("personDetailEmpty").classList.add("hidden");
      document.getElementById("personDetailContent").classList.add("hidden");
      document.getElementById("personFormPanel").classList.remove("hidden");
    });
  }

  // Close form
  const closeBtn = document.getElementById("closePersonFormBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      document.getElementById("personFormPanel").classList.add("hidden");
    });
  }
}

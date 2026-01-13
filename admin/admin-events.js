// ===============================
// HOLY CIRCLE — ADMIN EVENTS
// ===============================
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

let allEvents = [];
let editingId = null;

const tableBody = document.getElementById("eventsTableBody");
const emptyState = document.getElementById("eventsEmptyState");

const searchInput = document.getElementById("searchEvents");
const filterStatus = document.getElementById("filterStatus");
const filterType = document.getElementById("filterType");

// Modal
const modal = document.getElementById("eventModal");
const openModalBtn = document.getElementById("openCreateModal");
const closeModalBtn = document.getElementById("closeModal");
const cancelModalBtn = document.getElementById("cancelModal");
const modalTitle = document.getElementById("modalTitle");

// Form fields
const eventForm = document.getElementById("eventForm");
const eventIdInput = document.getElementById("eventId");
const eventNameInput = document.getElementById("eventName");
const eventDateInput = document.getElementById("eventDate");
const eventTimeInput = document.getElementById("eventTime");
const eventLocationInput = document.getElementById("eventLocation");
const eventTypeInput = document.getElementById("eventType");
const eventStatusInput = document.getElementById("eventStatus");
const eventDescriptionInput = document.getElementById("eventDescription");

// Header info
const headerNameEl = document.getElementById("headerName");
const headerRoleEl = document.getElementById("headerRole");

// ============ INIT HEADER ============
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

// ============ LOAD EVENTS ============
async function loadAdminEvents() {
  try {
    const res = await fetch("/api/events", { credentials: "include" });
    if (!res.ok) {
      console.error("Error loading events:", await res.text());
      return;
    }

    const data = await res.json();
    // Expecting: [{ id, name, date, time, location, type, status, description }]
    if (!data.success) {
    console.error("❌ Events API error:", data);
    allEvents = [];
    return;
  }

  allEvents = Array.isArray(data.events) ? data.events : [];

    renderEvents();
  } catch (err) {
    console.error("Error loading events:", err);
  }
}

function renderEvents() {
  tableBody.innerHTML = "";

  let filtered = [...allEvents];

  const search = (searchInput.value || "").toLowerCase().trim();
  const status = filterStatus.value;
  const type = filterType.value;

  if (search) {
    filtered = filtered.filter((ev) => {
      const text =
        (ev.name || "") +
        " " +
        (ev.location || "") +
        " " +
        (ev.description || "");
      return text.toLowerCase().includes(search);
    });
  }

  if (status !== "all") {
    filtered = filtered.filter((ev) => (ev.status || "upcoming") === status);
  }

  if (type !== "all") {
    filtered = filtered.filter((ev) => (ev.type || "other") === type);
  }

  if (!filtered.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="6" class="empty-state">
        No events match your filters.
      </td>
    `;
    tableBody.appendChild(tr);
    return;
  }

filtered.forEach((ev) => {
  const tr = document.createElement("tr");

  const dateTimeLabel = formatEventDateTime(ev.date, ev.time);
  const typeLabel = formatEventType(ev.type);
  const statusLabel = formatEventStatus(ev.status);

  tr.innerHTML = `
    <td>
      <div class="event-main">
        <strong>${escapeHtml(ev.name || "")}</strong>
        <small>${escapeHtml(ev.description || "").slice(0, 80)}</small>
      </div>
    </td>
    <td>${escapeHtml(dateTimeLabel)}</td>
    <td><span class="pill pill-type pill-${ev.type || "other"}">${escapeHtml(typeLabel)}</span></td>
    <td><span class="pill pill-status pill-${ev.status || "upcoming"}">${escapeHtml(statusLabel)}</span></td>
    <td>${escapeHtml(ev.location || "")}</td>
    <td class="actions-cell"></td>
  `;

  const actionsCell = tr.querySelector(".actions-cell");

  // ✏️ Edit
  actionsCell.innerHTML += `
    <button class="icon-btn" data-action="edit" data-id="${ev.id}">
      <i class="fa-solid fa-pen"></i>
    </button>
    <button class="icon-btn danger" data-action="delete" data-id="${ev.id}">
      <i class="fa-solid fa-trash"></i>
    </button>
  `;

  // 👥 Guest list link (NOW ev is valid)
  const guestBtn = document.createElement("a");
  guestBtn.href = `admin-event-guests.html?id=${ev.id}`;
  guestBtn.className = "table-link";
  guestBtn.textContent = "Guest List";

  actionsCell.appendChild(guestBtn);

  tableBody.appendChild(tr);
});
}

// ============ HELPERS ============

function formatEventDateTime(dateStr, timeStr) {
  if (!dateStr) return "";
  try {
    const [year, month, day] = dateStr.split("-").map((n) => parseInt(n, 10));
    const dateObj = new Date(year, month - 1, day);

    let datePart = dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    if (!timeStr) return datePart;

    const [h, m] = timeStr.split(":").map((n) => parseInt(n, 10));
    const temp = new Date();
    temp.setHours(h, m || 0, 0, 0);

    const timePart = temp.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    return `${datePart} • ${timePart}`;
  } catch {
    return dateStr;
  }
}

function formatEventType(type) {
  switch (type) {
    case "worship":
      return "Worship";
    case "bible":
      return "Bible Study";
    case "podcast":
      return "Podcast";
    case "community":
      return "Community";
    case "online":
      return "Online";
    default:
      return "Other";
  }
}

function formatEventStatus(status) {
  switch (status) {
    case "draft":
      return "Draft";
    case "archived":
      return "Archived";
    case "upcoming":
    default:
      return "Upcoming";
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ===============================
// EVENT TYPE NORMALIZATION
// ===============================

// Canonical types used by PUBLIC events page
const PUBLIC_EVENT_TYPES = new Set([
  "worship",
  "community",
  "podcast",
  "online",
]);

function normalizeEventType(raw) {
  const t = String(raw || "").toLowerCase().trim();
  return PUBLIC_EVENT_TYPES.has(t) ? t : "community"; // safe default
}

// ============ MODAL HANDLERS ============

function openCreateModal() {
  editingId = null;
  modalTitle.textContent = "Create Event";
  eventIdInput.value = "";
  eventNameInput.value = "";
  eventDateInput.value = "";
  eventTimeInput.value = "";
  eventLocationInput.value = "";
  eventTypeInput.value = "worship";
  eventStatusInput.value = "upcoming";
  eventDescriptionInput.value = "";
  modal.classList.add("active");
}

function openEditModal(ev) {
  editingId = ev.id;
  modalTitle.textContent = "Edit Event";
  eventIdInput.value = ev.id;
  eventNameInput.value = ev.name || "";
  eventDateInput.value = ev.date || "";
  eventTimeInput.value = ev.time || "";
  eventLocationInput.value = ev.location || "";
  eventTypeInput.value = normalizeEventType(ev.type);
  eventStatusInput.value = ev.status || "upcoming";
  eventDescriptionInput.value = ev.description || "";
  modal.classList.add("active");
}

function closeModal() {
  modal.classList.remove("active");
}

// Click handlers
if (openModalBtn) openModalBtn.addEventListener("click", openCreateModal);
if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
if (cancelModalBtn) cancelModalBtn.addEventListener("click", closeModal);

modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

// Table actions (edit/delete)
tableBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const id = Number(btn.dataset.id);
  const action = btn.dataset.action;
  const ev = allEvents.find((x) => x.id === id);
  if (!ev) return;

  if (action === "edit") {
    openEditModal(ev);
  } else if (action === "delete") {
    const confirmed = confirm(`Delete event: "${ev.name}"?`);
    if (!confirmed) return;
    deleteEvent(id);
  }
});



// Search / filter listeners
searchInput.addEventListener("input", () => renderEvents());
filterStatus.addEventListener("change", () => renderEvents());
filterType.addEventListener("change", () => renderEvents());

// ============ CRUD ============

async function deleteEvent(id) {
  try {
    const res = await fetch(`/api/events/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      alert("Error deleting event.");
      return;
    }
    await loadAdminEvents();
  } catch (err) {
    console.error("Error deleting event:", err);
    alert("Unable to delete event.");
  }
}

eventForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Simple validation that matches backend: name, date, time are required
  if (!eventNameInput.value.trim() || !eventDateInput.value || !eventTimeInput.value) {
    alert("Please fill out event name, date, and time.");
    return;
  }

  const payload = {
    name: eventNameInput.value.trim(),
    date: eventDateInput.value,
    time: eventTimeInput.value,
    location: eventLocationInput.value.trim() || null,
    type: normalizeEventType(eventTypeInput.value),
    status: eventStatusInput.value || "upcoming",
    description: eventDescriptionInput.value.trim() || null,
  };

  const isEdit = !!editingId;
  const url = isEdit ? `/api/events/${editingId}` : "/api/events";
  const method = isEdit ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("❌ Event save failed:", res.status, text);
      alert(`Event save failed (${res.status}). Check console.`);
      return;
    }


    closeModal();
    await loadAdminEvents();
  } catch (err) {
    console.error("Error saving event:", err);
    alert("Unable to save event. Please try again.");
  }
});
document
  .getElementById("launchForumBtn")
  ?.addEventListener("click", async () => {
    if (!confirm("Send forum launch email to all waitlisted users?")) return;

    const res = await fetch("/api/admin/launch-forum", {
      method: "POST",
      credentials: "include"
    });

    const data = await res.json();
    alert(`Forum launch emails sent: ${data.sent}`);
  });


// ============ STARTUP ============

document.addEventListener("DOMContentLoaded", () => {
  loadAdminEvents();
});

// FILE: admin-followup.js

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

let activeFollowupId = null;

const API_BASE = "/api/followups";

// Table + empty state
const tbody = document.getElementById("followup-tbody");
const emptyState = document.getElementById("followup-empty-state");

// Filters
const filterCategory = document.getElementById("filter-category");
const filterStatus = document.getElementById("filter-status");
const filterSearch = document.getElementById("filter-search");
const btnFilterApply = document.getElementById("btn-filter-apply");

// Modal elements
const modal = document.getElementById("followup-modal");
const modalTitle = document.getElementById("followup-modal-title");
const modalClose = document.getElementById("followup-modal-close");
const btnOpenModal = document.getElementById("btn-open-followup-modal");
const btnCancelModal = document.getElementById("followup-cancel-btn");
const form = document.getElementById("followup-form");

// Form fields
const fieldId = document.getElementById("followup-id");
const fieldTitle = document.getElementById("followup-title");
const fieldCategory = document.getElementById("followup-category");
const fieldAssignedTo = document.getElementById("followup-assigned-to");
const fieldDueDate = document.getElementById("followup-due-date");
const fieldPriority = document.getElementById("followup-priority");
const fieldStatus = document.getElementById("followup-status");
const fieldNotes = document.getElementById("followup-notes");

// Kanban + toggle (may not exist yet if HTML not updated)
const kanbanView = document.getElementById("kanbanView");
const tableSection = document.querySelector(".followup-table-card");
const toggleBoardBtn = document.getElementById("toggleBoard");
const kanbanOpenCol = document.getElementById("kanban-open");
const kanbanInProgressCol = document.getElementById("kanban-in-progress");
const kanbanDoneCol = document.getElementById("kanban-done");

let usersCache = [];
let followupCache = [];

// ============================
// Modal helpers
// ============================
function openModal(mode = "add", followup = null) {
  modal.classList.add("open");
  document.body.classList.add("modal-open");

  if (mode === "add") {
    modalTitle.textContent = "Add Follow-Up";
    fieldId.value = "";
    fieldTitle.value = "";
    fieldCategory.value = "";
    fieldAssignedTo.value = "";
    fieldDueDate.value = "";
    fieldPriority.value = "normal";
    fieldStatus.value = "open";
    fieldNotes.value = "";
  } else if (mode === "edit" && followup) {
    modalTitle.textContent = "Edit Follow-Up";
    fieldId.value = followup.id;
    fieldTitle.value = followup.title || "";
    fieldCategory.value = followup.category || "";
    fieldAssignedTo.value = followup.assigned_to_user_id || "";
    fieldDueDate.value = followup.due_date || "";
    fieldPriority.value = followup.priority || "normal";
    fieldStatus.value = followup.status || "open";
    fieldNotes.value = followup.notes || "";
  }
}

function closeModal() {
  modal.classList.remove("open");
  document.body.classList.remove("modal-open");
}

// ============================
// API helpers
// ============================
async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("API error:", res.status, text);
    throw new Error("Request failed");
  }

  return res.json();
}

async function loadUsers() {
  try {
    const users = await fetchJSON(`${API_BASE}/users`);
    usersCache = users;

    // Fill dropdown
    users.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.name || u.email;
      fieldAssignedTo.appendChild(opt);
    });
  } catch (err) {
    console.warn("Could not load users for assignment:", err);
  }
}

async function loadFollowups() {
  const params = new URLSearchParams();

  if (filterCategory.value && filterCategory.value !== "All") {
    params.append("category", filterCategory.value);
  }
  if (filterStatus.value && filterStatus.value !== "All") {
    params.append("status", filterStatus.value);
  }
  if (filterSearch.value.trim() !== "") {
    params.append("search", filterSearch.value.trim());
  }

  const url = `${API_BASE}?${params.toString()}`;

  try {
    followupCache = await fetchJSON(url);
    renderFollowups(followupCache);
    buildKanbanBoard();
  } catch (err) {
    console.error("Error loading follow-ups:", err);
    tbody.innerHTML = "";
    emptyState.style.display = "flex";
  }
}
// ============================
//  Open follow-up details (comments, files, activity)
// ============================

function openFollowupDetails(followupId) {
  activeFollowupId = followupId;

  // Show side panels
  document.getElementById("followup-comments-panel").classList.add("open");
  document.getElementById("followup-files-panel").classList.add("open");
  document.getElementById("followup-activity-log").classList.add("open");

  // Load data
  loadComments(followupId);
  loadFiles(followupId);
  loadActivity(followupId);
}
// ============================
//Load comments
// ============================
async function loadComments(followupId) {
  const list = document.getElementById("comments-list");
  list.innerHTML = `<p class="loading">Loading comments...</p>`;

  const res = await fetch(`/api/followups/${followupId}/comments`);
  const comments = await res.json();

  list.innerHTML = comments
      .map(c => `
          <div class="comment-item">
              <div class="comment-header">
                  <span class="comment-user">${c.user_name}</span>
                  <span class="comment-time">${new Date(c.created_at).toLocaleString()}</span>
              </div>
              <div class="comment-body">${c.comment}</div>
          </div>
      `)
      .join("");
}
// ============================
// Post new comment
// ============================
document.getElementById("add-comment-btn").addEventListener("click", async () => {
  const text = document.getElementById("new-comment-input").value.trim();
  if (!text) return;

  await fetch(`/api/followups/${activeFollowupId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: text })
  });

  document.getElementById("new-comment-input").value = "";
  loadComments(activeFollowupId);
  loadActivity(activeFollowupId);
});

// ============================
// Load Files Attachments
// ============================
async function loadFiles(followupId) {
  const list = document.getElementById("files-list");
  list.innerHTML = `<p class="loading">Loading files...</p>`;

  const res = await fetch(`/api/followups/${followupId}/files`);
  const files = await res.json();

  list.innerHTML = files.length === 0
      ? `<p class="empty">No files uploaded yet.</p>`
      : files.map(f => `
          <div class="file-item">
              <a href="${f.file_url}" target="_blank">${f.original_name}</a>
              <span class="file-date">${new Date(f.uploaded_at).toLocaleString()}</span>
          </div>
      `).join("");
}
// ============================
// File Upload Handler
// ============================

document.getElementById("upload-file-btn").addEventListener("click", async () => {
  const input = document.getElementById("file-upload-input");

  if (!input.files.length) return alert("Select a file first.");

  const fd = new FormData();
  fd.append("file", input.files[0]);

  await fetch(`/api/followups/${activeFollowupId}/files`, {
      method: "POST",
      body: fd,
  });

  input.value = "";
  loadFiles(activeFollowupId);
  loadActivity(activeFollowupId);
});

// ============================
// Load Activity Log
// ============================
async function loadActivity(followupId) {
  const list = document.getElementById("activity-list");
  list.innerHTML = `<p class="loading">Loading activity...</p>`;

  const res = await fetch(`/api/followups/${followupId}/activity`);
  const activity = await res.json();

  list.innerHTML = activity
      .map(a => `
          <li class="activity-item">
              <div class="activity-header">
                  <span class="activity-user">${a.user_name || "System"}</span>
                  <span class="activity-time">${new Date(a.created_at).toLocaleString()}</span>
              </div>
              <div class="activity-action">
                  <strong>${a.action}</strong>
              </div>
              <div class="activity-details">${a.details || ""}</div>
          </li>
      `)
      .join("");
}


// ============================
// Rendering (Table view)
// ============================
function renderFollowups(list) {
  tbody.innerHTML = "";

  if (!list || list.length === 0) {
    emptyState.style.display = "flex";
    return;
  } else {
    emptyState.style.display = "none";
  }

  for (const item of list) {
    const tr = document.createElement("tr");

    // Mark overdue
    if (item.due_date) {
      const due = new Date(item.due_date);
      const now = new Date();
      // Compare by date only (midnight)
      if (due < new Date(now.toISOString().split("T")[0]) && item.status !== "done") {
        tr.classList.add("overdue-row");
      }
    }

    // Category
    const tdCategory = document.createElement("td");
    tdCategory.textContent = item.category || "";
    tdCategory.classList.add("pill-category");

    // Color by category
    tdCategory.style.color =
      {
        Donor: "#bf9745",
        Visitor: "#89ddf4",
        Volunteer: "#5ac18e",
        Event: "#7e57c2",
        Media: "#00afb9",
        Admin: "#93a1a1",
      }[item.category] || "#555";

      tr.addEventListener("click", () => openFollowupDetails(item.id));

    tr.appendChild(tdCategory);

    // Title + notes (small)
    const tdTitle = document.createElement("td");
    const titleDiv = document.createElement("div");
    titleDiv.classList.add("followup-title");
    titleDiv.textContent = item.title || "";
    tdTitle.appendChild(titleDiv);

    if (item.notes) {
      const notesSmall = document.createElement("div");
      notesSmall.classList.add("followup-notes-small");
      notesSmall.textContent =
        item.notes.length > 80 ? item.notes.substring(0, 80) + "..." : item.notes;
      tdTitle.appendChild(notesSmall);
    }

    tr.appendChild(tdTitle);

    // Assigned To
    const tdAssigned = document.createElement("td");
    tdAssigned.textContent = item.assigned_to_name || "Unassigned";
    tr.appendChild(tdAssigned);

    // Priority
    const tdPriority = document.createElement("td");
    tdPriority.textContent = capitalize(item.priority || "normal");
    tdPriority.classList.add(
      "pill-priority",
      `priority-${item.priority || "normal"}`
    );
    tr.appendChild(tdPriority);

    // Due date
    const tdDue = document.createElement("td");
    tdDue.textContent = item.due_date || "-";
    tr.appendChild(tdDue);

    // Status (select)
    const tdStatus = document.createElement("td");
    const statusSelect = document.createElement("select");
    statusSelect.classList.add("status-select");

    ["open", "in_progress", "done"].forEach((status) => {
      const opt = document.createElement("option");
      opt.value = status;
      opt.textContent =
        status === "open"
          ? "Open"
          : status === "in_progress"
          ? "In Progress"
          : "Done";
      if (item.status === status) opt.selected = true;
      statusSelect.appendChild(opt);
    });

    statusSelect.addEventListener("change", async () => {
      try {
        await fetchJSON(`${API_BASE}/${item.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: statusSelect.value }),
        });
        // Refresh cache + kanban + table
        await loadFollowups();
      } catch (err) {
        alert("Could not update status. Please try again.");
        statusSelect.value = item.status;
      }
    });

    tdStatus.appendChild(statusSelect);
    tr.appendChild(tdStatus);

    // Actions
    const tdActions = document.createElement("td");
    tdActions.classList.add("followup-actions");

    const editBtn = document.createElement("button");
    editBtn.classList.add("icon-btn");
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
    editBtn.title = "Edit";
    editBtn.addEventListener("click", () => openModal("edit", item));

    const deleteBtn = document.createElement("button");
    deleteBtn.classList.add("icon-btn", "danger");
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    deleteBtn.title = "Delete";
    deleteBtn.addEventListener("click", () => handleDelete(item.id));

    tdActions.appendChild(editBtn);
    tdActions.appendChild(deleteBtn);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  }
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================
// Kanban view
// ============================
function buildKanbanBoard() {
  if (!kanbanView || !kanbanOpenCol || !kanbanInProgressCol || !kanbanDoneCol) {
    return; // Kanban not in this HTML
  }

  kanbanOpenCol.innerHTML = "";
  kanbanInProgressCol.innerHTML = "";
  kanbanDoneCol.innerHTML = "";

  followupCache.forEach((item) => {
    const card = document.createElement("div");
    card.classList.add("kanban-card");
    card.draggable = true;
    card.dataset.id = item.id;

    card.innerHTML = `
      <div class="card-title">${item.title}</div>
      <div class="card-category">${item.category || ""}</div>
      ${item.due_date ? `<div class="card-due">Due: ${item.due_date}</div>` : ""}
    `;

    if (item.status === "open") {
      kanbanOpenCol.appendChild(card);
    } else if (item.status === "in_progress") {
      kanbanInProgressCol.appendChild(card);
    } else {
      kanbanDoneCol.appendChild(card);
    }

    enableDrag(card);
  });
}

function enableDrag(card) {
  card.addEventListener("dragstart", () => {
    card.classList.add("dragging");
  });

  card.addEventListener("dragend", async () => {
    card.classList.remove("dragging");

    const column = card.closest(".kanban-column");
    if (!column) return;

    const newStatus = column.dataset.status;
    const id = card.dataset.id;

    try {
      await fetchJSON(`${API_BASE}/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      await loadFollowups();
    } catch (err) {
      console.error("Failed to update status via drag:", err);
      alert("Could not update status. Please try again.");
    }
  });
}

// Attach dragover to all kanban lists if present
if (kanbanView) {
  document.querySelectorAll(".kanban-list").forEach((list) => {
    list.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = document.querySelector(".kanban-card.dragging");
      if (dragging && list !== dragging.parentElement) {
        list.appendChild(dragging);
      }
    });
  });
}

// ============================
// Actions
// ============================
async function handleDelete(id) {
  const ok = confirm("Are you sure you want to delete this follow-up?");
  if (!ok) return;

  try {
    await fetchJSON(`${API_BASE}/${id}`, { method: "DELETE" });
    await loadFollowups();
  } catch (err) {
    alert("Could not delete follow-up. Please try again.");
  }
}

async function handleSave(e) {
  e.preventDefault();

  const payload = {
    title: fieldTitle.value.trim(),
    category: fieldCategory.value,
    status: fieldStatus.value,
    priority: fieldPriority.value,
    assigned_to_user_id: fieldAssignedTo.value || null,
    due_date: fieldDueDate.value || null,
    notes: fieldNotes.value.trim(),
  };

  if (!payload.title || !payload.category) {
    alert("Title and category are required.");
    return;
  }

  const id = fieldId.value;

  try {
    if (id) {
      // update
      await fetchJSON(`${API_BASE}/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      // create
      await fetchJSON(API_BASE, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    closeModal();
    await loadFollowups();
  } catch (err) {
    alert("Could not save follow-up. Please try again.");
  }
}

// ============================
// Events
// ============================

btnOpenModal.addEventListener("click", () => openModal("add"));
modalClose.addEventListener("click", closeModal);
btnCancelModal.addEventListener("click", closeModal);

btnFilterApply.addEventListener("click", () => loadFollowups());

// also trigger on Enter in search
filterSearch.addEventListener("keyup", (e) => {
  if (e.key === "Enter") loadFollowups();
});

// close modal when clicking overlay background
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

form.addEventListener("submit", handleSave);

// Kanban toggle
if (toggleBoardBtn && kanbanView && tableSection) {
  toggleBoardBtn.addEventListener("click", () => {
    const isHidden = kanbanView.classList.contains("hidden");

    if (isHidden) {
      kanbanView.classList.remove("hidden");
      tableSection.classList.add("hidden");
      toggleBoardBtn.innerHTML =
        `<i class="fa-solid fa-table-list"></i> Table View`;
    } else {
      kanbanView.classList.add("hidden");
      tableSection.classList.remove("hidden");
      toggleBoardBtn.innerHTML =
        `<i class="fa-solid fa-table-columns"></i> Board View`;
    }

    buildKanbanBoard();
  });
}

// ============================
// Init
// ============================
(async function init() {
  await loadUsers();
  await loadFollowups();
})();

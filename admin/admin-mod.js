/* ============================================================
   HOLY CIRCLE — ADMIN MODERATION DASHBOARD
   Fully table-compatible version (NO DIV ROWS)
   Works with your existing backend routes in forum.js
============================================================ */
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

/* Small fetch helper */
async function fetchJSON(url) {
    const res = await fetch(url, { credentials: "include" });
    return res.json();
  }
  
  /* ============================================================
     REPORTED ITEMS
  ============================================================ */
  async function loadReported() {
    const data = await fetchJSON(`/api/forum/mod/reported`);
    const container = document.getElementById("modReportedList");
  
    container.innerHTML = data.length
      ? data
          .map(
            (r) => `
        <tr>
          <td><strong>${r.thread_title}</strong></td>
          <td>${r.reason || "—"}</td>
          <td>${r.email}</td>
          <td>${new Date(r.created_at).toLocaleString()}</td>
          <td>
            <button class="mod-btn mod-view" onclick="viewThread(${r.thread_id})">View</button>
            <button class="mod-btn mod-hide" onclick="hideThread(${r.thread_id})">Hide</button>
            <button class="mod-btn mod-danger" onclick="modBanUser(${r.reporter_id})">Ban</button>
          </td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="5" class="empty-row">No reports found.</td></tr>`;
  }
  
  /* ============================================================
     HIDDEN THREADS
  ============================================================ */
  async function loadHiddenThreads() {
    const data = await fetchJSON(`/api/forum/mod/hidden-threads`);
    const container = document.getElementById("modHiddenThreads");
  
    container.innerHTML = data.length
      ? data
          .map(
            (t) => `
        <tr>
          <td><strong>${t.title}</strong></td>
          <td>${t.id}</td>
          <td>${new Date(t.created_at).toLocaleString()}</td>
          <td>
            <button class="mod-btn mod-view" onclick="viewThread(${t.id})">View</button>
            <button class="mod-btn mod-hide" onclick="unhideThread(${t.id})">Unhide</button>
          </td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="4" class="empty-row">No hidden threads.</td></tr>`;
  }
  
  /* ============================================================
     HIDDEN REPLIES
  ============================================================ */
  async function loadHiddenReplies() {
    const data = await fetchJSON(`/api/forum/mod/hidden-replies`);
    const container = document.getElementById("modHiddenReplies");
  
    container.innerHTML = data.length
      ? data
          .map(
            (r) => `
        <tr>
          <td>${r.id}</td>
          <td>${r.body.slice(0, 120)}…</td>
          <td>${new Date(r.created_at).toLocaleString()}</td>
          <td>
            <button class="mod-btn mod-hide" onclick="unhideReply(${r.id})">Unhide</button>
          </td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="4" class="empty-row">No hidden replies.</td></tr>`;
  }
  
  /* ============================================================
     PINNED THREADS
  ============================================================ */
  async function loadPinned() {
    const data = await fetchJSON(`/api/forum/mod/pinned`);
    const container = document.getElementById("modPinned");
  
    container.innerHTML = data.length
      ? data
          .map(
            (t) => `
        <tr>
          <td><strong>${t.title}</strong></td>
          <td>${t.id}</td>
          <td>${new Date(t.created_at).toLocaleString()}</td>
          <td>
            <button class="mod-btn mod-view" onclick="viewThread(${t.id})">View</button>
            <button class="mod-btn mod-hide" onclick="unpinThread(${t.id})">Unpin</button>
          </td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="4" class="empty-row">No pinned threads.</td></tr>`;
  }
  
  /* ============================================================
     LOCKED THREADS
  ============================================================ */
  async function loadLocked() {
    const data = await fetchJSON(`/api/forum/mod/locked`);
    const container = document.getElementById("modLocked");
  
    container.innerHTML = data.length
      ? data
          .map(
            (t) => `
        <tr>
          <td><strong>${t.title}</strong></td>
          <td>${t.id}</td>
          <td>${new Date(t.created_at).toLocaleString()}</td>
          <td>
            <button class="mod-btn mod-view" onclick="viewThread(${t.id})">View</button>
            <button class="mod-btn mod-hide" onclick="unlockThread(${t.id})">Unlock</button>
          </td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="4" class="empty-row">No locked threads.</td></tr>`;
  }
  
  /* ============================================================
     THREAD ACTIONS
  ============================================================ */
  function viewThread(threadId) {
    window.open(`/forum-thread.html?id=${threadId}`, "_blank");
  }
  
  function hideThread(threadId) {
    fetch(`/api/forum/mod/hide-thread/${threadId}`, { method: "POST" }).then(
      () => {
        loadReported();
        loadHiddenThreads();
      }
    );
  }
  
  function unhideThread(threadId) {
    fetch(`/api/forum/mod/unhide-thread/${threadId}`, { method: "POST" }).then(
      () => loadHiddenThreads()
    );
  }
  
  function unlockThread(threadId) {
    fetch(`/api/forum/mod/unlock-thread/${threadId}`, { method: "POST" }).then(
      () => loadLocked()
    );
  }
  
  function lockThread(threadId) {
    fetch(`/api/forum/mod/lock-thread/${threadId}`, { method: "POST" }).then(() =>
      loadLocked()
    );
  }
  
  function unpinThread(threadId) {
    fetch(`/api/forum/mod/unpin-thread/${threadId}`, { method: "POST" }).then(
      () => loadPinned()
    );
  }
  
  /* ============================================================
     HIDDEN REPLY ACTIONS
  ============================================================ */
  function unhideReply(replyId) {
    fetch(`/api/forum/mod/unhide-reply/${replyId}`, { method: "POST" }).then(() =>
      loadHiddenReplies()
    );
  }
  
  /* ============================================================
     BAN / SHADOWBAN ACTIONS
  ============================================================ */
  function modBanUser(memberId) {
    const reason = prompt("Ban reason?");
    fetch(`/api/forum/mod/ban/${memberId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }).then(() => {
      alert("User banned.");
    });
  }
  
  function modShadowbanUser(memberId) {
    const reason = prompt("Shadowban reason?");
    fetch(`/api/forum/mod/shadowban/${memberId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }).then(() => {
      alert("User shadowbanned.");
    });
  }
  

  /* ============================================================
     INITIAL LOAD
  ============================================================ */
  document.addEventListener("DOMContentLoaded", () => {
    loadReported();
    loadHiddenThreads();
    loadHiddenReplies();
    loadPinned();
    loadLocked();
  });
  
  /* ============================================================
   BADGE ADMIN PANEL
============================================================ */

const badgeModal = document.getElementById("badgeModal");
const openBadgeBtn = document.getElementById("openBadgeManager");
const closeBadgeBtn = document.getElementById("closeBadgeModal");
/* EDIT / DELETE ELEMENTS */
const badgeEditPanel = document.getElementById("badgeEditPanel");
const editBadgeName = document.getElementById("editBadgeName");
const editBadgeIcon = document.getElementById("editBadgeIcon");
const badgeEditStatus = document.getElementById("badgeEditStatus");
const closeEditPanel = document.getElementById("closeEditPanel");
const saveBadgeChanges = document.getElementById("saveBadgeChanges");
const deleteBadgeBtn = document.getElementById("deleteBadge");

let editingBadgeId = null;

openBadgeBtn.addEventListener("click", () => {
  badgeModal.classList.add("show");
  loadBadges();
});

closeBadgeBtn.addEventListener("click", () => {
  badgeModal.classList.remove("show");
});

// SEARCH MEMBERS
document.getElementById("badgeMemberSearch").addEventListener("input", async (e) => {
  const term = e.target.value.trim();
  const resultsBox = document.getElementById("badgeMemberResults");

  if (!term) return (resultsBox.innerHTML = "");

  const res = await fetch(`/api/members/search?query=${encodeURIComponent(term)}`);
  const members = await res.json();

  resultsBox.innerHTML = members
    .map(
      (m) => `
    <div class="badge-member-item" onclick="selectBadgeMember(${m.id}, '${m.first_name} ${m.last_name}')">
      <strong>${m.first_name} ${m.last_name}</strong> - ${m.email}
    </div>`
    )
    .join("");
});

let selectedMemberId = null;

function selectBadgeMember(id, name) {
  selectedMemberId = id;
  document.getElementById("badgeMemberResults").innerHTML = `
    <p><strong>Selected:</strong> ${name}</p>
  `;
  highlightAssignedBadges();
}

// LOAD BADGES
async function loadBadges() {
  const res = await fetch(`/api/badges/list`);
  const badges = await res.json();

  const container = document.getElementById("badgeList");
  container.innerHTML = badges
  .map(
    (b) => `
    <div class="badge-admin-item"
      id="badge-${b.id}"
      onclick="openBadgeEditor(${b.id}, '${b.name}', '${b.icon}')">
      <img src="${b.icon}" alt="${b.name}">
    </div>
  `
  )
  .join("");


  if (selectedMemberId) highlightAssignedBadges();
}

function openBadgeEditor(id, name, icon) {
  editingBadgeId = id;

  editBadgeName.value = name;
  editBadgeIcon.value = "";
  badgeEditStatus.innerHTML = "";
  
  badgeEditPanel.classList.add("show");
}

closeEditPanel.addEventListener("click", () => {
  badgeEditPanel.classList.remove("show");
  editingBadgeId = null;
});

saveBadgeChanges.addEventListener("click", async () => {
  if (!editingBadgeId) return;

  const name = editBadgeName.value.trim();
  const iconFile = editBadgeIcon.files[0];

  if (!name) {
    badgeEditStatus.innerHTML = "❗ Badge name required.";
    return;
  }

  const formData = new FormData();
  formData.append("id", editingBadgeId);
  formData.append("name", name);
  if (iconFile) formData.append("icon", iconFile);

  const res = await fetch("/api/badges/edit", {
    method: "POST",
    body: formData
  });

  const result = await res.json();

  if (result.success) {
    badgeEditStatus.innerHTML = "✅ Badge updated!";
    loadBadges(); // refresh
  } else {
    badgeEditStatus.innerHTML = "❌ Could not update badge.";
  }
});

deleteBadgeBtn.addEventListener("click", async () => {
  if (!editingBadgeId) return;

  const ok = confirm("Are you sure you want to permanently delete this badge?");
  if (!ok) return;

  const res = await fetch("/api/badges/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: editingBadgeId })
  });

  const result = await res.json();

  if (result.success) {
    badgeEditPanel.classList.remove("show");
    badgeEditStatus.innerHTML = "";
    editingBadgeId = null;
    loadBadges();
  } else {
    badgeEditStatus.innerHTML = "❌ Could not delete badge.";
  }
});


// HIGHLIGHT BADGES ALREADY ASSIGNED TO USER
async function highlightAssignedBadges() {
  if (!selectedMemberId) return;

  const res = await fetch(`/api/badges/user/${selectedMemberId}`);
  const userBadges = await res.json();

  document.querySelectorAll(".badge-admin-item").forEach((el) => {
    el.classList.remove("assigned");
  });

  userBadges.forEach((b) => {
    document.getElementById(`badge-${b.id}`).classList.add("assigned");
  });
}

// TOGGLE BADGE FOR USER
async function toggleUserBadge(badgeId) {
  if (!selectedMemberId) {
    alert("Select a member first.");
    return;
  }

  await fetch(`/api/badges/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId: selectedMemberId, badgeId }),
  });

  highlightAssignedBadges();
}

/* ============================================================
   CREATE NEW BADGE
============================================================ */

document.getElementById("createBadgeBtn").addEventListener("click", async () => {
  const name = document.getElementById("newBadgeName").value.trim();
  const fileInput = document.getElementById("newBadgeIcon");
  const statusBox = document.getElementById("createBadgeStatus");

  statusBox.innerHTML = "";

  if (!name) {
    statusBox.innerHTML = "❗ Badge name is required.";
    return;
  }

  if (!fileInput.files.length) {
    statusBox.innerHTML = "❗ Badge icon file is required.";
    return;
  }

  // Prepare form
  const formData = new FormData();
  formData.append("name", name);
  formData.append("icon", fileInput.files[0]);

  // Send to backend
  const res = await fetch("/api/badges/create", {
    method: "POST",
    body: formData
  });

  const result = await res.json();

  if (result.success) {
    statusBox.innerHTML = "✅ Badge created successfully!";
    document.getElementById("newBadgeName").value = "";
    document.getElementById("newBadgeIcon").value = "";

    // Refresh badge list
    loadBadges();
  } else {
    statusBox.innerHTML = "❌ Failed to create badge.";
  }
});

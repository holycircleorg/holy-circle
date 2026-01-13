const ICONS = {
  event: `<i class="fa-solid fa-calendar-check"></i>`,
  giving: `<i class="fa-solid fa-hand-holding-heart"></i>`,
  system: `<i class="fa-solid fa-bell"></i>`
};

// ------------------------------
// LOAD NOTIFICATIONS
// ------------------------------
async function loadEnhancedNotifications() {
  const list = document.getElementById("notificationsList");
  if (!list) return;

  list.innerHTML = `<p class="empty-state">Loading notifications...</p>`;

  let notifications = [];

  try {
    const res = await fetch("/api/notifications?limit=50", {
      credentials: "include",
    });

    if (res.status === 401) {
      list.innerHTML = `<p class="empty-state">You're all caught up ✨</p>`;
      return;
    }

    if (!res.ok) {
      throw new Error(`Failed to load notifications (${res.status})`);
    }

      const data = await res.json();
      notifications = (data.notifications || []).slice(0, MAX_ITEMS);


    if (!notifications.length) {
      list.innerHTML = `<p class="empty-state">You're all caught up ✨</p>`;
      return;
    }

    // ---- GROUPING ----
    const groups = groupNotifications(notifications);

    list.innerHTML = "";

    Object.keys(groups).forEach((label) => {
      const title = document.createElement("div");
      title.className = "notif-group-title";
      title.textContent = label;
      list.appendChild(title);

      groups[label].forEach((n) => {
        list.appendChild(renderNotifItem(n));
      });
    });

    cachedNotifications = notifications;
    if (window.hcRefreshNotifications) window.hcRefreshNotifications();
    renderFiltered();

  } catch (err) {
    console.warn("Enhanced notifications failed:", err);
    list.innerHTML = `<p class="empty-state">Unable to load notifications.</p>`;
  }
}



// ------------------------------
// NOTIFICATION ITEM TEMPLATE
// ------------------------------
function renderNotifItem(n) {
  const icon = ICONS[n.category] || ICONS.system;
  const link = n.link
    ? `<a href="${n.link}" class="notification-link">View</a>`
    : "";

  return `
    <div class="notification-item ${n.read ? "" : "unread"}"
     data-id="${n.id}">


      <div class="notification-icon">${icon}</div>

      <div class="notification-body">
        <div class="notification-text">${n.message}</div>
        <div class="notification-meta">${formatDate(n.created_at)}</div>
        ${link}
      </div>

    </div>
  `;
}

// ----------------------------------
// CONTEXT: dropdown vs full page
// ----------------------------------
const IS_FULL_PAGE = location.pathname.includes("notifications");
const MAX_ITEMS = IS_FULL_PAGE ? Infinity : 5;

// ------------------------------
// GROUPING HELPER
// ------------------------------
function groupNotifications(list) {
  const now = new Date();
  const groups = {
    "Today": [],
    "Yesterday": [],
    "This Week": [],
    "Earlier": []
  };

  list.forEach((n) => {
    const d = new Date(n.created_at);
    const diff = (now - d) / (1000 * 60 * 60 * 24);

    if (diff < 1) groups["Today"].push(n);
    else if (diff < 2) groups["Yesterday"].push(n);
    else if (diff < 7) groups["This Week"].push(n);
    else groups["Earlier"].push(n);
  });

  return groups;
}

// ------------------------------
// MARK ALL READ
// ------------------------------
async function markAllRead() {
  await fetch("/api/notifications/mark-all-read", {
    method: "POST",
    credentials: "include"
  });

  loadEnhancedNotifications();
  if (window.hcRefreshNotifications) window.hcRefreshNotifications();
}

// ------------------------------
// CLEAR ALL
// ------------------------------
async function clearAll() {
  await fetch("/api/notifications/clear-all", {
    method: "POST",
    credentials: "include"
  });

  loadEnhancedNotifications();
  if (window.hcRefreshNotifications) window.hcRefreshNotifications();
}

// ------------------------------
function bindButtons() {
  document.getElementById("notifMarkAll")?.addEventListener("click", markAllRead);
  document.getElementById("notifClearAll")?.addEventListener("click", clearAll);
}

// ------------------------------
function formatDate(v) {
  const d = new Date(v);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

let currentFilter = "all";
let cachedNotifications = [];

document.addEventListener("DOMContentLoaded", () => {
  loadEnhancedNotifications();
  bindButtons();
  bindFilters();
});

function bindFilters() {
  document.querySelectorAll(".notif-filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".notif-filter").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderFiltered();
    });
  });
}

// Render notifications after filtering + grouping
function renderFiltered() {
  const list = document.getElementById("notificationsList");

  const filtered = cachedNotifications.filter((n) => {
    return currentFilter === "all" || n.category === currentFilter;
  });

  if (!filtered.length) {
  list.innerHTML = `<p class="empty-state">No notifications here yet ✨</p>`;
  return;
}


  const groups = groupNotifications(filtered);

  list.innerHTML = "";

  Object.keys(groups).forEach((label) => {
    if (groups[label].length === 0) return;
    list.innerHTML += `<div class="notif-group-title">${label}</div>`;
    list.innerHTML += groups[label].map(renderNotifItem).join("");
  });
}


document.addEventListener("click", async (e) => {
  const item = e.target.closest(".notification-item.unread");
  if (!item) return;

  const id = item.dataset.id;

  await fetch("/api/notifications/mark-all-read", {
    method: "POST",
    credentials: "include"
  });

  item.classList.remove("unread");
});

if (location.pathname.includes("notifications")) {
  fetch("/api/notifications/mark-all-read", {
    method: "POST",
    credentials: "include"
  });
}

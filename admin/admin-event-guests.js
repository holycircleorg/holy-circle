// ===============================
// ADMIN EVENT GUEST LIST (Layout B)
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

const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get("id");

const titleEl = document.getElementById("eventTitleAdmin");
const metaEl = document.getElementById("eventMetaAdmin");

const statTotalRsvps = document.getElementById("statTotalRsvps");
const statMemberRsvps = document.getElementById("statMemberRsvps");
const statGuestRsvps = document.getElementById("statGuestRsvps");
const statTotalGuests = document.getElementById("statTotalGuests");

const guestListEl = document.getElementById("guestList");
const guestEmptyState = document.getElementById("guestEmptyState");

const filterPills = document.querySelectorAll(".filter-pill");
const searchInput = document.getElementById("guestSearch");
const exportCsvBtn = document.getElementById("exportCsvBtn");

let fullData = {
  event: null,
  stats: null,
  members: [],
  guests: [],
};

let currentFilter = "all";
let currentSearch = "";

document.addEventListener("DOMContentLoaded", () => {
  if (!eventId) {
    alert("No event id provided.");
    return;
  }

  loadGuestData();

  filterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      filterPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentFilter = pill.dataset.filter || "all";
      renderGuestList();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      currentSearch = searchInput.value.toLowerCase();
      renderGuestList();
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", () => {
      window.location.href = `/api/admin/events/${eventId}/guests/export`;
    });
  }
});

async function loadGuestData() {
  try {
    const res = await fetch(`/api/admin/events/${eventId}/guests`);
    if (!res.ok) {
      console.error("Error loading guests:", await res.text());
      alert("Error loading guest list.");
      return;
    }

    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Unable to load guest list.");
      return;
    }

    fullData = data;
    applyHeader();
    applyStats();
    renderGuestList();
  } catch (err) {
    console.error("Error loading guest data:", err);
    alert("Error loading guest list.");
  }
}

function applyHeader() {
  const ev = fullData.event;
  if (!ev) return;

  titleEl.textContent = ev.name || "Event Guest List";

  const when = formatDateTime(ev.date, ev.time);
  const where = ev.location || "Online / TBA";
  metaEl.textContent = `${when} • ${where}`;
}

function applyStats() {
  const s = fullData.stats || {
    totalRsvps: 0,
    memberRsvps: 0,
    guestRsvps: 0,
    totalGuests: 0,
  };

  statTotalRsvps.textContent = s.totalRsvps;
  statMemberRsvps.textContent = s.memberRsvps;
  statGuestRsvps.textContent = s.guestRsvps;
  statTotalGuests.textContent = s.totalGuests;
}

function renderGuestList() {
  if (!guestListEl) return;

  const members = fullData.members || [];
  const guests = fullData.guests || [];

  let items = [];

  // Normalize both into same shape
  members.forEach((m) => {
    items.push({
      rsvpType: "member",
      name: (m.first_name || "") + " " + (m.last_name || ""),
      email: m.email || "",
      guests: m.guests || 1,
      comments: m.comments || "",
      created_at: m.created_at,
    });
  });

  guests.forEach((g) => {
    items.push({
      rsvpType: "guest",
      name: g.name || "",
      email: g.email || "",
      guests: g.guests || 1,
      comments: g.comments || "",
      created_at: g.created_at,
    });
  });

  // Filter by pill
  if (currentFilter === "member") {
    items = items.filter((i) => i.rsvpType === "member");
  } else if (currentFilter === "guest") {
    items = items.filter((i) => i.rsvpType === "guest");
  }

  // Search
  if (currentSearch) {
    items = items.filter((i) => {
      const name = (i.name || "").toLowerCase();
      const email = (i.email || "").toLowerCase();
      return name.includes(currentSearch) || email.includes(currentSearch);
    });
  }

  // Sort: newest first
  items.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

  guestListEl.innerHTML = "";

  if (!items.length) {
    guestEmptyState.style.display = "block";
    guestEmptyState.textContent = "No RSVPs yet for this filter.";
    return;
  } else {
    guestEmptyState.style.display = "none";
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "guest-card";

    const header = document.createElement("div");
    header.className = "guest-card-header";

    const left = document.createElement("div");
    const nameEl = document.createElement("div");
    nameEl.className = "guest-name";
    nameEl.textContent = item.name || "(No name)";

    const emailEl = document.createElement("div");
    emailEl.className = "guest-email";
    emailEl.textContent = item.email || "No email";

    left.appendChild(nameEl);
    left.appendChild(emailEl);

    const pill = document.createElement("span");
    pill.className = "guest-type-pill " +
      (item.rsvpType === "member" ? "guest-type-member" : "guest-type-guest");
    pill.textContent = item.rsvpType === "member" ? "Member" : "Guest";

    header.appendChild(left);
    header.appendChild(pill);

    const meta = document.createElement("div");
    meta.className = "guest-meta";
    const guestCount = item.guests || 1;
    const when = item.created_at
      ? new Date(item.created_at).toLocaleString()
      : "Time unknown";
    meta.textContent = `${guestCount} attending • RSVP on ${when}`;

    card.appendChild(header);
    card.appendChild(meta);

    if (item.comments && item.comments.trim().length > 0) {
      const commentsEl = document.createElement("div");
      commentsEl.className = "guest-comments";
      commentsEl.textContent = item.comments;
      card.appendChild(commentsEl);
    }

    guestListEl.appendChild(card);
  });
}

// Helpers

function formatDateTime(dateStr, timeStr) {
  if (!dateStr) return "Date TBA";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const datePart = dateObj.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  if (!timeStr) return datePart;

  const [hh, mm] = timeStr.split(":").map(Number);
  const t = new Date();
  t.setHours(hh || 0, mm || 0, 0, 0);
  const timePart = t.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${datePart} • ${timePart}`;
}

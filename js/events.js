document.addEventListener("DOMContentLoaded", () => {
  initEventsPage().catch((e) => console.error("[Events] init failed:", e));
});

async function initEventsPage() {
if (window.__hcEventsLoaded) {
  console.warn("events.js already loaded — skipping re-init");
  return;
}
window.__hcEventsLoaded = true;


// ===========================================
// HOLY CIRCLE — PUBLIC EVENTS CALENDAR
// ===========================================

let allEvents = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let currentFilter = "all";


// DOM elements
const calendarGrid = document.getElementById("calendarGrid");
const monthLabel = document.getElementById("calMonthLabel");
const btnPrev = document.getElementById("calPrev");
const btnNext = document.getElementById("calNext");
const eventList = document.getElementById("eventList");

// Filter buttons
const filterButtons = document.querySelectorAll(".filter-btn");

// Month navigation
if (btnPrev) btnPrev.addEventListener("click", prevMonth);
if (btnNext) btnNext.addEventListener("click", nextMonth);

// Filters
filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterButtons.forEach((b) => b.classList.remove("filter-btn-active"));
    btn.classList.add("filter-btn-active");
    currentFilter = btn.dataset.filter || "all";
    renderCalendar();
    renderUpcomingList();
  });
});

// Load events then render
await loadEvents();
renderCalendar();
renderUpcomingList();



// ===========================================
// LOAD EVENTS FROM BACKEND
// ===========================================

async function loadEvents() {
  try {
    const res = await fetch("/api/events");
  if (!res.ok) {
    console.error("Error loading events:", await res.text());
    allEvents = [];
    renderCalendar();
    renderUpcomingList();
    return;
  }


    const data = await res.json();
    let events = Array.isArray(data) ? data : data.events || [];
    allEvents = events.map((ev) => ({
      id: ev.id,
      name: ev.name || "",
      date: ev.date ? String(ev.date).slice(0, 10) : "",
      time: ev.time || "",
      location: ev.location || "",
      type: ev.type || "other",
      status: ev.status || "upcoming",
      description: ev.description || "",
    }));
  } catch (err) {
    console.error("Error loading events:", err);
  }
}

// ===========================================
// CALENDAR RENDERING
// ===========================================

function renderCalendar() {
  if (!calendarGrid || !monthLabel) return;

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  monthLabel.textContent = `${monthNames[currentMonth]} ${currentYear}`;

  calendarGrid.innerHTML = "";

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Blank cells before day 1
  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement("div");
    cell.className = "calendar-cell empty";
    calendarGrid.appendChild(cell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.className = "calendar-cell";

    const dateStr = buildDateString(currentYear, currentMonth + 1, day);
    const todaysEvents = getFilteredEvents().filter((ev) => ev.date === dateStr);

    
    const header = document.createElement("div");
    header.className = "calendar-day-number";
    header.textContent = day;
    cell.appendChild(header);

    const eventsWrap = document.createElement("div");
    eventsWrap.className = "calendar-events";

    todaysEvents.forEach((ev) => {
      const typeKey = normalizeType(ev.type);
      const link = document.createElement("a");
      link.className = `calendar-event event-${typeKey}`;
      link.href = `event-details.html?id=${encodeURIComponent(ev.id)}`;
      link.textContent = ev.name || "Event";
      // C: title itself is clickable, no extra button
      eventsWrap.appendChild(link);
    });

    cell.appendChild(eventsWrap);
    calendarGrid.appendChild(cell);
  }
}

// ===========================================
// UPCOMING LIST
// ===========================================

function renderUpcomingList() {
  if (!eventList) return;

  const upcoming = getFilteredEvents()
    .filter((ev) => isUpcoming(ev.date))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!upcoming.length) {
    eventList.innerHTML = `<p class="empty">No upcoming events for this filter.</p>`;
    return;
  }

  eventList.innerHTML = "";
  upcoming.forEach((ev) => {
    const item = document.createElement("article");
    item.className = "upcoming-item";

    const title = document.createElement("h3");
    title.textContent = ev.name || "Event";

    const meta = document.createElement("p");
    meta.className = "upcoming-meta";
    meta.textContent = `${formatDateTime(ev.date, ev.time)}${
      ev.location ? " • " + ev.location : ""
    }`;

    const typeLabelEl = document.createElement("p");
    typeLabelEl.className = "upcoming-type";
    typeLabelEl.textContent = typeLabelReadable(normalizeType(ev.type));

    // 2: Button under the text
    const btn = document.createElement("a");
    btn.className = "detail-btn";
    btn.href = `event-details.html?id=${encodeURIComponent(ev.id)}`;
    btn.textContent = "View Details";

    item.appendChild(title);
    item.appendChild(meta);
    item.appendChild(typeLabelEl);
    item.appendChild(btn);

    eventList.appendChild(item);
  });
}

// ===========================================
// FILTER & HELPERS
// ===========================================

function getFilteredEvents() {
  if (currentFilter === "all") return allEvents;

  return allEvents.filter((ev) => {
    const typeKey = normalizeType(ev.type);
    if (currentFilter === "worship") return typeKey === "worship";
    if (currentFilter === "community") return typeKey === "community";
    if (currentFilter === "podcast") return typeKey === "podcast";
    if (currentFilter === "online") return typeKey === "online";
    return true;
  });
}

function normalizeType(raw) {
  const t = String(raw || "").toLowerCase();

  // Current admin types: worship, bible, youth, community, online, other
  if (t === "worship" || t.includes("worship")) return "worship";
  if (t === "community" || t.includes("community") || t.includes("outreach"))
    return "community";
  if (t === "podcast" || t.includes("podcast")) return "podcast";
   if (t === "online" || t.includes("online")) return "online";

  if (t === "bible") return "bible";
  if (t === "youth") return "youth";
  return "other";
}

function typeLabelReadable(typeKey) {
  switch (typeKey) {
    case "worship":
      return "Worship";
    case "community":
      return "Community";
    case "podcast":
      return "Podcast";
    case "online":
      return "Online";
    case "bible":
      return "Bible Study";
    case "youth":
      return "Youth";
    default:
      return "Other";
  }
}

function buildDateString(year, month, day) {
  return [
    String(year),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function isUpcoming(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  const date = new Date(dateStr + "T00:00:00");
  return (
    date >= new Date(today.getFullYear(), today.getMonth(), today.getDate())
  );
}

function formatDateTime(dateStr, timeStr) {
  if (!dateStr) return "";
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

// Month nav
function nextMonth() {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCalendar();
}

function prevMonth() {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderCalendar();
}

}
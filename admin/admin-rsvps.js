/********************************
 * RSVP MANAGER — EVENT LIST PAGE
 ********************************/

// Require login as owner/admin
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

// Show admin name
document.getElementById("adminName").textContent =
  localStorage.getItem("adminName") || localStorage.getItem("adminEmail");

// ---- CONFIG ----
// Now using your Node backend:
const RSVP_API_URL = "/api/admin/rsvps";

// ---- ELEMENTS ----
const eventsList    = document.getElementById("rsvpEventsList");
const totalEventsEl = document.getElementById("totalEvents");
const totalRSVPEl   = document.getElementById("totalRSVPs");
const eventsEmpty   = document.getElementById("eventsEmpty");

/**
 * Load all events with their RSVP counts
 */
async function loadEvents() {
  try {
    const res = await fetch(`${RSVP_API_URL}/events`);
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to load events");
    }

    const events = data.events || [];

    // Handle empty state
    if (!events.length) {
      eventsEmpty.classList.remove("hidden");
      eventsList.innerHTML = "";
      totalEventsEl.textContent = "0";
      totalRSVPEl.textContent = "0";
      return;
    }

    eventsEmpty.classList.add("hidden");

    // Update summary
    totalEventsEl.textContent = events.length;
    totalRSVPEl.textContent = events.reduce(
      (t, e) => t + (Number(e.count) || 0),
      0
    );

    // Build event cards
    eventsList.innerHTML = "";

    events.forEach((ev) => {
      const card = document.createElement("div");
      card.className = "event-card";

      card.innerHTML = `
        <h3>${ev.title}</h3>
        <p>${ev.date || ""}</p>
        <p><strong>${ev.count || 0}</strong> RSVP${ev.count == 1 ? "" : "s"}</p>
        <button class="table-btn" data-id="${ev.id}">
          View RSVPs
        </button>
      `;

      eventsList.appendChild(card);
    });
  } catch (err) {
    console.error("Error loading event RSVP list:", err);
    eventsEmpty.textContent = "Error loading events.";
    eventsEmpty.classList.remove("hidden");
  }
}

// ---- Click Handler for View RSVPs ----
eventsList.addEventListener("click", (e) => {
  const btn = e.target.closest("button.table-btn");
  if (!btn) return;

  const id = btn.getAttribute("data-id");
  if (!id) return;

  // Redirect to RSVP detail page
  window.location.href = `admin-rsvp-details.html?id=${encodeURIComponent(
    id
  )}`;
});

// ---- INITIAL LOAD ----
loadEvents();

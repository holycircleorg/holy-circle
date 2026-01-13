// ===========================================
// EVENT DETAILS — PUBLIC PAGE
// ===========================================

document.addEventListener("DOMContentLoaded", initEventDetails);

async function initEventDetails() {
  const params = new URLSearchParams(window.location.search);
  const eventId = Number(params.get("id"));

  if (!eventId) {
    showError("Invalid event.");
    return;
  }

  try {
    const res = await fetch(`/api/events/${eventId}`);
    if (!res.ok) throw new Error("Event not found");

    const event = await res.json();
    hydrateEvent(event);
    wireCalendarButtons(event);
    wireRsvpButtons(eventId);
  } catch (err) {
    console.error("Event load failed:", err);
    showError("This event could not be loaded.");
  }
}

// -------------------------------------------
// Populate UI
// -------------------------------------------
function hydrateEvent(event) {
  // HERO
  setText("eventTitle", event.name);
  setText("eventTypePill", event.type || "Event");
  setText("eventDateTime", `${formatDate(event.date)} • ${event.time}`);
  setText("eventLocation", event.location);

  // DESCRIPTION
  setText("eventDescription", event.description || "");

  // DETAILS CARD
  setText("eventDateDetail", formatDate(event.date));
  setText("eventTimeDetail", event.time);
  setText("eventLocationDetail", event.location);
  setText("eventTypeDetail", event.type);

  document.title = `${event.name} | Holy Circle`;
}

// -------------------------------------------
// RSVP BUTTONS
// -------------------------------------------
function wireRsvpButtons(eventId) {
  const heroBtn = document.getElementById("rsvpBtn");
  const sideBtn = document.getElementById("rsvpSideBtn");

  if (heroBtn) heroBtn.onclick = () => openRsvp(eventId);
  if (sideBtn) sideBtn.onclick = () => openRsvp(eventId);
}

function openRsvp(eventId) {
  if (window.hcUser?.loggedIn) {
    submitMemberRsvp(eventId);
  } else {
    openGuestModal(eventId);
  }
}

async function submitMemberRsvp(eventId) {
  try {
    const res = await fetch(`/api/events/${eventId}/rsvp-member`, {
      method: "POST",
      credentials: "include"
    });

    const data = await res.json();
    if (!data.success) throw new Error();

    updateRsvpUI();
  } catch (err) {
    alert("Unable to RSVP at this time.");
  }
}

function updateRsvpUI() {
  const buttons = [
    document.getElementById("rsvpBtn"),
    document.getElementById("rsvpSideBtn")
  ];

  buttons.forEach(btn => {
    if (!btn) return;
    btn.textContent = "You're going ✓";
    btn.disabled = true;
    btn.style.opacity = "0.7";
  });

  const status = document.getElementById("rsvpStatusText");
  if (status) {
    status.textContent = "You're confirmed for this event.";
  }
}



// -------------------------------------------
// GUEST RSVP MODAL
// -------------------------------------------
function openGuestModal(eventId) {
  const overlay = document.getElementById("guestRsvpOverlay");
  const modal = document.getElementById("guestRsvpModal");

  overlay.classList.add("open");
  modal.classList.add("open");

  document
    .getElementById("closeGuestModal")
    .addEventListener("click", closeGuestModal);

  document
    .getElementById("guestRsvpForm")
    .onsubmit = (e) => submitGuestRsvp(e, eventId);
}

function closeGuestModal() {
  document.getElementById("guestRsvpOverlay").classList.remove("open");
  document.getElementById("guestRsvpModal").classList.remove("open");
}

// -------------------------------------------
// SUBMIT GUEST RSVP
// -------------------------------------------
async function submitGuestRsvp(e, eventId) {
  e.preventDefault();

  const payload = {
    name: val("guestName"),
    email: val("guestEmail"),
    guests: val("guestGuests"),
    comments: val("guestComments")
  };

  try {
    const res = await fetch(`/api/events/${eventId}/rsvps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.success) throw new Error();

    document.getElementById("guestRsvpMessage").textContent =
      "You're confirmed! See you there ✨";

    setTimeout(closeGuestModal, 1400);
  } catch {
    document.getElementById("guestRsvpMessage").textContent =
      "Something went wrong. Please try again.";
  }
}

// -------------------------------------------
// CALENDAR BUTTONS
// -------------------------------------------
function wireCalendarButtons(event) {
  const googleBtn = document.getElementById("addGoogleCalBtn");
  const appleBtn = document.getElementById("addAppleCalBtn");

  if (googleBtn) {
    googleBtn.onclick = () =>
      window.open(buildGoogleCalLink(event), "_blank");
  }

  if (appleBtn) {
    appleBtn.onclick = () =>
      alert("Apple Calendar export coming next ✔");
  }
}

// -------------------------------------------
// HELPERS
// -------------------------------------------
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function val(id) {
  return document.getElementById(id)?.value || "";
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

function showError(message) {
  setText("eventTitle", message);
}

function buildGoogleCalLink(event) {
  const start = event.date.replace(/-/g, "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    event.name
  )}&details=${encodeURIComponent(
    event.description || ""
  )}&location=${encodeURIComponent(event.location)}&dates=${start}/${start}`;
}

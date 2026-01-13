/************************************
 * RSVP DETAIL PAGE (ADMIN VERSION)
 ************************************/

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

document.getElementById("adminName").textContent =
  localStorage.getItem("adminName") || localStorage.getItem("adminEmail");

// ---- CONFIG ----
const RSVP_API_URL = "/api/admin/rsvps";

// ---- ELEMENTS ----
const params   = new URLSearchParams(window.location.search);
const eventId  = params.get("id");

const titleEl   = document.getElementById("eventTitle");
const dateEl    = document.getElementById("eventDate");
const locEl     = document.getElementById("eventLocation");
const countEl   = document.getElementById("eventCount");
const exportBtn = document.getElementById("exportBtn");

const rsvpTableBody = document.querySelector("#rsvpTable tbody");
const rsvpEmpty     = document.getElementById("rsvpEmpty");
// ---- FILTER ELEMENTS ----
const searchInput    = document.getElementById("searchInput");
const contactFilter  = document.getElementById("contactFilter");
const memberFilter   = document.getElementById("memberFilter");
const applyBtn       = document.getElementById("applyFilters");

// Refresh the table when filters apply
if (applyBtn) {
  applyBtn.addEventListener("click", () => {
    loadEventRSVPs();
  });
}

/**
 * Load RSVP Data for this event
 */
async function loadEventRSVPs() {
  const search     = searchInput?.value || "";
  const contacted  = contactFilter?.value || "";
  const memberOnly = memberFilter?.value || "";

  const query = new URLSearchParams();
  if (search)     query.append("search", search);
  if (contacted)  query.append("contacted", contacted);
  if (memberOnly) query.append("memberOnly", "1");

  try {
    const res = await fetch(`${RSVP_API_URL}/events/${eventId}?${query.toString()}`);
    const data = await res.json();

    console.log("RSVP Detail Loaded:", data);

    if (!data.success) {
      throw new Error(data.error || "Failed to load RSVPs");
    }

    // Fill event header
    titleEl.textContent = data.title || "(Untitled Event)";
    dateEl.textContent = data.date || "—";
    locEl.textContent  = data.location || "—";

    const rsvps = data.rsvps || [];
    countEl.textContent = rsvps.length.toString();

    // CSV export
    exportBtn.href = `${RSVP_API_URL}/events/${eventId}/export`;

    if (!rsvps.length) {
      rsvpEmpty.classList.remove("hidden");
      rsvpTableBody.innerHTML = "";
      return;
    }

    rsvpEmpty.classList.add("hidden");
    rsvpTableBody.innerHTML = "";

    rsvps.forEach((r) => {
      const contactedStatus = r.contacted === "YES" ? "YES" : "NO";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.name || ""}</td>
        <td>${r.email || ""}</td>
        <td>${r.guests || 1}</td>
        <td>${r.comments || ""}</td>
        <td>
          <button
            class="contacted-btn"
            data-id="${r.id}"
            data-status="${contactedStatus}">
            ${contactedStatus === "YES" ? "Mark Uncontacted" : "Mark Contacted"}
          </button>
        </td>
      `;

      rsvpTableBody.appendChild(tr);
    });

  } catch (err) {
    console.error("Error loading RSVP details:", err);
    titleEl.textContent = "Error Loading Event";
  }


  try {
    const res = await fetch(`${RSVP_API_URL}/events/${eventId}`);
    const data = await res.json();

    console.log("RSVP Detail Loaded:", data);

    if (!data.success) {
      throw new Error(data.error || "Failed to load RSVPs");
    }

    // Fill event header
    titleEl.textContent = data.title || "(Untitled Event)";
    dateEl.textContent = data.date || "—";
    locEl.textContent  = data.location || "—";

    const rsvps = data.rsvps || [];
    countEl.textContent = rsvps.length.toString();

    // CSV export link
    exportBtn.href = `${RSVP_API_URL}/events/${eventId}/export`;

    // Handle no RSVPs
    if (!rsvps.length) {
      rsvpEmpty.classList.remove("hidden");
      rsvpTableBody.innerHTML = "";
      return;
    } else {
      rsvpEmpty.classList.add("hidden");
    }

    // Build RSVP table
    rsvpTableBody.innerHTML = "";

    rsvps.forEach((r) => {
      const tr = document.createElement("tr");

      const contactedStatus = r.contacted === "YES" ? "YES" : "NO";

      tr.innerHTML = `
        <td>${r.name || ""}</td>
        <td>${r.email || ""}</td>
        <td>${r.guests || 1}</td>
        <td>${r.comments || ""}</td>
        <td>
          <button
            class="contacted-btn"
            data-id="${r.id}"
            data-status="${contactedStatus}">
            ${
              contactedStatus === "YES"
                ? "Mark Uncontacted"
                : "Mark Contacted"
            }
          </button>
        </td>
      `;

      rsvpTableBody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error loading RSVP details:", err);
    titleEl.textContent = "Error Loading Event";
  }
}

/**
 * Toggle Contacted / Uncontacted
 */
rsvpTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest(".contacted-btn");
  if (!btn) return;

  const rsvpId   = btn.getAttribute("data-id");
  const current  = btn.getAttribute("data-status") || "NO";
  const newStatus = current === "YES" ? "NO" : "YES";

  try {
    const res = await fetch(`${RSVP_API_URL}/rsvps/${rsvpId}/contacted`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contacted: newStatus }),
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Failed to update");

    // Update UI
    btn.setAttribute("data-status", newStatus);
    btn.textContent =
      newStatus === "YES" ? "Mark Uncontacted" : "Mark Contacted";
  } catch (err) {
    console.error("Error updating contacted status:", err);
    alert("Could not update contacted status.");
  }
});

// Load the event
loadEventRSVPs();

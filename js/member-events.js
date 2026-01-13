// ===========================================
// HOLY CIRCLE — MEMBER EVENT MANAGEMENT
// Loads RSVPs & allows cancellation
// ===========================================

document.addEventListener("DOMContentLoaded", () => {
    hcRequireMember();
    updateNavbarAuthState();
    loadMemberEvents();
  });
  
  async function loadMemberEvents() {
    const res = await fetch("/api/members/events", {
      credentials: "include"
    });
  
    const json = await res.json();
    if (!json.success) return;
  
    const upcoming = json.upcoming;
    const past = json.past;
  
    fillEventList("upcomingEvents", upcoming, false);
    fillEventList("pastEvents", past, true);
  }
  
  function fillEventList(containerId, events, isPast) {
    const box = document.getElementById(containerId);
    box.innerHTML = "";
  
    if (!events || events.length === 0) {
      box.innerHTML = `<p style="color:#555;">No events found.</p>`;
      return;
    }
  
    events.forEach(ev => {
      box.innerHTML += `
        <div class="event-item">
          <div>
            <strong>${ev.title}</strong>  
            <div class="event-meta">
              ${new Date(ev.date).toLocaleDateString()}  
              • ${ev.location}
            </div>
          </div>
  
          <div class="event-actions">
            <a href="/events/${ev.id}" class="btn-member-ghost">View</a>
  
            ${isPast ? "" : `
              <button class="btn-cancel-rsvp"
                onclick="cancelRSVP(${ev.id})">Cancel</button>
            `}
          </div>
        </div>
      `;
    });
  }
  

  
  // CANCEL RSVP
  async function cancelRSVP(eventId) {
    const sure = confirm("Cancel your RSVP for this event?");
    if (!sure) return;
  
    const res = await fetch(`/api/members/events/${eventId}/cancel`, {
      method: "POST",
      credentials: "include"
    });
  
    const json = await res.json();
    if (json.success) {
      alert("Your RSVP has been cancelled.");
      loadMemberEvents(); // refresh
    }
  }
  
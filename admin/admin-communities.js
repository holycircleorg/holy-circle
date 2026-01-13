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


async function loadPendingCommunities() {
  const container = document.getElementById("adminCommunitiesList");

  try {
    const res = await fetch("/api/forum/admin/communities", {
      credentials: "include"
    });

    if (!res.ok) throw new Error("Failed to load");

    const { communities } = await res.json();

    if (!communities.length) {
      container.innerHTML = "<p>No pending communities 🎉</p>";
      return;
    }

    container.innerHTML = "";

    communities.forEach(c => {
      const card = document.createElement("div");
      card.className = "admin-card";

      card.innerHTML = `
        <h3>${c.name}</h3>
        <p>${c.description}</p>
        <small>Created by ${c.creator_name}</small>

        <div class="admin-actions">
          <button data-id="${c.id}" data-action="approved">Approve</button>
          <button data-id="${c.id}" data-action="rejected">Reject</button>
        </div>
      `;

      card.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () =>
          submitDecision(c.id, btn.dataset.action)
        );
      });

      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = "<p>Error loading communities</p>";
  }
}

async function submitDecision(id, decision) {
  await fetch(`/api/forum/admin/communities/${id}/decision`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision })
  });

  loadPendingCommunities();
}

document.addEventListener("DOMContentLoaded", loadPendingCommunities);

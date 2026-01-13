
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

async function loadProfiles() {
  const wrap = document.getElementById("adminProfiles");
  wrap.innerHTML = "Loading…";

  const res = await fetch("/api/admin/profiles", { credentials: "include" });
  const data = await res.json();

  if (!res.ok) {
    wrap.innerHTML = data.error || "Failed to load";
    return;
  }

  wrap.innerHTML = data.profiles.map(p => `
    <div class="notification-item" style="margin-bottom:12px;">
      <div class="notification-body">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
          <div>
            <div class="notification-text"><strong>${p.first_name || ""} ${p.last_name || ""}</strong> (@${p.username || "—"})</div>
            <div class="notification-meta">
              visibility: ${p.profile_visibility || "public"} • status: ${p.profile_status || "active"}
              ${p.moderation_reason ? ` • reason: ${p.moderation_reason}` : ""}
            </div>
          </div>

          <div style="display:flex;gap:8px;align-items:center;">
            <select data-status="${p.id}">
              <option value="active" ${p.profile_status==="active"?"selected":""}>active</option>
              <option value="flagged" ${p.profile_status==="flagged"?"selected":""}>flagged</option>
              <option value="hidden" ${p.profile_status==="hidden"?"selected":""}>hidden</option>
            </select>
            <input data-reason="${p.id}" placeholder="Reason (optional)" style="min-width:220px;" />
            <button class="btn-outline" data-save="${p.id}">Save</button>
          </div>
        </div>
      </div>
    </div>
  `).join("");

  wrap.querySelectorAll("[data-save]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-save");
      const status = wrap.querySelector(`[data-status="${id}"]`).value;
      const reason = wrap.querySelector(`[data-reason="${id}"]`).value;

      const r = await fetch(`/api/admin/profiles/${id}/moderate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_status: status, moderation_reason: reason })
      });

      const j = await r.json();
      if (!r.ok) return alert(j.error || "Failed");
      alert("Saved.");
      loadProfiles();
    });
  });
}
async function hideAvatar(memberId) {
  const confirmHide = confirm(
    "Are you sure you want to hide this avatar?"
  );
  if (!confirmHide) return;

  const res = await fetch(
    `/api/admin/members/${memberId}/avatar/hide`,
    {
      method: "POST",
      credentials: "include",
    }
  );

  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "Failed to hide avatar");
    return;
  }

  alert("Avatar hidden successfully");

  // Optional: update UI instantly
  const avatarImg = document.querySelector("#profileAvatar");
  if (avatarImg) {
    avatarImg.src = "/images/avatar-placeholder.png";
  }
}

document.addEventListener("DOMContentLoaded", loadProfiles);


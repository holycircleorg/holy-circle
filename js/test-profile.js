function renderProfile(_) {
  // Intentionally empty — profile is already rendered elsewhere
}

function getProfileIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  return id ? Number(id) : null;
}

async function loadMemberProfile() {



 const mobileAvatarName = document.getElementById("mobileAvatarName");

  const profileId = getProfileIdFromUrl();

  const endpoint = profileId
    ? `/api/members/${profileId}/profile`
    : `/api/members/me/profile`;

  const res = await fetch(endpoint, { credentials: "include" });
  const data = await res.json();

  if (data?.id) {
  loadMemberBadges(data.id);
}
  const memberName = `${data.first_name} ${data.last_name}`;

  if (!res.ok) {
    console.error(data.error);
    return;
  }



function renderProfileBadges(badges) {
  const container = document.getElementById("profileBadges");
  if (!container) return;

  if (!Array.isArray(badges) || badges.length === 0) {
    container.hidden = true;
    return;
  }

  container.hidden = false;

  container.innerHTML = badges
    .map(
      (b) => `
        <div class="profile-badge" title="${b.name}">
          <img
            src="${b.icon_url}"
            alt="${b.name}"
            loading="lazy"
          />
        </div>
      `
    )
    .join("");
}


 

  document.getElementById("memberName").textContent = memberName;


  document.getElementById("memberSince").textContent =
    `Member since ${new Date(data.created_at).toLocaleDateString()}`;

  document.getElementById("testimony").textContent =
    data.testimony || "—";

  document.getElementById("favoriteVerse").textContent =
    data.favorite_verse
      ? `${data.favorite_verse} (${data.favorite_verse_ref})`
      : "—";

  document.getElementById("formStatus").textContent = data.profile_status;
 
  const lastLoginEl = document.getElementById("memberLastLogin");
if (lastLoginEl) {
  lastLoginEl.textContent = data.last_login
    ? new Date(data.last_login).toLocaleString()
    : "—";
}
if (data.avatar_url) {
  (function waitForAvatarEngine() {
    if (window.AvatarEngine && typeof window.AvatarEngine.sync === "function") {
      window.AvatarEngine.sync(data.avatar_url);
    } else {
      setTimeout(waitForAvatarEngine, 50);
    }
  })();
}



}



document.addEventListener("DOMContentLoaded", loadMemberProfile);

async function loadMemberBadges(memberId) {
  const res = await fetch(`/api/badges/member/${memberId}`, {
    credentials: "include"
  });

  const data = await res.json();
  const box = document.getElementById("memberBadges");
  if (!box) return;

  if (!data.badges || !data.badges.length) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = data.badges.map(b => `
    <div class="badge" title="${b.name}">
      <img src="${b.icon}" alt="${b.name}" />
    </div>
  `).join("");
}

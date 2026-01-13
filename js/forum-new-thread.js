// /js/forum-new-thread.js (CLEAN + WIRED)
(function () {
  const API = "/api/forum";
  const qs = (s) => document.querySelector(s);

  function showError(msg) {
    const el = qs("#formError");
    if (!el) return;
    el.textContent = msg || "";
    el.style.display = msg ? "block" : "none";
  }

  async function loadCommunitiesIntoSelect(selectedId = null) {
  const select = qs("#communitySelect");
  if (!select) return;

  select.innerHTML = `<option value="">Loading communities…</option>`;

  const data = await window.hcForumApiGet("/communities", {
    fallback: { communities: [] }
  });

  const communities = Array.isArray(data?.communities)
    ? data.communities
    : [];

  if (!communities.length) {
    select.innerHTML = `<option value="">No communities yet</option>`;
    return;
  }

  select.innerHTML = [
    `<option value="">Select a community</option>`,
    ...communities.map(
      c => `<option value="${c.id}">${c.name}</option>`
    )
  ].join("");

  if (selectedId) {
    select.value = String(selectedId);
  }
}

async function submitThread(e) {
  e.preventDefault();
  showError("");

  const community_id = Number(qs("#communitySelect")?.value);
  const title = qs("#titleInput")?.value?.trim();
  const body = qs("#bodyInput")?.value?.trim();

  if (!community_id || !title || !body) {
    showError("Please fill out community, title, and body.");
    return;
  }

  const data = await window.hcForumApiPost("/threads", {
    community_id,
    title,
    body,
  });

  // 🔔 Notify rest of app that a thread was created
window.dispatchEvent(
  new CustomEvent("hc:thread-created", {
    detail: { communityId: community_id }
  })
);



  if (!data?.threadId) {
    showError("Failed to create thread.");
    return;
  }

  location.href = `/forum-thread.html?id=${data.threadId}`;
}



  async function init() {
    // ensure auth is resolved
    await window.hcGetCurrentMember?.();

    // redirect guests
    if (window.hcUser?._loaded && !window.hcUser.loggedIn) {
      const next = encodeURIComponent("/new-thread.html" + location.search);
      location.href = `/login.html?next=${next}`;
      return;
    }

    const communityId = new URLSearchParams(location.search).get("community_id");
    const selectedId = communityId ? Number(communityId) : null;

    await loadCommunitiesIntoSelect(selectedId);

    const form = qs("#newThreadForm");
    if (form) form.addEventListener("submit", submitThread);
  }

  function boot() {
    if (boot.__ran) return;
    boot.__ran = true;
    init().catch(console.error);
  }

  // Run after DOM is ready + after auth is ready (whichever comes last)
  const domReady = () =>
    document.readyState === "loading"
      ? new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true }))
      : Promise.resolve();

  domReady().then(() => {
    if (window.hcUser && window.hcUser._loaded) boot();
    else window.addEventListener("hc:auth-ready", boot, { once: true });
  });
})();

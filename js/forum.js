// js/forum.js
if (window.__hcForumPageLoaded) {
  console.warn("forum.js already initialized");
} else {
  window.__hcForumPageLoaded = true;

  (function () {
  if (!window.hcForumUtils || !window.hcForumApiGet) {
  console.error("Forum globals not ready");
  return;
}

const { qs, qsa, esc, timeAgo, formatName } = window.hcForumUtils;




      async function loadThreads({
      communityId = null,
      sort = "new",
      q = ""
    } = {}) {
      const list = qs("#threadsList");
      if (!list) return;

      list.innerHTML = `<div class="muted">Loading threads…</div>`;

      const params = new URLSearchParams();
      const scopedCommunityId =
      communityId ??
      window.__ACTIVE_COMMUNITY_ID ??
      null;

    if (scopedCommunityId) {
      params.set("community_id", String(scopedCommunityId));
    }

      if (sort) params.set("sort", sort);
      if (q) params.set("q", q);

        const data = await hcForumApiGet(`/threads?${params.toString()}`, {
        fallback: { threads: [] }
      });

      const threads = Array.isArray(data?.threads) ? data.threads : [];


      if (!threads.length) {
        list.innerHTML = `<div class="muted">No threads yet.</div>`;
        return;
      }

      list.innerHTML = threads.map(t => `
        <div class="thread-row" data-thread-id="${t.id}">
          <div class="thread-main">
            <a href="/forum-thread.html?id=${t.id}${location.search}" class="thread-link">



              ${esc(t.title)}
            </a>
            <div class="thread-meta">
              <span>${esc(formatName(t))}</span>
              <span class="dot">•</span>
              <span>${timeAgo(t.created_at)}</span>
              <span class="dot">•</span>
              <span>${Number(t.reply_count || 0)} replies</span>
            </div>
          </div>
          <div class="thread-actions">
            <button class="amen-btn ${t.viewer_amened ? "is-on" : ""}" data-amen-thread>
              Amen <span class="count">${Number(t.amen_count || 0)}</span>
            </button>
          </div>
        </div>
      `).join("");
    }
    window.loadThreads = loadThreads;


    function initSortChips({ communityId = null } = {}) {
      qsa("[data-sort]").forEach(chip => {
        if (chip.__bound) return;
        chip.__bound = true;

        chip.addEventListener("click", async () => {
          qsa("[data-sort]").forEach(c => c.classList.remove("is-active"));
          chip.classList.add("is-active");
         await loadThreads({
            communityId:
              communityId ??
              window.__ACTIVE_COMMUNITY_ID ??
              null,
            sort: chip.dataset.sort || "new"
          });

        });
      });
    }

window.initForumSearch = function initForumSearch(
  { communityId = null, sort = "new" } = {}
) {
  const input = document.getElementById("forumSearch");
  if (!input) return;

  const btn =
    document.querySelector("[data-forum-search-btn]") ||
    document.querySelector(".forum-search-btn");

  const runSearch = async () => {
    const q = input.value.trim();

    const params = new URLSearchParams(location.search);
    if (q) params.set("q", q);
    else params.delete("q");

    history.replaceState(
      null,
      "",
      `${location.pathname}?${params.toString()}`
    );

    await loadThreads({
      communityId,
      sort,
      q
    });
  };

  // 🔁 restore search from URL
  const urlParams = new URLSearchParams(location.search);
  input.value = urlParams.get("q") || "";

  // 🔍 typing (live)
  input.addEventListener("input", () => {
    runSearch();
  });

  // ⌨️ ENTER key
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runSearch();
    }
  });

  // 🖱 search icon click
  if (btn && !btn.__bound) {
    btn.__bound = true;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      runSearch();
    });
  }
};



window.loadTrendingThreads = async function () {

  const box = document.getElementById("trendingThreads");
  if (!box) return;



  const communityId =
    window.__ACTIVE_COMMUNITY_ID ||
    Number(new URLSearchParams(location.search).get("community_id")) ||
    null;

  const params = new URLSearchParams();
  if (communityId) params.set("community_id", communityId);
  params.set("sort", "top");

  const data = await hcForumApiGet(`/threads?${params.toString()}`, {
    fallback: { threads: [] }
  });

  const threads = (data?.threads || []).slice(0, 3);

  if (!threads.length) {
    box.innerHTML = `<div class="muted">No trending threads</div>`;
    return;
  }

  box.innerHTML = threads.map(t => `
    <a
      href="/forum-thread.html?id=${t.id}"
      class="trending-thread"
      title="${esc(t.title)}"
    >
      ${esc(t.title)}
    </a>
  `).join("");
}





async function initPage() {
  const params = new URLSearchParams(location.search);

  const communityId =
    Number(params.get("community_id")) ||
    Number(params.get("id")) ||
    null;

  const q = params.get("q") || "";

  // 🔍 Search (safe: no-ops if input missing)
  initForumSearch({
    communityId,
    sort: "new"
  });

  // Sort chips (forum + community pages only)
  if (document.querySelector("[data-sort]")) {
    initSortChips({ communityId });
  }

  // Thread list (forum + community pages)
  if (document.getElementById("threadsList")) {
    try {
      await loadThreads({
        communityId: communityId || undefined,
        q
      });
    } catch (e) {
      console.warn("[Forum] loadThreads failed:", e);
      const list = qs("#threadsList");
      if (list) {
        list.innerHTML =
          `<div class="muted">Threads unavailable right now.</div>`;
      }
    }
  }

  // Sidebar trending (safe everywhere)
  if (window.loadTrendingThreads) {
    window.loadTrendingThreads();
  }
}
  

window.addEventListener("hc:thread-created", async (e) => {
  const communityId = e.detail?.communityId;
  if (!communityId) return;

  // Only update if this page is showing that community
  if (Number(window.__ACTIVE_COMMUNITY_ID) !== Number(communityId)) return;

  const data = await window.hcForumApiGet(`/communities/${communityId}`);
  if (!data?.community) return;

  const { thread_count } = data.community;

  // Sidebar card
  const sidebarThreadEl = document.querySelector(".thread-count");
  if (sidebarThreadEl) {
    sidebarThreadEl.textContent =
      Number(thread_count).toLocaleString();
  }

  // Community stats block
  const statThreadEl = document.getElementById("statThreads");
  if (statThreadEl) {
    statThreadEl.textContent =
      Number(thread_count).toLocaleString();
  }
});
 

document.addEventListener("DOMContentLoaded", initPage);

  })();
}


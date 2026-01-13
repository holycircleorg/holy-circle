console.log("🔥 forum-thread.js LOADED");


// /js/forum-thread.js  (CLEAN SLATE)
const threadId = Number(new URLSearchParams(location.search).get("id"));



(async function () {
  const API = "/api/forum";
  const qs = (s) => document.querySelector(s);
  const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  let CURRENT_USER_ID = null;
  let AUTH_USER = null;
  let THREAD_LOCKED = false;
  let THREAD_ARCHIVED = false;



  function esc(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));
  }

  function formatName(row) {
    const first = (row.first_name || "").trim();
    const last = (row.last_name || "").trim();
    return (first || last) ? `${first} ${last}`.trim() : "Member";
  }

  function timeAgo(ts) {
    const n = Number(ts);
    if (!n) return "";
    const diff = Date.now() - n;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

async function getJSON(url, fallback = null) {
  try {
    const res = await fetch(url, { credentials: "include" });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}

    if (!res.ok) {
      console.warn("[ThreadAPI] failed:", url, res.status, data || text);
      return fallback;
    }

    return data;
  } catch (err) {
    console.warn("[ThreadAPI] network error:", err);
    return fallback;
  }
}


  function setComposerVisibility() {
    const guestOnly = document.querySelectorAll("[data-guest-only]");
    const memberOnly = document.querySelectorAll("[data-member-only]");
    const authUser = window.hcUser || window.hcuser || null;
    const isLoggedIn = !!authUser?.loggedIn;


    guestOnly.forEach((el) => (el.style.display = isLoggedIn ? "none" : ""));
    memberOnly.forEach((el) => (el.style.display = isLoggedIn ? "" : "none"));
  }

  function enableThreadEdit(thread) {
  const titleEl = document.querySelector(".thread-card-title");
  const bodyEl = document.querySelector(".thread-card-body");
  const expiresAt = thread.created_at + EDIT_WINDOW_MS;
    if (Date.now() > expiresAt) {
      alert("Edit window has expired.");
      return;
    }


  if (!titleEl || !bodyEl) return;

  const titleInput = document.createElement("input");
  titleInput.value = thread.title;
  titleInput.className = "thread-edit-title";

  const bodyTextarea = document.createElement("textarea");
  bodyTextarea.value = thread.body;
  bodyTextarea.className = "thread-edit-body";


  titleEl.replaceWith(titleInput);
  bodyEl.replaceWith(bodyTextarea);

  const actions = document.querySelector(".thread-card-actions");

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-gold btn-sm";
  saveBtn.textContent = "Save";

  saveBtn.onclick = async () => {
    if (Date.now() > expiresAt) {
      alert("Edit window has expired.");
      saveBtn.disabled = true;
      return;
    }

    await fetch(`/api/forum/threads/${thread.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: titleInput.value.trim(),
        body: bodyTextarea.value.trim()
      })
    });

    location.reload();
  };

  actions.appendChild(saveBtn);
}


window.openThreadUpdateComposer = function (threadId) {
  const card = document.querySelector("#threadCard");
  if (!card) return;

  const existing = card.querySelector(".thread-update-composer");
  if (existing) {
    existing.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const container = document.createElement("div");
  container.className = "thread-update-composer";

  container.innerHTML = `
    <div class="update-hint">
      This update will be appended to the thread (original post cannot be edited).
    </div>

    <textarea
      class="update-textarea"
      placeholder="Write an update…"
      rows="4"
    ></textarea>

    <div class="update-actions">
      <button class="btn btn-gold">Post Update</button>
      <button class="btn btn-ghost cancel">Cancel</button>
    </div>
  `;

  const textarea = container.querySelector("textarea");
  const postBtn = container.querySelector(".btn-gold");
  const cancelBtn = container.querySelector(".cancel");

  cancelBtn.onclick = () => container.remove();

  postBtn.onclick = async () => {
    const body = textarea.value.trim();
    if (!body) return;

    postBtn.disabled = true;

    try {
      const res = await fetch(`/api/forum/threads/${threadId}/updates`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      const out = await res.json().catch(() => null);
      if (!res.ok) throw new Error(out?.error || "Failed to post update");

      container.remove();

      const updatesRes = await getJSON(
        `/api/forum/threads/${threadId}/updates`,
        { updates: [] }
      );

      renderThreadUpdates(updatesRes.updates);

    } catch (e) {
      alert(e.message || "Failed to post update");
      postBtn.disabled = false;
    }
  };

  const updatesBox = document.getElementById("threadUpdates");
  updatesBox ? updatesBox.before(container) : card.appendChild(container);
};




window.openThreadUpdateComposer = window.openThreadUpdateComposer || function () {
  console.warn("openThreadUpdateComposer not initialized yet");
};


  async function loadThread(threadId) {
    // ✅ now that __ACTIVE_COMMUNITY_ID is set


if (window.loadTrendingThreads) {
  window.loadTrendingThreads();
}

    const card = qs("#threadCard");
    if (!card) return;
    

    card.innerHTML = `<div class="muted">Loading thread…</div>`;

const data = await getJSON(`${API}/threads/${threadId}`, null);



// 🔒 HARD CONTRACT NORMALIZATION
const t = data?.thread;

// ==============================
// MODERATOR VISIBILITY FLAG
// ==============================
window.IS_COMMUNITY_MOD = !!data?.community?.viewer_is_mod;


// Make thread state available to replies
THREAD_LOCKED = !!t.is_locked;
THREAD_ARCHIVED = !!t.is_archived;

if (!t || !t.id) {
  card.innerHTML = `
    <div class="muted">
      Thread unavailable.<br />
      <a href="/forum.html">← Back to forum</a>
    </div>
  `;
  return;
}

if (t.is_locked || t.is_archived) {
  const form = document.querySelector("#replyForm");
  if (form) form.remove();

  const list = document.querySelector("#repliesList");
  if (list) {
    list.insertAdjacentHTML(
      "beforebegin",
      `<div class="muted thread-locked">
        🔒 This thread is locked.
      </div>`
    );
  }
}

// 🔥 DEBUG PROBE (temporary but critical)
window._HC_THREAD_DEBUG = t;
console.log("[forum-thread] thread loaded", t);


t.created_at ??= Date.now();
t.edited_at ??= null;
t.update_count ??= 0;
t.updates ??= [];






// 🔑 Expose active community globally (used by sidebar + trending)
window.__ACTIVE_COMMUNITY_ID = Number(t.community_id) || null;
window.joinCommunityRoomSafe?.(window.__ACTIVE_COMMUNITY_ID);



    const amened = Number(t.viewer_amened) === 1;

card.innerHTML = `
  <div class="thread-card-head">
    <h1 class="thread-card-title">${esc(t.title)}</h1>
    <div class="thread-meta">
      <span>${esc(formatName(t))}</span>
      <span class="dot">•</span>
      <span>${timeAgo(t.created_at)}</span>

      ${
        CURRENT_USER_ID === Number(t.member_id) &&
        Date.now() - t.created_at < EDIT_WINDOW_MS
          ? `<span class="dot">•</span>
             <span class="muted" id="editCountdown"></span>`
          : ""
      }

      ${
        t.edited_at
          ? `<span class="dot">•</span>
             <span class="muted">Edited · ${window.hcForumUtils.timeAgo(t.edited_at)}</span>`
          : ""
      }
    </div>
  </div>

  <div class="thread-card-body">${esc(t.body)}</div>

  <div class="thread-card-actions">
    <div class="thread-actions-left">
      <button class="amen-btn ${amened ? "is-on" : ""}" id="amenThreadBtn">
        Amen <span class="count">${Number(t.amen_count || 0)}</span>
      </button>
    </div>

    <div class="thread-actions-right"></div>
  </div>

  <!-- ✅ REQUIRED: updates render target -->
  <div id="threadUpdates" class="thread-updates"></div>
`;


    // ===============================
// LOAD + RENDER THREAD UPDATES
// ===============================
(async () => {
  const updatesRes = await getJSON(
    `${API}/threads/${threadId}/updates`,
    { updates: [] }
  );

  renderThreadUpdates(updatesRes.updates);
})();


// 🔒 Locked / Archived banner
if (t.is_locked || t.is_archived) {
  const meta = qs(".thread-meta");
  if (meta) {
    meta.insertAdjacentHTML(
      "beforeend",
      `<span class="dot">•</span><span class="muted">${t.is_archived ? "Archived" : "Locked"}</span>`
    );
  }
}

// ==============================
// Edit window countdown (author only)
// ==============================
if (CURRENT_USER_ID === Number(t.member_id)) {
  const countdownEl = document.getElementById("editCountdown");
  const editBtn = document.querySelector(".thread-card-actions .btn-ghost");

  if (countdownEl) {
    const expiresAt = t.created_at + EDIT_WINDOW_MS;

    const tick = () => {
      const remaining = expiresAt - Date.now();

      // ⛔ expired → silently remove edit UI
      if (remaining <= 0) {
        countdownEl.remove();
        if (editBtn) editBtn.remove();
        clearInterval(timer);
        return;
      }

      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);

      countdownEl.textContent =
        `Editing available for ${mins}:${String(secs).padStart(2, "0")}`;
    };

    tick();
    const timer = setInterval(tick, 1000);
  }
}


// ===============================
// THREAD ACTIONS (AUTHOR ONLY)
// ===============================
if (
  CURRENT_USER_ID === Number(t.member_id) ||
  window.IS_COMMUNITY_MOD
) {

  const actions = qs(".thread-actions-right");
  actions.classList.add("hc-mod-actions");

  if (!actions) return;

  if (t.is_locked || t.is_archived) {
  return; // stops Add Update, Delete, etc
}

// Lock / Unlock
const lockBtn = document.createElement("button");
lockBtn.className = "hc-action hc-lock";
lockBtn.textContent = t.is_locked ? "Unlock" : "Lock";

lockBtn.onclick = async () => {
  const endpoint = t.is_locked ? "unlock" : "lock";
  const res = await fetch(`${API}/threads/${t.id}/${endpoint}`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return alert("Failed to toggle lock.");
  location.reload();
};

actions.appendChild(lockBtn);

// Archive (one-way)
if (!t.is_archived) {
  const archiveBtn = document.createElement("button");
  archiveBtn.className = "hc-action hc-archive";
  archiveBtn.textContent = "Archive";

  archiveBtn.onclick = async () => {
    if (!confirm("Archive this thread? This is permanent.")) return;
    const res = await fetch(`${API}/threads/${t.id}/archive`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return alert("Failed to archive.");
    location.reload();
  };

  actions.appendChild(archiveBtn);
}



  // Add Update
  const updateBtn = document.createElement("button");
  updateBtn.className = "hc-action hc-update";
  updateBtn.textContent = "Add Update";
  updateBtn.onclick = () => window.openThreadUpdateComposer(threadId);
  actions.appendChild(updateBtn);

  // Delete Thread
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "hc-action hc-delete";
  deleteBtn.textContent = "Delete";

  deleteBtn.onclick = async () => {
    if (!confirm("Delete this thread? This cannot be undone.")) return;

    const res = await fetch(`${API}/threads/${t.id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!res.ok) {
      alert("Failed to delete thread.");
      return;
    }

    location.reload();
  };

  actions.appendChild(deleteBtn);
}











    const amenBtn = qs("#amenThreadBtn");
    if (amenBtn) {
      amenBtn.addEventListener("click", async () => {
        const authUser = window.hcUser || window.hcuser || null;
        if (!authUser?.loggedIn) {
          const next = encodeURIComponent(location.pathname + location.search);
          location.href = `/login.html?next=${next}`;
          return;
        }

        const res = await fetch(`${API}/threads/${threadId}/amen`, {
          method: "POST",
          credentials: "include",
        });

        if (res.status === 401) {
          const next = encodeURIComponent(location.pathname + location.search);
          location.href = `/login.html?next=${next}`;
          return;
        }

        const out = await res.json().catch(() => null);
        if (!res.ok || !out) return;

       if (!amenBtn?.isConnected) return;

        amenBtn.classList.toggle("is-on", !!out.amened);

        const countEl = amenBtn.querySelector(".count");
        if (countEl) {
          countEl.textContent = String(out.amen_count ?? 0);
        }
      });
    }
  }

  async function loadReplies(threadId) {
    const list = qs("#repliesList");
    if (!list) return;

    list.innerHTML = `<div class="muted">Loading replies…</div>`;

   const data = await getJSON(`${API}/threads/${threadId}/replies`, { replies: [] });
   const replies = Array.isArray(data?.replies) ? data.replies : [];


    if (!replies.length) {
      list.innerHTML = `<div class="muted">No replies yet. Be the first.</div>`;
      return;
    }

   list.innerHTML = replies.map((r) => {
  return `
    <div class="reply-row" data-reply-id="${r.id}">
      <div class="reply-meta">
        <span>${r.is_deleted ? "deleted" : esc(formatName(r))}</span>
        <span class="dot">•</span>
        <span>${timeAgo(r.created_at)}</span>

       ${
        !THREAD_LOCKED &&
        !THREAD_ARCHIVED &&
        !r.is_deleted &&
        CURRENT_USER_ID === Number(r.member_id)
          ? `
            <button class="reply-edit-btn">Edit</button>
            <button class="reply-delete-btn">Delete</button>
          `
          : ""
      }

      </div>

      <div class="reply-body ${r.is_deleted ? "deleted" : ""}">
        ${r.is_deleted ? "[deleted]" : renderMentions(r.body)}

      </div>
    </div>
  `;
}).join("");

function renderMentions(text) {
  return esc(text).replace(
    /@([a-zA-Z0-9_]{3,30})/g,
    `<span
      class="mention"
      data-username="$1"
      role="link"
      tabindex="0"
    >@$1</span>`
  );
}







document.querySelectorAll("[data-reply-delete]").forEach(btn => {
  btn.addEventListener("click", async () => {
    const row = btn.closest(".reply-row");
    const replyId = row?.dataset.replyId;
    if (!replyId) return;
    if (THREAD_LOCKED || THREAD_ARCHIVED) {
      alert("This thread is locked.");
      return;
    }


    if (!confirm("Delete this reply?")) return;

    const res = await fetch(`/api/forum/replies/${replyId}`, {
      method: "DELETE",
      credentials: "include"
    });

    if (!res.ok) {
      alert("Failed to delete reply.");
      return;
    }

    await loadReplies(threadId);
  });
});




// ==============================
// Reply edit countdowns
// ==============================
document.querySelectorAll(".reply-edit-countdown").forEach(el => {
  const createdAt = Number(el.dataset.createdAt);
  const replyId = el.dataset.replyId;
  const expiresAt = createdAt + EDIT_WINDOW_MS;

  const tick = () => {
    const remaining = expiresAt - Date.now();

    if (remaining <= 0) {
      el.textContent = "edit window expired";

      // Remove edit button for this reply
      const row = el.closest(".reply-row");
      const editBtn = row?.querySelector("[data-reply-edit]");
      if (editBtn) editBtn.remove();

      clearInterval(timer);
      return;
    }

    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);

    el.textContent =
      `editing available for ${mins}:${String(secs).padStart(2, "0")}`;
  };

  tick();
  const timer = setInterval(tick, 1000);
});


    document.querySelectorAll(".reply-edit-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const row = btn.closest(".reply-row");
    const replyId = row.dataset.replyId || row.getAttribute("data-reply-id");
    const bodyEl = row.querySelector(".reply-body");

    enableReplyEdit(row, replyId, bodyEl.textContent);
  });
});


    list.querySelectorAll("[data-amen-reply]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const row = e.currentTarget.closest("[data-reply-id]");
        const replyId = row?.dataset?.replyId;
        if (!replyId) return;

        const authUser = window.hcUser || window.hcuser || null;
        if (!authUser?.loggedIn) {
          const next = encodeURIComponent(location.pathname + location.search);
          location.href = `/login.html?next=${next}`;
          return;
        }

        const res = await fetch(`${API}/replies/${replyId}/amen`, {
          method: "POST",
          credentials: "include",
        });

        if (res.status === 401) {
          const next = encodeURIComponent(location.pathname + location.search);
          location.href = `/login.html?next=${next}`;
          return;
        }

        const out = await res.json().catch(() => null);
        if (!res.ok || !out) return;

        const btn = e.target.closest("[data-amen-reply]");
        if (!btn || !btn.isConnected) return;

        btn.classList.toggle("is-on", !!out.amened);

        const countEl = btn.querySelector(".count");
        if (countEl) {
          countEl.textContent = String(out.amen_count ?? 0);
        }

      });
    });
  }

  async function wireReplyForm(threadId) {
    const form = qs("#replyForm");
    const textarea = qs("#replyBody");
    attachMentionsAutocomplete(textarea);
    const errEl = qs("#replyError");
    const counter = document.querySelector("#charCount");
    const SOFT_LIMIT = 500;

    if (textarea && counter) {
      textarea.addEventListener("input", () => {
        const len = textarea.value.length;
        counter.textContent = len;
        counter.classList.toggle("over", len > SOFT_LIMIT);
      });
}


    if (!form || !textarea) return;

    const showErr = (msg) => {
      if (!errEl) return;
      errEl.textContent = msg || "";
      errEl.style.display = msg ? "block" : "none";
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      showErr("");

      const body = textarea.value.trim();
      if (!body) return showErr("Write something first.");

      const res = await fetch(`${API}/threads/${threadId}/replies`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      const out = await res.json().catch(() => null);

      if (res.status === 401) {
        const next = encodeURIComponent(location.pathname + location.search);
        location.href = `/login.html?next=${next}`;
        return;
      }

      if (!res.ok) {
        showErr(out?.error || `Failed to post reply (${res.status})`);
        return;
      }

      textarea.value = "";
      await loadReplies(threadId);

    // animate newest reply
    requestAnimationFrame(() => {
  const first = document.querySelector(".reply-row");
    if (first?.classList) {
      first.classList.add("reply-enter");
    }

    });

    });
  }


function enableReplyEdit(row, replyId, currentBody) {
  const createdAt = Number(
    row.querySelector(".reply-edit-countdown")?.dataset.createdAt
  );

  if (createdAt && Date.now() - createdAt > EDIT_WINDOW_MS) {
    alert("Edit window has expired.");
    return;
  }

  
  const textarea = document.createElement("textarea");
  textarea.value = currentBody;
  textarea.className = "reply-edit-textarea";

  const body = row.querySelector(".reply-body");
  body.replaceWith(textarea);

  const save = document.createElement("button");
  save.className = "btn btn-sm";
  save.textContent = "Save";

  save.onclick = async () => {
    await fetch(`/api/forum/replies/${replyId}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: textarea.value })
    });

    location.reload();
  };

  row.appendChild(save);
}

function renderThreadUpdates(updates = []) {
  let box = document.getElementById("threadUpdates");

  // If missing for any reason, recreate it (no warnings)
  if (!box) {
    const card = document.getElementById("threadCard");
    if (!card) return;
    box = document.createElement("div");
    box.id = "threadUpdates";
    box.className = "thread-updates";
    card.appendChild(box);
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    box.innerHTML = "";
    return;
  }

  // default collapsed after 1st update (reddit-ish)
  const defaultExpanded = updates.length <= 1;

  box.innerHTML = `
    <div class="thread-updates-head">
      <div class="thread-updates-title">Updates (${updates.length})</div>
      <button type="button" class="thread-updates-toggle" aria-expanded="${defaultExpanded ? "true" : "false"}">
        ${defaultExpanded ? "Collapse" : "Expand"}
      </button>
    </div>
    <div class="thread-updates-list ${defaultExpanded ? "" : "is-collapsed"}">
      ${updates.map(u => `
        <div class="thread-update">
          <div class="thread-update-meta">
            <span class="muted">Edit · ${timeAgo(u.created_at)}</span>
          </div>
          <div class="thread-update-body">${esc(u.body)}</div>
        </div>
      `).join("")}
    </div>
  `;

  const btn = box.querySelector(".thread-updates-toggle");
  const list = box.querySelector(".thread-updates-list");

  btn.addEventListener("click", () => {
    const collapsed = list.classList.toggle("is-collapsed");
    btn.textContent = collapsed ? "Expand" : "Collapse";
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
  });
}


 async function initThreadPage() {
AUTH_USER = await window.hcGetCurrentMember?.();


// ✅ FINAL, CORRECT normalization for Holy Circle auth
const resolvedUser =
  AUTH_USER?.profile?.id ? AUTH_USER.profile :
  AUTH_USER?.member?.id  ? AUTH_USER.member  :
  AUTH_USER?.user?.id    ? AUTH_USER.user    :
  AUTH_USER?.id          ? AUTH_USER         :
  null;

CURRENT_USER_ID = Number(resolvedUser?.id || 0);

// debug visibility
window.__HC_DEBUG = {
  CURRENT_USER_ID,
  AUTH_USER,
  resolvedUser,
};







console.log("[forum-thread] CURRENT_USER_ID =", CURRENT_USER_ID);


  const params = new URLSearchParams(location.search);
  const threadId = Number(params.get("id"));

  if (!threadId) {
    const card = qs("#threadCard");
    if (card) {
      card.innerHTML = `
        <div class="muted">
          Thread not found.<br />
          <a href="/forum.html">← Back to forum</a>
        </div>
      `;
    }
    return;
  }
await loadThread(threadId);


// ✅ NOW the community ID exists
if (window.loadThreadCommunityCard) {
  window.loadThreadCommunityCard();

}



await loadReplies(threadId);
await wireReplyForm(threadId);
setComposerVisibility();



}






function bootThread() {
  initThreadPage().catch(console.error);
}

bootThread();




})();

function attachMentionsAutocomplete(textarea) {
  if (!textarea || textarea.__mentionsBound) return;
  textarea.__mentionsBound = true;

  const menu = document.createElement("div");
  menu.className = "mention-menu";
  menu.style.position = "absolute";
  menu.style.zIndex = "9999";
  menu.style.display = "none";
  menu.style.background = "#0b1b33";
  menu.style.border = "1px solid rgba(191,151,69,0.35)";
  menu.style.borderRadius = "10px";
  menu.style.padding = "6px";
  menu.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";
  document.body.appendChild(menu);

  let results = [];
  let active = -1;

  function close() {
    menu.style.display = "none";
    menu.innerHTML = "";
    active = -1;
    results = [];
  }

  function position() {
    const r = textarea.getBoundingClientRect();
    menu.style.left = `${r.left + window.scrollX}px`;
    menu.style.top = `${r.bottom + window.scrollY + 6}px`;
    menu.style.width = `${Math.min(r.width, 320)}px`;
  }

  function getQuery() {
    const pos = textarea.selectionStart || 0;
    const before = textarea.value.slice(0, pos);
    const m = before.match(/@([a-zA-Z0-9_]{0,30})$/);
    return m ? m[1] : null;
  }

  async function search(q) {
    const res = await fetch(`/api/forum/mentions?q=${encodeURIComponent(q)}`, {
      credentials: "include"
    });
    const data = await res.json().catch(() => null);
    return Array.isArray(data?.results) ? data.results : [];
  }

  function render(list) {
    if (!list.length) return close();
    results = list;
    active = 0;
    position();

    menu.innerHTML = list.map((u, i) => `
      <div data-i="${i}"
           style="padding:8px 10px; border-radius:8px; cursor:pointer; color:#fff">
        @${u}
      </div>
    `).join("");

    [...menu.children].forEach(el => {
      el.onmouseenter = () => {
        active = Number(el.dataset.i);
        highlight();
      };
      el.onmousedown = e => {
        e.preventDefault();
        pick(active);
      };
    });

    highlight();
    menu.style.display = "block";
  }

  function highlight() {
    [...menu.children].forEach((el, i) => {
      el.style.background =
        i === active ? "rgba(191,151,69,0.25)" : "transparent";
    });
  }

  function pick(i) {
    const username = results[i];
    if (!username) return;

    const pos = textarea.selectionStart || 0;
    const before = textarea.value.slice(0, pos);
    const after = textarea.value.slice(pos);

    const replaced =
      before.replace(/@([a-zA-Z0-9_]{0,30})$/, `@${username} `);

    textarea.value = replaced + after;
    textarea.setSelectionRange(replaced.length, replaced.length);
    textarea.focus();
    close();
  }

  let timer;
  textarea.addEventListener("input", () => {
    const q = getQuery();
    if (!q || q.length < 2) return close();

    clearTimeout(timer);
    timer = setTimeout(async () => {
      const list = await search(q);
      render(list);
    }, 120);
  });

  textarea.addEventListener("keydown", e => {
    if (menu.style.display !== "block") return;

    if (e.key === "Escape") return close();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      active = Math.min(active + 1, results.length - 1);
      highlight();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      active = Math.max(active - 1, 0);
      highlight();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      pick(active);
    }
  });

  document.addEventListener("click", e => {
    if (e.target === textarea) return;
    if (menu.contains(e.target)) return;
    close();
  });
}


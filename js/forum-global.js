
window.HC_FORUM_ENABLED = false;

// js/forum-global.js
(function () {
  if (window.__hcForumGlobalLoaded) return;
  window.__hcForumGlobalLoaded = true;


  // ==============================
  // Constants
  // ==============================
  window.HC_FORUM_API = "/api/forum";

  // ==============================
  // Shared helpers
  // ==============================
  window.hcForumUtils = {
    qs: (s, r = document) => r.querySelector(s),
    qsa: (s, r = document) => Array.from(r.querySelectorAll(s)),

    esc(str) {
      return String(str || "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[c]));
    },

    timeAgo(ts) {
      const n = Number(ts);
      if (!n) return "";
      const diff = Date.now() - n;
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "just now";
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return `${Math.floor(hrs / 24)}d ago`;
    },

    formatName(row) {
      const first = (row.first_name || "").trim();
      const last = (row.last_name || "").trim();
      return (first || last) ? `${first} ${last}`.trim() : "Member";
    }
  };

  // ==============================
  // API helper
  // ==============================

window.hcForumApiGet = async function (path, { fallback = null } = {}) {
  try {
    const res = await fetch(`${HC_FORUM_API}${path}`, {
  credentials: "include",
  cache: "no-store"
});


    // If server returns HTML error pages or empty, don’t crash UI
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }

    if (!res.ok) {
      console.warn(`[ForumAPI] GET ${path} failed:`, res.status, data || text);
      return fallback;
    }
    return data;
  } catch (err) {
    console.warn(`[ForumAPI] GET ${path} network error:`, err);
    return fallback;
  }
};

window.hcForumApiPost = async function (path, payload) {
  const url = `/api/forum${path.startsWith("/") ? path : "/" + path}`;

  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload || {}),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    console.error("Forum POST failed:", res.status, url, data);
    throw new Error(data?.error || "Forum API error");
  }

  return data;
};

// ==============================
// Communities sidebar loader
// ==============================
window.loadCommunitySidebar = async function (activeCommunityId = null) {
  const list = document.getElementById("communityList");
  if (!list) return;

  const data = await window.hcForumApiGet("/communities", {
    fallback: { communities: [] }
  });

  const communities = Array.isArray(data?.communities)
    ? data.communities
    : [];

  if (!communities.length) {
    list.innerHTML = `<div class="muted">No communities yet</div>`;
    return;
  }

  list.innerHTML = communities.map(c => `
    <a
      href="/community.html?id=${c.id}"
      class="forum-nav-link ${c.id === activeCommunityId ? "active" : ""}"
    >
      ${c.name}
    </a>
  `).join("");
};

window.attachJoinCommunityHandler = function ({
  button,
  communityId,
  initiallyJoined = false,
  onChange
}) {
  let joined = !!initiallyJoined;

  const render = () => {
    button.textContent = joined ? "Joined" : "Join";
    button.classList.toggle("is-joined", joined);
  };

  render();

  button.addEventListener("click", async () => {
    if (!window.hcUser?.loggedIn) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.href = `/login.html?next=${next}`;
      return;
    }

    const action = joined ? "leave" : "join";

    try {
      const res = await window.hcForumApiPost(
        `/communities/${communityId}/${action}`
      );

      joined = !!res.joined;
      render();

      if (typeof onChange === "function") {
        onChange(joined);
      }
    } catch (err) {
      console.error("Join/leave failed", err);
    }
  });
};



window.leaveCommunityRoom = function (communityId) {
  if (!window.hcSocket || !communityId) return;

  window.hcSocket.send(JSON.stringify({
    type: "community:leave",
    communityId
  }));
};

window.joinCommunityRoomSafe = function (communityId) {
  if (!communityId) return;

  const tryJoin = () => {
    if (!window.hcSocket || window.hcSocket.readyState !== 1) {
      setTimeout(tryJoin, 50);
      return;
    }

    window.hcSocket.send(JSON.stringify({
      type: "community:join",
      communityId
    }));
  };

  tryJoin();
};



  // ==============================
  // Sidebar collapse
  // ==============================
  function initSidebarToggle() {
    const btn = document.querySelector(".sidebar-toggle");
    if (!btn) return;

    const collapsed = localStorage.getItem("hcSidebarCollapsed") === "1";
    document.body.classList.toggle("sidebar-collapsed", collapsed);

    btn.addEventListener("click", () => {
      const state = document.body.classList.toggle("sidebar-collapsed");
      localStorage.setItem("hcSidebarCollapsed", state ? "1" : "0");
    });
  }

  // ==============================
  // Sticky Create Thread CTA
  // ==============================
 function initStickyCreateThread() {
  let shown = false;

  window.addEventListener("scroll", () => {
    if (window.scrollY > 400 && !shown) {
      document.body.classList.add("show-sticky-cta");
      shown = true;
    }
    if (window.scrollY < 200) {
      document.body.classList.remove("show-sticky-cta");
      shown = false;
    }
  });
}


  // ==============================
  // Right sidebar analytics
  // ==============================
  async function loadForumAnalytics() {
    try {
      const res = await fetch("/api/forum/analytics", {
        credentials: "include"
      });
      if (!res.ok) return;
      const data = await res.json();

      const m = document.getElementById("statMembers");
      const t = document.getElementById("statThreads");
      const a = document.getElementById("statActive");

      if (m) m.textContent = data.members ?? "—";
      if (t) t.textContent = data.threads_week ?? "—";
      if (a) a.textContent = data.active_today ?? "—";
    } catch {
      console.warn("Forum analytics unavailable");
    }
  }

// ==============================
// Create Community wizard (modal)
// ==============================
function initCreateCommunityWizard() {
  const openBtn = document.querySelector(".create-community-btn");
  const modal = document.querySelector("[data-cc-modal]");
  if (!openBtn || !modal) return; // safe: no modal on this page yet

  let lastFocused = null;


  const overlay = modal;
  const closeBtns = modal.querySelectorAll("[data-cc-close]");
  const steps = Array.from(modal.querySelectorAll("[data-cc-step]"));
  const dots = Array.from(modal.querySelectorAll(".hc-modal-steps .step"));
  const nextBtn = modal.querySelector("[data-cc-next]");
  const backBtn = modal.querySelector("[data-cc-back]");
  const submitBtn = modal.querySelector("[data-cc-submit]");
  const progress = modal.querySelector("[data-cc-progress]"); // optional (like "Step 1 of 3")

  let step = 0;
  let lastStep = 0;
  
  function isStepValid(idx) {
  const container = steps[idx];
  if (!container) return true;

  const required = Array.from(
    container.querySelectorAll("[data-cc-required]")
  );

  return required.every(el => {
    if (el.type === "checkbox") return el.checked;
    return !!String(el.value || "").trim();
  });
}

function setStep(idx) {
  if (!steps.length) return;

  const direction = idx > lastStep ? "forward" : "back";
  lastStep = idx;

  step = Math.max(0, Math.min(idx, steps.length - 1));

  // Toggle steps
  steps.forEach((el, i) => {
    const active = i === step;
    el.hidden = !active;
    el.setAttribute("aria-hidden", active ? "false" : "true");

    el.classList.remove("cc-enter-forward", "cc-enter-back");
    if (active) {
      el.classList.add(
        direction === "forward"
          ? "cc-enter-forward"
          : "cc-enter-back"
      );
    }
  });

  // Sync dots (ONCE)
  if (dots.length) {
    dots.forEach((dot, i) => {
      dot.classList.toggle("is-active", i === step);
      dot.classList.toggle("is-complete", i < step);
    });
  }

  // Buttons
  if (backBtn) backBtn.disabled = step === 0;

  const isLast = step === steps.length - 1;
  if (nextBtn) nextBtn.hidden = isLast;
  if (submitBtn) submitBtn.hidden = !isLast;

  // 🔒 Live enable / disable
  if (nextBtn) nextBtn.disabled = !isStepValid(step);
  if (submitBtn) submitBtn.disabled = !isStepValid(step);

  // Focus first input
  const focusable = steps[step].querySelector(
    'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable) focusable.focus();
}

// Live validation listeners
steps.forEach((section, idx) => {
  const fields = section.querySelectorAll(
    "input[data-cc-required], textarea[data-cc-required]"
  );

  fields.forEach(field => {
    field.addEventListener("input", () => {
      if (idx !== step) return;
      if (nextBtn) nextBtn.disabled = !isStepValid(step);
      if (submitBtn) submitBtn.disabled = !isStepValid(step);
    });

    field.addEventListener("change", () => {
      if (idx !== step) return;
      if (nextBtn) nextBtn.disabled = !isStepValid(step);
      if (submitBtn) submitBtn.disabled = !isStepValid(step);
    });
  });
});


  function openModal() {
    lastFocused = document.activeElement;
    modal.classList.add("is-open");
    modal.removeAttribute("aria-hidden");
    document.body.classList.add("modal-open");
    setStep(0);
  }

 function closeModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");


  if (lastFocused && typeof lastFocused.focus === "function") {
    lastFocused.focus();
  }
}


  function validateStep(idx) {
    // Minimal + clean: require any [data-cc-required] inputs in the current step
    const container = steps[idx];
    if (!container) return true;

    const required = Array.from(container.querySelectorAll("[data-cc-required]"));
    let ok = true;

    required.forEach((el) => {
      const val = (el.value || "").trim();
      const hasValue = !!val;
      el.classList.toggle("is-invalid", !hasValue);
      if (!hasValue) ok = false;
    });

    const error = container.querySelector("[data-cc-error]");
    if (error) {
      error.textContent = ok ? "" : "Please complete the required fields.";
      error.hidden = ok;
    }

    return ok;
  }

  // Open
  openBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openModal();
  });

  // Close buttons
  closeBtns.forEach((btn) => btn.addEventListener("click", (e) => {
    e.preventDefault();
    closeModal();
  }));

  // Click outside dialog closes (overlay)
  overlay.addEventListener("click", (e) => {
    // Only close when clicking the overlay itself, not inside dialog content
    if (e.target === overlay) closeModal();
  });

  // Next/back
  if (nextBtn) {
    nextBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!validateStep(step)) return;
      setStep(step + 1);
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", (e) => {
      e.preventDefault();
      setStep(step - 1);
    });
  }

  // Submit (final step)
if (submitBtn) {
  submitBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!isStepValid(step)) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Creating…";

    try {
      submitBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  // Ensure we're on the last step
  if (step !== steps.length - 1) return;

  if (!isStepValid(step)) return;

  const nameEl = modal.querySelector("[data-cc-name]");
  const descEl = modal.querySelector("[data-cc-description]");
  const visibilityEl = modal.querySelector(
    'input[name="cc_visibility"]:checked'
  );

  const name = String(nameEl?.value || "").trim();
  const description = String(descEl?.value || "").trim();
  const isPrivate = visibilityEl?.value === "private";

  if (!name || !description) {
    console.warn("Create Community: missing fields");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Creating…";

  try {
    console.log("Creating community:", {
      name,
      description,
      isPrivate
    });

    const res = await window.hcForumApiPost("/communities", {
      name,
      description,
      isPrivate
    });

    console.log("Community created:", res);

    closeModal();

    alert(
      "Community submitted for review. You’ll be notified once it’s approved."
    );

  } catch (err) {
    console.error("Create Community failed:", err);
    alert("Something went wrong. Please try again.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Create Community";
  }
});


      closeModal();

     const notice = document.getElementById("pendingCommunityNotice");
        if (notice) {
          notice.classList.remove("hidden");
          notice.scrollIntoView({ behavior: "smooth", block: "center" });
        }

    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Community";
    }
  });
}


  // Keyboard
  document.addEventListener("keydown", (e) => {
    if (!modal.classList.contains("is-open")) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }

    // Enter = next (unless you're in a textarea)
    if (e.key === "Enter") {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "textarea") return;

      // If submit button is visible, let form submit normally
      if (submitBtn && !submitBtn.hidden) return;

      // Otherwise go next
      if (nextBtn && !nextBtn.hidden) {
        e.preventDefault();
        if (!validateStep(step)) return;
        setStep(step + 1);
      }
    }
  });

  // Default initial state
  modal.setAttribute("aria-hidden", "true");
  steps.forEach((s, i) => {
    s.hidden = i !== 0;
    s.setAttribute("aria-hidden", i === 0 ? "false" : "true");
  });
}




  // ==============================
  // Boot after auth
  // ==============================
window.hcForumInitGlobals = function () {
  initSidebarToggle();
  initStickyCreateThread();
  loadForumAnalytics();
  initCreateCommunityWizard();

  // ==============================
  // Global community sidebar init
  // ==============================
  const list = document.getElementById("communityList");
  if (list && typeof window.loadCommunitySidebar === "function") {
    // Detect active community from URL if present
    const params = new URLSearchParams(window.location.search);
    const activeId =
      Number(params.get("id")) ||
      Number(params.get("community_id")) ||
      null;

    window.loadCommunitySidebar(activeId);
  }
};

window.refreshActiveCommunityStats = async function () {
  const communityId = window.__ACTIVE_COMMUNITY_ID;
  if (!communityId) return;

  const data = await window.hcForumApiGet(`/communities/${communityId}`);
  if (!data?.community) return;

  const c = data.community;

  // 🔓 Allow stat writes ONLY inside this function
  window.__hcAllowStatWrite = true;
  try {
    // THREAD / COMMUNITY SIDEBAR COUNTS
    document.querySelectorAll(".member-count").forEach(el => {
      el.textContent = Number(c.member_count).toLocaleString();
    });

    document.querySelectorAll(".thread-count").forEach(el => {
      el.textContent = Number(c.thread_count).toLocaleString();
    });

    // STATS CARD (right sidebar)
    const statMembers = document.getElementById("statMembers");
    const statThreads = document.getElementById("statThreads");

    if (statMembers) {
      statMembers.textContent = Number(c.member_count).toLocaleString();
    }

    if (statThreads) {
      statThreads.textContent = Number(c.thread_count).toLocaleString();
    }
  } finally {
    // 🔒 Lock stat writes everywhere else
    window.__hcAllowStatWrite = false;
  }
};




if (window.hcSocket) {
  window.hcSocket.addEventListener("message", async (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    if (msg.type !== "community:update") return;

    const activeId = Number(window.__ACTIVE_COMMUNITY_ID);
    if (!activeId || Number(msg.communityId) !== activeId) return;

    await window.refreshActiveCommunityStats();
  });
}



window.bootPage = function bootPage(initFn) {
  let ran = false;

 const runOnce = () => {
  if (ran) return;
  ran = true;

  // ✅ Guard: bootPage must receive a function
  if (typeof initFn !== "function") {
    console.error("[bootPage] initFn is not a function. You probably passed the wrong variable.", initFn);
    return;
  }

  Promise.resolve()
    .then(() => initFn())
    .catch((err) => {
      console.error("[bootPage] init failed:", err);
    });
};




  // If auth is ready, go now
  if (window.hcUser && window.hcUser._loaded) {
    runOnce();
  } else {
    // Wait for auth-ready… but don’t trust it blindly
    window.addEventListener("hc:auth-ready", runOnce, { once: true });

    // Safety net: run anyway once DOM is ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", runOnce, { once: true });
    } else {
      runOnce();
    }

    // Final safety net: run after short delay (covers weird race conditions)
    setTimeout(runOnce, 1200);
  }
};

})();
// ==============================
// Username mentions → profile
// ==============================
document.addEventListener("click", (e) => {
  const el = e.target.closest(".mention");
  if (!el) return;

  const username = el.dataset.username;
  if (!username) return;

  e.preventDefault();
  e.stopPropagation();

  location.href = `/test-profile.html?username=${encodeURIComponent(username)}`;
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;

  const el = document.activeElement;
  if (!el || !el.classList.contains("mention")) return;

  const username = el.dataset.username;
  if (!username) return;

  e.preventDefault();
  location.href = `/test-profile.html?username=${encodeURIComponent(username)}`;
});


(function forumGate() {
  if (window.HC_FORUM_ENABLED) return;

  const forumPages = [
    "/forum.html",
    "/community.html",
    "/forum-thread.html",
    "/new-thread.html"
  ];

  if (forumPages.includes(location.pathname)) {
    location.replace("/coming-soon.html");
  }
})();

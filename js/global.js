// js/global.js
// Site-wide UI + identity engine for Holy Circle
// Cleaned: fixes undefined vars, endpoint mismatches, and broken IIFEs.

// -------------------------------------------------
// Page type detection (single source of truth)
// -------------------------------------------------
const PAGE = {
  isPublic: document.body?.classList.contains("public-page"),
  isMember: document.body?.classList.contains("member-page"),
  isAdmin: document.body?.classList.contains("admin-page"),
};



  // -------------------------------------------------
  //  Identity state (shared across all front-end JS)
  // -------------------------------------------------
  window.hcUser = window.hcUser || {
    loggedIn: false,
    profile: null,
    _loaded: false,
  };


  // -------------------------------------------------
  //  Small global helpers
  // -------------------------------------------------
  window.getTimeBasedGreeting = function (name = "Member") {
    const hour = new Date().getHours();
    let greeting;
    if (hour >= 5 && hour < 12) greeting = "Good morning";
    else if (hour >= 12 && hour < 17) greeting = "Good afternoon";
    else if (hour >= 17 && hour < 21) greeting = "Good evening";
    else greeting = "Welcome back";
    return `${greeting}, ${name}`;
  };

  window.formatMemberName = function (member) {
    if (!member) return "Member";
    const first = member.first_name?.trim();
    const last = member.last_name?.trim();
    if (first && last) return `${first} ${last}`;
    if (first) return first;
    if (member.username) return member.username;
    return "Member";
  };




// ==============================
// Admin Dashboard Shortcut
// ==============================
function revealAdminButton() {
  const btn = document.getElementById("adminDashboardBtn");
  if (!btn) return;

  const role =
    window.hcUser?.profile?.role ||
    window.hcUser?.role;

  if (role === "admin" || role === "master") {
    btn.style.display = "inline-flex";
  }
}


// Run after auth is ready
if (window.hcUser?._loaded) {
  revealAdminButton();
} else {
  window.addEventListener("hc:auth-ready", revealAdminButton);
}


  // -------------------------------------------------
  //  Auth fetch (single source of truth)
  //  GET /api/members/auth/me  -> { loggedIn, profile }
  // -------------------------------------------------
async function hcGetCurrentMember() {
  try {
    const res = await fetch("/api/members/auth/me", {
      credentials: "include",
    });

    const data = await res.json();

    if (!data.loggedIn) {
      window.hcUser = { loggedIn: false, profile: null, _loaded: true };
    } else {
      window.hcUser = {
        loggedIn: true,
        profile: data.member,
        _loaded: true,
      };
    }

    window.dispatchEvent(new Event("hc:auth-ready"));
    return window.hcUser;
  } catch (err) {
    console.warn("Auth strap failed:", err);
    window.hcUser = { loggedIn: false, profile: null, _loaded: true };
    window.dispatchEvent(new Event("hc:auth-ready"));
    return window.hcUser;
  }
}




  // -------------------------------------------------
  //  Navbar / mobile auth UI wiring
  // -------------------------------------------------
  async function updateNavbarAuthState() {
    const data = await hcGetCurrentMember();

  const isLoggedIn = !!data?.loggedIn;
  const profile = data?.profile || null;


    // 🔁 Sync forum auth state
if (window.hcForum) {
  window.hcForum.member = {
    loggedIn: isLoggedIn,
    profile: profile,
  };
}

   if (document.body) {
    document.body.classList.toggle("is-member", isLoggedIn);
    document.body.classList.toggle("is-guest", !isLoggedIn);

    
}



      
    // Member-only elements
document.querySelectorAll("[data-member-only]").forEach((el) => {
  if (el?.style) el.style.display = isLoggedIn ? "" : "none";
});


    // Auth areas (desktop + mobile wrappers)
    document.querySelectorAll("[data-auth-area]").forEach((area) => {
      if (isLoggedIn) area.classList.add("is-auth");
      else area.classList.remove("is-auth");
    });

    const loginBtn = document.querySelector("[data-login-link]");
    const userMenu = document.querySelector("[data-user-menu]");
    if (loginBtn) loginBtn.style.display = isLoggedIn ? "none" : "";
    if (userMenu) userMenu.style.display = isLoggedIn ? "" : "none";

  // 🔁 Sync avatar AFTER auth + DOM are stable
 if (
  isLoggedIn &&
  profile.avatar_url &&
  window.AvatarEngine &&
  typeof AvatarEngine.sync === "function"
) {
  AvatarEngine.sync(profile.avatar_url);
}





    // Names
    const name = window.formatMemberName(profile);
    document.querySelectorAll("[data-avatar-name]").forEach((el) => {
      el.textContent = name;
    });

    // Generic member name placeholders (heroes, dashboards, welcome text)
document.querySelectorAll("[data-member-name]").forEach((el) => {
  el.textContent = name;
});


    const mobileAvatarName = document.querySelector("[data-mobile-avatar-name]");
    if (mobileAvatarName) {
      mobileAvatarName.textContent = isLoggedIn ? window.getTimeBasedGreeting(name) : "Login";
    }





    // Profile links
    if (profile?.id) {
      document
        .querySelectorAll("[data-profile-link], [data-profile-link-mobile]")
        .forEach((a) => {
      if (a instanceof HTMLAnchorElement) {
      
          a.href = "/test-profile.html";
      }
        });
    }
  }

  // -------------------------------------------------
  //  Require member: used by guarded links
  // -------------------------------------------------
  async function hcRequireMember() {
    window.hcUser._loaded = false;
    const data = await hcGetCurrentMember();
    return !!data.loggedIn;
  }

  // -------------------------------------------------
  //  Global logout (used by header + mobile logout buttons)
  // -------------------------------------------------
  async function hcLogout() {
    try {
      const res = await fetch("/api/members/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.warn("Logout failed (continuing anyway)", err);
    }

    window.hcUser = { loggedIn: false, profile: null, _loaded: true };
    updateNavbarAuthState();
    location.href = "/login.html";
  }

  // Expose helpers to other scripts
  window.hcGetCurrentMember = hcGetCurrentMember;
  window.updateNavbarAuthState = updateNavbarAuthState;
  window.hcRequireMember = hcRequireMember;
  window.hcLogout = hcLogout;

  document.addEventListener("DOMContentLoaded", async () => {
  await updateNavbarAuthState();   // ensures hcUser is ready


if (window.hcUser.loggedIn) {
  initNotificationsUI();
}


  
  });




  // -------------------------------------------------
  //  Notification UI helpers
  // -------------------------------------------------
  function initNotificationsUI() {
    const notifToggle = document.querySelector("[data-notif-btn]");
    const notifDropdown = document.querySelector("[data-notif-dropdown]");
    const notifList = document.querySelector("[data-notif-list]");
    const notifDot = document.querySelector("[data-notif-dot]");
    const notifClearBtn = document.querySelector("[data-notif-clear]");

    if (!notifToggle || !notifDropdown) return;

   if (!window.hcUser.loggedIn) {
  // guest → don’t run member-based notification storage logic
  if (notifDot) notifDot.style.display = "none";
  return;
}



    if (!window.hcUser.profile || !window.hcUser.profile.id) return;

      if (
    document.body?.classList.contains("login-page") ||
    document.body?.classList.contains("register-page")
  ) {
    return;
  }



    const memberId = window.hcUser?.profile?.id || "guest";
    const storageKey = `hcNotifSeen_${memberId}`;

    const showDot = (show) => {
      if (!notifDot) return;
      notifDot.style.display = show ? "block" : "none";
    };

    const hasVisibleNotifications = () => {
      if (!notifList) return false;
      const items = Array.from(notifList.children).filter(
        (child) => !child.classList.contains("notif-empty")
      );
      return items.length > 0;
    };

    const applySeenStateFromStorage = () => {
      let seen = false;
      try {
        seen = localStorage.getItem(storageKey) === "all_read";
      } catch (e) { console.warn(e); }

      if (seen || !hasVisibleNotifications()) showDot(false);
      else showDot(true);
    };

    async function markAllReadBackend() {
      try {
        await fetch("/api/notifications/mark-all-read", {
          method: "POST",
          credentials: "include",
        });
      } catch (err) {
        console.warn("mark-all-read backend call failed (non-fatal)", err);
      }
    }

    async function loadNotificationsFromBackend() {
      if (!notifList) return;
      try {
        const res = await fetch("/api/notifications", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load notifications");
        const data = await res.json();

        const notifications = data.notifications || [];
        notifList.innerHTML = "";

        if (!notifications.length) {
          notifList.innerHTML = '<div class="notif-empty">You\'re all caught up ✨</div>';
        } else {
          notifications.forEach((n) => {
            const item = document.createElement("div");
            item.className = "notif-item";
            item.dataset.id = n.id || "";

            const inner = document.createElement("div");
            inner.className = "notif-item-inner";

            const text = document.createElement("div");
            text.className = "notif-text";
            text.textContent = n.message || "New notification";
            inner.appendChild(text);

            if (n.href) {
              const link = document.createElement("a");
              link.href = n.href;
              link.className = "notif-link";
              link.textContent = "View";
              inner.appendChild(link);
            }

            item.appendChild(inner);
            notifList.appendChild(item);
          });
        }

        if (typeof data.unread_count === "number") showDot(data.unread_count > 0);
        else applySeenStateFromStorage();
      } catch (err) {
        console.warn("Failed to load notifications (falling back to static):", err);
        applySeenStateFromStorage();
      }
    }

    notifToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = notifDropdown.classList.toggle("is-open");
      if (isOpen) {
        try {
          localStorage.setItem(storageKey, "all_read");
        } catch (e) { console.warn(e); }

        showDot(false);
        markAllReadBackend();
      }
    });

    notifDropdown.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => notifDropdown.classList.remove("is-open"));

    if (notifClearBtn && notifList) {
      notifClearBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        notifList.innerHTML = '<div class="notif-empty">You\'re all caught up ✨</div>';
        try {
          localStorage.setItem(storageKey, "all_read");
        } catch (e) { console.warn(e); }

        showDot(false);

        try {
          await fetch("/api/notifications/clear-all", {
            method: "POST",
            credentials: "include",
          });
        } catch (err) {
          console.warn("clear-all backend call failed (non-fatal)", err);
        }
      });
    }

    // Realtime notification hook
    window.addEventListener("hc:notification", (e) => {
      const dot = document.querySelector("[data-notif-dot]");
      if (dot) dot.style.display = "block";
      // Optional: implement addNotificationToDropdown() in a page script
      if (typeof window.addNotificationToDropdown === "function") {
        window.addNotificationToDropdown(e.detail);
      }
    });

    applySeenStateFromStorage();
    loadNotificationsFromBackend();
    window.hcRefreshNotifications = loadNotificationsFromBackend;
  }

  // -------------------------------------------------
  //  Generic UI wiring (nav, mobile, dropdown, etc.)
  // -------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    // Nav shadow on scroll
    const header = document.querySelector(".hc-navbar");
    if (header) {
      const applyShadow = () => header.classList.toggle("is-scrolled", window.scrollY > 4);
      applyShadow();
      window.addEventListener("scroll", applyShadow);
    }

    // Mobile menu toggle
    const mobileBtn = document.querySelector("[data-mobile-menu-btn]");
    const mobileMenu = document.querySelector("[data-mobile-menu]");
    if (mobileBtn && mobileMenu) {
      mobileBtn.addEventListener("click", () => {
        const isOpen = mobileMenu.classList.toggle("is-open");
        mobileBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
        document.body.classList.toggle("no-scroll", isOpen);
      });
    }

    // Avatar dropdown (desktop) - only toggles if logged in
    const avatarToggle = document.querySelector("[data-avatar-toggle]");
    const dropdown = document.querySelector("[data-avatar-dropdown]");
    if (avatarToggle && dropdown) {
  // Avatar dropdown toggle (desktop)
    avatarToggle.addEventListener("click", (e) => {
      const isLoggedIn = !!window.hcUser?.loggedIn;

      // Only handle clicks on the toggle itself
      if (!avatarToggle.contains(e.target)) return;

      e.preventDefault();

      if (!isLoggedIn) {
        const next = encodeURIComponent(location.pathname + location.search);
        window.location.href = `/login.html?next=${next}`;
        return;
      }

      dropdown.classList.toggle("is-open");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (
        dropdown.classList.contains("is-open") &&
        !dropdown.contains(e.target) &&
        !avatarToggle.contains(e.target)
      ) {
        dropdown.classList.remove("is-open");
      }
    });
        }

    // Logout buttons
    document.querySelectorAll("[data-logout-btn]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        hcLogout();
      });
    });

    // Login button routes to login with next
    const loginLink = document.querySelector("[data-login-link]");
    if (loginLink) {
      loginLink.addEventListener("click", () => {
        const next = encodeURIComponent(location.pathname + location.search);
        location.href = `login.html?next=${next}`;
      });
    }

    // Mobile avatar click behavior
 const mobileAuthArea = document.querySelector(".mobile-profile-header[data-auth-area]");
const mobileAvatarClick = document.querySelector("[data-mobile-avatar-click]");

const handleMobileAuthClick = () => {
  const isLoggedIn = window.hcUser && window.hcUser.loggedIn;
  const next = encodeURIComponent(location.pathname + location.search);

  location.href = isLoggedIn
    ? "/test-profile.html"
    : `/login.html?next=${next}`;
};

/* Avatar always clickable */
if (mobileAvatarClick) {
  mobileAvatarClick.addEventListener("click", handleMobileAuthClick);
}

/* Auth area clickable ONLY when logged out */
if (mobileAuthArea) {
  mobileAuthArea.addEventListener("click", (e) => {
    if (window.hcUser?.loggedIn) return;
    handleMobileAuthClick();
  });
}


    // Guarded links
 document.querySelectorAll("[data-require-member]").forEach((el) => {
  el.addEventListener("click", async (e) => {
    e.preventDefault(); // ALWAYS prevent default

    const ok = await hcRequireMember();
    if (!ok) return;

    const href = el.getAttribute("href");
    if (href) {
      window.location.href = href;
    }
  });
});

}); 








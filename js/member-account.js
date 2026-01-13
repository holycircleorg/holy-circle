// =====================================
// DOM READY → ENTRY POINT
// =====================================
let profile;
document.addEventListener("DOMContentLoaded", async () => {
  try {
    profile = await waitForMember();
  } catch (err) {
    console.error("Member profile not available", err);
    return;
  }

  // profile is now guaranteed
  await initAccountPage(profile);
});


// =====================================
// WAIT FOR MEMBER
// =====================================
async function waitForMember() {
  for (let i = 0; i < 20; i++) {
    if (window.hcUser?.loggedIn && window.hcUser?.profile) {
      return window.hcUser.profile;
    }
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error("Member profile not available");
}


// =====================================
// NOTIFICATION HELPERS (GLOBAL SAFE)
// =====================================
async function loadNotificationSettings() {
  const res = await fetch("/api/notification-settings", {
    credentials: "include",
  });

  if (!res.ok) return;

  const settings = await res.json();

  document.querySelectorAll("[data-notif-key]").forEach((input) => {
    const key = input.dataset.notifKey;
    if (key in settings) {
      input.checked = settings[key] === 1;
    }
  });
}

function bindNotificationToggles() {
  document.querySelectorAll("[data-notif-key]").forEach((input) => {
    input.onchange = async () => {
      const payload = {};
      document.querySelectorAll("[data-notif-key]").forEach((i) => {
        payload[i.dataset.notifKey] = i.checked;
      });

      await fetch("/api/notification-settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    };
  });
}


// =====================================
// MAIN ACCOUNT INITIALIZER
// =====================================
async function initAccountPage(profile) {

  // ------------- ELEMENTS -------------

  const identityForm     = document.getElementById("identityForm");
  const identityMessage  = document.getElementById("identityMessage");
  const firstNameInput   = document.getElementById("firstName");
  const lastNameInput    = document.getElementById("lastName");
  const usernameInput    = document.getElementById("username");
  const emailInput       = document.getElementById("email");

  const spiritualMessage = document.getElementById("spiritualMessage");
  const socialMessage    = document.getElementById("socialMessage");

  const prefsForm        = document.getElementById("prefsForm");
  const showOnlineBox    = document.getElementById("showOnlineStatus");
  const showActivityBox  = document.getElementById("showActivityPublic");
  const themeSelect      = document.getElementById("themeSelect");
  const prefsMessage     = document.getElementById("prefsMessage");

  const passwordForm     = document.getElementById("passwordForm");
  const passwordMessage  = document.getElementById("passwordMessage");

  const deleteBtn        = document.getElementById("deleteAccountBtn");
  const deleteMessage    = document.getElementById("deleteMessage");

  const memberSinceEl    = document.getElementById("memberSince");
  const statThreadsEl    = document.getElementById("statThreads");
  const statRepliesEl    = document.getElementById("statReplies");
  const statAmensRecEl   = document.getElementById("statAmensReceived");
  const statAmensGivenEl = document.getElementById("statAmensGiven");
  const statPrayersEl    = document.getElementById("statPrayers");

  // ------------- PREFILL -------------
  function prefill() {
    if (firstNameInput) firstNameInput.value = profile.first_name || "";
    if (lastNameInput) lastNameInput.value  = profile.last_name || "";
    if (usernameInput) usernameInput.value  = profile.username || "";

    if (emailInput) {
      emailInput.value = profile.email || "";
      emailInput.setAttribute("readonly", true);
    }

    if (showOnlineBox) showOnlineBox.checked   = profile.show_online_status !== 0;
    if (showActivityBox) showActivityBox.checked = profile.show_activity_public !== 0;
    if (themeSelect) themeSelect.value       = profile.theme || "light";

    if (memberSinceEl && profile.created_at) {
      const d = new Date(profile.created_at);
      memberSinceEl.textContent = isNaN(d.getTime())
        ? "—"
        : d.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
    }

    if (statThreadsEl)    statThreadsEl.textContent    = profile.total_threads || 0;
    if (statRepliesEl)    statRepliesEl.textContent    = profile.total_replies || 0;
    if (statAmensRecEl)   statAmensRecEl.textContent   = profile.stats_amens_received || 0;
    if (statAmensGivenEl) statAmensGivenEl.textContent = profile.stats_amens_given || 0;
    if (statPrayersEl)    statPrayersEl.textContent    = profile.stats_prayers_received || 0;
  }

  // -------- INIT SEQUENCE (ORDER MATTERS) --------
  prefill();
  await loadNotificationSettings();
  bindNotificationToggles();

  // everything else (listeners, helpers) stays BELOW
}


  
    // ------------- HELPERS -------------

    // Top-level prefill used by refreshProfile (queries DOM each time)
    function prefill() {
      if (!profile) return;

      const firstNameInput = document.getElementById("firstName");
      const lastNameInput = document.getElementById("lastName");
      const usernameInput = document.getElementById("username");
      const emailInput = document.getElementById("email");

      const showOnlineBox = document.getElementById("showOnlineStatus");
      const showActivityBox = document.getElementById("showActivityPublic");
      const themeSelect = document.getElementById("themeSelect");

      const memberSinceEl = document.getElementById("memberSince");
      const statThreadsEl = document.getElementById("statThreads");
      const statRepliesEl = document.getElementById("statReplies");
      const statAmensRecEl = document.getElementById("statAmensReceived");
      const statAmensGivenEl = document.getElementById("statAmensGiven");
      const statPrayersEl = document.getElementById("statPrayers");

      if (firstNameInput) firstNameInput.value = profile.first_name || "";
      if (lastNameInput) lastNameInput.value = profile.last_name || "";
      if (usernameInput) usernameInput.value = profile.username || "";

      if (emailInput) {
        emailInput.value = profile.email || "";
        emailInput.setAttribute("readonly", true);
      }

      if (showOnlineBox) showOnlineBox.checked = profile.show_online_status !== 0;
      if (showActivityBox) showActivityBox.checked = profile.show_activity_public !== 0;
      if (themeSelect) themeSelect.value = profile.theme || "light";

      if (memberSinceEl && profile.created_at) {
        const d = new Date(profile.created_at);
        memberSinceEl.textContent = isNaN(d.getTime())
          ? "—"
          : d.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
      }

      if (statThreadsEl)    statThreadsEl.textContent    = profile.total_threads || 0;
      if (statRepliesEl)    statRepliesEl.textContent    = profile.total_replies || 0;
      if (statAmensRecEl)   statAmensRecEl.textContent   = profile.stats_amens_received || 0;
      if (statAmensGivenEl) statAmensGivenEl.textContent = profile.stats_amens_given || 0;
      if (statPrayersEl)    statPrayersEl.textContent    = profile.stats_prayers_received || 0;
    }

    async function refreshProfile() {
      try {
        const res = await fetch("/api/members/me", {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json();
        if (data.loggedIn && data.profile) {
          window.hcForum.member = data;
          Object.assign(profile, data.profile);
          prefill();
          await hcForumInit({ useSocket: false }); // refresh nav avatar/initials
        }
      } catch (err) {
        console.error("Failed to refresh profile:", err);
      }
    }
  
    function getSpiritualInterestsJSON() {
          const selected = [];
          const boxes = document.querySelectorAll("[data-spiritual-box], [name='spiritualInterests']");
          boxes.forEach((box) => {
            if (box.checked) selected.push(box.value);
          });
          return JSON.stringify(selected);
    }
    

    // ------------- IDENTITY SAVE (name + username) -------------
    (function wireIdentityForm() {
      const _identityForm = document.getElementById("identityForm");
      if (!_identityForm) return;

      _identityForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const identityMessage = document.getElementById("identityMessage");
        if (identityMessage) identityMessage.textContent = "Saving identity...";

        const firstNameInput = document.getElementById("firstName");
        const lastNameInput = document.getElementById("lastName");
        const usernameInput = document.getElementById("username");

        const first_name = firstNameInput?.value.trim() || "";
        const last_name = lastNameInput?.value.trim() || "";
        const username = usernameInput?.value.trim() || "";

        try {
          // 1) Update username (with uniqueness check)
          if (username) {
            const resUser = await fetch("/api/members/username", {
              method: "PUT",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username }),
            });
            const dataUser = await resUser.json();
            if (!resUser.ok || !dataUser.success) {
              if (identityMessage) identityMessage.textContent = dataUser.error || "Failed to update username.";
              return;
            }
          }

          // 2) Update first/last via profile route (minimal payload)
          const resProfile = await fetch("/api/members/profile", {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              first_name,
              last_name,
            }),
          });
          const dataProfile = await resProfile.json();
          if (!resProfile.ok || !dataProfile.success) {
            if (identityMessage) identityMessage.textContent = dataProfile.error || "Failed to update name.";
            return;
          }

          if (identityMessage) identityMessage.textContent = "Identity saved.";
          await refreshProfile();
        } catch (err) {
          console.error(err);
          if (identityMessage) identityMessage.textContent = "Error saving identity.";
        }
      });
    })();

  
    // ------------- ACCOUNT PREFS (privacy + theme only) -------------

    (function wirePrefsForm() {
      const _prefsForm = document.getElementById("prefsForm");
      if (!_prefsForm) return;

      _prefsForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const prefsMessage = document.getElementById("prefsMessage");
        if (prefsMessage) prefsMessage.textContent = "Saving preferences...";

        const showOnlineBox = document.getElementById("showOnlineStatus");
        const showActivityBox = document.getElementById("showActivityPublic");
        const themeSelect = document.getElementById("themeSelect");

        const body = {
          show_online_status: !!showOnlineBox?.checked,
          show_activity_public: !!showActivityBox?.checked,
          theme: themeSelect?.value,
        };

        try {
          const res = await fetch("/api/members/profile", {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            if (prefsMessage) prefsMessage.textContent = data.error || "Failed to save preferences.";
            return;
          }

          if (prefsMessage) prefsMessage.textContent = "Preferences saved.";
          await refreshProfile();
        } catch (err) {
          console.error(err);
          if (prefsMessage) prefsMessage.textContent = "Error saving preferences.";
        }
      });
    })();
  
    // ------------- PASSWORD UPDATE -------------
    (function wirePasswordForm() {
      const _passwordForm = document.getElementById("passwordForm");
      if (!_passwordForm) return;

      _passwordForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const passwordMessage = document.getElementById("passwordMessage");
        if (passwordMessage) passwordMessage.textContent = "Updating password...";

        const currentPassword = document.getElementById("currentPassword")?.value;
        const newPassword     = document.getElementById("newPassword")?.value;

        if (!currentPassword || !newPassword) {
          if (passwordMessage) passwordMessage.textContent = "Please fill both password fields.";
          return;
        }

        try {
          const res = await fetch("/api/members/password", {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPassword, newPassword }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            if (passwordMessage) passwordMessage.textContent = data.error || "Failed to update password.";
            return;
          }

          if (passwordMessage) passwordMessage.textContent = "Password updated.";
          _passwordForm.reset();
        } catch (err) {
          console.error(err);
          if (passwordMessage) passwordMessage.textContent = "Error updating password.";
        }
      });
    })();
  
    // ------------- DELETE ACCOUNT -------------
    (function wireDeleteAccount() {
      const _deleteBtn = document.getElementById("deleteAccountBtn");
      if (!_deleteBtn) return;
      _deleteBtn.addEventListener("click", async () => {
        const ok = confirm(
          "Are you sure? This will sign you out and hide your profile from the community."
        );
        if (!ok) return;

        const deleteMessage = document.getElementById("deleteMessage");
        if (deleteMessage) deleteMessage.textContent = "Deleting account...";

        try {
          const res = await fetch("/api/members/delete", {
            method: "POST",
            credentials: "include",
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            if (deleteMessage) deleteMessage.textContent = data.error || "Failed to delete account.";
            return;
          }

          if (deleteMessage) deleteMessage.textContent = "Account deleted. Redirecting...";
          setTimeout(() => {
            window.location.href = "index.html";
          }, 1200);
        } catch (err) {
          console.error(err);
          if (deleteMessage) deleteMessage.textContent = "Error deleting account.";
        }
      });
    })();


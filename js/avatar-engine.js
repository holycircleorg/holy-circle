console.log("🔥 avatar-engine.js loaded");
// 🔐 Global avatar cache (survives load order)
window.__HC_AVATAR_URL__ = window.__HC_AVATAR_URL__ || null;


// avatar-engine.js
// Single source of truth for avatar DOM updates

(function () {
  const AVATAR_SELECTOR = "img[data-avatar-img]";
  const FALLBACK_SRC = "/images/default-avatar.png";

  let lastAvatarUrl = null;

 function ensureAvatarAttributes() {
  document
    .querySelectorAll("img[data-avatar-img]")
    .forEach(() => {}); // no-op: markup is already correct
}


  function applyAvatar(avatarUrl) {
    if (!avatarUrl || typeof avatarUrl !== "string") return;

    const url = avatarUrl.trim();
    if (!url || url === lastAvatarUrl) return;

    lastAvatarUrl = url;

    const imgs = document.querySelectorAll(AVATAR_SELECTOR);
    if (!imgs.length) {
      console.warn("[avatar-engine] no avatar imgs found");
      return;
    }

    imgs.forEach((img) => {
      img.src = url;
      img.onerror = () => {
        img.src = FALLBACK_SRC;
      };
    });
  }

  // 🔁 Public API
 // 🔁 Public API
window.AvatarEngine = {
  sync(avatarUrl) {
    if (!avatarUrl || typeof avatarUrl !== "string") {
      console.warn("[AvatarEngine] Invalid avatar URL");
      return false;
    }

    const url = avatarUrl.trim();
    if (!url) return false;

    // 🔐 Store globally (critical)
    window.__HC_AVATAR_URL__ = url;

    ensureAvatarAttributes();

    requestAnimationFrame(() => {
      applyAvatar(url);
    });

    return true;
  },

  reset() {
    lastAvatarUrl = null;
    window.__HC_AVATAR_URL__ = null;
  },
};


  // 🧠 Auto-heal on DOM changes (mobile menu, dropdowns, etc.)
  const observer = new MutationObserver(() => {
    if (lastAvatarUrl) applyAvatar(lastAvatarUrl);
  });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

})();
// 🔁 Auto-sync if avatar was set before engine loaded
if (window.__HC_AVATAR_URL__) {
  requestAnimationFrame(() => {
    window.AvatarEngine.sync(window.__HC_AVATAR_URL__);
  });
}

Object.freeze(window.AvatarEngine);

console.log("🔥 avatar-engine.js END", AvatarEngine.sync.toString());

// =============================================================
// HOLY CIRCLE ADMIN LAYOUT — CLEAN FINAL VERSION (NO ERRORS)
// =============================================================
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

(function () {
    const body = document.body;
  
    // Sidebar elements
    const sidebar = document.querySelector(".admin-sidebar");
    const sidebarToggle = document.getElementById("sidebarToggle");
    const mobileOverlay = document.getElementById("mobileOverlay");
  
    // Header dropdown elements
    const profileTrigger = document.getElementById("profileTrigger");
    const headerDropdown = document.getElementById("headerDropdown");
  
    // Profile fields
    const headerName = document.getElementById("headerName");
    const headerRole = document.getElementById("headerRole");
    const ddName = document.getElementById("ddName");
    const ddRole = document.getElementById("ddRole");
  
    // Profile photo / initials
    const profilePic = document.getElementById("profilePic");
    const profileInitials = document.getElementById("profileInitials");
  
    // Notifications
    const notifDot = document.getElementById("notifDot");
  
    // Prevent running if no sidebar
    if (!sidebar || !sidebarToggle) return;
  
    // Device check
    const isMobile = () => window.matchMedia("(max-width: 960px)").matches;
  
  
    // =============================================================
    // SIDEBAR TOGGLE (mobile drawer + desktop collapse)
    // =============================================================
    function toggleSidebar() {
      if (isMobile()) {
        body.classList.toggle("sidebar-open");
      } else {
        body.classList.toggle("sidebar-collapsed");
        sidebar.classList.toggle("collapsed");
      }
    }
  
    sidebarToggle.addEventListener("click", toggleSidebar);
  
  
    // Close mobile sidebar via overlay
    if (mobileOverlay) {
      mobileOverlay.addEventListener("click", () => {
        body.classList.remove("sidebar-open");
      });
    }
  
  
    // =============================================================
    // NAME + ROLE AUTO FILL (safe checks)
    // =============================================================
    const storedName = localStorage.getItem("adminName") || "Admin User";
    const storedRole = (localStorage.getItem("adminRole") || "Admin")
      .replace("-", " ")
      .toUpperCase();
  
    if (headerName) headerName.textContent = storedName;
    if (headerRole) headerRole.textContent = storedRole;
  
    if (ddName) ddName.textContent = storedName;
    if (ddRole) ddRole.textContent = storedRole;
  
  
  

  
  
    // =============================================================
    // RESPONSIVE STATE HANDLING
    // =============================================================
    function handleResize() {
      if (isMobile()) {
        // Mobile: remove collapse mode
        body.classList.remove("sidebar-collapsed");
        sidebar.classList.remove("collapsed");
      } else {
        // Desktop: close mobile sidebar
        body.classList.remove("sidebar-open");
      }
    }
  
    // Run on load + resize
    handleResize();
    window.addEventListener("resize", handleResize);
  
  })();
  
  function adminLogout() {
    fetch("/api/admin/logout", { method: "POST", credentials: "include" })
      .then(() => {
        window.location.href = "admin-login.html";
      });
  }
  
// =============================================================
// MOBILE HEADER DROPDOWN
// =============================================================
const mobileMenuTrigger = document.getElementById("mobileMenuTrigger");
const mobileNavDropdown = document.getElementById("mobileNavDropdown");

if (mobileMenuTrigger && mobileNavDropdown) {
  mobileMenuTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    mobileNavDropdown.classList.toggle("open");
  });

  // Click outside closes dropdown
  document.addEventListener("click", () => {
    mobileNavDropdown.classList.remove("open");
  });
}

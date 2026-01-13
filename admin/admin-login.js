// ADMIN LOGIN — Backend powered, replaces old admin-auth.js entirely
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

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("adminLoginForm");
  const emailEl = document.getElementById("adminLoginEmail");
  const passEl = document.getElementById("adminLoginPassword");
  const statusEl = document.getElementById("adminLoginStatus");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    statusEl.textContent = "Authenticating…";
    statusEl.style.color = "#475569";

    const body = {
      email: emailEl.value.trim(),
      password: passEl.value,
    };

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // send / receive cookie
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      statusEl.textContent = data.error || "Login failed.";
      statusEl.style.color = "red";
      return;
    }

    statusEl.textContent = "Login successful… redirecting";
    statusEl.style.color = "#0a7f3f";

    setTimeout(() => {
      window.location.href = "admin-dashboard.html";
    }, 500);
  });
});

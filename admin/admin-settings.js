const API_BASE = "http://localhost:4000/api";
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

/* Load settings from backend */
async function loadSettings() {
  const res = await fetch(`${API_BASE}/settings`, {
    credentials: "include",
  });

  const data = await res.json();

  document.getElementById("settingMinistryName").value = data.ministryName || "";
  document.getElementById("settingWebsiteURL").value = data.websiteURL || "";
  document.getElementById("settingSupportEmail").value = data.supportEmail || "";

  populateTimezone(data.timezone);
}

/* Populate timezone select */
function populateTimezone(selected) {
  const select = document.getElementById("settingTimezone");
  const timezones = Intl.supportedValuesOf("timeZone");

  timezones.forEach(tz => {
    const option = document.createElement("option");
    option.value = tz;
    option.textContent = tz;
    if (tz === selected) option.selected = true;
    select.appendChild(option);
  });
}

/* Save general settings */
async function saveGeneralSettings() {
  const body = {
    ministryName: document.getElementById("settingMinistryName").value,
    websiteURL: document.getElementById("settingWebsiteURL").value,
    supportEmail: document.getElementById("settingSupportEmail").value,
    timezone: document.getElementById("settingTimezone").value,
  };

  await fetch(`${API_BASE}/settings/general`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  alert("Settings saved.");
}

/* Password Modal */
function openPasswordModal() {
  document.getElementById("passwordModal").classList.add("active");
}

function closePasswordModal() {
  document.getElementById("passwordModal").classList.remove("active");
}

/* Update password */
document.getElementById("changePasswordForm").addEventListener("submit", async e => {
  e.preventDefault();

  const body = {
    currentPassword: document.getElementById("currentPassword").value,
    newPassword: document.getElementById("newPassword").value,
  };

  const res = await fetch(`${API_BASE}/settings/password`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    alert(data.error);
    return;
  }

  closePasswordModal();
  alert("Password updated successfully.");
});

/* 2FA */
function toggle2FA() {
  window.location.href = "admin-2fa.html";
}

async function clearTrustedDevices() {
  await fetch(`${API_BASE}/settings/clear-trusted`, {
    method: "POST",
    credentials: "include",
  });
  alert("Trusted devices cleared.");
}

async function reset2FA() {
  if (!confirm("Disable 2FA and reset secret?")) return;

  await fetch(`${API_BASE}/settings/reset-2fa`, {
    method: "POST",
    credentials: "include",
  });

  alert("2FA reset. Re-enable it through the setup process.");
}

async function forceLogoutAll() {
  await fetch(`${API_BASE}/settings/logout-all`, {
    method: "POST",
    credentials: "include",
  });

  alert("All sessions logged out.");
  logoutAdmin();
}

async function deleteAccount() {
  if (!confirm("Delete your admin account? This cannot be undone.")) return;

  await fetch(`${API_BASE}/settings/delete-account`, {
    method: "DELETE",
    credentials: "include",
  });

  logoutAdmin();
}

/* Init */
loadSettings();

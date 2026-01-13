// js/member-auth.js
// Handles Join, Login, and Forgot Password flows for Holy Circle members

(function () {
const API_BASE = "";



  function getJSON(res) {
    if (!res.ok) throw res;
    return res.json();
  }

  function showError(target, msg) {
    if (!target) return;
    target.textContent = msg || "";
    target.style.display = msg ? "block" : "none";
  }

  function getNextUrl(defaultUrl) {
    const params = new URLSearchParams(location.search);
    return params.get("next") || defaultUrl;
  }

  // -----------------------------
  // FORGOT PASSWORD
  // -----------------------------
  async function handleForgot(form, noticeEl, errorEl) {
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    showError(errorEl, "");
    if (noticeEl) {
      noticeEl.textContent = "";
      noticeEl.style.display = "none";
    }

    form.classList.add("is-loading");

    try {
      const res = await fetch(`${API_BASE}/api/members/auth/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await getJSON(res);

      if (noticeEl) {
        noticeEl.textContent =
          data.message ||
          "If that email exists, we’ll send reset instructions.";
        noticeEl.style.display = "block";
      }
    } catch (err) {
      showError(
        errorEl,
        "We couldn’t send that reset email right now. Please try again."
      );
    } finally {
      form.classList.remove("is-loading");
    }
  }
  document.addEventListener("DOMContentLoaded", () => {

    // LOGIN
 async function handleLogin(form, errorEl) {
  showError(errorEl, "");

  const email = form.querySelector('input[name="email"]')?.value.trim();
  const password = form.querySelector('input[name="password"]')?.value;

  if (!email || !password) {
    showError(errorEl, "Email and password are required.");
    return;
  }

  const payload = { email, password };

  console.log("LOGIN PAYLOAD (FINAL):", payload);

  try {
    const res = await fetch("/api/members/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }

    const next = new URLSearchParams(location.search).get("next") || "/member-dashboard.html";
    window.location.href = next;

  } catch (err) {
    showError(errorEl, err.message);
  }
}



  
    // JOIN
 async function handleJoin(form, errorEl) {
  showError(errorEl, "");

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(`${API_BASE}/api/members/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Registration failed");
    }

    const next = getNextUrl("/member-dashboard.html");
    window.location.href = next;
  } catch (err) {
    showError(errorEl, err.message);
  }
}

// -----------------------------
// LOGIN FORM WIRING
// -----------------------------
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("loginError");
    await handleLogin(loginForm, errorEl);
  });
}

// -----------------------------
// JOIN FORM WIRING
// -----------------------------
const joinForm = document.getElementById("joinForm");
if (joinForm) {
  joinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("joinError");
    await handleJoin(joinForm, errorEl);
  });
}

  
    // FORGOT PASSWORD
    const forgotForm = document.getElementById("forgotForm");
    if (forgotForm) {
      forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById("forgotError");
        const noticeEl = document.getElementById("forgotNotice");
        await handleForgot(forgotForm, noticeEl, errorEl);
      });
    }

      // -----------------------------
  // RESET PASSWORD (new password form)
  // -----------------------------
  async function handleReset(form, noticeEl, errorEl) {
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    // Get token from URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      showError(errorEl, "Reset link is missing or invalid.");
      return;
    }

    if (!payload.password || payload.password.length < 6) {
      showError(errorEl, "Password must be at least 6 characters.");
      return;
    }

    if (payload.password !== payload.confirm) {
      showError(errorEl, "Passwords do not match.");
      return;
    }

    showError(errorEl, "");
    if (noticeEl) {
      noticeEl.textContent = "";
      noticeEl.style.display = "none";
    }

    form.classList.add("is-loading");

    try {
      const res = await fetch(`${API_BASE}/api/members/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token,
          password: payload.password,
        }),
      });

      const data = await getJSON(res);

      if (noticeEl) {
        noticeEl.textContent =
          data.message || "Your password has been reset. Redirecting…";
        noticeEl.style.display = "block";
      }

      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
    } catch (err) {
      showError(
        errorEl,
        "This reset link is invalid or has expired. Please request a new one."
      );
    } finally {
      form.classList.remove("is-loading");
    }
  }

const resetForm = document.getElementById("resetForm");
if (resetForm) {
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("resetError");
    const noticeEl = document.getElementById("resetNotice");
    await handleReset(resetForm, noticeEl, errorEl);
  });
}



  
    // LIVE VALIDATION GLOW
    document.querySelectorAll("input").forEach(input => {
      input.addEventListener("input", () => {
        if (input.validity.valid) {
          input.classList.add("success");
          input.classList.remove("error");
        } else {
          input.classList.add("error");
          input.classList.remove("success");
        }
      });
    });
  
    // PASSWORD VISIBILITY
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("toggle-password")) {
        const input = e.target.previousElementSibling;
        input.type = input.type === "password" ? "text" : "password";
      }
    });
  
  }); // END DOMContentLoaded
  
  
})();

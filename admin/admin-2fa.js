const inputs = document.querySelectorAll(".twofa-input");
const twofaError = document.getElementById("twofaError");
const twofaForm = document.getElementById("twofaForm");
const rememberDevice = document.getElementById("rememberDevice");

const API_BASE = "http://localhost:4000/api";

// Autofocus logic
inputs.forEach((input, index) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/, ""); // Only digits
    if (input.value && index < inputs.length - 1) {
      inputs[index + 1].focus();
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !input.value && index > 0) {
      inputs[index - 1].focus();
    }
  });
});

// Submit 2FA code
twofaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  twofaError.classList.add("hidden");

  // Join 6 digits
  const code = [...inputs].map((i) => i.value).join("");

  if (code.length !== 6) {
    twofaError.textContent = "Please enter the full 6-digit code.";
    twofaError.classList.remove("hidden");
    return;
  }

  const email = sessionStorage.getItem("2fa_email");
  const password = sessionStorage.getItem("2fa_password");

  if (!email || !password) {
    twofaError.textContent = "Session expired. Please log in again.";
    twofaError.classList.remove("hidden");
    return;
  }

  // Verify 2FA using loginAdmin with code
  const result = await loginAdmin(email, password, code, rememberDevice.checked);

  if (result.success) {
    sessionStorage.removeItem("2fa_email");
    sessionStorage.removeItem("2fa_password");
    window.location.href = "admin-dashboard.html";
  } else {
    twofaError.textContent = result.error || "Invalid 2FA code.";
    twofaError.classList.remove("hidden");

    // Shake animation (optional)
    document.querySelector(".twofa-input-wrapper").style.animation = "shake 0.3s";
    setTimeout(() => {
      document.querySelector(".twofa-input-wrapper").style.animation = "";
    }, 300);
  }
});

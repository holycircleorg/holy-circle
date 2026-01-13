const amountButtons = document.querySelectorAll(".amount-btn");
const customAmount = document.getElementById("customAmount");
const donateStatus = document.getElementById("donateStatus");

let selectedAmount = null;

// Predefined amounts
amountButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    amountButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedAmount = parseFloat(btn.dataset.amount);
    customAmount.value = "";
  });
});

// Custom amount clears preset buttons
customAmount.addEventListener("input", () => {
  amountButtons.forEach(b => b.classList.remove("active"));
  selectedAmount = parseFloat(customAmount.value);
});

document.getElementById("donateBtn").addEventListener("click", async () => {
  const amount = selectedAmount || parseFloat(customAmount.value);
  const donorName = document.getElementById("donorName").value.trim();
  const donorEmail = document.getElementById("donorEmail").value.trim();
  const fund = document.getElementById("fund").value;
  const frequency = document.getElementById("frequency").value;
  const note = document.getElementById("note").value.trim();
  const coverFees = document.getElementById("coverFees").checked;

  if (!amount || amount < 1) {
    donateStatus.textContent = "Enter a valid amount.";
    donateStatus.style.color = "red";
    return;
  }
  if (!donorEmail) {
    donateStatus.textContent = "Email required.";
    donateStatus.style.color = "red";
    return;
  }

  donateStatus.textContent = "Creating secure checkout...";
  donateStatus.style.color = "#002e6b";

  try {
    const res = await fetch("/api/stripe/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        donorEmail,
        donorName,
        fund,
        frequency,
        note,
        coverFees
      })
    });

    const data = await res.json();

    if (!data.url) {
      donateStatus.textContent = "Stripe session error.";
      donateStatus.style.color = "red";
      return;
    }

    window.location.href = data.url;

  } catch (err) {
    donateStatus.textContent = "Error connecting to Stripe.";
    donateStatus.style.color = "red";
  }
});

// FAQ Accordion Toggle
document.querySelectorAll(".faq-question").forEach(button => {
  button.addEventListener("click", () => {
    const answer = button.nextElementSibling;

    button.classList.toggle("active");

    if (button.classList.contains("active")) {
      answer.style.maxHeight = answer.scrollHeight + "px";
    } else {
      answer.style.maxHeight = null;
    }
  });
});

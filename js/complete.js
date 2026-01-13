const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get("session_id");

const viewReceiptBtn = document.getElementById("view-receipt");
const downloadPdfBtn = document.getElementById("download-pdf");
const shareBtn = document.getElementById("share-button");
const toggleDetailsBtn = document.getElementById("toggle-details");
const detailsPanel = document.getElementById("details-panel");
const statusText = document.getElementById("status-text");
const donorNameLine = document.getElementById("donor-name-line");

let chargeId = null;
let receiptUrl = null;

/************************************************************
 * Load real Stripe session data
 ************************************************************/
async function loadReceiptDetails() {
  if (!sessionId) {
    statusText.textContent = "Donation complete";
    return;
  }

  try {
    const res = await fetch(
      `/api/donations/session-details?session_id=${sessionId}`
    );
    const data = await res.json();
    if (!data.success || !data.session) {
    statusText.textContent = "Payment received — finalizing your receipt…";
    donorNameLine.textContent = "This may take a moment.";
    return;
  }


    const s = data.session;
    chargeId = s.charge_id;
    receiptUrl = s.receipt_url;

    const donorName = s.customer_details?.name || "Friend";

    statusText.textContent = "Payment Successful 🎉";
    donorNameLine.textContent = `Thank you, ${donorName}!`;

    document.getElementById("intent-id").innerText = s.payment_intent_id;
    document.getElementById("intent-status").innerText =
      s.payment_intent_status;
    document.getElementById("session-status").innerText = s.payment_status;
    document.getElementById("payment-intent-status").innerText =
      s.payment_intent_status;

    document.getElementById("tax-info").innerHTML = `
      <p><strong>Donation Amount:</strong> $${(s.amount_total / 100).toFixed(
        2
      )} ${s.currency.toUpperCase()}</p>
      <p><strong>Transaction Date:</strong> ${new Date(
        s.created * 1000
      ).toLocaleDateString()}</p>
      <p><strong>EIN:</strong> 33-3661912</p>
      <p><em>Your gift is tax-deductible as allowed by law.</em></p>
    `;
  } catch (err) {
  console.warn("Receipt pending:", err);
  statusText.textContent = "Payment received 🎉";
  donorNameLine.textContent =
    "Your receipt is being prepared. Please check back shortly.";
}

}

loadReceiptDetails();
setTimeout(loadReceiptDetails, 3000);


/************************************************************
 * View Stripe Hosted Receipt (REAL)
 ************************************************************/
viewReceiptBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  if (!receiptUrl) return alert("Receipt not available yet.");
  window.open(receiptUrl, "_blank");
});

/************************************************************
 * Download PDF Receipt (YOUR backend)
 ************************************************************/
downloadPdfBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  if (!chargeId) return alert("PDF not ready yet.");
  window.open(
    `/api/donation-receipt/pdf?charge=${chargeId}`,
    "_blank"
  );
});

/************************************************************
 * Share Button
 ************************************************************/
shareBtn?.addEventListener("click", async () => {
  const shareData = {
    title: "I just gave to Holy Circle",
    text: "I just supported Holy Circle — join me in building God's Kingdom.",
    url: `${window.location.origin}/donate.html`,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch {}
  } else {
    await navigator.clipboard.writeText(shareData.url);
    alert("Link copied to clipboard 💛");
  }
});

/************************************************************
 * Toggle Tax / Receipt Details
 ************************************************************/
toggleDetailsBtn?.addEventListener("click", () => {
  const open = detailsPanel.style.display === "block";
  detailsPanel.style.display = open ? "none" : "block";
  toggleDetailsBtn.textContent = open
    ? "Show Receipt & Tax Details"
    : "Hide Receipt & Tax Details";
});

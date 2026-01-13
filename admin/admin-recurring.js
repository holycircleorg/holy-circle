// FILE: admin-recurring.js
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

async function loadRecurringGifts() {
    const res = await fetch("/api/recurring-gifts", { credentials: "include" });
    const data = await res.json();
    window.RECURRING = data;
    renderTable(data);
  }
  
  function renderTable(list) {
    const tbody = document.getElementById("recurringTableBody");
    tbody.innerHTML = "";
  
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem;">No recurring gifts found.</td></tr>`;
      return;
    }
  
    for (const g of list) {
      const nextBilling = new Date(g.current_period_end).toLocaleDateString();
      const statusBadge =
        g.status === "active"
          ? `<span class="status-active">Active</span>`
          : `<span class="status-canceling">Canceling</span>`;
  
      const row = `
        <tr>
          <td>${g.donor_name || "Unknown"}</td>
          <td>${g.donor_email || "—"}</td>
          <td>$${g.amount_dollars.toFixed(2)}</td>
          <td>${g.interval}</td>
          <td>${statusBadge}</td>
          <td>${nextBilling}</td>
          <td>
            <button class="cancel-btn" onclick="cancelSubscription('${g.id}')">
              Cancel
            </button>
          </td>
        </tr>
      `;
      tbody.insertAdjacentHTML("beforeend", row);
    }
  }
  
  async function cancelSubscription(id) {
    if (!confirm("Are you sure you want to cancel this recurring gift?")) return;
  
    const res = await fetch(`/api/recurring-gifts/${id}/cancel`, {
      method: "POST",
      credentials: "include"
    });
  
    if (res.ok) {
      alert("Recurring gift is set to cancel at the end of this period.");
      loadRecurringGifts();
    } else {
      alert("Failed to cancel. Check server logs.");
    }
  }
  
  document.getElementById("searchInput").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
  
    const filtered = window.RECURRING.filter((g) => {
      return (
        (g.donor_name || "").toLowerCase().includes(q) ||
        (g.donor_email || "").toLowerCase().includes(q)
      );
    });
  
    renderTable(filtered);
  });
  
  // Initial load
  loadRecurringGifts();
  
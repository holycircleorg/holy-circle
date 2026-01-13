// ============================================================
//  ADMIN EMAIL TEMPLATES JS — Holy Circle
// ============================================================
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

let currentTemplateId = null;

document.addEventListener("DOMContentLoaded", () => {
  const newBtn = document.getElementById("newTemplateBtn");
  const refreshBtn = document.getElementById("refreshTemplatesBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  const form = document.getElementById("templateForm");

  if (newBtn) newBtn.addEventListener("click", () => startNewTemplate());
  if (refreshBtn) refreshBtn.addEventListener("click", () => loadTemplates());
  if (cancelEditBtn) cancelEditBtn.addEventListener("click", () => startNewTemplate());
  if (form) form.addEventListener("submit", handleSaveTemplate);

  loadTemplates();
  startNewTemplate();
});

// ============================================================
// 1. LOAD TEMPLATE LIST
// ============================================================

async function loadTemplates() {
  const tbody = document.getElementById("templateTableBody");
  tbody.innerHTML = `<tr><td colspan="4">Loading templates...</td></tr>`;

  try {
    const res = await fetch("/api/admin/email-templates", {
      credentials: "include",
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to load templates");
    }

    const templates = data.templates || [];

    if (templates.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4">No templates created yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";

    templates.forEach((tpl) => {
      const tr = document.createElement("tr");

      const created = tpl.created_at
        ? new Date(tpl.created_at).toLocaleDateString()
        : "—";

      const preview =
        tpl.thumbnail && tpl.thumbnail.length > 0
          ? `<img src="${tpl.thumbnail}" alt="Preview" style="max-width:90px; border-radius:4px;" />`
          : `<span style="opacity:0.7;">No preview</span>`;

      tr.innerHTML = `
        <td>${tpl.name}</td>
        <td>${preview}</td>
        <td>${created}</td>
        <td>
          <button class="small-btn" data-edit="${tpl.id}">Edit</button>
          <button class="small-btn" data-duplicate="${tpl.id}">Duplicate</button>
          <button class="small-btn danger" data-delete="${tpl.id}">Delete</button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    // Attach row actions
    tbody.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit");
        editTemplate(id);
      });
    });

    tbody.querySelectorAll("[data-duplicate]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-duplicate");
        duplicateTemplate(id);
      });
    });

    tbody.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-delete");
        deleteTemplate(id);
      });
    });
  } catch (err) {
    console.error("Load Templates Error:", err);
    tbody.innerHTML = `<tr><td colspan="4">Error loading templates.</td></tr>`;
  }
}

// ============================================================
// 2. RESET / START NEW TEMPLATE
// ============================================================

function startNewTemplate() {
  currentTemplateId = null;

  document.getElementById("templateId").value = "";
  document.getElementById("templateName").value = "";
  document.getElementById("templateThumbnail").value = "";
  document.getElementById("templateHtml").value = "";
  document.getElementById("templateText").value = "";
  document.getElementById("templateMessage").textContent = "";

  const title = document.getElementById("templateEditorTitle");
  const saveLabel = document.getElementById("templateSaveLabel");
  const cancelBtn = document.getElementById("cancelEditBtn");

  if (title) title.textContent = "Create Template";
  if (saveLabel) saveLabel.textContent = "Save Template";
  if (cancelBtn) cancelBtn.style.display = "none";
}

// ============================================================
// 3. EDIT TEMPLATE
// ============================================================

async function editTemplate(id) {
  try {
    const res = await fetch(`/api/admin/email-templates/${id}`, {
      credentials: "include",
    });
    const data = await res.json();

    if (!res.ok || !data.template) {
      throw new Error(data.error || "Failed to load template");
    }

    const tpl = data.template;
    currentTemplateId = tpl.id;

    document.getElementById("templateId").value = tpl.id;
    document.getElementById("templateName").value = tpl.name || "";
    document.getElementById("templateThumbnail").value =
      tpl.thumbnail || "";
    document.getElementById("templateHtml").value = tpl.html || "";
    document.getElementById("templateText").value = tpl.text || "";

    const title = document.getElementById("templateEditorTitle");
    const saveLabel = document.getElementById("templateSaveLabel");
    const cancelBtn = document.getElementById("cancelEditBtn");

    if (title) title.textContent = "Edit Template";
    if (saveLabel) saveLabel.textContent = "Update Template";
    if (cancelBtn) cancelBtn.style.display = "inline-flex";

    const msg = document.getElementById("templateMessage");
    msg.textContent = "";
  } catch (err) {
    console.error("Edit Template Error:", err);
    alert(err.message || "Error loading template.");
  }
}

// ============================================================
// 4. DUPLICATE TEMPLATE
// ============================================================

async function duplicateTemplate(id) {
  if (!confirm("Duplicate this template?")) return;

  try {
    // Load existing
    const res = await fetch(`/api/admin/email-templates/${id}`, {
      credentials: "include",
    });
    const data = await res.json();

    if (!res.ok || !data.template) {
      throw new Error(data.error || "Failed to load template");
    }

    const tpl = data.template;

    const payload = {
      name: tpl.name + " (Copy)",
      thumbnail: tpl.thumbnail || null,
      html: tpl.html || "",
      text: tpl.text || "",
    };

    const res2 = await fetch(`/api/admin/email-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data2 = await res2.json();

    if (!res2.ok || !data2.success) {
      throw new Error(data2.error || "Failed to duplicate template");
    }

    loadTemplates();
    alert("Template duplicated.");
  } catch (err) {
    console.error("Duplicate Template Error:", err);
    alert(err.message || "Error duplicating template.");
  }
}

// ============================================================
// 5. DELETE TEMPLATE
// ============================================================

async function deleteTemplate(id) {
  if (!confirm("Permanently delete this template?")) return;

  try {
    const res = await fetch(`/api/admin/email-templates/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to delete template");
    }

    // If you're editing the one that got deleted, reset the form
    if (currentTemplateId === Number(id)) {
      startNewTemplate();
    }

    loadTemplates();
  } catch (err) {
    console.error("Delete Template Error:", err);
    alert(err.message || "Error deleting template.");
  }
}

// ============================================================
// 6. SAVE (CREATE or UPDATE) TEMPLATE
// ============================================================

async function handleSaveTemplate(e) {
  e.preventDefault();

  const id = document.getElementById("templateId").value || null;
  const name = document.getElementById("templateName").value.trim();
  const thumbnail = document
    .getElementById("templateThumbnail")
    .value.trim();
  const html = document.getElementById("templateHtml").value;
  const text = document.getElementById("templateText").value;
  const messageEl = document.getElementById("templateMessage");

  if (!name || !html) {
    messageEl.textContent = "Name and HTML body are required.";
    messageEl.style.color = "#ff4d4d";
    return;
  }

  const payload = {
    name,
    thumbnail: thumbnail || null,
    html,
    text: text || null,
  };

  try {
    let res;
    let data;

    if (id) {
      // UPDATE
      res = await fetch(`/api/admin/email-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
    } else {
      // CREATE
      res = await fetch(`/api/admin/email-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
    }

    data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to save template");
    }

    messageEl.textContent = id
      ? "Template updated successfully."
      : "Template created successfully.";
    messageEl.style.color = "#22c55e";

    loadTemplates();
    if (!id) {
      // After creating new, consider switching into edit mode with it
      startNewTemplate();
    }
  } catch (err) {
    console.error("Save Template Error:", err);
    messageEl.textContent = err.message || "Error saving template.";
    messageEl.style.color = "#ff4d4d";
  }
}

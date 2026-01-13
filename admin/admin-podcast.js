// ==============================
// PODCAST ADMIN DASHBOARD LOGIC
// ==============================
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

let allEpisodes = [];
let editingEpisodeId = null;

// DOM elements
const tableBody = document.getElementById("podcastTableBody");
const emptyState = document.getElementById("emptyPodcastState");
const searchInput = document.getElementById("searchPodcast");
const filterSelect = document.getElementById("podcastStatusFilter");
const statTotal = document.getElementById("statTotalEpisodes");
const statPub = document.getElementById("statPublished");
const statDraft = document.getElementById("statDrafts");

const formPanel = document.getElementById("podcastFormPanel");
const formTitle = document.getElementById("podcastFormTitle");
const saveBtn = document.getElementById("savePodcastBtn");
const cancelBtn = document.getElementById("cancelPodcastBtn");
const formStatus = document.getElementById("podcastFormStatus");

// Form fields
const fTitle = document.getElementById("podcastTitle");
const fStatus = document.getElementById("podcastStatus");
const fDate = document.getElementById("podcastDate");
const fYTTime = document.getElementById("youtubePublishAt");
const fDesc = document.getElementById("podcastDescription");
const fAudio = document.getElementById("podcastAudioFile");
const fVideo = document.getElementById("podcastVideo");


// ==============================
// FETCH EPISODES FROM BACKEND
// ==============================
async function loadEpisodes() {
  try {
    const res = await fetch("/api/podcast/episodes", {
      credentials: "include",
    });

    const data = await res.json();
    allEpisodes = data;

    renderTable(allEpisodes);
    updateStats(allEpisodes);

  } catch (err) {
    console.error("Failed to load episodes:", err);
  }
}

loadEpisodes();


// ==============================
// RENDER TABLE
// ==============================
function renderTable(list) {
  tableBody.innerHTML = "";

  if (!list.length) {
    emptyState.style.display = "block";
    return;
  } else {
    emptyState.style.display = "none";
  }

  list.forEach((ep) => {
    const tr = document.createElement("tr");

    const thumb = ep.youtubeUrl
      ? `https://img.youtube.com/vi/${extractYouTubeID(ep.youtubeUrl)}/mqdefault.jpg`
      : "images/placeholder-thumb.jpg";

    tr.innerHTML = `
      <td>
        <div class="table-flex">
          <img src="${thumb}" class="episode-thumb">
          <div>
            <div class="episode-title">${ep.title}</div>
            <small>${ep.description ? ep.description.slice(0, 45) + "…" : ""}</small>
          </div>
        </div>
      </td>

      <td>
        ${
          ep.youtubeUrl
            ? `<span class="badge badge-youtube">Uploaded</span>`
            : ep.youtubeStatus === "scheduled"
            ? `<span class="badge badge-youtube">Scheduled</span>`
            : `<span class="badge">—</span>`
        }
      </td>

      <td>
        ${
          ep.podbeanUrl
            ? `<span class="badge badge-podbean">Published</span>`
            : `<span class="badge">—</span>`
        }
      </td>

      <td>${ep.publishedAt ? formatDate(ep.publishedAt) : "—"}</td>

      <td>
        <span class="badge badge-${ep.status}">
          ${ep.status}
        </span>
      </td>

      <td class="actions-col">
        <button class="action-btn" onclick="editEpisode('${ep.id}')">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button class="action-btn" onclick="deleteEpisode('${ep.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;

    tableBody.appendChild(tr);
  });
}


// ==============================
// UPDATE STAT CARDS
// ==============================
function updateStats(list) {
  statTotal.textContent = list.length;
  statPub.textContent = list.filter(e => e.status === "published").length;
  statDraft.textContent = list.filter(e => e.status === "draft").length;
}


// ==============================
// SEARCH + FILTER
// ==============================
searchInput.addEventListener("input", () => applyFilters());
filterSelect.addEventListener("change", () => applyFilters());

function applyFilters() {
  const term = searchInput.value.toLowerCase();
  const filter = filterSelect.value;

  const filtered = allEpisodes.filter((ep) => {
    const matchesSearch =
      ep.title.toLowerCase().includes(term) ||
      (ep.description && ep.description.toLowerCase().includes(term));

    const matchesStatus =
      filter === "all" ? true : ep.status === filter;

    return matchesSearch && matchesStatus;
  });

  renderTable(filtered);
}


// ==============================
// OPEN FORM FOR NEW EPISODE
// ==============================
document.getElementById("addPodcastBtn").addEventListener("click", () => {
  editingEpisodeId = null;
  formTitle.textContent = "New Episode";

  resetForm();
  openFormPanel();
});


// ==============================
// EDIT EPISODE
// ==============================
function editEpisode(id) {
  const ep = allEpisodes.find(e => e.id === id);
  if (!ep) return;

  editingEpisodeId = id;
  formTitle.textContent = "Edit Episode";

  fTitle.value = ep.title;
  fStatus.value = ep.status;
  fDate.value = ep.publishedAt ? ep.publishedAt.split("T")[0] : "";
  fYTTime.value = ep.youtubePublishAt || "";
  fDesc.value = ep.description;

  openFormPanel();
}


// ==============================
// DELETE EPISODE
// ==============================
async function deleteEpisode(id) {
  if (!confirm("Delete episode permanently?")) return;

  const res = await fetch(`/api/podcast/episodes/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  const data = await res.json();

  if (data.deleted) {
    allEpisodes = allEpisodes.filter(e => e.id !== id);
    renderTable(allEpisodes);
    updateStats(allEpisodes);
  }
}


// ==============================
// SAVE EPISODE (CREATE / UPDATE)
// ==============================
saveBtn.addEventListener("click", async () => {
  formStatus.textContent = "";
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  const formData = new FormData();
  formData.append("title", fTitle.value);
  formData.append("description", fDesc.value);
  formData.append("status", fStatus.value);
  formData.append("publishedAt", fDate.value);
  formData.append("youtubePublishAt", fYTTime.value);

  if (fAudio.files.length) formData.append("audio", fAudio.files[0]);
  if (fVideo.files.length) formData.append("video", fVideo.files[0]);

  let url = "/api/podcast/episodes";
  let method = "POST";

  if (editingEpisodeId) {
    url = `/api/podcast/episodes/${editingEpisodeId}`;
    method = "PUT";
  }

  try {
    const res = await fetch(url, {
      method,
      credentials: "include",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      formStatus.textContent = data.error || "Error saving episode.";
      saveBtn.disabled = false;
      saveBtn.textContent = "Publish Episode";
      return;
    }

    closeFormPanel();
    loadEpisodes(); // Refresh table

  } catch (err) {
    formStatus.textContent = "Server error.";
    console.error(err);
  }

  saveBtn.disabled = false;
  saveBtn.textContent = "Publish Episode";
});


// ==============================
// FORM UTILS
// ==============================
function resetForm() {
  fTitle.value = "";
  fStatus.value = "draft";
  fDate.value = "";
  fYTTime.value = "";
  fDesc.value = "";
  fAudio.value = "";
  fVideo.value = "";
  formStatus.textContent = "";
}

function openFormPanel() {
  formPanel.classList.remove("hidden");
  formPanel.scrollIntoView({ behavior: "smooth" });
}

cancelBtn.addEventListener("click", () => closeFormPanel());

function closeFormPanel() {
  formPanel.classList.add("hidden");
  resetForm();
  editingEpisodeId = null;
}


// ==============================
// HELPERS
// ==============================
function extractYouTubeID(url) {
  if (!url) return "";
  const match = url.match(/(?:v=|youtu\.be\/)([^&]+)/);
  return match ? match[1] : "";
}

function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

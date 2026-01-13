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



const titleEl = document.getElementById("title");
const descEl = document.getElementById("description");
const durationEl = document.getElementById("duration");

const audioFileEl = document.getElementById("audioFile");
const videoFileEl = document.getElementById("videoFile");

const publishDateEl = document.getElementById("publishDate");
const youtubeScheduleEl = document.getElementById("youtubeSchedule");

const statusBox = document.getElementById("episodeStatus");
const createBtn = document.getElementById("createEpisodeBtn");

createBtn.addEventListener("click", async () => {
  statusBox.textContent = "Uploading… please wait.";
  createBtn.disabled = true;

  const formData = new FormData();
  formData.append("title", titleEl.value.trim());
  formData.append("description", descEl.value.trim());
  formData.append("duration", durationEl.value.trim());

  if (publishDateEl.value) formData.append("publishedAt", publishDateEl.value);
  if (youtubeScheduleEl.value) formData.append("youtubePublishAt", youtubeScheduleEl.value);

  if (audioFileEl.files[0]) formData.append("audio", audioFileEl.files[0]);
  if (videoFileEl.files[0]) formData.append("video", videoFileEl.files[0]);

  try {
    const res = await fetch("/api/podcast/episodes", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Upload failed");

    statusBox.innerHTML = `
      <strong>Success!</strong><br>
      Episode created.<br><br>
      ${
        data.youtubeUrl
          ? `<a href="${data.youtubeUrl}" target="_blank">Watch on YouTube</a><br>`
          : "<em>No video uploaded.</em><br>"
      }
      ${
        data.podbeanUrl
          ? `<a href="${data.podbeanUrl}" target="_blank">Listen on Podbean</a>`
          : "<em>No audio uploaded.</em>"
      }
    `;

    setTimeout(() => {
      window.location.href = "admin-podcast.html";
    }, 2500);

  } catch (err) {
    statusBox.textContent = "Error: " + err.message;
  }

  createBtn.disabled = false;
});

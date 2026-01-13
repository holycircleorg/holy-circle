// Mobile menu toggle (keep if used)
const toggle = document.getElementById("menu-toggle");
const navbarLinks = document.getElementById("navbar-links");

if (toggle && navbarLinks) {
  toggle.addEventListener("click", () => {
    toggle.classList.toggle("active");
    navbarLinks.classList.toggle("active");
  });

  document.querySelectorAll("#navbar-links a").forEach(link => {
    link.addEventListener("click", () => {
      toggle.classList.remove("active");
      navbarLinks.classList.remove("active");
    });
  });
}

async function loadPodcastPage() {
  let episodes = [];

  try {
    const res = await fetch("/api/latest-youtube");
    if (!res.ok) throw new Error("Failed to load episodes");
    episodes = await res.json();
  } catch (err) {
    console.error("Error loading episodes:", err);
    episodes = [];
  }

  const recentEl = document.getElementById("podcastRecentDynamic");
  const grid = document.getElementById("podcastEpisodesGrid");
  const stickyTitle = document.getElementById("stickyTitle");
  const stickyPlayBtn = document.getElementById("stickyPlayBtn");

  // ===============================================================
  //  NO EPISODES (COMING SOON PLACEHOLDER – UPDATED HOLY CIRCLE VOICE)
  // ===============================================================
  if (!episodes || episodes.length === 0) {
    if (recentEl) {
    recentEl.innerHTML = `
      <div class="coming-soon-centered">
        <img src="images/recent.jpg">

        <div class="cs-title">Our First Episode Is Coming Soon</div>


        <a href="https://www.youtube.com/@HolyCircleorg"
          class="cs-button"
          target="_blank">
          Join Us on YouTube
        </a>
      </div>
    `;



    }

    if (grid) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: #555; max-width: 620px; margin: 2rem auto;">
          <h3 style="color:#002e6b; margin-bottom:0.5rem;">
            Episodes Arriving Soon
          </h3>
          <p>
            Our team is praying, preparing, filming, and creating conversations
            that will help people grow in their walk with Christ. Once the first
            episode drops, this section will fill automatically.
          </p>

          <p style="margin-top:1rem; color:#223;">
            Stand with us from day one — subscribe so you don’t miss the launch.
          </p>
        </div>
      `;
    }

    if (stickyTitle && stickyPlayBtn) {
      stickyTitle.innerText = "Holy Circle Podcast Launching Soon";
      stickyPlayBtn.innerText = "Follow on YouTube";
      stickyPlayBtn.href = "https://www.youtube.com/@HolyCircleorg";
      stickyPlayBtn.target = "_blank";
      stickyPlayBtn.rel = "noopener";

    }

    return;
  }

  // ===============================================================
  //  EPISODES LOADED → NORMAL BEHAVIOR
  // ===============================================================
  const recent = episodes[0];

  const recentTitle = recent.title || "Latest Holy Circle Episode";
const recentUrl = "https://www.youtube.com/watch?v=" + recent.videoId



  if (recentEl) {
    const img = recentEl.querySelector("img");
    const titleEl = recentEl.querySelector("h3");
    const descEl = recentEl.querySelector("p");
    const watchBtn = document.getElementById("podcastRecentWatch");

    if (img) img.src = recent.thumbnail;
    if (img) img.alt = recent.title || "Latest Holy Circle episode";
    if (titleEl) titleEl.innerText = recent.title;
    if (descEl) {
      const desc = recent.description || "";
      descEl.innerText = desc.length > 120 ? desc.substring(0, 120) + "..." : desc;
    }
    if (watchBtn) {
      watchBtn.href = "https://www.youtube.com/watch?v=" + recent.videoId

    }
  }

  if (grid) {
    grid.innerHTML = "";
    episodes.forEach((ep, index) => {
      const shortDesc = (ep.description || "");
      const trimmed = shortDesc.length > 150
        ? shortDesc.substring(0, 150) + "..."
        : shortDesc;

      grid.innerHTML += `
        <div class="episode ${index === 0 ? "newest" : ""}">
          <span class="new-badge" style="${index === 0 ? "" : "display:none;"}">
            New
          </span>
          <iframe
            style="width:100%;height:180px;border:none;border-radius:12px;"
            src="https://www.youtube.com/embed/${ep.videoId}"
            title="${ep.title || "Holy Circle Episode"}"
            allowfullscreen
          ></iframe>
          <h3>${ep.title}</h3>
          <p>${trimmed}</p>
        </div>
      `;
    });
  }

  if (stickyTitle && stickyPlayBtn) {
    stickyTitle.innerText = recent.title || "Latest Holy Circle Episode";
    stickyPlayBtn.innerText = "▶ Play";
    stickyPlayBtn.href = recentUrl;
    stickyPlayBtn.target = "_blank";
  }
}

document.addEventListener("DOMContentLoaded", loadPodcastPage);

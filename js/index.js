// ===============================
// INDEX.JS — HOMEPAGE ONLY
// ===============================

// Load latest podcast episode
async function loadHomePodcast() {
    try {
      const res = await fetch("/api/latest-youtube");
      const episodes = await res.json();
      if (!Array.isArray(episodes) || !episodes.length) return;

  
      const featured = episodes[0];
  
      // Featured
      const featuredImg = document.getElementById("featuredImg");
      const featuredTitle = document.getElementById("featuredTitle");
      const featuredDesc = document.getElementById("featuredDesc");
      const featuredWatchBtn = document.getElementById("featuredWatchBtn");
  
      if (featuredImg) featuredImg.src = featured.thumbnail;
      if (featuredTitle) featuredTitle.innerText = featured.title;
      if (featuredDesc)
        featuredDesc.innerText = featured.description.substring(0, 120) + "...";
      if (featuredWatchBtn)
        featuredWatchBtn.href = `https://www.youtube.com/watch?v=${featured.videoId}`;
  
      // Sticky Bar
      const stickyTitle = document.getElementById("stickyTitle");
      const stickyPlayBtn = document.getElementById("stickyPlayBtn");
      if (stickyTitle) stickyTitle.innerText = featured.title;
      if (stickyPlayBtn)
        stickyPlayBtn.href = `https://www.youtube.com/watch?v=${featured.videoId}`;
  
      // Grid
      const grid = document.getElementById("homePodcastGrid");
      if (grid) {
        grid.innerHTML = "";
        episodes.slice(0, 3).forEach((ep) => {
          grid.innerHTML += `
            <div class="episode newest">
              <span class="new-badge">New</span>
              <img src="${ep.thumbnail}">
              <h3>${ep.title}</h3>
              <p>${ep.description.substring(0,130)}...</p>
              <a href="https://www.youtube.com/watch?v=${ep.videoId}" class="listen">▶ Watch</a>
            </div>
          `;
        });
      }
    } catch (err) {
      console.error("Error loading podcast:", err);
    }
  }
  
  // Load Shorts
  async function loadTrendingShorts() {
    try {
      const res = await fetch("/api/latest-youtube");
      const data = await res.json();

      if (!Array.isArray(data)) {
        console.error("Expected array from /api/latest-youtube, got:", data);
        return;
      }

      const shorts = data.filter(
        (ep) =>
          ep.title?.toLowerCase().includes("short") ||
          ep.description?.toLowerCase().includes("short") ||
          ep.title?.includes("#shorts")
      );

  
      const row = document.getElementById("shortsRow");
      if (!row) return;
  
      row.innerHTML = "";
      shorts.slice(0, 10).forEach((clip) => {
        row.innerHTML += `
          <div class="short-card" data-video="${clip.videoId}">
            <img class="short-video" src="${clip.thumbnail}">
            <div class="short-stats">
              <span>👁 ${clip.views || "???"}</span>
              <span>❤️ ${clip.likes || "???"}</span>
            </div>
            <div class="short-info">
              <h4>${clip.title}</h4>
              <p>${clip.description.substring(0,80)}...</p>
            </div>
          </div>
        `;
      });
  
      const cards = document.querySelectorAll(".short-card");
      const mini = document.getElementById("miniPlayerFrame");
      const playHeader = document.querySelector(".mini-header");
  
      if (!mini || !playHeader) return;
  
      let index = 0;
  
      function playNext() {
        mini.src = `https://www.youtube.com/embed/${shorts[index].videoId}?autoplay=1`;
        index = (index + 1) % shorts.length;
      }
  
      playHeader.addEventListener("click", playNext);
      cards.forEach((card, i) => {
        card.addEventListener("click", () => {
          index = i;
          playNext();
        });
      });
  
      // Slider buttons
      const left = document.getElementById("shortsLeft");
      const right = document.getElementById("shortsRight");
  
      if (left) left.addEventListener("click", () => (row.scrollLeft -= 300));
      if (right) right.addEventListener("click", () => (row.scrollLeft += 300));
  
    } catch (err) {
      console.error("Error loading shorts:", err);
    }
  }
  // =============================
// EMAIL SIGNUP FORM HANDLER
// =============================
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".email-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailInput = form.querySelector("input[type='email']");
    const email = emailInput.value.trim();

    if (!email) return;

    // Optional: track where the signup came from
    const source_page = "homepage";

    try {
      const res = await fetch("/api/email-signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source_page }),
      });

      const data = await res.json();

      if (data.success) {
        emailInput.value = "";
        alert("Thank you for joining Holy Circle!");
      } else {
        alert(data.error || "Something went wrong.");
      }
    } catch (err) {
      console.error("Email signup failed:", err);
      alert("There was a problem submitting your email. Please try again.");
    }
  });
});



  // Run homepage scripts
  document.addEventListener("DOMContentLoaded", () => {
    loadHomePodcast();
    loadTrendingShorts();
  });
  
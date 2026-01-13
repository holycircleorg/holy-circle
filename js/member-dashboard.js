// js/member-profile.js

(function () {
  function qs(sel) {
    return document.querySelector(sel);
  }

  function qsa(sel) {
    return Array.from(document.querySelectorAll(sel));
  }

  function toDate(value) {
    if (!value) return null;
    if (typeof value === "number" || /^\d+$/.test(String(value))) {
      const n = Number(value);
      return new Date(n < 1e12 ? n * 1000 : n);
    }
    return new Date(value);
  }

  function formatDate(value) {
    const d = toDate(value);
    if (!d || isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatDateTime(value) {
    const d = toDate(value);
    if (!d || isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatCurrency(amount) {
    const num = Number(amount || 0);
    return num.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    });
  }

  function getMemberIdFromUrlOrGlobal() {
    const params = new URLSearchParams(window.location.search);
    let id = params.get("id");

    // Fallback: if member-auth.js exposes current member
   if (!id && window.hcUser && window.hcUser.profile?.id) {
  id = window.hcUser.profile.id;
}


    return id;
  }

  

  function renderBadges(badges, container) {
    if (!container) return;
    container.innerHTML = "";

    if (!badges || badges.length === 0) {
      return;
    }

    badges.forEach((badge) => {
      const span = document.createElement("span");
      span.className = "badge";
      span.textContent = badge;
      container.appendChild(span);
    });
  }

  function renderTimeline(profile) {
    const container = qs("#memberTimeline");
    if (!container) return;
    container.innerHTML = "";

    const items = [];

    if (profile.created_at) {
      items.push({
        label: "Joined Holy Circle",
        value: formatDate(profile.created_at),
      });
    }

    if (profile.first_thread_date) {
      items.push({
        label: "First Forum Thread",
        value: formatDate(profile.first_thread_date),
      });
    }

    if (profile.last_active) {
      items.push({
        label: "Last Active in Forum",
        value: formatDateTime(profile.last_active),
      });
    }

    if (items.length === 0) {
      container.innerHTML =
        '<p class="profile-meta">No activity yet — jump into the forum and start a thread!</p>';
      return;
    }

    const list = document.createElement("ul");
    list.className = "timeline-list";

    items.forEach((item) => {
      const li = document.createElement("li");
      li.className = "timeline-item";
      li.innerHTML = `
        <div class="timeline-label">${item.label}</div>
        <div class="timeline-value">${item.value}</div>
      `;
      list.appendChild(li);
    });

    container.appendChild(list);
  }

  function renderActivity(activity) {
    const threadsList = qs("#threadsList");
    const repliesList = qs("#repliesList");

    if (threadsList) {
      threadsList.innerHTML = "";
      const threads = (activity && activity.threads) || [];
      if (threads.length === 0) {
        threadsList.innerHTML =
          '<li class="empty-state">No threads yet. Start your first conversation in the forum.</li>';
      } else {
        threads.forEach((t) => {
          const li = document.createElement("li");
          li.className = "activity-item";
          const created = formatDate(t.created_at);
          li.innerHTML = `
            <a href="/forum-thread.html?id=${t.id}" class="activity-title">
              ${t.title || "Thread"}
            </a>
            <div class="activity-meta">
              ${created} • ${t.likes_count || 0} likes
            </div>
          `;
          threadsList.appendChild(li);
        });
      }
    }

    if (repliesList) {
      repliesList.innerHTML = "";
      const replies = (activity && activity.replies) || [];
      if (replies.length === 0) {
        repliesList.innerHTML =
          '<li class="empty-state">No replies yet. Jump into a thread and encourage someone.</li>';
      } else {
        replies.forEach((r) => {
          const li = document.createElement("li");
          li.className = "activity-item";
          const created = formatDate(r.created_at);
          li.innerHTML = `
            <a href="/forum-thread.html?id=${r.thread_id}" class="activity-title">
              Reply in: ${r.thread_title || "Thread"}
            </a>
            <div class="activity-meta">${created}</div>
            <p class="activity-body">
              ${r.body || ""}
            </p>
          `;
          repliesList.appendChild(li);
        });
      }
    }
  }

  function renderRsvps(rsvps) {
    const list = qs("#profileEventsList");
    if (!list) return;

    list.innerHTML = "";

    if (!rsvps || rsvps.length === 0) {
      list.innerHTML =
        '<li class="empty-state">No upcoming events yet. Explore events and RSVP to join in.</li>';
      return;
    }

    rsvps.forEach((r) => {
      const li = document.createElement("li");
      li.className = "event-item";
      li.innerHTML = `
        <div class="event-title">${r.name || "Event"}</div>
        <div class="event-meta">${formatDate(r.event_date || r.date)} • ${
        r.location || ""
      }</div>
      `;
      list.appendChild(li);
    });
  }

  function renderFollowInfo(followInfo) {
    const followersEl = qs("#followersCount");
    const followingEl = qs("#followingCount");
    const followBtn = qs("[data-follow-btn]");

    if (followersEl) followersEl.textContent = followInfo?.followers ?? 0;
    if (followingEl) followingEl.textContent = followInfo?.following ?? 0;

    if (!followBtn) return;

    if (followInfo && followInfo.isFollowing) {
      followBtn.textContent = "Following";
      followBtn.classList.add("is-following");
    } else {
      followBtn.textContent = "Follow";
      followBtn.classList.remove("is-following");
    }

    // For now we just style the button; you can wire API follow/unfollow later
    followBtn.disabled = !followInfo; // if we didn't get any info, disable
  }

  async function loadProfile() {
    const id = getMemberIdFromUrlOrGlobal();
    if (!id) {
      console.error("No member id for profile page");
      return;
    }

    try {
      const res = await fetch(`/api/members/${id}/profile`, {
        credentials: "include",
      });
      const json = await res.json();
   // Normalize profile payload across endpoints
const profile =
  json.member ||
  json.profile ||
  json.data?.profile ||
  (json && json.id ? json : null);

const activity = json.activity || json.data?.activity || {};
const rsvps = json.rsvps || json.data?.rsvps || [];
const followInfo = json.followInfo || json.data?.followInfo || null;


      // ✅ Guard: backend must return { member }
if (!res.ok) {
  console.error("Profile fetch failed:", res.status, json);
  return;
}

// Normalize backend payloads (dashboard vs profile endpoints)
const member =
  json.member ||
  json.profile ||
  json.data?.profile ||
  null;

if (!profile) {
  console.error("Profile payload invalid:", json);
  return;
}


      
// ------------------------------
// DASHBOARD GREETING (TIME-BASED)
// ------------------------------
const nameEl = document.querySelector("[data-member-name]");

if (nameEl && profile && window.getTimeBasedGreeting) {

    const name =
      profile.first_name ||
      profile.username ||
      "Member";


  nameEl.textContent = nameEl.textContent = window.getTimeBasedGreeting(name);
}


      // Basic header
      const fullName =
        [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
        profile.email ||
        "Member";

      const profileNameEl = qs("#profileName");
      if (profileNameEl) profileNameEl.textContent = fullName;

   

      // Member since
      const memberSinceHeader = qs("#memberSince");
      if (memberSinceHeader) {
        memberSinceHeader.textContent =
          "Member since " + formatDate(profile.created_at);
      }

      const summaryMemberSince = qs("#profileMemberSince");
      if (summaryMemberSince) {
        summaryMemberSince.textContent = formatDate(profile.created_at);
      }

      const lastLoginEl = qs("#profileLastLogin");
      if (lastLoginEl) {
        lastLoginEl.textContent = formatDateTime(profile.last_login);
      }

      // Location + website
      const locEl = qs("#profileLocation");
      if (locEl) {
        locEl.textContent = profile.location
          ? profile.location
          : "";
      }

      const webEl = qs("#profileWebsite");
      if (webEl) {
        if (profile.website) {
          let url = profile.website;
          if (!/^https?:\/\//i.test(url)) {
            url = "https://" + url;
          }
          webEl.innerHTML = `<a href="${url}" target="_blank" rel="noopener">${profile.website}</a>`;
        } else {
          webEl.textContent = "";
        }
      }

      // Verse + testimony
      const verseEl = qs("#profileVerse");
      if (verseEl) {
        verseEl.textContent =
          profile.featured_verse ||
          "Add a featured verse in your profile settings.";
      }

      const verseRefEl = qs("#profileVerseRef");
      if (verseRefEl) {
        verseRefEl.textContent = profile.featured_verse_ref || "";
      }

      const testimonyEl = qs("#profileTestimony");
      if (testimonyEl) {
        testimonyEl.textContent =
          profile.testimony ||
          "Share a short testimony about what God is doing in your life.";
      }

      // Badges
      renderBadges(profile.badges || [], qs("#badgeContainer"));
      renderBadges(profile.badges || [], qs("#sidebarBadges"));

      // Forum stats
      const postsEl = qs("#profileForumPosts");
      const repliesEl = qs("#profileForumReplies");
      const likesEl = qs("#profileForumLikes");

      if (postsEl) postsEl.textContent = profile.total_threads ?? 0;
      if (repliesEl) repliesEl.textContent = profile.total_replies ?? 0;
      if (likesEl) likesEl.textContent = profile.total_likes_received ?? 0;

      // Recent activity
      renderActivity(activity);

      // RSVPs / events
      renderRsvps(rsvps);

      // Follow info
      renderFollowInfo(followInfo);

      // Edit Profile button — always points to your edit page
      const editBtn = qs("#editProfileBtn");
      if (editBtn) {
        editBtn.href = "/test-edit-profile.html";
      }

  await loadDashboardAnalytics();


    } catch (err) {
      console.error("Error loading profile:", err);
    }
  }




async function loadDashboardAnalytics() {
  if (!window.MemberAnalytics) return;

  const data = await window.MemberAnalytics.fetch();
  if (!data) return;

  const { totals } = data;

  const totalEl = document.getElementById("givingTotal");
  const recentEl = document.getElementById("givingRecent");
  const recurringEl = document.getElementById("givingRecurring");

  if (totalEl) {
    totalEl.textContent = `$${totals.totalDollars.toFixed(2)}`;
  }

  if (recentEl) {
    recentEl.textContent = totals.lastDonationAt
      ? `$${totals.totalDollars.toFixed(2)}`
      : "$0";
  }

  if (recurringEl) {
    recurringEl.textContent = `$${totals.recurringMonthlyDollars.toFixed(2)}`;
  }
}





  
  function calculateProfileCompletion(profile) {
    let total = 0;
    let filled = 0;
  
    const fields = member[
      profile.first_name,
      profile.last_name,
      profile.username,
      profile.bio,
      profile.testimony,
      profile.favorite_verse,
      profile.location,
      profile.website,
      profile.social_instagram,
      profile.social_tiktok,
      profile.social_youtube,
      profile.social_x,
      profile.avatar_url,
      profile.banner_url
    ];
  
    total = fields.length;
    filled = fields.filter((v) => v && String(v).trim() !== "").length;
  
    if (!total) return 0;
    return Math.min(100, Math.round((filled / total) * 100));
  }
  
  function updateProfileProgressUI(profile) {
    const label = document.getElementById("profileProgressLabel");
    const fill  = document.getElementById("profileProgressFill");
    if (!label || !fill || !profile) return;
  
    const pct = calculateProfileCompletion(profile);
    label.textContent = pct + "%";
    fill.style.width = pct + "%";
  }

  
  window.addEventListener("hc:auth-ready", loadProfile);
  window.addEventListener("hc:auth-ready", () => {
  if (window.hcUser?.loggedIn) {
    loadDashboardAnalytics();
  }
});

})();

// admin-analytics-realtime.js
// ===============================
// Holy Circle — Realtime Dashboard
// ===============================
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

const rtStatusDot = document.getElementById("rtStatusDot");
const rtStatusText = document.getElementById("rtStatusText");

const rtActiveVisitors = document.getElementById("rtActiveVisitors");
const rtMembersOnline = document.getElementById("rtMembersOnline");
const rtGuestsOnline = document.getElementById("rtGuestsOnline");

const rtBarMobile = document.getElementById("rtBarMobile");
const rtBarDesktop = document.getElementById("rtBarDesktop");
const rtBarTablet = document.getElementById("rtBarTablet");
const rtBarOther = document.getElementById("rtBarOther");

const rtMobileCount = document.getElementById("rtMobileCount");
const rtDesktopCount = document.getElementById("rtDesktopCount");
const rtTabletCount = document.getElementById("rtTabletCount");
const rtOtherCount = document.getElementById("rtOtherCount");

const rtActivityFeed = document.getElementById("rtActivityFeed");

const rtFunnelViews = document.getElementById("rtFunnelViews");
const rtFunnelOpens = document.getElementById("rtFunnelOpens");
const rtFunnelRsvps = document.getElementById("rtFunnelRsvps");
const rtFunnelMembers = document.getElementById("rtFunnelMembers");

function setStatus(online) {
  if (!rtStatusDot || !rtStatusText) return;
  if (online) {
    rtStatusDot.classList.remove("rt-dot-offline");
    rtStatusDot.classList.add("rt-dot-online");
    rtStatusText.textContent = "Live";
  } else {
    rtStatusDot.classList.remove("rt-dot-online");
    rtStatusDot.classList.add("rt-dot-offline");
    rtStatusText.textContent = "Disconnected";
  }
}

function connectRealtime() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const url = `${protocol}://${window.location.host}/realtime`;

  const socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    setStatus(true);
  });

  socket.addEventListener("close", () => {
    setStatus(false);
    setTimeout(connectRealtime, 3000); // auto-reconnect
  });

  socket.addEventListener("error", () => {
    setStatus(false);
  });

  socket.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === "realtime_update") {
        applyRealtime(payload.data);
      }
    } catch (err) {
      console.error("Realtime parse error:", err);
    }
  });
}

function applyRealtime(data) {
  if (!data) return;

  // 1) Active visitors
  rtActiveVisitors.textContent = data.activeVisitors ?? 0;
  rtMembersOnline.textContent = data.memberVisitors ?? 0;
  rtGuestsOnline.textContent = data.guestVisitors ?? 0;

  // 2) Devices
  const devices = data.devices || {};
  const mobile = devices.mobile || 0;
  const desktop = devices.desktop || 0;
  const tablet = devices.tablet || 0;
  const other = devices.other || 0;
  const maxCount = Math.max(mobile, desktop, tablet, other, 1);

  const pct = (value) => `${(value / maxCount) * 100}%`;

  rtBarMobile.style.width = pct(mobile);
  rtBarDesktop.style.width = pct(desktop);
  rtBarTablet.style.width = pct(tablet);
  rtBarOther.style.width = pct(other);

  rtMobileCount.textContent = mobile;
  rtDesktopCount.textContent = desktop;
  rtTabletCount.textContent = tablet;
  rtOtherCount.textContent = other;

  // 3) Activity feed
  renderActivityFeed(data.recentActivity || []);

  // 4) Event funnel
  const funnel = data.eventFunnel || {};
  rtFunnelViews.textContent = funnel.views ?? 0;
  rtFunnelOpens.textContent = funnel.rsvp_opens ?? 0;
  rtFunnelRsvps.textContent = funnel.rsvps ?? 0;
  rtFunnelMembers.textContent = funnel.member_conversions ?? 0;
}

function renderActivityFeed(items) {
  if (!rtActivityFeed) return;
  rtActivityFeed.innerHTML = "";

  if (!items.length) {
    const li = document.createElement("li");
    li.className = "rt-feed-empty";
    li.textContent = "No activity in the last 5 minutes.";
    rtActivityFeed.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "rt-feed-item";

    const left = document.createElement("div");
    left.className = "rt-feed-left";

    const pathEl = document.createElement("div");
    pathEl.className = "rt-feed-path";
    pathEl.textContent = item.path || "/";

    const metaEl = document.createElement("div");
    metaEl.className = "rt-feed-meta";
    metaEl.textContent = formatTimeAgo(item.timeAgoMs || 0);

    left.appendChild(pathEl);
    left.appendChild(metaEl);

    const badge = document.createElement("span");
    badge.className =
      "rt-feed-badge " +
      (item.isMember ? "rt-feed-badge-member" : "rt-feed-badge-guest");
    badge.textContent = item.isMember ? "Member" : "Guest";

    li.appendChild(left);
    li.appendChild(badge);

    rtActivityFeed.appendChild(li);
  });
}

function formatTimeAgo(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

document.addEventListener("DOMContentLoaded", () => {
  setStatus(false);
  connectRealtime();
});

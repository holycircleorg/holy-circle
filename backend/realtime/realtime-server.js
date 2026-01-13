// realtime/realtime-server.js
// =============================================
// Holy Circle — Real-time Analytics Server
// =============================================

import WebSocket, { WebSocketServer } from "ws";
import db from "../db.js";

let wss;


// Helpers
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function buildRealtimePayload() {
  const nowMs = Date.now();
  const windowMs = 5 * 60 * 1000; // last 5 minutes
  const boundaryMs = nowMs - windowMs;

  // 1) Active visitors (from page_views)
  const activeRow = await get(
    `
    SELECT 
      COUNT(DISTINCT session_id) AS activeVisitors,
      COUNT(DISTINCT CASE WHEN member_id IS NOT NULL THEN session_id END) AS memberVisitors
    FROM page_views
    WHERE created_at >= ?
  `,
    [boundaryMs]
  );

  const activeVisitors = activeRow?.activeVisitors || 0;
  const memberVisitors = activeRow?.memberVisitors || 0;
  const guestVisitors = Math.max(activeVisitors - memberVisitors, 0);

  // 2) Recent activity (last 20 page views)
  const recentRows = await all(
    `
    SELECT path, member_id, created_at
    FROM page_views
    WHERE created_at >= ?
    ORDER BY created_at DESC
    LIMIT 20
  `,
    [boundaryMs]
  );

  const recentActivity = recentRows.map((row) => ({
    path: row.path || "/",
    isMember: !!row.member_id,
    createdAt: row.created_at,
    timeAgoMs: nowMs - (row.created_at || nowMs),
  }));

  // 3) Device breakdown (rough UA classification)
  const uaRows = await all(
    `
    SELECT user_agent
    FROM page_views
    WHERE created_at >= ?
  `,
    [boundaryMs]
  );

  const devices = { mobile: 0, desktop: 0, tablet: 0, other: 0 };
  uaRows.forEach((r) => {
    const ua = (r.user_agent || "").toLowerCase();
    if (!ua) {
      devices.other++;
    } else if (ua.includes("ipad") || ua.includes("tablet")) {
      devices.tablet++;
    } else if (
      ua.includes("mobi") ||
      ua.includes("android") ||
      ua.includes("iphone")
    ) {
      devices.mobile++;
    } else if (
      ua.includes("windows") ||
      ua.includes("macintosh") ||
      ua.includes("linux")
    ) {
      devices.desktop++;
    } else {
      devices.other++;
    }
  });

  // 4) Event funnel (views → RSVPs → member conversions)
  // Event page views: any page under /event or /events in last 5m
  const eventViewsRow = await get(
    `
    SELECT COUNT(*) AS count
    FROM page_views
    WHERE created_at >= ?
      AND (path LIKE '/event%' OR path LIKE '/events%')
  `,
    [boundaryMs]
  );
  const views = eventViewsRow?.count || 0;

  // RSVPs in last 5 min (members + guests)
  const rsvpMembersRow = await get(
    `
    SELECT COUNT(*) AS count
    FROM event_rsvps
    WHERE created_at >= ?
  `,
    [boundaryMs]
  );

  const rsvpGuestsRow = await get(
    `
    SELECT COUNT(*) AS count
    FROM event_rsvp_guest
    WHERE created_at >= ?
  `,
    [boundaryMs]
  );

  const rsvps =
    (rsvpMembersRow?.count || 0) + (rsvpGuestsRow?.count || 0);

  // Member conversions in last 5m
  const memberConversionsRow = await get(
    `
    SELECT COUNT(*) AS count
    FROM members
    WHERE created_at >= ?
  `,
    [boundaryMs]
  );

  const memberConversions = memberConversionsRow?.count || 0;

  const eventFunnel = {
    views,
    rsvp_opens: rsvps, // for now, treat RSVP submissions as opens
    rsvps,
    member_conversions: memberConversions,
  };

  return {
    activeVisitors,
    memberVisitors,
    guestVisitors,
    recentActivity,
    devices,
    eventFunnel,
  };
}
// Broadcast new notifications to all connected clients
export function broadcastNotification(payload) {
  if (!wss) return;

  const targetId = Number(payload?.member_id);
  if (!targetId) return;

  const message = JSON.stringify({
    type: "new_notification",
    payload
  });

  wss.clients.forEach((client) => {
    if (client.readyState !== 1) return; // OPEN
    if (Number(client.memberId) !== targetId) return;
    client.send(message);
  });
}



export default function startRealtimeServer(server) {
  wss = new WebSocketServer({
    server,
    path: "/realtime",
  });

  console.log("🔴 Real-time analytics WebSocket server attached at /realtime");


  const communityRooms = new Map();
  globalThis.__hcCommunityRooms = communityRooms;

  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.__communities = new Set();
    ws.memberId = null;

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(String(raw || ""));

        // client sends: { type: "auth", memberId: 123 }
        if (msg?.type === "auth" && Number(msg.memberId)) {
          ws.memberId = Number(msg.memberId);
          // optional ack
          ws.send(JSON.stringify({ type: "auth_ok", memberId: ws.memberId }));
        }
      } catch (_) {
        // ignore malformed
      }



      if (msg.type === "community:join") {
        const id = Number(msg.communityId);
        if (!id) return;

        ws.__communities.add(id);
        if (!communityRooms.has(id)) {
          communityRooms.set(id, new Set());
        }
        communityRooms.get(id).add(ws);
      }

      if (msg.type === "community:leave") {
        const id = Number(msg.communityId);
        if (!id) return;

        ws.__communities.delete(id);
        communityRooms.get(id)?.delete(ws);
      }
    });

    ws.on("close", () => {
      ws.__communities.forEach(id => {
        communityRooms.get(id)?.delete(ws);
      });
    });

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.send(JSON.stringify({
      type: "hello",
      message: "Connected to Holy Circle real-time analytics",
    }));
  });

  
  // Broadcast loop
  const broadcastInterval = setInterval(async () => {
    if (wss.clients.size === 0) return;

    let payload;
    try {
      payload = await buildRealtimePayload();
    } catch (err) {
      console.error("Error building real-time payload:", err);
      return;
    }

    const message = JSON.stringify({
      type: "realtime_update",
      data: payload,
      ts: Date.now(),
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }, 2000);

  // Basic heartbeat to clean up dead sockets
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(broadcastInterval);
    clearInterval(heartbeatInterval);
  });
}


export function broadcastRealtime(data) {
  if (!wss) return;

  const message = JSON.stringify({
    type: "realtime_update",
    data,
    ts: Date.now(),
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}



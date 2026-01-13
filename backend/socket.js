import WebSocket, { WebSocketServer } from "ws";

let wss;

export function initSocketServer(server) {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });
  });

  // heartbeat (prevents stale sockets)
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  console.log("🟢 WebSocket server initialized");
}

export function broadcast(event) {
  if (!wss) return;

  const payload = JSON.stringify(event);

  wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

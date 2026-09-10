const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer, WebSocket } = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(__dirname));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "screen-mirroring" });
});

// ============================================================
// Android クラッシュレポート受信
// ============================================================
app.post("/crash-report", (req, res) => {
  try {
    const report = req.body || {};

    console.error("========================================");
    console.error("ANDROID CRASH REPORT");
    console.error("========================================");
    console.error("Time:", new Date().toISOString());
    console.error("Device:", report.device || "unknown");
    console.error("Android:", report.androidVersion || "unknown");
    console.error("App version:", report.appVersion || "unknown");
    console.error("Room:", report.room || "unknown");
    console.error("Stage:", report.stage || "unknown");
    console.error("Exception:", report.exception || "unknown");
    console.error("Message:", report.message || "unknown");
    console.error("StackTrace:");
    console.error(report.stackTrace || "unknown");
    console.error("========================================");

    res.json({
      ok: true,
      received: true
    });
  } catch (error) {
    console.error("Crash report error:", error);

    res.status(500).json({
      ok: false,
      message: "クラッシュレポートを処理できませんでした。"
    });
  }
});

// roomId -> { clients: Map<clientId, ws> }
const rooms = new Map();

function makeId() {
  return crypto.randomBytes(8).toString("hex");
}

function makeRoomCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function removeFromRoom(ws) {
  if (!ws.roomId || !ws.clientId) return;

  const room = rooms.get(ws.roomId);
  if (!room) return;

  room.clients.delete(ws.clientId);

  for (const [, client] of room.clients) {
    send(client, {
      type: "peer-left",
      peerId: ws.clientId,
      role: ws.role
    });
  }

  if (room.clients.size === 0) {
    rooms.delete(ws.roomId);
  }

  ws.roomId = null;
  ws.clientId = null;
  ws.role = null;
}

wss.on("connection", (ws) => {
  ws.clientId = makeId();

  send(ws, {
    type: "hello",
    clientId: ws.clientId
  });

  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === "join") {
        const roomId = String(data.room || "")
          .trim()
          .toUpperCase()
          .slice(0, 32);

        const role =
          data.role === "broadcaster"
            ? "broadcaster"
            : "viewer";

        if (!roomId) {
          send(ws, {
            type: "error",
            message: "ルームコードがありません。"
          });
          return;
        }

        removeFromRoom(ws);

        if (!rooms.has(roomId)) {
          rooms.set(roomId, {
            clients: new Map()
          });
        }

        const room = rooms.get(roomId);

        // 1ルームにつき配信者は1台だけ。
        if (
          role === "broadcaster" &&
          [...room.clients.values()].some(
            (client) => client.role === "broadcaster"
          )
        ) {
          send(ws, {
            type: "error",
            message: "このルームにはすでに配信端末があります。"
          });
          return;
        }

        ws.roomId = roomId;
        ws.role = role;

        room.clients.set(ws.clientId, ws);

        send(ws, {
          type: "joined",
          room: roomId,
          clientId: ws.clientId,
          role,
          peerCount: room.clients.size - 1
        });

        for (const [peerId, client] of room.clients) {
          if (peerId === ws.clientId) continue;

          send(client, {
            type: "peer-joined",
            peerId: ws.clientId,
            role
          });

          send(ws, {
            type: "peer-joined",
            peerId,
            role: client.role
          });
        }

        return;
      }

      // WebRTC signaling:
      // offer / answer / candidate
      if (
        ["offer", "answer", "candidate"].includes(data.type)
      ) {
        if (!ws.roomId || !data.to) return;

        const room = rooms.get(ws.roomId);
        const target = room?.clients.get(data.to);

        if (!target) return;

        send(target, {
          type: data.type,
          from: ws.clientId,
          data: data.data
        });
      }
    } catch (error) {
      console.error(
        "WebSocket message error:",
        error
      );

      send(ws, {
        type: "error",
        message:
          "WebSocketメッセージを処理できませんでした。"
      });
    }
  });

  ws.on("close", () => {
    removeFromRoom(ws);
  });

  ws.on("error", () => {
    removeFromRoom(ws);
  });
});

// RenderなどのPaaSではPORTが環境変数で渡されます。
const PORT = Number(process.env.PORT) || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Screen mirroring server listening on port ${PORT}`
  );
});

const { createServer } = require("node:http");
const { parse } = require("node:url");
const { randomUUID, scryptSync, timingSafeEqual } = require("node:crypto");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// ----- In-memory store -----
const rooms = new Map();
const sessions = new Map();
const socketToSession = new Map();

function hashPassword(password, salt) {
  const s = salt || randomUUID().replace(/-/g, "").slice(0, 16);
  const h = scryptSync(password, s, 64);
  return { salt: s, hash: h.toString("base64") };
}

function verifyPassword(password, salt, storedHash) {
  const h = scryptSync(password, salt, 64);
  try {
    return timingSafeEqual(Buffer.from(storedHash, "base64"), h);
  } catch {
    return false;
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (ch) => (data += ch));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.setHeader("Content-Type", "application/json");
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

async function handleCreate(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  try {
    const body = await readJsonBody(req);
    const { name, password, displayName } = body;
    const n = (name || "").trim();
    const d = (displayName || "").trim();
    const p = (password || "").trim();
    if (!n || !d || !p) {
      sendJson(res, 400, {
        error: "Missing room name, display name, or password",
      });
      return;
    }
    const roomId = randomUUID();
    const sessionId = randomUUID();
    const { salt, hash } = hashPassword(p);
    const room = {
      id: roomId,
      name: n,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: Date.now(),
      createdBy: d,
      participants: new Map(),
      messages: [],
    };
    const session = {
      id: sessionId,
      roomId,
      displayName: d,
      connectedAt: Date.now(),
    };
    room.participants.set(sessionId, {
      sessionId,
      displayName: d,
      joinedAt: Date.now(),
    });
    rooms.set(roomId, room);
    sessions.set(sessionId, session);
    sendJson(res, 200, {
      roomId,
      roomName: n,
      sessionId,
    });
  } catch (e) {
    sendJson(res, 500, { error: "Failed to create room" });
  }
}

async function handleJoin(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  try {
    const body = await readJsonBody(req);
    const { roomId, roomName, password, displayName } = body;
    const d = (displayName || "").trim();
    const p = (password || "").trim();
    if (!d || !p) {
      sendJson(res, 400, { error: "Missing display name or password" });
      return;
    }
    let room = null;
    if (roomId) {
      room = rooms.get(roomId);
    }
    if (!room && roomName) {
      const rn = (roomName || "").trim().toLowerCase();
      for (const r of rooms.values()) {
        if (r.name.trim().toLowerCase() === rn) {
          room = r;
          break;
        }
      }
    }
    if (!room) {
      sendJson(res, 404, { error: "Room not found" });
      return;
    }
    if (
      !verifyPassword(p, room.passwordSalt, room.passwordHash)
    ) {
      sendJson(res, 401, { error: "Invalid password" });
      return;
    }
    const sessionId = randomUUID();
    const session = {
      id: sessionId,
      roomId: room.id,
      displayName: d,
      connectedAt: Date.now(),
    };
    room.participants.set(sessionId, {
      sessionId,
      displayName: d,
      joinedAt: Date.now(),
    });
    sessions.set(sessionId, session);
    sendJson(res, 200, {
      roomId: room.id,
      roomName: room.name,
      sessionId,
    });
  } catch (e) {
    sendJson(res, 500, { error: "Failed to join room" });
  }
}

function clearRoomMessages(room) {
  room.messages.length = 0;
}

function removeParticipantAndClear(room, sessionId, io) {
  room.participants.delete(sessionId);
  sessions.delete(sessionId);
  clearRoomMessages(room);
  const roomChannel = `room:${room.id}`;
  io.to(roomChannel).emit("user-left", { sessionId });
  io.to(roomChannel).emit("messages-cleared");
  if (room.participants.size === 0) {
    rooms.delete(room.id);
  }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const path = parsedUrl.pathname || "";
    if (req.method === "POST" && path === "/api/rooms") {
      handleCreate(req, res);
      return;
    }
    if (req.method === "POST" && path === "/api/rooms/join") {
      handleJoin(req, res);
      return;
    }
    handler(req, res, parsedUrl);
  });

  const io = new Server(httpServer);

  io.on("connection", (socket) => {
    socket.on("join-room", (payload) => {
      const { roomId, sessionId } = payload || {};
      const room = roomId ? rooms.get(roomId) : null;
      const session = sessionId ? sessions.get(sessionId) : null;
      if (!room || !session || session.roomId !== roomId) {
        socket.emit("join-error", { error: "Invalid room or session" });
        return;
      }
      socket.join(`room:${roomId}`);
      socketToSession.set(socket.id, sessionId);
      const participant = room.participants.get(sessionId);
      if (participant) participant.socketId = socket.id;
      socket.roomId = roomId;
      socket.sessionId = sessionId;
      socket.emit("join-ok", {
        roomId,
        roomName: room.name,
        messages: room.messages.map((m) => ({
          ...m,
          sentAt: m.sentAt,
        })),
      });
    });

    socket.on("send-message", (payload) => {
      const { content } = payload || {};
      const room = socket.roomId ? rooms.get(socket.roomId) : null;
      const session = socket.sessionId ? sessions.get(socket.sessionId) : null;
      if (!room || !session || typeof content !== "string") return;
      const text = content.trim();
      if (!text) return;
      const msg = {
        id: randomUUID(),
        senderId: session.id,
        senderName: session.displayName,
        content: text,
        sentAt: Date.now(),
      };
      room.messages.push(msg);
      io.to(`room:${room.id}`).emit("message", msg);
    });

    socket.on("vaporize-history", () => {
      const room = socket.roomId ? rooms.get(socket.roomId) : null;
      if (!room) return;
      clearRoomMessages(room);
      io.to(`room:${room.id}`).emit("messages-cleared");
    });

    socket.on("exit-room", () => {
      const room = socket.roomId ? rooms.get(socket.roomId) : null;
      const sessionId = socket.sessionId;
      if (!room || !sessionId) return;
      removeParticipantAndClear(room, sessionId, io);
      socket.leave(`room:${room.id}`);
      socket.roomId = null;
      socket.sessionId = null;
      socketToSession.delete(socket.id);
      socket.emit("exit-ok");
    });

    socket.on("disconnect", () => {
      const sessionId = socketToSession.get(socket.id) || socket.sessionId;
      const roomId = socket.roomId;
      socketToSession.delete(socket.id);
      if (!roomId || !sessionId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      removeParticipantAndClear(room, sessionId, io);
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});

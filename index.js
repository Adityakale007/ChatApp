// index.js

require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const Redis = require("ioredis");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const Message = require("./models/message");
const authRoutes = require("./routes/auth");

const PORT = process.env.PORT || 8080;

/* ------------ MONGODB CONNECTION ------------ */
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

/* ------------ REDIS CONFIG ------------ */
const isDocker = process.env.NODE_ENV === "production";

const REDIS_URL =
  process.env.REDIS_URL ||
  (isDocker ? process.env.REDIS_DOCKER : process.env.REDIS_LOCAL) ||
  "redis://127.0.0.1:6379";

/* ------------ EXPRESS APP SETUP ------------ */
const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend (client.html etc.)
app.use(express.static("static"));

/* ------------ FILE UPLOAD CONFIG ------------ */
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Serve uploaded files
app.use("/files", express.static(uploadDir));

/* ------------ JWT HTTP MIDDLEWARE ------------ */
function httpAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }
  const token = auth.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, username }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* ------------ ROUTES ------------ */
app.use("/auth", authRoutes);

app.get("/health", (req, res) => res.json({ ok: true }));

/* ------------ HTTP SERVER + WEBSOCKET SERVER ------------ */
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

/* ------------ REDIS CLIENTS ------------ */
const pub = new Redis(REDIS_URL);
const sub = new Redis(REDIS_URL);
const cli = new Redis(REDIS_URL);

/* ------------ HELPERS ------------ */
const clients = new Map();
const subscribedRooms = new Set();

function redisRoomChannel(room) {
  return `room:${room}:channel`;
}

function redisRoomUsersKey(room) {
  return `room:${room}:users`;
}

async function ensureSubscribed(room) {
  const channel = redisRoomChannel(room);
  if (!subscribedRooms.has(channel)) {
    await sub.subscribe(channel);
    subscribedRooms.add(channel);
  }
}

async function addUserToRoom(room, username) {
  await cli.sadd(redisRoomUsersKey(room), username);
  const users = await cli.smembers(redisRoomUsersKey(room));

  await pub.publish(
    redisRoomChannel(room),
    JSON.stringify({
      type: "presence",
      action: "update",
      room,
      users
    })
  );
}

async function removeUserFromRoom(room, username) {
  await cli.srem(redisRoomUsersKey(room), username);
  const users = await cli.smembers(redisRoomUsersKey(room));

  await pub.publish(
    redisRoomChannel(room),
    JSON.stringify({
      type: "presence",
      action: "update",
      room,
      users
    })
  );
}

/* ------------ REDIS PUB/SUB BROADCAST ------------ */
sub.on("message", (channel, message) => {
  const msg = JSON.parse(message);
  const room = msg.room;

  for (const [ws, meta] of clients.entries()) {
    if (meta.room === room && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
});

/* ------------ WEBSOCKET CONNECTION ------------ */
wss.on("connection", async (ws, req) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    const token = url.searchParams.get("token");
    const room = url.searchParams.get("room") || "global";

    // =============== JWT AUTH =================
    if (!token) {
      ws.send(JSON.stringify({ type: "error", message: "Token missing" }));
      return ws.close();
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
      return ws.close();
    }

    const username = decoded.username;
    // ===========================================

    const id = uuidv4();
    clients.set(ws, { id, room, username });

    await ensureSubscribed(room);
    await addUserToRoom(room, username);

    const currentUsers = await cli.smembers(redisRoomUsersKey(room));

    ws.send(
      JSON.stringify({
        type: "system",
        subtype: "welcome",
        id,
        room,
        users: currentUsers,
        ts: Date.now()
      })
    );

    ws.on("message", async (data) => {
      try {
        const parsed = JSON.parse(data);

        // --- WebRTC signalling messages ---
        if (
          parsed.type === "webrtc-offer" ||
          parsed.type === "webrtc-answer" ||
          parsed.type === "webrtc-ice"
        ) {
          const signal = {
            ...parsed,
            room,
            from: username
          };
          await pub.publish(redisRoomChannel(room), JSON.stringify(signal));
          return;
        }

        // --- Chat text messages ---
        if (parsed.type === "message") {
          const chatMessage = {
            id: uuidv4(),
            type: "message",
            messageType: parsed.messageType || "text",
            room,
            user: username,
            text: parsed.text || "",
            ts: Date.now()
          };

          await Message.create({
            room,
            user: username,
            text: chatMessage.text,
            ts: chatMessage.ts,
            messageType: chatMessage.messageType
          });

          await pub.publish(redisRoomChannel(room), JSON.stringify(chatMessage));
        }

        if (parsed.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
        }
      } catch (err) {
        console.error("message error:", err);
      }
    });

    ws.on("close", async () => {
      clients.delete(ws);
      await removeUserFromRoom(room, username);
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
    });
  } catch (err) {
    console.error("WS connection error:", err);
  }
});

/* ------------ CHAT HISTORY API ------------ */
app.get("/history", async (req, res) => {
  try {
    const room = req.query.room;
    if (!room) return res.status(400).json({ error: "room required" });

    const messages = await Message.find({ room }).sort({ ts: 1 }).limit(100);

    res.json(messages);
  } catch (err) {
    console.error("history error:", err);
    res.status(500).json({ error: "server error" });
  }
});

/* ------------ FILE UPLOAD API ------------ */
app.post("/upload", httpAuth, upload.single("file"), async (req, res) => {
  try {
    const { room } = req.body;
    const username = req.user.username;
    const file = req.file;

    if (!room || !file) {
      return res.status(400).json({ error: "room and file are required" });
    }

    const chatMessage = {
      id: uuidv4(),
      type: "message",
      messageType: "file",
      room,
      user: username,
      text: "",
      fileUrl: `/files/${file.filename}`,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
      ts: Date.now()
    };

    await Message.create({
      room,
      user: username,
      text: "",
      ts: chatMessage.ts,
      messageType: "file",
      fileUrl: chatMessage.fileUrl,
      fileName: chatMessage.fileName,
      fileSize: chatMessage.fileSize,
      fileType: chatMessage.fileType
    });

    await pub.publish(redisRoomChannel(room), JSON.stringify(chatMessage));

    res.json(chatMessage);
  } catch (err) {
    console.error("upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* ------------ START SERVER ------------ */
server.listen(PORT, () => {
  console.log("Server running on", PORT);
  console.log("Using Redis:", REDIS_URL);
});

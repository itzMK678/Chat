import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import * as cookie from "cookie";
import jwt from "jsonwebtoken";
import "dotenv/config";
import path from "path";

// Routes
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import messageRoutes from "./routes/message.js";
import profileRoutes from "./routes/setting.js";

const app = express();

// Dynamically reflect request origin to support credentials (cookies) across localhost and LAN IPs
const corsOptions = {
  origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

// Serve uploaded voice messages
app.use("/uploads", express.static(path.resolve("uploads")));

// MongoDB connection
mongoose
  .connect(process.env.mongourl)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

// API routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/messages", messageRoutes);
app.use("/profile", profileRoutes);

// HTTP server and Socket.IO
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, true),
    credentials: true,
    methods: ["GET", "POST"],
  },
});

// Authenticate socket connections using HTTP-only cookie or auth token
io.use((socket, next) => {
  try {
    let token = null;

    // Check cookie in handshake headers
    const rawCookies = socket.handshake.headers.cookie;
    if (rawCookies) {
      const parsed = cookie.parse(rawCookies);
      token = parsed.token;
    }

    // Fallback to auth payload
    if (!token && socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
    }

    if (!token) {
      console.warn("Socket connection rejected: No authentication token found");
      return next(new Error("Authentication error: No token provided"));
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "default_jwt_secret_change_in_production"
    );

    socket.userId = String(decoded.id);
    next();
  } catch (err) {
    console.error("Socket authentication failed:", err.message);
    return next(new Error("Authentication error: Invalid token"));
  }
});

// Store online users: userId -> socketId
const onlineUsers = {};

io.on("connection", (socket) => {
  console.log(`User connected and authenticated: ${socket.userId} (${socket.id})`);

  // Automatically register verified user
  if (socket.userId) {
    onlineUsers[socket.userId] = socket.id;
    io.emit("getUsers", Object.keys(onlineUsers));
  }

  // Backward compatibility with client addUser event (no-op or re-affirm)
  socket.on("addUser", (userId) => {
    if (socket.userId) {
      onlineUsers[socket.userId] = socket.id;
      io.emit("getUsers", Object.keys(onlineUsers));
    }
  });

  // 1. Send messages in real time (Protected: sender is guaranteed to be socket.userId)
  socket.on("sendMessage", ({ receiverId, text, message }) => {
    if (!socket.userId || !receiverId) return;

    const receiverSocket = onlineUsers[String(receiverId)];

    if (receiverSocket) {
      io.to(receiverSocket).emit("getMessage", {
        senderId: socket.userId,
        text,
        message: message || undefined,
      });
    }
  });

  // 2. Initiate voice or video call
  socket.on("callUser", ({ receiverId, offer, callerName, callType }) => {
    if (!socket.userId || !receiverId || !offer) return;

    const receiverSocket = onlineUsers[String(receiverId)];

    if (!receiverSocket) {
      socket.emit("callUnavailable", {
        message: "This user is offline.",
      });
      return;
    }

    io.to(receiverSocket).emit("incomingCall", {
      callerId: socket.userId,
      callerName: callerName || "Unknown caller",
      offer,
      callType: callType === "video" ? "video" : "audio",
    });

    console.log(
      `${callType === "video" ? "Video" : "Voice"} call: ${socket.userId} -> ${receiverId}`
    );
  });

  // 3. Receiver accepts and sends WebRTC answer
  socket.on("acceptCall", ({ callerId, answer }) => {
    if (!socket.userId || !callerId || !answer) return;

    const callerSocket = onlineUsers[String(callerId)];

    if (callerSocket) {
      io.to(callerSocket).emit("callAccepted", {
        receiverId: socket.userId,
        answer,
      });
    }
  });

  // 4. Reject incoming call
  socket.on("rejectCall", ({ callerId }) => {
    if (!socket.userId || !callerId) return;

    const callerSocket = onlineUsers[String(callerId)];

    if (callerSocket) {
      io.to(callerSocket).emit("callRejected", {
        receiverId: socket.userId,
      });
    }
  });

  // 5. Exchange WebRTC ICE candidates
  socket.on("iceCandidate", ({ targetUserId, candidate }) => {
    if (!socket.userId || !targetUserId || !candidate) return;

    const targetSocket = onlineUsers[String(targetUserId)];

    if (targetSocket) {
      io.to(targetSocket).emit("iceCandidate", {
        senderId: socket.userId,
        candidate,
      });
    }
  });

  // 6. End call
  socket.on("endCall", ({ targetUserId }) => {
    if (!socket.userId || !targetUserId) return;

    const targetSocket = onlineUsers[String(targetUserId)];

    if (targetSocket) {
      io.to(targetSocket).emit("callEnded", {
        userId: socket.userId,
      });
    }
  });

  // 7. Disconnect and update online users
  socket.on("disconnect", () => {
    if (socket.userId && onlineUsers[socket.userId] === socket.id) {
      delete onlineUsers[socket.userId];
    }

    io.emit("getUsers", Object.keys(onlineUsers));
    console.log(`User disconnected: ${socket.userId || socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running securely on port ${PORT}`);
});

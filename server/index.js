
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import "dotenv/config";
import path from "path";

// Routes
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import messageRoutes from "./routes/message.js";
import profileRoutes from "./routes/setting.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve uploaded voice messages
app.use("/uploads", express.static(path.resolve("uploads")));

// MongoDB connection
mongoose
  .connect(process.env.mongourl)
  .then(() => console.log("MongoDB connected"))
  .catch((error) =>
    console.error("MongoDB connection error:", error)
  );

// API routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/messages", messageRoutes);
app.use("/profile", profileRoutes);

// HTTP server and Socket.IO
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Store online users as userId -> socketId
const onlineUsers = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Register user and track their socket
  socket.on("addUser", (userId) => {
    if (!userId) return;

    socket.userId = String(userId);
    onlineUsers[socket.userId] = socket.id;

    console.log("User registered:", socket.userId);

    io.emit("getUsers", Object.keys(onlineUsers));
  });

  // Deliver existing text messages in real time
  socket.on("sendMessage", ({ senderId, receiverId, text, message }) => {
  if (!senderId || !receiverId) return;

  const receiverSocket = onlineUsers[String(receiverId)];

  if (receiverSocket) {
    io.to(receiverSocket).emit("getMessage", {
      senderId,
      text,
      message: message || undefined,
    });
  }
});

  // 1. Caller sends a WebRTC offer
  socket.on("callUser", ({ receiverId, offer, callerName }) => {
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
    });
  });

  // 2. Receiver accepts and sends the WebRTC answer
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

  // 3. Receiver rejects the call
  socket.on("rejectCall", ({ callerId }) => {
    if (!socket.userId || !callerId) return;

    const callerSocket = onlineUsers[String(callerId)];

    if (callerSocket) {
      io.to(callerSocket).emit("callRejected", {
        receiverId: socket.userId,
      });
    }
  });

  // 4. Relay ICE candidates between the two participants
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

  // 5. Either participant ends the call
  socket.on("endCall", ({ targetUserId }) => {
    if (!socket.userId || !targetUserId) return;

    const targetSocket = onlineUsers[String(targetUserId)];

    if (targetSocket) {
      io.to(targetSocket).emit("callEnded", {
        userId: socket.userId,
      });
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    // Don't remove a newer connection belonging to the same user
    if (
      socket.userId &&
      onlineUsers[socket.userId] === socket.id
    ) {
      delete onlineUsers[socket.userId];
    }

    io.emit("getUsers", Object.keys(onlineUsers));

    console.log("User disconnected:", socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
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



//cookies
app.use(cookieParser());
// 2. Configure CORS with credentials
const ALLOWED_ORIGIN = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({
  origin: ALLOWED_ORIGIN,
  credentials: true // Allows cookies to be sent and received
}));
app.use(express.json({ limit: "10mb" }));
// Serve uploaded voice messages
app.use("/uploads", express.static(path.resolve("uploads")));

// MongoDB connection
mongoose
  .connect(process.env.mongourl)
  .then(() => console.log("MongoDB connected"))
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
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Store online users: userId -> socketId
const onlineUsers = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // 1. Register user
  socket.on("addUser", (userId) => {
    if (!userId) return;

    socket.userId = String(userId);
    onlineUsers[socket.userId] = socket.id;

    console.log("User registered:", socket.userId);

    io.emit("getUsers", Object.keys(onlineUsers));
  });

  // 2. Send messages in real time
  socket.on("sendMessage", ({ senderId, receiverId, text, message }) => {
    if (!senderId || !receiverId) return;

    const receiverSocket = onlineUsers[String(receiverId)];

    if (receiverSocket) {
      io.to(receiverSocket).emit("getMessage", {
        senderId: String(senderId),
        text,
        message: message || undefined,
      });
    }
  });

  // 3. Initiate voice or video call
  socket.on(
    "callUser",
    ({ receiverId, offer, callerName, callType }) => {
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
        `${callType === "video" ? "Video" : "Voice"} call:`,
        socket.userId,
        "->",
        receiverId
      );
    }
  );

  // 4. Receiver accepts and sends WebRTC answer
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

  // 5. Reject incoming call
  socket.on("rejectCall", ({ callerId }) => {
    if (!socket.userId || !callerId) return;

    const callerSocket = onlineUsers[String(callerId)];

    if (callerSocket) {
      io.to(callerSocket).emit("callRejected", {
        receiverId: socket.userId,
      });
    }
  });

  // 6. Exchange WebRTC ICE candidates
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

  // 7. End call
  socket.on("endCall", ({ targetUserId }) => {
    if (!socket.userId || !targetUserId) return;

    const targetSocket = onlineUsers[String(targetUserId)];

    if (targetSocket) {
      io.to(targetSocket).emit("callEnded", {
        userId: socket.userId,
      });
    }
  });

  // 8. Disconnect and update online users
  socket.on("disconnect", () => {
    // Avoid removing a newer socket for the same user
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

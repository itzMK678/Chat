
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import "dotenv/config";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import messageRoutes from "./routes/message.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// MongoDB connection
mongoose
  .connect(process.env.mongourl)
  .then(() => console.log("MongoDB connected"))
  .catch((error) => console.error("MongoDB connection error:", error));

// API routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/messages", messageRoutes);

// HTTP server and Socket.IO
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

let onlineUsers = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("addUser", (userId) => {
    onlineUsers[userId] = socket.id;
    io.emit("getUsers", Object.keys(onlineUsers));
  });

  socket.on("sendMessage", ({ senderId, receiverId, text }) => {
    const receiverSocket = onlineUsers[receiverId];

    if (receiverSocket) {
      io.to(receiverSocket).emit("getMessage", {
        senderId,
        text,
      });
    }
  });

  socket.on("disconnect", () => {
    onlineUsers = Object.fromEntries(
      Object.entries(onlineUsers).filter(
        ([key, value]) => value !== socket.id
      )
    );

    io.emit("getUsers", Object.keys(onlineUsers));
    console.log("User disconnected:", socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

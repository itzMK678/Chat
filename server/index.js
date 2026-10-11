const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
import "dotenv/config";
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

mongoose.connect(
 process.env.mongourl,
).then(() => console.log("MongoDB connected")).catch(console.log);

app.use("/auth", require("./routes/auth"));
app.use("/users", require("./routes/user"));
app.use("/messages", require("./routes/message"));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let onlineUsers = {};

io.on("connection", (socket) => {
    socket.on("addUser", (userId) => {
        onlineUsers[userId] = socket.id;
        io.emit("getUsers", Object.keys(onlineUsers));
    });

    socket.on("sendMessage", ({ senderId, receiverId, text }) => {
        const receiverSocket = onlineUsers[receiverId];
        if (receiverSocket) {
            io.to(receiverSocket).emit("getMessage", { senderId, text });
        }
    });

    socket.on("disconnect", () => {
        onlineUsers = Object.fromEntries(
            Object.entries(onlineUsers).filter(([key, value]) => value !== socket.id)
        );
        io.emit("getUsers", Object.keys(onlineUsers));
    });
});

server.listen(5000, () => console.log("Server running on port 5000"));

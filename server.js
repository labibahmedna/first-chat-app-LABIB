const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  transports: ["websocket", "polling"],
});

const PORT = process.env.PORT || 3000;

// Serve index.html from the same directory as server.js
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Track connected users: socketId -> username
const users = {};

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("user:join", (username) => {
    users[socket.id] = username;
    socket.broadcast.emit("system:message", {
      text: `${username} joined the room`,
      timestamp: Date.now(),
    });
    io.emit("users:update", Object.values(users));
  });

  socket.on("chat:message", (text) => {
    const username = users[socket.id] || "Anonymous";
    const message = {
      id: `${socket.id}-${Date.now()}`,
      username,
      text,
      timestamp: Date.now(),
    };
    io.emit("chat:message", message);
  });

  socket.on("chat:typing", (isTyping) => {
    const username = users[socket.id];
    if (username) {
      socket.broadcast.emit("chat:typing", { username, isTyping });
    }
  });

  socket.on("disconnect", () => {
    const username = users[socket.id];
    if (username) {
      delete users[socket.id];
      io.emit("system:message", {
        text: `${username} left the room`,
        timestamp: Date.now(),
      });
      io.emit("users:update", Object.values(users));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Chat server running on port ${PORT}`);
});

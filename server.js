// server.js — LiveChat with message deletion
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');   // npm install uuid

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.static('public'));

// In-memory state
const users    = new Map();  // socket.id → username
const messages = new Map();  // messageId → { id, username, text, timestamp }

io.on('connection', (socket) => {

  // ── JOIN ──────────────────────────────────────────────
  socket.on('user:join', (username) => {
    users.set(socket.id, username);
    io.emit('users:update', [...users.values()]);
    io.emit('system:message', {
      text: `${username} joined the chat`,
      timestamp: Date.now(),
    });
  });

  // ── CHAT MESSAGE ──────────────────────────────────────
  socket.on('chat:message', (text) => {
    const username = users.get(socket.id);
    if (!username) return;
    if (typeof text !== 'string' || !text.trim() || text.length > 2500) return;

    const msg = {
      id:        uuidv4(),          // ← unique message ID
      username,
      text:      text.trim(),
      timestamp: Date.now(),
    };

    messages.set(msg.id, msg);     // store for ownership checks
    io.emit('chat:message', msg);
  });

  // ── DELETE MESSAGE ────────────────────────────────────
  socket.on('chat:delete', (messageId) => {
    const username = users.get(socket.id);
    if (!username) return;

    const msg = messages.get(messageId);
    if (!msg) return;                         // message not found

    // SERVER-SIDE ownership check — prevents spoofed deletes
    if (msg.username !== username) return;

    // Soft-delete: mark as deleted but keep record
    msg.deleted = true;
    messages.set(messageId, msg);

    // Broadcast deletion to everyone
    io.emit('chat:deleted', { id: messageId });
  });

  // ── TYPING ────────────────────────────────────────────
  socket.on('chat:typing', (isTyping) => {
    const username = users.get(socket.id);
    if (!username) return;
    socket.broadcast.emit('chat:typing', { username, isTyping });
  });

  // ── DISCONNECT ────────────────────────────────────────
  socket.on('disconnect', () => {
    const username = users.get(socket.id);
    if (username) {
      users.delete(socket.id);
      io.emit('users:update', [...users.values()]);
      io.emit('system:message', {
        text: `${username} left the chat`,
        timestamp: Date.now(),
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`LiveChat running on http://localhost:${PORT}`));

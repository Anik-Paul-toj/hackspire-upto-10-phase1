const http = require('http');
const WebSocket = require('ws');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = new Map();
let nextId = 1;

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  return rooms.get(roomId);
}

function broadcastPeers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const ids = Array.from(room.keys());
  const msg = JSON.stringify({ type: 'peers', peers: ids });
  for (const ws of room.values()) {
    try { ws.send(msg); } catch {}
  }
}

wss.on('connection', (ws) => {
  let roomId = null;
  let clientId = String(nextId++);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'join') {
      roomId = String(msg.roomId || 'default');
      const room = getRoom(roomId);
      room.set(clientId, ws);
      ws.send(JSON.stringify({ type: 'hello', clientId }));
      broadcastPeers(roomId);
      return;
    }

    if (msg.type === 'signal' && roomId) {
      const { to, payload } = msg;
      const room = rooms.get(roomId);
      if (!room) return;
      const target = room.get(String(to));
      if (target && target.readyState === WebSocket.OPEN) {
        target.send(JSON.stringify({ type: 'signal', from: clientId, payload }));
      }
      return;
    }
  });

  ws.on('close', () => {
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.delete(clientId);
        if (room.size === 0) rooms.delete(roomId);
        else broadcastPeers(roomId);
      }
    }
  });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
server.listen(PORT, () => {
  console.log(`Signaling server listening on ws://localhost:${PORT}`);
});

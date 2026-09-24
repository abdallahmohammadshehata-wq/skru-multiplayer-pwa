import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './rooms/room_manager.js';
import { handleClientMessage } from './events/handler.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const server = http.createServer((req, res) => {
  // CORS & Health check
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'Skru Multiplayer Game Server',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: Date.now()
    }));
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });
const roomManager = new RoomManager();

wss.on('connection', (ws: WebSocket) => {
  const clientSession: { playerId?: string; roomCode?: string } = {};

  ws.on('message', (message: string) => {
    handleClientMessage(ws, message.toString(), roomManager, clientSession);
  });

  ws.on('close', () => {
    if (clientSession.roomCode && clientSession.playerId) {
      const room = roomManager.getRoom(clientSession.roomCode);
      if (room) {
        room.handleDisconnect(clientSession.playerId);
      }
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err);
  });
});

server.listen(PORT, () => {
  console.log(`[Skru Game Engine] WebSocket server running on port ${PORT}`);
});

export { server, wss, roomManager };

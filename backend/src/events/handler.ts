import { WebSocket } from 'ws';
import { RoomManager, Room } from '../rooms/room_manager.js';

export function handleClientMessage(
  ws: WebSocket, 
  rawMessage: string, 
  roomManager: RoomManager, 
  clientSession: { playerId?: string; roomCode?: string }
): void {
  try {
    const data = JSON.parse(rawMessage);
    const { event, payload } = data;

    switch (event) {
      case 'PING':
        ws.send(JSON.stringify({ event: 'PONG', timestamp: Date.now() }));
        break;

      case 'CREATE_ROOM': {
        const { playerId, name, avatar, options } = payload;
        const room = roomManager.createRoom(playerId, options);
        clientSession.playerId = playerId;
        clientSession.roomCode = room.code;
        room.addPlayer(playerId, name || 'Player', avatar || '🦊', ws);
        ws.send(JSON.stringify({
          event: 'ROOM_CREATED',
          payload: { roomCode: room.code, playerId }
        }));
        break;
      }

      case 'JOIN_ROOM': {
        const { roomCode, playerId, name, avatar, passcode, team } = payload;
        const room = roomManager.getRoom(roomCode);
        if (!room) {
          ws.send(JSON.stringify({ event: 'ERROR', payload: { message: 'Room not found.' } }));
          return;
        }

        if (room.options.passcode && room.options.passcode !== passcode) {
          ws.send(JSON.stringify({ event: 'ERROR', payload: { message: 'Incorrect room PIN.' } }));
          return;
        }

        clientSession.playerId = playerId;
        clientSession.roomCode = room.code;
        const res = room.addPlayer(playerId, name || 'Player', avatar || '🦁', ws, team);
        if (!res.success) {
          ws.send(JSON.stringify({ event: 'ERROR', payload: { message: res.message } }));
        }
        break;
      }

      case 'START_GAME': {
        const room = getRoomFromSession(clientSession, roomManager);
        if (!room) return;
        if (room.hostId !== clientSession.playerId) {
          ws.send(JSON.stringify({ event: 'ERROR', payload: { message: 'Only host can start the game.' } }));
          return;
        }
        const res = room.startGame();
        if (!res.success) {
          ws.send(JSON.stringify({ event: 'ERROR', payload: { message: res.message } }));
        }
        break;
      }

      case 'READY_TO_PLAY': {
        const room = getRoomFromSession(clientSession, roomManager);
        if (!room || !room.engine) return;
        room.engine.skipInitialPeek();
        break;
      }

      case 'DRAW_CARD': {
        const room = getRoomFromSession(clientSession, roomManager);
        if (!room || !room.engine) return;
        const { from } = payload; // 'DRAW_PILE' | 'DISCARD_PILE'
        const res = room.engine.drawCard(clientSession.playerId!, from);
        if (!res.success) {
          ws.send(JSON.stringify({ event: 'ACTION_REJECTED', payload: { message: res.message } }));
        }
        break;
      }

      case 'SWAP_CARD': {
        const room = getRoomFromSession(clientSession, roomManager);
        if (!room || !room.engine) return;
        const { handIndex } = payload;
        const res = room.engine.swapDrawnCard(clientSession.playerId!, handIndex);
        if (!res.success) {
          ws.send(JSON.stringify({ event: 'ACTION_REJECTED', payload: { message: res.message } }));
        }
        break;
      }

      case 'DISCARD_CARD': {
        const room = getRoomFromSession(clientSession, roomManager);
        if (!room || !room.engine) return;
        const { triggerAction } = payload;
        const res = room.engine.discardDrawnCard(clientSession.playerId!, triggerAction ?? true);
        if (!res.success) {
          ws.send(JSON.stringify({ event: 'ACTION_REJECTED', payload: { message: res.message } }));
        }
        break;
      }

      case 'EXECUTE_ACTION': {
        const room = getRoomFromSession(clientSession, roomManager);
        if (!room || !room.engine) return;
        const res = room.engine.executeAction(clientSession.playerId!, payload);
        if (res.success && res.peekData) {
          // Send private peek reveal exclusively to initiator
          room.sendTo(clientSession.playerId!, 'PEEK_REVEAL', {
            type: room.engine.state.pendingAction?.type,
            peekData: res.peekData,
            durationMs: 4000
          });
        } else if (!res.success) {
          ws.send(JSON.stringify({ event: 'ACTION_REJECTED', payload: { message: res.message } }));
        }
        break;
      }

      case 'DISMISS_PEEK': {
        const room = getRoomFromSession(clientSession, roomManager);
        if (!room || !room.engine) return;
        room.engine.completePeek();
        break;
      }

      case 'MATCH_SLAP': {
        const room = getRoomFromSession(clientSession, roomManager);
        if (!room || !room.engine) return;
        const { handIndex } = payload;
        const res = room.engine.matchSlap(clientSession.playerId!, handIndex);
        ws.send(JSON.stringify({
          event: 'MATCH_SLAP_RESULT',
          payload: { isMatch: res.isMatch, message: res.message }
        }));
        break;
      }

      case 'CALL_SKRU': {
        const room = getRoomFromSession(clientSession, roomManager);
        if (!room || !room.engine) return;
        const res = room.engine.callSkru(clientSession.playerId!);
        if (!res.success) {
          ws.send(JSON.stringify({ event: 'ACTION_REJECTED', payload: { message: res.message } }));
        }
        break;
      }

      case 'START_NEXT_ROUND': {
        const room = getRoomFromSession(clientSession, roomManager);
        if (!room || !room.engine) return;
        if (room.hostId !== clientSession.playerId) return;
        room.engine.startRound();
        break;
      }

      case 'CHAT_MESSAGE': {
        const room = getRoomFromSession(clientSession, roomManager);
        if (!room) return;
        const player = room.players.find(p => p.id === clientSession.playerId);
        room.broadcast('CHAT_BROADCAST', {
          senderId: clientSession.playerId,
          senderName: player?.name || 'Player',
          text: payload.text,
          timestamp: Date.now()
        });
        break;
      }

      case 'EMOJI_REACTION': {
        const room = getRoomFromSession(clientSession, roomManager);
        if (!room) return;
        const player = room.players.find(p => p.id === clientSession.playerId);
        room.broadcast('EMOJI_BROADCAST', {
          senderId: clientSession.playerId,
          senderName: player?.name || 'Player',
          emoji: payload.emoji,
          timestamp: Date.now()
        });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('WebSocket message parsing error:', err);
  }
}

function getRoomFromSession(
  session: { playerId?: string; roomCode?: string }, 
  manager: RoomManager
): Room | undefined {
  if (!session.roomCode) return undefined;
  return manager.getRoom(session.roomCode);
}

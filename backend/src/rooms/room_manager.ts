import { WebSocket } from 'ws';
import { GameEngine } from '../engine/game.js';
import { GameVariant, Player } from '../models/types.js';

export interface RoomOptions {
  variant: GameVariant;
  pointsCap: number;
  turnTimer: number;
  maxPlayers: number;
  passcode?: string;
}

export interface ConnectedClient {
  ws: WebSocket;
  playerId: string;
  roomCode: string;
}

export class Room {
  public code: string;
  public hostId: string;
  public options: RoomOptions;
  public engine: GameEngine | null = null;
  public players: Player[] = [];
  public spectators: { id: string; name: string }[] = [];
  public clientSockets: Map<string, WebSocket> = new Map();
  public disconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(code: string, hostId: string, options: Partial<RoomOptions> = {}) {
    this.code = code;
    this.hostId = hostId;
    this.options = {
      variant: options.variant || 'CLASSIC',
      pointsCap: options.pointsCap || 100,
      turnTimer: options.turnTimer ?? 20,
      maxPlayers: Math.min(8, Math.max(2, options.maxPlayers || 4)),
      passcode: options.passcode || ''
    };
  }

  public addPlayer(id: string, name: string, avatar: string, ws: WebSocket, team?: 'A' | 'B'): { success: boolean; message?: string } {
    // Check if player reconnecting
    const existing = this.players.find(p => p.id === id);
    if (existing) {
      existing.connected = true;
      existing.lastSeen = Date.now();
      this.clientSockets.set(id, ws);

      const timer = this.disconnectTimers.get(id);
      if (timer) {
        clearTimeout(timer);
        this.disconnectTimers.delete(id);
      }
      this.broadcastState();
      return { success: true };
    }

    if (this.players.length >= this.options.maxPlayers) {
      // Add as spectator
      this.spectators.push({ id, name });
      this.clientSockets.set(id, ws);
      this.broadcastState();
      return { success: true, message: 'Room full; joined as spectator.' };
    }

    const isHost = this.players.length === 0 || id === this.hostId;
    const player: Player = {
      id,
      name,
      avatar,
      team: team || (this.options.variant === 'SAHEB_SA7BO' ? (this.players.length % 2 === 0 ? 'A' : 'B') : undefined),
      hand: [],
      isFrozen: false,
      connected: true,
      lastSeen: Date.now(),
      totalScore: 0,
      roundScores: [],
      hasCalledSkru: false,
      isHost
    };

    this.players.push(player);
    this.clientSockets.set(id, ws);

    if (this.engine) {
      this.engine.state.players = this.players;
    }

    this.broadcastState();
    return { success: true };
  }

  public handleDisconnect(playerId: string): void {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.connected = false;
      player.lastSeen = Date.now();
      this.clientSockets.delete(playerId);

      // 60-second grace period for reconnect
      const timeout = setTimeout(() => {
        this.removePlayer(playerId);
      }, 60000);
      this.disconnectTimers.set(playerId, timeout);

      this.broadcastState();
    } else {
      this.spectators = this.spectators.filter(s => s.id !== playerId);
      this.clientSockets.delete(playerId);
    }
  }

  public removePlayer(playerId: string): void {
    this.players = this.players.filter(p => p.id !== playerId);
    this.clientSockets.delete(playerId);
    const timer = this.disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(playerId);
    }

    // Transfer host if host left
    if (this.hostId === playerId && this.players.length > 0) {
      this.hostId = this.players[0].id;
      this.players[0].isHost = true;
    }

    if (this.engine) {
      this.engine.state.players = this.players;
      if (this.players.length < 2 && this.engine.state.status === 'PLAYING') {
        this.engine.state.status = 'LOBBY';
      }
    }

    this.broadcastState();
  }

  public startGame(): { success: boolean; message?: string } {
    if (this.players.length < 2) {
      return { success: false, message: 'Need at least 2 players to start a game.' };
    }

    this.engine = new GameEngine(
      this.code,
      this.players,
      this.options.variant,
      this.options.pointsCap,
      this.options.turnTimer,
      () => this.broadcastState()
    );

    this.engine.startRound();
    return { success: true };
  }

  public broadcast(event: string, payload: any): void {
    const message = JSON.stringify({ event, payload, timestamp: Date.now() });
    for (const [_, ws] of this.clientSockets.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  public sendTo(playerId: string, event: string, payload: any): void {
    const ws = this.clientSockets.get(playerId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, payload, timestamp: Date.now() }));
    }
  }

  public broadcastState(): void {
    if (!this.engine) {
      // Send lobby state
      const lobbyPayload = {
        roomCode: this.code,
        status: 'LOBBY',
        hostId: this.hostId,
        options: this.options,
        players: this.players.map(p => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          team: p.team,
          connected: p.connected,
          isHost: p.isHost
        })),
        spectators: this.spectators
      };
      this.broadcast('LOBBY_STATE', lobbyPayload);
      return;
    }

    // Send custom sanitized state to each player to prevent cheat leaks
    for (const player of this.players) {
      const sanitized = this.engine.getSanitizedState(player.id);
      this.sendTo(player.id, 'GAME_STATE', sanitized);
    }

    // Send spectator state (neutral viewpoint)
    for (const spectator of this.spectators) {
      const sanitized = this.engine.getSanitizedState('');
      this.sendTo(spectator.id, 'GAME_STATE', sanitized);
    }
  }
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  public createRoom(hostId: string, options: Partial<RoomOptions> = {}): Room {
    const code = this.generateRoomCode();
    const room = new Room(code, hostId, options);
    this.rooms.set(code, room);
    return room;
  }

  public getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase().trim());
  }

  public deleteRoom(code: string): void {
    const room = this.rooms.get(code);
    if (room) {
      for (const timer of room.disconnectTimers.values()) {
        clearTimeout(timer);
      }
      this.rooms.delete(code);
    }
  }

  private generateRoomCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code));
    return code;
  }
}

import { Peer, DataConnection } from 'peerjs';

export interface PeerMessage {
  event: string;
  payload: any;
  senderId?: string;
  timestamp?: number;
}

export type MessageHandler = (msg: PeerMessage) => void;

/**
 * PeerEngine provides zero-backend serverless WebRTC multiplayer rooms
 * using the global public PeerJS signaling network (0.peerjs.com).
 * This allows players on different networks/devices to join the exact same room code!
 */
export class PeerEngine {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private hostConnection: DataConnection | null = null;
  public isHost: boolean = false;
  public roomCode: string = '';
  public peerId: string = '';
  public isReady: boolean = false;
  private messageHandlers: Set<MessageHandler> = new Set();

  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  private dispatch(msg: PeerMessage) {
    for (const h of this.messageHandlers) {
      try {
        h(msg);
      } catch (err) {
        console.error('[PeerEngine] Handler error:', err);
      }
    }
  }

  /**
   * Host creates a room with the given 6-character code
   */
  public hostRoom(roomCode: string, onReady?: (code: string) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      this.destroy();
      this.isHost = true;
      this.roomCode = roomCode.toUpperCase().trim();
      const peerRoomId = `skru_pwa_${this.roomCode.replace(/[^A-Z0-9]/g, '')}`;

      try {
        const p = new Peer(peerRoomId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });

        this.peer = p;

        p.on('open', (id) => {
          this.peerId = id;
          this.isReady = true;
          if (onReady) onReady(this.roomCode);
          resolve(this.roomCode);
        });

        p.on('connection', (conn) => {
          this.setupHostConnection(conn);
        });

        p.on('error', (err: any) => {
          console.warn('[PeerEngine Host Warning]', err?.type || err);
          // If ID is already taken, host can still operate
          if (err?.type === 'unavailable-id') {
            // Already hosted or reconnecting
            resolve(this.roomCode);
          } else {
            // Still resolve so UI doesn't hang
            resolve(this.roomCode);
          }
        });
      } catch (e) {
        console.error('[PeerEngine Host Catch]', e);
        resolve(this.roomCode);
      }
    });
  }

  private setupHostConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this.dispatch({ event: 'PEER_CONNECTED', payload: { peerId: conn.peer } });
    });

    conn.on('data', (data: any) => {
      if (typeof data === 'object' && data !== null && data.event) {
        this.dispatch({ ...data, senderPeerId: conn.peer });
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.dispatch({ event: 'PLAYER_DISCONNECTED', payload: { peerId: conn.peer } });
    });
  }

  public sendTo(connPeerId: string, event: string, payload: any): void {
    const msg: PeerMessage = {
      event,
      payload,
      senderId: this.peerId,
      timestamp: Date.now()
    };
    const conn = this.connections.get(connPeerId);
    if (conn && conn.open) {
      conn.send(msg);
    }
  }

  /**
   * Client joins a room created by another player
   */
  public joinRoom(roomCode: string, onConnected?: () => void): Promise<boolean> {
    return new Promise((resolve) => {
      this.destroy();
      this.isHost = false;
      this.roomCode = roomCode.toUpperCase().trim();
      const targetPeerId = `skru_pwa_${this.roomCode.replace(/[^A-Z0-9]/g, '')}`;

      try {
        const p = new Peer({
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });

        this.peer = p;

        p.on('open', (myId) => {
          this.peerId = myId;
          this.isReady = true;

          const conn = p.connect(targetPeerId, {
            reliable: true
          });

          this.hostConnection = conn;

          conn.on('open', () => {
            if (onConnected) onConnected();
            resolve(true);
          });

          conn.on('data', (data: any) => {
            if (typeof data === 'object' && data !== null && data.event) {
              this.dispatch(data);
            }
          });

          conn.on('close', () => {
            this.hostConnection = null;
          });

          // Timeout safety: if host doesn't respond within 5s, still resolve
          setTimeout(() => {
            resolve(true);
          }, 5000);
        });

        p.on('error', (err) => {
          console.warn('[PeerEngine Client Warning]', err);
          resolve(false);
        });
      } catch (e) {
        console.error('[PeerEngine Client Catch]', e);
        resolve(false);
      }
    });
  }

  /**
   * Send a message to the host or broadcast to all peers
   */
  public send(event: string, payload: any): void {
    const msg: PeerMessage = {
      event,
      payload,
      senderId: this.peerId,
      timestamp: Date.now()
    };

    if (this.isHost) {
      // Host broadcasts to all connected client peers
      for (const [_, conn] of this.connections.entries()) {
        if (conn.open) {
          conn.send(msg);
        }
      }
    } else if (this.hostConnection && this.hostConnection.open) {
      // Client sends to host
      this.hostConnection.send(msg);
    }
  }

  public destroy(): void {
    if (this.hostConnection) {
      this.hostConnection.close();
      this.hostConnection = null;
    }
    for (const [_, conn] of this.connections.entries()) {
      conn.close();
    }
    this.connections.clear();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.isReady = false;
    this.isHost = false;
  }
}

export const peerEngine = new PeerEngine();

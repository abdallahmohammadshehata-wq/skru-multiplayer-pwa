/**
 * NetworkEngine – High-Availability Dual-Transport Multiplayer Rooms.
 *
 * Combines Public WSS MQTT pub/sub brokers and PeerJS WebRTC DataChannels
 * into a single unified hybrid network engine with MQTT state retention.
 */

import { Peer, DataConnection } from 'peerjs';

export interface NetworkMessage {
  id?: string;
  event: string;
  payload: any;
  senderId?: string;
  timestamp?: number;
}

export type NetworkMessageHandler = (msg: NetworkMessage) => void;

export function normalizeRoomCode(code: string): string {
  let clean = (code || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
  if (clean.startsWith('SKRU') && clean.length > 4) {
    clean = clean.replace(/^SKRU/, '');
  }
  return clean;
}

// ---------- MQTT Loader with local vendor & CDN fallbacks ----------

let _mqttLib: any = null;
let _mqttLoading: Promise<any> | null = null;

export function loadMqtt(): Promise<any> {
  if (_mqttLib) return Promise.resolve(_mqttLib);
  if (typeof window !== 'undefined' && (window as any).mqtt) {
    _mqttLib = (window as any).mqtt;
    return Promise.resolve(_mqttLib);
  }
  if (_mqttLoading) return _mqttLoading;

  _mqttLoading = new Promise<any>((resolve, reject) => {
    const sources = [
      './vendor/mqtt.min.js',
      'https://cdn.jsdelivr.net/npm/mqtt@5.10.4/dist/mqtt.min.js',
      'https://unpkg.com/mqtt@5.10.4/dist/mqtt.min.js'
    ];

    let currentSourceIdx = 0;

    function tryLoadNext() {
      if (typeof window !== 'undefined' && (window as any).mqtt) {
        _mqttLib = (window as any).mqtt;
        resolve(_mqttLib);
        return;
      }

      if (currentSourceIdx >= sources.length) {
        reject(new Error('All MQTT library sources failed to load'));
        return;
      }

      const src = sources[currentSourceIdx++];
      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';

      script.onload = () => {
        if ((window as any).mqtt) {
          _mqttLib = (window as any).mqtt;
          resolve(_mqttLib);
        } else {
          tryLoadNext();
        }
      };

      script.onerror = () => {
        tryLoadNext();
      };

      document.head.appendChild(script);
    }

    tryLoadNext();
  });

  return _mqttLoading;
}

// ---------- Public MQTT Brokers ----------

const BROKER_SERVERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081'
];

// ---------- Debug Status ----------

export type ConnectionStatus =
  | 'IDLE'
  | 'LOADING_LIB'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'SUBSCRIBING'
  | 'READY'
  | 'ERROR'
  | 'DISCONNECTED';

export interface DebugInfo {
  status: ConnectionStatus;
  broker: string;
  topic: string;
  clientId: string;
  transport: 'MQTT' | 'WEBRTC' | 'HYBRID' | 'NONE';
  error?: string;
  messagesSent: number;
  messagesReceived: number;
}

// ---------- NetworkEngine Class ----------

export class NetworkEngine {
  private mqttClient: any = null;
  private peer: Peer | null = null;
  private peerConnections: Map<string, DataConnection> = new Map();
  private hostPeerConnection: DataConnection | null = null;

  public isHost: boolean = false;
  public roomCode: string = '';
  public clientId: string = '';
  public isConnected: boolean = false;
  private currentTopic: string = '';
  private messageHandlers: Set<NetworkMessageHandler> = new Set();
  private heartbeatTimer: any = null;
  private joinRetryTimer: any = null;
  private processedMessageIds: Set<string> = new Set();

  private _debugStatus: ConnectionStatus = 'IDLE';
  private _debugBroker: string = '';
  private _debugError: string = '';
  private _activeTransport: 'MQTT' | 'WEBRTC' | 'HYBRID' | 'NONE' = 'NONE';
  private _msgSent: number = 0;
  private _msgRecv: number = 0;
  private _statusListeners: Set<() => void> = new Set();

  constructor() {
    this.clientId = 'skru_' + Math.random().toString(36).substring(2, 10);
  }

  public onStatusChange(fn: () => void): () => void {
    this._statusListeners.add(fn);
    return () => this._statusListeners.delete(fn);
  }

  private setDebugStatus(
    status: ConnectionStatus,
    broker?: string,
    error?: string,
    transport?: 'MQTT' | 'WEBRTC' | 'HYBRID' | 'NONE'
  ) {
    this._debugStatus = status;
    if (broker !== undefined) this._debugBroker = broker;
    if (error !== undefined) this._debugError = error;
    if (transport !== undefined) this._activeTransport = transport;
    for (const fn of this._statusListeners) {
      try { fn(); } catch (_) {}
    }
  }

  public getDebugInfo(): DebugInfo {
    return {
      status: this._debugStatus,
      broker: this._debugBroker,
      topic: this.currentTopic,
      clientId: this.clientId,
      transport: this._activeTransport,
      error: this._debugError,
      messagesSent: this._msgSent,
      messagesReceived: this._msgRecv,
    };
  }

  public onMessage(handler: NetworkMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  private dispatch(msg: NetworkMessage) {
    // Deduplication check
    const msgKey = msg.id || `${msg.timestamp || 0}_${msg.senderId || ''}_${msg.event}`;
    if (this.processedMessageIds.has(msgKey)) return;
    this.processedMessageIds.add(msgKey);
    if (this.processedMessageIds.size > 200) {
      const first = this.processedMessageIds.values().next().value;
      if (first) this.processedMessageIds.delete(first);
    }

    this._msgRecv++;
    for (const h of this.messageHandlers) {
      try {
        h(msg);
      } catch (err) {
        console.error('[NetworkEngine] Handler error:', err);
      }
    }
    this.setDebugStatus(this._debugStatus);
  }

  public getTopic(roomCode: string): string {
    const clean = normalizeRoomCode(roomCode);
    return `skru/egypt_v3/${clean}`;
  }

  // ---------- MQTT Connection Flow ----------

  private async connectMqtt(brokerIndex: number = 0): Promise<any> {
    let mqttLib: any;
    try {
      mqttLib = await loadMqtt();
    } catch (e: any) {
      console.warn('[NetworkEngine] MQTT lib load failed:', e);
      return null;
    }

    return new Promise((resolve) => {
      if (this.mqttClient && this.mqttClient.connected) {
        resolve(this.mqttClient);
        return;
      }

      const brokerUrl = BROKER_SERVERS[brokerIndex % BROKER_SERVERS.length];

      try {
        const client = mqttLib.connect(brokerUrl, {
          clientId: this.clientId,
          clean: true,
          connectTimeout: 4000,
          reconnectPeriod: 2500,
          keepalive: 30
        });

        let isDone = false;

        const timeout = setTimeout(() => {
          if (!client.connected && !isDone) {
            isDone = true;
            try { client.end(true); } catch (_) {}
            if (brokerIndex + 1 < BROKER_SERVERS.length) {
              this.connectMqtt(brokerIndex + 1).then(resolve);
            } else {
              resolve(null);
            }
          }
        }, 4500);

        client.on('connect', () => {
          clearTimeout(timeout);
          isDone = true;
          this.isConnected = true;
          this.mqttClient = client;
          this._activeTransport = this.peer ? 'HYBRID' : 'MQTT';
          this.setDebugStatus('CONNECTED', brokerUrl);

          if (this.currentTopic) {
            client.subscribe(this.currentTopic, { qos: 1 }, (err: any) => {
              if (!err) {
                this.setDebugStatus('READY');
              }
            });
          }
          resolve(client);
        });

        client.on('message', (_topic: string, message: any) => {
          try {
            let str: string;
            if (typeof message === 'string') {
              str = message;
            } else if (message instanceof Uint8Array || message instanceof ArrayBuffer) {
              str = new TextDecoder('utf-8').decode(message);
            } else if (message && message.toString) {
              str = message.toString();
            } else {
              return;
            }
            if (!str) return;
            const data: NetworkMessage = JSON.parse(str);
            if (data.senderId === this.clientId) return;
            this.dispatch(data);
          } catch (e) {
            console.error('[NetworkEngine] Error parsing MQTT msg:', e);
          }
        });

        client.on('error', (err: any) => {
          console.warn('[NetworkEngine] MQTT error:', err?.message || err);
        });

        client.on('close', () => {
          if (!this.peerConnections.size && !this.hostPeerConnection) {
            this.isConnected = false;
            this.setDebugStatus('DISCONNECTED', brokerUrl);
          }
        });

        client.on('reconnect', () => {
          this.setDebugStatus('CONNECTING', brokerUrl);
        });

      } catch (err) {
        resolve(null);
      }
    });
  }

  // ---------- WebRTC PeerJS Connection Flow ----------

  private initHostPeer(roomCode: string): Promise<Peer | null> {
    return new Promise((resolve) => {
      try {
        const peerRoomId = `skru_pwa_${normalizeRoomCode(roomCode)}`;
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

        p.on('open', () => {
          this.isConnected = true;
          this._activeTransport = this.mqttClient?.connected ? 'HYBRID' : 'WEBRTC';
          this.setDebugStatus('READY');
          resolve(p);
        });

        p.on('connection', (conn) => {
          this.setupPeerHostConnection(conn);
        });

        p.on('error', () => {
          resolve(p);
        });

        setTimeout(() => resolve(p), 3500);
      } catch (e) {
        resolve(null);
      }
    });
  }

  private setupPeerHostConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.peerConnections.set(conn.peer, conn);
      this._activeTransport = 'HYBRID';
    });

    conn.on('data', (data: any) => {
      if (typeof data === 'object' && data !== null && data.event) {
        if (data.senderId === this.clientId) return;
        this.dispatch(data);
      }
    });

    conn.on('close', () => {
      this.peerConnections.delete(conn.peer);
    });
  }

  private connectClientPeer(roomCode: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const targetPeerId = `skru_pwa_${normalizeRoomCode(roomCode)}`;
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

        p.on('open', () => {
          const conn = p.connect(targetPeerId, { reliable: true });
          this.hostPeerConnection = conn;

          conn.on('open', () => {
            this.isConnected = true;
            this._activeTransport = this.mqttClient?.connected ? 'HYBRID' : 'WEBRTC';
            this.setDebugStatus('READY');
            resolve(true);
          });

          conn.on('data', (data: any) => {
            if (typeof data === 'object' && data !== null && data.event) {
              if (data.senderId === this.clientId) return;
              this.dispatch(data);
            }
          });

          conn.on('close', () => {
            this.hostPeerConnection = null;
          });

          setTimeout(() => resolve(false), 3500);
        });

        p.on('error', () => {
          resolve(false);
        });

        setTimeout(() => resolve(false), 4000);
      } catch (e) {
        resolve(false);
      }
    });
  }

  // ---------- Public Room Lifecycle ----------

  /**
   * Host creates a room with Dual Hybrid Transport (MQTT + WebRTC).
   */
  public async hostRoom(roomCode: string): Promise<string> {
    this.destroy();
    this.isHost = true;
    this.roomCode = normalizeRoomCode(roomCode);
    this.currentTopic = this.getTopic(this.roomCode);

    this.setDebugStatus('CONNECTING');

    // Launch both MQTT and PeerJS concurrently without blocking
    this.connectMqtt(0).then((client) => {
      if (client) {
        client.subscribe(this.currentTopic, { qos: 1 }, (err: any) => {
          if (!err) {
            this.setDebugStatus('READY');
          }
        });
      }
    });

    this.initHostPeer(this.roomCode);

    // Heartbeat broadcast every 2.5s
    this.heartbeatTimer = setInterval(() => {
      this.send('ROOM_HEARTBEAT', {
        roomCode: this.roomCode,
        hostClientId: this.clientId
      });
    }, 2500);

    return this.roomCode;
  }

  /**
   * Client joins a room with Dual Hybrid Transport (MQTT + WebRTC).
   */
  public async joinRoom(
    roomCode: string,
    playerInfo: any,
    onSuccess?: () => void,
    onFailed?: (reason: string) => void
  ): Promise<boolean> {
    this.destroy();
    this.isHost = false;
    this.roomCode = normalizeRoomCode(roomCode);
    this.currentTopic = this.getTopic(this.roomCode);

    this.setDebugStatus('CONNECTING');

    let responseReceived = false;

    const unsubscribe = this.onMessage((msg) => {
      if (
        msg.event === 'LOBBY_STATE' ||
        msg.event === 'GAME_STATE' ||
        msg.event === 'ROOM_HEARTBEAT' ||
        msg.event === 'JOIN_ACK'
      ) {
        if (!responseReceived) {
          responseReceived = true;
          if (this.joinRetryTimer) clearInterval(this.joinRetryTimer);
          unsubscribe();
          this.setDebugStatus('READY');
          if (onSuccess) onSuccess();
        }
      }
    });

    // Launch both MQTT and WebRTC connect concurrently
    this.connectMqtt(0).then((client) => {
      if (client) {
        client.subscribe(this.currentTopic, { qos: 1 }, (err: any) => {
          if (!err) {
            this.send('JOIN_ROOM', {
              ...playerInfo,
              roomCode: this.roomCode,
              clientSenderId: this.clientId
            });
          }
        });
      }
    });

    this.connectClientPeer(this.roomCode).then((connected) => {
      if (connected) {
        this.send('JOIN_ROOM', {
          ...playerInfo,
          roomCode: this.roomCode,
          clientSenderId: this.clientId
        });
      }
    });

    // Retry loop up to 8 attempts (~10 seconds)
    let attempts = 0;
    this.joinRetryTimer = setInterval(() => {
      attempts++;
      if (responseReceived) {
        clearInterval(this.joinRetryTimer);
        return;
      }
      if (attempts >= 8) {
        clearInterval(this.joinRetryTimer);
        unsubscribe();
        if (onFailed) onFailed('HOST_NOT_FOUND');
      } else {
        this.send('JOIN_ROOM', {
          ...playerInfo,
          roomCode: this.roomCode,
          clientSenderId: this.clientId
        });
      }
    }, 1200);

    return true;
  }

  /**
   * Publish a message to all connected peers over both MQTT and WebRTC DataChannels.
   * Uses retain: true for LOBBY_STATE on MQTT so joiners get it in 0ms!
   */
  public send(event: string, payload: any): void {
    const msg: NetworkMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      event,
      payload,
      senderId: this.clientId,
      timestamp: Date.now()
    };

    let sent = false;

    // 1. Send via MQTT if connected
    if (this.mqttClient && this.mqttClient.connected && this.currentTopic) {
      try {
        const isRetained = event === 'LOBBY_STATE';
        this.mqttClient.publish(this.currentTopic, JSON.stringify(msg), { qos: 1, retain: isRetained });
        sent = true;
      } catch (_) {}
    }

    // 2. Send via WebRTC PeerJS
    if (this.isHost) {
      for (const [_, conn] of this.peerConnections.entries()) {
        if (conn.open) {
          try {
            conn.send(msg);
            sent = true;
          } catch (_) {}
        }
      }
    } else if (this.hostPeerConnection && this.hostPeerConnection.open) {
      try {
        this.hostPeerConnection.send(msg);
        sent = true;
      } catch (_) {}
    }

    if (sent) {
      this._msgSent++;
    }
  }

  public destroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.joinRetryTimer) {
      clearInterval(this.joinRetryTimer);
      this.joinRetryTimer = null;
    }
    if (this.mqttClient) {
      try {
        if (this.isHost && this.currentTopic) {
          this.mqttClient.publish(this.currentTopic, '', { qos: 1, retain: true });
        }
        if (this.currentTopic) this.mqttClient.unsubscribe(this.currentTopic);
        this.mqttClient.end(true);
      } catch (_) {}
      this.mqttClient = null;
    }
    if (this.hostPeerConnection) {
      try { this.hostPeerConnection.close(); } catch (_) {}
      this.hostPeerConnection = null;
    }
    for (const [_, conn] of this.peerConnections.entries()) {
      try { conn.close(); } catch (_) {}
    }
    this.peerConnections.clear();
    if (this.peer) {
      try { this.peer.destroy(); } catch (_) {}
      this.peer = null;
    }
    this.isConnected = false;
    this.isHost = false;
    this.currentTopic = '';
    this._activeTransport = 'NONE';
    this.setDebugStatus('IDLE');
  }
}

export const networkEngine = new NetworkEngine();

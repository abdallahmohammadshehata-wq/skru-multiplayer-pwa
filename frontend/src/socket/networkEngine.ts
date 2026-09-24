/**
 * NetworkEngine – Zero-config multiplayer rooms via public WSS MQTT brokers.
 *
 * Uses the mqtt.js **pre-built browser bundle** loaded from CDN so that
 * Buffer / process polyfills are included automatically.  The npm `mqtt`
 * package's ESM browser build still references Node globals that Vite
 * doesn't polyfill, which silently breaks WebSocket connections at runtime.
 */

export interface NetworkMessage {
  event: string;
  payload: any;
  senderId?: string;
  timestamp?: number;
}

export type NetworkMessageHandler = (msg: NetworkMessage) => void;

// ---------- CDN MQTT loader ----------

let _mqttLib: any = null;
let _mqttLoading: Promise<any> | null = null;

/**
 * Dynamically load the mqtt.js browser bundle from CDN.
 * Returns the global `mqtt` object (same API as `import mqtt from 'mqtt'`).
 */
function loadMqtt(): Promise<any> {
  if (_mqttLib) return Promise.resolve(_mqttLib);
  if (_mqttLoading) return _mqttLoading;

  _mqttLoading = new Promise<any>((resolve, reject) => {
    // Already loaded by another path?
    if ((window as any).mqtt) {
      _mqttLib = (window as any).mqtt;
      resolve(_mqttLib);
      return;
    }

    const script = document.createElement('script');
    // Use jsDelivr CDN – pre-built browser bundle with all polyfills
    script.src = 'https://cdn.jsdelivr.net/npm/mqtt@5.10.4/dist/mqtt.min.js';
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      _mqttLib = (window as any).mqtt;
      if (_mqttLib) {
        console.log('[NetworkEngine] ✅ mqtt.js loaded from CDN');
        resolve(_mqttLib);
      } else {
        reject(new Error('mqtt global not found after CDN load'));
      }
    };

    script.onerror = () => {
      console.warn('[NetworkEngine] CDN load failed, trying fallback CDN...');
      // Fallback to unpkg
      const fallback = document.createElement('script');
      fallback.src = 'https://unpkg.com/mqtt@5.10.4/dist/mqtt.min.js';
      fallback.crossOrigin = 'anonymous';
      fallback.onload = () => {
        _mqttLib = (window as any).mqtt;
        if (_mqttLib) {
          console.log('[NetworkEngine] ✅ mqtt.js loaded from fallback CDN');
          resolve(_mqttLib);
        } else {
          reject(new Error('mqtt global not found after fallback CDN load'));
        }
      };
      fallback.onerror = () => reject(new Error('All MQTT CDN sources failed'));
      document.head.appendChild(fallback);
    };

    document.head.appendChild(script);
  });

  return _mqttLoading;
}

// ---------- Broker config ----------

const BROKER_SERVERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt'
];

// ---------- Debug status (visible in UI) ----------

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
  error?: string;
  messagesSent: number;
  messagesReceived: number;
}

// ---------- NetworkEngine ----------

export class NetworkEngine {
  private client: any = null;
  public isHost: boolean = false;
  public roomCode: string = '';
  public clientId: string = '';
  public isConnected: boolean = false;
  private currentTopic: string = '';
  private messageHandlers: Set<NetworkMessageHandler> = new Set();
  private heartbeatTimer: any = null;
  private joinRetryTimer: any = null;
  private _debugStatus: ConnectionStatus = 'IDLE';
  private _debugBroker: string = '';
  private _debugError: string = '';
  private _msgSent: number = 0;
  private _msgRecv: number = 0;
  private _statusListeners: Set<() => void> = new Set();

  constructor() {
    this.clientId = 'skru_' + Math.random().toString(36).substring(2, 10);
  }

  /** Subscribe to debug status changes (for UI display). */
  public onStatusChange(fn: () => void): () => void {
    this._statusListeners.add(fn);
    return () => this._statusListeners.delete(fn);
  }

  private setDebugStatus(status: ConnectionStatus, broker?: string, error?: string) {
    this._debugStatus = status;
    if (broker !== undefined) this._debugBroker = broker;
    if (error !== undefined) this._debugError = error;
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
    this._msgRecv++;
    for (const h of this.messageHandlers) {
      try {
        h(msg);
      } catch (err) {
        console.error('[NetworkEngine] Handler error:', err);
      }
    }
    this.setDebugStatus(this._debugStatus); // trigger UI refresh for counter
  }

  private getTopic(roomCode: string): string {
    const clean = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `skru/egypt_v3/${clean}`;
  }

  /**
   * Connect to an MQTT broker with automatic fallback.
   */
  private async connectBroker(brokerIndex: number = 0): Promise<any> {
    // Step 1: Load mqtt.js from CDN
    this.setDebugStatus('LOADING_LIB');
    let mqttLib: any;
    try {
      mqttLib = await loadMqtt();
    } catch (e: any) {
      this.setDebugStatus('ERROR', '', `CDN load failed: ${e.message}`);
      throw e;
    }

    // Step 2: Connect to broker
    return new Promise((resolve, reject) => {
      if (this.client && this.client.connected) {
        this.setDebugStatus('READY');
        resolve(this.client);
        return;
      }

      const brokerUrl = BROKER_SERVERS[brokerIndex % BROKER_SERVERS.length];
      this.setDebugStatus('CONNECTING', brokerUrl);
      console.log(`[NetworkEngine] Connecting to ${brokerUrl} (clientId: ${this.clientId})`);

      try {
        const client = mqttLib.connect(brokerUrl, {
          clientId: this.clientId,
          clean: true,
          connectTimeout: 6000,
          reconnectPeriod: 3000,
          keepalive: 30
        });

        const timeout = setTimeout(() => {
          if (!client.connected) {
            console.warn(`[NetworkEngine] Broker ${brokerUrl} timed out.`);
            try { client.end(true); } catch (_) {}
            if (brokerIndex + 1 < BROKER_SERVERS.length) {
              this.connectBroker(brokerIndex + 1).then(resolve).catch(reject);
            } else {
              this.setDebugStatus('ERROR', brokerUrl, 'All brokers unreachable');
              reject(new Error('All MQTT brokers unreachable'));
            }
          }
        }, 7000);

        client.on('connect', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.client = client;
          this.setDebugStatus('CONNECTED', brokerUrl);
          console.log(`[NetworkEngine] ✅ Connected to ${brokerUrl}`);
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
            const data: NetworkMessage = JSON.parse(str);
            if (data.senderId === this.clientId) return; // ignore own messages
            console.log(`[NetworkEngine] 📨 Received: ${data.event}`, data.payload?.roomCode || '');
            this.dispatch(data);
          } catch (e) {
            console.error('[NetworkEngine] Error parsing message:', e);
          }
        });

        client.on('error', (err: any) => {
          console.warn('[NetworkEngine] Client error:', err?.message || err);
          this.setDebugStatus('ERROR', brokerUrl, err?.message);
        });

        client.on('close', () => {
          this.isConnected = false;
          this.setDebugStatus('DISCONNECTED', brokerUrl);
        });

        client.on('reconnect', () => {
          this.setDebugStatus('CONNECTING', brokerUrl);
        });

      } catch (err: any) {
        this.setDebugStatus('ERROR', '', err?.message);
        reject(err);
      }
    });
  }

  /**
   * Host creates a room.
   */
  public async hostRoom(roomCode: string): Promise<string> {
    this.destroy();
    this.isHost = true;
    this.roomCode = roomCode.toUpperCase().trim();
    this.currentTopic = this.getTopic(this.roomCode);

    try {
      const client = await this.connectBroker(0);

      // Subscribe and wait for confirmation
      await new Promise<void>((resolve, reject) => {
        this.setDebugStatus('SUBSCRIBING');
        client.subscribe(this.currentTopic, { qos: 0 }, (err: any) => {
          if (err) {
            console.error('[NetworkEngine Host] Subscribe error:', err);
            this.setDebugStatus('ERROR', '', 'Subscribe failed');
            reject(err);
          } else {
            console.log(`[NetworkEngine Host] ✅ Subscribed to: ${this.currentTopic}`);
            this.setDebugStatus('READY');
            resolve();
          }
        });
      });

      // Heartbeat
      this.heartbeatTimer = setInterval(() => {
        this.send('ROOM_HEARTBEAT', {
          roomCode: this.roomCode,
          hostClientId: this.clientId
        });
      }, 3500);

      return this.roomCode;
    } catch (e: any) {
      console.error('[NetworkEngine Host] Connection failed:', e);
      this.setDebugStatus('ERROR', '', e?.message || 'Host connection failed');
      return this.roomCode;
    }
  }

  /**
   * Client joins a room.
   */
  public async joinRoom(
    roomCode: string,
    playerInfo: any,
    onSuccess?: () => void,
    onFailed?: (reason: string) => void
  ): Promise<boolean> {
    this.destroy();
    this.isHost = false;
    this.roomCode = roomCode.toUpperCase().trim();
    this.currentTopic = this.getTopic(this.roomCode);

    try {
      const client = await this.connectBroker(0);

      // Subscribe and wait
      await new Promise<void>((resolve, reject) => {
        this.setDebugStatus('SUBSCRIBING');
        client.subscribe(this.currentTopic, { qos: 0 }, (err: any) => {
          if (err) {
            console.error('[NetworkEngine Client] Subscribe error:', err);
            reject(err);
          } else {
            console.log(`[NetworkEngine Client] ✅ Subscribed to: ${this.currentTopic}`);
            this.setDebugStatus('READY');
            resolve();
          }
        });
      });

      let responseReceived = false;

      // Listen for host response
      const unsubscribe = this.onMessage((msg) => {
        if (msg.event === 'LOBBY_STATE' || msg.event === 'ROOM_HEARTBEAT') {
          if (!responseReceived) {
            responseReceived = true;
            if (this.joinRetryTimer) clearInterval(this.joinRetryTimer);
            unsubscribe();
            console.log(`[NetworkEngine Client] ✅ Host found! Event: ${msg.event}`);
            if (onSuccess) onSuccess();
          }
        }
      });

      // Send JOIN_ROOM
      this.send('JOIN_ROOM', {
        ...playerInfo,
        roomCode: this.roomCode,
        clientSenderId: this.clientId
      });

      // Retry up to 5 times
      let attempts = 0;
      this.joinRetryTimer = setInterval(() => {
        attempts++;
        if (responseReceived) {
          clearInterval(this.joinRetryTimer);
          return;
        }
        if (attempts >= 5) {
          clearInterval(this.joinRetryTimer);
          unsubscribe();
          console.warn('[NetworkEngine Client] ❌ Host not found after 5 retries');
          if (onFailed) onFailed('HOST_NOT_FOUND');
        } else {
          console.log(`[NetworkEngine] Retry JOIN_ROOM (${attempts + 1}/5)...`);
          this.send('JOIN_ROOM', {
            ...playerInfo,
            roomCode: this.roomCode,
            clientSenderId: this.clientId
          });
        }
      }, 1500);

      return true;
    } catch (e: any) {
      console.error('[NetworkEngine Client] Join failed:', e);
      this.setDebugStatus('ERROR', '', e?.message || 'Join failed');
      if (onFailed) onFailed(e?.message || 'NETWORK_ERROR');
      return false;
    }
  }

  /**
   * Publish a message to the room topic.
   */
  public send(event: string, payload: any): void {
    if (!this.client || !this.client.connected || !this.currentTopic) {
      console.warn(`[NetworkEngine] Cannot send ${event}: not connected (client=${!!this.client}, connected=${this.client?.connected}, topic=${this.currentTopic})`);
      return;
    }

    const msg: NetworkMessage = {
      event,
      payload,
      senderId: this.clientId,
      timestamp: Date.now()
    };

    try {
      this.client.publish(this.currentTopic, JSON.stringify(msg), { qos: 0 });
      this._msgSent++;
      if (event !== 'ROOM_HEARTBEAT') {
        console.log(`[NetworkEngine] 📤 Sent: ${event}`);
      }
    } catch (e) {
      console.error('[NetworkEngine] Publish error:', e);
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
    if (this.client) {
      try {
        if (this.currentTopic) this.client.unsubscribe(this.currentTopic);
        this.client.end(true);
      } catch (_) {}
      this.client = null;
    }
    this.isConnected = false;
    this.isHost = false;
    this.currentTopic = '';
    this.setDebugStatus('IDLE');
  }
}

export const networkEngine = new NetworkEngine();

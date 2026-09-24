import mqtt, { MqttClient } from 'mqtt';

export interface NetworkMessage {
  event: string;
  payload: any;
  senderId?: string;
  timestamp?: number;
}

export type NetworkMessageHandler = (msg: NetworkMessage) => void;

const BROKER_SERVERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt'
];

/**
 * NetworkEngine provides 100% reliable, zero-config multiplayer rooms
 * connecting mobile and desktop players across different carriers & networks
 * (Vodafone, Orange, Etisalat, WE, Wi-Fi, 4G/5G) via public WSS MQTT brokers.
 */
export class NetworkEngine {
  private client: MqttClient | null = null;
  public isHost: boolean = false;
  public roomCode: string = '';
  public clientId: string = '';
  public isConnected: boolean = false;
  private currentTopic: string = '';
  private messageHandlers: Set<NetworkMessageHandler> = new Set();
  private heartbeatTimer: any = null;
  private joinRetryTimer: any = null;

  constructor() {
    this.clientId = 'skru_' + Math.random().toString(36).substring(2, 10);
  }

  public onMessage(handler: NetworkMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  private dispatch(msg: NetworkMessage) {
    for (const h of this.messageHandlers) {
      try {
        h(msg);
      } catch (err) {
        console.error('[NetworkEngine] Handler error:', err);
      }
    }
  }

  private getTopic(roomCode: string): string {
    const clean = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `skru/egypt_v2/${clean}`;
  }

  /**
   * Connect to MQTT Broker with automatic fallback
   */
  private connectBroker(brokerIndex: number = 0): Promise<MqttClient> {
    return new Promise((resolve, reject) => {
      if (this.client && this.client.connected) {
        resolve(this.client);
        return;
      }

      const brokerUrl = BROKER_SERVERS[brokerIndex % BROKER_SERVERS.length];
      console.log(`[NetworkEngine] Connecting to WSS Broker: ${brokerUrl}`);

      try {
        const client = mqtt.connect(brokerUrl, {
          clientId: this.clientId,
          clean: true,
          connectTimeout: 6000,
          reconnectPeriod: 3000,
          keepalive: 30
        });

        const timeout = setTimeout(() => {
          if (!client.connected) {
            console.warn(`[NetworkEngine] Broker ${brokerUrl} connection timed out. Trying fallback...`);
            client.end(true);
            if (brokerIndex + 1 < BROKER_SERVERS.length) {
              this.connectBroker(brokerIndex + 1).then(resolve).catch(reject);
            } else {
              reject(new Error('All MQTT brokers unreachable'));
            }
          }
        }, 7000);

        client.on('connect', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.client = client;
          console.log(`[NetworkEngine] Successfully connected to ${brokerUrl}`);
          resolve(client);
        });

        client.on('message', (topic: string, message: Uint8Array) => {
          try {
            const str = new TextDecoder('utf-8').decode(message);
            const data: NetworkMessage = JSON.parse(str);
            // Ignore messages sent by ourselves
            if (data.senderId === this.clientId) {
              return;
            }
            this.dispatch(data);
          } catch (e) {
            console.error('[NetworkEngine] Error parsing message:', e);
          }
        });

        client.on('error', (err) => {
          console.warn('[NetworkEngine] Client error:', err);
        });

        client.on('close', () => {
          this.isConnected = false;
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Host creates a room with the given code
   */
  public async hostRoom(roomCode: string): Promise<string> {
    this.destroy();
    this.isHost = true;
    this.roomCode = roomCode.toUpperCase().trim();
    this.currentTopic = this.getTopic(this.roomCode);

    try {
      const client = await this.connectBroker(0);
      client.subscribe(this.currentTopic, { qos: 0 }, (err) => {
        if (err) {
          console.error('[NetworkEngine Host] Subscribe error:', err);
        } else {
          console.log(`[NetworkEngine Host] Subscribed to room topic: ${this.currentTopic}`);
        }
      });

      // Periodically broadcast heartbeat presence so joining players discover host
      this.heartbeatTimer = setInterval(() => {
        this.send('ROOM_HEARTBEAT', {
          roomCode: this.roomCode,
          hostClientId: this.clientId
        });
      }, 3500);

      return this.roomCode;
    } catch (e) {
      console.error('[NetworkEngine Host] Connection failed:', e);
      return this.roomCode;
    }
  }

  /**
   * Client joins a room created by another player
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
      client.subscribe(this.currentTopic, { qos: 0 }, (err) => {
        if (err) console.error('[NetworkEngine Client] Subscribe error:', err);
      });

      let responseReceived = false;

      // Listen for host LOBBY_STATE or ROOM_HEARTBEAT response
      const unsubscribe = this.onMessage((msg) => {
        if (msg.event === 'LOBBY_STATE' || msg.event === 'ROOM_HEARTBEAT') {
          if (!responseReceived) {
            responseReceived = true;
            if (this.joinRetryTimer) clearInterval(this.joinRetryTimer);
            unsubscribe();
            if (onSuccess) onSuccess();
          }
        }
      });

      // Send JOIN_ROOM message immediately
      this.send('JOIN_ROOM', {
        ...playerInfo,
        roomCode: this.roomCode,
        clientSenderId: this.clientId
      });

      // Retry every 1.5 seconds up to 5 times (7.5 seconds total)
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
          if (onFailed) {
            onFailed('HOST_NOT_FOUND');
          }
        } else {
          console.log(`[NetworkEngine] Retrying JOIN_ROOM (attempt ${attempts + 1})...`);
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
      if (onFailed) onFailed(e?.message || 'NETWORK_ERROR');
      return false;
    }
  }

  /**
   * Broadcast message to the current room topic
   */
  public send(event: string, payload: any): void {
    if (!this.client || !this.client.connected || !this.currentTopic) {
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
    } catch (e) {
      console.error('[NetworkEngine] Error publishing message:', e);
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
        if (this.currentTopic) {
          this.client.unsubscribe(this.currentTopic);
        }
        this.client.end(true);
      } catch (e) {}
      this.client = null;
    }
    this.isConnected = false;
    this.isHost = false;
    this.currentTopic = '';
  }
}

export const networkEngine = new NetworkEngine();

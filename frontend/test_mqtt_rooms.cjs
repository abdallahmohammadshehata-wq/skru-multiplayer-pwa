// Quick E2E test: verify two MQTT clients can join the same room
const mqtt = require('mqtt');

const TOPIC = 'skru/egypt_v3/TEST1';
const HOST_ID = 'host_' + Date.now();
const CLIENT_ID = 'client_' + Date.now();

console.log('Topic:', TOPIC);
console.log('Host ID:', HOST_ID);
console.log('Client ID:', CLIENT_ID);

const host = mqtt.connect('wss://broker.emqx.io:8084/mqtt', { clientId: HOST_ID });

host.on('connect', () => {
  console.log('[HOST] Connected to broker');
  host.subscribe(TOPIC, (err) => {
    if (err) return console.error('[HOST] Subscribe error:', err);
    console.log('[HOST] Subscribed to:', TOPIC);
  });
});

host.on('message', (topic, message) => {
  const data = JSON.parse(message.toString());
  if (data.senderId === HOST_ID) return; // ignore own
  console.log('[HOST] Received:', data.event, 'from', data.senderId);
  
  if (data.event === 'JOIN_ROOM') {
    const lobby = { roomCode: 'TEST1', players: ['Host', data.payload.name] };
    host.publish(TOPIC, JSON.stringify({
      event: 'LOBBY_STATE',
      payload: lobby,
      senderId: HOST_ID,
      timestamp: Date.now()
    }));
    console.log('[HOST] Sent LOBBY_STATE');
  }
});

// Client connects 2s later
setTimeout(() => {
  const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', { clientId: CLIENT_ID });

  client.on('connect', () => {
    console.log('[CLIENT] Connected to broker');
    client.subscribe(TOPIC, (err) => {
      if (err) return console.error('[CLIENT] Subscribe error:', err);
      console.log('[CLIENT] Subscribed to:', TOPIC);

      // Send JOIN_ROOM
      client.publish(TOPIC, JSON.stringify({
        event: 'JOIN_ROOM',
        payload: { name: 'TestJoiner', avatar: '🦊' },
        senderId: CLIENT_ID,
        timestamp: Date.now()
      }));
      console.log('[CLIENT] Sent JOIN_ROOM');
    });
  });

  client.on('message', (topic, message) => {
    const data = JSON.parse(message.toString());
    if (data.senderId === CLIENT_ID) return;

    if (data.event === 'LOBBY_STATE') {
      console.log('[CLIENT] Received LOBBY_STATE:', JSON.stringify(data.payload));
      console.log('\n✅ SUCCESS - Rooms are linked! Both players see:', data.payload.players);
      host.end();
      client.end();
      process.exit(0);
    }
  });
}, 2000);

setTimeout(() => {
  console.log('\n❌ TIMEOUT - test failed after 15s');
  process.exit(1);
}, 15000);

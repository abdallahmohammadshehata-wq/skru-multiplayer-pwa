const mqtt = require('mqtt');

function normalizeRoomCode(code) {
  let clean = (code || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
  if (clean.startsWith('SKRU') && clean.length > 4) {
    clean = clean.replace(/^SKRU/, '');
  }
  return clean;
}

const RAW_CODE = 'SKRU-8X2K1';
const ROOM_CODE = normalizeRoomCode(RAW_CODE); // '8X2K1'
const TOPIC = `skru/egypt_v3/${ROOM_CODE}`;

console.log('--- Multi-Player Room Sync Simulation ---');
console.log('Room Code:', ROOM_CODE, '(from input:', RAW_CODE, ')');
console.log('Topic:', TOPIC);

const HOST_ID = 'host_pharaoh_' + Date.now();
const P2_ID = 'p2_tiger_' + Date.now();
const P3_ID = 'p3_falcon_' + Date.now();

let hostLobby = {
  roomCode: ROOM_CODE,
  players: [{ id: HOST_ID, name: 'الفرعون 👑', avatar: '🦁', isHost: true }]
};

const host = mqtt.connect('wss://broker.emqx.io:8084/mqtt', { clientId: HOST_ID });

host.on('connect', () => {
  console.log('[HOST] Connected to MQTT broker');
  host.subscribe(TOPIC, { qos: 0 }, (err) => {
    if (err) return console.error('[HOST] Subscribe error:', err);
    console.log('[HOST] ✅ Subscribed to topic:', TOPIC);
  });
});

host.on('message', (_topic, message) => {
  const data = JSON.parse(message.toString());
  if (data.senderId === HOST_ID) return;

  console.log(`[HOST] 📨 Received ${data.event} from ${data.payload?.name || data.senderId}`);

  if (data.event === 'JOIN_ROOM') {
    const newPlayer = {
      id: data.payload.playerId,
      name: data.payload.name,
      avatar: data.payload.avatar,
      isHost: false
    };
    if (!hostLobby.players.find(p => p.id === newPlayer.id)) {
      hostLobby.players.push(newPlayer);
    }

    // Send JOIN_ACK
    host.publish(TOPIC, JSON.stringify({
      event: 'JOIN_ACK',
      payload: { roomCode: ROOM_CODE, playerId: newPlayer.id, hostId: HOST_ID },
      senderId: HOST_ID,
      timestamp: Date.now()
    }));

    // Send updated LOBBY_STATE
    host.publish(TOPIC, JSON.stringify({
      event: 'LOBBY_STATE',
      payload: hostLobby,
      senderId: HOST_ID,
      timestamp: Date.now()
    }));
    console.log(`[HOST] 📤 Broadcasted LOBBY_STATE (${hostLobby.players.length} players)`);
  }
});

// Player 2 joins after 1.5s
setTimeout(() => {
  console.log('\n[P2] Connecting...');
  const p2 = mqtt.connect('wss://broker.emqx.io:8084/mqtt', { clientId: P2_ID });
  
  p2.on('connect', () => {
    p2.subscribe(TOPIC, () => {
      console.log('[P2] Subscribed. Sending JOIN_ROOM...');
      p2.publish(TOPIC, JSON.stringify({
        event: 'JOIN_ROOM',
        payload: { roomCode: '8X2K1', playerId: P2_ID, name: 'النمر 🐯', avatar: '🐯' },
        senderId: P2_ID,
        timestamp: Date.now()
      }));
    });
  });

  p2.on('message', (_topic, message) => {
    const data = JSON.parse(message.toString());
    if (data.senderId === P2_ID) return;
    if (data.event === 'LOBBY_STATE') {
      console.log(`[P2] ✅ Received LOBBY_STATE with players:`, data.payload.players.map(p => p.name));
    }
  });
}, 1500);

// Player 3 joins with prefixed code 'SKRU-8X2K1' after 3s
setTimeout(() => {
  console.log('\n[P3] Connecting with code "SKRU-8X2K1"...');
  const p3Room = normalizeRoomCode('SKRU-8X2K1');
  const p3Topic = `skru/egypt_v3/${p3Room}`;
  const p3 = mqtt.connect('wss://broker.emqx.io:8084/mqtt', { clientId: P3_ID });

  p3.on('connect', () => {
    p3.subscribe(p3Topic, () => {
      console.log('[P3] Subscribed to:', p3Topic, '. Sending JOIN_ROOM...');
      p3.publish(p3Topic, JSON.stringify({
        event: 'JOIN_ROOM',
        payload: { roomCode: p3Room, playerId: P3_ID, name: 'الصقر 🦅', avatar: '🦅' },
        senderId: P3_ID,
        timestamp: Date.now()
      }));
    });
  });

  p3.on('message', (_topic, message) => {
    const data = JSON.parse(message.toString());
    if (data.senderId === P3_ID) return;
    if (data.event === 'LOBBY_STATE' && data.payload.players.length === 3) {
      console.log(`\n🎉 SUCCESS! All 3 players are connected into the same room!`);
      console.log('Players roster:', data.payload.players.map(p => `${p.avatar} ${p.name}`));
      process.exit(0);
    }
  });
}, 3000);

setTimeout(() => {
  console.error('\n❌ TIMEOUT: test did not complete in 15 seconds');
  process.exit(1);
}, 15000);

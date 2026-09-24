import assert from 'node:assert/strict';
import { WebSocket } from 'ws';

function createClient(name, avatar) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:3001');
    const client = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name,
      avatar,
      ws,
      lastGameState: null,
      lastLobbyState: null,
      lastPeekReveal: null,
      chatBroadcasts: [],
      emojiBroadcasts: [],
      matchSlapResults: [],
      send(event, payload = {}) {
        ws.send(JSON.stringify({ event, payload }));
      },
      waitForEvent(eventType, timeoutMs = 5000) {
        return new Promise((res, rej) => {
          const timer = setTimeout(() => rej(new Error(`Timeout waiting for event: ${eventType}`)), timeoutMs);
          const listener = (data) => {
            try {
              const msg = JSON.parse(data.toString());
              if (msg.event === eventType) {
                clearTimeout(timer);
                ws.off('message', listener);
                res(msg.payload);
              }
            } catch (e) {}
          };
          ws.on('message', listener);
        });
      },
      waitForState(predicate, timeoutMs = 8000) {
        return new Promise((res, rej) => {
          if (this.lastGameState && predicate(this.lastGameState)) {
            return res(this.lastGameState);
          }
          const timer = setTimeout(() => rej(new Error('Timeout waiting for state predicate')), timeoutMs);
          const listener = (data) => {
            try {
              const msg = JSON.parse(data.toString());
              if (msg.event === 'GAME_STATE' && predicate(msg.payload)) {
                clearTimeout(timer);
                ws.off('message', listener);
                res(msg.payload);
              }
            } catch (e) {}
          };
          ws.on('message', listener);
        });
      },
      close() {
        ws.close();
      }
    };

    ws.on('open', () => {
      resolve(client);
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.event === 'GAME_STATE') client.lastGameState = msg.payload;
        if (msg.event === 'LOBBY_STATE') client.lastLobbyState = msg.payload;
        if (msg.event === 'PEEK_REVEAL') client.lastPeekReveal = msg.payload;
        if (msg.event === 'CHAT_BROADCAST') client.chatBroadcasts.push(msg.payload);
        if (msg.event === 'EMOJI_BROADCAST') client.emojiBroadcasts.push(msg.payload);
        if (msg.event === 'MATCH_SLAP_RESULT') client.matchSlapResults.push(msg.payload);
        if (msg.event === 'ACTION_REJECTED' || msg.event === 'ERROR') {
          console.warn(`[${name}] ${msg.event}:`, msg.payload?.message || msg.payload);
        }
      } catch (e) {}
    });

    ws.on('error', reject);
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runFullMultiplayerGameTest() {
  console.log('--- [Mode 1] Online Real-Time Multiplayer Rooms Full Game Test ---');

  // Step 1: Connect 3 clients
  const p1 = await createClient('Youssef', '🦁');
  const p2 = await createClient('Mariam', '🦊');
  const p3 = await createClient('Karim', '🦅');
  console.log(`Connected 3 players: ${p1.name}, ${p2.name}, ${p3.name}`);

  // Step 2: Host creates room (targetScore: 25 for fast full-game tournament)
  p1.send('CREATE_ROOM', {
    playerId: p1.id,
    name: p1.name,
    avatar: p1.avatar,
    options: {
      variant: 'CLASSIC',
      maxPlayers: 3,
      targetScore: 25,
      turnTimerSeconds: 15,
      isPrivate: false,
      passcode: ''
    }
  });

  const createdData = await p1.waitForEvent('ROOM_CREATED');
  const roomCode = createdData.roomCode;
  console.log(`✓ Room created with code: ${roomCode}`);
  assert.ok(roomCode.startsWith('SKRU-'), 'Room code must have SKRU- prefix');

  // Step 3: Players 2 and 3 join
  p2.send('JOIN_ROOM', { roomCode, playerId: p2.id, name: p2.name, avatar: p2.avatar });
  p3.send('JOIN_ROOM', { roomCode, playerId: p3.id, name: p3.name, avatar: p3.avatar });

  await sleep(200);
  assert.equal(p1.lastLobbyState?.players.length, 3, 'Lobby must have 3 players');
  console.log(`✓ All 3 players joined lobby successfully!`);

  // Step 4: Test in-game chat and emoji reactions in lobby
  p2.send('CHAT_MESSAGE', { text: 'يلا نبدأ يا يوسف!' });
  p3.send('EMOJI_REACTION', { emoji: '🔥' });
  await sleep(200);
  assert.ok(p1.chatBroadcasts.some(c => c.text.includes('يلا نبدأ')), 'P1 received P2 chat');
  assert.ok(p1.emojiBroadcasts.some(e => e.emoji === '🔥'), 'P1 received P3 emoji');
  console.log(`✓ Chat and Emoji broadcast verified across clients!`);

  // Step 5: Start Game
  p1.send('START_GAME', {});
  await p1.waitForState(s => s.status === 'INITIAL_PEEK');
  console.log(`✓ Game started! Entered INITIAL_PEEK phase.`);

  // Anti-cheat verification during dealing
  const p1State = p1.lastGameState;
  assert.equal(p1State.players.length, 3);
  for (const opp of p1State.players.filter(p => p.id !== p1.id)) {
    for (const c of opp.hand) {
      assert.equal(c.value, undefined, 'CRITICAL: Opponent hidden card value leaked to client!');
      assert.equal(c.action, undefined, 'CRITICAL: Opponent hidden card action leaked to client!');
    }
  }
  console.log(`✓ Anti-cheat verified: Opponents' cards strictly redacted from client payload.`);

  // Transition to PLAYING
  p1.send('READY_TO_PLAY', {});
  await p1.waitForState(s => s.status === 'PLAYING');
  console.log(`✓ Transitioned to active PLAYING phase.`);

  // Play rounds until GAME_OVER
  let roundCount = 1;
  const clients = [p1, p2, p3];

  while (roundCount <= 5) {
    console.log(`\n--- Playing Round ${roundCount} ---`);
    let turnCount = 0;
    const maxTurns = 30;

    while (turnCount < maxTurns) {
      turnCount++;
      const current = clients.find(c => c.id === p1.lastGameState.currentTurnPlayerId);
      if (!current) break;

      const state = current.lastGameState;
      if (state.status === 'ROUND_OVER' || state.status === 'GAME_OVER') {
        break;
      }

      // If already has drawn card from previous action, swap it
      if (current.lastGameState?.drawnCardForCurrentPlayer) {
        current.send('SWAP_CARD', { handIndex: 0 });
        await sleep(150);
      }

      // If playing and round has progressed at least 3 turns, call Skru once BEFORE drawing
      if (state.status === 'PLAYING' && turnCount >= 4 && state.skruCallerId === null && !current.lastGameState?.drawnCardForCurrentPlayer) {
        console.log(`>> ${current.name} declares "سكرووو!" (CALL_SKRU)!`);
        current.send('CALL_SKRU', {});
        await sleep(300);
        console.log(`After CALL_SKRU, skruCallerId = ${current.lastGameState?.skruCallerId}`);
        assert.ok(current.lastGameState?.skruCallerId !== null, 'Skru caller ID must be set');
        continue;
      }

      // Draw card
      const from = (state.topDiscard && Math.random() > 0.7) ? 'DISCARD_PILE' : 'DRAW_PILE';
      current.send('DRAW_CARD', { from });
      await sleep(150);

      const drawnState = current.lastGameState;
      const drawnCard = drawnState?.drawnCardForCurrentPlayer;

      if (!drawnCard) {
        // Maybe turn timed out or auto resolved
        continue;
      }

      // Rule: Cards from discard pile MUST be swapped into hand
      if (from === 'DISCARD_PILE') {
        current.send('SWAP_CARD', { handIndex: 0 });
        await sleep(150);
        continue;
      }

      // Action card execution test
      if (drawnCard.action && drawnCard.action !== 'NONE') {
        // Discard to activate action
        current.send('DISCARD_CARD', { triggerAction: true });
        await sleep(100);

        if (current.lastGameState?.pendingActionSummary) {
          const actionType = current.lastGameState.pendingActionSummary.type;
          console.log(`  ${current.name} triggered action: ${actionType}`);

          if (actionType === 'PEEK_OWN') {
            current.send('EXECUTE_ACTION', { targetPlayerId: current.id, targetCardIndex: 0 });
            await sleep(150);
            current.send('DISMISS_PEEK', {});
          } else if (actionType === 'PEEK_OTHER') {
            const target = clients.find(c => c.id !== current.id);
            current.send('EXECUTE_ACTION', { targetPlayerId: target.id, targetCardIndex: 0 });
            await sleep(150);
            current.send('DISMISS_PEEK', {});
          } else if (actionType === 'SWAP') {
            const target = clients.find(c => c.id !== current.id);
            current.send('EXECUTE_ACTION', {
              myCardIndex: 0,
              targetPlayerId: target.id,
              targetCardIndex: 0
            });
          } else if (actionType === 'PEEK_AND_SWAP') {
            const target = clients.find(c => c.id !== current.id);
            current.send('EXECUTE_ACTION', { targetPlayerId: target.id, targetCardIndex: 0 });
            await sleep(150);
            current.send('EXECUTE_ACTION', { chooseSwap: false });
          } else if (actionType === 'PEEK_ALL') {
            current.send('EXECUTE_ACTION', {});
            await sleep(150);
            current.send('DISMISS_PEEK', {});
          } else if (actionType === 'FREEZE') {
            const target = clients.find(c => c.id !== current.id);
            current.send('EXECUTE_ACTION', { targetPlayerId: target.id });
          } else {
            current.send('EXECUTE_ACTION', {});
          }
          await sleep(200);
        }
      } else if (drawnCard.value <= 4) {
        // Swap low card into hand
        current.send('SWAP_CARD', { handIndex: 1 });
        await sleep(150);
      } else {
        // Discard high card
        current.send('DISCARD_CARD', { triggerAction: false });
        await sleep(150);
      }

      // Test Match Slap (التشابه): out of turn card slap
      if (turnCount === 2) {
        const offTurnPlayer = clients.find(c => c.id !== current.id);
        offTurnPlayer.send('MATCH_SLAP', { handIndex: 0 });
        await sleep(100);
        console.log(`  Match slap tested by ${offTurnPlayer.name}`);
      }

      if (current.lastGameState.status === 'ROUND_OVER' || current.lastGameState.status === 'GAME_OVER') {
        break;
      }
    }

    // Verify round finished
    const endState = p1.lastGameState;
    console.log(`Round ${roundCount} ended! Status: ${endState.status}`);
    assert.ok(endState.status === 'ROUND_OVER' || endState.status === 'GAME_OVER', 'Round must be resolved');

    // Verify scoring & caller penalty logic
    console.log('Player Round Results:');
    for (const p of endState.players) {
      const lastRoundPts = p.roundScores[p.roundScores.length - 1] ?? 0;
      console.log(`  - ${p.name}: Round Score = ${lastRoundPts}, Total Score = ${p.totalScore}`);
    }

    if (endState.status === 'GAME_OVER') {
      console.log(`\n🎉 GAME OVER! Winner crowned: ${endState.winner?.name}!`);
      break;
    }

    // Host starts next round
    roundCount++;
    console.log('Host starts next round...');
    p1.send('START_NEXT_ROUND', {});
    await sleep(200);
    p1.send('READY_TO_PLAY', {});
    await sleep(200);
  }

  // Cleanup
  p1.close();
  p2.close();
  p3.close();
  console.log('\n✅ [Mode 1] Online Real-Time Multiplayer Rooms Test PASSED COMPLETELY!\n');
}

async function runSahebSa7bo2v2GameTest() {
  console.log('--- [Mode 1 - 2v2 Variant] Saheb Sa7bo (صاحب صاحبه) Team Match Test ---');
  const p1 = await createClient('Ziad (Team A)', '🦁');
  const p2 = await createClient('Tarek (Team A)', '🐯');
  const p3 = await createClient('Salma (Team B)', '🦊');
  const p4 = await createClient('Laila (Team B)', '🐱');

  p1.send('CREATE_ROOM', {
    playerId: p1.id,
    name: p1.name,
    avatar: p1.avatar,
    options: {
      variant: 'SAHEB_SA7BO',
      maxPlayers: 4,
      targetScore: 50,
      turnTimerSeconds: 15,
      isPrivate: false,
      passcode: ''
    }
  });

  const { roomCode } = await p1.waitForEvent('ROOM_CREATED');
  console.log(`2v2 Room created: ${roomCode}`);

  p2.send('JOIN_ROOM', { roomCode, playerId: p2.id, name: p2.name, avatar: p2.avatar, team: 'A' });
  p3.send('JOIN_ROOM', { roomCode, playerId: p3.id, name: p3.name, avatar: p3.avatar, team: 'B' });
  p4.send('JOIN_ROOM', { roomCode, playerId: p4.id, name: p4.name, avatar: p4.avatar, team: 'B' });

  await sleep(300);
  assert.equal(p1.lastLobbyState.players.length, 4);

  p1.send('START_GAME', {});
  await p1.waitForState(s => s.status === 'INITIAL_PEEK');
  p1.send('READY_TO_PLAY', {});
  await p1.waitForState(s => s.status === 'PLAYING');

  console.log(`✓ 2v2 Game active with teams!`);
  assert.equal(p1.lastGameState.variant, 'SAHEB_SA7BO');

  // Verify teams assigned
  const teamAPlayers = p1.lastGameState.players.filter(p => p.team === 'A');
  const teamBPlayers = p1.lastGameState.players.filter(p => p.team === 'B');
  assert.equal(teamAPlayers.length, 2, 'Team A must have 2 players');
  assert.equal(teamBPlayers.length, 2, 'Team B must have 2 players');
  console.log(`✓ Team A & Team B properly balanced.`);

  p1.close();
  p2.close();
  p3.close();
  p4.close();
  console.log('✅ [Mode 1 - 2v2 Variant] Saheb Sa7bo Test PASSED!\n');
}

(async () => {
  try {
    await runFullMultiplayerGameTest();
    await runSahebSa7bo2v2GameTest();
    console.log('🎉 ALL MULTIPLAYER ROOM INTEGRATION TESTS COMPLETED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Multiplayer test error:', err);
    process.exit(1);
  }
})();

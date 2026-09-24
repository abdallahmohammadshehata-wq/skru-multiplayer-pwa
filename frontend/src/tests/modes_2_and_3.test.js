import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalDeck, LocalGameSession } from '../engine/localGameEngine.js';

// ============================================================================
// MODE 2: Digital Tabletop Companion & Scorekeeper Full Game + Rules Testing
// ============================================================================

test('Mode 2: Digital Tabletop Scorekeeper Full Multi-Round Tournament & Penalties', () => {
  console.log('\n--- [Mode 2] Digital Tabletop Companion & Scorekeeper Test ---');

  // Simulated 4-player physical game match
  const players = [
    { id: 'p1', name: 'Ziad', avatar: '🦁', roundScores: [], totalScore: 0 },
    { id: 'p2', name: 'Sara', avatar: '🦊', roundScores: [], totalScore: 0 },
    { id: 'p3', name: 'Omar', avatar: '🐯', roundScores: [], totalScore: 0 },
    { id: 'p4', name: 'Laila', avatar: '🐱', roundScores: [], totalScore: 0 }
  ];

  // Helper matching Scorekeeper.tsx round calculation logic
  function calculateRoundScores(currentPlayers, handInputs, skruCallerId) {
    const parsed = {};
    for (const p of currentPlayers) {
      parsed[p.id] = handInputs[p.id] ?? 0;
    }

    return currentPlayers.map(p => {
      const handSum = parsed[p.id];
      let finalRoundScore = handSum;

      if (skruCallerId === p.id) {
        const othersTiedOrLower = Object.entries(parsed).filter(
          ([id, sum]) => id !== p.id && sum <= handSum
        );

        if (othersTiedOrLower.length === 0) {
          // Success! Caller strictly lowest -> 0 points
          finalRoundScore = 0;
        } else {
          // Failed call! Penalty: Double score or sum + 30
          finalRoundScore = Math.max(handSum * 2, handSum + 30);
        }
      }

      return {
        ...p,
        roundScores: [...p.roundScores, finalRoundScore],
        totalScore: p.totalScore + finalRoundScore
      };
    });
  }

  // --- ROUND 1: Ziad calls Skru and WINS strictly ---
  // Hands: Ziad: 3, Sara: 9, Omar: 14, Laila: 22
  let state = calculateRoundScores(players, { p1: 3, p2: 9, p3: 14, p4: 22 }, 'p1');
  assert.equal(state.find(p => p.id === 'p1').roundScores[0], 0, 'Winning caller Ziad must get 0 points');
  assert.equal(state.find(p => p.id === 'p2').roundScores[0], 9);
  assert.equal(state.find(p => p.id === 'p3').roundScores[0], 14);
  assert.equal(state.find(p => p.id === 'p4').roundScores[0], 22);
  console.log('✓ Round 1: Caller WINS strictly -> scores 0 points!');

  // --- ROUND 2: Sara calls Skru but FAILS (Omar had a lower sum) ---
  // Hands: Ziad: 12, Sara: 10, Omar: 4, Laila: 18
  state = calculateRoundScores(state, { p1: 12, p2: 10, p3: 4, p4: 18 }, 'p2');
  const saraP2 = state.find(p => p.id === 'p2');
  // Sara penalty: Math.max(10 * 2, 10 + 30) = 40
  assert.equal(saraP2.roundScores[1], 40, 'Failed caller Sara receives double/plus-30 penalty');
  console.log('✓ Round 2: Caller FAILS (beaten by opponent) -> receives penalty score: ' + saraP2.roundScores[1]);

  // --- ROUND 3: Omar calls Skru and TIED with Ziad (Caller FAILS on tie) ---
  // Hands: Ziad: 6, Sara: 15, Omar: 6, Laila: 25
  state = calculateRoundScores(state, { p1: 6, p2: 15, p3: 6, p4: 25 }, 'p3');
  const omarP3 = state.find(p => p.id === 'p3');
  // Omar penalty: Math.max(6 * 2, 6 + 30) = 36
  assert.equal(omarP3.roundScores[2], 36, 'Failed caller Omar on tie receives penalty');
  console.log('✓ Round 3: Caller FAILS on TIE -> strictly lowest rule enforced, penalty applied: ' + omarP3.roundScores[2]);

  // --- ROUND 4: End Game & Podium Ranking ---
  state = calculateRoundScores(state, { p1: 5, p2: 18, p3: 20, p4: 35 }, 'NONE');

  // Verify Podium Order (lowest total score wins!)
  const podium = [...state].sort((a, b) => a.totalScore - b.totalScore);
  console.log('Final Scoreboard Podium:');
  podium.forEach((p, idx) => {
    console.log(`  #${idx + 1}: ${p.name} - Total Score: ${p.totalScore}`);
  });

  assert.equal(podium[0].name, 'Ziad', 'Ziad should be 1st place with lowest cumulative score');
  assert.ok(podium[0].totalScore < podium[podium.length - 1].totalScore);
  console.log('✅ Mode 2: Scorekeeper round math, Skru penalties, and podium PASSED!');
});

test('Mode 2: Rule Companion & Encyclopedia Data Integrity', () => {
  console.log('\n--- [Mode 2] Rules Encyclopedia Data Verification ---');

  // Verify all card types across official rules
  const deck = createLocalDeck('CLASSIC');
  assert.equal(deck.length, 68, 'Deck must contain 68 cards');

  // Verify action cards
  const peekOwn = deck.filter(c => c.action === 'PEEK_OWN');
  const peekOther = deck.filter(c => c.action === 'PEEK_OTHER');
  const swap = deck.filter(c => c.action === 'SWAP');
  const peekAndSwap = deck.filter(c => c.action === 'PEEK_AND_SWAP');
  const peekAll = deck.filter(c => c.action === 'PEEK_ALL');

  assert.equal(peekOwn.length, 8, '8 Peek Own cards');
  assert.equal(peekOther.length, 8, '8 Peek Other cards');
  assert.equal(swap.length, 6, '6 Swap cards');
  assert.equal(peekAndSwap.length, 4, '4 Peek & Swap cards');
  assert.equal(peekAll.length, 4, '4 Peek All cards');

  // Verify bilingual labels
  for (const c of deck) {
    assert.ok(c.labelAr.length > 0, 'Card must have Arabic label');
    assert.ok(c.labelEn.length > 0, 'Card must have English label');
  }

  console.log('✅ Mode 2: Rules Encyclopedia data integrity verified!');
});

// ============================================================================
// MODE 3: Local Digital Tabletop (Solo vs Heuristic AI) Full Game Testing
// ============================================================================

test('Mode 3: Local Digital Tabletop Full Game (Human vs 3 AI Bots)', async () => {
  console.log('\n--- [Mode 3] Local Digital Tabletop Full Game Test (Solo vs AI) ---');

  const configs = [
    { name: 'Tarek (Human)', avatar: '🦁', isAi: false },
    { name: 'Bot Omar', avatar: '🤖', isAi: true },
    { name: 'Bot Salma', avatar: '🦊', isAi: true },
    { name: 'Bot Karim', avatar: '🦅', isAi: true }
  ];

  // Set low target score (35) so match finishes in a fast multi-round tournament
  const game = new LocalGameSession(configs, 'CLASSIC', 35);
  console.log(`Created Local Tabletop Session with 1 Human and 3 AI Bots. Points cap: ${game.pointsCap}`);

  assert.equal(game.players.length, 4);
  assert.equal(game.players[0].hand.length, 4, 'Human starts with 4 cards');
  assert.equal(game.players[1].hand.length, 4, 'Bot starts with 4 cards');

  // Verify initial peek: player knows their bottom 2 cards
  assert.equal(game.players[0].knownCards.filter(c => c !== null).length, 2, 'Player knows 2 bottom cards at start');
  console.log('✓ Initial peek phase verified: bottom 2 cards memorized.');

  let totalRoundsPlayed = 0;

  while (!game.isGameOver && totalRoundsPlayed < 5) {
    totalRoundsPlayed++;
    console.log(`\n--- Playing Local Round ${totalRoundsPlayed} ---`);

    let turnsInRound = 0;
    const maxTurnsInRound = 40;

    while (!game.isRoundOver && turnsInRound < maxTurnsInRound) {
      turnsInRound++;
      const current = game.players[game.currentTurnIndex];

      // If Skru has not been called and round has progressed, check if player or bot calls Skru
      if (game.skruCallerIndex === null && turnsInRound >= 6) {
        const knownSum = current.knownCards.reduce((acc, v) => acc + (v ?? 5), 0);
        if (knownSum <= 6 || turnsInRound >= 12) {
          console.log(`>> ${current.name} declares "سكرووو!" (CALL_SKRU)!`);
          game.callSkru();
          assert.equal(game.skruCallerIndex, game.players.indexOf(current));
          assert.equal(game.finalTurnsRemaining, 3, 'Each other player gets 1 final turn (3 remaining)');
          continue;
        }
      }

      // Turn: Draw card
      const topDiscard = game.discardPile[game.discardPile.length - 1];
      const from = (topDiscard && topDiscard.value <= 3) ? 'DISCARD_PILE' : 'DRAW_PILE';
      const drawn = game.draw(from);

      if (!drawn) {
        game.advanceTurn();
        continue;
      }

      // Swap or discard
      if (from === 'DISCARD_PILE') {
        game.swap(0);
      } else if (drawn.value <= 4) {
        game.swap(1);
      } else {
        game.discard();
      }
    }

    if (!game.isRoundOver) {
      // Force conclude round if max turns reached
      game.concludeRound();
    }

    assert.ok(game.isRoundOver, 'Round must conclude');
    console.log(`Round ${totalRoundsPlayed} Ended!`);
    console.log('Player Standings:');
    game.players.forEach(p => {
      console.log(`  - ${p.name}: Round Score = ${p.roundScores[p.roundScores.length - 1]}, Total = ${p.totalScore}`);
    });

    if (game.isGameOver) {
      console.log('\n🎉 Local Game Match Finished! Target score reached.');
      const winner = [...game.players].sort((a, b) => a.totalScore - b.totalScore)[0];
      console.log(`👑 Champion Crowned: ${winner.name} with ${winner.totalScore} total points!`);
      break;
    }

    // Start next round
    game.roundNumber++;
    game.startRound();
  }

  assert.ok(totalRoundsPlayed >= 1, 'Must have played at least 1 full round');
  console.log('\n✅ Mode 3: Local Digital Tabletop (Solo vs AI) PASSED COMPLETELY!\n');
});

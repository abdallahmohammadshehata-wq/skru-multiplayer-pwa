import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/engine/game.js';
import { createDeck } from '../src/engine/deck.js';

test('Deck generation distributions', () => {
  const classicDeck = createDeck('CLASSIC');
  assert.equal(classicDeck.length, 68, 'Classic Egyptian deck must have exactly 68 cards');

  const frenchDeck = createDeck('FRENCH_DECK');
  assert.equal(frenchDeck.length, 52, 'French variant deck must have 52 cards');

  const deluxeDeck = createDeck('DELUXE');
  assert.equal(deluxeDeck.length, 74, 'Deluxe variant must contain extra Freeze, Bomb, Wild cards');

  // Verify action cards presence
  const peekOwn = classicDeck.filter(c => c.action === 'PEEK_OWN');
  assert.equal(peekOwn.length, 8, 'Must have 8 Peek Own (7 & 8) cards');

  const peekOther = classicDeck.filter(c => c.action === 'PEEK_OTHER');
  assert.equal(peekOther.length, 8, 'Must have 8 Peek Other (9 & 10) cards');

  const swaps = classicDeck.filter(c => c.action === 'SWAP');
  assert.equal(swaps.length, 6, 'Must have 6 Swap (هات وخد) cards');
});

test('Round dealing and Anti-Cheat Sanitization', () => {
  const players = [
    { id: 'p1', name: 'Ziad', avatar: '🦁', hand: [], isFrozen: false, connected: true, lastSeen: Date.now(), totalScore: 0, roundScores: [], hasCalledSkru: false, isHost: true },
    { id: 'p2', name: 'Nour', avatar: '🦊', hand: [], isFrozen: false, connected: true, lastSeen: Date.now(), totalScore: 0, roundScores: [], hasCalledSkru: false, isHost: false }
  ];

  const engine = new GameEngine('SKRU-TEST', players, 'CLASSIC', 100, 20);
  engine.startRound();

  assert.equal(engine.state.status, 'INITIAL_PEEK');
  assert.equal(players[0].hand.length, 4, 'Player 1 must receive 4 cards');
  assert.equal(players[1].hand.length, 4, 'Player 2 must receive 4 cards');
  assert.equal(engine.state.discardPile.length, 1, 'Discard pile starts with 1 flipped card');

  // Test anti-cheat sanitization:
  // For Player 1: Opponent (Player 2) cards MUST NOT contain value or action!
  const sanitizedForP1 = engine.getSanitizedState('p1');
  const sanitizedP2 = sanitizedForP1.players.find(p => p.id === 'p2');
  assert.ok(sanitizedP2, 'Sanitized player 2 exists');
  for (const card of sanitizedP2.hand) {
    assert.equal(card.value, undefined, 'Opponent hidden card values MUST NOT be leaked!');
    assert.equal(card.action, undefined, 'Opponent hidden card actions MUST NOT be leaked!');
  }
});

test('Match Slap (التشابه) Mechanics', () => {
  const players = [
    { id: 'p1', name: 'Player1', avatar: '🦁', hand: [], isFrozen: false, connected: true, lastSeen: Date.now(), totalScore: 0, roundScores: [], hasCalledSkru: false, isHost: true },
    { id: 'p2', name: 'Player2', avatar: '🦊', hand: [], isFrozen: false, connected: true, lastSeen: Date.now(), totalScore: 0, roundScores: [], hasCalledSkru: false, isHost: false }
  ];

  const engine = new GameEngine('SKRU-TEST', players, 'CLASSIC', 100, 20);
  engine.startRound();
  engine.state.status = 'PLAYING';

  // Set known top discard
  engine.state.discardPile = [{ id: 'd1', value: 5, action: 'NONE', labelAr: '5', labelEn: '5', color: 'emerald', isFaceUp: true }];
  
  // Set player 1 hand to [Card(value: 5), Card(value: 9)]
  players[0].hand = [
    { id: 'c1', value: 5, action: 'NONE', labelAr: '5', labelEn: '5', color: 'emerald', isFaceUp: false },
    { id: 'c2', value: 9, action: 'PEEK_OTHER', labelAr: '9', labelEn: '9', color: 'amber', isFaceUp: false }
  ];

  // Correct match slap
  const matchResult = engine.matchSlap('p1', 0);
  assert.equal(matchResult.isMatch, true, 'Match slap on matching 5 must succeed');
  assert.equal(players[0].hand.length, 1, 'Hand size should drop by 1 upon successful match slap');
  assert.equal(engine.state.discardPile[engine.state.discardPile.length - 1].value, 5);

  // Wrong match slap on 9 vs 5
  const wrongResult = engine.matchSlap('p1', 0);
  assert.equal(wrongResult.isMatch, false, 'Match slap on mismatched card must fail');
  assert.equal(players[0].hand.length, 2, 'Player should receive penalty card for wrong match slap');
});

test('Skru Call and Penalty Calculation', () => {
  const players = [
    { id: 'caller', name: 'Caller', avatar: '👑', hand: [], isFrozen: false, connected: true, lastSeen: Date.now(), totalScore: 0, roundScores: [], hasCalledSkru: false, isHost: true },
    { id: 'opponent', name: 'Opponent', avatar: '🎯', hand: [], isFrozen: false, connected: true, lastSeen: Date.now(), totalScore: 0, roundScores: [], hasCalledSkru: false, isHost: false }
  ];

  const engine = new GameEngine('SKRU-TEST', players, 'CLASSIC', 100, 20);
  engine.startRound();
  engine.state.status = 'PLAYING';

  // Case 1: Caller wins with lowest sum
  players[0].hand = [
    { id: 'c1', value: 0, action: 'NONE', labelAr: '0', labelEn: '0', color: 'gold', isFaceUp: false },
    { id: 'c2', value: 2, action: 'NONE', labelAr: '2', labelEn: '2', color: 'emerald', isFaceUp: false }
  ]; // Sum = 2

  players[1].hand = [
    { id: 'o1', value: 5, action: 'NONE', labelAr: '5', labelEn: '5', color: 'emerald', isFaceUp: false },
    { id: 'o2', value: 8, action: 'PEEK_OWN', labelAr: '8', labelEn: '8', color: 'purple', isFaceUp: false }
  ]; // Sum = 13

  engine.callSkru('caller');
  assert.equal(engine.state.skruCallerId, 'caller');
  
  // End round directly
  engine.endRound();
  assert.equal(players[0].roundScores[0], 0, 'Successful caller must get 0 points');
  assert.equal(players[1].roundScores[0], 13, 'Opponent gets their hand sum 13');

  // Case 2: Caller fails (someone else has lower or equal sum)
  players[0].hand = [
    { id: 'c1', value: 7, action: 'PEEK_OWN', labelAr: '7', labelEn: '7', color: 'purple', isFaceUp: false },
    { id: 'c2', value: 8, action: 'PEEK_OWN', labelAr: '8', labelEn: '8', color: 'purple', isFaceUp: false }
  ]; // Sum = 15
  players[1].hand = [
    { id: 'o1', value: 3, action: 'NONE', labelAr: '3', labelEn: '3', color: 'emerald', isFaceUp: false },
    { id: 'o2', value: 4, action: 'NONE', labelAr: '4', labelEn: '4', color: 'emerald', isFaceUp: false }
  ]; // Sum = 7

  engine.state.skruCallerId = 'caller';
  engine.endRound();
  // Caller penalty: 15 * 2 = 30
  assert.equal(players[0].roundScores[1], 30, 'Failed caller must receive double score penalty');
  assert.equal(players[1].roundScores[1], 7, 'Winner receives their hand sum 7');
});

test('2v2 Saheb Sa7bo Team Scoring', () => {
  const players = [
    { id: 'tA1', name: 'TeamA_1', avatar: '🦁', team: 'A', hand: [], isFrozen: false, connected: true, lastSeen: Date.now(), totalScore: 0, roundScores: [], hasCalledSkru: false, isHost: true },
    { id: 'tB1', name: 'TeamB_1', avatar: '🦊', team: 'B', hand: [], isFrozen: false, connected: true, lastSeen: Date.now(), totalScore: 0, roundScores: [], hasCalledSkru: false, isHost: false },
    { id: 'tA2', name: 'TeamA_2', avatar: '🐯', team: 'A', hand: [], isFrozen: false, connected: true, lastSeen: Date.now(), totalScore: 0, roundScores: [], hasCalledSkru: false, isHost: false },
    { id: 'tB2', name: 'TeamB_2', avatar: '🐺', team: 'B', hand: [], isFrozen: false, connected: true, lastSeen: Date.now(), totalScore: 0, roundScores: [], hasCalledSkru: false, isHost: false }
  ];

  const engine = new GameEngine('SKRU-2V2', players, 'SAHEB_SA7BO', 100, 20);
  engine.startRound();
  engine.state.status = 'PLAYING';

  // Team A sum = (2+1) + (3+0) = 6
  players[0].hand = [{ id: 'a1', value: 2, action: 'NONE', labelAr: '2', labelEn: '2', color: 'emerald', isFaceUp: false }, { id: 'a2', value: 1, action: 'NONE', labelAr: '1', labelEn: '1', color: 'emerald', isFaceUp: false }];
  players[2].hand = [{ id: 'a3', value: 3, action: 'NONE', labelAr: '3', labelEn: '3', color: 'emerald', isFaceUp: false }, { id: 'a4', value: 0, action: 'NONE', labelAr: '0', labelEn: '0', color: 'gold', isFaceUp: false }];

  // Team B sum = (5+6) + (4+5) = 20
  players[1].hand = [{ id: 'b1', value: 5, action: 'NONE', labelAr: '5', labelEn: '5', color: 'emerald', isFaceUp: false }, { id: 'b2', value: 6, action: 'NONE', labelAr: '6', labelEn: '6', color: 'emerald', isFaceUp: false }];
  players[3].hand = [{ id: 'b3', value: 4, action: 'NONE', labelAr: '4', labelEn: '4', color: 'emerald', isFaceUp: false }, { id: 'b4', value: 5, action: 'NONE', labelAr: '5', labelEn: '5', color: 'emerald', isFaceUp: false }];

  engine.endRound();

  // Winning team gets 0, losing team gets their hand scores
  assert.equal(players[0].roundScores[0], 0, 'Team A winning member gets 0');
  assert.equal(players[2].roundScores[0], 0, 'Team A winning member gets 0');
  assert.equal(players[1].roundScores[0], 11, 'Team B member gets hand score 11');
  assert.equal(players[3].roundScores[0], 9, 'Team B member gets hand score 9');
});

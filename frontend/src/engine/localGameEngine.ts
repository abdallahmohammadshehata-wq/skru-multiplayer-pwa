import { Card, GameVariant, Player } from '../types';

export interface LocalPlayer extends Player {
  isAi: boolean;
  knownCards: (number | null)[]; // what the player/bot knows about their hand
}

let cardCounter = 1;
function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${cardCounter++}`;
}

export function createLocalDeck(variant: GameVariant): Card[] {
  const cards: Card[] = [];
  // -1
  for (let i = 0; i < 4; i++) cards.push({ id: genId('n1'), value: -1, action: 'NONE', labelAr: '-1 سكرو', labelEn: '-1 Skru', color: 'crimson', isFaceUp: false });
  // 0
  for (let i = 0; i < 4; i++) cards.push({ id: genId('z0'), value: 0, action: 'NONE', labelAr: '0 صفر', labelEn: '0 Zero', color: 'gold', isFaceUp: false });
  // 1-6
  for (let v = 1; v <= 6; v++) {
    for (let i = 0; i < 4; i++) cards.push({ id: genId(`n_${v}`), value: v, action: 'NONE', labelAr: `${v}`, labelEn: `${v}`, color: 'emerald', isFaceUp: false });
  }
  // 7 & 8 Peek Own
  for (let v of [7, 8]) {
    for (let i = 0; i < 4; i++) cards.push({ id: genId(`po_${v}`), value: v, action: 'PEEK_OWN', labelAr: `${v} (خد فكرة)`, labelEn: `${v} (Peek Own)`, color: 'purple', isFaceUp: false });
  }
  // 9 & 10 Peek Other
  for (let v of [9, 10]) {
    for (let i = 0; i < 4; i++) cards.push({ id: genId(`poth_${v}`), value: v, action: 'PEEK_OTHER', labelAr: `${v} (بصرة)`, labelEn: `${v} (Peek Other)`, color: 'amber', isFaceUp: false });
  }
  // Swap
  for (let i = 0; i < 6; i++) cards.push({ id: genId('swap'), value: 11, action: 'SWAP', labelAr: 'هات وخد', labelEn: 'Swap', color: 'indigo', isFaceUp: false });
  // Peek & Swap
  for (let i = 0; i < 4; i++) cards.push({ id: genId('ps'), value: 12, action: 'PEEK_AND_SWAP', labelAr: 'خد وهات بصرة', labelEn: 'Peek & Swap', color: 'purple', isFaceUp: false });
  // Peek All
  for (let i = 0; i < 4; i++) cards.push({ id: genId('pa'), value: 12, action: 'PEEK_ALL', labelAr: 'كعب داير', labelEn: 'Peek All', color: 'gold', isFaceUp: false });
  // Penalty 20
  for (let i = 0; i < 6; i++) cards.push({ id: genId('p20'), value: 20, action: 'NONE', labelAr: '+20 غرامة', labelEn: '+20 Penalty', color: 'crimson', isFaceUp: false });

  // Shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export class LocalGameSession {
  public players: LocalPlayer[];
  public drawPile: Card[] = [];
  public discardPile: Card[] = [];
  public currentTurnIndex: number = 0;
  public drawnCard: Card | null = null;
  public drawnFrom: 'DRAW_PILE' | 'DISCARD_PILE' | null = null;
  public skruCallerIndex: number | null = null;
  public finalTurnsRemaining: number = 0;
  public roundNumber: number = 1;
  public isRoundOver: boolean = false;
  public isGameOver: boolean = false;
  public logs: { ar: string; en: string }[] = [];
  public variant: GameVariant;
  public pointsCap: number;
  public onStateChange?: () => void;

  constructor(playerConfigs: Array<{ name: string; avatar: string; isAi: boolean }>, variant: GameVariant = 'CLASSIC', pointsCap: number = 100) {
    this.variant = variant;
    this.pointsCap = pointsCap;
    this.players = playerConfigs.map((cfg, idx) => ({
      id: `local_p_${idx}`,
      name: cfg.name,
      avatar: cfg.avatar,
      isAi: cfg.isAi,
      hand: [],
      knownCards: [null, null, null, null],
      isFrozen: false,
      connected: true,
      lastSeen: Date.now(),
      totalScore: 0,
      roundScores: [],
      hasCalledSkru: false,
      isHost: idx === 0
    }));

    this.startRound();
  }

  public startRound(): void {
    const deck = createLocalDeck(this.variant);
    this.isRoundOver = false;
    this.skruCallerIndex = null;
    this.finalTurnsRemaining = 0;
    this.drawnCard = null;
    this.drawnFrom = null;

    // Deal 4 cards to each
    for (const player of this.players) {
      player.hand = [];
      player.hasCalledSkru = false;
      player.isFrozen = false;
      player.knownCards = [null, null, null, null];
      for (let i = 0; i < 4; i++) {
        const c = deck.pop()!;
        c.isFaceUp = false;
        player.hand.push(c);
      }
      // Reveal bottom 2 to player's memory
      player.knownCards[2] = player.hand[2].value;
      player.knownCards[3] = player.hand[3].value;
    }

    const firstDiscard = deck.pop()!;
    firstDiscard.isFaceUp = true;
    this.discardPile = [firstDiscard];
    this.drawPile = deck;

    this.currentTurnIndex = 0;
    this.addLog(`بدأت الجولة ${this.roundNumber}!`, `Round ${this.roundNumber} started!`);
  }

  public draw(from: 'DRAW_PILE' | 'DISCARD_PILE'): Card | null {
    if (this.drawnCard) return null;
    if (from === 'DISCARD_PILE') {
      if (this.discardPile.length === 0) return null;
      this.drawnCard = this.discardPile.pop()!;
      this.drawnFrom = 'DISCARD_PILE';
    } else {
      if (this.drawPile.length === 0) {
        if (this.discardPile.length > 1) {
          const top = this.discardPile.pop()!;
          this.drawPile = this.discardPile.map(c => ({ ...c, isFaceUp: false }));
          this.discardPile = [top];
        } else {
          return null;
        }
      }
      this.drawnCard = this.drawPile.pop()!;
      this.drawnFrom = 'DRAW_PILE';
    }
    return this.drawnCard;
  }

  public swap(handIndex: number): void {
    if (!this.drawnCard) return;
    const player = this.players[this.currentTurnIndex];
    const old = player.hand[handIndex];
    old.isFaceUp = true;
    this.discardPile.push(old);

    player.hand[handIndex] = { ...this.drawnCard, isFaceUp: false };
    player.knownCards[handIndex] = this.drawnCard.value;

    this.drawnCard = null;
    this.drawnFrom = null;
    this.advanceTurn();
  }

  public discard(): void {
    if (!this.drawnCard || this.drawnFrom === 'DISCARD_PILE') return;
    const card = this.drawnCard;
    card.isFaceUp = true;
    this.discardPile.push(card);
    this.drawnCard = null;
    this.drawnFrom = null;
    this.advanceTurn();
  }

  public callSkru(): boolean {
    if (this.skruCallerIndex !== null || this.drawnCard !== null) return false;
    this.skruCallerIndex = this.currentTurnIndex;
    this.players[this.currentTurnIndex].hasCalledSkru = true;
    this.finalTurnsRemaining = this.players.length - 1;

    const caller = this.players[this.currentTurnIndex];
    this.addLog(`سكرووو! أعلن ${caller.name} سكرو!`, `SKRU! ${caller.name} called Skru!`);
    this.advanceTurn();
    return true;
  }

  public matchSlap(playerIndex: number, handIndex: number): { isMatch: boolean; message: string } {
    if (this.discardPile.length === 0) return { isMatch: false, message: 'Empty discard pile' };
    const player = this.players[playerIndex];
    const top = this.discardPile[this.discardPile.length - 1];
    const card = player.hand[handIndex];

    if (card.value === top.value) {
      player.hand.splice(handIndex, 1);
      player.knownCards.splice(handIndex, 1);
      card.isFaceUp = true;
      this.discardPile.push(card);
      this.addLog(`تشابه صحيح بواسطة ${player.name}! تخلص من كارت!`, `Correct match by ${player.name}!`);
      return { isMatch: true, message: 'Match drop success!' };
    } else {
      if (this.drawPile.length > 0) {
        const penalty = this.drawPile.pop()!;
        penalty.isFaceUp = false;
        player.hand.push(penalty);
        player.knownCards.push(null);
      }
      this.addLog(`تشابه خاطئ! تم معاقبة ${player.name} بكارت إضافي!`, `Wrong match by ${player.name}!`);
      return { isMatch: false, message: 'Wrong match penalty!' };
    }
  }

  public advanceTurn(): void {
    if (this.skruCallerIndex !== null && this.currentTurnIndex !== this.skruCallerIndex) {
      this.finalTurnsRemaining -= 1;
      if (this.finalTurnsRemaining <= 0) {
        this.concludeRound();
        return;
      }
    }

    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;

    // If current player is AI, trigger auto play
    if (this.players[this.currentTurnIndex].isAi && !this.isRoundOver) {
      setTimeout(() => this.runAiTurn(), 700);
    }
  }

  private runAiTurn(): void {
    if (this.isRoundOver) return;
    const bot = this.players[this.currentTurnIndex];
    const topDiscard = this.discardPile[this.discardPile.length - 1];

    // 1. Should bot call Skru?
    const knownSum = bot.knownCards.reduce((acc: number, v: number | null) => acc + (v ?? 6), 0);
    if (this.skruCallerIndex === null && knownSum <= 6 && Math.random() > 0.3) {
      this.callSkru();
      return;
    }

    // 2. Take discard pile if valuable (e.g. <= 3)
    if (topDiscard && topDiscard.value <= 3) {
      // Find highest known card to swap
      let maxIdx = 0;
      let maxVal = -99;
      bot.knownCards.forEach((v, idx) => {
        const val = v ?? 7;
        if (val > maxVal) {
          maxVal = val;
          maxIdx = idx;
        }
      });

      if (maxVal > topDiscard.value) {
        this.draw('DISCARD_PILE');
        setTimeout(() => this.swap(maxIdx), 400);
        return;
      }
    }

    // 3. Otherwise draw from Draw Pile
    const drawn = this.draw('DRAW_PILE');
    if (!drawn) {
      this.advanceTurn();
      return;
    }

    setTimeout(() => {
      // If drawn is low, swap with highest known card
      let maxIdx = 0;
      let maxVal = -99;
      bot.knownCards.forEach((v, idx) => {
        const val = v ?? 7;
        if (val > maxVal) {
          maxVal = val;
          maxIdx = idx;
        }
      });

      if (drawn.value <= 5 && drawn.value < maxVal) {
        this.swap(maxIdx);
      } else {
        // Discard
        this.discard();
      }
    }, 450);
  }

  public concludeRound(): void {
    this.isRoundOver = true;
    for (const player of this.players) {
      for (const card of player.hand) {
        card.isFaceUp = true;
      }
    }

    const sums = this.players.map(p => p.hand.reduce((acc: number, c: Card) => acc + c.value, 0));
    const minSum = Math.min(...sums);

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      let roundPts = sums[i];

      if (i === this.skruCallerIndex) {
        if (sums[i] === minSum && sums.filter(s => s === minSum).length === 1) {
          roundPts = 0; // Caller won!
        } else {
          roundPts = Math.max(sums[i] * 2, 30); // Double penalty
        }
      }

      p.roundScores.push(roundPts);
      p.totalScore += roundPts;
    }

    const maxScore = Math.max(...this.players.map(p => p.totalScore));
    if (maxScore >= this.pointsCap) {
      this.isGameOver = true;
    }
  }

  private addLog(ar: string, en: string) {
    this.logs.push({ ar, en });
    if (this.logs.length > 20) this.logs.shift();
    if (this.onStateChange) this.onStateChange();
  }
}

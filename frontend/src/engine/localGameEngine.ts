import { Card, CardAction, GameVariant, Player } from '../types';

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

  if (variant === 'FRENCH_DECK') {
    // Standard 52-card French deck adapted for Skru:
    // Red Kings (Hearts, Diamonds) = 0 points (Zero Skru)
    cards.push({ id: genId('k_red_h'), value: 0, action: 'NONE', labelAr: '0 كينج أحمر', labelEn: '0 Red K♥', color: 'crimson', isFaceUp: false });
    cards.push({ id: genId('k_red_d'), value: 0, action: 'NONE', labelAr: '0 كينج أحمر', labelEn: '0 Red K♦', color: 'crimson', isFaceUp: false });
    // Black Kings (Spades, Clubs) = 13 points
    cards.push({ id: genId('k_blk_s'), value: 13, action: 'NONE', labelAr: '13 كينج أسود', labelEn: '13 Black K♠', color: 'indigo', isFaceUp: false });
    cards.push({ id: genId('k_blk_c'), value: 13, action: 'NONE', labelAr: '13 كينج أسود', labelEn: '13 Black K♣', color: 'indigo', isFaceUp: false });

    // Aces = 1 point
    for (const suit of ['♠', '♥', '♦', '♣']) {
      cards.push({ id: genId(`ace_${suit}`), value: 1, action: 'NONE', labelAr: '1 آس', labelEn: `1 A${suit}`, color: 'emerald', isFaceUp: false });
    }
    // 2 through 6 = standard numbers
    for (let v = 2; v <= 6; v++) {
      for (const suit of ['♠', '♥', '♦', '♣']) {
        cards.push({ id: genId(`card_${v}_${suit}`), value: v, action: 'NONE', labelAr: `${v}`, labelEn: `${v}${suit}`, color: 'emerald', isFaceUp: false });
      }
    }
    // 7 & 8 = Peek Own
    for (const v of [7, 8]) {
      for (const suit of ['♠', '♥', '♦', '♣']) {
        cards.push({ id: genId(`po_${v}_${suit}`), value: v, action: 'PEEK_OWN', labelAr: `${v} (خد فكرة)`, labelEn: `${v}${suit} (Peek Own)`, color: 'purple', isFaceUp: false });
      }
    }
    // 9 & 10 = Peek Other
    for (const v of [9, 10]) {
      for (const suit of ['♠', '♥', '♦', '♣']) {
        cards.push({ id: genId(`poth_${v}_${suit}`), value: v, action: 'PEEK_OTHER', labelAr: `${v} (بصرة)`, labelEn: `${v}${suit} (Peek Other)`, color: 'amber', isFaceUp: false });
      }
    }
    // Jacks (11) = Swap
    for (const suit of ['♠', '♥', '♦', '♣']) {
      cards.push({ id: genId(`j_${suit}`), value: 11, action: 'SWAP', labelAr: 'ولد (هات وخد)', labelEn: `J${suit} (Swap)`, color: 'indigo', isFaceUp: false });
    }
    // Queens (12) = Peek & Swap
    for (const suit of ['♠', '♥', '♦', '♣']) {
      cards.push({ id: genId(`q_${suit}`), value: 12, action: 'PEEK_AND_SWAP', labelAr: 'بنت (خد وهات)', labelEn: `Q${suit} (Peek & Swap)`, color: 'purple', isFaceUp: false });
    }
  } else {
    // CLASSIC, SAHEB_SA7BO, and DELUXE
    // -1 Skru (4 cards)
    for (let i = 0; i < 4; i++) cards.push({ id: genId('n1'), value: -1, action: 'NONE', labelAr: '-1 سكرو', labelEn: '-1 Skru', color: 'crimson', isFaceUp: false });
    // 0 Zero (4 cards)
    for (let i = 0; i < 4; i++) cards.push({ id: genId('z0'), value: 0, action: 'NONE', labelAr: '0 صفر', labelEn: '0 Zero', color: 'gold', isFaceUp: false });
    // 1-6 Numbers
    for (let v = 1; v <= 6; v++) {
      for (let i = 0; i < 4; i++) cards.push({ id: genId(`n_${v}`), value: v, action: 'NONE', labelAr: `${v}`, labelEn: `${v}`, color: 'emerald', isFaceUp: false });
    }
    // 7 & 8 Peek Own
    for (const v of [7, 8]) {
      for (let i = 0; i < 4; i++) cards.push({ id: genId(`po_${v}`), value: v, action: 'PEEK_OWN', labelAr: `${v} (خد فكرة)`, labelEn: `${v} (Peek Own)`, color: 'purple', isFaceUp: false });
    }
    // 9 & 10 Peek Other
    for (const v of [9, 10]) {
      for (let i = 0; i < 4; i++) cards.push({ id: genId(`poth_${v}`), value: v, action: 'PEEK_OTHER', labelAr: `${v} (بصرة)`, labelEn: `${v} (Peek Other)`, color: 'amber', isFaceUp: false });
    }
    // Swap (Value 11)
    for (let i = 0; i < 6; i++) cards.push({ id: genId('swap'), value: 11, action: 'SWAP', labelAr: 'هات وخد', labelEn: 'Swap', color: 'indigo', isFaceUp: false });
    // Peek & Swap (Value 12)
    for (let i = 0; i < 4; i++) cards.push({ id: genId('ps'), value: 12, action: 'PEEK_AND_SWAP', labelAr: 'خد وهات بصرة', labelEn: 'Peek & Swap', color: 'purple', isFaceUp: false });
    // Peek All (Value 12)
    for (let i = 0; i < 4; i++) cards.push({ id: genId('pa'), value: 12, action: 'PEEK_ALL', labelAr: 'كعب داير', labelEn: 'Peek All', color: 'gold', isFaceUp: false });
    // Penalty 20 (6 cards)
    for (let i = 0; i < 6; i++) cards.push({ id: genId('p20'), value: 20, action: 'NONE', labelAr: '+20 غرامة', labelEn: '+20 Penalty', color: 'crimson', isFaceUp: false });

    // DELUXE specific extra cards
    if (variant === 'DELUXE') {
      // Freeze (Value 10)
      for (let i = 0; i < 3; i++) cards.push({ id: genId('frz'), value: 10, action: 'FREEZE', labelAr: 'تجميد دور ❄️', labelEn: 'Freeze Turn ❄️', color: 'indigo', isFaceUp: false });
      // Bomb +25 (Value 25)
      for (let i = 0; i < 3; i++) cards.push({ id: genId('bmb'), value: 25, action: 'BOMB', labelAr: '+25 قنبلة 💣', labelEn: '+25 Bomb 💣', color: 'crimson', isFaceUp: false });
    }
  }

  // Shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export interface PendingAction {
  type: CardAction;
  playerIndex: number;
  stage?: 'SELECT_TARGET' | 'CHOOSE_SWAP';
  targetPlayerIndex?: number;
  targetCardIndex?: number;
  revealedCard?: Card;
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
  public pendingAction: PendingAction | null = null;
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
    this.pendingAction = null;

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
    if (this.drawnCard || this.pendingAction) return null;
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
    if (!this.drawnCard || this.pendingAction) return;
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
    if (!this.drawnCard || this.drawnFrom === 'DISCARD_PILE' || this.pendingAction) return;
    const card = this.drawnCard;
    card.isFaceUp = true;
    this.discardPile.push(card);
    this.drawnCard = null;
    this.drawnFrom = null;

    // Check if discarded card has a special action
    if (card.action && card.action !== 'NONE') {
      const player = this.players[this.currentTurnIndex];
      if (!player.isAi) {
        // Human player: activate interactive pending action
        this.pendingAction = {
          type: card.action,
          playerIndex: this.currentTurnIndex,
          stage: 'SELECT_TARGET'
        };
        this.addLog(`تم تفعيل قدرة (${card.labelAr})! اضغط على الكارت المطلوب لتنفيذ الحركة.`, `Special action (${card.labelEn}) activated! Tap target card.`);
        if (this.onStateChange) this.onStateChange();
        return;
      } else {
        // AI player: execute action immediately
        this.executeAiAction(card.action);
        return;
      }
    }

    this.advanceTurn();
  }

  public executeAction(payload: {
    ownCardIndex?: number;
    targetPlayerIndex?: number;
    targetCardIndex?: number;
    chooseSwap?: boolean;
    myCardIndex?: number;
    skip?: boolean;
  }): { success: boolean; revealedCard?: Card; allRevealedCards?: Array<{ playerName: string; avatar?: string; card: Card; isOwn: boolean }>; message?: string } {
    if (!this.pendingAction) return { success: false, message: 'No pending action' };

    if (payload.skip) {
      const player = this.players[this.pendingAction.playerIndex];
      this.addLog(`تخطى ${player.name} استخدام قدرة الكارت الخاص.`, `${player.name} skipped the special card action.`);
      this.pendingAction = null;
      this.advanceTurn();
      return { success: true };
    }

    const actionType = this.pendingAction.type;
    const player = this.players[this.pendingAction.playerIndex];

    switch (actionType) {
      case 'PEEK_OWN': {
        const ownIdx = payload.ownCardIndex ?? payload.myCardIndex;
        if (ownIdx !== undefined && player.hand[ownIdx]) {
          const card = player.hand[ownIdx];
          player.knownCards[ownIdx] = card.value;
          this.addLog(`كشف ${player.name} كارت من كروته الخاصة.`, `${player.name} peeked at their own card.`);
          this.pendingAction = null;
          this.advanceTurn();
          return { success: true, revealedCard: { ...card, isFaceUp: true } };
        }
        break;
      }

      case 'PEEK_OTHER': {
        const targetIdx = payload.targetPlayerIndex ?? 1;
        const targetPlayer = this.players[targetIdx];
        if (targetPlayer && payload.targetCardIndex !== undefined && targetPlayer.hand[payload.targetCardIndex]) {
          const card = targetPlayer.hand[payload.targetCardIndex];
          this.addLog(`كشف ${player.name} كارت من أوراق ${targetPlayer.name} (بصرة).`, `${player.name} peeked at a card from ${targetPlayer.name}.`);
          this.pendingAction = null;
          this.advanceTurn();
          return { success: true, revealedCard: { ...card, isFaceUp: true } };
        }
        break;
      }

      case 'SWAP': {
        const targetIdx = payload.targetPlayerIndex ?? 1;
        const targetPlayer = this.players[targetIdx];
        const myIdx = payload.myCardIndex ?? payload.ownCardIndex;
        if (
          targetPlayer &&
          myIdx !== undefined &&
          payload.targetCardIndex !== undefined &&
          player.hand[myIdx] &&
          targetPlayer.hand[payload.targetCardIndex]
        ) {
          const myCard = player.hand[myIdx];
          const oppCard = targetPlayer.hand[payload.targetCardIndex];

          player.hand[myIdx] = oppCard;
          targetPlayer.hand[payload.targetCardIndex] = myCard;

          player.knownCards[myIdx] = null;
          targetPlayer.knownCards[payload.targetCardIndex] = null;

          this.addLog(`بدّل ${player.name} كارت مع ${targetPlayer.name} (هات وخد).`, `${player.name} swapped a card with ${targetPlayer.name}.`);
          this.pendingAction = null;
          this.advanceTurn();
          return { success: true };
        }
        break;
      }

      case 'PEEK_AND_SWAP': {
        const targetIdx = payload.targetPlayerIndex ?? this.pendingAction.targetPlayerIndex ?? 1;
        const targetPlayer = this.players[targetIdx];
        if (this.pendingAction.stage === 'SELECT_TARGET') {
          if (targetPlayer && payload.targetCardIndex !== undefined && targetPlayer.hand[payload.targetCardIndex]) {
            const card = targetPlayer.hand[payload.targetCardIndex];
            this.pendingAction.stage = 'CHOOSE_SWAP';
            this.pendingAction.targetPlayerIndex = targetIdx;
            this.pendingAction.targetCardIndex = payload.targetCardIndex;
            this.pendingAction.revealedCard = card;
            if (this.onStateChange) this.onStateChange();
            return { success: true, revealedCard: { ...card, isFaceUp: true } };
          }
        } else if (this.pendingAction.stage === 'CHOOSE_SWAP') {
          const myIdx = payload.myCardIndex ?? payload.ownCardIndex;
          const targetCardIdx = this.pendingAction.targetCardIndex;
          if (payload.chooseSwap && myIdx !== undefined && targetCardIdx !== undefined && targetPlayer && targetPlayer.hand[targetCardIdx] && player.hand[myIdx]) {
            const myCard = player.hand[myIdx];
            const oppCard = targetPlayer.hand[targetCardIdx];

            player.hand[myIdx] = oppCard;
            targetPlayer.hand[targetCardIdx] = myCard;

            player.knownCards[myIdx] = oppCard.value;
            targetPlayer.knownCards[targetCardIdx] = null;

            this.addLog(`اختار ${player.name} تبديل الكارت بعد رؤيته مع ${targetPlayer.name}!`, `${player.name} swapped after peeking with ${targetPlayer.name}!`);
          } else {
            this.addLog(`قرر ${player.name} عدم تبديل الكارت والاحتفاظ بكروته.`, `${player.name} decided not to swap.`);
          }
          this.pendingAction = null;
          this.advanceTurn();
          return { success: true };
        }
        break;
      }

      case 'FREEZE': {
        const targetIdx = payload.targetPlayerIndex ?? 1;
        const targetPlayer = this.players[targetIdx];
        if (targetPlayer) {
          targetPlayer.isFrozen = true;
          this.addLog(`تم تجميد دور ${targetPlayer.name} ❄️!`, `${targetPlayer.name} has been frozen ❄️!`);
          this.pendingAction = null;
          this.advanceTurn();
          return { success: true };
        }
        break;
      }

      case 'BOMB': {
        const targetIdx = payload.targetPlayerIndex ?? 1;
        const targetPlayer = this.players[targetIdx];
        if (targetPlayer) {
          if (this.drawPile.length > 0) {
            const penalty = this.drawPile.pop()!;
            penalty.isFaceUp = false;
            targetPlayer.hand.push(penalty);
            targetPlayer.knownCards.push(null);
          }
          this.addLog(`انفجرت القنبلة 💣 في ${targetPlayer.name} وأخذ كارت غرامة!`, `Bomb exploded on ${targetPlayer.name}!`);
          this.pendingAction = null;
          this.advanceTurn();
          return { success: true };
        }
        break;
      }

      case 'PEEK_ALL': {
        const allRevealedCards: Array<{ playerName: string; avatar?: string; card: Card; isOwn: boolean }> = [];
        const ownIdx = payload.ownCardIndex ?? payload.myCardIndex ?? 0;
        if (player.hand[ownIdx]) {
          player.knownCards[ownIdx] = player.hand[ownIdx].value;
          allRevealedCards.push({
            playerName: player.name,
            avatar: player.avatar,
            card: { ...player.hand[ownIdx], isFaceUp: true },
            isOwn: true
          });
        }

        this.players.forEach((opp, idx) => {
          if (idx !== this.pendingAction!.playerIndex && opp.hand.length > 0) {
            let oppCardIdx = Math.floor(Math.random() * opp.hand.length);
            if (payload.targetPlayerIndex === idx && payload.targetCardIndex !== undefined && opp.hand[payload.targetCardIndex]) {
              oppCardIdx = payload.targetCardIndex;
            }
            allRevealedCards.push({
              playerName: opp.name,
              avatar: opp.avatar,
              card: { ...opp.hand[oppCardIdx], isFaceUp: true },
              isOwn: false
            });
          }
        });

        this.addLog(`استخدم ${player.name} كارت (كعب داير) وكشف كروت الطاولة!`, `${player.name} used Peek All (Ka'ab Dayer)!`);
        this.pendingAction = null;
        this.advanceTurn();
        return { success: true, allRevealedCards };
      }

      default:
        break;
    }

    return { success: false, message: 'Invalid action execution' };
  }

  public skipAction(): void {
    if (!this.pendingAction) return;
    this.addLog(`تم تخطي قدرة الكارت.`, `Action skipped.`);
    this.pendingAction = null;
    this.advanceTurn();
  }

  private executeAiAction(action: CardAction): void {
    const bot = this.players[this.currentTurnIndex];
    if (action === 'PEEK_OWN') {
      // Find unknown card in bot's hand
      let unkIdx = bot.knownCards.findIndex(v => v === null);
      if (unkIdx === -1) unkIdx = 0;
      if (bot.hand[unkIdx]) {
        bot.knownCards[unkIdx] = bot.hand[unkIdx].value;
        this.addLog(`كشف ${bot.name} أحد كروته سراً.`, `${bot.name} peeked at their own card.`);
      }
    } else if (action === 'PEEK_OTHER') {
      const opp = this.players.find((p, idx) => idx !== this.currentTurnIndex && p.hand.length > 0);
      if (opp) {
        this.addLog(`كشف ${bot.name} كارت من أوراق ${opp.name} (بصرة).`, `${bot.name} peeked at ${opp.name}'s card.`);
      }
    } else if (action === 'SWAP') {
      // Bot swaps highest known card (> 6) with human player (index 0)
      let maxIdx = 0;
      let maxVal = -99;
      bot.knownCards.forEach((v, idx) => {
        const val = v ?? 6;
        if (val > maxVal) {
          maxVal = val;
          maxIdx = idx;
        }
      });
      const targetOpp = this.players[0];
      if (targetOpp && targetOpp.hand.length > 0 && bot.hand[maxIdx]) {
        const oppCardIdx = Math.floor(Math.random() * targetOpp.hand.length);
        const myCard = bot.hand[maxIdx];
        const oppCard = targetOpp.hand[oppCardIdx];
        bot.hand[maxIdx] = oppCard;
        targetOpp.hand[oppCardIdx] = myCard;
        bot.knownCards[maxIdx] = null;
        targetOpp.knownCards[oppCardIdx] = null;
        this.addLog(`بدّل ${bot.name} كارت مع ${targetOpp.name} (هات وخد)!`, `${bot.name} swapped a card with ${targetOpp.name}!`);
      }
    } else if (action === 'PEEK_AND_SWAP') {
      const targetOpp = this.players[0];
      if (targetOpp && targetOpp.hand.length > 0) {
        const oppCardIdx = Math.floor(Math.random() * targetOpp.hand.length);
        const oppCard = targetOpp.hand[oppCardIdx];
        if (oppCard.value <= 4) {
          let maxIdx = 0;
          let maxVal = -99;
          bot.knownCards.forEach((v, idx) => {
            const val = v ?? 6;
            if (val > maxVal) {
              maxVal = val;
              maxIdx = idx;
            }
          });
          const myCard = bot.hand[maxIdx];
          bot.hand[maxIdx] = oppCard;
          targetOpp.hand[oppCardIdx] = myCard;
          bot.knownCards[maxIdx] = oppCard.value;
          targetOpp.knownCards[oppCardIdx] = null;
          this.addLog(`كشف ${bot.name} كارت ${targetOpp.name} وبدله بنجاح!`, `${bot.name} peeked & swapped with ${targetOpp.name}!`);
        } else {
          this.addLog(`كشف ${bot.name} كارت ${targetOpp.name} واحتفظ بكروته.`, `${bot.name} peeked and chose not to swap.`);
        }
      }
    } else if (action === 'FREEZE') {
      this.players[0].isFrozen = true;
      this.addLog(`جمّد ${bot.name} دور ${this.players[0].name} ❄️!`, `${bot.name} froze ${this.players[0].name}!`);
    } else if (action === 'BOMB') {
      if (this.drawPile.length > 0) {
        const penalty = this.drawPile.pop()!;
        penalty.isFaceUp = false;
        this.players[0].hand.push(penalty);
        this.players[0].knownCards.push(null);
      }
      this.addLog(`ألقى ${bot.name} قنبلة 💣 على ${this.players[0].name}!`, `${bot.name} bombed ${this.players[0].name}!`);
    }

    this.advanceTurn();
  }

  public callSkru(): boolean {
    if (this.skruCallerIndex !== null || this.drawnCard !== null || this.pendingAction) return false;
    this.skruCallerIndex = this.currentTurnIndex;
    this.players[this.currentTurnIndex].hasCalledSkru = true;
    this.finalTurnsRemaining = this.players.length - 1;

    const caller = this.players[this.currentTurnIndex];
    this.addLog(`سكرووو! أعلن ${caller.name} سكرو!`, `SKRU! ${caller.name} called Skru!`);
    this.advanceTurn();
    return true;
  }

  public matchSlap(playerIndex: number, handIndex: number): { isMatch: boolean; message: string; cardValue?: number; topValue?: number } {
    if (this.discardPile.length === 0) return { isMatch: false, message: 'Empty discard pile' };
    const player = this.players[playerIndex];
    if (!player || !player.hand[handIndex]) return { isMatch: false, message: 'Invalid card index' };

    const top = this.discardPile[this.discardPile.length - 1];
    const card = player.hand[handIndex];

    if (card.value === top.value) {
      player.hand.splice(handIndex, 1);
      player.knownCards.splice(handIndex, 1);
      card.isFaceUp = true;
      this.discardPile.push(card);
      this.addLog(`🎉 تشابه صحيح بواسطة ${player.name} (قيمة ${card.value})! تخلص من كارت!`, `🎉 Correct match by ${player.name} (${card.value})!`);

      if (player.hand.length === 0) {
        this.addLog(`🏆 أنهى ${player.name} جميع أوراقه بنجاح!`, `🏆 ${player.name} finished all their cards!`);
        this.concludeRound();
        return { isMatch: true, message: 'Match drop success - player finished hand!', cardValue: card.value, topValue: top.value };
      }

      if (this.onStateChange) this.onStateChange();
      return { isMatch: true, message: 'Match drop success!', cardValue: card.value, topValue: top.value };
    } else {
      if (this.drawPile.length > 0) {
        const penalty = this.drawPile.pop()!;
        penalty.isFaceUp = false;
        player.hand.push(penalty);
        player.knownCards.push(null);
      }
      this.addLog(`⚠️ تشابه خاطئ! كارت ${player.name} (${card.value}) لا يطابق الأرض (${top.value}) — كارت غرامة!`, `⚠️ Wrong match by ${player.name}! Card (${card.value}) vs (${top.value})`);
      if (this.onStateChange) this.onStateChange();
      return { isMatch: false, message: 'Wrong match penalty!', cardValue: card.value, topValue: top.value };
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

    // Skip frozen player
    if (this.players[this.currentTurnIndex].isFrozen) {
      this.players[this.currentTurnIndex].isFrozen = false;
      this.addLog(`تم فك تجميد ${this.players[this.currentTurnIndex].name} وتخطي دوره.`, `${this.players[this.currentTurnIndex].name} skipped frozen turn.`);
      this.advanceTurn();
      return;
    }

    if (this.onStateChange) this.onStateChange();

    // If current player is AI, trigger auto play
    if (this.players[this.currentTurnIndex].isAi && !this.isRoundOver) {
      setTimeout(() => this.runAiTurn(), 1200);
    }
  }

  private runAiTurn(): void {
    if (this.isRoundOver || this.pendingAction) return;
    const bot = this.players[this.currentTurnIndex];
    const topDiscard = this.discardPile[this.discardPile.length - 1];

    // 1. Should bot call Skru?
    const knownSum = bot.knownCards.reduce((acc: number, v: number | null) => acc + (v ?? 6), 0);
    if (this.skruCallerIndex === null && knownSum <= 5 && Math.random() > 0.3) {
      this.callSkru();
      return;
    }

    // 2. Take discard pile if valuable (e.g. <= 3)
    if (topDiscard && topDiscard.value <= 3) {
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

    if (this.onStateChange) this.onStateChange();
  }

  private addLog(ar: string, en: string) {
    this.logs.push({ ar, en });
    if (this.logs.length > 20) this.logs.shift();
  }
}

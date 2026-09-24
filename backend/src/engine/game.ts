import { 
  Card, 
  GameState, 
  Player, 
  SanitizedCard, 
  SanitizedGameState, 
  SanitizedPlayer, 
  GameVariant,
  PendingAction
} from '../models/types.js';
import { createDeck } from './deck.js';

export class GameEngine {
  public state: GameState;
  private turnTimeoutHandle: NodeJS.Timeout | null = null;
  private peekTimeoutHandle: NodeJS.Timeout | null = null;
  private onStateChange: (state: GameState) => void;

  constructor(
    roomCode: string, 
    players: Player[], 
    variant: GameVariant = 'CLASSIC', 
    pointsCap: number = 100,
    turnTimer: number = 20,
    onStateChange: (state: GameState) => void = () => {}
  ) {
    this.onStateChange = onStateChange;
    this.state = {
      roomCode,
      status: 'LOBBY',
      variant,
      pointsCap,
      turnTimer,
      players,
      spectators: [],
      currentTurnPlayerId: players[0]?.id || '',
      turnStartTime: Date.now(),
      discardPile: [],
      drawPile: [],
      drawnCard: null,
      drawnFrom: null,
      skruCallerId: null,
      finalTurnsRemaining: 0,
      pendingAction: null,
      initialPeekExpiresAt: null,
      roundNumber: 0,
      lastActionLog: null,
      matchSlapLocked: false
    };
  }

  /**
   * Starts a new round
   */
  public startRound(): void {
    const deck = createDeck(this.state.variant);
    this.state.roundNumber += 1;
    this.state.skruCallerId = null;
    this.state.finalTurnsRemaining = 0;
    this.state.pendingAction = null;
    this.state.drawnCard = null;
    this.state.drawnFrom = null;

    // Deal 4 cards face down to each player
    for (const player of this.state.players) {
      player.hand = [];
      player.hasCalledSkru = false;
      player.isFrozen = false;
      for (let i = 0; i < 4; i++) {
        const card = deck.pop();
        if (card) {
          card.isFaceUp = false;
          player.hand.push(card);
        }
      }
    }

    // Top card to discard pile
    const initialDiscard = deck.pop();
    if (initialDiscard) {
      initialDiscard.isFaceUp = true;
      this.state.discardPile = [initialDiscard];
    } else {
      this.state.discardPile = [];
    }

    this.state.drawPile = deck;

    // Initial Peek Phase: players get 7 seconds to peek at bottom 2 cards
    this.state.status = 'INITIAL_PEEK';
    this.state.initialPeekExpiresAt = Date.now() + 7000;
    this.state.lastActionLog = {
      ar: 'بدأت الجولة! احفظ كارتين من أوراقك السفلية الآن.',
      en: 'Round started! Peek & memorize your two bottom cards now.'
    };

    this.notify();

    this.initialPeekTimer = setTimeout(() => {
      this.skipInitialPeek();
    }, 7000);
  }

  private initialPeekTimer?: any;

  public skipInitialPeek(): void {
    if (this.state.status === 'INITIAL_PEEK') {
      if (this.initialPeekTimer) {
        clearTimeout(this.initialPeekTimer);
        this.initialPeekTimer = undefined;
      }
      this.state.status = 'PLAYING';
      this.state.initialPeekExpiresAt = null;
      this.state.currentTurnPlayerId = this.state.players[0].id;
      this.state.turnStartTime = Date.now();
      this.state.lastActionLog = {
        ar: `انتهى وقت الحفظ! دور اللاعب ${this.state.players[0].name}.`,
        en: `Initial peek ended! It is ${this.state.players[0].name}'s turn.`
      };
      this.resetTurnTimer();
      this.notify();
    }
  }

  /**
   * Current player draws a card
   */
  public drawCard(playerId: string, from: 'DRAW_PILE' | 'DISCARD_PILE'): { success: boolean; message?: string } {
    if (this.state.status !== 'PLAYING') return { success: false, message: 'Game not in active playing state.' };
    if (this.state.currentTurnPlayerId !== playerId) return { success: false, message: 'Not your turn.' };
    if (this.state.drawnCard !== null) return { success: false, message: 'Card already drawn for this turn.' };

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, message: 'Player not found.' };

    if (from === 'DISCARD_PILE') {
      if (this.state.discardPile.length === 0) return { success: false, message: 'Discard pile is empty.' };
      const card = this.state.discardPile.pop()!;
      this.state.drawnCard = card;
      this.state.drawnFrom = 'DISCARD_PILE';
      this.state.lastActionLog = {
        ar: `${player.name} سحب كارت من كومة الأرض.`,
        en: `${player.name} picked a card from the discard pile.`
      };
    } else {
      if (this.state.drawPile.length === 0) {
        // Reshuffle discard pile into draw pile if needed
        if (this.state.discardPile.length > 1) {
          const top = this.state.discardPile.pop()!;
          this.state.drawPile = this.state.discardPile.map(c => ({ ...c, isFaceUp: false }));
          this.state.discardPile = [top];
        } else {
          return { success: false, message: 'Draw pile exhausted.' };
        }
      }
      const card = this.state.drawPile.pop()!;
      this.state.drawnCard = card;
      this.state.drawnFrom = 'DRAW_PILE';
      this.state.lastActionLog = {
        ar: `${player.name} سحب كارت جديد من المخزن.`,
        en: `${player.name} drew a card from the draw pile.`
      };
    }

    this.notify();
    return { success: true };
  }

  /**
   * Swap drawn card with a card in player's hand
   */
  public swapDrawnCard(playerId: string, handIndex: number): { success: boolean; message?: string } {
    if (this.state.status !== 'PLAYING') return { success: false, message: 'Not in active turn.' };
    if (this.state.currentTurnPlayerId !== playerId) return { success: false, message: 'Not your turn.' };
    if (!this.state.drawnCard) return { success: false, message: 'Must draw a card before swapping.' };

    const player = this.getPlayer(playerId);
    if (!player || handIndex < 0 || handIndex >= player.hand.length) {
      return { success: false, message: 'Invalid hand card index.' };
    }

    const oldCard = player.hand[handIndex];
    oldCard.isFaceUp = true;
    this.state.discardPile.push(oldCard);

    // Place drawn card into hand (face down)
    const newCard = { ...this.state.drawnCard, isFaceUp: false };
    player.hand[handIndex] = newCard;

    this.state.lastActionLog = {
      ar: `${player.name} بدّل كارت في مكانه وألقى (${oldCard.labelAr}) في الأرض.`,
      en: `${player.name} swapped a hand card and discarded (${oldCard.labelEn}).`
    };

    this.state.drawnCard = null;
    this.state.drawnFrom = null;

    this.finishTurn();
    return { success: true };
  }

  /**
   * Discard drawn card directly (only allowed if drawn from DRAW_PILE)
   */
  public discardDrawnCard(playerId: string, triggerAction: boolean = true): { success: boolean; message?: string } {
    if (this.state.status !== 'PLAYING') return { success: false, message: 'Not in active turn.' };
    if (this.state.currentTurnPlayerId !== playerId) return { success: false, message: 'Not your turn.' };
    if (!this.state.drawnCard) return { success: false, message: 'No drawn card to discard.' };
    if (this.state.drawnFrom === 'DISCARD_PILE') {
      return { success: false, message: 'Cards taken from discard pile MUST be swapped with your hand.' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, message: 'Player not found.' };

    const discarded = this.state.drawnCard;
    discarded.isFaceUp = true;
    this.state.discardPile.push(discarded);
    this.state.drawnCard = null;
    this.state.drawnFrom = null;

    // Check if card has actionable effect and player chose to trigger it
    if (triggerAction && discarded.action !== 'NONE') {
      this.state.status = 'ACTION_PENDING';
      this.state.pendingAction = {
        type: discarded.action,
        initiatorId: playerId,
        expiresAt: Date.now() + 15000,
        stage: 'SELECT_TARGET'
      };

      this.state.lastActionLog = {
        ar: `${player.name} رمى كارت أكشن (${discarded.labelAr}) ويقوم بتنفيذه الآن!`,
        en: `${player.name} discarded action card (${discarded.labelEn}) and is activating it!`
      };

      this.clearTurnTimer();
      // Set action timeout safety
      this.peekTimeoutHandle = setTimeout(() => {
        if (this.state.status === 'ACTION_PENDING') {
          this.cancelPendingAction('Action timed out.');
        }
      }, 15000);

      this.notify();
      return { success: true };
    }

    this.state.lastActionLog = {
      ar: `${player.name} تخلص من كارت (${discarded.labelAr}) في الأرض.`,
      en: `${player.name} discarded (${discarded.labelEn}).`
    };

    this.finishTurn();
    return { success: true };
  }

  /**
   * Executes a pending action: Peek Own, Peek Other, Swap, Peek All, etc.
   */
  public executeAction(
    playerId: string, 
    payload: { targetPlayerId?: string; targetCardIndex?: number; ownCardIndex?: number; chooseSwap?: boolean }
  ): { success: boolean; peekData?: any; message?: string } {
    if (this.state.status !== 'ACTION_PENDING' || !this.state.pendingAction) {
      return { success: false, message: 'No action pending.' };
    }
    if (this.state.pendingAction.initiatorId !== playerId) {
      return { success: false, message: 'You are not the action initiator.' };
    }

    const action = this.state.pendingAction;
    const initiator = this.getPlayer(playerId);
    if (!initiator) return { success: false, message: 'Initiator not found.' };

    switch (action.type) {
      case 'PEEK_OWN': {
        const index = payload.ownCardIndex ?? 0;
        if (index < 0 || index >= initiator.hand.length) {
          return { success: false, message: 'Invalid card index.' };
        }
        const card = initiator.hand[index];
        this.finishActionAfterPeek([
          { playerId: initiator.id, cardIndex: index, card }
        ], `${initiator.name} استخدم (خد فكرة) على أحد كروته.`);
        return { success: true, peekData: { card, cardIndex: index } };
      }

      case 'PEEK_OTHER': {
        const targetId = payload.targetPlayerId;
        const targetPlayer = this.getPlayer(targetId || '');
        if (!targetPlayer || targetPlayer.id === playerId) {
          return { success: false, message: 'Must select an opponent.' };
        }
        const index = payload.targetCardIndex ?? 0;
        if (index < 0 || index >= targetPlayer.hand.length) {
          return { success: false, message: 'Invalid target card index.' };
        }
        const card = targetPlayer.hand[index];
        this.finishActionAfterPeek([
          { playerId: targetPlayer.id, cardIndex: index, card }
        ], `${initiator.name} بصّ على كارت عند ${targetPlayer.name}.`);
        return { success: true, peekData: { targetPlayerId: targetId, card, cardIndex: index } };
      }

      case 'SWAP': {
        const targetId = payload.targetPlayerId;
        const targetPlayer = this.getPlayer(targetId || '');
        if (!targetPlayer || targetPlayer.id === playerId) {
          return { success: false, message: 'Must select an opponent.' };
        }
        const ownIndex = payload.ownCardIndex ?? 0;
        const targetIndex = payload.targetCardIndex ?? 0;
        if (ownIndex < 0 || ownIndex >= initiator.hand.length || targetIndex < 0 || targetIndex >= targetPlayer.hand.length) {
          return { success: false, message: 'Invalid indices for swap.' };
        }

        // Blind swap
        const temp = initiator.hand[ownIndex];
        initiator.hand[ownIndex] = targetPlayer.hand[targetIndex];
        targetPlayer.hand[targetIndex] = temp;

        this.state.lastActionLog = {
          ar: `${initiator.name} قام بتبديل كارت مع ${targetPlayer.name} (هات وخد).`,
          en: `${initiator.name} performed a blind swap with ${targetPlayer.name}.`
        };

        this.completeAction();
        return { success: true };
      }

      case 'PEEK_AND_SWAP': {
        if (action.stage === 'SELECT_TARGET') {
          const targetId = payload.targetPlayerId;
          const targetPlayer = this.getPlayer(targetId || '');
          if (!targetPlayer || targetPlayer.id === playerId) {
            return { success: false, message: 'Must select an opponent.' };
          }
          const targetIndex = payload.targetCardIndex ?? 0;
          if (targetIndex < 0 || targetIndex >= targetPlayer.hand.length) {
            return { success: false, message: 'Invalid card index.' };
          }
          const card = targetPlayer.hand[targetIndex];
          action.targetPlayerId = targetId;
          action.targetCardIndex = targetIndex;
          action.stage = 'CHOOSE_SWAP';
          this.notify();
          return { success: true, peekData: { card, targetPlayerId: targetId, targetCardIndex: targetIndex, requireSwapChoice: true } };
        } else if (action.stage === 'CHOOSE_SWAP') {
          if (payload.chooseSwap) {
            const targetPlayer = this.getPlayer(action.targetPlayerId || '');
            const ownIndex = payload.ownCardIndex ?? 0;
            if (targetPlayer && ownIndex >= 0 && ownIndex < initiator.hand.length) {
              const temp = initiator.hand[ownIndex];
              initiator.hand[ownIndex] = targetPlayer.hand[action.targetCardIndex!];
              targetPlayer.hand[action.targetCardIndex!] = temp;
              this.state.lastActionLog = {
                ar: `${initiator.name} رأى كارت ${targetPlayer.name} وقرر تبديله!`,
                en: `${initiator.name} peeked at ${targetPlayer.name}'s card and chose to swap it!`
              };
            }
          } else {
            this.state.lastActionLog = {
              ar: `${initiator.name} رأى كارت الخصم وقرر عدم التبديل.`,
              en: `${initiator.name} peeked and decided not to swap.`
            };
          }
          this.completeAction();
          return { success: true };
        }
        break;
      }

      case 'PEEK_ALL': {
        const peekCards: any[] = [];
        for (const p of this.state.players) {
          if (p.hand.length > 0) {
            const idx = 0; // peek first card of each
            peekCards.push({ playerId: p.id, cardIndex: idx, card: p.hand[idx] });
          }
        }
        this.finishActionAfterPeek(peekCards, `${initiator.name} لعب (كعب داير) وشاف كارت من كل لاعب!`);
        return { success: true, peekData: peekCards };
      }

      case 'FREEZE': {
        const targetId = payload.targetPlayerId;
        const targetPlayer = this.getPlayer(targetId || '');
        if (targetPlayer && targetPlayer.id !== playerId) {
          targetPlayer.isFrozen = true;
          this.state.lastActionLog = {
            ar: `${initiator.name} قام بتجميد دور ${targetPlayer.name}!`,
            en: `${initiator.name} froze ${targetPlayer.name}'s next turn!`
          };
        }
        this.completeAction();
        return { success: true };
      }

      default:
        this.completeAction();
        return { success: true };
    }

    return { success: false, message: 'Action execution failed.' };
  }

  private finishActionAfterPeek(peekCards: any[], logMsg: string): void {
    if (!this.state.pendingAction) return;
    this.state.pendingAction.peekedCards = peekCards;
    this.state.pendingAction.stage = 'PEEK_COUNTDOWN';
    this.state.lastActionLog = { ar: logMsg, en: logMsg };
    this.notify();

    // 4-second peek countdown then complete
    this.peekCountdownHandle = setTimeout(() => {
      if (this.state.status === 'ACTION_PENDING') {
        this.completeAction();
      }
    }, 4500);
  }

  private peekCountdownHandle?: any;

  public completePeek(): void {
    if (this.peekCountdownHandle) {
      clearTimeout(this.peekCountdownHandle);
      this.peekCountdownHandle = null;
    }
    if (this.state.status === 'ACTION_PENDING') {
      this.completeAction();
    }
  }

  private completeAction(): void {
    if (this.peekCountdownHandle) {
      clearTimeout(this.peekCountdownHandle);
      this.peekCountdownHandle = null;
    }
    if (this.peekTimeoutHandle) {
      clearTimeout(this.peekTimeoutHandle);
      this.peekTimeoutHandle = null;
    }
    this.state.pendingAction = null;
    this.state.status = 'PLAYING';
    this.finishTurn();
  }

  private cancelPendingAction(reason: string): void {
    this.state.pendingAction = null;
    this.state.status = 'PLAYING';
    this.state.lastActionLog = { ar: reason, en: reason };
    this.finishTurn();
  }

  /**
   * Matching Drop / Match Slap (التشابه): Any player can slap a matching card on top of discard pile
   */
  public matchSlap(playerId: string, handIndex: number): { success: boolean; isMatch: boolean; message: string } {
    if (this.state.status !== 'PLAYING') {
      return { success: false, isMatch: false, message: 'Game not in active round.' };
    }
    if (this.state.discardPile.length === 0) {
      return { success: false, isMatch: false, message: 'Discard pile is empty.' };
    }

    const player = this.getPlayer(playerId);
    if (!player || handIndex < 0 || handIndex >= player.hand.length) {
      return { success: false, isMatch: false, message: 'Invalid card index.' };
    }

    const topDiscard = this.state.discardPile[this.state.discardPile.length - 1];
    const candidateCard = player.hand[handIndex];

    if (candidateCard.value === topDiscard.value) {
      // Correct Match! Player discards their card
      const [matched] = player.hand.splice(handIndex, 1);
      matched.isFaceUp = true;
      this.state.discardPile.push(matched);

      this.state.lastActionLog = {
        ar: `تشابه صحيح! ${player.name} تخلص من كارت بنجاح!`,
        en: `Match drop! ${player.name} successfully dropped a matching card!`
      };
      this.notify();
      return { success: true, isMatch: true, message: 'Match drop successful!' };
    } else {
      // Wrong Match Slap! Penalty: keep card + draw penalty card
      let penaltyCard: Card | null = null;
      if (this.state.drawPile.length > 0) {
        penaltyCard = this.state.drawPile.pop()!;
      } else if (this.state.discardPile.length > 2) {
        const top = this.state.discardPile.pop()!;
        this.state.drawPile = this.state.discardPile.map(c => ({ ...c, isFaceUp: false }));
        this.state.discardPile = [top];
        penaltyCard = this.state.drawPile.pop() || null;
      }

      if (penaltyCard) {
        penaltyCard.isFaceUp = false;
        player.hand.push(penaltyCard);
      }

      this.state.lastActionLog = {
        ar: `تشابه خاطئ! ${player.name} أخطأ وحصل على كارت عقوبة إضافي!`,
        en: `Wrong match! ${player.name} was penalized with an extra card!`
      };
      this.notify();
      return { success: true, isMatch: false, message: 'Wrong match! Extra penalty card added.' };
    }
  }

  /**
   * Player declares "Skru!" (سكرووو!)
   */
  public callSkru(playerId: string): { success: boolean; message?: string } {
    if (this.state.status !== 'PLAYING') return { success: false, message: 'Cannot call Skru right now.' };
    if (this.state.currentTurnPlayerId !== playerId) return { success: false, message: 'Can only call Skru on your turn.' };
    if (this.state.drawnCard !== null) return { success: false, message: 'Cannot call Skru after drawing a card.' };
    if (this.state.skruCallerId !== null) return { success: false, message: 'Skru has already been called for this round!' };

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, message: 'Player not found.' };

    this.state.skruCallerId = playerId;
    player.hasCalledSkru = true;
    this.state.finalTurnsRemaining = this.state.players.length - 1;

    this.state.lastActionLog = {
      ar: `سكرووو! أعلن ${player.name} سكرو! باقي لكل لاعب دور أخير!`,
      en: `SKRUUU! ${player.name} called Skru! Each other player gets one final turn!`
    };

    this.finishTurn();
    return { success: true };
  }

  /**
   * Advances turn to next player or concludes the round
   */
  private finishTurn(): void {
    this.clearTurnTimer();

    // Check if Skru final turns completed
    if (this.state.skruCallerId !== null && this.state.currentTurnPlayerId !== this.state.skruCallerId) {
      this.state.finalTurnsRemaining -= 1;
      if (this.state.finalTurnsRemaining <= 0) {
        this.endRound();
        return;
      }
    }

    // Determine next player
    const currentIndex = this.state.players.findIndex(p => p.id === this.state.currentTurnPlayerId);
    let nextIndex = (currentIndex + 1) % this.state.players.length;

    // Check if next player is frozen
    if (this.state.players[nextIndex].isFrozen) {
      this.state.players[nextIndex].isFrozen = false; // unfreeze
      this.state.lastActionLog = {
        ar: `تم تخطي دور ${this.state.players[nextIndex].name} بسبب التجميد!`,
        en: `${this.state.players[nextIndex].name}'s turn was skipped due to freeze!`
      };
      nextIndex = (nextIndex + 1) % this.state.players.length;
    }

    this.state.currentTurnPlayerId = this.state.players[nextIndex].id;
    this.state.turnStartTime = Date.now();
    this.resetTurnTimer();
    this.notify();
  }

  private resetTurnTimer(): void {
    this.clearTurnTimer();
    if (this.state.turnTimer > 0) {
      this.turnTimeoutHandle = setTimeout(() => {
        this.handleTurnTimeout();
      }, (this.state.turnTimer + 1) * 1000);
    }
  }

  private clearTurnTimer(): void {
    if (this.turnTimeoutHandle) {
      clearTimeout(this.turnTimeoutHandle);
      this.turnTimeoutHandle = null;
    }
  }

  private handleTurnTimeout(): void {
    const current = this.getPlayer(this.state.currentTurnPlayerId);
    if (!current) return;

    if (this.state.drawnCard) {
      // Auto-discard drawn card
      this.discardDrawnCard(current.id, false);
    } else {
      // Auto-draw & auto-discard top draw card to keep game moving briskly
      this.drawCard(current.id, 'DRAW_PILE');
      this.discardDrawnCard(current.id, false);
    }
  }

  /**
   * Concludes round, reveals all cards, tallies scores and applies Skru penalties
   */
  public endRound(): void {
    this.clearTurnTimer();
    this.state.status = 'ROUND_OVER';

    // Reveal all cards
    for (const player of this.state.players) {
      for (const card of player.hand) {
        card.isFaceUp = true;
      }
    }

    const callerId = this.state.skruCallerId;
    const playerHandSums = this.state.players.map(p => ({
      player: p,
      sum: p.hand.reduce((acc, c) => acc + c.value, 0)
    }));

    // Find minimum sum
    const minSum = Math.min(...playerHandSums.map(p => p.sum));

    // Handle 2v2 (Saheb Sa7bo) team scoring
    if (this.state.variant === 'SAHEB_SA7BO') {
      const teamASum = playerHandSums.filter(p => p.player.team === 'A').reduce((acc, p) => acc + p.sum, 0);
      const teamBSum = playerHandSums.filter(p => p.player.team === 'B').reduce((acc, p) => acc + p.sum, 0);
      const winningTeam = teamASum < teamBSum ? 'A' : (teamBSum < teamASum ? 'B' : 'TIE');

      for (const item of playerHandSums) {
        const roundPts = item.player.team === winningTeam ? 0 : item.sum;
        item.player.roundScores.push(roundPts);
        item.player.totalScore += roundPts;
      }
    } else {
      // Classic & Deluxe Individual scoring
      for (const item of playerHandSums) {
        const p = item.player;
        let roundScore = item.sum;

        if (p.id === callerId) {
          // If caller has strictly lowest sum
          const othersWithSameOrLower = playerHandSums.filter(o => o.player.id !== callerId && o.sum <= item.sum);
          if (othersWithSameOrLower.length === 0) {
            // Success! Caller gets 0 points
            roundScore = 0;
          } else {
            // Failed Skru call! Penalty: Double round score (or sum + 30)
            roundScore = item.sum * 2;
            if (roundScore < 30) roundScore = item.sum + 30;
          }
        }

        p.roundScores.push(roundScore);
        p.totalScore += roundScore;
      }
    }

    // Check game over
    const maxScore = Math.max(...this.state.players.map(p => p.totalScore));
    if (maxScore >= this.state.pointsCap) {
      this.state.status = 'GAME_OVER';
      const winner = [...this.state.players].sort((a, b) => a.totalScore - b.totalScore)[0];
      this.state.lastActionLog = {
        ar: `انتهت اللعبة! الفائز بالمركز الأول هو ${winner.name} بمجموع ${winner.totalScore} نقطة!`,
        en: `Game Over! The champion is ${winner.name} with ${winner.totalScore} points!`
      };
    } else {
      this.state.lastActionLog = {
        ar: `انتهت الجولة ${this.state.roundNumber}! تم حساب النقاط وكشف الأوراق.`,
        en: `Round ${this.state.roundNumber} ended! Points tallied and cards revealed.`
      };
    }

    this.notify();
  }

  public getPlayer(id: string): Player | undefined {
    return this.state.players.find(p => p.id === id);
  }

  /**
   * Generates sanitized state payload for anti-cheat
   * Never leaks hidden card values or opponent peeks
   */
  public getSanitizedState(forPlayerId: string): SanitizedGameState {
    const isCurrentPlayer = this.state.currentTurnPlayerId === forPlayerId;
    const now = Date.now();
    const elapsed = Math.floor((now - this.state.turnStartTime) / 1000);
    const turnSecondsRemaining = this.state.turnTimer > 0 
      ? Math.max(0, this.state.turnTimer - elapsed) 
      : 999;

    const initialPeekSecondsRemaining = this.state.initialPeekExpiresAt 
      ? Math.max(0, Math.ceil((this.state.initialPeekExpiresAt - now) / 1000))
      : undefined;

    const sanitizedPlayers: SanitizedPlayer[] = this.state.players.map(player => {
      const isSelf = player.id === forPlayerId;
      const isRoundOrGameOver = this.state.status === 'ROUND_OVER' || this.state.status === 'GAME_OVER';

      const hand: SanitizedCard[] = player.hand.map((card, idx) => {
        // Can see card value if:
        // 1. Card is face up, OR
        // 2. Round is over, OR
        // 3. During initial peek, self player can see bottom 2 cards (index 2 & 3 in a 4-card grid)
        const canSeeInitial = isSelf && this.state.status === 'INITIAL_PEEK' && (idx >= 2);
        const shouldReveal = card.isFaceUp || isRoundOrGameOver || canSeeInitial;

        if (shouldReveal) {
          return {
            id: card.id,
            isFaceUp: card.isFaceUp || isRoundOrGameOver,
            value: card.value,
            action: card.action,
            labelAr: card.labelAr,
            labelEn: card.labelEn,
            color: card.color
          };
        }

        // Secret card: strip all identity & values
        return {
          id: card.id,
          isFaceUp: false
        };
      });

      return {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        team: player.team,
        hand,
        cardCount: player.hand.length,
        isFrozen: player.isFrozen,
        connected: player.connected,
        totalScore: player.totalScore,
        roundScores: player.roundScores,
        hasCalledSkru: player.hasCalledSkru,
        isHost: player.isHost
      };
    });

    const topDiscard = this.state.discardPile.length > 0 
      ? this.state.discardPile[this.state.discardPile.length - 1] 
      : null;

    return {
      roomCode: this.state.roomCode,
      status: this.state.status,
      variant: this.state.variant,
      pointsCap: this.state.pointsCap,
      turnTimer: this.state.turnTimer,
      players: sanitizedPlayers,
      spectators: this.state.spectators,
      currentTurnPlayerId: this.state.currentTurnPlayerId,
      turnSecondsRemaining,
      topDiscard,
      drawPileCount: this.state.drawPile.length,
      hasDrawnCard: this.state.drawnCard !== null,
      drawnCardForCurrentPlayer: isCurrentPlayer ? this.state.drawnCard : null,
      skruCallerId: this.state.skruCallerId,
      finalTurnsRemaining: this.state.finalTurnsRemaining,
      initialPeekSecondsRemaining,
      pendingActionSummary: this.state.pendingAction ? {
        type: this.state.pendingAction.type,
        initiatorId: this.state.pendingAction.initiatorId,
        expiresInSeconds: Math.max(0, Math.ceil((this.state.pendingAction.expiresAt - now) / 1000)),
        stage: this.state.pendingAction.stage
      } : null,
      roundNumber: this.state.roundNumber,
      lastActionLog: this.state.lastActionLog,
      yourPlayerId: forPlayerId
    };
  }

  private notify(): void {
    this.onStateChange(this.state);
  }
}

export type CardAction = 
  | 'NONE'
  | 'PEEK_OWN'
  | 'PEEK_OTHER'
  | 'SWAP'
  | 'PEEK_AND_SWAP'
  | 'PEEK_ALL'
  | 'GIVE_AWAY'
  | 'WILD'
  | 'FREEZE'
  | 'BOMB';

export interface Card {
  id: string;
  value: number;
  action: CardAction;
  labelAr: string;
  labelEn: string;
  color: 'emerald' | 'gold' | 'crimson' | 'indigo' | 'purple' | 'amber';
  isFaceUp: boolean;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  team?: 'A' | 'B';
  hand: Card[];
  isFrozen: boolean;
  connected: boolean;
  lastSeen: number;
  totalScore: number;
  roundScores: number[];
  hasCalledSkru: boolean;
  isHost: boolean;
}

export interface SanitizedCard {
  id: string;
  isFaceUp: boolean;
  value?: number;
  action?: CardAction;
  labelAr?: string;
  labelEn?: string;
  color?: string;
}

export interface SanitizedPlayer {
  id: string;
  name: string;
  avatar: string;
  team?: 'A' | 'B';
  hand: SanitizedCard[];
  cardCount: number;
  isFrozen: boolean;
  connected: boolean;
  totalScore: number;
  roundScores: number[];
  hasCalledSkru: boolean;
  isHost: boolean;
}

export type GameVariant = 'CLASSIC' | 'SAHEB_SA7BO' | 'DELUXE' | 'FRENCH_DECK';

export type GameStatus = 
  | 'LOBBY'
  | 'INITIAL_PEEK'
  | 'PLAYING'
  | 'ACTION_PENDING'
  | 'ROUND_OVER'
  | 'GAME_OVER';

export interface SanitizedGameState {
  roomCode: string;
  status: GameStatus;
  variant: GameVariant;
  pointsCap: number;
  turnTimer: number;
  players: SanitizedPlayer[];
  spectators: { id: string; name: string }[];
  currentTurnPlayerId: string;
  turnSecondsRemaining: number;
  topDiscard: Card | null;
  drawPileCount: number;
  hasDrawnCard: boolean;
  drawnCardForCurrentPlayer?: Card | null;
  skruCallerId: string | null;
  finalTurnsRemaining: number;
  initialPeekSecondsRemaining?: number;
  pendingActionSummary?: {
    type: CardAction;
    initiatorId: string;
    expiresInSeconds: number;
    stage: string;
  } | null;
  roundNumber: number;
  lastActionLog: { ar: string; en: string } | null;
  yourPlayerId: string;
}

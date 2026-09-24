export type CardAction = 
  | 'NONE'
  | 'PEEK_OWN'        // خد فكرة
  | 'PEEK_OTHER'      // بصرة
  | 'SWAP'            // هات وخد / خد وهات
  | 'PEEK_AND_SWAP'   // خد وهات بصرة
  | 'PEEK_ALL'        // كعب داير
  | 'GIVE_AWAY'       // خد بس
  | 'WILD'            // على كيفك
  | 'FREEZE'          // تجميد (Deluxe)
  | 'BOMB';           // قنبلة (Deluxe)

export interface Card {
  id: string;
  value: number;
  action: CardAction;
  labelAr: string;
  labelEn: string;
  color: 'emerald' | 'gold' | 'crimson' | 'indigo' | 'purple' | 'amber';
  isFaceUp: boolean;
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

export interface PendingAction {
  type: CardAction;
  initiatorId: string;
  expiresAt: number;
  stage: 'SELECT_TARGET' | 'PEEK_COUNTDOWN' | 'CHOOSE_SWAP';
  targetPlayerId?: string;
  targetCardIndex?: number;
  ownCardIndex?: number;
  peekedCards?: { playerId: string; cardIndex: number; card: Card }[];
}

export interface GameState {
  roomCode: string;
  status: GameStatus;
  variant: GameVariant;
  pointsCap: number;
  turnTimer: number; // 0 = unlimited, 15, 30
  players: Player[];
  spectators: { id: string; name: string }[];
  currentTurnPlayerId: string;
  turnStartTime: number;
  discardPile: Card[];
  drawPile: Card[]; // secret on server
  drawnCard: Card | null; // currently drawn by current turn player
  drawnFrom: 'DRAW_PILE' | 'DISCARD_PILE' | null;
  skruCallerId: string | null;
  finalTurnsRemaining: number;
  pendingAction: PendingAction | null;
  initialPeekExpiresAt: number | null;
  roundNumber: number;
  lastActionLog: { ar: string; en: string } | null;
  matchSlapLocked: boolean;
}

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
  drawnCardForCurrentPlayer?: Card | null; // only visible to the drawer
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

export interface Card {
  suit: string;  // Changed to string for compatibility with server
  rank: number;
  code?: string;
}

export interface Player {
  id: string;
  name: string;
  handCount: number;
  isActive: boolean;
  hasPassed: boolean;
  isOut: boolean;
  wins: number;
  losses: number;
  position?: number;
}

export interface Meld {
  cards: Card[];
  type: MeldType;
  playerId: string;
}

export enum MeldType {
  SINGLE = "SINGLE",
  PAIR = "PAIR",
  THREE_OF_KIND = "THREE_OF_KIND",
  BOMB = "BOMB",
  SISTERS = "SISTERS",
  FULL_HOUSE = "FULL_HOUSE",
  RUN = "RUN",
  STRAIGHT_FLUSH = "STRAIGHT_FLUSH"
}

export enum GamePhase {
  WAITING = "WAITING",
  DEALING = "DEALING",
  PLAYING = "PLAYING",
  ROUND_END = "ROUND_END",
  GAME_END = "GAME_END"
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
  isSystem?: boolean;
  messageType?: 'info' | 'success' | 'warning' | 'error';
}

export interface GameState {
  phase: GamePhase;
  currentRound: number;
  currentTurnPlayerId: string;
  leadPlayerId: string;
  players: Map<string, Player>;
  currentMeld: Meld | null;
  consecutivePasses: number;
  deck?: Card[];
  discardPile?: Card[];
  chatMessages?: ChatMessage[];
}

// Common 3-4 letter names for random default
export const COMMON_NAMES = [
  'Max', 'Zoe', 'Leo', 'Eva', 'Sam', 'Amy', 'Ben', 'Mia',
  'Tom', 'Ivy', 'Jay', 'Ava', 'Ali', 'Uma', 'Eli', 'Nia',
  'Rex', 'Tia', 'Ace', 'Joy', 'Ray', 'Eve', 'Mac', 'Lily',
  'Joe', 'Ruby', 'Dan', 'Rose', 'Jack', 'Maya'
];

export const getRandomName = () => COMMON_NAMES[Math.floor(Math.random() * COMMON_NAMES.length)];
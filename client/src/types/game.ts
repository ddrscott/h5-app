export enum Suit {
  CLUBS = "C",
  DIAMONDS = "D", 
  HEARTS = "H",
  SPADES = "S",
  JOKER = "J"
}

export enum Rank {
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  EIGHT = 8,
  NINE = 9,
  TEN = 10,
  JACK = 11,
  QUEEN = 12,
  KING = 13,
  ACE = 14,
  TWO = 15,
  SMALL_JOKER = 16,
  BIG_JOKER = 17,
  FIVE_OF_HEARTS = 18
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

export interface Card {
  suit: Suit;
  rank: Rank;
  code: string;
  isSpecial: boolean;
}

export interface Meld {
  cards: Card[];
  type: MeldType;
  strength: number;
  playerId: string;
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
  position: number;
}

export interface GameState {
  phase: GamePhase;
  currentRound: number;
  currentTurnPlayerId: string;
  leadPlayerId: string;
  players: Map<string, Player>;
  currentMeld: Meld | null;
  consecutivePasses: number;
}

// Common 3-4 letter names for random default
export const COMMON_NAMES = [
  'Max', 'Zoe', 'Leo', 'Eva', 'Sam', 'Amy', 'Ben', 'Mia',
  'Tom', 'Ivy', 'Jay', 'Ava', 'Ali', 'Uma', 'Eli', 'Nia',
  'Rex', 'Tia', 'Ace', 'Joy', 'Ray', 'Eve', 'Mac', 'Lily',
  'Joe', 'Ruby', 'Dan', 'Rose', 'Jack', 'Maya'
];

export const getRandomName = () => COMMON_NAMES[Math.floor(Math.random() * COMMON_NAMES.length)];
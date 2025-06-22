import { Card, GamePhase, Meld, Player } from '../types/game';

/**
 * Core interfaces for the bot system
 */

export interface BotDecision {
  action: 'play' | 'pass';
  cards?: Card[];
  confidence: number; // 0-1, how confident the bot is in this decision
  reasoning?: string; // Optional explanation for debugging
}

export interface GameContext {
  myHand: Card[];
  currentMeld: Meld | null;
  isLeader: boolean;
  consecutivePasses: number;
  players: Map<string, Player>;
  myPlayerId: string;
  currentRound: number;
  discardedCards?: Card[]; // If we track this
  phase: GamePhase;
}

export interface BotMemory {
  [key: string]: any;
  playedCards?: Card[];
  opponentTendencies?: Map<string, any>;
  successfulPlays?: any[];
}

export interface BotPersonality {
  aggressiveness: number; // 0-1, how likely to play vs pass
  riskTolerance: number; // 0-1, willingness to use strong cards early
  bluffingTendency: number; // 0-1, likelihood to make deceptive plays
  patience: number; // 0-1, willingness to wait for good opportunities
  adaptability: number; // 0-1, how much to adjust based on game state
}

export interface BotConfig {
  name: string;
  avatar?: string;
  personality: BotPersonality;
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  decisionDelay: {
    min: number; // minimum milliseconds
    max: number; // maximum milliseconds
  };
  chatEnabled: boolean;
  chatPhrases?: {
    greeting?: string[];
    winning?: string[];
    losing?: string[];
    goodPlay?: string[];
    pass?: string[];
  };
}

export abstract class BotStrategy {
  protected memory: BotMemory = {};
  
  constructor(protected config: BotConfig) {}
  
  abstract makeDecision(context: GameContext): Promise<BotDecision>;
  
  abstract analyzeHand(cards: Card[]): {
    strength: number;
    bestMelds: Meld[];
    bombs: Card[][];
  };
  
  // Optional hooks for more advanced bots
  onGameStart?(): void;
  onRoundEnd?(winner: string): void;
  onPlayerMove?(playerId: string, meld: Meld): void;
  onChat?(playerId: string, message: string): void;
  
  // Utility method for decision delays
  protected async simulateThinking(): Promise<void> {
    const { min, max } = this.config.decisionDelay;
    const delay = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  // Get a chat message if enabled
  getChatMessage(situation: keyof BotConfig['chatPhrases']): string | null {
    if (!this.config.chatEnabled || !this.config.chatPhrases?.[situation]) {
      return null;
    }
    const phrases = this.config.chatPhrases[situation];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }
}

export interface BotClient {
  id: string;
  config: BotConfig;
  strategy: BotStrategy;
  isConnected: boolean;
  connect(serverUrl: string, roomId: string): Promise<void>;
  disconnect(): void;
  updateStrategy(strategy: BotStrategy): void;
}
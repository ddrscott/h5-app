import { BotStrategy, BotConfig, BotDecision, GameContext } from '../types';
import { GameAnalyzer } from '../GameAnalyzer';
import { Card, Meld } from '../../types/game';

/**
 * Base strategy with common functionality
 */
export abstract class BaseStrategy extends BotStrategy {
  protected analyzer: GameAnalyzer;

  constructor(config: BotConfig) {
    super(config);
    this.analyzer = new GameAnalyzer();
  }

  async makeDecision(context: GameContext): Promise<BotDecision> {
    await this.simulateThinking();
    
    // Check if we're the leader - leaders must play something
    if (context.isLeader) {
      // If there's no current meld OR we just became leader after everyone passed
      if (!context.currentMeld || context.consecutivePasses === 0) {
        console.log(`[${this.config.name}] I'm the leader! Must play something.`);
        return this.makeLeaderDecision(context);
      }
    }
    
    // Find all valid plays
    const validPlays = this.analyzer.findValidPlays(
      context.myHand,
      context.currentMeld,
      context.isLeader
    );
    
    if (validPlays.length === 0) {
      // Leaders can't pass when they have the lead
      if (context.isLeader && (!context.currentMeld || context.consecutivePasses === 0)) {
        console.error(`[${this.config.name}] ERROR: Leader tried to pass but must play!`);
        // Force leader to play something
        return this.makeLeaderDecision(context);
      }
      
      return {
        action: 'pass',
        confidence: 1.0,
        reasoning: 'No valid plays available'
      };
    }
    
    // Let the specific strategy choose from valid plays
    return this.choosePlay(context, validPlays);
  }

  /**
   * When leading, decide what to play
   */
  protected abstract makeLeaderDecision(context: GameContext): Promise<BotDecision>;

  /**
   * Choose from available valid plays
   */
  protected abstract choosePlay(context: GameContext, validPlays: Card[][]): Promise<BotDecision>;

  analyzeHand(cards: Card[]): {
    strength: number;
    bestMelds: Meld[];
    bombs: Card[][];
  } {
    const strength = this.analyzer.evaluateHandStrength(cards);
    const allMelds = this.analyzer.findAllMelds(cards);
    const bombs = allMelds.get('BOMB' as any) || [];
    
    // Convert to Meld objects (simplified for now)
    const bestMelds: Meld[] = [];
    
    return {
      strength,
      bestMelds,
      bombs
    };
  }

  /**
   * Calculate if we should play or pass based on game state
   * SIMPLIFIED: Bots should play whenever they can!
   */
  protected shouldPlay(
    context: GameContext,
    playStrength: number,
    cardValue: number
  ): boolean {
    const { aggressiveness, patience } = this.config.personality;
    
    // Basic rule: If we can play, we usually should!
    // Only pass if we're being very strategic
    
    // Random chance to pass based on patience (less patient = less likely to pass)
    const passChance = patience * 0.3; // Max 30% chance to pass for very patient bots
    
    // Aggressive bots almost never pass
    const adjustedPassChance = passChance * (1 - aggressiveness);
    
    // Most of the time, play if we can!
    return Math.random() > adjustedPassChance;
  }

  /**
   * Get average hand size of active players
   */
  protected getAverageHandSize(context: GameContext): number {
    let total = 0;
    let count = 0;
    
    context.players.forEach(player => {
      if (!player.isOut) {
        total += player.handCount;
        count++;
      }
    });
    
    return count > 0 ? total / count : 10;
  }

  /**
   * Evaluate how good a play is (0-1)
   */
  protected evaluatePlay(cards: Card[], context: GameContext): number {
    // Base evaluation on cards used vs cards remaining
    const cardsUsed = cards.length;
    const cardsRemaining = context.myHand.length - cardsUsed;
    
    // Using more cards is generally better
    let score = cardsUsed / 10;
    
    // But not if it leaves us with too few
    if (cardsRemaining < 3) {
      score *= 0.7;
    }
    
    // Bonus for getting rid of low cards
    const avgRank = cards.reduce((sum, c) => sum + c.rank, 0) / cards.length;
    if (avgRank < 8) score += 0.2;
    
    // Bonus for bombs and special plays
    if (cards.length === 4 && cards.every(c => c.rank === cards[0].rank)) {
      score += 0.3; // Bomb bonus
    } else if (cards.length >= 5) {
      // Check for straight flush
      const suits = new Set(cards.map(c => c.suit));
      if (suits.size === 1) {
        score += 0.3; // Straight flush bonus
      }
    }
    
    return Math.min(1, Math.max(0, score));
  }
}
import { BaseStrategy } from './BaseStrategy';
import { BotDecision, GameContext } from '../types';
import { Card, Rank } from '../../types/game';

/**
 * Balanced strategy - adapts play style based on game state
 */
export class BalancedStrategy extends BaseStrategy {
  private recentPlays: { round: number; aggressive: boolean }[] = [];

  protected async makeLeaderDecision(context: GameContext): Promise<BotDecision> {
    const allMelds = this.analyzer.findAllMelds(context.myHand);
    const gameProgress = this.assessGameProgress(context);
    
    // Collect all possible melds with evaluations
    const options: { cards: Card[], score: number, type: string }[] = [];
    
    allMelds.forEach((meldsOfType, type) => {
      meldsOfType.forEach(meld => {
        const score = this.evaluateLeaderPlay(meld, context, gameProgress);
        options.push({ cards: meld, score, type: type as string });
      });
    });
    
    if (options.length === 0) {
      console.error(`[${this.config.name}] Leader has no valid melds! This shouldn't happen.`);
      // As a last resort, try to play any single card
      if (context.myHand.length > 0) {
        return {
          action: 'play',
          cards: [context.myHand[0]],
          confidence: 0.1,
          reasoning: 'Emergency play - leader must play something'
        };
      }
      return {
        action: 'pass',
        confidence: 0.1,
        reasoning: 'No valid melds to lead with (ERROR - leader should not pass)'
      };
    }
    
    // Sort by score
    options.sort((a, b) => b.score - a.score);
    
    // Balanced strategy: mix it up
    const topOptions = options.slice(0, 5);
    const weights = topOptions.map((_, i) => Math.pow(0.7, i));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    // Weighted random selection
    let random = Math.random() * totalWeight;
    let chosen = topOptions[0];
    
    for (let i = 0; i < topOptions.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        chosen = topOptions[i];
        break;
      }
    }
    
    // Track our play style
    const isAggressive = chosen.cards.length >= 3 || chosen.score > 0.7;
    this.recentPlays.push({ round: context.currentRound, aggressive: isAggressive });
    if (this.recentPlays.length > 5) this.recentPlays.shift();
    
    return {
      action: 'play',
      cards: chosen.cards,
      confidence: Math.min(0.9, chosen.score + 0.1),
      reasoning: `Balanced lead with ${chosen.type}`
    };
  }

  protected async choosePlay(context: GameContext, validPlays: Card[][]): Promise<BotDecision> {
    // BALANCED: Sometimes play minimum, sometimes play bigger melds
    const gameProgress = this.assessGameProgress(context);
    
    // Sort plays by size
    const smallPlays = validPlays.filter(p => p.length <= 2);
    const mediumPlays = validPlays.filter(p => p.length === 3);
    const bigPlays = validPlays.filter(p => p.length >= 4);
    
    // Balanced decision making
    let chosenPlay: Card[] | null = null;
    
    // Almost always play when we can (80-90% of the time)
    if (this.shouldPlay(context, 0.8, 0.5)) {
      // Early game: prefer small plays to feel out opponents
      if (gameProgress.stage === 'early' && smallPlays.length > 0) {
        chosenPlay = smallPlays[Math.floor(Math.random() * smallPlays.length)];
      }
      // Late game or behind: use bigger plays
      else if ((gameProgress.stage === 'late' || gameProgress.position === 'behind') && bigPlays.length > 0) {
        chosenPlay = bigPlays[Math.floor(Math.random() * bigPlays.length)];
      }
      // Default: play smallest available
      else {
        // Sort all plays by size, then by rank
        validPlays.sort((a, b) => {
          if (a.length !== b.length) return a.length - b.length;
          const avgA = a.reduce((sum, c) => sum + c.rank, 0) / a.length;
          const avgB = b.reduce((sum, c) => sum + c.rank, 0) / b.length;
          return avgA - avgB;
        });
        chosenPlay = validPlays[0];
      }
      
      if (chosenPlay) {
        return {
          action: 'play',
          cards: chosenPlay,
          confidence: 0.8,
          reasoning: `Balanced play (${gameProgress.stage} game, ${gameProgress.position})`
        };
      }
    }
    
    // Occasional strategic pass
    return {
      action: 'pass',
      confidence: 0.6,
      reasoning: 'Strategic pass (balanced)'
    };
  }

  private assessGameProgress(context: GameContext): {
    stage: 'early' | 'mid' | 'late';
    position: 'ahead' | 'even' | 'behind';
    urgency: number;
  } {
    const myPlayer = context.players.get(context.myPlayerId);
    const handSize = myPlayer?.handCount || context.myHand.length;
    const avgHandSize = this.getAverageHandSize(context);
    
    // Determine game stage
    let stage: 'early' | 'mid' | 'late';
    if (avgHandSize > 12) stage = 'early';
    else if (avgHandSize > 6) stage = 'mid';
    else stage = 'late';
    
    // Determine position
    let position: 'ahead' | 'even' | 'behind';
    if (handSize < avgHandSize - 2) position = 'ahead';
    else if (handSize > avgHandSize + 2) position = 'behind';
    else position = 'even';
    
    // Calculate urgency (0-1)
    const urgency = stage === 'late' && position === 'behind' ? 0.9 :
                   stage === 'late' ? 0.6 :
                   position === 'behind' ? 0.5 : 0.3;
    
    return { stage, position, urgency };
  }

  private determinePlayStyle(
    context: GameContext, 
    progress: ReturnType<typeof this.assessGameProgress>
  ): 'aggressive' | 'balanced' | 'conservative' {
    const { adaptability } = this.config.personality;
    
    // Base style on personality
    let style: 'aggressive' | 'balanced' | 'conservative' = 'balanced';
    
    // Adapt based on game state
    if (adaptability > 0.7) {
      if (progress.position === 'behind' && progress.stage !== 'early') {
        style = 'aggressive';
      } else if (progress.position === 'ahead' && progress.stage === 'late') {
        style = 'conservative';
      }
    }
    
    // Consider recent opponent behavior
    if (context.consecutivePasses >= 2) {
      // Others are passing, maybe we can be more aggressive
      if (style === 'balanced') style = 'aggressive';
    }
    
    return style;
  }

  private evaluateLeaderPlay(
    cards: Card[], 
    context: GameContext,
    progress: ReturnType<typeof this.assessGameProgress>
  ): number {
    let score = 0.5; // Base score
    
    // Size preference based on game stage
    if (progress.stage === 'early') {
      // Prefer medium-sized melds early
      if (cards.length >= 2 && cards.length <= 3) score += 0.2;
    } else if (progress.stage === 'late') {
      // Prefer larger melds late
      if (cards.length >= 3) score += 0.3;
    }
    
    // Strength consideration
    const avgRank = cards.reduce((sum, c) => sum + c.rank, 0) / cards.length;
    if (avgRank < Rank.EIGHT) score += 0.2; // Bonus for low cards
    if (avgRank > Rank.QUEEN) score -= 0.1; // Penalty for high cards
    
    // Position adjustment
    if (progress.position === 'behind') {
      // When behind, prefer bigger plays
      score += cards.length * 0.05;
    } else if (progress.position === 'ahead') {
      // When ahead, prefer singles and pairs
      if (cards.length <= 2) score += 0.15;
    }
    
    return Math.min(1, Math.max(0, score));
  }

  private evaluateAdaptivePlay(
    cards: Card[], 
    context: GameContext,
    playStyle: 'aggressive' | 'balanced' | 'conservative'
  ): number {
    const baseScore = this.evaluatePlay(cards, context);
    let modifier = 1.0;
    
    const avgRank = cards.reduce((sum, c) => sum + c.rank, 0) / cards.length;
    const isHighValue = avgRank > Rank.QUEEN;
    const isBomb = cards.length === 4 && this.allSameRank(cards);
    
    switch (playStyle) {
      case 'aggressive':
        // Favor using more cards and taking risks
        modifier = cards.length >= 3 ? 1.2 : 0.9;
        if (isBomb) modifier = 0.8; // Save bombs when aggressive
        break;
        
      case 'conservative':
        // Favor saving high cards
        modifier = isHighValue ? 0.7 : 1.1;
        if (isBomb) modifier = 1.2; // Use bombs defensively
        break;
        
      case 'balanced':
        // Slight adjustments based on card value
        modifier = isHighValue ? 0.9 : 1.0;
        break;
    }
    
    return Math.min(1, Math.max(0, baseScore * modifier));
  }

  private calculateDynamicThreshold(
    context: GameContext,
    progress: ReturnType<typeof this.assessGameProgress>,
    playStyle: string
  ): number {
    let threshold = 0.5; // Base threshold
    
    // Adjust for play style
    if (playStyle === 'aggressive') threshold -= 0.15;
    if (playStyle === 'conservative') threshold += 0.15;
    
    // Adjust for urgency
    threshold -= progress.urgency * 0.2;
    
    // Adjust for personality
    threshold -= this.config.personality.aggressiveness * 0.1;
    threshold += this.config.personality.patience * 0.1;
    
    return Math.min(0.8, Math.max(0.2, threshold));
  }

  private isAggressivePlay(cards: Card[], context: GameContext): boolean {
    // Large melds or high-value cards
    return cards.length >= 3 || 
           cards.some(c => c.rank >= Rank.KING) ||
           (cards.length === 4 && this.allSameRank(cards));
  }

  private allSameRank(cards: Card[]): boolean {
    return cards.every(c => c.rank === cards[0].rank);
  }
}
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
      return {
        action: 'pass',
        confidence: 0.5,
        reasoning: 'No valid melds'
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
    const gameProgress = this.assessGameProgress(context);
    const playStyle = this.determinePlayStyle(context, gameProgress);
    
    // Evaluate all plays with adaptive scoring
    const evaluatedPlays = validPlays.map(play => ({
      cards: play,
      score: this.evaluateAdaptivePlay(play, context, playStyle),
      aggressive: this.isAggressivePlay(play, context)
    }));
    
    // Sort by score
    evaluatedPlays.sort((a, b) => b.score - a.score);
    
    if (evaluatedPlays.length === 0) {
      return {
        action: 'pass',
        confidence: 0.8,
        reasoning: 'No favorable plays'
      };
    }
    
    // Dynamic threshold based on game state
    const threshold = this.calculateDynamicThreshold(context, gameProgress, playStyle);
    
    // Filter plays above threshold
    const viablePlays = evaluatedPlays.filter(p => p.score > threshold);
    
    if (viablePlays.length > 0) {
      // Balance between best play and variety
      const recentAggressive = this.recentPlays.filter(p => p.aggressive).length;
      const shouldVary = recentAggressive > 3 || recentAggressive < 1;
      
      let chosen;
      if (shouldVary && viablePlays.length > 1) {
        // Pick something different from recent pattern
        const differentStyle = viablePlays.filter(p => 
          p.aggressive !== (recentAggressive > 2)
        );
        chosen = differentStyle[0] || viablePlays[0];
      } else {
        // Pick from top plays with some randomness
        const topPlays = viablePlays.slice(0, 3);
        chosen = topPlays[Math.floor(Math.random() * topPlays.length)];
      }
      
      this.recentPlays.push({ 
        round: context.currentRound, 
        aggressive: chosen.aggressive 
      });
      if (this.recentPlays.length > 5) this.recentPlays.shift();
      
      return {
        action: 'play',
        cards: chosen.cards,
        confidence: chosen.score,
        reasoning: `Adaptive play (${playStyle} style)`
      };
    }
    
    return {
      action: 'pass',
      confidence: 0.7,
      reasoning: `Threshold not met (${threshold.toFixed(2)})`
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
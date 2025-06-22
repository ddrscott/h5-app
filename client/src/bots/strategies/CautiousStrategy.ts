import { BaseStrategy } from './BaseStrategy';
import { BotDecision, GameContext } from '../types';
import { Card, Rank } from '../../types/game';

/**
 * Cautious strategy - plays conservatively and saves strong cards
 */
export class CautiousStrategy extends BaseStrategy {
  protected async makeLeaderDecision(context: GameContext): Promise<BotDecision> {
    const allMelds = this.analyzer.findAllMelds(context.myHand);
    
    // Cautious bot prefers to lead with weaker melds
    const meldsByStrength: { cards: Card[], strength: number }[] = [];
    
    allMelds.forEach((meldsOfType, type) => {
      meldsOfType.forEach(meld => {
        const strength = this.calculateMeldStrength(meld);
        meldsByStrength.push({ cards: meld, strength });
      });
    });
    
    // Sort by strength (ascending) - cautious bots save strong cards
    meldsByStrength.sort((a, b) => a.strength - b.strength);
    
    if (meldsByStrength.length === 0) {
      return {
        action: 'pass',
        confidence: 0.9,
        reasoning: 'No melds available'
      };
    }
    
    // Prefer singles and pairs when leading
    const singles = meldsByStrength.filter(m => m.cards.length === 1);
    const pairs = meldsByStrength.filter(m => m.cards.length === 2);
    const preferred = [...singles, ...pairs];
    
    if (preferred.length > 0) {
      // Pick from weaker half
      const weakerHalf = preferred.slice(0, Math.ceil(preferred.length / 2));
      const chosen = weakerHalf[Math.floor(Math.random() * weakerHalf.length)];
      
      return {
        action: 'play',
        cards: chosen.cards,
        confidence: 0.8,
        reasoning: 'Leading with conservative play'
      };
    }
    
    // Otherwise play the weakest available meld
    return {
      action: 'play',
      cards: meldsByStrength[0].cards,
      confidence: 0.7,
      reasoning: 'Leading with weakest meld'
    };
  }

  protected async choosePlay(context: GameContext, validPlays: Card[][]): Promise<BotDecision> {
    // Check if we're in a good position
    const myPlayer = context.players.get(context.myPlayerId);
    const handSize = myPlayer?.handCount || context.myHand.length;
    const avgHandSize = this.getAverageHandSize(context);
    const isAhead = handSize < avgHandSize - 2;
    
    // Evaluate plays focusing on card conservation
    const evaluatedPlays = validPlays.map(play => ({
      cards: play,
      evaluation: this.evaluateCautiousPlay(play, context),
      strength: this.calculateMeldStrength(play)
    }));
    
    // Sort by evaluation
    evaluatedPlays.sort((a, b) => b.evaluation - a.evaluation);
    
    // High threshold for playing
    const baseThreshold = 0.6 + (this.config.personality.patience * 0.2);
    const threshold = isAhead ? baseThreshold + 0.2 : baseThreshold;
    
    const bestPlay = evaluatedPlays[0];
    
    if (bestPlay.evaluation > threshold) {
      // Cautious players are predictable - usually play the best option
      return {
        action: 'play',
        cards: bestPlay.cards,
        confidence: Math.min(0.9, bestPlay.evaluation),
        reasoning: `Cautious play with ${bestPlay.evaluation.toFixed(2)} confidence`
      };
    }
    
    // Check if we should use a bomb defensively
    const bombs = evaluatedPlays.filter(p => 
      p.cards.length === 4 && this.allSameRank(p.cards)
    );
    
    if (bombs.length > 0 && handSize > avgHandSize + 3) {
      // Use bomb to regain control when behind
      return {
        action: 'play',
        cards: bombs[0].cards,
        confidence: 0.85,
        reasoning: 'Defensive bomb to regain control'
      };
    }
    
    return {
      action: 'pass',
      confidence: 0.9,
      reasoning: 'Preserving cards for better opportunity'
    };
  }

  private evaluateCautiousPlay(cards: Card[], context: GameContext): number {
    let score = this.evaluatePlay(cards, context);
    
    // Penalty for using high cards
    const avgRank = cards.reduce((sum, c) => sum + c.rank, 0) / cards.length;
    if (avgRank > Rank.QUEEN) {
      score *= 0.7;
    }
    
    // Bonus for using low cards
    if (avgRank < Rank.SEVEN) {
      score *= 1.3;
    }
    
    // Penalty for breaking up potential melds
    const remainingCards = context.myHand.filter(c => 
      !cards.some(pc => pc.code === c.code)
    );
    const currentMelds = this.analyzer.findAllMelds(context.myHand);
    const futureMelds = this.analyzer.findAllMelds(remainingCards);
    
    let totalCurrentMelds = 0;
    let totalFutureMelds = 0;
    currentMelds.forEach(m => totalCurrentMelds += m.length);
    futureMelds.forEach(m => totalFutureMelds += m.length);
    
    if (totalFutureMelds < totalCurrentMelds * 0.8) {
      score *= 0.8;
    }
    
    return Math.min(1, Math.max(0, score));
  }

  private calculateMeldStrength(cards: Card[]): number {
    const maxRank = Math.max(...cards.map(c => c.rank));
    const avgRank = cards.reduce((sum, c) => sum + c.rank, 0) / cards.length;
    return (maxRank + avgRank) / 34; // Normalize
  }

  private allSameRank(cards: Card[]): boolean {
    return cards.every(c => c.rank === cards[0].rank);
  }
}
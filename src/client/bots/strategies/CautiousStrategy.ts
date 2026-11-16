import { BaseStrategy } from './BaseStrategy';
import type { BotDecision, GameContext } from '../types';
import type { Card } from '../../types/game';
import { Rank } from '../../types/game';
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
        reasoning: 'No melds available (ERROR - leader should not pass)'
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
    // CAUTIOUS: Still play most of the time, but prefer low cards
    
    // Separate plays by card strength
    const lowCardPlays = validPlays.filter(play => {
      const avgRank = play.reduce((sum, c) => sum + c.rank, 0) / play.length;
      return avgRank < Rank.EIGHT;
    });
    
    const highCardPlays = validPlays.filter(play => {
      const avgRank = play.reduce((sum, c) => sum + c.rank, 0) / play.length;
      return avgRank >= Rank.QUEEN;
    });
    
    // Cautious bots still play 60-70% of the time
    if (this.shouldPlay(context, 0.7, 0.7)) {
      let chosenPlay: Card[] | null = null;
      
      // Prefer low card plays
      if (lowCardPlays.length > 0) {
        // Sort by size (prefer singles/pairs) then by rank
        lowCardPlays.sort((a, b) => {
          if (a.length !== b.length) return a.length - b.length;
          const avgA = a.reduce((sum, c) => sum + c.rank, 0) / a.length;
          const avgB = b.reduce((sum, c) => sum + c.rank, 0) / b.length;
          return avgA - avgB;
        });
        chosenPlay = lowCardPlays[0];
      }
      // If no low cards, play the smallest meld
      else {
        validPlays.sort((a, b) => a.length - b.length);
        chosenPlay = validPlays[0];
      }
      
      if (chosenPlay) {
        return {
          action: 'play',
          cards: chosenPlay,
          confidence: 0.7,
          reasoning: `Cautious play with low cards (${chosenPlay.length} card${chosenPlay.length > 1 ? 's' : ''})`
        };
      }
    }
    
    // More likely to pass than aggressive bots
    return {
      action: 'pass',
      confidence: 0.8,
      reasoning: 'Waiting for lower cards'
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
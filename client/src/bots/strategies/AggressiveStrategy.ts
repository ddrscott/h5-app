import { BaseStrategy } from './BaseStrategy';
import { BotDecision, GameContext } from '../types';
import { Card } from '../../types/game';

/**
 * Aggressive strategy - plays often and takes risks
 */
export class AggressiveStrategy extends BaseStrategy {
  protected async makeLeaderDecision(context: GameContext): Promise<BotDecision> {
    const allMelds = this.analyzer.findAllMelds(context.myHand);
    
    // Aggressive bot prefers to play big melds when leading
    const meldsBySize: Card[][] = [];
    allMelds.forEach(meldsOfType => {
      meldsBySize.push(...meldsOfType);
    });
    
    // Sort by size (descending) - aggressive bots like big plays
    meldsBySize.sort((a, b) => b.length - a.length);
    
    if (meldsBySize.length === 0) {
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
    
    // Pick one of the larger melds
    const topMelds = meldsBySize.slice(0, 3);
    const chosen = topMelds[Math.floor(Math.random() * topMelds.length)];
    
    return {
      action: 'play',
      cards: chosen,
      confidence: 0.9,
      reasoning: `Leading with ${chosen.length} card(s)`
    };
  }

  protected async choosePlay(context: GameContext, validPlays: Card[][]): Promise<BotDecision> {
    // SIMPLE RULE: Play the smallest valid meld to save bigger cards
    // This is what real players do!
    
    // Sort plays by number of cards (ascending) - use fewest cards possible
    validPlays.sort((a, b) => a.length - b.length);
    
    // Among plays of the same size, prefer lower ranks
    const smallestPlays = validPlays.filter(play => play.length === validPlays[0].length);
    smallestPlays.sort((a, b) => {
      const avgRankA = a.reduce((sum, c) => sum + c.rank, 0) / a.length;
      const avgRankB = b.reduce((sum, c) => sum + c.rank, 0) / b.length;
      return avgRankA - avgRankB;
    });
    
    // Aggressive bots ALWAYS play if they can
    if (this.shouldPlay(context, 1.0, 0.5)) {
      // Pick from the smallest plays with some randomness
      const topChoices = smallestPlays.slice(0, Math.min(3, smallestPlays.length));
      const chosen = topChoices[Math.floor(Math.random() * topChoices.length)];
      
      return {
        action: 'play',
        cards: chosen,
        confidence: 0.9,
        reasoning: `Playing minimum cards (${chosen.length}) to stay in the game`
      };
    }
    
    // Rare pass for aggressive bots
    return {
      action: 'pass',
      confidence: 0.3,
      reasoning: 'Strategic pass (rare for aggressive)'
    };
  }

  private calculatePlayStrength(cards: Card[]): number {
    // Simple strength calculation based on highest card
    const maxRank = Math.max(...cards.map(c => c.rank));
    return maxRank / 17; // Normalize to 0-1
  }

  // Override to be more aggressive in late game
  protected shouldPlay(context: GameContext, playStrength: number, cardValue: number): boolean {
    const myPlayer = context.players.get(context.myPlayerId);
    const handSize = myPlayer?.handCount || context.myHand.length;
    
    // Super aggressive when getting low on cards
    if (handSize <= 5) {
      return playStrength > 0.2;
    }
    
    return super.shouldPlay(context, playStrength, cardValue);
  }
}
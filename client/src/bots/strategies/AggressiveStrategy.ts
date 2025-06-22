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
    // Evaluate each play
    const evaluatedPlays = validPlays.map(play => ({
      cards: play,
      evaluation: this.evaluatePlay(play, context),
      strength: this.calculatePlayStrength(play)
    }));
    
    // Sort by evaluation score
    evaluatedPlays.sort((a, b) => b.evaluation - a.evaluation);
    
    // Aggressive strategy: play if we have anything decent
    const bestPlay = evaluatedPlays[0];
    
    // Low threshold for playing
    const playThreshold = 0.3 - (this.config.personality.aggressiveness * 0.2);
    
    if (bestPlay.evaluation > playThreshold) {
      // Sometimes play a slightly weaker option for unpredictability
      const topPlays = evaluatedPlays.filter(p => p.evaluation > bestPlay.evaluation * 0.8);
      const chosen = topPlays[Math.floor(Math.random() * Math.min(3, topPlays.length))];
      
      return {
        action: 'play',
        cards: chosen.cards,
        confidence: Math.min(0.95, chosen.evaluation + 0.3),
        reasoning: `Aggressive play with evaluation ${chosen.evaluation.toFixed(2)}`
      };
    }
    
    // Even aggressive bots sometimes pass
    return {
      action: 'pass',
      confidence: 0.6,
      reasoning: 'Waiting for better opportunity'
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
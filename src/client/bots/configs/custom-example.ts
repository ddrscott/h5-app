import type { BotConfig, BotDecision, GameContext } from '../types';
import { BotStrategy } from '../types';
import { createCustomBot } from './index';
import type { Card } from '../../types/game';

/**
 * Example of creating custom bot configurations
 * This shows how users can create their own unique bots
 */

// Example 1: The Trash Talker
export const TRASH_TALKER_BOT: BotConfig = createCustomBot(
  "Trash Talker Tony",
  {
    aggressiveness: 0.8,
    riskTolerance: 0.7,
    bluffingTendency: 0.9,
    patience: 0.2,
    adaptability: 0.4,
  },
  {
    avatar: "😈",
    skillLevel: 'intermediate',
    decisionDelay: { min: 300, max: 1000 }, // Quick decisions to annoy
    chatEnabled: true,
    chatPhrases: {
      greeting: ["Ez game ez life", "Prepare to lose", "I'm gonna destroy you all"],
      winning: ["Get rekt!", "2EZ4ME", "Is that all you got?", "💀💀💀"],
      losing: ["Lag!", "Lucky cards!", "My grandma plays better"],
      goodPlay: ["Lucky...", "Meh, I've seen better", "Beginner's luck"],
      pass: ["Boring hand", "Wake me when it's interesting", "😴"],
    },
  }
);

// Example 2: The Analyzer
export const ANALYZER_BOT: BotConfig = createCustomBot(
  "Analytical Alex",
  {
    aggressiveness: 0.4,
    riskTolerance: 0.3,
    bluffingTendency: 0.5,
    patience: 0.9,
    adaptability: 1.0, // Maximum adaptability
  },
  {
    avatar: "🧮",
    skillLevel: 'expert',
    decisionDelay: { min: 3000, max: 5000 }, // Takes time to "calculate"
    chatEnabled: true,
    chatPhrases: {
      greeting: ["Calculating optimal strategies...", "Analyzing opponents...", "Probability matrices loaded"],
      winning: ["As calculated", "Statistical inevitability", "Optimal outcome achieved"],
      losing: ["Variance detected", "Recalculating...", "Anomaly in probability matrix"],
      goodPlay: ["Probability: 23.7%", "Unexpected variable", "Interesting deviation"],
      pass: ["Suboptimal play detected", "Waiting for 73.2% win probability", "Pass - EV negative"],
    },
  }
);

// Example 3: The Role Player
export const KNIGHT_BOT: BotConfig = createCustomBot(
  "Sir Lancelot",
  {
    aggressiveness: 0.7,
    riskTolerance: 0.6,
    bluffingTendency: 0.1, // Knights are honorable
    patience: 0.5,
    adaptability: 0.4,
  },
  {
    avatar: "⚔️",
    skillLevel: 'intermediate',
    decisionDelay: { min: 1500, max: 2500 },
    chatEnabled: true,
    chatPhrases: {
      greeting: ["Hail, fellow warriors!", "For honor and glory!", "May the best knight win!"],
      winning: ["Victory with honor!", "The realm is safe!", "Huzzah!"],
      losing: ["You fought valiantly!", "I yield with grace", "Well fought, champion!"],
      goodPlay: ["A noble play!", "Masterful!", "You wield your cards like a sword!"],
      pass: ["I must retreat", "Strategic withdrawal", "I yield this battle"],
    },
  }
);

// Example 4: Custom Strategy Class
export class ZenMasterStrategy extends BotStrategy {
  private handsWithoutPlaying = 0;
  
  async makeDecision(context: GameContext): Promise<BotDecision> {
    await this.simulateThinking();
    
    // Zen master waits for perfect moments
    if (this.handsWithoutPlaying < 3 && Math.random() > 0.3) {
      this.handsWithoutPlaying++;
      return {
        action: 'pass',
        confidence: 0.9,
        reasoning: 'Waiting for the perfect moment'
      };
    }
    
    // When playing, always play with confidence
    this.handsWithoutPlaying = 0;
    
    // Your custom logic here
    return {
      action: 'play',
      cards: [], // Would select cards based on zen principles
      confidence: 1.0,
      reasoning: 'The moment has arrived'
    };
  }
  
  analyzeHand(cards: Card[]) {
    // Custom hand analysis
    return {
      strength: cards.length / 20, // Simple example
      bestMelds: [],
      bombs: [],
    };
  }
  
  onGameStart() {
    this.handsWithoutPlaying = 0;
  }
}

// Example 5: The Zen Master config using custom strategy
export const ZEN_MASTER_BOT: BotConfig = createCustomBot(
  "Zen Master Zhou",
  {
    aggressiveness: 0.2,
    riskTolerance: 0.1,
    bluffingTendency: 0.0,
    patience: 1.0,
    adaptability: 0.7,
  },
  {
    avatar: "☯️",
    skillLevel: 'expert',
    decisionDelay: { min: 4000, max: 6000 }, // Very contemplative
    chatEnabled: true,
    chatPhrases: {
      greeting: ["🙏", "The cards flow like water", "Welcome, seekers"],
      winning: ["As the river flows to the sea", "Balance is restored", "🕉️"],
      losing: ["The wheel turns", "Victory and defeat are illusions", "Well played"],
      goodPlay: ["The way reveals itself", "Harmony", "Like bamboo in the wind"],
      pass: ["Stillness", "...", "Not yet"],
    },
  }
);

// Example 6: Dynamic bot that changes personality based on game state
export class AdaptiveStrategy extends BotStrategy {
  async makeDecision(context: GameContext): Promise<BotDecision> {
    await this.simulateThinking();
    
    // Get more aggressive when losing
    const myPlayer = context.players.get(context.myPlayerId);
    const isLosing = myPlayer && myPlayer.handCount > 10;
    
    if (isLosing) {
      // Override personality temporarily
      this.config.personality.aggressiveness = Math.min(0.9, this.config.personality.aggressiveness + 0.3);
    }
    
    // Your decision logic here
    return {
      action: 'pass',
      confidence: 0.5,
      reasoning: 'Adaptive strategy in play'
    };
  }
  
  analyzeHand(cards: Card[]) {
    return {
      strength: 0.5,
      bestMelds: [],
      bombs: [],
    };
  }
}

// Example of how users might create tournament-specific bots
export function createTournamentBot(name: string, seed: number): BotConfig {
  // Use seed for consistent but varied personalities
  const random = (min: number, max: number) => {
    const x = Math.sin(seed++) * 10000;
    return min + (x - Math.floor(x)) * (max - min);
  };
  
  return createCustomBot(
    name,
    {
      aggressiveness: random(0.3, 0.8),
      riskTolerance: random(0.2, 0.7),
      bluffingTendency: random(0.1, 0.6),
      patience: random(0.4, 0.9),
      adaptability: random(0.5, 1.0),
    },
    {
      avatar: "🏆",
      skillLevel: 'advanced',
      decisionDelay: { min: 1000, max: 3000 },
      chatEnabled: false, // Tournament bots stay focused
    }
  );
}
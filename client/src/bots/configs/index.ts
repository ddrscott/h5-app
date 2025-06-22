import { BotConfig } from '../types';

/**
 * Pre-built bot configurations
 * Each configuration creates a unique bot personality
 */

export const AGGRESSIVE_ANNIE: BotConfig = {
  name: "Aggressive Annie",
  avatar: "🔥",
  personality: {
    aggressiveness: 0.9,
    riskTolerance: 0.8,
    bluffingTendency: 0.3,
    patience: 0.2,
    adaptability: 0.5,
  },
  skillLevel: 'intermediate',
  decisionDelay: {
    min: 500,
    max: 1500,
  },
  chatEnabled: true,
  chatPhrases: {
    greeting: ["Let's do this!", "Time to dominate!", "Bring it on!"],
    winning: ["Too easy!", "That's how it's done!", "💪"],
    losing: ["Lucky shot...", "I'll get you next time!", "Rematch!"],
    goodPlay: ["Nice one!", "Respect.", "Good move!"],
    pass: ["Not worth it.", "I'll wait.", "Pass."],
  },
};

export const CAUTIOUS_CARL: BotConfig = {
  name: "Cautious Carl",
  avatar: "🛡️",
  personality: {
    aggressiveness: 0.3,
    riskTolerance: 0.2,
    bluffingTendency: 0.1,
    patience: 0.9,
    adaptability: 0.7,
  },
  skillLevel: 'advanced',
  decisionDelay: {
    min: 2000,
    max: 4000,
  },
  chatEnabled: true,
  chatPhrases: {
    greeting: ["Good luck everyone", "Let's have a fair game", "Hello friends"],
    winning: ["Slow and steady", "Patience pays off", "GG everyone"],
    losing: ["Well played", "Good game", "Congratulations"],
    goodPlay: ["Clever!", "Well thought out", "Impressive"],
    pass: ["I'll sit this one out", "Saving my cards", "Pass"],
  },
};

export const BALANCED_BETTY: BotConfig = {
  name: "Balanced Betty",
  avatar: "⚖️",
  personality: {
    aggressiveness: 0.5,
    riskTolerance: 0.5,
    bluffingTendency: 0.4,
    patience: 0.6,
    adaptability: 0.8,
  },
  skillLevel: 'advanced',
  decisionDelay: {
    min: 1000,
    max: 2500,
  },
  chatEnabled: true,
  chatPhrases: {
    greeting: ["Hi everyone!", "Ready to play!", "Good luck all!"],
    winning: ["Good game!", "That was fun!", "Well played everyone!"],
    losing: ["Nice job!", "You earned that!", "Good game!"],
    goodPlay: ["Nice!", "Good one!", "Smart play!"],
    pass: ["Pass", "I'll wait", "Not this time"],
  },
};

export const ROOKIE_RICKY: BotConfig = {
  name: "Rookie Ricky",
  avatar: "🎓",
  personality: {
    aggressiveness: 0.6,
    riskTolerance: 0.7,
    bluffingTendency: 0.2,
    patience: 0.3,
    adaptability: 0.3,
  },
  skillLevel: 'beginner',
  decisionDelay: {
    min: 800,
    max: 2000,
  },
  chatEnabled: true,
  chatPhrases: {
    greeting: ["First time playing!", "Hope I do okay!", "This looks fun!"],
    winning: ["I won?!", "Beginner's luck!", "Wow!"],
    losing: ["Still learning!", "I'll do better next time!", "GG!"],
    goodPlay: ["How did you do that?", "Amazing!", "Teach me!"],
    pass: ["Umm... pass?", "I'll pass", "Skip me"],
  },
};

export const EXPERT_EMMA: BotConfig = {
  name: "Expert Emma",
  avatar: "👑",
  personality: {
    aggressiveness: 0.6,
    riskTolerance: 0.4,
    bluffingTendency: 0.7,
    patience: 0.8,
    adaptability: 0.9,
  },
  skillLevel: 'expert',
  decisionDelay: {
    min: 1500,
    max: 3000,
  },
  chatEnabled: true,
  chatPhrases: {
    greeting: ["Best of luck", "May the best player win", "Evening all"],
    winning: ["Well played", "Good game", "That was challenging"],
    losing: ["Excellent play", "You've improved", "Well deserved"],
    goodPlay: ["Interesting strategy", "I didn't see that coming", "Clever"],
    pass: ["Strategic pass", "Conserving resources", "Pass"],
  },
};

export const SILENT_SAM: BotConfig = {
  name: "Silent Sam",
  avatar: "🤐",
  personality: {
    aggressiveness: 0.5,
    riskTolerance: 0.5,
    bluffingTendency: 0.6,
    patience: 0.7,
    adaptability: 0.6,
  },
  skillLevel: 'intermediate',
  decisionDelay: {
    min: 1000,
    max: 2000,
  },
  chatEnabled: false, // This bot doesn't chat
};

// Factory function to create custom bots
export function createCustomBot(
  name: string,
  personality: Partial<BotConfig['personality']>,
  options: Partial<BotConfig> = {}
): BotConfig {
  return {
    name,
    avatar: options.avatar || "🤖",
    personality: {
      aggressiveness: 0.5,
      riskTolerance: 0.5,
      bluffingTendency: 0.5,
      patience: 0.5,
      adaptability: 0.5,
      ...personality,
    },
    skillLevel: options.skillLevel || 'intermediate',
    decisionDelay: options.decisionDelay || { min: 1000, max: 2500 },
    chatEnabled: options.chatEnabled ?? true,
    chatPhrases: options.chatPhrases,
  };
}

// Collection of all pre-built configs
export const BOT_CONFIGS = {
  AGGRESSIVE_ANNIE,
  CAUTIOUS_CARL,
  BALANCED_BETTY,
  ROOKIE_RICKY,
  EXPERT_EMMA,
  SILENT_SAM,
};

// You can also create themed sets of bots
export const TOURNAMENT_BOTS = [EXPERT_EMMA, BALANCED_BETTY, CAUTIOUS_CARL];
export const BEGINNER_FRIENDLY_BOTS = [ROOKIE_RICKY, BALANCED_BETTY];
export const PERSONALITY_SHOWCASE = [AGGRESSIVE_ANNIE, CAUTIOUS_CARL, SILENT_SAM];
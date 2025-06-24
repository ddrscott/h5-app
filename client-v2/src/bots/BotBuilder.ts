import type { BotConfig, BotPersonality } from './types';

/**
 * Fluent builder pattern for creating custom bots
 * Makes it easy to create bots with specific characteristics
 */
export class BotBuilder {
  private config: BotConfig = {
    name: "Custom Bot",
    avatar: "🤖",
    personality: {
      aggressiveness: 0.5,
      riskTolerance: 0.5,
      bluffingTendency: 0.5,
      patience: 0.5,
      adaptability: 0.5,
    },
    skillLevel: 'intermediate',
    decisionDelay: {
      min: 1000,
      max: 2500,
    },
    chatEnabled: false,
  };

  constructor(name: string) {
    this.config.name = name;
  }

  // Static factory method
  static create(name: string): BotBuilder {
    return new BotBuilder(name);
  }

  // Personality methods
  withAggressiveness(value: number): BotBuilder {
    this.config.personality.aggressiveness = Math.max(0, Math.min(1, value));
    return this;
  }

  withRiskTolerance(value: number): BotBuilder {
    this.config.personality.riskTolerance = Math.max(0, Math.min(1, value));
    return this;
  }

  withBluffingTendency(value: number): BotBuilder {
    this.config.personality.bluffingTendency = Math.max(0, Math.min(1, value));
    return this;
  }

  withPatience(value: number): BotBuilder {
    this.config.personality.patience = Math.max(0, Math.min(1, value));
    return this;
  }

  withAdaptability(value: number): BotBuilder {
    this.config.personality.adaptability = Math.max(0, Math.min(1, value));
    return this;
  }

  withPersonality(personality: Partial<BotPersonality>): BotBuilder {
    this.config.personality = { ...this.config.personality, ...personality };
    return this;
  }

  // Skill level methods
  asBeginner(): BotBuilder {
    this.config.skillLevel = 'beginner';
    return this;
  }

  asIntermediate(): BotBuilder {
    this.config.skillLevel = 'intermediate';
    return this;
  }

  asAdvanced(): BotBuilder {
    this.config.skillLevel = 'advanced';
    return this;
  }

  asExpert(): BotBuilder {
    this.config.skillLevel = 'expert';
    return this;
  }

  withSkillLevel(level: BotConfig['skillLevel']): BotBuilder {
    this.config.skillLevel = level;
    return this;
  }

  // Avatar and appearance
  withAvatar(avatar: string): BotBuilder {
    this.config.avatar = avatar;
    return this;
  }

  // Decision timing
  withDecisionDelay(min: number, max: number): BotBuilder {
    this.config.decisionDelay = { min, max };
    return this;
  }

  withQuickDecisions(): BotBuilder {
    this.config.decisionDelay = { min: 300, max: 1000 };
    return this;
  }

  withThoughtfulDecisions(): BotBuilder {
    this.config.decisionDelay = { min: 2000, max: 4000 };
    return this;
  }

  // Chat configuration
  enableChat(phrases?: BotConfig['chatPhrases']): BotBuilder {
    this.config.chatEnabled = true;
    if (phrases) {
      this.config.chatPhrases = phrases;
    }
    return this;
  }

  disableChat(): BotBuilder {
    this.config.chatEnabled = false;
    this.config.chatPhrases = undefined;
    return this;
  }

  withChatPhrases(phrases: BotConfig['chatPhrases']): BotBuilder {
    this.config.chatEnabled = true;
    this.config.chatPhrases = phrases;
    return this;
  }

  // Preset personalities
  makeAggressive(): BotBuilder {
    return this
      .withAggressiveness(0.8)
      .withRiskTolerance(0.7)
      .withPatience(0.3)
      .withQuickDecisions();
  }

  makeCautious(): BotBuilder {
    return this
      .withAggressiveness(0.3)
      .withRiskTolerance(0.2)
      .withPatience(0.8)
      .withThoughtfulDecisions();
  }

  makeBalanced(): BotBuilder {
    return this
      .withAggressiveness(0.5)
      .withRiskTolerance(0.5)
      .withPatience(0.5)
      .withDecisionDelay(1500, 2500);
  }

  makeChaotic(): BotBuilder {
    return this
      .withAggressiveness(Math.random())
      .withRiskTolerance(Math.random())
      .withBluffingTendency(Math.random())
      .withPatience(Math.random())
      .withAdaptability(Math.random());
  }

  // Build method
  build(): BotConfig {
    return JSON.parse(JSON.stringify(this.config)); // Deep clone
  }
}

// Example usage:
/*
const myBot = BotBuilder.create("My Custom Bot")
  .withAvatar("🎯")
  .asAdvanced()
  .makeAggressive()
  .withBluffingTendency(0.7)
  .enableChat({
    greeting: ["Let's go!", "Game on!"],
    winning: ["Yes!", "Got 'em!"],
    losing: ["Nice one", "Well played"],
    goodPlay: ["Good move!", "Nice!"],
    pass: ["Pass", "Skip"],
  })
  .build();

// Or create a specific type of bot
const quietExpert = BotBuilder.create("Silent Expert")
  .withAvatar("🥷")
  .asExpert()
  .makeCautious()
  .withAdaptability(0.9)
  .disableChat()
  .build();

// Random personality bot
const chaosBot = BotBuilder.create("Chaos")
  .withAvatar("🎲")
  .makeChaotic()
  .asIntermediate()
  .build();
*/
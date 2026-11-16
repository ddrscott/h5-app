import { BotBuilder } from '../BotBuilder';
import type { BotConfig } from '../types';

/**
 * Bot templates - common archetypes that users can customize
 * Each template is a function that returns a configured BotBuilder
 */

export const BotTemplates = {
  // The newcomer who's still learning
  newPlayer: (name: string = "Newbie") => 
    BotBuilder.create(name)
      .withAvatar("🌱")
      .asBeginner()
      .withAggressiveness(0.6)
      .withRiskTolerance(0.7)
      .withPatience(0.3)
      .withAdaptability(0.2)
      .withDecisionDelay(1000, 3000)
      .enableChat({
        greeting: ["Hi! I'm new here", "Still learning the rules", "Be gentle!"],
        winning: ["Did I win?!", "Yay!", "I can't believe it!"],
        losing: ["I'm still learning", "GG!", "That was fun!"],
        goodPlay: ["Wow!", "How did you do that?", "Nice cards!"],
        pass: ["Umm, pass", "I'll skip", "Not sure what to play"],
      }),

  // The veteran who knows all the tricks
  veteran: (name: string = "Veteran") =>
    BotBuilder.create(name)
      .withAvatar("🎖️")
      .asExpert()
      .withAggressiveness(0.6)
      .withRiskTolerance(0.4)
      .withPatience(0.8)
      .withAdaptability(0.9)
      .withBluffingTendency(0.6)
      .withThoughtfulDecisions()
      .enableChat({
        greeting: ["Good to see you all", "Let's play", "May fortune favor the skilled"],
        winning: ["Experience pays off", "GG everyone", "Well played all"],
        losing: ["You've improved", "Well earned", "Excellent play"],
        goodPlay: ["Clever move", "I see what you did there", "Nicely done"],
        pass: ["Tactical pass", "I'll wait", "Patience..."],
      }),

  // The speedster who plays fast
  speedDemon: (name: string = "Speedy") =>
    BotBuilder.create(name)
      .withAvatar("⚡")
      .asIntermediate()
      .makeAggressive()
      .withQuickDecisions()
      .enableChat({
        greeting: ["Let's gooo!", "Fast game please!", "Ready!"],
        winning: ["Speed wins!", "Too fast for you!", "Zoom zoom!"],
        losing: ["Too slow this time", "I'll be faster!", "Quick rematch?"],
        goodPlay: ["Fast!", "Quick thinking!", "Speedy!"],
        pass: ["Pass!", "Skip!", "Next!"],
      }),

  // The calculator who overthinks everything
  mathematician: (name: string = "Calculator") =>
    BotBuilder.create(name)
      .withAvatar("🤓")
      .asAdvanced()
      .withAggressiveness(0.4)
      .withRiskTolerance(0.3)
      .withPatience(0.9)
      .withAdaptability(0.8)
      .withDecisionDelay(3000, 5000)
      .enableChat({
        greeting: ["Calculating probabilities...", "Let me analyze the odds", "Initializing algorithms"],
        winning: ["As predicted by my calculations", "Mathematical certainty", "QED"],
        losing: ["Impossible! Let me recalculate", "Statistical anomaly", "Variance..."],
        goodPlay: ["Probability of that: 2.7%", "Fascinating strategy", "Optimal play detected"],
        pass: ["Expected value: negative", "Suboptimal hand", "Pass - 87% confidence"],
      }),

  // The friendly player who just wants fun
  friendly: (name: string = "Friendly") =>
    BotBuilder.create(name)
      .withAvatar("😊")
      .asIntermediate()
      .makeBalanced()
      .enableChat({
        greeting: ["Hi everyone! 😊", "Happy to play with you all!", "Let's have fun!"],
        winning: ["That was fun!", "Great game everyone!", "Thanks for playing!"],
        losing: ["Congrats! Well deserved!", "You played great!", "That was awesome!"],
        goodPlay: ["Nice one! 👏", "Brilliant!", "Love that play!"],
        pass: ["I'll pass this round", "You go ahead", "Pass 😊"],
      }),

  // The intimidator who tries to psych out opponents
  intimidator: (name: string = "Intimidator") =>
    BotBuilder.create(name)
      .withAvatar("💀")
      .asAdvanced()
      .withAggressiveness(0.8)
      .withBluffingTendency(0.9)
      .withRiskTolerance(0.7)
      .enableChat({
        greeting: ["Prepare to lose", "This won't take long", "Fear me"],
        winning: ["Too easy", "As expected", "Dominated"],
        losing: ["You got lucky", "Rematch, now", "This isn't over"],
        goodPlay: ["Decent... for you", "I've seen better", "Lucky"],
        pass: ["Boring", "Wake me when it's interesting", "Whatever"],
      }),

  // The silent but deadly player
  ninja: (name: string = "Shadow") =>
    BotBuilder.create(name)
      .withAvatar("🥷")
      .asExpert()
      .withAggressiveness(0.5)
      .withPatience(0.8)
      .withBluffingTendency(0.7)
      .withAdaptability(0.9)
      .disableChat(), // Ninjas don't talk

  // The lucky one who seems to always win
  lucky: (name: string = "Lucky") =>
    BotBuilder.create(name)
      .withAvatar("🍀")
      .asIntermediate()
      .withAggressiveness(0.7)
      .withRiskTolerance(0.8)
      .withBluffingTendency(0.4)
      .enableChat({
        greeting: ["Feeling lucky today! 🍀", "My lucky day!", "Fortune favors me!"],
        winning: ["Lucky again! 🎰", "The cards love me!", "Another lucky win!"],
        losing: ["My luck ran out!", "Need a new lucky charm", "Still lucky to play with you!"],
        goodPlay: ["Lucky you!", "What are the odds?!", "Fortune smiles on you!"],
        pass: ["Waiting for my lucky moment", "Not feeling it", "Pass 🎲"],
      }),
};

// Helper function to create a bot from a template
export function createBotFromTemplate(
  template: keyof typeof BotTemplates,
  customName?: string,
  customizations?: (builder: BotBuilder) => BotBuilder
): BotConfig {
  let builder = BotTemplates[template](customName);
  
  if (customizations) {
    builder = customizations(builder);
  }
  
  return builder.build();
}

// Example: Create variations of templates
export const TemplateVariations = {
  // Super aggressive newbie
  recklessNewbie: () => 
    createBotFromTemplate('newPlayer', 'Wild Newbie', (builder) =>
      builder
        .withAvatar("🔥")
        .withAggressiveness(0.9)
        .withRiskTolerance(0.9)
    ),

  // Cautious veteran
  wiseElder: () =>
    createBotFromTemplate('veteran', 'Wise Elder', (builder) =>
      builder
        .withAvatar("🧙")
        .makeCautious()
        .withPatience(1.0)
    ),

  // Chatty mathematician
  professorBot: () =>
    createBotFromTemplate('mathematician', 'Professor', (builder) =>
      builder
        .withAvatar("👨‍🏫")
        .withChatPhrases({
          greeting: ["Class is in session", "Today's lesson: probability", "Welcome, students"],
          winning: ["QED - quite easily done", "As theorem 3.2 predicts", "Elementary, really"],
          losing: ["An interesting proof by contradiction", "Back to the drawing board", "Fascinating result"],
          goodPlay: ["Excellent application of game theory", "See equation 4.7", "Textbook play"],
          pass: ["Insufficient data", "Awaiting optimal conditions", "Theorem incomplete"],
        })
    ),
};

// Quick bot creation for different game modes
export const QuickBots = {
  // For testing - creates a mix of skill levels
  testingSet: () => [
    BotTemplates.newPlayer("Test Rookie").build(),
    BotTemplates.friendly("Test Friend").build(),
    BotTemplates.veteran("Test Veteran").build(),
  ],

  // For beginners - friendly and forgiving bots
  beginnerFriendly: () => [
    BotTemplates.newPlayer("Fellow Beginner").build(),
    BotTemplates.friendly("Helpful Friend").build(),
    createBotFromTemplate('veteran', 'Patient Teacher', (b) => 
      b.makeCautious().withPatience(0.9)
    ),
  ],

  // For experienced players - challenging bots
  competitive: () => [
    BotTemplates.veteran("Master").build(),
    BotTemplates.intimidator("Destroyer").build(),
    BotTemplates.ninja("Silent Assassin").build(),
  ],

  // For fun - personality-heavy bots
  personalityPack: () => [
    BotTemplates.lucky("Fortune").build(),
    BotTemplates.speedDemon("Lightning").build(),
    BotTemplates.mathematician("Einstein").build(),
    BotTemplates.intimidator("Villain").build(),
  ],
};
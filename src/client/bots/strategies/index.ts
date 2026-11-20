export { BaseStrategy } from './BaseStrategy';
export { AggressiveStrategy } from './AggressiveStrategy';
export { CautiousStrategy } from './CautiousStrategy';
export { BalancedStrategy } from './BalancedStrategy';
export { ContractStrategy } from './ContractStrategy';

// Strategy factory
import type { BotConfig, BotStrategy } from '../types';
import { AggressiveStrategy } from './AggressiveStrategy';
import { CautiousStrategy } from './CautiousStrategy';
import { BalancedStrategy } from './BalancedStrategy';
import { ContractStrategy } from './ContractStrategy';
import { personaBot } from '../builtin';
import { PERSONAS, clampThinkSeconds, isPersonaId } from '../personas';

/**
 * A bot with a persona thinks with the search (through the decide(view) contract); the old
 * strategy stands behind it in case the search ever fails. A bot without one plays the old way.
 */
export function createStrategyForConfig(config: BotConfig): BotStrategy {
  if (!isPersonaId(config.persona)) return createLegacyStrategy(config);
  const seconds = clampThinkSeconds(config.thinkSeconds, PERSONAS[config.persona].thinkSeconds);
  const fallback = createLegacyStrategy({ ...config, decisionDelay: { min: 0, max: 0 } });
  // A bot never snaps a card down the instant it's asked, even when the move is forced.
  return new ContractStrategy(config, personaBot(config.persona), fallback, seconds * 1000, { minDelayMs: 450 });
}

/** The old rule-based strategies, picked by the personality numbers. They back up the search bots. */
export function createLegacyStrategy(config: BotConfig): BotStrategy {
  const { aggressiveness, patience } = config.personality;
  
  if (aggressiveness > 0.7) {
    return new AggressiveStrategy(config);
  } else if (patience > 0.7 && aggressiveness < 0.4) {
    return new CautiousStrategy(config);
  } else {
    return new BalancedStrategy(config);
  }
}

// You can also explicitly choose a strategy
export function createStrategy(
  type: 'aggressive' | 'cautious' | 'balanced',
  config: BotConfig
): BotStrategy {
  switch (type) {
    case 'aggressive':
      return new AggressiveStrategy(config);
    case 'cautious':
      return new CautiousStrategy(config);
    case 'balanced':
    default:
      return new BalancedStrategy(config);
  }
}
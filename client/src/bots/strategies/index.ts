export { BaseStrategy } from './BaseStrategy';
export { AggressiveStrategy } from './AggressiveStrategy';
export { CautiousStrategy } from './CautiousStrategy';
export { BalancedStrategy } from './BalancedStrategy';

// Strategy factory
import { BotConfig, BotStrategy } from '../types';
import { AggressiveStrategy } from './AggressiveStrategy';
import { CautiousStrategy } from './CautiousStrategy';
import { BalancedStrategy } from './BalancedStrategy';

export function createStrategyForConfig(config: BotConfig): BotStrategy {
  // Choose strategy based on personality
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
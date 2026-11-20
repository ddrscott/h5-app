import type { BotDecide } from './contract';
import { PERSONAS } from './personas';
import type { PersonaId } from './personas';
import { think, thinkSync } from './search/engine';

export interface BuiltinOptions {
  /** seeded randomness, for tests and self-play */
  rng?: () => number;
  /** think with a fixed number of rollouts instead of the view's time budget (answers at once) */
  rollouts?: number;
  /** overrides the persona's choice of tree search or plain playouts */
  tree?: boolean;
}

/**
 * A built-in personality as a contract bot: decide(view) -> move. Everything it knows comes in
 * through the view, the same as a bot written by anyone else.
 */
export function personaBot(id: PersonaId, options: BuiltinOptions = {}): BotDecide {
  const persona = PERSONAS[id];
  if (options.rollouts !== undefined) {
    return (view) => thinkSync(view, { persona, rng: options.rng, rollouts: options.rollouts, tree: options.tree }).move;
  }
  return async (view) => (await think(view, { persona, rng: options.rng, tree: options.tree })).move;
}

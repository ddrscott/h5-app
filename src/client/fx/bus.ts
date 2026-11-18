/**
 * Game moments the visuals react to. useGameState emits them as the server's messages arrive;
 * the table subscribes. Nothing here changes game state.
 */
export type FxEvent =
  | { type: 'meld'; playerId: string; cards: string[]; meldType: string }
  | { type: 'pass'; playerId: string }
  | { type: 'newLeader'; playerId: string }
  | { type: 'yourTurn' }
  | { type: 'gameStarted'; round: number }
  | { type: 'gameEnded'; winnerId: string | null }
  | { type: 'error'; message: string };

type Listener = (e: FxEvent) => void;
const listeners = new Set<Listener>();

export const bus = {
  emit(e: FxEvent) { listeners.forEach((l) => l(e)); },
  on(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
};

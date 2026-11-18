import { prefs } from './prefs';

/** Short vibration taps on phones that support them. Off when the game is muted. */
function buzz(pattern: number | number[]) {
  if (prefs.muted()) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(pattern); } catch { /* not allowed until a gesture */ }
}

export const haptics = {
  tap: () => buzz(8),
  yourTurn: () => buzz([18, 60, 18]),
  bomb: () => buzz([40, 30, 90]),
  heart5: () => buzz([25, 40, 25, 40, 70]),
  win: () => buzz([30, 50, 30, 50, 120]),
};

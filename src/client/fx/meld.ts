import type { Card } from '../types/game';

/** How loud a play is: drives the callout size, sound, shake and particles. */
export interface PlayFx {
  label: string | null;
  level: 0 | 1 | 2 | 3 | 4;
  /** 4 is the Heart of Five */
  heart5?: boolean;
}

export const isHeart5 = (c: { suit: string; rank: number }) => c.suit === 'H' && c.rank === 5;

export function playFx(type: string | undefined, cards: Card[]): PlayFx {
  if (cards.length === 1 && isHeart5(cards[0])) return { label: 'HEART OF FIVE', level: 4, heart5: true };
  switch (type) {
    case 'SINGLE': {
      const r = cards[0]?.rank ?? 0;
      if (r === 17) return { label: 'BIG JOKER', level: 1 };
      if (r === 16) return { label: 'JOKER', level: 1 };
      return { label: null, level: 0 };
    }
    case 'PAIR': return { label: 'PAIR', level: 1 };
    case 'THREE_OF_KIND': return { label: 'TRIPLE', level: 1 };
    case 'FULL_HOUSE': return { label: 'FULL HOUSE', level: 2 };
    case 'SISTERS': return { label: 'SISTERS', level: 2 };
    case 'RUN': return { label: cards.length >= 8 ? `STRAIGHT ×${cards.length}` : 'STRAIGHT', level: 2 };
    case 'BOMB': return { label: 'BOMB!', level: 3 };
    case 'STRAIGHT_FLUSH': return { label: 'STRAIGHT FLUSH!', level: 3 };
    default: return { label: null, level: 0 };
  }
}

/**
 * A best-effort name for what you've selected, shown on the Play button. The server decides what's
 * legal; this only labels obvious shapes and stays quiet otherwise.
 */
export function selectionLabel(cards: Card[]): string | null {
  const n = cards.length;
  if (n === 0) return null;
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);
  const counts = new Map<number, number>();
  ranks.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
  const groups = [...counts.values()].sort((a, b) => b - a);
  const jokers = ranks.some((r) => r >= 16);
  if (n === 1) return isHeart5(cards[0]) ? 'Heart of 5' : 'Single';
  if (jokers) return null;
  if (groups.length === 1) return n === 2 ? 'Pair' : n === 3 ? 'Triple' : n === 4 ? 'Bomb' : null;
  if (n === 5 && groups[0] === 3 && groups[1] === 2) return 'Full house';
  const uniq = [...counts.keys()].sort((a, b) => a - b);
  const consecutive = uniq.every((r, i) => i === 0 || r === uniq[i - 1] + 1);
  if (consecutive && groups.every((g) => g === 1) && n >= 5) {
    const flush = cards.every((c) => c.suit === cards[0].suit);
    return flush ? 'Straight flush' : 'Straight';
  }
  if (consecutive && uniq.length >= 3 && groups.every((g) => g === groups[0]) && groups[0] >= 2) return 'Sisters';
  return null;
}

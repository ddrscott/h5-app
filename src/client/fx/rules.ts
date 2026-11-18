import type { Card, Meld } from '../types/game';

/**
 * A port of the server's meld rules (src/worker/game/GameState.ts: Meld.determineMeldType,
 * Meld.calculateStrength and GameState.describeInvalidPlay), so the Play button can say why a
 * selection won't beat the table before the player taps it. The server still decides; keep the
 * two in step when the rules change.
 */
type Kind = 'SINGLE' | 'PAIR' | 'THREE_OF_KIND' | 'BOMB' | 'SISTERS' | 'FULL_HOUSE' | 'RUN' | 'STRAIGHT_FLUSH';

const ACE = 14, TWO = 15, SMALL_JOKER = 16, BIG_JOKER = 17, HEART_FIVE = 18;

export interface Shape { type: Kind | null; strength: number; count: number; groups: number; groupSize: number }

function rankCounts(cards: Card[]) {
  const m = new Map<number, number>();
  cards.forEach((c) => m.set(c.rank, (m.get(c.rank) ?? 0) + 1));
  return m;
}

function isRun(cards: Card[]) {
  if (cards.length < 5) return false;
  const ranks = [...new Set(cards.map((c) => c.rank))];
  if (ranks.length !== cards.length) return false;
  if (ranks.includes(TWO)) {
    const wheel = [ACE, TWO, 3, 4, 5];
    return ranks.length === 5 && ranks.every((r) => wheel.includes(r));
  }
  const s = [...ranks].sort((a, b) => a - b);
  return s.every((r, i) => i === 0 || r === s[i - 1] + 1);
}

function isSisters(cards: Card[]) {
  if (cards.length < 4) return false;
  const m = rankCounts(cards);
  const sizes = [...m.values()];
  const g = sizes[0];
  if (g < 2 || g > 3 || !sizes.every((x) => x === g)) return false;
  const s = [...m.keys()].sort((a, b) => a - b);
  return s.every((r, i) => i === 0 || r === s[i - 1] + 1);
}

function kindOf(cards: Card[]): Kind | null {
  const n = cards.length;
  const same = cards.every((c) => c.rank === cards[0].rank);
  if (n === 1) return 'SINGLE';
  if (n === 2 && same && cards[0].rank !== SMALL_JOKER && cards[0].rank !== BIG_JOKER) return 'PAIR';
  if (n === 3 && same) return 'THREE_OF_KIND';
  if (n === 4 && same) return 'BOMB';
  if (n === 5) {
    const counts = [...rankCounts(cards).values()].sort();
    if (counts.length === 2 && counts[0] === 2 && counts[1] === 3) return 'FULL_HOUSE';
  }
  if (n >= 4 && isSisters(cards)) return 'SISTERS';
  if (n >= 5 && isRun(cards)) return new Set(cards.map((c) => c.suit)).size === 1 ? 'STRAIGHT_FLUSH' : 'RUN';
  return null;
}

export function shapeOf(cards: Card[]): Shape {
  const type = kindOf(cards);
  const groups = new Set(cards.map((c) => c.rank)).size;
  const base = { type, count: cards.length, groups, groupSize: groups ? cards.length / groups : 0 };
  const ranks = cards.map((c) => c.rank);
  let strength = 0;
  switch (type) {
    case 'SINGLE': strength = cards[0].suit === 'H' && cards[0].rank === 5 ? HEART_FIVE : cards[0].rank; break;
    case 'PAIR': case 'THREE_OF_KIND': case 'BOMB': strength = cards[0].rank; break;
    case 'FULL_HOUSE': for (const [r, k] of rankCounts(cards)) if (k === 3) strength = r; break;
    case 'SISTERS': strength = Math.max(...ranks); break;
    case 'RUN': case 'STRAIGHT_FLUSH':
      strength = [ACE, TWO, 3, 4, 5].every((r) => ranks.includes(r)) ? 5 : Math.max(...ranks);
      break;
  }
  return { ...base, strength };
}

const NAME: Record<Kind, string> = {
  SINGLE: 'single', PAIR: 'pair', THREE_OF_KIND: 'triple', BOMB: 'bomb', SISTERS: 'sisters',
  FULL_HOUSE: 'full house', RUN: 'straight', STRAIGHT_FLUSH: 'straight flush',
};

/**
 * Null when the selection can go on the table, otherwise a short reason for the Play button
 * ("needs a pair"). Mirrors GameState.describeInvalidPlay.
 */
export function whyNot(cards: Card[], table: Meld | null | undefined): string | null {
  if (cards.length === 0) return null;
  const me = shapeOf(cards);
  if (!me.type) return 'not a set';
  if (!table || !table.cards?.length) return null;
  const t = shapeOf(table.cards);
  if (!t.type) return null; // can't read the table: let the server decide
  const tableBomb = t.type === 'BOMB' || t.type === 'STRAIGHT_FLUSH';
  if (me.type === 'BOMB' || me.type === 'STRAIGHT_FLUSH') {
    if (!tableBomb) return null;
    const beats = me.strength > t.strength || (me.type === 'STRAIGHT_FLUSH' && me.count > t.count);
    return beats ? null : 'needs a higher bomb';
  }
  if (tableBomb) return 'needs a higher bomb';
  if (me.type !== t.type) return `needs a ${NAME[t.type]}`;
  if (me.count !== t.count) return `needs ${t.count} cards`;
  if (me.type === 'SISTERS' && (me.groupSize !== t.groupSize || me.groups !== t.groups)) {
    return `needs ${t.groups} ${t.groupSize === 3 ? 'triples' : 'pairs'}`;
  }
  if (me.strength <= t.strength) return 'too low';
  return null;
}

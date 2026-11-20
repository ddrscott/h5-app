/**
 * Card bookkeeping for the search. The simulator doesn't track 54 separate cards: it counts how
 * many a player holds in each of 16 "slots". Slots 0-12 are the ranks 3 to 2, 13 and 14 are the
 * small and big joker, and 15 is the Five of Hearts on its own, because alone it outranks
 * everything while in a pair or a run it's just another five.
 */

export interface BotCard {
  suit: string;
  rank: number;
  code?: string;
}

export const SLOTS = 16;
export const SLOT_FIVE = 2;
export const SLOT_TWO = 12;
export const SLOT_SMALL_JOKER = 13;
export const SLOT_BIG_JOKER = 14;
export const SLOT_H5 = 15;
/** Runs stop at the ace. */
export const SLOT_ACE = 11;

export const isH5 = (c: BotCard) => c.rank === 5 && c.suit === 'H';

export function slotOf(c: BotCard): number {
  return isH5(c) ? SLOT_H5 : c.rank - 3;
}

/** How strong a slot is as a single card. */
export function slotStrength(slot: number): number {
  return slot === SLOT_H5 ? 18 : slot + 3;
}

const RANK_CODE: Record<number, string> = { 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2' };

/** The same code the room gives a card ("TS", "5H", "jj", "JJ"). */
export function codeOf(c: BotCard): string {
  if (c.code) return c.code;
  if (c.rank === 16) return 'jj';
  if (c.rank === 17) return 'JJ';
  return (RANK_CODE[c.rank] ?? String(c.rank)) + c.suit;
}

/** One full deck: 52 cards and two jokers. */
export const DECK: ReadonlyArray<Required<BotCard>> = (() => {
  const deck: Required<BotCard>[] = [];
  for (const suit of ['C', 'D', 'H', 'S']) {
    for (let rank = 3; rank <= 15; rank++) deck.push({ suit, rank, code: codeOf({ suit, rank }) });
  }
  deck.push({ suit: 'J', rank: 16, code: 'jj' });
  deck.push({ suit: 'J', rank: 17, code: 'JJ' });
  return deck;
})();

/** A small seedable generator (mulberry32). The search and the self-play harness share it. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

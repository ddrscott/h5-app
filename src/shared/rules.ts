/**
 * The meld rules, in one place: what a set of cards is, how strong it is, and whether it may go
 * on the table. Pure functions with no state, so the room (src/worker/game/GameState.ts) and the
 * in-browser bots (src/client/bots) both judge a play with the same code.
 *
 * Cards only need a rank and a suit. Types are plain strings whose values match the MeldType
 * enums on both sides.
 */

export interface RuleCard {
  rank: number;
  suit: string;
}

export type MeldKind =
  | 'SINGLE'
  | 'PAIR'
  | 'THREE_OF_KIND'
  | 'BOMB'
  | 'SISTERS'
  | 'FULL_HOUSE'
  | 'RUN'
  | 'STRAIGHT_FLUSH';

/** A classified meld. `type` is null (or missing) when the cards aren't a meld at all. */
export interface RuleMeld {
  cards: RuleCard[];
  type?: string | null;
  strength: number;
}

const THREE = 3;
const FOUR = 4;
const FIVE = 5;
const ACE = 14;
const TWO = 15;
const SMALL_JOKER = 16;
const BIG_JOKER = 17;
/** The Five of Hearts played alone outranks every other single. */
export const FIVE_OF_HEARTS_STRENGTH = 18;
const HEARTS = 'H';

const MELD_NAMES: Record<string, string> = {
  SINGLE: 'single',
  PAIR: 'pair',
  THREE_OF_KIND: 'three of a kind',
  BOMB: 'bomb',
  SISTERS: 'set of sisters',
  FULL_HOUSE: 'full house',
  RUN: 'run',
  STRAIGHT_FLUSH: 'straight flush',
};

/** A card's strength when played alone. */
export function cardStrength(card: RuleCard): number {
  return card.rank === FIVE && card.suit === HEARTS ? FIVE_OF_HEARTS_STRENGTH : card.rank;
}

function allSameRank(cards: RuleCard[]): boolean {
  return cards.every((card) => card.rank === cards[0].rank);
}

function isPair(cards: RuleCard[]): boolean {
  if (cards.length !== 2) return false;
  // Same rank, and jokers never pair.
  return cards[0].rank === cards[1].rank && cards[0].rank !== SMALL_JOKER && cards[0].rank !== BIG_JOKER;
}

function rankCounts(cards: RuleCard[]): Map<number, number> {
  const ranks = new Map<number, number>();
  cards.forEach((card) => ranks.set(card.rank, (ranks.get(card.rank) || 0) + 1));
  return ranks;
}

function isFullHouse(cards: RuleCard[]): boolean {
  if (cards.length !== 5) return false;
  const counts = Array.from(rankCounts(cards).values()).sort();
  return counts.length === 2 && counts[0] === 2 && counts[1] === 3;
}

function isSisters(cards: RuleCard[]): boolean {
  if (cards.length < 4) return false;
  const groups = rankCounts(cards);

  // Every group the same size: pairs or triples.
  const groupSizes = Array.from(groups.values());
  const groupSize = groupSizes[0];
  if (groupSize < 2 || groupSize > 3) return false;
  if (!groupSizes.every((size) => size === groupSize)) return false;

  // Consecutive ranks. A (14) and 2 (15) are consecutive here, so A-2 are the highest sisters.
  const sortedRanks = Array.from(groups.keys()).sort((a, b) => a - b);
  for (let i = 1; i < sortedRanks.length; i++) {
    if (sortedRanks[i] !== sortedRanks[i - 1] + 1) return false;
  }
  return true;
}

function isRun(cards: RuleCard[]): boolean {
  if (cards.length < 5) return false;

  const ranks = [...new Set(cards.map((c) => c.rank))];
  if (ranks.length !== cards.length) return false;

  // A-2-3-4-5 (the wheel) is the only run that may hold a 2.
  if (ranks.includes(TWO)) {
    const wheelRanks = [ACE, TWO, THREE, FOUR, FIVE];
    return ranks.length === 5 && ranks.every((r) => wheelRanks.includes(r));
  }

  const sortedRanks = [...ranks].sort((a, b) => a - b);
  for (let i = 1; i < sortedRanks.length; i++) {
    if (sortedRanks[i] !== sortedRanks[i - 1] + 1) return false;
  }
  return true;
}

function isStraightFlush(cards: RuleCard[]): boolean {
  if (!isRun(cards)) return false;
  return new Set(cards.map((c) => c.suit)).size === 1;
}

/** What meld these cards make, or null when they make none. */
export function meldTypeOf(cards: RuleCard[]): MeldKind | null {
  const count = cards.length;

  if (count === 1) return 'SINGLE';
  if (count === 2 && isPair(cards)) return 'PAIR';
  if (count === 3 && allSameRank(cards)) return 'THREE_OF_KIND';
  if (count === 4 && allSameRank(cards)) return 'BOMB';

  if (count === 5 && isFullHouse(cards)) return 'FULL_HOUSE';
  if (count >= 4 && isSisters(cards)) return 'SISTERS';
  if (count >= 5 && isStraightFlush(cards)) return 'STRAIGHT_FLUSH';
  if (count >= 5 && isRun(cards)) return 'RUN';

  return null;
}

/** How strong a meld of `type` is among melds of its own type. */
export function meldStrengthOf(cards: RuleCard[], type: string | null | undefined): number {
  if (!type) return 0;

  switch (type) {
    case 'SINGLE':
      return cardStrength(cards[0]);

    case 'PAIR':
    case 'THREE_OF_KIND':
    case 'BOMB':
      return cards[0].rank;

    case 'FULL_HOUSE': {
      for (const [rank, count] of rankCounts(cards)) {
        if (count === 3) return rank;
      }
      return 0;
    }

    case 'SISTERS':
      return Math.max(...cards.map((c) => c.rank));

    case 'RUN':
    case 'STRAIGHT_FLUSH': {
      // The highest card decides, except the wheel (A-2-3-4-5), which counts as five-high.
      const runRanks = cards.map((c) => c.rank);
      if (
        runRanks.includes(ACE) && runRanks.includes(TWO) &&
        runRanks.includes(THREE) && runRanks.includes(FOUR) && runRanks.includes(FIVE)
      ) {
        return FIVE;
      }
      return Math.max(...runRanks);
    }

    default:
      return 0;
  }
}

/** Classifies cards in one step. */
export function classify<C extends RuleCard>(cards: C[]): { cards: C[]; type: MeldKind | null; strength: number } {
  const type = meldTypeOf(cards);
  return { cards, type, strength: meldStrengthOf(cards, type) };
}

/** Sisters are N groups of the same size (pairs or triples) on consecutive ranks. */
export function sisterShape(meld: { cards: RuleCard[] }): { groups: number; groupSize: number } {
  const groups = new Set(meld.cards.map((c) => c.rank)).size;
  return { groups, groupSize: meld.cards.length / groups };
}

/** Why `meld` can't go on top of `table` (null: an empty table, the leader's choice), or null when it can. */
export function describeInvalidPlay(meld: RuleMeld, table: RuleMeld | null | undefined): string | null {
  if (!meld.type) {
    return "Invalid card combination! Not a valid meld type.";
  }

  // An empty table means the trick's leader is starting it: anything goes.
  if (!table) {
    return null;
  }

  const tableIsBomb = table.type === 'BOMB' || table.type === 'STRAIGHT_FLUSH';

  if (meld.type === 'BOMB' || meld.type === 'STRAIGHT_FLUSH') {
    if (!tableIsBomb) return null;
    const beats = meld.strength > table.strength ||
      (meld.type === 'STRAIGHT_FLUSH' && meld.cards.length > table.cards.length);
    return beats ? null : "That doesn't beat the table. It needs a higher bomb.";
  }

  if (tableIsBomb) {
    return "That doesn't beat the table. It needs a higher bomb.";
  }

  const name = MELD_NAMES[table.type ?? ''];
  if (meld.type !== table.type) {
    return `That doesn't beat the table. It needs a ${name} or a bomb.`;
  }

  if (meld.cards.length !== table.cards.length) {
    return `That doesn't beat the table. It needs a ${table.cards.length}-card ${name}.`;
  }

  if (meld.type === 'SISTERS') {
    const want = sisterShape(table);
    const got = sisterShape(meld);
    if (want.groupSize !== got.groupSize || want.groups !== got.groups) {
      const kind = want.groupSize === 3 ? "triples" : "pairs";
      return `That doesn't beat the table. It needs sisters of ${want.groups} ${kind}.`;
    }
  }

  if (meld.strength <= table.strength) {
    return `That doesn't beat the table. It needs a higher ${name}.`;
  }

  return null;
}

import { SLOT_ACE, SLOT_FIVE, SLOT_H5, SLOT_TWO } from './cards';

/** Meld types as small numbers, for the simulator. A straight flush counts as a bomb here. */
export const T_NONE = 0;
export const T_SINGLE = 1;
export const T_PAIR = 2;
export const T_TRIPLE = 3;
export const T_BOMB = 4;
export const T_SISTERS = 5;
export const T_FULL = 6;
export const T_RUN = 7;

/** A play in slot terms: which slots the cards come from, and how the table reads afterwards. */
export interface Move {
  type: number;
  /** strength among melds of its type */
  str: number;
  len: number;
  /** group size for sisters (2 or 3), otherwise 0 */
  gs: number;
  slots: number[];
  /** the same number for the same play, whoever makes it: names a branch of the search tree */
  key: number;
}

/** The pass, as a branch of the search tree. */
export const PASS_KEY = 0;

/** Builds a move and its key. Type, strength, length, group size, the full house's pair and the Heart 5 tell plays apart. */
export function mk(type: number, str: number, len: number, gs: number, slots: number[]): Move {
  let h5 = 0;
  let pair = 0;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === SLOT_H5) h5 = 1;
    if (type === T_FULL) {
      const r = slots[i] === SLOT_H5 ? SLOT_FIVE : slots[i];
      if (r !== str - 3) pair = r + 1;
    }
  }
  return { type, str, len, gs, slots, key: type | (str << 3) | (len << 8) | (gs << 13) | (h5 << 15) | (pair << 16) };
}

type Counts = ArrayLike<number>;

const fill = (slot: number, n: number): number[] => new Array<number>(n).fill(slot);

/**
 * Every way to take `g` cards of rank slot `r` (g >= 2). Fives come in two flavors when the
 * Five of Hearts is in hand: with it and without it.
 */
function groups(c: Counts, o: number, r: number, g: number): number[][] {
  if (r !== SLOT_FIVE) return c[o + r] >= g ? [fill(r, g)] : [];
  const out: number[][] = [];
  const plain = c[o + SLOT_FIVE];
  if (plain >= g) out.push(fill(SLOT_FIVE, g));
  if (c[o + SLOT_H5] > 0 && plain >= g - 1) out.push([...fill(SLOT_FIVE, g - 1), SLOT_H5]);
  return out;
}

/** How many cards of rank slot `r` are on hand, counting the Five of Hearts as a five. */
const have = (c: Counts, o: number, r: number): number =>
  r === SLOT_FIVE ? c[o + SLOT_FIVE] + c[o + SLOT_H5] : c[o + r];

/** `g` cards of rank `r` for a run or sisters, keeping the Five of Hearts back when it can. */
function take(c: Counts, o: number, r: number, g: number): number[] {
  if (r !== SLOT_FIVE || c[o + SLOT_FIVE] >= g) return fill(r, g);
  return [...fill(SLOT_FIVE, g - 1), SLOT_H5];
}

/**
 * A run or sisters that used plain fives could have used the Five of Hearts for one of them.
 * Returns that second flavor, or null when there is no choice to make.
 */
function withH5(c: Counts, o: number, slots: number[]): number[] | null {
  if (c[o + SLOT_H5] === 0 || slots.includes(SLOT_H5)) return null;
  const at = slots.indexOf(SLOT_FIVE);
  if (at < 0) return null;
  const alt = [...slots];
  alt[at] = SLOT_H5;
  return alt;
}

/**
 * Every meld a hand can make (straight flushes aside: they need suits, so the caller adds them).
 * `c` holds 16 slot counts starting at offset `o`.
 */
export function genMoves(c: Counts, o = 0): Move[] {
  const moves: Move[] = [];

  for (let s = 0; s < 16; s++) {
    if (c[o + s] > 0) moves.push(mk(T_SINGLE, s === SLOT_H5 ? 18 : s + 3, 1, 0, [s]));
  }

  const pairs: Move[] = [];
  const triples: Move[] = [];
  for (let r = 0; r <= SLOT_TWO; r++) {
    for (const slots of groups(c, o, r, 2)) pairs.push(mk(T_PAIR, r + 3, 2, 0, slots));
    for (const slots of groups(c, o, r, 3)) triples.push(mk(T_TRIPLE, r + 3, 3, 0, slots));
    for (const slots of groups(c, o, r, 4)) moves.push(mk(T_BOMB, r + 3, 4, 0, slots));
  }
  moves.push(...pairs, ...triples);

  for (const t of triples) {
    for (const p of pairs) {
      if (p.str === t.str) continue;
      moves.push(mk(T_FULL, t.str, 5, 0, [...t.slots, ...p.slots]));
    }
  }

  // Sisters: two or more consecutive pairs, or triples. A-2 are consecutive here.
  for (let gs = 2; gs <= 3; gs++) {
    for (let start = 0; start < SLOT_TWO; start++) {
      if (have(c, o, start) < gs) continue;
      const slots = take(c, o, start, gs);
      for (let end = start + 1; end <= SLOT_TWO && have(c, o, end) >= gs; end++) {
        slots.push(...take(c, o, end, gs));
        moves.push(mk(T_SISTERS, end + 3, slots.length, gs, [...slots]));
        const alt = withH5(c, o, slots);
        if (alt) moves.push(mk(T_SISTERS, end + 3, slots.length, gs, alt));
      }
    }
  }

  // Runs: five or more consecutive ranks, 3 up to the ace.
  for (let start = 0; start + 4 <= SLOT_ACE; start++) {
    if (have(c, o, start) < 1) continue;
    const slots = take(c, o, start, 1);
    for (let end = start + 1; end <= SLOT_ACE && have(c, o, end) >= 1; end++) {
      slots.push(...take(c, o, end, 1));
      if (slots.length < 5) continue;
      moves.push(mk(T_RUN, end + 3, slots.length, 0, [...slots]));
      const alt = withH5(c, o, slots);
      if (alt) moves.push(mk(T_RUN, end + 3, slots.length, 0, alt));
    }
  }
  // The wheel, A-2-3-4-5: the only run with a 2, and it counts as five-high.
  if (c[o + SLOT_ACE] > 0 && c[o + SLOT_TWO] > 0 && c[o] > 0 && c[o + 1] > 0 && have(c, o, SLOT_FIVE) > 0) {
    const wheel = [SLOT_ACE, SLOT_TWO, 0, 1, ...take(c, o, SLOT_FIVE, 1)];
    moves.push(mk(T_RUN, 5, 5, 0, wheel));
    const alt = withH5(c, o, wheel);
    if (alt) moves.push(mk(T_RUN, 5, 5, 0, alt));
  }

  return moves;
}

/** Whether a move may go on a table showing (tType, tStr, tLen, tGs). T_NONE is an empty table. */
export function beats(m: Move, tType: number, tStr: number, tLen: number, tGs: number): boolean {
  if (tType === T_NONE) return true;
  if (m.type === T_BOMB) return tType !== T_BOMB || m.str > tStr;
  if (tType === T_BOMB) return false;
  return m.type === tType && m.len === tLen && (m.type !== T_SISTERS || m.gs === tGs) && m.str > tStr;
}

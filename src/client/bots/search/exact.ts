import type { BotCard } from './cards';
import { SLOTS, SLOT_ACE, SLOT_FIVE, SLOT_H5, SLOT_TWO } from './cards';
import { T_BOMB, T_FULL, T_NONE, T_PAIR, T_RUN, T_SINGLE, T_SISTERS, T_TRIPLE, beats, genMoves } from './moves';
import type { Move } from './moves';

/**
 * The exact parts of the bot's thinking. No sampling here: these answer from what is certain.
 *
 * 1. A locked win. A meld nobody could beat with ANY of the cards still unseen wins its trick for
 *    sure. If the hand splits into such melds plus at most one other, playing the sure ones first
 *    and the other last goes out without anyone getting a turn that matters.
 * 2. The last duel. When two players are left and every other card has been seen, the opponent's
 *    hand is known exactly, and the game is solved by plain win/lose search.
 */

/** What is still unseen, from one player's chair. */
export interface Unseen {
  /** slot counts of every card not in my hand and not yet played */
  counts: Int8Array;
  /** some suit still has five in a row unseen, so a straight flush may be out there */
  flushPossible: boolean;
  /** the biggest hand any opponent holds */
  maxHand: number;
}

export function unseenOf(pool: BotCard[], counts: Int8Array, maxHand: number): Unseen {
  let flushPossible = false;
  for (const suit of ['C', 'D', 'H', 'S']) {
    const has = new Set(pool.filter((c) => c.suit === suit).map((c) => c.rank));
    let streak = 0;
    for (let r = 3; r <= 14; r++) {
      streak = has.has(r) ? streak + 1 : 0;
      if (streak >= 5) flushPossible = true;
    }
    if ([14, 15, 3, 4, 5].every((r) => has.has(r))) flushPossible = true;
  }
  return { counts, flushPossible, maxHand };
}

const avail = (u: Int8Array, r: number) => (r === SLOT_FIVE ? u[SLOT_FIVE] + u[SLOT_H5] : u[r]);

/** True when no hand made from the unseen cards could beat `m`. Errs toward "it can be beaten". */
export function unbeatable(m: Move, un: Unseen): boolean {
  const u = un.counts;
  const max = un.maxHand;
  if (max >= 5 && un.flushPossible) return false;
  if (max >= 4) {
    const floor = m.type === T_BOMB ? m.str - 3 : -1;
    for (let r = floor + 1; r <= SLOT_TWO; r++) if (avail(u, r) === 4) return false;
  }
  if (m.type === T_BOMB) return true;
  if (max < m.len) return true;

  switch (m.type) {
    case T_SINGLE:
      for (let s = 0; s < SLOTS; s++) if (u[s] > 0 && (s === SLOT_H5 ? 18 : s + 3) > m.str) return false;
      return true;
    case T_PAIR:
    case T_TRIPLE:
    case T_FULL: {
      const need = m.type === T_PAIR ? 2 : 3;
      for (let r = m.str - 2; r <= SLOT_TWO; r++) if (avail(u, r) >= need) return false;
      return true;
    }
    case T_SISTERS: {
      const groups = m.len / m.gs;
      for (let start = Math.max(0, m.str - 3 - groups + 2); start + groups - 1 <= SLOT_TWO; start++) {
        let ok = true;
        for (let i = 0; i < groups && ok; i++) ok = avail(u, start + i) >= m.gs;
        if (ok) return false;
      }
      return true;
    }
    case T_RUN: {
      for (let start = Math.max(0, m.str - 3 - m.len + 2); start + m.len - 1 <= SLOT_ACE; start++) {
        let ok = true;
        for (let i = 0; i < m.len && ok; i++) ok = avail(u, start + i) >= 1;
        if (ok) return false;
      }
      return true;
    }
  }
  return false;
}

const lowestSlot = (c: Int8Array): number => {
  for (let s = 0; s < SLOTS; s++) if (c[s] > 0) return s;
  return -1;
};

/**
 * Looks for a way to lead out the whole hand `c` with at most one meld that could be beaten.
 * Returns the melds in playing order (sure ones first), or null. Gives up after `budget` steps.
 */
export function lockedWin(c: Int8Array, un: Unseen, budget = 4000): Move[] | null {
  let steps = 0;
  const sure: Move[] = [];
  const loose: Move[] = []; // at most one

  const dfs = (): boolean => {
    const low = lowestSlot(c);
    if (low < 0) return true;
    if (++steps > budget) return false;
    // Every split has exactly one meld holding the lowest card, so only those need trying.
    for (const m of genMoves(c)) {
      if (!m.slots.includes(low)) continue;
      const safe = unbeatable(m, un);
      if (!safe && loose.length) continue;
      for (const s of m.slots) c[s]--;
      if (safe) sure.push(m);
      else loose.push(m);
      const ok = dfs();
      for (const s of m.slots) c[s]++;
      if (ok) return true;
      if (safe) sure.pop();
      else loose.pop();
    }
    return false;
  };

  if (!dfs()) return null;
  return [...sure, ...loose];
}

// ---------------------------------------------------------------------------
// The last duel: two players, both hands known.
// ---------------------------------------------------------------------------

class OutOfBudget extends Error {}

/**
 * Solves a two-player endgame with both hands known. `mine` is to move against `table`.
 * Returns the moves that win by force ('pass' included), or null if it ran out of `budget` nodes.
 * Both arrays are scratch space: pass copies.
 * Straight flushes are left out; with this few cards they almost never exist.
 */
export function solveDuel(
  mine: Int8Array,
  theirs: Int8Array,
  table: { type: number; str: number; len: number; gs: number },
  budget = 150_000,
): Array<Move | 'pass'> | null {
  const memo = new Map<string, boolean>();
  let nodes = 0;

  const key = (a: Int8Array, b: Int8Array, t: number, s: number, l: number, g: number) =>
    String.fromCharCode(...a, ...b, t, s, l, g);

  const total = (a: Int8Array) => {
    let n = 0;
    for (let i = 0; i < SLOTS; i++) n += a[i];
    return n;
  };

  // Does the player holding `a`, to move on this table, go out first?
  const wins = (a: Int8Array, b: Int8Array, na: number, t: number, s: number, l: number, g: number): boolean => {
    const k = key(a, b, t, s, l, g);
    const known = memo.get(k);
    if (known !== undefined) return known;
    if (++nodes > budget) throw new OutOfBudget();

    let result = false;
    const moves = genMoves(a).filter((m) => beats(m, t, s, l, g));
    moves.sort((x, y) => y.len - x.len || x.str - y.str);
    for (const m of moves) {
      if (m.len === na) {
        result = true;
        break;
      }
      for (const slot of m.slots) a[slot]--;
      const reply = wins(b, a, total(b), m.type, m.str, m.len, m.gs);
      for (const slot of m.slots) a[slot]++;
      if (!reply) {
        result = true;
        break;
      }
    }
    // Passing hands the other player the lead.
    if (!result && t !== T_NONE) result = !wins(b, a, total(b), T_NONE, 0, 0, 0);
    memo.set(k, result);
    return result;
  };

  try {
    const winners: Array<Move | 'pass'> = [];
    const na = total(mine);
    for (const m of genMoves(mine)) {
      if (!beats(m, table.type, table.str, table.len, table.gs)) continue;
      if (m.len === na) {
        winners.push(m);
        continue;
      }
      for (const slot of m.slots) mine[slot]--;
      const reply = wins(theirs, mine, total(theirs), m.type, m.str, m.len, m.gs);
      for (const slot of m.slots) mine[slot]++;
      if (!reply) winners.push(m);
    }
    if (table.type !== T_NONE && !wins(theirs, mine, total(theirs), T_NONE, 0, 0, 0)) winners.push('pass');
    return winners;
  } catch (e) {
    if (e instanceof OutOfBudget) return null;
    throw e;
  }
}

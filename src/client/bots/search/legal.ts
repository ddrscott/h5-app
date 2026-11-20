import { classify, describeInvalidPlay } from '../../../shared/rules';
import type { BotCard } from './cards';
import { SLOTS, SLOT_ACE, SLOT_H5, codeOf, isH5, slotOf } from './cards';
import { T_BOMB, T_FULL, T_NONE, T_PAIR, T_RUN, T_SINGLE, T_SISTERS, T_TRIPLE, genMoves, mk } from './moves';
import type { Move } from './moves';

const KIND_TO_T: Record<string, number> = {
  SINGLE: T_SINGLE,
  PAIR: T_PAIR,
  THREE_OF_KIND: T_TRIPLE,
  BOMB: T_BOMB,
  STRAIGHT_FLUSH: T_BOMB,
  SISTERS: T_SISTERS,
  FULL_HOUSE: T_FULL,
  RUN: T_RUN,
};

/** The table in simulator terms. */
export interface TableInfo {
  type: number;
  str: number;
  len: number;
  gs: number;
}

export function countsOf(cards: BotCard[]): Int8Array {
  const c = new Int8Array(SLOTS);
  for (const card of cards) c[slotOf(card)]++;
  return c;
}

/** Reads a meld the way the rules do and restates it for the simulator. Null if it isn't a meld. */
export function moveOf(cards: BotCard[]): Move | null {
  const meld = classify(cards);
  if (!meld.type) return null;
  const type = KIND_TO_T[meld.type];
  const gs = type === T_SISTERS ? cards.length / new Set(cards.map((c) => c.rank)).size : 0;
  return mk(type, meld.strength, cards.length, gs, cards.map(slotOf));
}

export function tableOf(cards: BotCard[] | null): TableInfo {
  const m = cards && cards.length ? moveOf(cards) : null;
  return m ? { type: m.type, str: m.str, len: m.len, gs: m.gs } : { type: T_NONE, str: 0, len: 0, gs: 0 };
}

export interface LegalPlay<C extends BotCard> {
  cards: C[];
  move: Move;
}

/** Straight flushes need suits, so they're found on the real cards. */
function straightFlushes<C extends BotCard>(hand: C[]): C[][] {
  const out: C[][] = [];
  for (const suit of ['C', 'D', 'H', 'S']) {
    const byRank = new Map<number, C>();
    for (const c of hand) if (c.suit === suit && c.rank <= 15) byRank.set(c.rank, c);
    if (byRank.size < 5) continue;
    for (let lo = 3; lo + 4 <= 14; lo++) {
      const run: C[] = [];
      for (let r = lo; r <= 14 && byRank.has(r); r++) {
        run.push(byRank.get(r)!);
        if (run.length >= 5) out.push([...run]);
      }
    }
    const wheel = [14, 15, 3, 4, 5].map((r) => byRank.get(r));
    if (wheel.every(Boolean)) out.push(wheel as C[]);
  }
  return out;
}

/**
 * Every play `hand` may make on `table` (null: leading). The candidates come from the slot
 * generator; each one is then put through the real rules, and only what they allow is returned.
 */
export function legalPlays<C extends BotCard>(hand: C[], table: BotCard[] | null): LegalPlay<C>[] {
  const tableMeld = table && table.length ? classify(table) : null;
  const bySlot: C[][] = Array.from({ length: SLOTS }, () => []);
  for (const c of hand) bySlot[slotOf(c)].push(c);

  const seen = new Set<string>();
  const out: LegalPlay<C>[] = [];
  const offer = (cards: C[]) => {
    const key = cards.map(codeOf).sort().join(' ');
    if (seen.has(key)) return;
    seen.add(key);
    if (describeInvalidPlay(classify(cards), tableMeld) !== null) return;
    const move = moveOf(cards);
    if (move) out.push({ cards, move });
  };

  for (const m of genMoves(countsOf(hand))) {
    const used = new Array<number>(SLOTS).fill(0);
    const cards: C[] = [];
    for (const s of m.slots) {
      const card = bySlot[s][used[s]++];
      if (card) cards.push(card);
    }
    if (cards.length === m.slots.length) offer(cards);
  }
  for (const cards of straightFlushes(hand)) offer(cards);
  return out;
}

/** True for the cards that win tricks on their own: 2s, jokers and the Heart 5. */
export const isControl = (c: BotCard): boolean => c.rank >= 15 || isH5(c);

export { SLOT_ACE, SLOT_H5 };

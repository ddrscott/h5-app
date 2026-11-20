import type { Card, Meld } from '../../types/game';
import type { BotMove, CardCode } from '../contract';
import { shapeOf, whyNot } from '../../fx/rules';

/**
 * Legal moves for a hand against the meld on the table, worked out on the client with the rules
 * port in fx/rules.ts (a mirror of GameState.describeInvalidPlay; moves.test.ts checks the two
 * agree). The server still referees every play.
 */

const SUIT_ORDER = 'CDHS';
const bySuit = (a: Card, b: Card) => SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
const codeOf = (c: Card): CardCode => c.code ?? '';

function combos<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const pick = (start: number, acc: T[]) => {
    if (acc.length === k) { out.push(acc.slice()); return; }
    for (let i = start; i < items.length; i++) { acc.push(items[i]); pick(i + 1, acc); acc.pop(); }
  };
  pick(0, []);
  return out;
}

/** Runs of consecutive ranks present in `byRank`, at least `min` long, as rank lists. */
function rankRuns(byRank: Map<number, Card[]>, min: number, top: number, need = 1): number[][] {
  const out: number[][] = [];
  for (let start = 3; start <= top; start++) {
    const run: number[] = [];
    for (let r = start; r <= top && (byRank.get(r)?.length ?? 0) >= need; r++) {
      run.push(r);
      if (run.length >= min) out.push(run.slice());
    }
  }
  return out;
}

/** Every distinct meld shape the hand can make, before checking it against the table. */
export function candidateMelds(hand: Card[]): Card[][] {
  const byRank = new Map<number, Card[]>();
  for (const c of hand) byRank.set(c.rank, [...(byRank.get(c.rank) ?? []), c]);
  byRank.forEach((cs) => cs.sort(bySuit));
  const out: Card[][] = [];

  // singles, pairs, triples, bombs: every suit combination
  byRank.forEach((cs) => { for (let k = 1; k <= Math.min(4, cs.length); k++) out.push(...combos(cs, k)); });

  // full houses: any triple with any pair of another rank
  byRank.forEach((trips, tr) => {
    if (trips.length < 3) return;
    const tripleSets = combos(trips, 3);
    byRank.forEach((pairs, pr) => {
      if (pr === tr || pairs.length < 2) return;
      for (const t of tripleSets) for (const p of combos(pairs, 2)) out.push([...t, ...p]);
    });
  });

  // runs (3 up to A, plus the A-2-3-4-5 wheel): one mixed-suit choice and each straight flush
  const runs = rankRuns(byRank, 5, 14);
  const wheel = [14, 15, 3, 4, 5];
  if (wheel.every((r) => byRank.has(r))) runs.push(wheel);
  for (const ranks of runs) {
    const pick = ranks.map((r) => byRank.get(r)![0]);
    if (new Set(pick.map((c) => c.suit)).size === 1) {
      // all the same suit by chance: swap in another suit somewhere to get a plain run, if we can
      const i = ranks.findIndex((r) => byRank.get(r)!.length > 1);
      if (i >= 0) pick[i] = byRank.get(ranks[i])![1];
    }
    if (new Set(pick.map((c) => c.suit)).size > 1) out.push(pick);
    for (const suit of SUIT_ORDER) {
      const flush = ranks.map((r) => byRank.get(r)!.find((c) => c.suit === suit));
      if (flush.every(Boolean)) out.push(flush as Card[]);
    }
  }

  // sisters: 2+ consecutive ranks of pairs or of triples (A and 2 count as consecutive)
  for (const size of [2, 3]) {
    for (const ranks of rankRuns(byRank, 2, 15, size)) {
      out.push(ranks.flatMap((r) => byRank.get(r)!.slice(0, size)));
    }
  }

  // keep what really is a meld, once each
  const seen = new Set<string>();
  return out.filter((cards) => {
    if (!shapeOf(cards).type) return false;
    const key = cards.map(codeOf).sort().join(' ');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** True when the table is empty, so this player is leading the trick and can't pass. */
const leading = (table: Meld | null | undefined) => !table || !table.cards?.length;

/** Every legal move right now, plays lowest first, with a pass at the end when passing is allowed. */
export function legalMoves(hand: Card[], table: Meld | null | undefined): BotMove[] {
  const plays = candidateMelds(hand)
    .filter((cards) => whyNot(cards, table) === null)
    .map((cards) => ({ cards, shape: shapeOf(cards) }))
    .sort((a, b) => a.cards.length - b.cards.length || a.shape.strength - b.shape.strength)
    .map(({ cards }) => ({ cards: cards.map(codeOf) }) as BotMove);
  return leading(table) ? plays : [...plays, { pass: true }];
}

/**
 * What to play when a bot gives no usable answer (too slow, crashed, or illegal): a pass, or the
 * lowest single when leading. The same thing the server's turn timer plays (GameState.autoMove).
 */
export function fallbackMove(hand: Card[], table: Meld | null | undefined): BotMove {
  if (!leading(table) || hand.length === 0) return { pass: true };
  const lowest = hand.reduce((low, c) => (shapeOf([c]).strength < shapeOf([low]).strength ? c : low));
  return { cards: [codeOf(lowest)] };
}

/**
 * Checks a bot's reply. Returns the move to send when it's legal: a pass when passing is allowed,
 * or distinct cards from the hand that make a play the rules accept against the table (so one of
 * the legal moves, with any choice of suits). Returns null for anything else.
 */
export function checkMove(reply: unknown, hand: Card[], table: Meld | null | undefined): BotMove | null {
  if (!reply || typeof reply !== 'object' || Array.isArray(reply)) return null;
  const r = reply as Record<string, unknown>;
  if ('pass' in r && 'cards' in r) return null; // pick one
  if (r.pass === true) return leading(table) ? null : { pass: true };
  if (!Array.isArray(r.cards) || r.cards.length === 0 || r.cards.length > hand.length) return null;
  if (!r.cards.every((c) => typeof c === 'string')) return null;
  const codes = r.cards as string[];
  if (new Set(codes).size !== codes.length) return null;
  const mine = new Map(hand.map((c) => [codeOf(c), c]));
  const cards = codes.map((c) => mine.get(c));
  if (!cards.every(Boolean)) return null;
  if (whyNot(cards as Card[], table) !== null) return null;
  return { cards: codes.slice() };
}

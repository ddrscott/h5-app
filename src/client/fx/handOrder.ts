import type { Card } from '../types/game';
import { storageKey } from '../base';

/**
 * The order of the cards in your hand. It's yours alone: the server deals and keeps hands in
 * rank order and never hears about this. Plays still send card codes.
 */
export const codeOf = (c: Card) => c.code || `${c.rank}${c.suit}`;

const SUITS = 'CDHSJ';
const suitIdx = (s: string) => { const i = SUITS.indexOf(s); return i < 0 ? SUITS.length : i; };

/** Rank then suit, the same order the server deals in. */
export const byRank = (a: Card, b: Card) => a.rank - b.rank || a.suit.localeCompare(b.suit);
/** Suit (clubs, diamonds, hearts, spades, then jokers), low to high inside each. */
export const bySuit = (a: Card, b: Card) => suitIdx(a.suit) - suitIdx(b.suit) || a.rank - b.rank;

export type SortKind = 'rank' | 'suit';
export const sortCodes = (hand: Card[], kind: SortKind) =>
  [...hand].sort(kind === 'rank' ? byRank : bySuit).map(codeOf);

/**
 * Bring a remembered order up to date with the hand. Cards only ever leave a hand during a round,
 * so a hand holding a card the order has never seen is a new deal, and starts in rank order.
 * Otherwise the order keeps its cards where they were and drops the ones that left.
 */
export function reconcile(prev: string[] | null | undefined, hand: Card[]): string[] {
  const codes = hand.map(codeOf);
  if (!prev || prev.length === 0) return sortCodes(hand, 'rank');
  const known = new Set(prev);
  if (codes.some((c) => !known.has(c))) return sortCodes(hand, 'rank');
  const have = new Set(codes);
  return prev.filter((c) => have.has(c));
}

/** The order with `code` taken out and put back in at `to` (an index in the result). */
export function moveTo(order: string[], code: string, to: number): string[] {
  const rest = order.filter((c) => c !== code);
  const at = Math.max(0, Math.min(rest.length, to));
  return [...rest.slice(0, at), code, ...rest.slice(at)];
}

export const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((c, i) => c === b[i]);

// ---------- surviving a reload: one saved order per tab, tagged with its room and seat ----------
const KEY = storageKey('hand-order');

export function loadOrder(seat: string): string[] | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!v || v.seat !== seat || !Array.isArray(v.order)) return null;
    return v.order.filter((c: unknown): c is string => typeof c === 'string');
  } catch {
    return null;
  }
}

export function saveOrder(seat: string, order: string[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ seat, order }));
  } catch {
    /* storage blocked: the order just won't survive a reload */
  }
}

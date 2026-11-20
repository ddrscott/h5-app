/**
 * The bot contract: everything a bot is told on its turn, and what it answers.
 *
 *   decide(view) -> move
 *
 * Both sides are plain JSON, so a bot can live anywhere: in this bundle (the built-in
 * personalities, src/client/bots/personas.ts), in a Web Worker, or in a sandbox. A bot keeps no
 * state between turns that it can't rebuild from the view; the history is in it.
 *
 * The host (ContractStrategy, or the self-play harness) builds the view, calls decide, and checks
 * the answer with checkMove() before anything is sent to the room. A bot that answers late, throws
 * or answers with an illegal move gets the host's fallback move instead.
 */
import { classify, describeInvalidPlay } from '../../shared/rules';

export const BOT_CONTRACT_VERSION = 1;

/** A card. `code` is its id on the wire: rank then suit ("TS", "5H"), "jj" and "JJ" for the jokers. */
export interface ViewCard {
  code: string;
  /** 3-10, J=11, Q=12, K=13, A=14, 2=15, small joker=16, big joker=17 */
  rank: number;
  /** "C", "D", "H", "S", or "J" for a joker */
  suit: string;
}

export interface ViewMeld {
  cards: ViewCard[];
  /** SINGLE, PAIR, THREE_OF_KIND, BOMB, SISTERS, FULL_HOUSE, RUN or STRAIGHT_FLUSH */
  type: string;
  /** who played it, when known */
  playerId: string | null;
}

export interface ViewPlayer {
  id: string;
  name: string;
  /** cards still in hand */
  cards: number;
  /** already out of cards this game */
  out: boolean;
  isBot: boolean;
}

/** One thing that happened this game, oldest first. `cards` is null for a pass. */
export interface ViewEvent {
  playerId: string;
  cards: string[] | null;
}

export interface BotView {
  version: typeof BOT_CONTRACT_VERSION;
  /** your player id; it is always your turn when decide is called */
  me: string;
  hand: ViewCard[];
  /**
   * Plays you may make right now, as card codes. One entry per distinct meld (the suits used for a
   * rank are picked for you, and fives come with and without the Five of Hearts). Any other set of
   * your cards that the rules allow is accepted too.
   */
  legalMoves: string[][];
  /** false when you lead the trick: the leader has to play */
  canPass: boolean;
  /** the meld to beat, or null when you lead */
  table: ViewMeld | null;
  /** everyone at the table in turn order, you included */
  players: ViewPlayer[];
  /** passes since the meld on the table was played */
  consecutivePasses: number;
  /** codes of every card played so far this game */
  played: string[];
  /** plays and passes the host has seen this game; may be missing its start after a reconnect */
  history: ViewEvent[];
  /** games finished at this table before this one */
  round: number;
  /** answer within this many milliseconds */
  timeBudgetMs: number;
}

export type BotMove = { action: 'pass' } | { action: 'play'; cards: string[] };

export type BotDecide = (view: BotView) => BotMove | Promise<BotMove>;

/**
 * Why `move` can't be made from `view`, or null when it can. This is the gate every bot answer
 * goes through, judged by the same rules the room uses (src/shared/rules.ts).
 */
export function checkMove(view: BotView, move: unknown): string | null {
  if (!move || typeof move !== 'object') return 'Not a move';
  const m = move as { action?: unknown; cards?: unknown };
  if (m.action === 'pass') return view.canPass ? null : 'The leader has to play';
  if (m.action !== 'play') return 'Unknown action';
  if (!Array.isArray(m.cards) || m.cards.length === 0) return 'No cards';
  const byCode = new Map(view.hand.map((c) => [c.code, c]));
  const cards: ViewCard[] = [];
  for (const code of m.cards) {
    const card = typeof code === 'string' ? byCode.get(code) : undefined;
    if (!card) return `Not in hand: ${String(code)}`;
    byCode.delete(card.code); // each card once
    cards.push(card);
  }
  const table = view.table ? classify(view.table.cards) : null;
  return describeInvalidPlay(classify(cards), table);
}

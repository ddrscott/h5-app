/**
 * The contract between the game and a bot: what a bot sees on its turn (BotView) and what it may
 * answer (BotMove). Both are plain JSON, so the same shapes work for an uploaded script running in
 * a sandboxed Web Worker and for a built-in `decide(view) -> move` function.
 *
 * A card is its code: rank then suit. Ranks 3 4 5 6 7 8 9 T J Q K A 2 (low to high), suits
 * C D H S. So "TS" is the ten of spades and "5H" is the Heart 5, which beats any single.
 */

/** A card code such as "3H", "TS" or "2D". */
export type CardCode = string;

/** A bot's answer: pass, or play these cards from its hand. */
export type BotMove = { pass: true } | { cards: CardCode[] };

export interface BotView {
  /** Your seat (player id). */
  me: string;
  /** Your hand, lowest rank first. Only your own cards: nobody else's hand is ever in the view. */
  hand: CardCode[];
  /**
   * Every move you may make right now, a pass included when you're allowed to pass. For runs and
   * sisters it lists one choice of suits per shape; any other suits from your hand that make the
   * same legal play are accepted too.
   */
  legalMoves: BotMove[];
  /** The meld you have to beat, or null when you're leading the trick (play anything). */
  table: { cards: CardCode[]; type: string; by: string } | null;
  /** Everyone at the table in seat order, you included. */
  players: Array<{ id: string; name: string; cards: number; out: boolean; passed: boolean }>;
  /** This game's plays and passes so far, oldest first (from when your browser joined the table). */
  history: Array<{ by: string } & BotMove>;
  /** How long you have to answer, in milliseconds. Go over and you're stopped and a fallback is played. */
  timeBudgetMs: number;
}

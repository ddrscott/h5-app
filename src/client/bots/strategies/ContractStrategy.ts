import type { BotConfig, BotDecision, GameContext } from '../types';
import { BotStrategy } from '../types';
import { checkMove } from '../contract';
import type { BotDecide, BotMove, BotView } from '../contract';
import { buildView } from '../view';
import type { Card, Meld } from '../../types/game';
import { cardStrength } from '../../../shared/rules';

export interface ContractOptions {
  /** the shortest a turn takes, so a bot never snaps a card down the instant it's asked */
  minDelayMs?: number;
  /** how long past its budget a bot may run before the host moves for it */
  graceMs?: number;
}

/**
 * Hosts a contract bot (contract.ts) in a seat: builds the view, asks the bot, and checks the
 * answer against the rules before it goes anywhere. A late, broken or illegal answer is replaced
 * by the fallback strategy's move, and if that is illegal too, by the plainest legal move there
 * is. Nothing leaves here that the room would refuse.
 */
export class ContractStrategy extends BotStrategy {
  constructor(
    config: BotConfig,
    private decide: BotDecide,
    private fallback: BotStrategy | null,
    private budgetMs: number,
    private options: ContractOptions = {},
  ) {
    super(config);
  }

  async makeDecision(context: GameContext): Promise<BotDecision> {
    const started = Date.now();
    const view = buildView(context, this.budgetMs);
    let move: BotMove | null = null;
    let reasoning = 'contract bot';

    try {
      const answer = await this.withDeadline(this.decide(view), this.budgetMs + (this.options.graceMs ?? 1500));
      const problem = checkMove(view, answer);
      if (problem === null) move = answer as BotMove;
      else console.warn(`[${this.config.name}] bot answer refused: ${problem}`);
    } catch (error) {
      console.warn(`[${this.config.name}] bot failed, using the fallback:`, error);
    }

    if (!move) {
      move = await this.fallbackMove(context, view);
      reasoning = 'fallback';
    }

    const minDelay = this.options.minDelayMs ?? 0;
    const waited = Date.now() - started;
    if (waited < minDelay) await new Promise((resolve) => setTimeout(resolve, minDelay - waited));

    if (move.action === 'pass') return { action: 'pass', confidence: 1, reasoning };
    const byCode = new Map(context.myHand.map((c) => [c.code, c]));
    const cards = move.cards.flatMap((code) => byCode.get(code) ?? []);
    return { action: 'play', cards, confidence: 1, reasoning };
  }

  private withDeadline<T>(work: T | Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no answer within ${ms} ms`)), ms);
      Promise.resolve(work).then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  /** The old strategy's move if the rules allow it; otherwise pass, or the lowest card when leading. */
  private async fallbackMove(context: GameContext, view: BotView): Promise<BotMove> {
    if (this.fallback) {
      try {
        const d = await this.fallback.makeDecision(context);
        const move: BotMove = d.action === 'play' && d.cards?.length
          ? { action: 'play', cards: d.cards.map((c) => c.code ?? '') }
          : { action: 'pass' };
        if (checkMove(view, move) === null) return move;
      } catch {
        /* fall through to the plain move */
      }
    }
    if (view.canPass || view.hand.length === 0) return { action: 'pass' };
    const low = view.hand.reduce((a, b) => (cardStrength(b) < cardStrength(a) ? b : a));
    return { action: 'play', cards: [low.code] };
  }

  analyzeHand(cards: Card[]): { strength: number; bestMelds: Meld[]; bombs: Card[][] } {
    return this.fallback ? this.fallback.analyzeHand(cards) : { strength: 0, bestMelds: [], bombs: [] };
  }
}

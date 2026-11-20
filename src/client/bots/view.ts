import { BOT_CONTRACT_VERSION } from './contract';
import type { BotView, ViewCard, ViewEvent } from './contract';
import type { GameContext } from './types';
import { codeOf } from './search/cards';
import type { BotCard } from './search/cards';
import { legalPlays } from './search/legal';

const viewCard = (c: BotCard): ViewCard => ({ code: codeOf(c), rank: c.rank, suit: c.suit });

/**
 * Builds the plain-JSON view a bot decides from (see contract.ts) out of what the host knows on
 * the bot's turn. Nothing in it is hidden information: it's the bot's own hand plus what any
 * player at the table can see.
 */
export function buildView(context: GameContext, timeBudgetMs: number): BotView {
  const hand = context.myHand.map(viewCard);
  const meld = context.currentMeld && context.currentMeld.cards?.length ? context.currentMeld : null;
  const table = meld
    ? { cards: meld.cards.map(viewCard), type: String(meld.type), playerId: meld.playerId ?? null }
    : null;

  // Seat order when the host has it; otherwise the order the players arrived in.
  const order = context.turnOrder?.length ? context.turnOrder : Array.from(context.players.keys());
  const players = order.flatMap((id) => {
    const p = context.players.get(id);
    return p ? [{ id, name: p.name, cards: p.handCount, out: !!p.isOut, isBot: !!p.isBot }] : [];
  });

  const history: ViewEvent[] = context.history ?? [];
  const played = context.playedCards ?? [];

  return {
    version: BOT_CONTRACT_VERSION,
    me: context.myPlayerId,
    hand,
    legalMoves: legalPlays(hand, table ? table.cards : null).map((p) => p.cards.map((c) => c.code)),
    canPass: table !== null,
    table,
    players,
    consecutivePasses: context.consecutivePasses ?? 0,
    played,
    history,
    round: context.currentRound ?? 0,
    timeBudgetMs,
  };
}

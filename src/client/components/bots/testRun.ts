import { BotSandbox } from '../../bots/sandbox/BotSandbox';
import { buildView } from '../../bots/sandbox/pilot';
import { checkMove } from '../../bots/sandbox/moves';
import type { Card, Meld } from '../../types/game';
import { MeldType } from '../../types/game';

const card = (code: string): Card => ({ code, suit: code.slice(-1), rank: '3456789TJQKA2'.indexOf(code.slice(0, -1)) + 3 });

/** A made-up turn: four players, a single 8 on the table, and a hand with a few choices. */
export function sampleTurn(leading = false) {
  const hand = ['3C', '3D', '6S', '9H', '9S', 'TS', 'QD', '5H'].map(card);
  const table: Meld | null = leading ? null : { cards: [card('8S')], type: MeldType.SINGLE, playerId: 'p2' };
  const players = new Map([
    ['me', { id: 'me', name: 'You', handCount: hand.length, isOut: false, hasPassed: false }],
    ['p2', { id: 'p2', name: 'Bo', handCount: 9, isOut: false, hasPassed: false }],
    ['p3', { id: 'p3', name: 'Cy', handCount: 11, isOut: false, hasPassed: false }],
    ['p4', { id: 'p4', name: 'Di', handCount: 7, isOut: false, hasPassed: true }],
  ]);
  const state = { phase: 'PLAYING', currentTurnPlayerId: 'me', leadPlayerId: leading ? 'me' : 'p2', currentMeld: table, turnOrder: ['me', 'p2', 'p3', 'p4'], players };
  const history = leading ? [] : [{ by: 'p2', cards: ['8S'] }];
  return { hand, table, view: buildView(state, 'me', hand, history, 2000) };
}

/** Runs a bot on the sample turn in a throwaway sandbox and says how it went, in a sentence. */
export async function testRun(code: string, onLog?: (text: string) => void): Promise<string> {
  const sandbox = new BotSandbox(code);
  sandbox.onLog = onLog ?? ((t) => console.info('[bot test]', t));
  try {
    const { hand, table, view } = sampleTurn();
    const r = await sandbox.decide(view);
    if (r.kind === 'timeout') return `It didn't answer within ${view.timeBudgetMs / 1000}s, so it was stopped. In a game that's a strike.`;
    if (r.kind === 'error') return `It failed: ${r.message}`;
    const ok = checkMove(r.move, hand, table);
    return ok
      ? `On a single 8 it answered ${JSON.stringify(ok)} in ${r.ms} ms. That's a legal move.`
      : `It answered ${JSON.stringify(r.move)?.slice(0, 120)}, which isn't legal here. In a game that turns into a pass.`;
  } finally {
    sandbox.destroy();
  }
}

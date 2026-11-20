// Tests for the search bots (src/client/bots). They sit here, next to the rules tests, because
// they check the bots against the real GameState, and this folder is what `npm test` runs.
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { GameState, GamePhase, Card, Meld, Suit } from './GameState';
import { classify, describeInvalidPlay } from '../../shared/rules';
import { checkMove } from '../../client/bots/contract';
import type { BotView, ViewCard } from '../../client/bots/contract';
import { personaBot } from '../../client/bots/builtin';
import { PERSONAS, PERSONA_LIST, clampThinkSeconds } from '../../client/bots/personas';
import { DECK, SLOTS, makeRng, slotOf } from '../../client/bots/search/cards';
import { legalPlays, moveOf, countsOf } from '../../client/bots/search/legal';
import { newSim, simOver, simPass, simPlay } from '../../client/bots/search/sim';
import { lockedWin, solveDuel, unseenOf } from '../../client/bots/search/exact';
import { think, thinkSync } from '../../client/bots/search/engine';
import { T_NONE, T_SINGLE } from '../../client/bots/search/moves';

const quiet = <T>(fn: () => T): T => {
  const log = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = log;
  }
};

const byCode = new Map(DECK.map((c) => [c.code, c]));
const cards = (codes: string): ViewCard[] => codes.split(' ').filter(Boolean).map((code) => {
  const c = byCode.get(code);
  assert(c, `no such card ${code}`);
  return c;
});

/** A dealt game on the real engine, with the deal coming from `seed`. */
function dealt(players: number, seed: number): GameState {
  const real = Math.random;
  Math.random = makeRng(seed);
  try {
    return quiet(() => {
      const s = new GameState();
      for (let i = 0; i < players; i++) s.addPlayer(`p${i}`, `p${i}`, true);
      s.initializeDeck();
      s.dealCards();
      return s;
    });
  } finally {
    Math.random = real;
  }
}

/** The view the bot in the turn seat gets, built straight from the engine. */
function viewOf(s: GameState, budgetMs = 1000): BotView {
  const id = s.currentTurnPlayerId;
  const hand = s.players.get(id)!.hand.map((c) => ({ code: c.code, rank: c.rank as number, suit: c.suit as string }));
  const table = s.currentMeld
    ? { cards: s.currentMeld.cards.map((c) => ({ code: c.code, rank: c.rank as number, suit: c.suit as string })), type: s.currentMeld.type as string, playerId: s.currentMeld.playerId }
    : null;
  return {
    version: 1,
    me: id,
    hand,
    legalMoves: legalPlays(hand, table ? table.cards : null).map((p) => p.cards.map((c) => c.code)),
    canPass: table !== null,
    table,
    players: s.turnOrder.map((pid) => {
      const p = s.players.get(pid)!;
      return { id: pid, name: p.name, cards: p.handCount, out: p.isOut, isBot: true };
    }),
    consecutivePasses: s.consecutivePasses,
    played: s.discardPile.map((c) => c.code),
    history: [],
    round: 0,
    timeBudgetMs: budgetMs,
  };
}

describe('Bot move generation', () => {
  it('offers every meld the rules allow, and nothing they refuse', () => {
    const rng = makeRng(7);
    for (let trial = 0; trial < 150; trial++) {
      const deck = [...DECK].sort(() => rng() - 0.5);
      const hand = deck.slice(0, 9);
      // An empty table, or a random meld from the rest of the deck to beat.
      let table: ViewCard[] | null = null;
      if (trial % 3 !== 0) {
        const others = legalPlays(deck.slice(9, 27), null);
        table = others[Math.floor(rng() * others.length)].cards;
      }
      const tableMeld = table ? classify(table) : null;
      const offered = legalPlays(hand, table);
      for (const p of offered) assert.strictEqual(describeInvalidPlay(classify(p.cards), tableMeld), null);

      const shape = (cs: ViewCard[]) => cs.map((c) => (c.code === '5H' ? '5H' : c.rank)).sort().join(',');
      const shapes = new Set(offered.map((p) => shape(p.cards)));
      const flushes = offered.filter((p) => classify(p.cards).type === 'STRAIGHT_FLUSH').length;
      let needFlush = false;
      for (let mask = 1; mask < 1 << hand.length; mask++) {
        const subset = hand.filter((_, i) => mask & (1 << i));
        const meld = classify(subset);
        if (describeInvalidPlay(meld, tableMeld) !== null) continue;
        if (meld.type === 'STRAIGHT_FLUSH') needFlush = true;
        else assert(shapes.has(shape(subset)), `missed ${subset.map((c) => c.code).join(' ')} on ${table?.map((c) => c.code).join(' ') ?? 'an empty table'}`);
      }
      if (needFlush) assert(flushes > 0, 'missed a straight flush');
    }
  });
});

describe('Bot simulator', () => {
  it('moves the turn exactly as the room does', () => {
    for (let game = 0; game < 60; game++) {
      const n = 2 + (game % 5);
      const s = dealt(n, 1000 + game);
      const rng = makeRng(game);
      const seat = (id: string) => s.turnOrder.indexOf(id);
      const sim = newSim(n);
      s.turnOrder.forEach((id, i) => {
        const p = s.players.get(id)!;
        sim.left[i] = p.hand.length;
        for (const c of p.hand) sim.cnt[i * SLOTS + slotOf(c)]++;
      });
      sim.turn = seat(s.currentTurnPlayerId);

      quiet(() => {
        for (let turn = 0; turn < 3000 && s.phase === GamePhase.PLAYING; turn++) {
          const id = s.currentTurnPlayerId;
          const me = s.players.get(id)!;
          const plays = legalPlays(me.hand, s.currentMeld ? s.currentMeld.cards : null);
          const pass = s.currentMeld && (plays.length === 0 || rng() < 0.35);
          if (pass) {
            assert(s.pass(id));
            simPass(sim, seat(id));
          } else {
            const play = plays[Math.floor(rng() * plays.length)];
            assert(s.playMeld(id, play.cards));
            simPlay(sim, seat(id), play.move);
          }
          s.turnOrder.forEach((pid, i) => {
            const p = s.players.get(pid)!;
            assert.strictEqual(sim.left[i], p.hand.length);
            assert.strictEqual(!!sim.out[i], p.isOut);
          });
          if (s.phase !== GamePhase.PLAYING) break;
          assert.strictEqual(sim.turn, seat(s.currentTurnPlayerId), 'whose turn');
          assert.strictEqual(sim.tType === T_NONE, !s.currentMeld, 'whether the table is empty');
          assert.strictEqual(sim.passes, s.consecutivePasses);
        }
      });
      assert.notStrictEqual(s.phase, GamePhase.PLAYING);
      assert(simOver(sim));
      // First out is first place in both.
      assert.strictEqual(sim.place[seat(s.roundWinnerId)], 1);
    }
  });

  it('reads a meld the way the rules do', () => {
    const m = new Meld();
    m.setCards([new Card(Suit.HEARTS, 5), new Card(Suit.SPADES, 5)]);
    const move = moveOf(cards('5H 5S'))!;
    assert.strictEqual(move.str, m.strength);
    assert.strictEqual(moveOf(cards('5H'))!.str, 18);
    assert.strictEqual(moveOf(cards('5H'))!.type, T_SINGLE);
    assert.strictEqual(moveOf(cards('3S 4S')), null);
  });
});

describe('Bot exact play', () => {
  it('finds a locked win: the unbeatable card first, the rest after', () => {
    // Everything else has been played except six low cards, so nobody can touch the Heart 5.
    const hand = cards('5H 3S 3D');
    const left = cards('4S 4D 6S 7D 8S 9D');
    const unseen = unseenOf(left, countsOf(left), 2);
    const line = lockedWin(countsOf(hand), unseen);
    assert(line);
    assert.strictEqual(line[0].str, 18);

    const gone = new Set([...hand, ...left].map((c) => c.code));
    const view: BotView = {
      version: 1, me: 'a', hand, legalMoves: [], canPass: false, table: null,
      players: [
        { id: 'a', name: 'a', cards: 3, out: false, isBot: true },
        { id: 'b', name: 'b', cards: 2, out: false, isBot: true },
        { id: 'c', name: 'c', cards: 2, out: false, isBot: true },
        { id: 'd', name: 'd', cards: 2, out: false, isBot: true },
      ],
      consecutivePasses: 0, played: DECK.filter((c) => !gone.has(c.code)).map((c) => c.code), history: [], round: 0, timeBudgetMs: 500,
    };
    const result = thinkSync(view, { persona: PERSONAS.shark, rng: makeRng(1), rollouts: 50 });
    assert.strictEqual(result.how, 'locked');
    assert.deepStrictEqual(result.move, { action: 'play', cards: ['5H'] });
  });

  it('solves the last duel', () => {
    // I hold 3 and 5, they hold a 4. Leading the 3 loses to the 4; leading the 5 wins.
    const winners = solveDuel(countsOf(cards('3S 5S')), countsOf(cards('4S')), { type: T_NONE, str: 0, len: 0, gs: 0 });
    assert(winners);
    assert.strictEqual(winners.length, 1);
    assert.deepStrictEqual(winners[0] === 'pass' ? null : winners[0].slots, [2]);

    const hand = cards('3S 5S');
    const gone = new Set(['3S', '5S', '4S']);
    const view: BotView = {
      version: 1, me: 'a', hand, legalMoves: [], canPass: false, table: null,
      players: [
        { id: 'a', name: 'a', cards: 2, out: false, isBot: true },
        { id: 'b', name: 'b', cards: 1, out: false, isBot: true },
        { id: 'c', name: 'c', cards: 0, out: true, isBot: true },
      ],
      consecutivePasses: 0, played: DECK.filter((c) => !gone.has(c.code)).map((c) => c.code), history: [], round: 0, timeBudgetMs: 500,
    };
    for (const id of ['shark', 'turtle'] as const) {
      const result = thinkSync(view, { persona: PERSONAS[id], rng: makeRng(2), rollouts: 50 });
      assert.deepStrictEqual(result.move, { action: 'play', cards: ['5S'] }, id);
    }
  });
});

describe('Bot contract', () => {
  const view = (): BotView => ({
    version: 1, me: 'a', hand: cards('3S 3D 9S KS'), legalMoves: [], canPass: true,
    table: { cards: cards('8D'), type: 'SINGLE', playerId: 'b' },
    players: [
      { id: 'a', name: 'a', cards: 4, out: false, isBot: true },
      { id: 'b', name: 'b', cards: 5, out: false, isBot: true },
    ],
    consecutivePasses: 0, played: ['8D'], history: [{ playerId: 'b', cards: ['8D'] }], round: 0, timeBudgetMs: 200,
  });

  it('accepts only moves the rules allow', () => {
    const v = view();
    assert.strictEqual(checkMove(v, { action: 'pass' }), null);
    assert.strictEqual(checkMove(v, { action: 'play', cards: ['9S'] }), null);
    assert.notStrictEqual(checkMove(v, { action: 'play', cards: ['3S'] }), null, 'too low');
    assert.notStrictEqual(checkMove(v, { action: 'play', cards: ['3S', '3D'] }), null, 'wrong kind');
    assert.notStrictEqual(checkMove(v, { action: 'play', cards: ['AS'] }), null, 'not in hand');
    assert.notStrictEqual(checkMove(v, { action: 'play', cards: ['9S', '9S'] }), null, 'same card twice');
    assert.notStrictEqual(checkMove(v, { action: 'play', cards: [] }), null);
    assert.notStrictEqual(checkMove(v, { action: 'dance' }), null);
    assert.notStrictEqual(checkMove(v, null), null);
    assert.notStrictEqual(checkMove({ ...v, table: null, canPass: false }, { action: 'pass' }), null, 'the leader has to play');
  });

  it('is plain JSON both ways', async () => {
    const v = JSON.parse(JSON.stringify(view())) as BotView;
    const move = await personaBot('regular', { rng: makeRng(3), rollouts: 40 })(v);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(move)), move);
    assert.strictEqual(checkMove(v, move), null);
  });
});

describe('Bot personalities', () => {
  it('never answer with an illegal move, in any seat count', async () => {
    let turns = 0;
    for (let game = 0; game < 12; game++) {
      const n = 2 + (game % 5);
      const s = dealt(n, 500 + game);
      const bots = s.turnOrder.map((_, i) => personaBot(PERSONA_LIST[(i + game) % PERSONA_LIST.length].id, { rng: makeRng(game * 10 + i), rollouts: 60 }));
      while (s.phase === GamePhase.PLAYING && turns++ < 20000) {
        const id = s.currentTurnPlayerId;
        const v = viewOf(s);
        const move = await bots[s.turnOrder.indexOf(id)](v);
        assert.strictEqual(checkMove(v, move), null);
        quiet(() => {
          if (move.action === 'pass') assert(s.pass(id), 'the room took the pass');
          else assert(s.playMeld(id, move.cards.map((code) => s.players.get(id)!.hand.find((c) => c.code === code)!)), 'the room took the play');
        });
      }
      assert.notStrictEqual(s.phase, GamePhase.PLAYING, 'the game ended');
    }
  });

  it('stop thinking when the time budget runs out, and yield while they think', async () => {
    let pauses = 0;
    let rollouts = 0;
    // Some opening leads are settled in a few milliseconds, so look at several deals.
    for (let deal = 0; deal < 5; deal++) {
      const s = dealt(4, 40 + deal);
      const started = performance.now();
      const result = await think(viewOf(s, 120), {
        persona: PERSONAS.shark,
        rng: makeRng(deal),
        pause: () => {
          pauses++;
          return new Promise((resolve) => setTimeout(resolve, 0));
        },
      });
      const took = performance.now() - started;
      rollouts += result.rollouts;
      assert(took < 500, `it took ${took.toFixed(0)} ms on a 120 ms budget`);
      assert.strictEqual(checkMove(viewOf(s), result.move), null);
    }
    assert(rollouts > 0, 'it searched');
    assert(pauses >= 5, `it yielded ${pauses} times`);
  });

  it('keep the thinking time inside its limits', () => {
    assert.strictEqual(clampThinkSeconds(60, 1), 5);
    assert.strictEqual(clampThinkSeconds(0, 1), 0.2);
    assert.strictEqual(clampThinkSeconds(undefined, 1.5), 1.5);
    assert.strictEqual(clampThinkSeconds('3', 1.5), 1.5);
  });
});

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { GameState, GamePhase, Card, Meld, Suit, Rank } from './GameState';
import { legalMoves, checkMove, fallbackMove, candidateMelds } from '../../client/bots/sandbox/moves';

/**
 * The bring-your-own-bot helpers (src/client/bots/sandbox/moves.ts) work out legal moves on the
 * client. These tests hold them to the server's own rules: every move they list must pass
 * GameState.describeInvalidPlay, and their reply check must agree with it on random plays.
 */

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function deck(): Card[] {
  const out: Card[] = [];
  for (const suit of [Suit.CLUBS, Suit.DIAMONDS, Suit.HEARTS, Suit.SPADES]) {
    for (let rank = Rank.THREE; rank <= Rank.TWO; rank++) out.push(new Card(suit, rank));
  }
  out.push(new Card(Suit.JOKER, Rank.SMALL_JOKER), new Card(Suit.JOKER, Rank.BIG_JOKER));
  return out;
}

function shuffled<T>(xs: T[], rand: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function meldOf(cards: Array<{ suit: string; rank: number }>): Meld {
  const m = new Meld();
  m.setCards(cards.map((c) => new Card(c.suit as Suit, c.rank as Rank)));
  m.playerId = 'p2';
  return m;
}

/** A game state where p1 is to play against `table` (or leads when it's null). */
function stateWith(table: Meld | null): GameState {
  const s = new GameState();
  s.phase = GamePhase.PLAYING;
  s.currentMeld = table;
  return s;
}

const byCode = (hand: Card[]) => new Map(hand.map((c) => [c.code, c]));

describe('bot legal moves agree with the server rules', () => {
  it('every listed play is one the server accepts, on 300 random hands and tables', () => {
    const rand = rng(7);
    let checked = 0;
    for (let round = 0; round < 300; round++) {
      const cards = shuffled(deck(), rand);
      const hand = cards.slice(0, 13 + Math.floor(rand() * 14));
      const other = cards.slice(27, 40);
      const options = candidateMelds(other);
      const table = round % 4 === 0 ? null : meldOf(options[Math.floor(rand() * options.length)]);
      const state = stateWith(table);
      const lookup = byCode(hand);
      const moves = legalMoves(hand, table);
      for (const move of moves) {
        if ('pass' in move) {
          assert.ok(table, 'a pass is only listed when following');
          continue;
        }
        const reason = state.describeInvalidPlay(meldOf(move.cards.map((c) => lookup.get(c)!)));
        assert.strictEqual(reason, null, `${move.cards.join(' ')} on ${table?.cards.map((c) => c.code).join(' ') ?? 'an empty table'}`);
        checked++;
      }
      assert.strictEqual(moves.some((m) => 'pass' in m), !!table);
    }
    assert.ok(checked > 1000, `checked ${checked} plays`);
  });

  it('accepts exactly the random plays the server accepts', () => {
    const rand = rng(11);
    let legal = 0;
    for (let round = 0; round < 4000; round++) {
      const cards = shuffled(deck(), rand);
      const hand = cards.slice(0, 13);
      const options = candidateMelds(cards.slice(13, 26));
      const table = round % 3 === 0 ? null : meldOf(options[Math.floor(rand() * options.length)]);
      const pick = shuffled(hand, rand).slice(0, 1 + Math.floor(rand() * 6));
      const server = stateWith(table).describeInvalidPlay(meldOf(pick)) === null;
      const client = checkMove({ cards: pick.map((c) => c.code) }, hand, table) !== null;
      assert.strictEqual(client, server, `${pick.map((c) => c.code).join(' ')} on ${table?.cards.map((c) => c.code).join(' ') ?? 'an empty table'}`);
      if (server) legal++;
    }
    assert.ok(legal > 300, `${legal} legal plays sampled`);
  });

  it('finds the shapes a hand can make', () => {
    const c = (code: string) => {
      const suit = code.slice(-1) as Suit;
      const rank = '3456789TJQKA2'.indexOf(code.slice(0, -1)) + 3;
      return new Card(suit, rank as Rank);
    };
    const hand = ['3C', '3D', '4C', '4H', '5S', '6C', '7C', '9D', '9H', '9S'].map(c);
    const keys = new Set(legalMoves(hand, null).map((m) => ('cards' in m ? m.cards.slice().sort().join(' ') : 'pass')));
    for (const want of ['3C 3D', '3C 3D 4C 4H', '3C 4C 5S 6C 7C', '9D 9H 9S', '3C 3D 9D 9H 9S']) {
      assert.ok(keys.has(want.split(' ').sort().join(' ')), `missing ${want}`);
    }
    assert.ok(!keys.has('pass'), 'the leader may not pass');
  });
});

describe('bot reply check', () => {
  const hand = [new Card(Suit.SPADES, Rank.NINE), new Card(Suit.HEARTS, Rank.NINE), new Card(Suit.CLUBS, Rank.FOUR), new Card(Suit.HEARTS, Rank.FIVE)];
  const pairOfSevens = meldOf([new Card(Suit.CLUBS, Rank.SEVEN), new Card(Suit.DIAMONDS, Rank.SEVEN)]);

  it('turns away junk, cards not in hand, duplicates and illegal plays', () => {
    for (const reply of [null, 'pass', 42, [], {}, { cards: [] }, { cards: 'AS' }, { cards: ['AS'] }, { cards: ['9S', '9S'] },
      { cards: ['4C'] }, { cards: ['9S', '4C'] }, { pass: true, cards: ['9S', '9H'] }, { cards: [1, 2] }]) {
      assert.strictEqual(checkMove(reply, hand, pairOfSevens), null, JSON.stringify(reply));
    }
  });

  it('allows a pass only when following', () => {
    assert.deepStrictEqual(checkMove({ pass: true }, hand, pairOfSevens), { pass: true });
    assert.strictEqual(checkMove({ pass: true }, hand, null), null);
  });

  it('accepts a legal play with extra fields ignored', () => {
    assert.deepStrictEqual(checkMove({ cards: ['9H', '9S'], note: 'hi' }, hand, pairOfSevens), { cards: ['9H', '9S'] });
  });

  it('falls back like the server turn timer: pass, or the lowest single when leading (Heart 5 is high)', () => {
    assert.deepStrictEqual(fallbackMove(hand, pairOfSevens), { pass: true });
    assert.deepStrictEqual(fallbackMove(hand, null), { cards: ['4C'] });
    const s = new GameState();
    s.addPlayer('p1', 'P1');
    hand.forEach((card) => s.players.get('p1')!.addCard(card));
    s.phase = GamePhase.PLAYING;
    s.currentTurnPlayerId = 'p1';
    s.leadPlayerId = 'p1';
    const auto = s.autoMove('p1');
    assert.ok(auto && auto.action === 'play');
    assert.deepStrictEqual(auto.cards.map((x) => x.code), ['4C']);
  });
});

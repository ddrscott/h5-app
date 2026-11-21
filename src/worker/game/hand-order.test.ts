import assert from 'node:assert';
import { describe, it } from 'node:test';
import { reconcile, moveTo, sortCodes } from '../../client/fx/handOrder';

/** Your hand's order lives on the client (src/client/fx/handOrder.ts); these pin down its rules. */
const c = (code: string) => {
  const ranks = '3456789TJQKA2';
  if (code === 'jj') return { code, rank: 16, suit: 'J' };
  if (code === 'JJ') return { code, rank: 17, suit: 'J' };
  return { code, rank: ranks.indexOf(code[0]) + 3, suit: code[1] };
};
const hand = (codes: string) => codes.split(' ').map(c);

describe('hand order', () => {
  it('starts a fresh hand in rank order, the same order the server deals in', () => {
    assert.deepStrictEqual(reconcile(null, hand('9S 3H 3C JJ 2D')), ['3C', '3H', '9S', '2D', 'JJ']);
  });

  it('keeps your order when cards leave the hand', () => {
    const mine = ['KD', '3C', '9S', '9H', '2D'];
    assert.deepStrictEqual(reconcile(mine, hand('3C 9H 9S 2D')), ['3C', '9S', '9H', '2D']);
  });

  it('treats a hand with a card it has never seen as a new deal', () => {
    assert.deepStrictEqual(reconcile(['KD', '3C'], hand('4S 3C KD')), ['3C', '4S', 'KD']);
  });

  it('moves a card to a new spot', () => {
    assert.deepStrictEqual(moveTo(['a', 'b', 'c', 'd'], 'a', 2), ['b', 'c', 'a', 'd']);
    assert.deepStrictEqual(moveTo(['a', 'b', 'c', 'd'], 'd', 0), ['d', 'a', 'b', 'c']);
    assert.deepStrictEqual(moveTo(['a', 'b'], 'a', 9), ['b', 'a']);
  });

  it('sorts by suit: clubs, diamonds, hearts, spades, then jokers, low to high in each', () => {
    assert.deepStrictEqual(sortCodes(hand('2C 3S jj 5H KC 4D'), 'suit'), ['KC', '2C', '4D', '5H', '3S', 'jj']);
  });
});

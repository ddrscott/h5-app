import assert from 'node:assert';
import { describe, it } from 'node:test';
import { GameState, GamePhase, Card, Suit, Rank } from './GameState';

/** A table mid-round with fixed hands, so every case is deterministic. p1 leads unless told otherwise. */
function table(hands: Record<string, Card[]>, lead = 'p1') {
  const s = new GameState();
  for (const id of Object.keys(hands)) s.addPlayer(id, id.toUpperCase());
  for (const [id, cards] of Object.entries(hands)) {
    const p = s.players.get(id)!;
    cards.forEach((c) => p.addCard(c));
    p.sortHand();
  }
  s.phase = GamePhase.PLAYING;
  s.currentRound = 1;
  s.currentTurnPlayerId = lead;
  s.leadPlayerId = lead;
  return s;
}

const c = (rank: Rank, suit: Suit = Suit.SPADES) => new Card(suit, rank);
const hand = () => [c(Rank.NINE), c(Rank.KING), c(Rank.FOUR, Suit.CLUBS)];

describe('autoMove (playing for an absent player)', () => {
  it('leads the lowest single when leading', () => {
    const s = table({ p1: hand(), p2: hand() });
    const move = s.autoMove('p1');
    assert.ok(move && move.action === 'play');
    assert.deepStrictEqual(move.cards.map((x) => x.code), ['4C']);
  });

  it('treats the five of hearts as high, not as a five', () => {
    const s = table({ p1: [c(Rank.FIVE, Suit.HEARTS), c(Rank.SEVEN)], p2: hand() });
    const move = s.autoMove('p1');
    assert.ok(move && move.action === 'play');
    assert.deepStrictEqual(move.cards.map((x) => x.code), ['7S']);
  });

  it('passes when following a meld', () => {
    const s = table({ p1: hand(), p2: hand() });
    s.playMeld('p1', [s.players.get('p1')!.hand[0]]);
    assert.deepStrictEqual(s.autoMove('p2'), { action: 'pass' });
  });

  it('does nothing when it is not their turn or the round is over', () => {
    const s = table({ p1: hand(), p2: hand() });
    assert.strictEqual(s.autoMove('p2'), null);
    s.phase = GamePhase.ROUND_END;
    assert.strictEqual(s.autoMove('p1'), null);
  });

  it('produces a move the rules accept', () => {
    const s = table({ p1: hand(), p2: hand(), p3: hand() });
    const lead = s.autoMove('p1');
    assert.ok(lead && lead.action === 'play');
    assert.strictEqual(s.playMeld('p1', lead.cards), true);
    assert.strictEqual(s.currentTurnPlayerId, 'p2');
    assert.ok(s.autoMove('p2')?.action === 'pass');
    assert.strictEqual(s.pass('p2'), true);
  });
});

describe('removeSeat (host removes a player who left)', () => {
  it('moves the turn on when the removed player was leading', () => {
    const s = table({ p1: hand(), p2: hand(), p3: hand() });
    s.removeSeat('p1');
    assert.strictEqual(s.players.has('p1'), false);
    assert.deepStrictEqual(s.turnOrder, ['p2', 'p3']);
    assert.strictEqual(s.currentTurnPlayerId, 'p2');
    assert.strictEqual(s.leadPlayerId, 'p2');
    assert.strictEqual(s.phase, GamePhase.PLAYING);
    // p2 can lead anything now.
    assert.strictEqual(s.playMeld('p2', [s.players.get('p2')!.hand[2]]), true);
  });

  it('moves the turn on when the removed player was following', () => {
    const s = table({ p1: hand(), p2: hand(), p3: hand(), p4: hand() });
    s.playMeld('p1', [s.players.get('p1')!.hand[0]]);
    s.removeSeat('p2');
    assert.strictEqual(s.currentTurnPlayerId, 'p3');
    assert.strictEqual(s.leadPlayerId, 'p1');
    assert.ok(s.currentMeld);
  });

  it('skips players who are already out when handing on the turn', () => {
    const s = table({ p1: hand(), p2: hand(), p3: hand(), p4: hand() });
    s.players.get('p3')!.isOut = true;
    s.playMeld('p1', [s.players.get('p1')!.hand[0]]);
    s.removeSeat('p2');
    assert.strictEqual(s.currentTurnPlayerId, 'p4');
  });

  it('ends the trick when everyone left has passed', () => {
    const s = table({ p1: hand(), p2: hand(), p3: hand(), p4: hand() });
    s.playMeld('p1', [s.players.get('p1')!.hand[0]]);
    s.pass('p2');
    s.pass('p3');
    assert.strictEqual(s.currentTurnPlayerId, 'p4');
    s.removeSeat('p4');
    assert.strictEqual(s.currentMeld, null);
    assert.strictEqual(s.leadPlayerId, 'p1');
    assert.strictEqual(s.currentTurnPlayerId, 'p1');
    assert.strictEqual(s.consecutivePasses, 0);
    assert.ok(Array.from(s.players.values()).every((p) => !p.hasPassed));
  });

  it('forgets a pass the removed player made, so the trick still needs everyone else', () => {
    const s = table({ p1: hand(), p2: hand(), p3: hand(), p4: hand() });
    s.playMeld('p1', [s.players.get('p1')!.hand[0]]);
    s.pass('p2');
    s.removeSeat('p2');
    assert.strictEqual(s.consecutivePasses, 0);
    assert.strictEqual(s.currentTurnPlayerId, 'p3');
    s.pass('p3');
    assert.ok(s.currentMeld, 'p4 has not answered yet');
    s.pass('p4');
    assert.strictEqual(s.currentMeld, null);
    assert.strictEqual(s.currentTurnPlayerId, 'p1');
  });

  it('lets the trick finish when the player who made the meld is removed', () => {
    const s = table({ p1: hand(), p2: hand(), p3: hand() });
    s.playMeld('p1', [s.players.get('p1')!.hand[0]]);
    s.removeSeat('p1');
    assert.strictEqual(s.currentTurnPlayerId, 'p2');
    assert.strictEqual(s.pass('p2'), true);
    assert.ok(s.currentMeld, 'everyone still in gets to answer, as when the owner goes out');
    assert.strictEqual(s.currentTurnPlayerId, 'p3');
    assert.strictEqual(s.pass('p3'), true);
    assert.strictEqual(s.currentMeld, null, 'trick over once the others passed');
    assert.strictEqual(s.currentTurnPlayerId, 'p2', 'the seat after the removed one leads');
    assert.strictEqual(s.leadPlayerId, 'p2');
  });

  it('ends the round with no result when only one player is left and nobody went out', () => {
    const s = table({ p1: hand(), p2: hand() });
    s.removeSeat('p2');
    assert.strictEqual(s.phase, GamePhase.ROUND_END);
    assert.strictEqual(s.currentTurnPlayerId, null);
    assert.strictEqual(s.players.get('p1')!.losses, 0);
  });

  it('gives the loss to the last player holding cards when someone already went out', () => {
    const s = table({ p1: [c(Rank.TWO)], p2: hand(), p3: hand() });
    s.playMeld('p1', [s.players.get('p1')!.hand[0]]); // p1 goes out and wins
    assert.strictEqual(s.roundWinnerId, 'p1');
    s.removeSeat('p3');
    assert.strictEqual(s.phase, GamePhase.ROUND_END);
    assert.strictEqual(s.players.get('p2')!.losses, 1);
  });

  it('lets the next round start when the removed seat won the last one', () => {
    const s = table({ p1: hand(), p2: hand(), p3: hand() });
    s.phase = GamePhase.ROUND_END;
    s.roundWinnerId = 'p2';
    s.removeSeat('p2');
    assert.strictEqual(s.roundWinnerId, null);
    assert.strictEqual(s.startNewRound(), true);
    assert.strictEqual(s.phase, GamePhase.PLAYING);
    assert.ok(s.players.has(s.currentTurnPlayerId));
    assert.strictEqual(s.leadPlayerId, s.currentTurnPlayerId);
  });

  it('just removes the player in the lobby', () => {
    const s = new GameState();
    s.addPlayer('p1', 'A');
    s.addPlayer('p2', 'B');
    s.removeSeat('p2');
    assert.deepStrictEqual(Array.from(s.players.keys()), ['p1']);
    assert.deepStrictEqual(s.turnOrder, ['p1']);
  });
});

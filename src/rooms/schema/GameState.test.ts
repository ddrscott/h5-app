import assert from 'assert';
import { GameState, Card, Meld, Suit, Rank, MeldType } from './GameState';

describe('Meld Type Detection and Validation', () => {
  describe('Single Card', () => {
    it('should detect single card', () => {
      const meld = new Meld();
      meld.setCards([new Card(Suit.HEARTS, Rank.THREE)]);
      assert.strictEqual(meld.type, MeldType.SINGLE);
    });

    it('should calculate correct strength for regular cards', () => {
      const meld = new Meld();
      meld.setCards([new Card(Suit.SPADES, Rank.KING)]);
      assert.strictEqual(meld.strength, Rank.KING);
    });

    it('should calculate correct strength for Five of Hearts', () => {
      const meld = new Meld();
      meld.setCards([new Card(Suit.HEARTS, Rank.FIVE)]);
      assert.strictEqual(meld.strength, Rank.FIVE_OF_HEARTS); // Should be 18, highest single
    });

    it('should have correct rank order: 3 < 4 < ... < A < 2 < jj < JJ < 5H', () => {
      const ranks = [
        { card: new Card(Suit.CLUBS, Rank.THREE), expectedStrength: Rank.THREE },
        { card: new Card(Suit.CLUBS, Rank.KING), expectedStrength: Rank.KING },
        { card: new Card(Suit.CLUBS, Rank.ACE), expectedStrength: Rank.ACE },
        { card: new Card(Suit.CLUBS, Rank.TWO), expectedStrength: Rank.TWO },
        { card: new Card(Suit.JOKER, Rank.SMALL_JOKER), expectedStrength: Rank.SMALL_JOKER },
        { card: new Card(Suit.JOKER, Rank.BIG_JOKER), expectedStrength: Rank.BIG_JOKER },
        { card: new Card(Suit.HEARTS, Rank.FIVE), expectedStrength: Rank.FIVE_OF_HEARTS }
      ];

      for (let i = 1; i < ranks.length; i++) {
        const weakerMeld = new Meld();
        weakerMeld.setCards([ranks[i - 1].card]);
        
        const strongerMeld = new Meld();
        strongerMeld.setCards([ranks[i].card]);
        
        assert(strongerMeld.strength > weakerMeld.strength, `${ranks[i].card.code} should be stronger than ${ranks[i-1].card.code}`);
      }
    });
  });

  describe('Two of a Kind (Pair)', () => {
    it('should detect pair', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.FIVE),
        new Card(Suit.DIAMONDS, Rank.FIVE)
      ]);
      assert.strictEqual(meld.type, MeldType.PAIR);
    });

    it('should not detect mismatched cards as pair', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.FIVE),
        new Card(Suit.DIAMONDS, Rank.SIX)
      ]);
      assert.strictEqual(meld.type, null);  // Invalid meld - not MeldType.PAIR);
    });

    it('should not allow jokers to form a pair', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.JOKER, Rank.SMALL_JOKER),
        new Card(Suit.JOKER, Rank.BIG_JOKER)
      ]);
      assert.strictEqual(meld.type, null);  // Invalid meld - not MeldType.PAIR);
    });

    it('should calculate pair strength based on rank', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.TWO),
        new Card(Suit.DIAMONDS, Rank.TWO)
      ]);
      assert.strictEqual(meld.strength, Rank.TWO);
    });
  });

  describe('Three of a Kind', () => {
    it('should detect three of a kind', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.SEVEN),
        new Card(Suit.DIAMONDS, Rank.SEVEN),
        new Card(Suit.CLUBS, Rank.SEVEN)
      ]);
      assert.strictEqual(meld.type, MeldType.THREE_OF_KIND);
    });

    it('should not detect mismatched cards as three of a kind', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.SEVEN),
        new Card(Suit.DIAMONDS, Rank.SEVEN),
        new Card(Suit.CLUBS, Rank.EIGHT)
      ]);
      assert.strictEqual(meld.type, null);  // Invalid meld - not MeldType.THREE_OF_KIND);
    });
  });

  describe('Bomb (Four of a Kind)', () => {
    it('should detect bomb', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.QUEEN),
        new Card(Suit.DIAMONDS, Rank.QUEEN),
        new Card(Suit.CLUBS, Rank.QUEEN),
        new Card(Suit.SPADES, Rank.QUEEN)
      ]);
      assert.strictEqual(meld.type, MeldType.BOMB);
    });

    it('should not detect four mismatched cards as bomb', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.QUEEN),
        new Card(Suit.DIAMONDS, Rank.QUEEN),
        new Card(Suit.CLUBS, Rank.QUEEN),
        new Card(Suit.SPADES, Rank.KING)
      ]);
      assert.strictEqual(meld.type, null);  // Invalid meld - not MeldType.BOMB);
    });

    it('bomb should beat any non-bomb meld', () => {
      const gameState = new GameState();
      
      // Set up a strong single card (5H)
      const fiveHearts = new Meld();
      fiveHearts.setCards([new Card(Suit.HEARTS, Rank.FIVE)]);
      gameState.currentMeld = fiveHearts;
      gameState.currentMeldType = MeldType.SINGLE;
      
      // Bomb should be valid play
      const bomb = new Meld();
      bomb.setCards([
        new Card(Suit.HEARTS, Rank.THREE),
        new Card(Suit.DIAMONDS, Rank.THREE),
        new Card(Suit.CLUBS, Rank.THREE),
        new Card(Suit.SPADES, Rank.THREE)
      ]);
      
      assert.strictEqual(gameState.isValidPlay(bomb), true);
    });
  });

  describe('Sisters', () => {
    it('should detect two consecutive pairs', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.THREE),
        new Card(Suit.DIAMONDS, Rank.THREE),
        new Card(Suit.HEARTS, Rank.FOUR),
        new Card(Suit.DIAMONDS, Rank.FOUR)
      ]);
      assert.strictEqual(meld.type, MeldType.SISTERS);
    });

    it('should detect three consecutive pairs', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.FIVE),
        new Card(Suit.DIAMONDS, Rank.FIVE),
        new Card(Suit.HEARTS, Rank.SIX),
        new Card(Suit.DIAMONDS, Rank.SIX),
        new Card(Suit.HEARTS, Rank.SEVEN),
        new Card(Suit.CLUBS, Rank.SEVEN)
      ]);
      assert.strictEqual(meld.type, MeldType.SISTERS);
    });

    it('should allow three of a kind in sisters', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.THREE),
        new Card(Suit.DIAMONDS, Rank.THREE),
        new Card(Suit.SPADES, Rank.THREE),
        new Card(Suit.HEARTS, Rank.FOUR),
        new Card(Suit.DIAMONDS, Rank.FOUR),
        new Card(Suit.CLUBS, Rank.FOUR)
      ]);
      assert.strictEqual(meld.type, MeldType.SISTERS);
    });

    it('should not detect non-consecutive pairs as sisters', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.THREE),
        new Card(Suit.DIAMONDS, Rank.THREE),
        new Card(Suit.HEARTS, Rank.FIVE), // Gap here
        new Card(Suit.DIAMONDS, Rank.FIVE)
      ]);
      assert.strictEqual(meld.type, null);  // Invalid meld - not MeldType.SISTERS);
    });

    it('should calculate sisters strength as highest pair rank', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.JACK),
        new Card(Suit.DIAMONDS, Rank.JACK),
        new Card(Suit.HEARTS, Rank.QUEEN),
        new Card(Suit.DIAMONDS, Rank.QUEEN)
      ]);
      assert.strictEqual(meld.strength, Rank.QUEEN);
    });

    it('should handle A-2 in sisters as consecutive per rank values', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.ACE),
        new Card(Suit.DIAMONDS, Rank.ACE),
        new Card(Suit.HEARTS, Rank.TWO),
        new Card(Suit.DIAMONDS, Rank.TWO)
      ]);
      // A (14) and 2 (15) are consecutive in rank values, so valid sisters
      assert.strictEqual(meld.type, MeldType.SISTERS);
    });
  });

  describe('Full House', () => {
    it('should detect full house', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.KING),
        new Card(Suit.DIAMONDS, Rank.KING),
        new Card(Suit.CLUBS, Rank.KING),
        new Card(Suit.HEARTS, Rank.SEVEN),
        new Card(Suit.DIAMONDS, Rank.SEVEN)
      ]);
      assert.strictEqual(meld.type, MeldType.FULL_HOUSE);
    });

    it('should calculate full house strength based on triple rank', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.ACE),
        new Card(Suit.DIAMONDS, Rank.ACE),
        new Card(Suit.HEARTS, Rank.THREE),
        new Card(Suit.DIAMONDS, Rank.THREE),
        new Card(Suit.CLUBS, Rank.THREE)
      ]);
      assert.strictEqual(meld.strength, Rank.THREE); // Triple determines strength
    });

    it('should not detect five of same rank as full house', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.SEVEN),
        new Card(Suit.DIAMONDS, Rank.SEVEN),
        new Card(Suit.CLUBS, Rank.SEVEN),
        new Card(Suit.SPADES, Rank.SEVEN),
        new Card(Suit.HEARTS, Rank.SEVEN) // Assuming multiple decks
      ]);
      assert.strictEqual(meld.type, null);  // Invalid meld - not MeldType.FULL_HOUSE);
    });
  });

  describe('Runs (Straight)', () => {
    it('should detect 5-card run', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.THREE),
        new Card(Suit.DIAMONDS, Rank.FOUR),
        new Card(Suit.CLUBS, Rank.FIVE),
        new Card(Suit.SPADES, Rank.SIX),
        new Card(Suit.HEARTS, Rank.SEVEN)
      ]);
      assert.strictEqual(meld.type, MeldType.RUN);
    });

    it('should detect long run (A-K)', () => {
      const meld = new Meld();
      const cards = [];
      const suits = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES];
      
      // Add A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K per GAME.md
      // In runs, A=1, 2=2, then 3-K as normal
      cards.push(new Card(suits[0], Rank.ACE));      // A
      cards.push(new Card(suits[1], Rank.TWO));      // 2
      cards.push(new Card(suits[2], Rank.THREE));    // 3
      cards.push(new Card(suits[3], Rank.FOUR));     // 4
      cards.push(new Card(suits[0], Rank.FIVE));     // 5
      cards.push(new Card(suits[1], Rank.SIX));      // 6
      cards.push(new Card(suits[2], Rank.SEVEN));    // 7
      cards.push(new Card(suits[3], Rank.EIGHT));    // 8
      cards.push(new Card(suits[0], Rank.NINE));     // 9
      cards.push(new Card(suits[1], Rank.TEN));      // 10
      cards.push(new Card(suits[2], Rank.JACK));     // J
      cards.push(new Card(suits[3], Rank.QUEEN));    // Q
      cards.push(new Card(suits[0], Rank.KING));     // K
      
      meld.setCards(cards);
      assert.strictEqual(meld.type, MeldType.RUN);
    });

    it('should not detect duplicate ranks as run', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.THREE),
        new Card(Suit.DIAMONDS, Rank.THREE), // Duplicate
        new Card(Suit.CLUBS, Rank.FOUR),
        new Card(Suit.SPADES, Rank.FIVE),
        new Card(Suit.HEARTS, Rank.SIX)
      ]);
      assert.strictEqual(meld.type, null);  // Invalid meld - not MeldType.RUN);
    });

    it('should not detect non-consecutive cards as run', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.THREE),
        new Card(Suit.DIAMONDS, Rank.FOUR),
        new Card(Suit.CLUBS, Rank.SIX), // Gap
        new Card(Suit.SPADES, Rank.SEVEN),
        new Card(Suit.HEARTS, Rank.EIGHT)
      ]);
      assert.strictEqual(meld.type, null);  // Invalid meld - not MeldType.RUN);
    });

    it('should require minimum 5 cards for run', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.THREE),
        new Card(Suit.DIAMONDS, Rank.FOUR),
        new Card(Suit.CLUBS, Rank.FIVE),
        new Card(Suit.SPADES, Rank.SIX)
      ]);
      assert.strictEqual(meld.type, null);  // Invalid meld - not MeldType.RUN);
    });

    it('should calculate run strength as highest card', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.NINE),
        new Card(Suit.DIAMONDS, Rank.TEN),
        new Card(Suit.CLUBS, Rank.JACK),
        new Card(Suit.SPADES, Rank.QUEEN),
        new Card(Suit.HEARTS, Rank.KING)
      ]);
      assert.strictEqual(meld.strength, Rank.KING);
    });

    it('2 is low in runs', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.ACE),
        new Card(Suit.DIAMONDS, Rank.TWO),
        new Card(Suit.CLUBS, Rank.THREE),
        new Card(Suit.SPADES, Rank.FOUR),
        new Card(Suit.HEARTS, Rank.FIVE)
      ]);
      assert.strictEqual(meld.type, MeldType.RUN);
      assert.strictEqual(meld.strength, Rank.FIVE); // Highest card
    });
  });

  describe('Straight Flush (Bomb)', () => {
    it('should detect 5-card straight flush', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.THREE),
        new Card(Suit.HEARTS, Rank.FOUR),
        new Card(Suit.HEARTS, Rank.FIVE),
        new Card(Suit.HEARTS, Rank.SIX),
        new Card(Suit.HEARTS, Rank.SEVEN)
      ]);
      assert.strictEqual(meld.type, MeldType.STRAIGHT_FLUSH);
    });

    it('should require all same suit', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.THREE),
        new Card(Suit.HEARTS, Rank.FOUR),
        new Card(Suit.DIAMONDS, Rank.FIVE), // Different suit
        new Card(Suit.HEARTS, Rank.SIX),
        new Card(Suit.HEARTS, Rank.SEVEN)
      ]);
      assert.strictEqual(meld.type, MeldType.RUN); // Just a regular run
    });

    it('straight flush should beat regular bomb', () => {
      const gameState = new GameState();
      
      // Set up a bomb
      const bomb = new Meld();
      bomb.setCards([
        new Card(Suit.HEARTS, Rank.KING),
        new Card(Suit.DIAMONDS, Rank.KING),
        new Card(Suit.CLUBS, Rank.KING),
        new Card(Suit.SPADES, Rank.KING)
      ]);
      gameState.currentMeld = bomb;
      gameState.currentMeldType = MeldType.BOMB;
      
      // Straight flush should be valid
      const straightFlush = new Meld();
      straightFlush.setCards([
        new Card(Suit.HEARTS, Rank.THREE),
        new Card(Suit.HEARTS, Rank.FOUR),
        new Card(Suit.HEARTS, Rank.FIVE),
        new Card(Suit.HEARTS, Rank.SIX),
        new Card(Suit.HEARTS, Rank.SEVEN)
      ]);
      
      assert.strictEqual(gameState.isValidPlay(straightFlush), true);
    });

    it('longer straight flush beats shorter one', () => {
      const gameState = new GameState();
      
      // 5-card straight flush
      const sf5 = new Meld();
      sf5.setCards([
        new Card(Suit.HEARTS, Rank.THREE),
        new Card(Suit.HEARTS, Rank.FOUR),
        new Card(Suit.HEARTS, Rank.FIVE),
        new Card(Suit.HEARTS, Rank.SIX),
        new Card(Suit.HEARTS, Rank.SEVEN)
      ]);
      gameState.currentMeld = sf5;
      gameState.currentMeldType = MeldType.STRAIGHT_FLUSH;
      gameState.currentMeldSize = 5;
      
      // 6-card straight flush should beat it
      const sf6 = new Meld();
      sf6.setCards([
        new Card(Suit.DIAMONDS, Rank.TWO),
        new Card(Suit.DIAMONDS, Rank.THREE),
        new Card(Suit.DIAMONDS, Rank.FOUR),
        new Card(Suit.DIAMONDS, Rank.FIVE),
        new Card(Suit.DIAMONDS, Rank.SIX),
        new Card(Suit.DIAMONDS, Rank.SEVEN)
      ]);
      
      assert.strictEqual(gameState.isValidPlay(sf6), true);
    });
  });

  describe('Invalid Melds', () => {
    it('should not allow jokers in pairs', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.JOKER, Rank.SMALL_JOKER),
        new Card(Suit.JOKER, Rank.BIG_JOKER)
      ]);
      assert.strictEqual(meld.type, null);  // Invalid meld
    });

    it('should not detect 3H 4H 5H as three of a kind', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.THREE),
        new Card(Suit.HEARTS, Rank.FOUR),
        new Card(Suit.HEARTS, Rank.FIVE)
      ]);
      assert.strictEqual(meld.type, null);  // Invalid meld - not same rank
    });

    it('should handle odd number of cards that are not valid melds', () => {
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.THREE),
        new Card(Suit.DIAMONDS, Rank.THREE),
        new Card(Suit.CLUBS, Rank.FOUR),
        new Card(Suit.SPADES, Rank.FOUR),
        new Card(Suit.HEARTS, Rank.FIVE) // Odd card
      ]);
      assert.strictEqual(meld.type, null);  // Invalid meld
    });
  });

  describe('Game Play Rules', () => {
    it('must match meld type unless bomb', () => {
      const gameState = new GameState();
      
      // Set current meld as pair
      const pair = new Meld();
      pair.setCards([
        new Card(Suit.HEARTS, Rank.SEVEN),
        new Card(Suit.DIAMONDS, Rank.SEVEN)
      ]);
      gameState.currentMeld = pair;
      gameState.currentMeldType = MeldType.PAIR;
      gameState.currentMeldSize = 2;
      
      // Try to play a single card
      const single = new Meld();
      single.setCards([new Card(Suit.HEARTS, Rank.ACE)]);
      single.playerId = 'player2';  // Different player
      
      assert.strictEqual(gameState.isValidPlay(single), false);
    });

    it('must match card count for runs', () => {
      const gameState = new GameState();
      
      // Set 5-card run
      const run5 = new Meld();
      run5.setCards([
        new Card(Suit.HEARTS, Rank.THREE),
        new Card(Suit.DIAMONDS, Rank.FOUR),
        new Card(Suit.CLUBS, Rank.FIVE),
        new Card(Suit.SPADES, Rank.SIX),
        new Card(Suit.HEARTS, Rank.SEVEN)
      ]);
      gameState.currentMeld = run5;
      gameState.currentMeldType = MeldType.RUN;
      gameState.currentMeldSize = 5;
      
      // Try 6-card run
      const run6 = new Meld();
      run6.setCards([
        new Card(Suit.HEARTS, Rank.EIGHT),
        new Card(Suit.DIAMONDS, Rank.NINE),
        new Card(Suit.CLUBS, Rank.TEN),
        new Card(Suit.SPADES, Rank.JACK),
        new Card(Suit.HEARTS, Rank.QUEEN),
        new Card(Suit.DIAMONDS, Rank.KING)
      ]);
      run6.playerId = 'player2';  // Different player
      
      assert.strictEqual(gameState.isValidPlay(run6), false);
    });

    it('lead player can play any valid meld', () => {
      const gameState = new GameState();
      gameState.leadPlayerId = 'player1';
      
      const meld = new Meld();
      meld.setCards([new Card(Suit.HEARTS, Rank.THREE)]);
      meld.playerId = 'player1';
      
      assert.strictEqual(gameState.isValidPlay(meld), true);
    });

    it('lead player cannot play invalid meld', () => {
      const gameState = new GameState();
      gameState.leadPlayerId = 'player1';
      
      const meld = new Meld();
      meld.setCards([
        new Card(Suit.HEARTS, Rank.THREE),
        new Card(Suit.HEARTS, Rank.FOUR),
        new Card(Suit.DIAMONDS, Rank.FIVE)
      ]);
      meld.playerId = 'player1';
      
      assert.strictEqual(gameState.isValidPlay(meld), false);  // Invalid meld
    });

    it('after all pass, last player becomes leader', () => {
      const gameState = new GameState();
      
      // Add 3 players
      gameState.addPlayer('player1', 'Alice');
      gameState.addPlayer('player2', 'Bob');
      gameState.addPlayer('player3', 'Charlie');
      
      // Set up initial state
      gameState.currentTurnPlayerId = 'player1';
      gameState.leadPlayerId = 'player1';
      gameState.lastPlayerId = 'player1';
      
      // Player 1 plays a single card
      const meld = new Meld();
      meld.setCards([new Card(Suit.HEARTS, Rank.KING)]);
      gameState.currentMeld = meld;
      gameState.currentMeldType = MeldType.SINGLE;
      
      // Simulate all other players passing
      gameState.currentTurnPlayerId = 'player2';
      assert.strictEqual(gameState.pass('player2'), true);
      
      gameState.currentTurnPlayerId = 'player3';
      assert.strictEqual(gameState.pass('player3'), true);
      
      // After all pass, player1 should be the leader and current player
      assert.strictEqual(gameState.leadPlayerId, 'player1');
      assert.strictEqual(gameState.currentTurnPlayerId, 'player1');
      assert.strictEqual(gameState.currentMeld, null);  // Table cleared
      assert.strictEqual(gameState.consecutivePasses, 0);  // Reset
    });
  });
});
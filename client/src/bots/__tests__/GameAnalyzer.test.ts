import { GameAnalyzer } from '../GameAnalyzer';
import { Card, Meld, MeldType, Rank, Suit } from '../../types/game';
import assert from 'assert';

describe('GameAnalyzer', () => {
  let analyzer: GameAnalyzer;

  beforeEach(() => {
    analyzer = new GameAnalyzer();
  });

  // Helper function to create cards
  const createCard = (rank: Rank, suit: Suit): Card => ({
    rank,
    suit,
    code: `${rank}${suit}`,
    isSpecial: (rank === Rank.FIVE && suit === Suit.HEARTS) || 
                rank === Rank.SMALL_JOKER || 
                rank === Rank.BIG_JOKER
  });

  describe('findAllMelds', () => {
    it('should find singles from any hand', () => {
      const cards = [
        createCard(Rank.THREE, Suit.HEARTS),
        createCard(Rank.FIVE, Suit.CLUBS),
      ];
      
      const melds = analyzer.findAllMelds(cards);
      assert.strictEqual(melds.get(MeldType.SINGLE)?.length, 2);
    });

    it('should find pairs', () => {
      const cards = [
        createCard(Rank.THREE, Suit.HEARTS),
        createCard(Rank.THREE, Suit.CLUBS),
        createCard(Rank.FIVE, Suit.HEARTS),
        createCard(Rank.FIVE, Suit.CLUBS),
      ];
      
      const melds = analyzer.findAllMelds(cards);
      const pairs = melds.get(MeldType.PAIR);
      assert.strictEqual(pairs?.length, 2);
      assert.strictEqual(pairs![0].length, 2);
      assert.strictEqual(pairs![0][0].rank, Rank.THREE);
    });

    it('should find bombs (4 of a kind)', () => {
      const cards = [
        createCard(Rank.ACE, Suit.HEARTS),
        createCard(Rank.ACE, Suit.CLUBS),
        createCard(Rank.ACE, Suit.DIAMONDS),
        createCard(Rank.ACE, Suit.SPADES),
      ];
      
      const melds = analyzer.findAllMelds(cards);
      const bombs = melds.get(MeldType.BOMB);
      assert.strictEqual(bombs?.length, 1);
      assert.strictEqual(bombs![0].length, 4);
    });

    it('should find runs (5+ consecutive cards)', () => {
      const cards = [
        createCard(Rank.THREE, Suit.HEARTS),
        createCard(Rank.FOUR, Suit.CLUBS),
        createCard(Rank.FIVE, Suit.DIAMONDS),
        createCard(Rank.SIX, Suit.HEARTS),
        createCard(Rank.SEVEN, Suit.CLUBS),
      ];
      
      const melds = analyzer.findAllMelds(cards);
      const runs = melds.get(MeldType.RUN);
      assert.strictEqual(runs?.length, 1);
      assert.strictEqual(runs![0].length, 5);
    });

    it('should find high ace runs (10-J-Q-K-A)', () => {
      const cards = [
        createCard(Rank.TEN, Suit.HEARTS),
        createCard(Rank.JACK, Suit.CLUBS),
        createCard(Rank.QUEEN, Suit.DIAMONDS),
        createCard(Rank.KING, Suit.HEARTS),
        createCard(Rank.ACE, Suit.CLUBS),
      ];
      
      const melds = analyzer.findAllMelds(cards);
      const runs = melds.get(MeldType.RUN);
      assert.strictEqual(runs?.length, 1);
      assert.strictEqual(runs![0].length, 5);
    });

    it('should find wheel runs (A-2-3-4-5)', () => {
      const cards = [
        createCard(Rank.ACE, Suit.HEARTS),
        createCard(Rank.TWO, Suit.CLUBS),
        createCard(Rank.THREE, Suit.DIAMONDS),
        createCard(Rank.FOUR, Suit.HEARTS),
        createCard(Rank.FIVE, Suit.CLUBS),
      ];
      
      const melds = analyzer.findAllMelds(cards);
      const runs = melds.get(MeldType.RUN);
      assert.strictEqual(runs?.length, 1);
      assert.strictEqual(runs![0].length, 5);
    });

    it('should find straight flushes', () => {
      const cards = [
        createCard(Rank.THREE, Suit.HEARTS),
        createCard(Rank.FOUR, Suit.HEARTS),
        createCard(Rank.FIVE, Suit.HEARTS),
        createCard(Rank.SIX, Suit.HEARTS),
        createCard(Rank.SEVEN, Suit.HEARTS),
      ];
      
      const melds = analyzer.findAllMelds(cards);
      const straightFlushes = melds.get(MeldType.STRAIGHT_FLUSH);
      assert.strictEqual(straightFlushes?.length, 1);
      assert.strictEqual(straightFlushes![0].length, 5);
    });
  });

  describe('findValidPlays', () => {
    it('should allow leader to play any meld when no current meld', () => {
      const hand = [
        createCard(Rank.THREE, Suit.HEARTS),
        createCard(Rank.THREE, Suit.CLUBS),
        createCard(Rank.FIVE, Suit.HEARTS),
      ];
      
      const validPlays = analyzer.findValidPlays(hand, null, true);
      assert(validPlays.length > 0);
      // Should include singles and pairs
      assert(validPlays.some(play => play.length === 1));
      assert(validPlays.some(play => play.length === 2));
    });

    it('should not allow non-leader to play when no current meld', () => {
      const hand = [
        createCard(Rank.THREE, Suit.HEARTS),
        createCard(Rank.THREE, Suit.CLUBS),
      ];
      
      const validPlays = analyzer.findValidPlays(hand, null, false);
      assert.strictEqual(validPlays.length, 0);
    });

    it('should find singles that beat current single', () => {
      const hand = [
        createCard(Rank.THREE, Suit.HEARTS),
        createCard(Rank.KING, Suit.CLUBS),
        createCard(Rank.ACE, Suit.HEARTS),
      ];
      
      const currentMeld: Meld = {
        cards: [createCard(Rank.JACK, Suit.HEARTS)],
        type: MeldType.SINGLE,
        strength: Rank.JACK,
        playerId: 'opponent'
      };
      
      const validPlays = analyzer.findValidPlays(hand, currentMeld, false);
      // Should include K and A, but not 3
      assert.strictEqual(validPlays.length, 2);
      assert(validPlays.every(play => play[0].rank > Rank.JACK));
    });

    it('should allow bombs to beat non-bomb melds', () => {
      const hand = [
        createCard(Rank.THREE, Suit.HEARTS),
        createCard(Rank.THREE, Suit.CLUBS),
        createCard(Rank.THREE, Suit.DIAMONDS),
        createCard(Rank.THREE, Suit.SPADES),
      ];
      
      const currentMeld: Meld = {
        cards: [
          createCard(Rank.ACE, Suit.HEARTS),
          createCard(Rank.ACE, Suit.CLUBS)
        ],
        type: MeldType.PAIR,
        strength: Rank.ACE,
        playerId: 'opponent'
      };
      
      const validPlays = analyzer.findValidPlays(hand, currentMeld, false);
      assert.strictEqual(validPlays.length, 1); // Bomb beats any pair
      assert.strictEqual(validPlays[0].length, 4);
    });

    it('should handle 5 of hearts special card correctly', () => {
      const hand = [
        createCard(Rank.FIVE, Suit.HEARTS), // Special card
        createCard(Rank.ACE, Suit.CLUBS),
        createCard(Rank.TWO, Suit.HEARTS),
      ];
      
      const currentMeld: Meld = {
        cards: [createCard(Rank.TWO, Suit.CLUBS)],
        type: MeldType.SINGLE,
        strength: Rank.TWO,
        playerId: 'opponent'
      };
      
      const validPlays = analyzer.findValidPlays(hand, currentMeld, false);
      // Only 5H should beat 2 (5H has strength 18)
      assert.strictEqual(validPlays.length, 1);
      assert.strictEqual(validPlays[0][0].rank, Rank.FIVE);
      assert.strictEqual(validPlays[0][0].suit, Suit.HEARTS);
    });
  });

  describe('evaluateHandStrength', () => {
    it('should give higher scores for high cards', () => {
      const weakHand = [
        createCard(Rank.THREE, Suit.HEARTS),
        createCard(Rank.FOUR, Suit.CLUBS),
        createCard(Rank.FIVE, Suit.DIAMONDS),
      ];
      
      const strongHand = [
        createCard(Rank.KING, Suit.HEARTS),
        createCard(Rank.ACE, Suit.CLUBS),
        createCard(Rank.TWO, Suit.DIAMONDS),
      ];
      
      const weakScore = analyzer.evaluateHandStrength(weakHand);
      const strongScore = analyzer.evaluateHandStrength(strongHand);
      
      assert(strongScore > weakScore);
    });

    it('should give bonus for special cards', () => {
      const normalHand = [
        createCard(Rank.FIVE, Suit.CLUBS),
        createCard(Rank.KING, Suit.HEARTS),
      ];
      
      const specialHand = [
        createCard(Rank.FIVE, Suit.HEARTS), // Special 5H
        createCard(Rank.KING, Suit.CLUBS),
      ];
      
      const normalScore = analyzer.evaluateHandStrength(normalHand);
      const specialScore = analyzer.evaluateHandStrength(specialHand);
      
      assert(specialScore > normalScore);
    });

    it('should give bonus for bombs', () => {
      const noBombHand = [
        createCard(Rank.THREE, Suit.HEARTS),
        createCard(Rank.FOUR, Suit.CLUBS),
        createCard(Rank.FIVE, Suit.DIAMONDS),
        createCard(Rank.SIX, Suit.HEARTS),
      ];
      
      const bombHand = [
        createCard(Rank.THREE, Suit.HEARTS),
        createCard(Rank.THREE, Suit.CLUBS),
        createCard(Rank.THREE, Suit.DIAMONDS),
        createCard(Rank.THREE, Suit.SPADES),
      ];
      
      const noBombScore = analyzer.evaluateHandStrength(noBombHand);
      const bombScore = analyzer.evaluateHandStrength(bombHand);
      
      assert(bombScore > noBombScore);
    });

    it('should cap scores between 0 and 100', () => {
      const amazingHand = [
        createCard(Rank.ACE, Suit.HEARTS),
        createCard(Rank.ACE, Suit.CLUBS),
        createCard(Rank.ACE, Suit.DIAMONDS),
        createCard(Rank.ACE, Suit.SPADES),
        createCard(Rank.KING, Suit.HEARTS),
        createCard(Rank.KING, Suit.CLUBS),
        createCard(Rank.KING, Suit.DIAMONDS),
        createCard(Rank.KING, Suit.SPADES),
        createCard(Rank.FIVE, Suit.HEARTS),
        createCard(Rank.SMALL_JOKER, Suit.JOKER),
        createCard(Rank.BIG_JOKER, Suit.JOKER),
      ];
      
      const score = analyzer.evaluateHandStrength(amazingHand);
      assert(score <= 100);
      assert(score >= 0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty hand', () => {
      const melds = analyzer.findAllMelds([]);
      assert.strictEqual(melds.size, 0);
      
      const strength = analyzer.evaluateHandStrength([]);
      assert.strictEqual(strength, 0);
    });

    it('should not count jokers as pairs', () => {
      const hand = [
        createCard(Rank.SMALL_JOKER, Suit.JOKER),
        createCard(Rank.BIG_JOKER, Suit.JOKER),
      ];
      
      const melds = analyzer.findAllMelds(hand);
      const pairs = melds.get(MeldType.PAIR);
      assert.strictEqual(pairs, undefined);
    });

    it('should find all possible pairs when multiple exist', () => {
      const hand = [
        createCard(Rank.THREE, Suit.HEARTS),
        createCard(Rank.THREE, Suit.CLUBS),
        createCard(Rank.THREE, Suit.DIAMONDS),
        createCard(Rank.THREE, Suit.SPADES),
      ];
      
      const melds = analyzer.findAllMelds(hand);
      const pairs = melds.get(MeldType.PAIR);
      // Should find C(4,2) = 6 different pairs
      assert.strictEqual(pairs?.length, 6);
    });
  });
});
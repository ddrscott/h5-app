import { Card, Meld, MeldType, Rank, Suit } from '../types/game';
import { GameContext } from './types';

/**
 * Game analyzer for bots to understand valid plays and evaluate hands
 * This replicates server-side logic for client-side analysis
 */
export class GameAnalyzer {
  /**
   * Find all valid melds that can be made from a hand
   */
  findAllMelds(cards: Card[]): Map<MeldType, Card[][]> {
    const melds = new Map<MeldType, Card[][]>();
    
    // Singles
    if (cards.length > 0) {
      melds.set(MeldType.SINGLE, cards.map(c => [c]));
    }
    
    // Pairs
    const pairs = this.findPairs(cards);
    if (pairs.length > 0) melds.set(MeldType.PAIR, pairs);
    
    // Three of a kind
    const threes = this.findThreeOfKind(cards);
    if (threes.length > 0) melds.set(MeldType.THREE_OF_KIND, threes);
    
    // Bombs (4 of a kind)
    const bombs = this.findBombs(cards);
    if (bombs.length > 0) melds.set(MeldType.BOMB, bombs);
    
    // Full houses
    const fullHouses = this.findFullHouses(cards);
    if (fullHouses.length > 0) melds.set(MeldType.FULL_HOUSE, fullHouses);
    
    // Sisters (consecutive pairs/triples)
    const sisters = this.findSisters(cards);
    if (sisters.length > 0) melds.set(MeldType.SISTERS, sisters);
    
    // Runs (5+ consecutive cards)
    const runs = this.findRuns(cards);
    if (runs.length > 0) melds.set(MeldType.RUN, runs);
    
    // Straight flushes
    const straightFlushes = this.findStraightFlushes(cards);
    if (straightFlushes.length > 0) melds.set(MeldType.STRAIGHT_FLUSH, straightFlushes);
    
    return melds;
  }

  /**
   * Find all valid plays that can beat the current meld
   */
  findValidPlays(hand: Card[], currentMeld: Meld | null, isLeader: boolean): Card[][] {
    // If we're the leader starting a new round (no meld to beat)
    if (isLeader && !currentMeld) {
      // Leader can play any valid meld
      const allMelds = this.findAllMelds(hand);
      const plays: Card[][] = [];
      allMelds.forEach(meldsOfType => plays.push(...meldsOfType));
      return plays;
    }
    
    // If there's no current meld and we're not the leader, we can't play
    if (!currentMeld) return [];
    
    const validPlays: Card[][] = [];
    
    // Find melds of the same type that beat the current one
    const samTypeMelds = this.findMeldsOfType(hand, currentMeld.type, currentMeld.cards.length);
    for (const meld of samTypeMelds) {
      if (this.compareMelds(meld, currentMeld.cards) > 0) {
        validPlays.push(meld);
      }
    }
    
    // Bombs and straight flushes can beat anything
    if (currentMeld.type !== MeldType.BOMB && currentMeld.type !== MeldType.STRAIGHT_FLUSH) {
      const bombs = this.findBombs(hand);
      const straightFlushes = this.findStraightFlushes(hand);
      validPlays.push(...bombs, ...straightFlushes);
    } else if (currentMeld.type === MeldType.BOMB) {
      // Only stronger bombs or straight flushes can beat bombs
      const bombs = this.findBombs(hand);
      for (const bomb of bombs) {
        if (this.compareMelds(bomb, currentMeld.cards) > 0) {
          validPlays.push(bomb);
        }
      }
      validPlays.push(...this.findStraightFlushes(hand));
    }
    
    return validPlays;
  }

  /**
   * Evaluate the strength of a hand (0-100)
   */
  evaluateHandStrength(cards: Card[]): number {
    let strength = 0;
    
    // Base strength from high cards
    const highCards = cards.filter(c => c.rank >= Rank.KING).length;
    strength += highCards * 5;
    
    // Bonus for special cards
    const hasHeartFive = cards.some(c => c.rank === Rank.FIVE && c.suit === Suit.HEARTS);
    const hasSmallJoker = cards.some(c => c.rank === Rank.SMALL_JOKER);
    const hasBigJoker = cards.some(c => c.rank === Rank.BIG_JOKER);
    
    if (hasHeartFive) strength += 15;
    if (hasSmallJoker) strength += 10;
    if (hasBigJoker) strength += 12;
    
    // Bonus for bombs
    const bombs = this.findBombs(cards);
    strength += bombs.length * 20;
    
    // Bonus for straight flushes
    const straightFlushes = this.findStraightFlushes(cards);
    strength += straightFlushes.length * 25;
    
    // Bonus for full houses
    const fullHouses = this.findFullHouses(cards);
    strength += fullHouses.length * 8;
    
    // Penalty for too many cards
    if (cards.length > 15) strength -= (cards.length - 15) * 2;
    
    return Math.min(100, Math.max(0, strength));
  }

  /**
   * Compare two melds, returns positive if meld1 beats meld2
   */
  private compareMelds(meld1: Card[], meld2: Card[]): number {
    const strength1 = this.calculateMeldStrength(meld1);
    const strength2 = this.calculateMeldStrength(meld2);
    return strength1 - strength2;
  }

  /**
   * Calculate the strength value of a meld
   */
  private calculateMeldStrength(cards: Card[]): number {
    if (cards.length === 0) return 0;
    
    const meldType = this.determineMeldType(cards);
    
    switch (meldType) {
      case MeldType.SINGLE:
        return this.getCardStrength(cards[0]);
      
      case MeldType.PAIR:
      case MeldType.THREE_OF_KIND:
      case MeldType.BOMB:
        return cards[0].rank;
      
      case MeldType.FULL_HOUSE:
        // Find the triple's rank
        const ranks = new Map<number, number>();
        cards.forEach(c => ranks.set(c.rank, (ranks.get(c.rank) || 0) + 1));
        for (const [rank, count] of ranks) {
          if (count === 3) return rank;
        }
        return 0;
      
      case MeldType.SISTERS:
        return Math.max(...cards.map(c => c.rank));
      
      case MeldType.RUN:
      case MeldType.STRAIGHT_FLUSH:
        // For runs, the highest card determines strength
        const runRanks = cards.map(c => c.rank);
        
        // Special case for A-2-3-4-5 (wheel) - strength is 5
        if (runRanks.includes(Rank.ACE) && runRanks.includes(Rank.TWO) && 
            runRanks.includes(Rank.THREE) && runRanks.includes(Rank.FOUR) && runRanks.includes(Rank.FIVE)) {
          return Rank.FIVE; // Wheel has strength of 5
        }
        
        // For all other runs, use the highest rank
        return Math.max(...runRanks);
      
      default:
        return 0;
    }
  }

  /**
   * Get strength of individual card (handles special cards)
   */
  private getCardStrength(card: Card): number {
    if (card.rank === Rank.FIVE && card.suit === Suit.HEARTS) {
      return 18; // Highest strength
    }
    return card.rank;
  }

  /**
   * Determine meld type from cards
   */
  private determineMeldType(cards: Card[]): MeldType | null {
    const count = cards.length;
    
    if (count === 1) return MeldType.SINGLE;
    if (count === 2 && this.isPair(cards)) return MeldType.PAIR;
    if (count === 3 && this.allSameRank(cards)) return MeldType.THREE_OF_KIND;
    if (count === 4 && this.allSameRank(cards)) return MeldType.BOMB;
    if (count === 5 && this.isFullHouse(cards)) return MeldType.FULL_HOUSE;
    if (count >= 4 && this.isSisters(cards)) return MeldType.SISTERS;
    if (count >= 5 && this.isStraightFlush(cards)) return MeldType.STRAIGHT_FLUSH;
    if (count >= 5 && this.isRun(cards)) return MeldType.RUN;
    
    return null;
  }

  private findMeldsOfType(cards: Card[], type: MeldType, size: number): Card[][] {
    switch (type) {
      case MeldType.SINGLE:
        return cards.map(c => [c]);
      case MeldType.PAIR:
        return this.findPairs(cards);
      case MeldType.THREE_OF_KIND:
        return this.findThreeOfKind(cards);
      case MeldType.BOMB:
        return this.findBombs(cards);
      case MeldType.FULL_HOUSE:
        return this.findFullHouses(cards);
      case MeldType.SISTERS:
        return this.findSisters(cards).filter(s => s.length === size);
      case MeldType.RUN:
        return this.findRuns(cards).filter(r => r.length === size);
      case MeldType.STRAIGHT_FLUSH:
        return this.findStraightFlushes(cards).filter(sf => sf.length === size);
      default:
        return [];
    }
  }

  private findPairs(cards: Card[]): Card[][] {
    const pairs: Card[][] = [];
    const rankMap = this.groupByRank(cards);
    
    rankMap.forEach((cardsOfRank, rank) => {
      if (rank === Rank.SMALL_JOKER || rank === Rank.BIG_JOKER) return;
      if (cardsOfRank.length >= 2) {
        // Generate all possible pairs
        for (let i = 0; i < cardsOfRank.length - 1; i++) {
          for (let j = i + 1; j < cardsOfRank.length; j++) {
            pairs.push([cardsOfRank[i], cardsOfRank[j]]);
          }
        }
      }
    });
    
    return pairs;
  }

  private findThreeOfKind(cards: Card[]): Card[][] {
    const threes: Card[][] = [];
    const rankMap = this.groupByRank(cards);
    
    rankMap.forEach((cardsOfRank) => {
      if (cardsOfRank.length >= 3) {
        // Generate all possible combinations of 3
        for (let i = 0; i < cardsOfRank.length - 2; i++) {
          for (let j = i + 1; j < cardsOfRank.length - 1; j++) {
            for (let k = j + 1; k < cardsOfRank.length; k++) {
              threes.push([cardsOfRank[i], cardsOfRank[j], cardsOfRank[k]]);
            }
          }
        }
      }
    });
    
    return threes;
  }

  private findBombs(cards: Card[]): Card[][] {
    const bombs: Card[][] = [];
    const rankMap = this.groupByRank(cards);
    
    rankMap.forEach((cardsOfRank) => {
      if (cardsOfRank.length === 4) {
        bombs.push([...cardsOfRank]);
      }
    });
    
    return bombs;
  }

  private findFullHouses(cards: Card[]): Card[][] {
    const fullHouses: Card[][] = [];
    const threes = this.findThreeOfKind(cards);
    const pairs = this.findPairs(cards);
    
    for (const three of threes) {
      for (const pair of pairs) {
        // Make sure the pair isn't the same rank as the triple
        if (three[0].rank !== pair[0].rank) {
          fullHouses.push([...three, ...pair]);
        }
      }
    }
    
    return fullHouses;
  }

  private findSisters(cards: Card[]): Card[][] {
    const sisters: Card[][] = [];
    const rankMap = this.groupByRank(cards);
    
    // Try to find consecutive pairs and triples
    const ranks = Array.from(rankMap.keys()).sort((a, b) => a - b);
    
    // Check for consecutive pairs
    for (let i = 0; i < ranks.length - 1; i++) {
      const pairs: Card[][] = [];
      let j = i;
      
      while (j < ranks.length && rankMap.get(ranks[j])!.length >= 2) {
        if (j > i && ranks[j] !== ranks[j-1] + 1) break;
        pairs.push(rankMap.get(ranks[j])!.slice(0, 2));
        j++;
      }
      
      if (pairs.length >= 2) {
        sisters.push(pairs.flat());
      }
    }
    
    // Check for consecutive triples
    for (let i = 0; i < ranks.length - 1; i++) {
      const triples: Card[][] = [];
      let j = i;
      
      while (j < ranks.length && rankMap.get(ranks[j])!.length >= 3) {
        if (j > i && ranks[j] !== ranks[j-1] + 1) break;
        triples.push(rankMap.get(ranks[j])!.slice(0, 3));
        j++;
      }
      
      if (triples.length >= 2) {
        sisters.push(triples.flat());
      }
    }
    
    return sisters;
  }

  private findRuns(cards: Card[]): Card[][] {
    const runs: Card[][] = [];
    
    // Group cards by rank to avoid duplicates
    const rankMap = new Map<number, Card[]>();
    cards.forEach(card => {
      if (!rankMap.has(card.rank)) rankMap.set(card.rank, []);
      rankMap.get(card.rank)!.push(card);
    });
    
    const ranks = Array.from(rankMap.keys()).sort((a, b) => a - b);
    
    // Find normal consecutive runs (e.g., 3-4-5-6-7 or 10-J-Q-K-A)
    for (let start = 0; start < ranks.length - 4; start++) {
      const runCards: Card[] = [];
      let consecutive = true;
      
      for (let i = 0; i < 5 && start + i < ranks.length; i++) {
        if (i > 0 && ranks[start + i] !== ranks[start + i - 1] + 1) {
          consecutive = false;
          break;
        }
        runCards.push(rankMap.get(ranks[start + i])![0]);
      }
      
      if (consecutive && runCards.length >= 5) {
        runs.push([...runCards]);
        
        // Check for longer runs
        for (let i = start + 5; i < ranks.length; i++) {
          if (ranks[i] === ranks[i - 1] + 1) {
            runCards.push(rankMap.get(ranks[i])![0]);
            runs.push([...runCards]);
          } else {
            break;
          }
        }
      }
    }
    
    // Check for wheel (A-2-3-4-5)
    const hasWheel = [Rank.ACE, Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE]
      .every(rank => rankMap.has(rank));
    
    if (hasWheel) {
      const wheelCards = [
        rankMap.get(Rank.ACE)![0],
        rankMap.get(Rank.TWO)![0],
        rankMap.get(Rank.THREE)![0],
        rankMap.get(Rank.FOUR)![0],
        rankMap.get(Rank.FIVE)![0],
      ];
      runs.push(wheelCards);
    }
    
    return runs;
  }

  private findStraightFlushes(cards: Card[]): Card[][] {
    const straightFlushes: Card[][] = [];
    
    // Group by suit first
    const suitMap = new Map<Suit, Card[]>();
    cards.forEach(card => {
      if (!suitMap.has(card.suit)) suitMap.set(card.suit, []);
      suitMap.get(card.suit)!.push(card);
    });
    
    // Find runs within each suit
    suitMap.forEach((suitCards) => {
      if (suitCards.length >= 5) {
        const runs = this.findRuns(suitCards);
        straightFlushes.push(...runs);
      }
    });
    
    return straightFlushes;
  }

  private groupByRank(cards: Card[]): Map<number, Card[]> {
    const map = new Map<number, Card[]>();
    cards.forEach(card => {
      if (!map.has(card.rank)) map.set(card.rank, []);
      map.get(card.rank)!.push(card);
    });
    return map;
  }

  private allSameRank(cards: Card[]): boolean {
    return cards.every(c => c.rank === cards[0].rank);
  }

  private isPair(cards: Card[]): boolean {
    return cards.length === 2 && 
           cards[0].rank === cards[1].rank &&
           cards[0].rank !== Rank.SMALL_JOKER &&
           cards[0].rank !== Rank.BIG_JOKER;
  }

  private isFullHouse(cards: Card[]): boolean {
    if (cards.length !== 5) return false;
    const ranks = new Map<number, number>();
    cards.forEach(c => ranks.set(c.rank, (ranks.get(c.rank) || 0) + 1));
    const counts = Array.from(ranks.values()).sort();
    return counts.length === 2 && counts[0] === 2 && counts[1] === 3;
  }

  private isSisters(cards: Card[]): boolean {
    if (cards.length < 4) return false;
    
    const rankGroups = new Map<number, Card[]>();
    cards.forEach(card => {
      if (!rankGroups.has(card.rank)) rankGroups.set(card.rank, []);
      rankGroups.get(card.rank)!.push(card);
    });
    
    const groupSizes = Array.from(rankGroups.values()).map(g => g.length);
    const groupSize = groupSizes[0];
    if (groupSize < 2 || groupSize > 3) return false;
    if (!groupSizes.every(size => size === groupSize)) return false;
    
    const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => a - b);
    for (let i = 1; i < sortedRanks.length; i++) {
      if (sortedRanks[i] !== sortedRanks[i - 1] + 1) return false;
    }
    
    return true;
  }

  private isRun(cards: Card[]): boolean {
    if (cards.length < 5) return false;
    
    const ranks = [...new Set(cards.map(c => c.rank))];
    if (ranks.length !== cards.length) return false;
    
    // Sort ranks to check for consecutive sequence
    const sortedRanks = [...ranks].sort((a, b) => a - b);
    
    // Check if it's a normal consecutive run (e.g., 3-4-5-6-7 or 10-J-Q-K-A)
    let isConsecutive = true;
    for (let i = 1; i < sortedRanks.length; i++) {
      if (sortedRanks[i] !== sortedRanks[i - 1] + 1) {
        isConsecutive = false;
        break;
      }
    }
    
    if (isConsecutive) return true;
    
    // Special case: A-2-3-4-5 (wheel/steel wheel)
    // Check if we have A (14) and 2 (15) along with 3,4,5
    if (ranks.includes(Rank.ACE) && ranks.includes(Rank.TWO) && 
        ranks.includes(Rank.THREE) && ranks.includes(Rank.FOUR) && ranks.includes(Rank.FIVE)) {
      // Make sure it's exactly these 5 cards
      const wheelRanks = [Rank.ACE, Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE];
      if (ranks.length === 5 && ranks.every(r => wheelRanks.includes(r))) {
        return true;
      }
    }
    
    return false;
  }

  private isStraightFlush(cards: Card[]): boolean {
    if (!this.isRun(cards)) return false;
    const suits = new Set(cards.map(c => c.suit));
    return suits.size === 1;
  }
}
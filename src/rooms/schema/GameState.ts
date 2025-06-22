import { Schema, ArraySchema, MapSchema, type, view } from "@colyseus/schema";

export enum Suit {
  CLUBS = "C",
  DIAMONDS = "D", 
  HEARTS = "H",
  SPADES = "S",
  JOKER = "J"
}

export enum Rank {
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  EIGHT = 8,
  NINE = 9,
  TEN = 10,
  JACK = 11,
  QUEEN = 12,
  KING = 13,
  ACE = 14,
  TWO = 15,
  SMALL_JOKER = 16,
  BIG_JOKER = 17,
  FIVE_OF_HEARTS = 18
}

export enum MeldType {
  SINGLE = "SINGLE",
  PAIR = "PAIR",
  THREE_OF_KIND = "THREE_OF_KIND",
  BOMB = "BOMB",
  SISTERS = "SISTERS",
  FULL_HOUSE = "FULL_HOUSE",
  RUN = "RUN",
  STRAIGHT_FLUSH = "STRAIGHT_FLUSH"
}

export enum GamePhase {
  WAITING = "WAITING",
  DEALING = "DEALING",
  PLAYING = "PLAYING",
  ROUND_END = "ROUND_END",
  GAME_END = "GAME_END"
}

export class Card extends Schema {
  @type("string") suit: Suit;
  @type("number") rank: Rank;
  @type("string") code: string;
  @type("boolean") isSpecial: boolean = false;

  constructor(suit?: Suit, rank?: Rank) {
    super();
    if (rank !== undefined) {
      this.suit = suit;
      this.rank = rank;
      this.code = this.generateCode();
      this.isSpecial = this.checkIfSpecial();
    }
  }

  private generateCode(): string {
    if (this.rank === Rank.SMALL_JOKER) return "jj";
    if (this.rank === Rank.BIG_JOKER) return "JJ";
    
    const rankMap: { [key: number]: string } = {
      10: "T",
      11: "J", 
      12: "Q",
      13: "K",
      14: "A",
      15: "2"
    };
    
    const rankStr = rankMap[this.rank] || this.rank.toString();
    return rankStr + this.suit;
  }

  private checkIfSpecial(): boolean {
    return (this.rank === Rank.FIVE && this.suit === Suit.HEARTS) ||
           this.rank === Rank.SMALL_JOKER ||
           this.rank === Rank.BIG_JOKER;
  }

  getStrength(): number {
    if (this.rank === Rank.FIVE && this.suit === Suit.HEARTS) {
      return Rank.FIVE_OF_HEARTS;
    }
    return this.rank;
  }
}

export class Meld extends Schema {
  @type([Card]) cards = new ArraySchema<Card>();
  @type("string") type: MeldType;
  @type("number") strength: number;
  @type("string") playerId: string;

  setCards(cards: Card[]) {
    this.cards.clear();
    cards.forEach(card => {
      // Create a new Card instance for the meld
      const meldCard = new Card(card.suit, card.rank);
      this.cards.push(meldCard);
    });
    this.type = this.determineMeldType();
    this.strength = this.calculateStrength();
  }

  private determineMeldType(): MeldType {
    const count = this.cards.length;
    
    if (count === 1) return MeldType.SINGLE;
    if (count === 2 && this.isPair()) return MeldType.PAIR;
    if (count === 3 && this.allSameRank()) return MeldType.THREE_OF_KIND;
    if (count === 4 && this.allSameRank()) return MeldType.BOMB;
    
    if (count === 5 && this.isFullHouse()) return MeldType.FULL_HOUSE;
    if (count >= 4 && this.isSisters()) return MeldType.SISTERS;
    if (count >= 5 && this.isStraightFlush()) return MeldType.STRAIGHT_FLUSH;
    if (count >= 5 && this.isRun()) return MeldType.RUN;
    
    // Invalid meld - default to invalid type
    return null;
  }

  private allSameRank(): boolean {
    return this.cards.every(card => card.rank === this.cards[0].rank);
  }

  private isPair(): boolean {
    if (this.cards.length !== 2) return false;
    // Check same rank and neither is a joker
    return this.cards[0].rank === this.cards[1].rank && 
           this.cards[0].rank !== Rank.SMALL_JOKER && 
           this.cards[0].rank !== Rank.BIG_JOKER;
  }

  private isFullHouse(): boolean {
    if (this.cards.length !== 5) return false;
    
    const ranks = new Map<number, number>();
    this.cards.forEach(card => {
      ranks.set(card.rank, (ranks.get(card.rank) || 0) + 1);
    });
    
    const counts = Array.from(ranks.values()).sort();
    return counts.length === 2 && counts[0] === 2 && counts[1] === 3;
  }

  private isSisters(): boolean {
    if (this.cards.length < 4) return false;
    
    // Group cards by rank
    const rankGroups = new Map<number, Card[]>();
    this.cards.forEach(card => {
      if (!rankGroups.has(card.rank)) {
        rankGroups.set(card.rank, []);
      }
      rankGroups.get(card.rank).push(card);
    });
    
    // Check if all groups have same size (2 or 3)
    const groupSizes = Array.from(rankGroups.values()).map(g => g.length);
    const groupSize = groupSizes[0];
    if (groupSize < 2 || groupSize > 3) return false;
    if (!groupSizes.every(size => size === groupSize)) return false;
    
    // Check if ranks are consecutive
    // For sisters, A and 2 are NOT consecutive (unlike in runs)
    const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => a - b);
    for (let i = 1; i < sortedRanks.length; i++) {
      if (sortedRanks[i] !== sortedRanks[i - 1] + 1) return false;
    }
    
    return true;
  }

  private isRun(): boolean {
    if (this.cards.length < 5) return false;
    
    // Get unique ranks
    const ranks = [...new Set(this.cards.map(c => c.rank))];
    if (ranks.length !== this.cards.length) return false;
    
    // For runs, 2 is considered low (after Ace)
    // Map ranks for run ordering: 3-K stay same, A=1, 2=2
    const runRanks = ranks.map(r => {
      if (r === Rank.ACE) return 1;  // A is low in runs
      if (r === Rank.TWO) return 2;  // 2 is low in runs
      return r;
    }).sort((a, b) => a - b);
    
    // Check consecutive
    for (let i = 1; i < runRanks.length; i++) {
      if (runRanks[i] !== runRanks[i - 1] + 1) return false;
    }
    
    return true;
  }

  private isStraightFlush(): boolean {
    if (!this.isRun()) return false;
    
    const suits = new Set(this.cards.map(c => c.suit));
    return suits.size === 1;
  }

  private calculateStrength(): number {
    if (!this.type) return 0;
    
    switch (this.type) {
      case MeldType.SINGLE:
        return this.cards[0].getStrength();
      
      case MeldType.PAIR:
      case MeldType.THREE_OF_KIND:
      case MeldType.BOMB:
        return this.cards[0].rank;
      
      case MeldType.FULL_HOUSE:
        const ranks = new Map<number, number>();
        this.cards.forEach(card => {
          ranks.set(card.rank, (ranks.get(card.rank) || 0) + 1);
        });
        for (const [rank, count] of ranks) {
          if (count === 3) return rank;
        }
        return 0;
      
      case MeldType.SISTERS:
        return Math.max(...this.cards.map(c => c.rank));
      
      case MeldType.RUN:
      case MeldType.STRAIGHT_FLUSH:
        // For runs, the highest card determines strength
        // But we need to handle A and 2 being low
        const runRanks = this.cards.map(c => {
          if (c.rank === Rank.ACE) return 1;
          if (c.rank === Rank.TWO) return 2;
          return c.rank;
        });
        return Math.max(...runRanks);
      
      default:
        return 0;
    }
  }
}

export class Player extends Schema {
  @type("string") id: string;
  @type("string") name: string;
  hand = new ArraySchema<Card>(); // Not synced - sent via messages
  @type("number") handCount: number = 0;
  @type("boolean") isActive: boolean = true;
  @type("boolean") hasPassed: boolean = false;
  @type("boolean") isOut: boolean = false;
  @type("number") wins: number = 0;
  @type("number") losses: number = 0;
  @type("number") position: number;

  constructor(id?: string, name?: string) {
    super();
    if (id && name) {
      this.id = id;
      this.name = name;
    }
  }

  addCard(card: Card) {
    this.hand.push(card);
    this.handCount = this.hand.length;
  }

  removeCards(cards: Card[]) {
    const cardCodes = new Set(cards.map(c => c.code));
    const newHand = this.hand.filter(c => !cardCodes.has(c.code));
    this.hand.clear();
    newHand.forEach(card => this.hand.push(card));
    
    this.handCount = this.hand.length;
    if (this.hand.length === 0) {
      this.isOut = true;
    }
  }

  sortHand() {
    const sorted = [...this.hand].sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.suit.localeCompare(b.suit);
    });
    this.hand.clear();
    sorted.forEach(card => this.hand.push(card));
  }
}

export class GameState extends Schema {
  @type("string") roomId: string;
  @type("string") phase: GamePhase = GamePhase.WAITING;
  @type("number") currentRound: number = 0;
  @type("number") targetWins: number = 10;
  @type("number") numberOfDecks: number = 1;
  
  @type({map: Player}) players = new MapSchema<Player>();
  @view() @type([Card]) deck = new ArraySchema<Card>();
  @type([Card]) discardPile = new ArraySchema<Card>();
  
  @type("string") currentTurnPlayerId: string;
  @type("string") leadPlayerId: string;
  @type("string") lastPlayerId: string;
  @type("string") roundWinnerId: string;
  
  @type(Meld) currentMeld: Meld;
  @type("string") currentMeldType: MeldType;
  @type("number") currentMeldSize: number = 0;
  
  @type(["string"]) turnOrder = new ArraySchema<string>();
  @type("number") consecutivePasses: number = 0;
  @type("boolean") bombPlayed: boolean = false;

  initializeDeck() {
    this.deck.clear();
    
    for (let d = 0; d < this.numberOfDecks; d++) {
      // Add regular cards (exclude JOKER suit)
      for (const suit of [Suit.CLUBS, Suit.DIAMONDS, Suit.HEARTS, Suit.SPADES]) {
        for (let rank = Rank.THREE; rank <= Rank.TWO; rank++) {
          this.deck.push(new Card(suit, rank));
        }
      }
      
      // Add jokers with JOKER suit
      this.deck.push(new Card(Suit.JOKER, Rank.SMALL_JOKER));
      this.deck.push(new Card(Suit.JOKER, Rank.BIG_JOKER));
    }
    
    this.shuffleDeck();
  }

  addPlayer(id: string, name: string) {
    if (this.players.has(id)) return;
    
    const player = new Player(id, name);
    player.position = this.players.size;
    this.players.set(id, player);  // object set by id
    this.turnOrder.push(id);
    
    if (this.players.size > 6) {
      this.numberOfDecks = Math.ceil(this.players.size / 4);
    }
  }

  removePlayer(id: string) {
    this.players.delete(id);
    const index = this.turnOrder.indexOf(id);
    if (index > -1) {
      this.turnOrder.splice(index, 1);
    }
  }


  private shuffleDeck() {
    const cards = [...this.deck];
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    this.deck.clear();
    cards.forEach(card => this.deck.push(card));
  }

  dealCards() {
    this.phase = GamePhase.DEALING;
    const playerIds = Array.from(this.players.keys());
    const cardsPerPlayer = Math.floor(this.deck.length / playerIds.length);
    
    playerIds.forEach(playerId => {
      const player = this.players.get(playerId);
      player.hand.clear();
      player.handCount = 0;
      player.isOut = false;
      player.hasPassed = false;
    });
    
    let cardIndex = 0;
    for (let i = 0; i < cardsPerPlayer; i++) {
      playerIds.forEach(playerId => {
        if (cardIndex < this.deck.length) {
          const player = this.players.get(playerId);
          player.addCard(this.deck[cardIndex]);
          cardIndex++;
        }
      });
    }
    
    while (cardIndex < this.deck.length) {
      const playerIndex = cardIndex % playerIds.length;
      const player = this.players.get(playerIds[playerIndex]);
      player.addCard(this.deck[cardIndex]);
      cardIndex++;
    }
    
    playerIds.forEach(playerId => {
      this.players.get(playerId).sortHand();
    });
    
    this.findStartingPlayer();
    this.phase = GamePhase.PLAYING;
  }

  private findStartingPlayer() {
    let startingPlayerId: string = null;
    
    if (this.currentRound === 0) {
      this.players.forEach((player, playerId) => {
        const hasThreeOfHearts = player.hand.some(card => 
          card.rank === Rank.THREE && card.suit === Suit.HEARTS
        );
        if (hasThreeOfHearts) {
          startingPlayerId = playerId;
        }
      });
    } else {
      startingPlayerId = this.roundWinnerId;
    }
    
    if (!startingPlayerId && this.turnOrder.length > 0) {
      startingPlayerId = this.turnOrder[0];
    }
    
    console.log('Setting starting player to:', startingPlayerId);
    this.currentTurnPlayerId = startingPlayerId;
    this.leadPlayerId = startingPlayerId;
  }

  playMeld(playerId: string, cards: Card[]): boolean {
    const player = this.players.get(playerId);
    if (!player || player.id !== this.currentTurnPlayerId) return false;
    
    const meld = new Meld();
    meld.setCards(cards);
    meld.playerId = playerId;
    
    if (this.isValidPlay(meld)) {
      this.currentMeld = meld;
      this.currentMeldType = meld.type;
      this.currentMeldSize = meld.cards.length;
      this.lastPlayerId = playerId;
      this.bombPlayed = meld.type === MeldType.BOMB || meld.type === MeldType.STRAIGHT_FLUSH;
      
      player.removeCards(cards);
      player.hasPassed = false;
      this.consecutivePasses = 0;
      
      cards.forEach(card => this.discardPile.push(card));
      
      if (player.isOut && !this.roundWinnerId) {
        this.roundWinnerId = playerId;
        player.wins++;
      }
      
      this.nextTurn();
      return true;
    }
    
    return false;
  }

  isValidPlay(meld: Meld): boolean {
    // First check if the meld itself is valid
    if (!meld.type) {
      return false;  // Invalid meld
    }
    
    if (this.leadPlayerId === meld.playerId) {
      return true;
    }
    
    if (meld.type === MeldType.BOMB || meld.type === MeldType.STRAIGHT_FLUSH) {
      if (this.currentMeld && 
          (this.currentMeld.type === MeldType.BOMB || 
           this.currentMeld.type === MeldType.STRAIGHT_FLUSH)) {
        return meld.strength > this.currentMeld.strength ||
               (meld.type === MeldType.STRAIGHT_FLUSH && 
                meld.cards.length > this.currentMeld.cards.length);
      }
      return true;
    }
    
    if (!this.currentMeld || meld.type !== this.currentMeldType) {
      return false;
    }
    
    if (meld.cards.length !== this.currentMeldSize) {
      return false;
    }
    
    return meld.strength > this.currentMeld.strength;
  }

  pass(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player || player.id !== this.currentTurnPlayerId) return false;
    
    player.hasPassed = true;
    this.consecutivePasses++;
    
    const activePlayers = Array.from(this.players.values()).filter(p => !p.isOut);
    
    if (this.consecutivePasses >= activePlayers.length - 1) {
      this.leadPlayerId = this.lastPlayerId;
      this.currentMeld = null;
      this.currentMeldType = null;
      this.currentMeldSize = 0;
      this.bombPlayed = false;
      this.consecutivePasses = 0;
      
      this.players.forEach(p => p.hasPassed = false);
    }
    
    this.nextTurn();
    return true;
  }

  private nextTurn() {
    const currentIndex = this.turnOrder.indexOf(this.currentTurnPlayerId);
    let nextIndex = (currentIndex + 1) % this.turnOrder.length;
    
    while (this.players.get(this.turnOrder[nextIndex]).isOut) {
      nextIndex = (nextIndex + 1) % this.turnOrder.length;
      if (nextIndex === currentIndex) break;
    }
    
    this.currentTurnPlayerId = this.turnOrder[nextIndex];
    
    const remainingPlayers = Array.from(this.players.values()).filter(p => !p.isOut);
    if (remainingPlayers.length === 1) {
      remainingPlayers[0].losses++;
      this.endRound();
    }
  }

  private endRound() {
    this.phase = GamePhase.ROUND_END;
    this.currentRound++;
    
    const winner = this.players.get(this.roundWinnerId);
    if (winner && winner.wins >= this.targetWins) {
      this.phase = GamePhase.GAME_END;
    } else {
      this.resetForNewRound();
    }
  }

  private resetForNewRound() {
    this.discardPile.clear();
    this.currentMeld = null;
    this.currentMeldType = null;
    this.currentMeldSize = 0;
    this.consecutivePasses = 0;
    this.bombPlayed = false;
    this.lastPlayerId = null;
    
    this.initializeDeck();
    this.dealCards();
  }
}

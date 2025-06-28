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
    // For sisters, A (14) and 2 (15) ARE consecutive, making A-2 the highest possible sisters
    const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => a - b);
    
    // Check for normal consecutive ranks
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
    
    // Special case first: A-2-3-4-5 (wheel/steel wheel)
    // This is the ONLY run that can contain a 2
    if (ranks.includes(Rank.TWO)) {
      // Check if we have exactly A-2-3-4-5
      const wheelRanks = [Rank.ACE, Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE];
      if (ranks.length === 5 && ranks.every(r => wheelRanks.includes(r))) {
        return true;
      }
      // Any other run containing a 2 is invalid
      return false;
    }
    
    // Sort ranks to check for consecutive sequence
    const sortedRanks = [...ranks].sort((a, b) => a - b);
    
    // Check if it's a normal consecutive run (e.g., 3-4-5-6-7 or 10-J-Q-K-A)
    // Note: Cannot include 2 (already checked above)
    let isConsecutive = true;
    for (let i = 1; i < sortedRanks.length; i++) {
      if (sortedRanks[i] !== sortedRanks[i - 1] + 1) {
        isConsecutive = false;
        break;
      }
    }
    
    return isConsecutive;
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
        const runRanks = this.cards.map(c => c.rank);
        
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

export class ChatMessage extends Schema {
  @type("string") id: string;
  @type("string") playerId: string;
  @type("string") playerName: string;
  @type("string") message: string;
  @type("number") timestamp: number;
  @type("boolean") isSystem: boolean = false;
  @type("string") messageType: string = "info"; // info, success, warning, error

  constructor(playerId?: string, playerName?: string, message?: string, isSystem?: boolean, messageType?: string) {
    super();
    if (playerId && playerName && message) {
      this.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this.playerId = playerId;
      this.playerName = playerName;
      this.message = message;
      this.timestamp = Date.now();
      this.isSystem = isSystem || false;
      this.messageType = messageType || "info";
    }
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
  @type([Meld]) trickMelds = new ArraySchema<Meld>(); // All melds played in current trick
  @type([Meld]) lastTrickMelds = new ArraySchema<Meld>(); // Melds from the last completed trick
  
  @type(["string"]) turnOrder = new ArraySchema<string>();
  @type("number") consecutivePasses: number = 0;
  @type("boolean") bombPlayed: boolean = false;
  
  @type([ChatMessage]) chatMessages = new ArraySchema<ChatMessage>();
  
  // Test mode properties (not synced)
  testDeckSize: number = 0;
  testDeck: string = "";

  initializeDeck() {
    this.deck.clear();
    
    // Test mode: use exact deck specification
    if (this.testDeck) {
      const cards = this.testDeck.split(' ');
      for (const cardStr of cards) {
        if (cardStr.length >= 2) {
          const rankStr = cardStr.slice(0, -1);
          const suitStr = cardStr.slice(-1);
          
          // Parse suit
          let suit: Suit;
          switch (suitStr) {
            case 'H': suit = Suit.HEARTS; break;
            case 'D': suit = Suit.DIAMONDS; break;
            case 'C': suit = Suit.CLUBS; break;
            case 'S': suit = Suit.SPADES; break;
            default: continue; // Skip invalid cards
          }
          
          // Parse rank
          let rank: Rank;
          switch (rankStr) {
            case '3': rank = Rank.THREE; break;
            case '4': rank = Rank.FOUR; break;
            case '5': rank = Rank.FIVE; break;
            case '6': rank = Rank.SIX; break;
            case '7': rank = Rank.SEVEN; break;
            case '8': rank = Rank.EIGHT; break;
            case '9': rank = Rank.NINE; break;
            case '10': rank = Rank.TEN; break;
            case 'J': rank = Rank.JACK; break;
            case 'Q': rank = Rank.QUEEN; break;
            case 'K': rank = Rank.KING; break;
            case 'A': rank = Rank.ACE; break;
            case '2': rank = Rank.TWO; break;
            default: continue; // Skip invalid cards
          }
          
          this.deck.push(new Card(suit, rank));
        }
      }
      
      console.log(`Test deck created with ${this.deck.length} cards`);
      // Don't shuffle test deck
      return;
    }
    
    // Normal deck creation
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

  dealCards(testDeckSize: number = 0) {
    this.phase = GamePhase.DEALING;
    const playerIds = Array.from(this.players.keys());
    
    // Clear player hands
    playerIds.forEach(playerId => {
      const player = this.players.get(playerId);
      player.hand.clear();
      player.handCount = 0;
      player.isOut = false;
      player.hasPassed = false;
    });
    
    // Test mode: deal specific number of cards per player
    if (testDeckSize > 0 || this.testDeck) {
      const cardsPerPlayer = testDeckSize || Math.floor(this.deck.length / playerIds.length);
      let cardIndex = 0;
      
      // Use turnOrder to ensure first player (human) gets first cards
      const orderedPlayerIds = this.turnOrder.length > 0 ? 
        Array.from(this.turnOrder) : playerIds;
      
      // Deal cards in order (first player gets first cards)
      for (let i = 0; i < cardsPerPlayer; i++) {
        orderedPlayerIds.forEach(playerId => {
          const player = this.players.get(playerId);
          if (player && cardIndex < this.deck.length) {
            player.addCard(this.deck[cardIndex]);
            cardIndex++;
          }
        });
      }
      
      // Sort hands
      orderedPlayerIds.forEach(playerId => {
        const player = this.players.get(playerId);
        if (player) {
          player.sortHand();
          console.log(`Player ${player.name} dealt: ${player.hand.map(c => c.code).join(' ')}`);
        }
      });
      
      // Move any remaining cards to discard pile
      while (cardIndex < this.deck.length) {
        this.discardPile.push(this.deck[cardIndex]);
        cardIndex++;
      }
      
      console.log(`Test mode: Dealt ${cardsPerPlayer} cards to each player`);
      this.phase = GamePhase.PLAYING;
      this.findStartingPlayer();
      return;
    }
    
    // Calculate how many cards to deal
    let cardsToDeal = this.deck.length;
    if (playerIds.length === 2) {
      // For 2 players, only deal 2/3 of the deck
      cardsToDeal = Math.floor(this.deck.length * 2 / 3);
      console.log(`2 player game: dealing ${cardsToDeal} out of ${this.deck.length} cards`);
    }
    
    const cardsPerPlayer = Math.floor(cardsToDeal / playerIds.length);
    
    let cardIndex = 0;
    // Deal cards evenly first
    for (let i = 0; i < cardsPerPlayer; i++) {
      playerIds.forEach(playerId => {
        if (cardIndex < cardsToDeal) {
          const player = this.players.get(playerId);
          player.addCard(this.deck[cardIndex]);
          cardIndex++;
        }
      });
    }
    
    // Deal remaining cards one by one
    while (cardIndex < cardsToDeal) {
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
    
    console.log(`findStartingPlayer: round=${this.currentRound}, roundWinnerId=${this.roundWinnerId}`);
    
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
      // For rounds > 0, the previous round winner leads
      startingPlayerId = this.roundWinnerId;
      console.log(`Round ${this.currentRound}: Previous winner ${startingPlayerId} will lead`);
      // Clear roundWinnerId after using it so next round's winner can be properly tracked
      this.roundWinnerId = null;
    }
    
    if (!startingPlayerId && this.turnOrder.length > 0) {
      console.log('No starting player found, defaulting to first in turn order');
      startingPlayerId = this.turnOrder[0];
    }
    
    console.log('Setting starting player to:', startingPlayerId);
    this.currentTurnPlayerId = startingPlayerId;
    this.leadPlayerId = startingPlayerId;
  }

  canPlayerPlay(playerId: string): boolean {
    // Must be in PLAYING phase
    if (this.phase !== GamePhase.PLAYING) {
      console.log(`[canPlayerPlay] Player ${playerId} cannot play - phase is ${this.phase}`);
      return false;
    }
    
    // Must be player's turn
    if (this.currentTurnPlayerId !== playerId) {
      console.log(`[canPlayerPlay] Player ${playerId} cannot play - not their turn (current: ${this.currentTurnPlayerId})`);
      return false;
    }
    
    // Player must exist and not be out
    const player = this.players.get(playerId);
    if (!player) {
      console.log(`[canPlayerPlay] Player ${playerId} cannot play - player not found`);
      return false;
    }
    
    if (player.isOut) {
      console.log(`[canPlayerPlay] Player ${playerId} cannot play - player is out`);
      return false;
    }
    
    return true;
  }

  playMeld(playerId: string, cards: Card[]): boolean {
    if (!this.canPlayerPlay(playerId)) {
      return false;
    }
    
    const player = this.players.get(playerId);
    
    const meld = new Meld();
    meld.setCards(cards);
    meld.playerId = playerId;
    
    if (this.isValidPlay(meld)) {
      this.currentMeld = meld;
      this.currentMeldType = meld.type;
      this.currentMeldSize = meld.cards.length;
      this.lastPlayerId = playerId;
      this.bombPlayed = meld.type === MeldType.BOMB || meld.type === MeldType.STRAIGHT_FLUSH;
      
      // Add meld to current trick
      this.trickMelds.push(meld);
      
      player.removeCards(cards);
      player.hasPassed = false;
      this.consecutivePasses = 0;
      
      cards.forEach(card => this.discardPile.push(card));
      
      if (player.isOut) {
        // Track finishing positions
        const finishedPlayers = Array.from(this.players.values()).filter(p => p.isOut).length;
        player.position = finishedPlayers; // 1st, 2nd, 3rd, etc.
        
        // First player out is the round winner
        if (!this.roundWinnerId) {
          this.roundWinnerId = playerId;
          player.wins++;
          console.log(`${player.name} (${playerId}) finished first and wins round ${this.currentRound}!`);
          console.log(`roundWinnerId set to: ${this.roundWinnerId}`);
        }
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
    // Use same validation as play (except leader check comes later)
    if (this.phase !== GamePhase.PLAYING) {
      console.log(`[pass] Player ${playerId} cannot pass - phase is ${this.phase}`);
      return false;
    }
    
    if (this.currentTurnPlayerId !== playerId) {
      console.log(`[pass] Player ${playerId} cannot pass - not their turn (current: ${this.currentTurnPlayerId})`);
      return false;
    }
    
    const player = this.players.get(playerId);
    if (!player) {
      console.log(`[pass] Player ${playerId} cannot pass - player not found`);
      return false;
    }
    
    // Players who are out cannot pass (they should be skipped)
    if (player.isOut) {
      console.error(`Player ${playerId} is out but tried to pass`);
      // Skip to next player
      this.nextTurn();
      return true;
    }
    
    // Leaders cannot pass when there's no current meld (they must play something)
    if (this.leadPlayerId === playerId && !this.currentMeld) {
      console.error(`Leader ${playerId} cannot pass when there's no current meld!`);
      return false;
    }
    
    player.hasPassed = true;
    this.consecutivePasses++;
    
    const activePlayers = Array.from(this.players.values()).filter(p => !p.isOut);
    
    // When all other active players have passed, the last player who played becomes the leader
    if (this.consecutivePasses >= activePlayers.length - 1) {
      // Check if the last player who played is still active (not out)
      const lastPlayer = this.players.get(this.lastPlayerId);
      
      if (lastPlayer && !lastPlayer.isOut) {
        console.log(`All players passed. ${this.lastPlayerId} becomes the new leader.`);
        this.leadPlayerId = this.lastPlayerId;
        this.currentMeld = null;
        this.currentMeldType = null;
        this.currentMeldSize = 0;
        this.bombPlayed = false;
        this.consecutivePasses = 0;
        
        // Move current trick to last trick
        this.lastTrickMelds.clear();
        this.trickMelds.forEach(meld => this.lastTrickMelds.push(meld));
        this.trickMelds.clear();
        
        // Reset all players' pass status
        this.players.forEach(p => p.hasPassed = false);
        
        // The new leader's turn
        this.currentTurnPlayerId = this.leadPlayerId;
        return true;  // Don't call nextTurn() here since we just set the current player
      } else {
        // Last player is out, so we need to find another leader
        console.log(`Last player ${this.lastPlayerId} is out. Finding new leader...`);
        
        // Find the first active player who hasn't passed
        let newLeader: string | null = null;
        for (const [id, player] of this.players) {
          if (!player.isOut && !player.hasPassed) {
            newLeader = id;
            break;
          }
        }
        
        // If no one found, pick first active player
        if (!newLeader) {
          for (const [id, player] of this.players) {
            if (!player.isOut) {
              newLeader = id;
              break;
            }
          }
        }
        
        if (newLeader) {
          console.log(`New leader: ${newLeader}`);
          this.leadPlayerId = newLeader;
          this.currentMeld = null;
          this.currentMeldType = null;
          this.currentMeldSize = 0;
          this.bombPlayed = false;
          this.consecutivePasses = 0;
          
          // Move current trick to last trick
          this.lastTrickMelds.clear();
          this.trickMelds.forEach(meld => this.lastTrickMelds.push(meld));
          this.trickMelds.clear();
          
          // Reset all players' pass status
          this.players.forEach(p => p.hasPassed = false);
          
          // Set new leader's turn
          this.currentTurnPlayerId = newLeader;
          return true;
        }
      }
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
    // Immediately clear turn to prevent any more plays
    const previousTurn = this.currentTurnPlayerId;
    this.currentTurnPlayerId = null;
    this.leadPlayerId = null;
    
    this.phase = GamePhase.ROUND_END;
    
    const winner = this.players.get(this.roundWinnerId);
    console.log(`[endRound] Game ${this.currentRound} ended. Winner: ${winner?.name || 'Unknown'}, wins: ${winner?.wins || 0}`);
    console.log(`[endRound] Cleared turn from ${previousTurn} to null`);
    
    // Note: We no longer check targetWins - games continue indefinitely
    // The GAME_END phase is now legacy and only used if targetWins is explicitly set
    
    // Don't automatically start new round - wait for player action
    console.log(`[endRound] Phase is now: ${this.phase}`);
  }

  startNewRound() {
    if (this.phase !== GamePhase.ROUND_END) {
      console.error("Cannot start new round - not in ROUND_END phase");
      return false;
    }
    
    console.log(`Starting new round. Previous round winner: ${this.roundWinnerId}`);
    const previousWinner = this.roundWinnerId; // Save it before any changes
    this.currentRound++;
    console.log(`Incremented round to ${this.currentRound}, winner preserved: ${previousWinner}`);
    this.resetForNewRound();
    console.log(`After reset, roundWinnerId is: ${this.roundWinnerId}`);
    return true;
  }
  
  private resetForNewRound() {
    this.discardPile.clear();
    this.currentMeld = null;
    this.currentMeldType = null;
    this.currentMeldSize = 0;
    this.consecutivePasses = 0;
    this.bombPlayed = false;
    this.lastPlayerId = null;
    this.trickMelds.clear();
    this.lastTrickMelds.clear();
    
    // Reset all players' isOut status for new round
    this.players.forEach(player => {
      player.isOut = false;
      player.hasPassed = false;
    });
    
    // Note: roundWinnerId is preserved across rounds and will be used by findStartingPlayer()
    console.log(`resetForNewRound: Preserving roundWinnerId=${this.roundWinnerId} for round ${this.currentRound}`);
    
    this.initializeDeck();
    this.dealCards(this.testDeckSize);
    
    // dealCards() will set phase to PLAYING and call findStartingPlayer()
    // which will use the preserved roundWinnerId
  }

  addChatMessage(playerId: string, message: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;
    
    // Limit message length
    const trimmedMessage = message.trim().substring(0, 200);
    if (!trimmedMessage) return false;
    
    const chatMessage = new ChatMessage(playerId, player.name, trimmedMessage);
    this.chatMessages.push(chatMessage);
    
    // Keep only last 100 messages
    if (this.chatMessages.length > 100) {
      this.chatMessages.splice(0, this.chatMessages.length - 100);
    }
    
    return true;
  }

  addSystemMessage(message: string, messageType: string = "info"): void {
    const systemMessage = new ChatMessage("system", "System", message, true, messageType);
    this.chatMessages.push(systemMessage);
    
    // Keep only last 100 messages
    if (this.chatMessages.length > 100) {
      this.chatMessages.splice(0, this.chatMessages.length - 100);
    }
  }
}

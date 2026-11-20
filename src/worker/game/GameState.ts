import * as rules from '../../shared/rules';

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

export class Card {
  suit: Suit;
  rank: Rank;
  code: string;
  isSpecial: boolean = false;

  constructor(suit?: Suit, rank?: Rank) {
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
    return rules.cardStrength(this);
  }
}

/** Sisters are N groups of the same size (pairs or triples) on consecutive ranks. */
export function sisterShape(meld: Meld): { groups: number; groupSize: number } {
  return rules.sisterShape(meld);
}

export class Meld {
  cards: Card[] = [];
  type: MeldType;
  strength: number;
  playerId: string;

  setCards(cards: Card[]) {
    this.cards.length = 0;
    cards.forEach(card => {
      // Create a new Card instance for the meld
      const meldCard = new Card(card.suit, card.rank);
      this.cards.push(meldCard);
    });
    // What the cards are and how strong they are is decided in src/shared/rules.ts,
    // the same code the bots check their plays with.
    this.type = rules.meldTypeOf(this.cards) as MeldType;
    this.strength = rules.meldStrengthOf(this.cards, this.type);
  }
}

export class Player {
  id: string;
  name: string;
  hand: Card[] = []; // Not synced - sent via messages
  handCount: number = 0;
  isActive: boolean = true;
  hasPassed: boolean = false;
  isOut: boolean = false;
  wins: number = 0;
  losses: number = 0;
  position: number;
  /** Bots count as players but never become host. */
  isBot: boolean = false;
  /** A bot's personality id (src/client/bots/personas.ts), so every client can show its badge. */
  persona?: string;
  /** The name of the uploaded bot playing this seat for its human, shown on the seat. Null when they play. */
  autopilot: string | null = null;

  constructor(id?: string, name?: string) {
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
    this.hand.length = 0;
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
    this.hand.length = 0;
    sorted.forEach(card => this.hand.push(card));
  }
}

export class ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
  isSystem: boolean = false;
  messageType: string = "info"; // info, success, warning, error

  constructor(playerId?: string, playerName?: string, message?: string, isSystem?: boolean, messageType?: string) {
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

export class GameState {
  roomId: string;
  phase: GamePhase = GamePhase.WAITING;
  currentRound: number = 0;
  targetWins: number = 10;
  numberOfDecks: number = 1;
  
  players = new Map<string, Player>();
  deck: Card[] = [];
  discardPile: Card[] = [];
  
  currentTurnPlayerId: string;
  leadPlayerId: string;
  lastPlayerId: string;
  roundWinnerId: string;
  
  currentMeld: Meld;
  currentMeldType: MeldType;
  currentMeldSize: number = 0;
  trickMelds: Meld[] = []; // All melds played in current trick
  lastTrickMelds: Meld[] = []; // Melds from the last completed trick
  
  turnOrder: string[] = [];
  /** Seat ids in the order they went out this game; reset at every deal. */
  finishOrder: string[] = [];
  consecutivePasses: number = 0;
  /** The seated human who decides when the game starts. The room's creator, then whoever's next in seat order. */
  hostId: string | null = null;
  bombPlayed: boolean = false;
  
  chatMessages: ChatMessage[] = [];
  
  // Test mode properties (not synced)
  testDeckSize: number = 0;
  testDeck: string = "";

  initializeDeck() {
    this.deck.length = 0;
    
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

  addPlayer(id: string, name: string, isBot = false, persona?: string) {
    if (this.players.has(id)) return;
    
    const player = new Player(id, name);
    player.isBot = isBot;
    if (isBot && persona) player.persona = persona;
    player.position = this.players.size;
    this.players.set(id, player);  // object set by id
    this.turnOrder.push(id);
    if (!this.hostId && !isBot) this.hostId = id;
    
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
    if (this.hostId === id) this.hostId = this.nextHuman();
  }

  private nextHuman(activeOnly = false): string | null {
    for (const pid of this.turnOrder) {
      const p = this.players.get(pid);
      if (p && !p.isBot && (!activeOnly || p.isActive)) return pid;
    }
    return null;
  }

  /**
   * Who may start the game right now: the host, or while the host's connection is down
   * mid-session, the next connected human, so a table isn't stuck at "Play Again".
   */
  currentHostId(): string | null {
    const host = this.hostId ? this.players.get(this.hostId) : undefined;
    if (host?.isActive) return this.hostId;
    return this.nextHuman(true) ?? this.hostId;
  }

  /** Why `playerId` can't start the game now, or null when they can. */
  startError(playerId: string, minPlayers: number): string | null {
    if (this.phase === GamePhase.PLAYING || this.phase === GamePhase.DEALING) {
      return "The game is already running";
    }
    const hostId = this.currentHostId();
    if (playerId !== hostId) {
      const host = hostId ? this.players.get(hostId) : undefined;
      return `Only the host${host ? ` (${host.name})` : ""} can start the game`;
    }
    if (this.players.size < minPlayers) {
      const need = minPlayers - this.players.size;
      return `Need ${need} more player${need === 1 ? "" : "s"} or bot${need === 1 ? "" : "s"} to start`;
    }
    return null;
  }

  /**
   * What the table plays for a player who is away when their turn runs out: pass when they may,
   * otherwise (they're leading) their lowest single. Null when it isn't their turn.
   */
  autoMove(playerId: string): { action: "pass" } | { action: "play"; cards: Card[] } | null {
    if (this.phase !== GamePhase.PLAYING || this.currentTurnPlayerId !== playerId) return null;
    const player = this.players.get(playerId);
    if (!player || player.isOut || player.hand.length === 0) return null;
    if (this.leadPlayerId === playerId && !this.currentMeld) {
      const lowest = player.hand.reduce((low, c) => (c.getStrength() < low.getStrength() ? c : low));
      return { action: "play", cards: [lowest] };
    }
    return { action: "pass" };
  }

  /**
   * Takes a seat out of the game for good (the host removing someone who left). Mid-round the
   * player's cards leave with them and the turn, lead, and pass count are fixed up so play goes on.
   * If fewer than two players still hold cards, the round ends: the one left holding cards takes
   * the loss only if somebody already went out, otherwise the round counts for nobody.
   */
  removeSeat(id: string) {
    if (!this.players.has(id)) return;
    if (this.roundWinnerId === id) this.roundWinnerId = null;

    if (this.phase !== GamePhase.PLAYING) {
      this.removePlayer(id);
      return;
    }

    const leaving = this.players.get(id)!;
    const wasTurn = this.currentTurnPlayerId === id;
    const wasLead = this.leadPlayerId === id;

    // Hand the turn to the next player still in before the seat disappears from the order.
    if (wasTurn) {
      const at = this.turnOrder.indexOf(id);
      let next: string | null = null;
      for (let i = 1; i < this.turnOrder.length; i++) {
        const candidate = this.turnOrder[(at + i) % this.turnOrder.length];
        if (!this.players.get(candidate)?.isOut) {
          next = candidate;
          break;
        }
      }
      this.currentTurnPlayerId = next;
    }
    if (leaving.hasPassed && this.consecutivePasses > 0) this.consecutivePasses--;
    this.removePlayer(id);

    const stillIn = Array.from(this.players.values()).filter((p) => !p.isOut);
    if (stillIn.length < 2) {
      if (stillIn.length === 1 && this.roundWinnerId) stillIn[0].losses++;
      this.endRound();
      return;
    }

    if (this.lastPlayerId === id) this.lastPlayerId = null;
    if (!this.currentMeld) {
      // The leader was about to lead; whoever's turn it is now leads instead.
      if (wasLead) this.leadPlayerId = this.currentTurnPlayerId;
      return;
    }
    if (wasLead) this.leadPlayerId = this.lastPlayerId;

    // Everyone left in, other than the meld's owner, has passed on the meld: the trick is over.
    if (this.consecutivePasses >= stillIn.filter((p) => p.id !== this.lastPlayerId).length) {
      const owner = this.lastPlayerId ? this.players.get(this.lastPlayerId) : undefined;
      const leader = owner && !owner.isOut ? owner.id : this.currentTurnPlayerId;
      this.leadPlayerId = leader;
      this.currentTurnPlayerId = leader;
      this.currentMeld = null;
      this.currentMeldType = null;
      this.currentMeldSize = 0;
      this.bombPlayed = false;
      this.consecutivePasses = 0;
      this.lastTrickMelds.length = 0;
      this.trickMelds.forEach((m) => this.lastTrickMelds.push(m));
      this.trickMelds.length = 0;
      this.players.forEach((p) => (p.hasPassed = false));
    }
  }


  private shuffleDeck() {
    const cards = [...this.deck];
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    this.deck.length = 0;
    cards.forEach(card => this.deck.push(card));
  }

  /** `random` picks the seat the leftover cards start from; tests pass their own. */
  dealCards(testDeckSize: number = 0, random: () => number = Math.random) {
    this.phase = GamePhase.DEALING;
    const playerIds = Array.from(this.players.keys());
    this.finishOrder = [];
    
    // Clear player hands
    playerIds.forEach(playerId => {
      const player = this.players.get(playerId);
      player.hand.length = 0;
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
    
    // Leftover cards go one each to consecutive seats, starting from a random seat,
    // so the first seat doesn't always end up with the bigger hand.
    const firstExtra = Math.floor(random() * playerIds.length);
    let extra = 0;
    while (cardIndex < cardsToDeal) {
      const player = this.players.get(playerIds[(firstExtra + extra++) % playerIds.length]);
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
          console.log(`[findStartingPlayer] Player ${player.name} (${playerId}) has 3H and will start`);
        }
      });
      
      if (!startingPlayerId) {
        console.log('[findStartingPlayer] WARNING: No player has 3H!');
      }
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
    
    console.log(`[findStartingPlayer] Setting currentTurnPlayerId=${startingPlayerId}, leadPlayerId=${startingPlayerId}`);
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
        this.finishOrder.push(playerId);
        
        // First player out is the round winner
        if (!this.roundWinnerId) {
          this.roundWinnerId = playerId;
          player.wins++;
          console.log(`${player.name} (${playerId}) finished first and wins round ${this.currentRound}!`);
          console.log(`roundWinnerId set to: ${this.roundWinnerId}`);
        }
      }
      
      const turnChanged = this.nextTurn();
      return true;
    }
    
    return false;
  }
  
  getTurnChangeInfo() {
    return {
      nextPlayerId: this.currentTurnPlayerId,
      isNewLeader: this.currentTurnPlayerId === this.leadPlayerId && !this.currentMeld
    };
  }

  isValidPlay(meld: Meld): boolean {
    return this.describeInvalidPlay(meld) === null;
  }

  /** Why a meld can't go on the table right now, or null when it can. */
  describeInvalidPlay(meld: Meld): string | null {
    return rules.describeInvalidPlay(meld, this.currentMeld);
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
    
    // The trick ends when every other player still in has passed since the
    // last play. The last player to play counts only while they're still in.
    const needed = Array.from(this.players.values())
      .filter(p => !p.isOut && p.id !== this.lastPlayerId).length;

    if (this.consecutivePasses >= needed) {
      const lastPlayer = this.players.get(this.lastPlayerId);
      // A removed seat's meld (lastPlayer gone) goes on round the table to whoever is next.
      const newLeader = lastPlayer && !lastPlayer.isOut
        ? this.lastPlayerId
        : this.nextPlayerInAfter(lastPlayer ? this.lastPlayerId : playerId);

      if (newLeader) {
        console.log(`All players passed. ${newLeader} leads the next trick.`);
        this.leadPlayerId = newLeader;
        this.currentMeld = null;
        this.currentMeldType = null;
        this.currentMeldSize = 0;
        this.bombPlayed = false;
        this.consecutivePasses = 0;

        // Move current trick to last trick
        this.lastTrickMelds.length = 0;
        this.trickMelds.forEach(meld => this.lastTrickMelds.push(meld));
        this.trickMelds.length = 0;

        this.players.forEach(p => p.hasPassed = false);

        // Don't call nextTurn(): the new leader plays next.
        this.currentTurnPlayerId = newLeader;
        return true;
      }
    }

    this.nextTurn();
    return true;
  }

  /** The next player in seat order after `playerId` who still has cards. */
  private nextPlayerInAfter(playerId: string): string | null {
    const start = this.turnOrder.indexOf(playerId);
    for (let i = 1; i <= this.turnOrder.length; i++) {
      const id = this.turnOrder[(start + i) % this.turnOrder.length];
      const p = this.players.get(id);
      if (p && !p.isOut) return id;
    }
    return null;
  }

  private nextTurn(): boolean {
    const currentIndex = this.turnOrder.indexOf(this.currentTurnPlayerId);
    let nextIndex = (currentIndex + 1) % this.turnOrder.length;
    
    while (this.players.get(this.turnOrder[nextIndex]).isOut) {
      nextIndex = (nextIndex + 1) % this.turnOrder.length;
      if (nextIndex === currentIndex) break;
    }
    
    const previousTurn = this.currentTurnPlayerId;
    this.currentTurnPlayerId = this.turnOrder[nextIndex];
    
    console.log(`[nextTurn] Turn changed from ${previousTurn} to ${this.currentTurnPlayerId}`);
    
    const remainingPlayers = Array.from(this.players.values()).filter(p => !p.isOut);
    if (remainingPlayers.length === 1) {
      remainingPlayers[0].losses++;
      this.endRound();
      return false; // Round ended, no turn change
    }
    
    return true; // Turn changed successfully
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
    this.discardPile.length = 0;
    this.currentMeld = null;
    this.currentMeldType = null;
    this.currentMeldSize = 0;
    this.consecutivePasses = 0;
    this.bombPlayed = false;
    this.lastPlayerId = null;
    this.trickMelds.length = 0;
    this.lastTrickMelds.length = 0;
    
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

// ---------------------------------------------------------------------------
// Lobby limits
// ---------------------------------------------------------------------------

export const MAX_NAME_LENGTH = 20;

// Control characters plus the bidi overrides/isolates that can flip how other text renders.
const UNSAFE_NAME_CHARS = /[\p{Cc}\u202A-\u202E\u2066-\u2069\u200E\u200F]/gu;

/**
 * Every player name goes through here, whatever sent it: strings only, control characters
 * stripped, whitespace collapsed, at most MAX_NAME_LENGTH characters. Anything left empty
 * becomes `fallback` (e.g. "Player 3").
 */
export function sanitizeName(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const cleaned = raw.replace(UNSAFE_NAME_CHARS, "").replace(/\s+/g, " ").trim();
  const clipped = Array.from(cleaned).slice(0, MAX_NAME_LENGTH).join("").trim();
  return clipped || fallback;
}

/** A sliding-window limit: at most `max` events per `windowMs` for each key. */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private max: number, private windowMs: number) {}

  /** Records an event for `key` and says whether it's within the limit. Refused events don't count. */
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  forget(key: string) {
    this.hits.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Snapshots. The Durable Object saves the full state (hands and deck included)
// to storage after every action, and rebuilds it when it wakes from hibernation.
// Clients get the public view, which leaves out the deck and every hand; hands
// go to their owner alone through the "your_hand" message.
// ---------------------------------------------------------------------------

type Plain<T> = { [K in keyof T as T[K] extends Function ? never : K]: T[K] };

const cardFrom = (c: Plain<Card>): Card => Object.assign(new Card(), c);

const meldFrom = (m: any): Meld | null => {
  if (!m) return null;
  return Object.assign(new Meld(), { ...m, cards: m.cards.map(cardFrom) });
};

const publicCard = (c: Card) => ({ suit: c.suit, rank: c.rank, code: c.code, isSpecial: c.isSpecial });
const publicMeld = (m: Meld | null) =>
  m ? { cards: m.cards.map(publicCard), type: m.type, strength: m.strength, playerId: m.playerId } : null;

export function saveState(s: GameState): unknown {
  return {
    ...s,
    players: Array.from(s.players.entries()),
  };
}

export function restoreState(raw: any): GameState {
  const s = new GameState();
  Object.assign(s, raw);
  s.players = new Map(
    (raw.players as [string, any][]).map(([id, p]) => [
      id,
      Object.assign(new Player(), { ...p, hand: p.hand.map(cardFrom) }),
    ]),
  );
  s.deck = raw.deck.map(cardFrom);
  s.discardPile = raw.discardPile.map(cardFrom);
  s.currentMeld = meldFrom(raw.currentMeld);
  s.trickMelds = raw.trickMelds.map(meldFrom);
  s.lastTrickMelds = raw.lastTrickMelds.map(meldFrom);
  s.chatMessages = raw.chatMessages.map((m: any) => Object.assign(new ChatMessage(), m));
  return s;
}

/** What every client sees. Players arrive as an object keyed by id; the client turns it back into a Map. */
export function publicState(s: GameState) {
  const players: Record<string, unknown> = {};
  s.players.forEach((p, id) => {
    const { hand, ...rest } = p;
    players[id] = rest;
  });
  return {
    roomId: s.roomId,
    phase: s.phase,
    currentRound: s.currentRound,
    targetWins: s.targetWins,
    numberOfDecks: s.numberOfDecks,
    players,
    discardPile: s.discardPile.map(publicCard),
    currentTurnPlayerId: s.currentTurnPlayerId ?? null,
    leadPlayerId: s.leadPlayerId ?? null,
    lastPlayerId: s.lastPlayerId ?? null,
    roundWinnerId: s.roundWinnerId ?? null,
    currentMeld: publicMeld(s.currentMeld),
    currentMeldType: s.currentMeldType ?? null,
    currentMeldSize: s.currentMeldSize,
    trickMelds: s.trickMelds.map(publicMeld),
    lastTrickMelds: s.lastTrickMelds.map(publicMeld),
    turnOrder: [...s.turnOrder],
    hostId: s.currentHostId(),
    consecutivePasses: s.consecutivePasses,
    bombPlayed: s.bombPlayed,
    chatMessages: s.chatMessages.map((m) => ({ ...m })),
  };
}

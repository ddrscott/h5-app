import { Client, Room } from 'colyseus.js';
import { BotConfig, BotStrategy, GameContext, BotClient as IBotClient } from './types';
import { GameAnalyzer } from './GameAnalyzer';
import { Card, Player, Meld, GamePhase, MeldType } from '../types/game';

/**
 * Bot client that connects to the game server and plays autonomously
 */
export class BotClient implements IBotClient {
  public readonly id: string;
  public config: BotConfig;
  public strategy: BotStrategy;
  public isConnected: boolean = false;
  
  private client: Client | null = null;
  private room: Room | null = null;
  private gameAnalyzer: GameAnalyzer;
  private myHand: Card[] = [];
  private gameContext: GameContext | null = null;
  private isMyTurn: boolean = false;
  private decisionInProgress: boolean = false;
  private lastLoggedTurn: string | null = null;

  constructor(config: BotConfig, strategy: BotStrategy) {
    this.id = `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.config = config;
    this.strategy = strategy;
    this.gameAnalyzer = new GameAnalyzer();
  }

  async connect(serverUrl: string, roomId: string): Promise<void> {
    try {
      console.log(`[${this.config.name}] Starting connection to room ${roomId}`);
      this.client = new Client(serverUrl);
      
      // Join or create room
      if (roomId && roomId !== 'create') {
        console.log(`[${this.config.name}] Joining room by ID: ${roomId}`);
        this.room = await this.client.joinById(roomId, {
          name: this.config.name
        });
      } else {
        console.log(`[${this.config.name}] Creating new room`);
        this.room = await this.client.create('heartoffive', {
          name: this.config.name
        });
      }
      
      console.log(`[${this.config.name}] Connected! Setting up event listeners...`);
      
      // CRITICAL: Set up event listeners BEFORE marking as connected
      this.setupEventListeners();
      
      // NOW mark as connected
      this.isConnected = true;
      
      console.log(`[${this.config.name}] Fully connected and ready`);
      
      // Send greeting if chat is enabled
      const greeting = this.strategy.getChatMessage('greeting');
      if (greeting) {
        setTimeout(() => this.sendChat(greeting), 1000);
      }
      
    } catch (error) {
      console.error(`Bot ${this.config.name} failed to connect:`, error);
      this.isConnected = false;
      this.room = null;
      this.client = null;
      throw error;
    }
  }

  disconnect(): void {
    console.log(`[${this.config.name}] Disconnecting...`);
    
    this.isConnected = false;
    this.myHand = [];
    this.gameContext = null;
    this.isMyTurn = false;
    this.decisionInProgress = false;
    
    if (this.room) {
      try {
        console.log(`[${this.config.name}] Removing listeners and leaving room`);
        this.room.removeAllListeners();
        this.room.leave();
      } catch (error) {
        console.error(`Error disconnecting bot ${this.config.name}:`, error);
      }
      this.room = null;
    }
    
    if (this.client) {
      this.client = null;
    }
    
    console.log(`[${this.config.name}] Disconnected`);
  }

  updateStrategy(strategy: BotStrategy): void {
    this.strategy = strategy;
  }

  private setupEventListeners(): void {
    if (!this.room) return;

    // Listen for state changes
    this.room.onStateChange((state) => {
      if (!this.room) return;
      
      this.updateGameContext(state);
      
      // Check if it's our turn
      const wasMyTurn = this.isMyTurn;
      this.isMyTurn = state.currentTurnPlayerId === this.room.sessionId;
      
      // Always log turn changes for debugging
      if (state.currentTurnPlayerId !== this.lastLoggedTurn) {
        console.log(`[TURN CHANGE] Now it's ${state.currentTurnPlayerId}'s turn`);
        this.lastLoggedTurn = state.currentTurnPlayerId;
      }
      
      // Debug logging for this bot
      if (this.isMyTurn || wasMyTurn) {
        console.log(`[${this.config.name}] Turn status:`, {
          currentTurnPlayerId: state.currentTurnPlayerId,
          mySessionId: this.room.sessionId,
          isMyTurn: this.isMyTurn,
          wasMyTurn: wasMyTurn,
          decisionInProgress: this.decisionInProgress,
          phase: state.phase,
          handSize: this.myHand.length,
          gamePhase: state.phase
        });
      }
      
      // If it just became our turn and we're not already deciding
      if (this.isMyTurn && !wasMyTurn && !this.decisionInProgress) {
        if (state.phase === GamePhase.PLAYING) {
          console.log(`[${this.config.name}] ✅ IT'S MY TURN! Making decision...`);
          this.makeDecision();
        } else {
          console.log(`[${this.config.name}] It's my turn but game phase is ${state.phase}, not PLAYING`);
        }
      }
    });

    // Listen for hand updates
    this.room.onMessage('your_hand', ({ cards }: { cards: Card[] }) => {
      console.log(`[${this.config.name}] Received hand update:`, {
        cardCount: cards.length,
        cards: cards.map(c => c.code)
      });
      
      this.myHand = cards;
      if (this.gameContext) {
        this.gameContext.myHand = cards;
      }
      
      // Analyze new hand
      const analysis = this.strategy.analyzeHand(cards);
      console.log(`Bot ${this.config.name} hand analysis:`, {
        strength: analysis.strength,
        bombs: analysis.bombs.length,
        bestMelds: analysis.bestMelds.length
      });
      
      // Check if it's our turn after receiving hand (in case we missed the state change)
      if (this.isMyTurn && !this.decisionInProgress && this.gameContext && this.gameContext.phase === GamePhase.PLAYING) {
        console.log(`[${this.config.name}] Checking turn after hand update - making decision`);
        this.makeDecision();
      }
    });

    // Listen for game events
    this.room.onMessage('game_started', (data: any) => {
      console.log(`[${this.config.name}] Game started!`, data);
      this.strategy.onGameStart?.();
      
      // Check if it's our turn when game starts
      if (this.room && data.currentTurn === this.room.sessionId) {
        console.log(`[${this.config.name}] Game started and it's my turn!`);
        this.isMyTurn = true;
        // Give a moment for hand to be received
        setTimeout(() => {
          if (this.isMyTurn && !this.decisionInProgress && this.myHand.length > 0) {
            this.makeDecision();
          }
        }, 1000);
      }
    });

    this.room.onMessage('round_ended', ({ winner }: { winner: string }) => {
      this.strategy.onRoundEnd?.(winner);
      
      // React to round end
      if (this.room && winner === this.room.sessionId) {
        const message = this.strategy.getChatMessage('winning');
        if (message) this.sendChat(message);
      } else {
        const message = this.strategy.getChatMessage('losing');
        if (message) this.sendChat(message);
      }
    });

    this.room.onMessage('meld_played', ({ playerId, meld }: { playerId: string; meld: any }) => {
      this.strategy.onPlayerMove?.(playerId, meld);
      
      // Sometimes compliment good plays
      if (this.room && playerId !== this.room.sessionId && Math.random() < 0.3) {
        const message = this.strategy.getChatMessage('goodPlay');
        if (message) {
          setTimeout(() => this.sendChat(message), 1000);
        }
      }
    });

    // Listen for errors
    this.room.onMessage('error', ({ message, code }: { message: string; code?: string }) => {
      console.error(`Bot ${this.config.name} error:`, message, code);
      
      // If we're the leader and tried to pass, we need to play something
      if (code === 'LEADER_MUST_PLAY' && this.isMyTurn) {
        console.log(`[${this.config.name}] Leader pass rejected - forcing play`);
        this.handleLeaderMustPlayError();
      }
    });
    
    // Register handlers for other message types to avoid warnings
    this.room.onMessage('welcome', () => {});
    this.room.onMessage('player_joined', () => {});
    this.room.onMessage('new_turn', (data: any) => {
      console.log(`[${this.config.name}] New turn:`, data);
    });
    this.room.onMessage('player_passed', () => {});
    this.room.onMessage('new_leader', () => {});
    this.room.onMessage('game_ended', () => {});
    this.room.onMessage('__playground_message_types__', () => {});
  }

  private updateGameContext(state: any): void {
    if (!this.room) return; // Guard against null room
    
    const isLeader = state.leadPlayerId === this.room.sessionId;
    
    this.gameContext = {
      myHand: this.myHand,
      currentMeld: state.currentMeld,
      isLeader: isLeader,
      consecutivePasses: state.consecutivePasses,
      players: new Map(state.players),
      myPlayerId: this.room.sessionId,
      currentRound: state.currentRound,
      phase: state.phase
    };
    
    // Debug log leader changes
    if (isLeader && (!this.gameContext || !this.gameContext.isLeader)) {
      console.log(`[${this.config.name}] I just became the leader! leadPlayerId=${state.leadPlayerId}, mySessionId=${this.room.sessionId}`);
    }
  }

  private async makeDecision(): Promise<void> {
    console.log(`[${this.config.name}] makeDecision called`, {
      hasContext: !!this.gameContext,
      isMyTurn: this.isMyTurn,
      decisionInProgress: this.decisionInProgress,
      phase: this.gameContext?.phase,
      handSize: this.myHand.length,
      isLeader: this.gameContext?.isLeader,
      currentMeld: this.gameContext?.currentMeld
    });
    
    if (!this.gameContext || !this.isMyTurn || this.decisionInProgress) {
      console.log(`[${this.config.name}] makeDecision early return`);
      return;
    }
    
    // Ensure we have cards before making a decision
    if (this.myHand.length === 0) {
      console.log(`[${this.config.name}] No cards in hand yet, waiting...`);
      // Try again after a short delay
      setTimeout(() => {
        if (this.isMyTurn && !this.decisionInProgress) {
          this.makeDecision();
        }
      }, 500);
      return;
    }
    
    this.decisionInProgress = true;
    
    try {
      console.log(`[${this.config.name}] Calling strategy.makeDecision...`);
      console.log(`[${this.config.name}] Game context:`, {
        isLeader: this.gameContext.isLeader,
        consecutivePasses: this.gameContext.consecutivePasses,
        currentMeld: this.gameContext.currentMeld,
        currentMeldType: this.gameContext.currentMeld?.type,
        handSize: this.gameContext.myHand.length
      });
      // Get decision from strategy
      const decision = await this.strategy.makeDecision(this.gameContext);
      
      console.log(`[${this.config.name}] Decision received:`, decision);
      
      // Execute the decision
      if (decision.action === 'play' && decision.cards && decision.cards.length > 0) {
        this.playCards(decision.cards);
      } else {
        // Safety check: Leaders should never pass when there's no current meld
        if (this.gameContext.isLeader && !this.gameContext.currentMeld) {
          console.error(`[${this.config.name}] CRITICAL: Leader tried to pass with no current meld!`);
          // Force play a single card as emergency fallback
          if (this.myHand.length > 0) {
            console.log(`[${this.config.name}] Emergency: Playing first card`);
            this.playCards([this.myHand[0]]);
          } else {
            console.error(`[${this.config.name}] CRITICAL: No cards to play!`);
            this.pass();
          }
        } else {
          this.pass();
        }
      }
      
    } catch (error) {
      console.error(`Bot ${this.config.name} decision error:`, error);
      // Default to passing if there's an error
      this.pass();
    } finally {
      this.decisionInProgress = false;
    }
  }

  private playCards(cards: Card[]): void {
    if (!this.room) return;
    
    const cardCodes = cards.map(c => c.code);
    console.log(`Bot ${this.config.name} playing:`, cardCodes);
    
    this.room.send('play', { cards: cardCodes });
  }

  private pass(): void {
    if (!this.room) return;
    
    console.log(`Bot ${this.config.name} passing`);
    
    // Send pass message if chat enabled
    const message = this.strategy.getChatMessage('pass');
    if (message) this.sendChat(message);
    
    this.room.send('pass');
  }

  private sendChat(message: string): void {
    if (!this.room || !this.config.chatEnabled) return;
    
    this.room.send('chat', { text: message });
  }

  private handleLeaderMustPlayError(): void {
    if (!this.gameContext || this.decisionInProgress) return;
    
    console.log(`[${this.config.name}] Handling leader must play error`);
    this.decisionInProgress = true;
    
    try {
      // Find any valid meld to play
      const allMelds = this.gameAnalyzer.findAllMelds(this.myHand);
      let cardsToPlay: Card[] | null = null;
      
      // Try to find the smallest meld
      const singles = allMelds.get(MeldType.SINGLE) || [];
      const pairs = allMelds.get(MeldType.PAIR) || [];
      const threes = allMelds.get(MeldType.THREE_OF_KIND) || [];
      
      if (singles.length > 0) {
        // Play the lowest single
        singles.sort((a, b) => a[0].rank - b[0].rank);
        cardsToPlay = singles[0];
      } else if (pairs.length > 0) {
        // Play the lowest pair
        pairs.sort((a, b) => a[0].rank - b[0].rank);
        cardsToPlay = pairs[0];
      } else if (threes.length > 0) {
        // Play the lowest three
        threes.sort((a, b) => a[0].rank - b[0].rank);
        cardsToPlay = threes[0];
      } else {
        // Last resort - play first card
        if (this.myHand.length > 0) {
          cardsToPlay = [this.myHand[0]];
        }
      }
      
      if (cardsToPlay) {
        console.log(`[${this.config.name}] Playing emergency meld after error:`, cardsToPlay.map(c => c.code));
        this.playCards(cardsToPlay);
      } else {
        console.error(`[${this.config.name}] CRITICAL: No cards to play after leader error!`);
      }
    } catch (error) {
      console.error(`[${this.config.name}] Error in handleLeaderMustPlayError:`, error);
    } finally {
      this.decisionInProgress = false;
    }
  }

  // Public methods for external control
  public forcePlay(): void {
    console.log(`[${this.config.name}] forcePlay called, isMyTurn: ${this.isMyTurn}`);
    if (this.isMyTurn) {
      this.makeDecision();
    }
  }
  
  public debugStatus(): void {
    console.log(`[${this.config.name}] Debug Status:`, {
      connected: this.isConnected,
      roomId: this.room?.roomId,
      sessionId: this.room?.sessionId,
      isMyTurn: this.isMyTurn,
      decisionInProgress: this.decisionInProgress,
      handSize: this.myHand.length,
      gamePhase: this.gameContext?.phase,
      currentTurnPlayerId: this.gameContext ? 
        Array.from(this.gameContext.players.values()).find(p => p.id === (this.room?.state as any)?.currentTurnPlayerId)?.name : 
        'unknown'
    });
  }

  public getStatus(): {
    connected: boolean;
    inGame: boolean;
    isMyTurn: boolean;
    handSize: number;
    roomId: string | null;
  } {
    return {
      connected: this.isConnected,
      inGame: this.gameContext?.phase === GamePhase.PLAYING,
      isMyTurn: this.isMyTurn,
      handSize: this.myHand.length,
      roomId: this.room?.roomId || null
    };
  }
}
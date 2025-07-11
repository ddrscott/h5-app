import { Client, Room } from 'colyseus.js';
import type { BotConfig, GameContext, BotClient as IBotClient } from './types';
import { BotStrategy } from './types';
import { GameAnalyzer } from './GameAnalyzer';
import type { Card, Player, Meld } from '../types/game';
import { GamePhase, MeldType } from '../types/game';

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
      
      // Send greeting if chat is enabled (50% chance)
      if (Math.random() < 0.5) {
        const greeting = this.strategy.getChatMessage('greeting');
        if (greeting) {
          setTimeout(() => this.sendChat(greeting), 1000);
        }
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

    // Log initial state
    console.log(`[${this.config.name}] Setting up listeners. Initial state:`, {
      state: this.room.state,
      phase: this.room.state?.phase,
      currentTurnPlayerId: this.room.state?.currentTurnPlayerId,
      mySessionId: this.room?.sessionId
    });

    // Listen for state changes
    this.room.onStateChange((state) => {
      if (!this.room) return;
      
      this.updateGameContext(state);
      
      // Check if it's our turn
      const wasMyTurn = this.isMyTurn;
      this.isMyTurn = state.currentTurnPlayerId === this.room?.sessionId;
      
      // Always log turn changes for debugging
      if (state.currentTurnPlayerId !== this.lastLoggedTurn) {
        console.log(`[TURN CHANGE] Now it's ${state.currentTurnPlayerId}'s turn`);
        this.lastLoggedTurn = state.currentTurnPlayerId;
      }
      
      // Debug logging for this bot
      if (this.isMyTurn || wasMyTurn) {
        console.log(`[${this.config.name}] Turn status:`, {
          currentTurnPlayerId: state.currentTurnPlayerId,
          mySessionId: this.room?.sessionId,
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
        console.log(`[${this.config.name}] Turn check: phase="${state.phase}", GamePhase.PLAYING="${GamePhase.PLAYING}"`);
        // The server might send lowercase 'playing' while our enum is uppercase 'PLAYING'
        const phaseStr = String(state.phase).toUpperCase();
        const isPlaying = phaseStr === 'PLAYING';
        
        if (isPlaying) {
          console.log(`[${this.config.name}] ✅ IT'S MY TURN from state change! Will wait for YOUR_TURN message`);
          // Fallback: If we don't get YOUR_TURN message within 500ms, make decision anyway
          setTimeout(() => {
            const currentState = this.room?.state as any;
            if (currentState?.currentTurnPlayerId === this.room?.sessionId && !this.decisionInProgress) {
              console.log(`[${this.config.name}] Fallback: No YOUR_TURN message received, making decision anyway`);
              this.makeDecision();
            }
          }, 500);
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
      
      // Don't make decisions here - wait for YOUR_TURN message
    });

    // Listen for game events
    this.room.onMessage('game_started', (data: any) => {
      console.log(`[${this.config.name}] Game started!`, data);
      this.strategy.onGameStart?.();
      
      // Check if it's our turn when game starts
      if (this.room && data.currentTurn === this.room?.sessionId) {
        console.log(`[${this.config.name}] Game started and it's my turn! Waiting for YOUR_TURN message`);
        // Don't set isMyTurn here - let the state change handler do it
        // This ensures the turn change is detected properly
        
        // Fallback: Make decision after a delay if no YOUR_TURN message
        setTimeout(() => {
          const currentState = this.room?.state as any;
          const phaseStr = String(currentState?.phase).toUpperCase();
          if (currentState?.currentTurnPlayerId === this.room?.sessionId && 
              !this.decisionInProgress && 
              phaseStr === 'PLAYING') {
            console.log(`[${this.config.name}] Game start fallback: Making decision`);
            this.makeDecision();
          }
        }, 600);
      }
    });

    this.room.onMessage('round_ended', ({ winner }: { winner: string }) => {
      this.strategy.onRoundEnd?.(winner);
      
      // React to round end (only sometimes)
      if (this.room && winner === this.room?.sessionId) {
        // Winners talk more (70% chance)
        if (Math.random() < 0.7) {
          const message = this.strategy.getChatMessage('winning');
          if (message) this.sendChat(message);
        }
      } else {
        // Losers rarely complain (20% chance)
        if (Math.random() < 0.2) {
          const message = this.strategy.getChatMessage('losing');
          if (message) this.sendChat(message);
        }
      }
    });

    this.room.onMessage('meld_played', ({ playerId, meld }: { playerId: string; meld: any }) => {
      this.strategy.onPlayerMove?.(playerId, meld);
      
      // Very rarely compliment amazing plays (bombs, straight flushes, or 5+ card melds)
      if (this.room && playerId !== this.room?.sessionId && meld) {
        const isAmazingPlay = meld.type === 'BOMB' || 
                             meld.type === 'STRAIGHT_FLUSH' || 
                             (meld.cards && meld.cards.length >= 5);
        
        // 30% chance for amazing plays, 5% for regular plays
        const chatChance = isAmazingPlay ? 0.3 : 0.05;
        
        if (Math.random() < chatChance) {
          const message = this.strategy.getChatMessage('goodPlay');
          if (message) {
            setTimeout(() => this.sendChat(message), 1000);
          }
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
    
    // Listen for your turn notifications
    this.room.onMessage('your_turn', (data: {
      isLeader: boolean;
      canPlayAnything: boolean;
      currentMeld: any;
      consecutivePasses: number;
      message: string;
    }) => {
      console.log(`[${this.config.name}] YOUR TURN notification:`, data);
      
      // Get fresh state to confirm it's really our turn
      const currentState = this.room?.state as any;
      const isFreshMyTurn = currentState?.currentTurnPlayerId === this.room?.sessionId;
      
      if (isFreshMyTurn && !this.decisionInProgress) {
        console.log(`[${this.config.name}] Confirmed it's my turn from fresh state, making decision...`);
        // Small delay to ensure state is fully synchronized
        setTimeout(() => {
          this.makeDecision();
        }, 100);
      } else {
        console.log(`[${this.config.name}] Ignoring YOUR_TURN - not actually my turn or already deciding`, {
          isFreshMyTurn,
          decisionInProgress: this.decisionInProgress,
          currentTurnPlayerId: currentState?.currentTurnPlayerId,
          mySessionId: this.room?.sessionId
        });
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
    
    const isLeader = state.leadPlayerId === this.room?.sessionId;
    
    this.gameContext = {
      myHand: this.myHand,
      currentMeld: state.currentMeld,
      isLeader: isLeader,
      consecutivePasses: state.consecutivePasses,
      players: new Map(state.players),
      myPlayerId: this.room?.sessionId || '',
      currentRound: state.currentRound,
      phase: state.phase
    };
    
    // Debug log currentMeld state
    if (isLeader && state.currentMeld) {
      console.log(`[${this.config.name}] Leader with currentMeld:`, {
        meldType: state.currentMeld?.type,
        meldSize: state.currentMeld?.cards?.length,
        meldPlayerId: state.currentMeld?.playerId,
        myId: this.room?.sessionId,
        consecutivePasses: state.consecutivePasses
      });
    }
    
    // Debug log leader changes
    if (isLeader && (!this.gameContext || !this.gameContext.isLeader)) {
      console.log(`[${this.config.name}] I just became the leader! leadPlayerId=${state.leadPlayerId}, mySessionId=${this.room?.sessionId}`);
    } else if (!isLeader && this.gameContext && this.gameContext.isLeader) {
      console.log(`[${this.config.name}] I'm no longer the leader. New leader=${state.leadPlayerId}, mySessionId=${this.room?.sessionId}`);
    }
  }

  private async makeDecision(): Promise<void> {
    // Always get fresh state at the start of decision making
    const currentState = this.room?.state as any;
    const freshIsMyTurn = currentState?.currentTurnPlayerId === this.room?.sessionId;
    
    // Update game context with fresh state FIRST before logging
    if (currentState) {
      this.updateGameContext(currentState);
    }
    
    console.log(`[${this.config.name}] makeDecision called`, {
      hasContext: !!this.gameContext,
      isMyTurn: this.isMyTurn,
      freshIsMyTurn,
      decisionInProgress: this.decisionInProgress,
      phase: this.gameContext?.phase,
      handSize: this.myHand.length,
      isLeader: this.gameContext?.isLeader,
      currentMeld: this.gameContext?.currentMeld,
      currentTurnPlayerId: currentState?.currentTurnPlayerId,
      mySessionId: this.room?.sessionId
    });
    
    if (!this.gameContext || !freshIsMyTurn || this.decisionInProgress) {
      console.log(`[${this.config.name}] makeDecision early return - not my turn or already deciding`);
      return;
    }
    
    // Ensure we have cards before making a decision
    if (this.myHand.length === 0) {
      console.log(`[${this.config.name}] No cards in hand yet, waiting...`);
      // Try again after a short delay
      setTimeout(() => {
        const state = this.room?.state as any;
        if (state?.currentTurnPlayerId === this.room?.sessionId && !this.decisionInProgress) {
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
      
      // Re-check if it's still our turn after async operation
      const currentState = this.room?.state as any;
      if (currentState?.currentTurnPlayerId !== this.room?.sessionId) {
        console.log(`[${this.config.name}] Turn changed during decision making, aborting`);
        return;
      }
      
      // Re-check phase
      const phaseStr = String(currentState?.phase).toUpperCase();
      if (phaseStr !== 'PLAYING') {
        console.log(`[${this.config.name}] Phase changed during decision making, aborting`);
        return;
      }
      
      // Validate decision - leaders shouldn't pass when there's no current meld
      if (decision.action === 'pass' && this.gameContext.isLeader && !this.gameContext.currentMeld) {
        console.error(`[${this.config.name}] Strategy returned invalid pass decision for leader!`);
        console.error(`[${this.config.name}] Context at decision time:`, {
          isLeader: this.gameContext.isLeader,
          currentMeld: this.gameContext.currentMeld,
          validPlaysFound: decision.reasoning
        });
      }
      
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
    
    // Validate we're still in PLAYING phase and it's still our turn
    const currentState = this.room.state as any;
    const phaseStr = String(currentState?.phase).toUpperCase();
    
    if (phaseStr !== 'PLAYING') {
      console.log(`[${this.config.name}] Cannot play - game phase is ${currentState?.phase}, not PLAYING`);
      return;
    }
    
    if (currentState?.currentTurnPlayerId !== this.room?.sessionId) {
      console.log(`[${this.config.name}] Cannot play - not my turn anymore (current: ${currentState?.currentTurnPlayerId})`);
      return;
    }
    
    const cardCodes = cards.map(c => c.code);
    console.log(`Bot ${this.config.name} playing:`, cardCodes);
    
    this.room.send('play', { cards: cardCodes });
  }

  private pass(): void {
    if (!this.room) return;
    
    // Validate we're still in PLAYING phase and it's still our turn
    const currentState = this.room.state as any;
    const phaseStr = String(currentState?.phase).toUpperCase();
    
    if (phaseStr !== 'PLAYING') {
      console.log(`[${this.config.name}] Cannot pass - game phase is ${currentState?.phase}, not PLAYING`);
      return;
    }
    
    if (currentState?.currentTurnPlayerId !== this.room?.sessionId) {
      console.log(`[${this.config.name}] Cannot pass - not my turn anymore (current: ${currentState?.currentTurnPlayerId})`);
      return;
    }
    
    // Final validation before passing - check current state
    const isCurrentlyLeader = currentState?.leadPlayerId === this.room?.sessionId;
    const hasCurrentMeld = !!currentState?.currentMeld;
    
    if (isCurrentlyLeader && !hasCurrentMeld) {
      console.error(`[${this.config.name}] CRITICAL: About to pass as leader with no meld! Preventing pass.`);
      console.error(`[${this.config.name}] State details:`, {
        leadPlayerId: currentState?.leadPlayerId,
        mySessionId: this.room.sessionId,
        currentMeld: currentState?.currentMeld,
        phase: currentState?.phase
      });
      // Force play instead
      if (this.myHand.length > 0) {
        console.log(`[${this.config.name}] Emergency: Playing lowest card instead of passing`);
        const sortedHand = [...this.myHand].sort((a, b) => a.rank - b.rank);
        this.playCards([sortedHand[0]]);
        return;
      }
    }
    
    console.log(`Bot ${this.config.name} passing`);
    
    // Very rarely announce passes (5% chance)
    if (Math.random() < 0.05) {
      const message = this.strategy.getChatMessage('pass');
      if (message) this.sendChat(message);
    }
    
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
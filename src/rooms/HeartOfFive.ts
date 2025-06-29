import { Room, Client } from "@colyseus/core";
import { GameState, GamePhase, Card, Player, Meld } from "./schema/GameState";
import { getRoomJoinUrl, getInviteUrl } from "../utils/url";

export interface HeartOfFiveOptions {
  minPlayers?: number;
  maxPlayers?: number;
  targetWins?: number;
  autoStart?: boolean;
  testMode?: boolean;
  testDeckSize?: number; // Number of cards per player for test mode
  testDeck?: string; // Exact deck specification for test mode (e.g., "5H 6H 7H 8H 5C 3C 4C 5C")
}

export class HeartOfFive extends Room<GameState> {
  minPlayers: number = 4;
  maxClients: number = 8;
  autoStartTimeout: NodeJS.Timeout;
  testMode: boolean = false;
  testDeckSize: number = 0;
  testDeck: string = "";

  onCreate(options: HeartOfFiveOptions) {
    this.minPlayers = options.minPlayers || 4;
    this.maxClients = options.maxPlayers || 8;
    this.testMode = options.testMode || false;
    this.testDeckSize = options.testDeckSize || 0;
    this.testDeck = options.testDeck || "";
    
    this.state = new GameState();
    this.state.roomId = this.roomId;
    this.state.targetWins = options.targetWins || 10;
    
    // Pass test mode settings to GameState
    if (this.testMode) {
      this.state.targetWins = 2; // Quick games for testing
      this.state.testDeckSize = this.testDeckSize;
      this.state.testDeck = this.testDeck;
    }
    
    this.setupMessageHandlers();
    this.setupStateMonitoring();
    
    if (options.autoStart !== false) {
      this.autoStartTimeout = setTimeout(() => {
        if (this.state.players.size >= this.minPlayers) {
          this.startGame();
        }
      }, 30000);
    }
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined!");

    const playerName = options.name || `Player ${this.state.players.size + 1}`;
    this.state.addPlayer(client.sessionId, playerName);

    // If this is the first player, they're the room creator
    if (this.state.players.size === 1) {
      this.setMetadata({
        creatorName: playerName,
        createdAt: Date.now()
      });
    }

    // client.view = new StateView();
    // client.view.add(this.state.players);
    
    client.send("welcome", {
      playerId: client.sessionId,
      roomState: {
        minPlayers: this.minPlayers,
        maxPlayers: this.maxClients,
        currentPlayers: this.state.players.size,
        phase: this.state.phase
      },
      inviteUrl: getInviteUrl(this.roomId, "Heart of Five Game")
    });
    
    this.broadcast("player_joined", {
      playerId: client.sessionId,
      name: playerName,
      totalPlayers: this.state.players.size
    }, { except: client });
    
    // Add system message for player joined
    this.state.addSystemMessage(`👋 ${playerName} joined the game`, "info");
    
    this.checkGameStart();
  }


  private setupMessageHandlers() {
    this.onMessage("ready", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.isActive = true;
        this.checkGameStart();
      }
    });

    this.onMessage("startGame", (client, message) => {
      // Allow starting a new round/game after ROUND_END, GAME_END, or WAITING
      if (this.state.phase === GamePhase.ROUND_END || 
          this.state.phase === GamePhase.GAME_END ||
          this.state.phase === GamePhase.WAITING) {
        if (this.state.players.size >= 2) {
          console.log("Starting new round/game from phase:", this.state.phase);
          
          // If starting from GAME_END, reset the game completely
          if (this.state.phase === GamePhase.GAME_END) {
            this.resetGame();
          }
          
          this.startGame();
        } else {
          client.send("error", { message: "Need at least 2 players to start" });
        }
      }
    });

    this.onMessage("play", (client, message: { cards: string[] }) => {
      // Use centralized validation
      if (!this.state.canPlayerPlay(client.sessionId)) {
        const errorMsg = this.state.phase !== GamePhase.PLAYING 
          ? `Cannot play - game is in ${this.state.phase} phase`
          : "Not your turn!";
        client.send("error", { message: errorMsg });
        console.log(`[play] Rejected play from ${client.sessionId}: ${errorMsg}`);
        return;
      }
      
      const player = this.state.players.get(client.sessionId);
      
      const cards = this.parseCards(message.cards, player);
      if (!cards) {
        client.send("error", { message: "Invalid cards!" });
        return;
      }
      
      // First check if the meld is structurally valid
      const testMeld = new Meld();
      testMeld.setCards(cards);
      if (!testMeld.type) {
        client.send("error", { message: "Invalid card combination! Not a valid meld type." });
        return;
      }
      
      const success = this.state.playMeld(client.sessionId, cards);
      if (!success) {
        client.send("error", { message: "Invalid play! Must match current meld type or play a bomb." });
        return;
      }
      
      // Send updated hand back to the player who just played
      const updatedPlayer = this.state.players.get(client.sessionId);
      if (updatedPlayer) {
        client.send("your_hand", {
          cards: updatedPlayer.hand
        });
      }
      
      this.broadcast("meld_played", {
        playerId: client.sessionId,
        cards: message.cards,
        meldType: this.state.currentMeldType
      });
      
      // Add play message as player message
      const meldPlayer = this.state.players.get(client.sessionId);
      if (meldPlayer && this.state.currentMeld) {
        // Send card codes for easier parsing in frontend
        const cardCodes = this.state.currentMeld.cards.map(card => card.code).join(" ");
        this.state.addChatMessage(client.sessionId, `(played) ${cardCodes}`);
      }
      
      // Check if the round or game ended after this play
      // Note: The phase may have changed after playMeld()
      const phaseAfterPlay = this.state.phase as GamePhase;
      if (phaseAfterPlay === GamePhase.ROUND_END || phaseAfterPlay === GamePhase.GAME_END) {
        console.log('[play] Round/game ended, phase is now:', phaseAfterPlay);
        this.handleRoundEnd();
      } else {
        // Send turn notification to the next player
        this.sendTurnNotification();
      }
    });

    this.onMessage("pass", (client) => {
      // Allow passing during PLAYING phase only
      if (this.state.phase !== GamePhase.PLAYING) {
        console.log('[pass] Ignoring pass - not in PLAYING phase, current phase:', this.state.phase);
        return;
      }
      
      const previousLeader = this.state.leadPlayerId;
      const success = this.state.pass(client.sessionId);
      if (!success) {
        // Check if it's because leader tried to pass with no meld
        if (this.state.leadPlayerId === client.sessionId && !this.state.currentMeld) {
          client.send("error", { 
            message: "Cannot pass - you must play something as the leader!",
            code: "LEADER_MUST_PLAY"
          });
        } else {
          client.send("error", { message: "Cannot pass!" });
        }
        return;
      }
      
      this.broadcast("player_passed", { playerId: client.sessionId });
      
      // Add pass message as player message
      const player = this.state.players.get(client.sessionId);
      if (player) {
        this.state.addChatMessage(client.sessionId, "(passed)");
      }
      
      // Check if leadership changed after all passes
      if (this.state.leadPlayerId !== previousLeader && this.state.consecutivePasses === 0) {
        console.log('New leader after all passes:', this.state.leadPlayerId);
        this.broadcast("new_leader", { 
          playerId: this.state.leadPlayerId,
          message: "All players passed. New leader can play any meld!"
        });
        
        // Add system message for new leader (keep this as system message)
        const leader = this.state.players.get(this.state.leadPlayerId);
        if (leader) {
          this.state.addSystemMessage(`👑 ${leader.name} is the new leader! Can play any meld.`, "success");
        }
        
        // Send turn notification to the new leader
        this.sendTurnNotification();
      }
      
      // Check if the round or game ended after this pass
      // Note: The phase may have changed after pass()
      const phaseAfterPass = this.state.phase as GamePhase;
      if (phaseAfterPass === GamePhase.ROUND_END || phaseAfterPass === GamePhase.GAME_END) {
        console.log('[pass] Round/game ended, phase is now:', phaseAfterPass);
        this.handleRoundEnd();
      } else if (this.state.leadPlayerId === previousLeader) {
        // Normal pass - send turn notification to next player
        this.sendTurnNotification();
      }
    });

    this.onMessage("chat", (client, message: { text: string }) => {
      const success = this.state.addChatMessage(client.sessionId, message.text);
      if (!success) {
        client.send("error", { message: "Failed to send message" });
      }
    });
  }

  private setupStateMonitoring() {
    // We'll check for phase changes after each game action
    // This will be called from various places where state changes
  }

  private handleGameEnd() {
    console.log('[handleGameEnd] Called. Current phase:', this.state.phase);
    console.log('[handleGameEnd] Number of connected clients:', this.clients.length);
    
    // Ensure we're in GAME_END phase
    if (this.state.phase !== GamePhase.GAME_END) {
      console.error('[handleGameEnd] Called but phase is not GAME_END:', this.state.phase);
      return;
    }
    
    // Find the overall winner
    let winner: Player | null = null;
    let maxWins = 0;
    
    this.state.players.forEach(player => {
      console.log(`[handleGameEnd] Player ${player.name}: ${player.wins} wins`);
      if (player.wins > maxWins) {
        maxWins = player.wins;
        winner = player;
      }
    });
    
    console.log('[handleGameEnd] Winner:', winner?.name, 'with', winner?.wins, 'wins');
    
    const gameEndData = {
      winner: winner ? {
        id: winner.id,
        name: winner.name,
        wins: winner.wins
      } : null,
      finalStandings: Array.from(this.state.players.values()).map(p => ({
        playerId: p.id,
        name: p.name,
        wins: p.wins,
        losses: p.losses
      })).sort((a, b) => b.wins - a.wins)
    };
    
    console.log('[handleGameEnd] Broadcasting game_ended with data:', JSON.stringify(gameEndData, null, 2));
    console.log('[handleGameEnd] About to broadcast to', this.clients.length, 'clients');
    
    try {
      this.broadcast("game_ended", gameEndData);
      console.log('[handleGameEnd] Broadcast completed successfully');
    } catch (error) {
      console.error('[handleGameEnd] Error broadcasting game_ended:', error);
    }
    
    if (winner) {
      this.state.addSystemMessage(`🎉 Game Over! ${winner.name} won with ${winner.wins} rounds!`, "success");
    }
  }

  onLeave(client: Client, consented: boolean) {
    console.log(client.sessionId, "left!");
    
    if (this.state.phase === GamePhase.WAITING) {
      // Get player name before removing
      const player = this.state.players.get(client.sessionId);
      const playerName = player ? player.name : "A player";
      
      this.state.removePlayer(client.sessionId);
      
      this.broadcast("player_left", {
        playerId: client.sessionId,
        totalPlayers: this.state.players.size
      });
      
      // Add system message for player left
      this.state.addSystemMessage(`🚪 ${playerName} left the game`, "warning");
    } else {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.isActive = false;
        
        if (this.state.currentTurnPlayerId === client.sessionId) {
          this.state.pass(client.sessionId);
        }
      }
      
      this.allowReconnection(client, 60);
    }
  }

  async onReconnect(client: Client) {
    console.log(client.sessionId, "reconnected!");
    
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.isActive = true;
      
      client.send("game_state", {
        currentTurn: this.state.currentTurnPlayerId,
        currentMeld: this.state.currentMeld,
        phase: this.state.phase
      });
      
      // Send their hand privately
      client.send("your_hand", {
        cards: player.hand
      });
    }
  }

  private checkGameStart() {
    if (this.state.phase !== GamePhase.WAITING) return;
    
    const activePlayers = Array.from(this.state.players.values()).filter(p => p.isActive);
    
    if (this.state.players.size >= this.minPlayers && 
        this.state.players.size === activePlayers.length) {
      this.startGame();
    }
  }

  private resetGame() {
    console.log("Resetting game for new game");
    // Reset all player wins/losses
    this.state.players.forEach(player => {
      player.wins = 0;
      player.losses = 0;
      player.position = 0;
    });
    
    // Reset round counter
    this.state.currentRound = 0;
    this.state.roundWinnerId = null;
    
    // Set phase to WAITING so startGame can proceed
    this.state.phase = GamePhase.WAITING;
  }

  private startGame() {
    // Allow starting from WAITING or ROUND_END phases
    if (this.state.phase !== GamePhase.WAITING && this.state.phase !== GamePhase.ROUND_END) {
      console.log("Cannot start game - wrong phase:", this.state.phase);
      return;
    }
    
    if (this.autoStartTimeout) {
      clearTimeout(this.autoStartTimeout);
      this.autoStartTimeout = null;
    }
    
    console.log("Starting game/round with", this.state.players.size, "players");
    
    // Only lock on first game, not on subsequent rounds
    if (this.state.phase === GamePhase.WAITING) {
      this.lock();
    } else if (this.state.phase === GamePhase.ROUND_END) {
      // If starting from ROUND_END, we need to properly start the new round
      this.state.startNewRound();
      // startNewRound already deals cards, so we can return early
      this.broadcastRoundStart();
      return;
    }

    this.state.initializeDeck();
    this.state.dealCards(this.testDeckSize);
    
    // Send each player their own hand privately
    this.state.players.forEach((player, playerId) => {
      const client = this.clients.find(c => c.sessionId === playerId);
      if (client) {
        client.send("your_hand", {
          cards: player.hand
        });
      }
    });
    
    // Note: For round 0, findStartingPlayer() in GameState will set the player with 3H as leader
    // For subsequent rounds, resetForNewRound() has already set the previous winner as leader

    console.log('Broadcasting game_started with currentTurn:', this.state.currentTurnPlayerId);
    this.broadcast("game_started", {
      currentTurn: this.state.currentTurnPlayerId,
      leadPlayer: this.state.leadPlayerId,
      round: this.state.currentRound
    });
    
    // Add system message for game started
    this.state.addSystemMessage(`🎮 Game ${this.state.currentRound} started!`, "success");
    
    // Send turn notification to the first player after a small delay
    // This ensures the player has received and processed their hand
    setTimeout(() => {
      console.log('[startGame] Sending delayed turn notification for game start');
      console.log('[startGame] Current clients:', this.clients.map(c => c.sessionId));
      console.log('[startGame] Current turn player:', this.state.currentTurnPlayerId);
      this.sendTurnNotification();
    }, 300);
  }

  private broadcastRoundStart() {
    // Send each player their own hand privately
    this.state.players.forEach((player, playerId) => {
      const client = this.clients.find(c => c.sessionId === playerId);
      if (client) {
        client.send("your_hand", {
          cards: player.hand
        });
      }
    });
    
    console.log('Broadcasting game_started with currentTurn:', this.state.currentTurnPlayerId);
    this.broadcast("game_started", {
      currentTurn: this.state.currentTurnPlayerId,
      leadPlayer: this.state.leadPlayerId,
      round: this.state.currentRound
    });
    
    // Add system message for game started
    this.state.addSystemMessage(`🎮 Game ${this.state.currentRound} started!`, "success");
    
    // Send turn notification to the first player after a small delay
    // This ensures the player has received and processed their hand
    setTimeout(() => {
      console.log('[broadcastRoundStart] Sending delayed turn notification for round start');
      this.sendTurnNotification();
    }, 300);
  }

  private parseCards(cardCodes: string[], player: any): Card[] | null {
    const cards: Card[] = [];
    
    for (const code of cardCodes) {
      const card = player.hand.find((c: Card) => c.code === code);
      if (!card) return null;
      cards.push(card);
    }
    
    return cards;
  }

  private handleRoundEnd() {
    console.log('[handleRoundEnd] Phase:', this.state.phase, 'RoundWinnerId:', this.state.roundWinnerId);
    
    // Check if game is ending BEFORE broadcasting round_ended
    const isGameEnding = this.state.phase === GamePhase.GAME_END;
    
    this.broadcast("round_ended", {
      winner: this.state.roundWinnerId,
      standings: Array.from(this.state.players.values()).map(p => ({
        playerId: p.id,
        name: p.name,
        wins: p.wins,
        losses: p.losses
      }))
    });
    
    // Add system message for round ended
    const winner = this.state.players.get(this.state.roundWinnerId);
    if (winner) {
      this.state.addSystemMessage(`🏆 Game ended! ${winner.name} won! Play again?`, "info");
    }
    
    // Always send game_ended message when a round ends (since round = game in correct terminology)
    const gameEndData = {
      winner: winner ? {
        id: winner.id,
        name: winner.name,
        wins: winner.wins
      } : null,
      finalStandings: Array.from(this.state.players.values()).map(p => ({
        playerId: p.id,
        name: p.name,
        wins: p.wins,
        losses: p.losses
      })).sort((a, b) => b.wins - a.wins)
    };
    
    console.log('[handleRoundEnd] Broadcasting game_ended with data:', JSON.stringify(gameEndData, null, 2));
    
    try {
      this.broadcast("game_ended", gameEndData);
      console.log('[handleRoundEnd] Broadcast completed successfully');
    } catch (error) {
      console.error('[handleRoundEnd] Error broadcasting game_ended:', error);
    }
    
    // Handle game end if needed (legacy - for when targetWins is reached)
    if (isGameEnding) {
      console.log('[handleRoundEnd] Game has ended (targetWins reached), calling handleGameEnd');
      // Call handleGameEnd for legacy support
      this.handleGameEnd();
    } else {
      // Don't auto-start next game - wait for player action
      this.state.addSystemMessage(`Ready for next game! Click "Play Again" to continue.`, "info");
    }
  }


  private sendTurnNotification() {
    console.log(`[sendTurnNotification] Sending turn notification to ${this.state.currentTurnPlayerId}`);
    console.log(`[sendTurnNotification] All connected clients:`, this.clients.map(c => ({ 
      sessionId: c.sessionId, 
      auth: c.auth 
    })));
    console.log(`[sendTurnNotification] All players in state:`, Array.from(this.state.players.keys()));
    
    const currentPlayer = this.state.players.get(this.state.currentTurnPlayerId);
    if (!currentPlayer) {
      console.log(`[sendTurnNotification] Player ${this.state.currentTurnPlayerId} not found in state.players`);
      return;
    }
    
    const client = this.clients.find(c => c.sessionId === this.state.currentTurnPlayerId);
    if (!client) {
      console.log(`[sendTurnNotification] Client ${this.state.currentTurnPlayerId} not found in this.clients`);
      console.log(`[sendTurnNotification] Available client sessionIds:`, this.clients.map(c => c.sessionId));
      return;
    }
    
    const isLeader = this.state.leadPlayerId === this.state.currentTurnPlayerId;
    const canPlayAnything = isLeader && !this.state.currentMeld;
    
    const turnData = {
      isLeader,
      canPlayAnything,
      currentMeld: this.state.currentMeld ? {
        type: this.state.currentMeldType,
        size: this.state.currentMeldSize,
        cards: this.state.currentMeld.cards.map(c => c.code)
      } : null,
      consecutivePasses: this.state.consecutivePasses,
      message: canPlayAnything ? "You're the leader! Play any meld." : 
               isLeader ? "Your turn. You must beat the current meld or pass." :
               "Your turn. Beat the current meld or pass."
    };
    
    console.log(`[sendTurnNotification] Sending your_turn to ${currentPlayer.name}:`, turnData);
    client.send("your_turn", turnData);
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
    
    if (this.autoStartTimeout) {
      clearTimeout(this.autoStartTimeout);
    }
  }
}

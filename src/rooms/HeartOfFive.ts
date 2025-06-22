import { Room, Client } from "@colyseus/core";
import { GameState, GamePhase, Card, Player, Meld } from "./schema/GameState";

export interface HeartOfFiveOptions {
  minPlayers?: number;
  maxPlayers?: number;
  targetWins?: number;
  autoStart?: boolean;
}

export class HeartOfFive extends Room<GameState> {
  minPlayers: number = 4;
  maxClients: number = 8;
  autoStartTimeout: NodeJS.Timeout;

  onCreate(options: HeartOfFiveOptions) {
    this.minPlayers = options.minPlayers || 4;
    this.maxClients = options.maxPlayers || 8;
    
    this.state = new GameState();
    this.state.roomId = this.roomId;
    this.state.targetWins = options.targetWins || 10;
    
    this.setupMessageHandlers();
    
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

    // client.view = new StateView();
    // client.view.add(this.state.players);
    
    client.send("welcome", {
      playerId: client.sessionId,
      roomState: {
        minPlayers: this.minPlayers,
        maxPlayers: this.maxClients,
        currentPlayers: this.state.players.size,
        phase: this.state.phase
      }
    });
    
    this.broadcast("player_joined", {
      playerId: client.sessionId,
      name: playerName,
      totalPlayers: this.state.players.size
    }, { except: client });
    
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

    this.onMessage("play", (client, message: { cards: string[] }) => {
      if (this.state.phase !== GamePhase.PLAYING) return;
      
      const player = this.state.players.get(client.sessionId);
      if (!player || player.id !== this.state.currentTurnPlayerId) {
        client.send("error", { message: "Not your turn!" });
        return;
      }
      
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
      
      // Check if the round ended after this play
      if ((this.state.phase as GamePhase) === GamePhase.ROUND_END) {
        this.handleRoundEnd();
      }
    });

    this.onMessage("pass", (client) => {
      if (this.state.phase !== GamePhase.PLAYING) return;
      
      const previousLeader = this.state.leadPlayerId;
      const success = this.state.pass(client.sessionId);
      if (!success) {
        client.send("error", { message: "Cannot pass!" });
        return;
      }
      
      this.broadcast("player_passed", { playerId: client.sessionId });
      
      // Check if leadership changed after all passes
      if (this.state.leadPlayerId !== previousLeader && this.state.consecutivePasses === 0) {
        console.log('New leader after all passes:', this.state.leadPlayerId);
        this.broadcast("new_leader", { 
          playerId: this.state.leadPlayerId,
          message: "All players passed. New leader can play any meld!"
        });
      }
    });
  }

  onLeave(client: Client, consented: boolean) {
    console.log(client.sessionId, "left!");
    
    if (this.state.phase === GamePhase.WAITING) {
      this.state.removePlayer(client.sessionId);
      
      this.broadcast("player_left", {
        playerId: client.sessionId,
        totalPlayers: this.state.players.size
      });
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

  private startGame() {
    if (this.state.phase !== GamePhase.WAITING) return;
    
    if (this.autoStartTimeout) {
      clearTimeout(this.autoStartTimeout);
      this.autoStartTimeout = null;
    }
    
    console.log("Starting game with", this.state.players.size, "players");
    
    this.lock();

    this.state.initializeDeck();
    this.state.dealCards();
    
    // Send each player their own hand privately
    this.state.players.forEach((player, playerId) => {
      const client = this.clients.find(c => c.sessionId === playerId);
      if (client) {
        client.send("your_hand", {
          cards: player.hand
        });
      }
    });
    
    if (this.state.currentRound === 0) {
        // first round and game, leader is the player with 3 of Hearts
        this.state.players.forEach((player, index) => {
            const hasThreeOfHearts = player.hand.some(card => card.code === "3H");
            if (hasThreeOfHearts) {
                this.state.currentTurnPlayerId = player.id;
                this.state.leadPlayerId = player.id;
            }
        })
    } else {
        // current winner is the Leader
        this.state.leadPlayerId = this.state.roundWinnerId;
        this.state.currentTurnPlayerId = this.state.roundWinnerId;
    }

    console.log('Broadcasting game_started with currentTurn:', this.state.currentTurnPlayerId);
    this.broadcast("game_started", {
      currentTurn: this.state.currentTurnPlayerId,
      leadPlayer: this.state.leadPlayerId,
      round: this.state.currentRound
    });
    
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
    this.broadcast("round_ended", {
      winner: this.state.roundWinnerId,
      standings: Array.from(this.state.players.values()).map(p => ({
        playerId: p.id,
        name: p.name,
        wins: p.wins,
        losses: p.losses
      }))
    });
    
    if (this.state.phase === GamePhase.GAME_END) {
      this.handleGameEnd();
    } else {
      setTimeout(() => {
        this.broadcast("new_round", {
          round: this.state.currentRound
        });
        
        // Send each player their own hand privately for new round
        this.state.players.forEach((player, playerId) => {
          const client = this.clients.find(c => c.sessionId === playerId);
          if (client) {
            client.send("your_hand", {
              cards: player.hand
            });
          }
        });
      }, 5000);
    }
  }

  private handleGameEnd() {
    const winner = Array.from(this.state.players.values())
      .find(p => p.wins >= this.state.targetWins);
    
    this.broadcast("game_ended", {
      winner: winner ? {
        playerId: winner.id,
        name: winner.name,
        wins: winner.wins
      } : null,
      finalStandings: Array.from(this.state.players.values())
        .sort((a, b) => b.wins - a.wins)
        .map(p => ({
          playerId: p.id,
          name: p.name,
          wins: p.wins,
          losses: p.losses
        }))
    });
    
    setTimeout(() => {
      this.disconnect();
    }, 30000);
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
    
    if (this.autoStartTimeout) {
      clearTimeout(this.autoStartTimeout);
    }
  }
}

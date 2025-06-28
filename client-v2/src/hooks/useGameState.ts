import { useState, useEffect } from 'react';
import { useColyseus } from '../contexts/ColyseusContext';
import { GamePhase } from '../types/game';
import type { Card, Player, Meld, ChatMessage } from '../types/game';

// Global flag to track if we've already set up listeners for a room
const roomListenerMap = new WeakMap<any, boolean>();

interface GameStateData {
  phase: GamePhase;
  currentRound: number;
  currentTurnPlayerId: string | null;
  leadPlayerId: string | null;
  players: Map<string, Player>;
  currentMeld: Meld | null;
  consecutivePasses: number;
  trickMelds: Meld[];
  lastTrickMelds: Meld[];
  myHand: Card[];
  isMyTurn: boolean;
  selectedCards: Set<string>;
  chatMessages: ChatMessage[];
  lastError: string | null;
  lastNotification: string | null;
  deckCount: number;
  discardTop: Card | null;
  winner?: {
    id: string;
    name: string;
    wins: number;
  };
  finalStandings?: {
    playerId: string;
    name: string;
    wins: number;
    losses: number;
  }[];
}

export const useGameState = () => {
  const { room, myPlayerId } = useColyseus();
  const [gameState, setGameState] = useState<GameStateData>({
    phase: GamePhase.WAITING,
    currentRound: 0,
    currentTurnPlayerId: null,
    leadPlayerId: null,
    players: new Map(),
    currentMeld: null,
    consecutivePasses: 0,
    trickMelds: [],
    lastTrickMelds: [],
    myHand: [],
    isMyTurn: false,
    selectedCards: new Set(),
    chatMessages: [],
    lastError: null,
    lastNotification: null,
    deckCount: 0,
    discardTop: null,
  });

  useEffect(() => {
    if (!room || !myPlayerId) return;

    // Check if we've already set up listeners for this room
    if (roomListenerMap.get(room)) {
      console.log('[useGameState] Listeners already set up for this room, skipping');
      return;
    }

    console.log('[useGameState] Setting up event listeners for player:', myPlayerId);
    roomListenerMap.set(room, true);


    // Listen for state changes
    room.onStateChange((state) => {
      const isMyTurn = state.currentTurnPlayerId === myPlayerId;
      
      // Convert chat messages to array
      const chatMessages = state.chatMessages ? 
        Array.from(state.chatMessages).map((msg: any) => ({
          id: msg.id,
          playerId: msg.playerId,
          playerName: msg.playerName,
          message: msg.message,
          timestamp: msg.timestamp
        })) : [];
      
      // Calculate deck count (52 cards minus distributed cards)
      const totalDistributed = Array.from(state.players.values())
        .reduce((sum, player: any) => sum + player.handCount, 0);
      const deckCount = Math.max(0, 52 - totalDistributed);
      
      // Convert trick melds to arrays
      const trickMelds: Meld[] = state.trickMelds ? 
        Array.from(state.trickMelds).map((meld: any) => ({
          cards: Array.from(meld.cards).map((card: any) => ({
            suit: card.suit,
            rank: card.rank,
            code: card.code
          })),
          type: meld.type,
          playerId: meld.playerId
        })) : [];
        
      const lastTrickMelds: Meld[] = state.lastTrickMelds ? 
        Array.from(state.lastTrickMelds).map((meld: any) => ({
          cards: Array.from(meld.cards).map((card: any) => ({
            suit: card.suit,
            rank: card.rank,
            code: card.code
          })),
          type: meld.type,
          playerId: meld.playerId
        })) : [];
        
      if (trickMelds.length > 0) {
        console.log('State has trickMelds:', trickMelds);
      }
      
      setGameState(prev => {
        // Use the actual phase from state
        const newPhase = state.phase;
        
        // Debug log phase changes
        if (prev.phase !== newPhase) {
          console.log('[useGameState] Phase changing from', prev.phase, 'to', newPhase);
        }
        
        return {
          ...prev,
          phase: newPhase,
          currentRound: state.currentRound,
          currentTurnPlayerId: state.currentTurnPlayerId,
          leadPlayerId: state.leadPlayerId,
          players: new Map(state.players),
          currentMeld: state.currentMeld,
          consecutivePasses: state.consecutivePasses,
          trickMelds,
          lastTrickMelds,
          isMyTurn,
          chatMessages,
          deckCount,
          // Preserve winner and finalStandings if we have them and are still in GAME_END phase
          ...(newPhase === GamePhase.GAME_END && prev.winner ? { winner: prev.winner, finalStandings: prev.finalStandings } : {})
        };
      });
    });

    // Listen for hand updates
    room.onMessage('your_hand', ({cards}:any) => {
        console.log(`[${myPlayerId}] Received hand:`, cards);

      setGameState(prev => ({
        ...prev,
        myHand: cards,
        selectedCards: new Set(), // Clear selection on new hand
      }));
    });

    // Listen for welcome message
    room.onMessage('welcome', (data: { playerId: string, roomState: any }) => {
      console.log('Welcome received:', data);
    });

    // Listen for player joined
    room.onMessage('player_joined', (data: { playerId: string, name: string, totalPlayers: number }) => {
      console.log(`${data.name} joined the game (${data.totalPlayers} players)`);
    });

    // Listen for game started
    room.onMessage('game_started', (data: { currentTurn: string, leadPlayer: string, round: number }) => {
      console.log('Game started!', data);
      setGameState(prev => ({
        ...prev,
        currentTurnPlayerId: data.currentTurn,
        leadPlayerId: data.leadPlayer,
        currentRound: data.round,
        phase: GamePhase.PLAYING,
        isMyTurn: data.currentTurn === myPlayerId,
        // Clear game end data when starting a new game
        winner: undefined,
        finalStandings: undefined
      }));
    });

    // Listen for meld played
    room.onMessage('meld_played', (data: { playerId: string, cards: string[], meldType: string }) => {
      console.log(`Player ${data.playerId} played ${data.meldType}:`, data.cards);
    });

    // Listen for player passed
    room.onMessage('player_passed', (data: { playerId: string }) => {
      console.log(`Player ${data.playerId} passed`);
    });

    // Listen for new leader after all passes
    room.onMessage('new_leader', (data: { playerId: string, message: string }) => {
      console.log('New leader:', data.playerId);
      
      setGameState(prev => {
        const leaderPlayer = prev.players.get(data.playerId);
        const leaderName = leaderPlayer?.name || 'Unknown';
        // Personalize message based on whether it's the current player
        const notification = data.playerId === myPlayerId 
          ? "🎯 You are the new leader!" 
          : `🎯 ${leaderName} is the new leader!`;
        
        // Clear notification after 7 seconds (longer for better visibility)
        setTimeout(() => {
          setGameState(p => ({ ...p, lastNotification: null }));
        }, 7000);
        
        return { 
          ...prev, 
          lastNotification: notification,
          leadPlayerId: data.playerId,
          currentMeld: null, // Clear current meld when new leader is assigned
          consecutivePasses: 0 // Reset consecutive passes
        };
      });
    });

    // Listen for player left
    room.onMessage('player_left', (data: { playerId: string, totalPlayers: number }) => {
      console.log(`Player ${data.playerId} left (${data.totalPlayers} players remaining)`);
    });

    // Listen for round ended
    room.onMessage('round_ended', (data: { winner: string, standings: any[] }) => {
      console.log('Round ended! Winner:', data.winner);
      console.log('Standings:', data.standings);
      
      // Update player wins/losses from standings
      setGameState(prev => {
        const updatedPlayers = new Map(prev.players);
        data.standings.forEach(standing => {
          const player = updatedPlayers.get(standing.playerId);
          if (player) {
            player.wins = standing.wins;
            player.losses = standing.losses;
          }
        });
        return {
          ...prev,
          players: updatedPlayers
        };
      });
    });

    // Listen for new round
    room.onMessage('new_round', (data: { round: number }) => {
      console.log('New round starting:', data.round);
      setGameState(prev => ({
        ...prev,
        currentRound: data.round,
        currentMeld: null,
        consecutivePasses: 0
      }));
    });

    // Listen for game ended
    room.onMessage('game_ended', (data: { winner: any, finalStandings: any[] }) => {
      console.log('[useGameState] *** GAME_ENDED MESSAGE RECEIVED ***');
      console.log('[useGameState] Game ended! Setting phase to GAME_END', data);
      console.log('[useGameState] Winner:', JSON.stringify(data.winner));
      console.log('[useGameState] Final standings:', JSON.stringify(data.finalStandings));
      
      setGameState(prev => {
        console.log('[useGameState] Previous phase was:', prev.phase, 'Setting to GAME_END');
        console.log('[useGameState] Previous winner was:', prev.winner);
        const newState = {
          ...prev,
          phase: GamePhase.GAME_END,
          winner: data.winner,
          finalStandings: data.finalStandings
        };
        console.log('[useGameState] New state will have winner:', newState.winner);
        return newState;
      });
    });

    // Listen for reconnection game state
    room.onMessage('game_state', (data: { currentTurn: string, currentMeld: any, phase: GamePhase }) => {
      console.log('Reconnection game state:', data);
      setGameState(prev => ({
        ...prev,
        currentTurnPlayerId: data.currentTurn,
        currentMeld: data.currentMeld,
        phase: data.phase,
        isMyTurn: data.currentTurn === myPlayerId
      }));
    });

    // Listen for errors
    room.onMessage('error', (error: { message: string; code?: string }) => {
      console.error('Game error:', error.message, error.code);
      
      // Show more helpful message for specific error codes
      let errorMessage = error.message;
      if (error.code === 'LEADER_MUST_PLAY') {
        errorMessage = "As the leader, you must play something to start the trick!";
      }
      
      setGameState(prev => ({ ...prev, lastError: errorMessage }));
      
      // Clear error after 3 seconds
      setTimeout(() => {
        setGameState(prev => ({ ...prev, lastError: null }));
      }, 3000);
    });

    // Cleanup function
    return () => {
      console.log('[useGameState] Cleaning up event listeners');
      if (room) {
        roomListenerMap.delete(room);
        room.removeAllListeners();
      }
    };
  }, [room, myPlayerId]);

  const toggleCardSelection = (cardKey: string) => {
    setGameState(prev => {
      const newSelected = new Set(prev.selectedCards);
      if (newSelected.has(cardKey)) {
        newSelected.delete(cardKey);
      } else {
        newSelected.add(cardKey);
      }
      return { ...prev, selectedCards: newSelected };
    });
  };

  const clearSelection = () => {
    setGameState(prev => ({ ...prev, selectedCards: new Set() }));
  };

  const playCards = () => {
    if (!room || gameState.selectedCards.size === 0) return;
    
    const selectedCardCodes = Array.from(gameState.selectedCards);
    room.send('play', { cards: selectedCardCodes });
    clearSelection();
  };

  const pass = () => {
    if (!room) return;
    room.send('pass');
  };

  const startGame = () => {
    if (!room) return;
    room.send('startGame');
  };

  const sendChatMessage = (message: string) => {
    if (!room) return;
    room.send('chat', { text: message });
  };

  return {
    ...gameState,
    toggleCardSelection,
    clearSelection,
    playCards,
    pass,
    startGame,
    sendChatMessage,
  };
};
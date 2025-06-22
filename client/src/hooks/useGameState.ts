import { useState, useEffect } from 'react';
import { useColyseus } from '../contexts/ColyseusContext';
import { Card, Player, Meld, GamePhase } from '../types/game';
import { showToast } from '../components/Toast';

interface GameStateData {
  phase: GamePhase;
  currentRound: number;
  currentTurnPlayerId: string | null;
  leadPlayerId: string | null;
  players: Map<string, Player>;
  currentMeld: Meld | null;
  consecutivePasses: number;
  myHand: Card[];
  isMyTurn: boolean;
  selectedCards: Set<string>;
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
    myHand: [],
    isMyTurn: false,
    selectedCards: new Set(),
  });

  useEffect(() => {
    if (!room || !myPlayerId) return;

    // Listen for state changes
    room.onStateChange((state) => {
      const isMyTurn = state.currentTurnPlayerId === myPlayerId;
      
      setGameState(prev => ({
        ...prev,
        phase: state.phase,
        currentRound: state.currentRound,
        currentTurnPlayerId: state.currentTurnPlayerId,
        leadPlayerId: state.leadPlayerId,
        players: new Map(state.players),
        currentMeld: state.currentMeld,
        consecutivePasses: state.consecutivePasses,
        isMyTurn,
      }));
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
      showToast(`Welcome! ${data.roomState.currentPlayers}/${data.roomState.minPlayers} players in room`, 'info');
    });

    // Listen for player joined
    room.onMessage('player_joined', (data: { playerId: string, name: string, totalPlayers: number }) => {
      console.log(`${data.name} joined the game (${data.totalPlayers} players)`);
      showToast(`${data.name} joined the game`, 'info');
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
        isMyTurn: data.currentTurn === myPlayerId
      }));
      showToast('Game started!', 'success');
      if (data.currentTurn === myPlayerId) {
        showToast('Your turn!', 'info');
      }
    });

    // Listen for meld played
    room.onMessage('meld_played', (data: { playerId: string, cards: string[], meldType: string }) => {
      console.log(`Player ${data.playerId} played ${data.meldType}:`, data.cards);
      const player = room.state?.players.get(data.playerId);
      if (player) {
        showToast(`${player.name} played ${data.meldType}`, 'info');
      }
    });

    // Listen for player passed
    room.onMessage('player_passed', (data: { playerId: string }) => {
      console.log(`Player ${data.playerId} passed`);
      const player = room.state?.players.get(data.playerId);
      if (player) {
        showToast(`${player.name} passed`, 'info');
      }
    });

    // Listen for player left
    room.onMessage('player_left', (data: { playerId: string, totalPlayers: number }) => {
      console.log(`Player ${data.playerId} left (${data.totalPlayers} players remaining)`);
      showToast(`A player left the game`, 'warning');
    });

    // Listen for round ended
    room.onMessage('round_ended', (data: { winner: string, standings: any[] }) => {
      console.log('Round ended! Winner:', data.winner);
      console.log('Standings:', data.standings);
      const winnerData = data.standings.find(p => p.playerId === data.winner);
      if (winnerData) {
        showToast(`Round ended! ${winnerData.name} won!`, 'info', 5000);
      }
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
      showToast(`Round ${data.round} starting!`, 'info');
    });

    // Listen for game ended
    room.onMessage('game_ended', (data: { winner: any, finalStandings: any[] }) => {
      console.log('Game ended!', data);
      setGameState(prev => ({
        ...prev,
        phase: GamePhase.GAME_END
      }));
      if (data.winner) {
        showToast(`Game Over! ${data.winner.name} wins with ${data.winner.wins} victories!`, 'success', 10000);
      } else {
        showToast('Game ended!', 'info', 10000);
      }
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
      showToast('Reconnected to game', 'success');
    });

    // Listen for errors
    room.onMessage('error', (error: { message: string }) => {
      console.error('Game error:', error.message);
      showToast(error.message, 'error');
    });

    // Cleanup is handled automatically when room is disconnected
  }, [room, myPlayerId]);

  const toggleCardSelection = (cardCode: string) => {
    setGameState(prev => {
      const newSelected = new Set(prev.selectedCards);
      if (newSelected.has(cardCode)) {
        newSelected.delete(cardCode);
      } else {
        newSelected.add(cardCode);
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

  return {
    ...gameState,
    toggleCardSelection,
    clearSelection,
    playCards,
    pass,
    startGame,
  };
};

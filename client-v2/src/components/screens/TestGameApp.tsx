import React, { useEffect, useState, useRef } from 'react';
import { useColyseus } from '../../contexts/ColyseusContext';
import { useGameState } from '../../hooks/useGameState';
import { GamePhase } from '../../types/game';
import { GameTable } from '../game/GameTable';
import BotManagerSingleton from '../../bots/BotManagerSingleton';
import type { BotConfig } from '../../bots/types';

type AppState = 'setup' | 'connecting' | 'lobby' | 'game';

export const TestGameApp: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('setup');
  const [testConfig] = useState({
    cardsPerPlayer: 2,
    numBots: 3,
    botDelay: 100, // milliseconds
    testDeck: "5H 6H 7H 8H 5C 3C 4C 8C" // Human gets 5H 5C, others get pairs
  });
  const botManager = useRef(BotManagerSingleton.getInstance());
  const botsAdded = useRef(false);
  const setupStarted = useRef(false);
  
  const { client, room, roomId, myPlayerId, isConnected, createRoom, leaveRoom } = useColyseus();
  const gameState = useGameState();

  // Auto-create room on mount when client is ready
  useEffect(() => {
    if (appState === 'setup' && !setupStarted.current && client) {
      setupStarted.current = true;
      setupTestGame();
    }
  }, [client, appState]);

  // Update app state based on connection and game phase
  useEffect(() => {
    console.log('Connection state:', { isConnected, room: !!room, phase: gameState.phase });
    if (isConnected && room) {
      if (gameState.phase === GamePhase.PLAYING || 
          gameState.phase === GamePhase.ROUND_END || 
          gameState.phase === GamePhase.GAME_END) {
        setAppState('game');
      } else {
        setAppState('lobby');
      }
    }
  }, [isConnected, room, gameState.phase]);

  const setupTestGame = async () => {
    console.log('Setting up test game...');
    setAppState('connecting');
    
    try {
      // Create room with test mode enabled
      await createRoom('TestHuman', {
        testMode: true,
        testDeckSize: testConfig.cardsPerPlayer,
        testDeck: testConfig.testDeck,
        minPlayers: testConfig.numBots + 1,
        targetWins: 2
      });
      
      console.log('Room created successfully');
    } catch (err) {
      console.error('Failed to create test room:', err);
      setAppState('setup');
    }
  };

  // Auto-add bots when in lobby
  useEffect(() => {
    if (appState === 'lobby' && room && roomId && !botsAdded.current) {
      botsAdded.current = true;
      console.log('Adding bots to room:', roomId);
      
      // Add bots with staggered timing
      for (let i = 0; i < testConfig.numBots; i++) {
        setTimeout(() => {
          addBot(i);
        }, i * 200);
      }
    }
  }, [appState, room, roomId]);

  const addBot = async (index: number) => {
    const testBotConfig: BotConfig = {
      name: `TestBot${index + 1}`,
      personality: {
        aggressiveness: 0.7,
        riskTolerance: 0.6,
        bluffingTendency: 0.3,
        patience: 0.4,
        adaptability: 0.5
      },
      skillLevel: 'intermediate',
      decisionDelay: {
        min: testConfig.botDelay,
        max: testConfig.botDelay * 2
      },
      chatEnabled: false
    };
    
    try {
      console.log('Creating bot:', testBotConfig.name);
      await botManager.current.createBot(testBotConfig, roomId!);
      console.log('Bot created successfully:', testBotConfig.name);
    } catch (err) {
      console.error('Error adding bot:', err);
    }
  };

  // Auto-start game when all players joined or when round ends (but not when game ends)
  useEffect(() => {
    if (appState === 'lobby' && 
        gameState.players.size === testConfig.numBots + 1) {
      console.log('All players joined, starting game...');
      setTimeout(() => {
        gameState.startGame();
      }, 1000);
    } else if (appState === 'game' && 
               gameState.phase === GamePhase.ROUND_END) {
      // Don't auto-start if someone has reached the target wins
      const hasWinner = Array.from(gameState.players.values()).some(
        player => player.wins >= 2 // Target wins in test mode
      );
      
      if (!hasWinner) {
        console.log('Round ended, auto-starting next round...');
        setTimeout(() => {
          gameState.startGame();
        }, 1000);
      } else {
        console.log('Game has a winner, not auto-starting next round');
      }
    }
  }, [appState, gameState.players.size, gameState.phase, gameState.startGame]);

  const handlePlayAgain = () => {
    gameState.startGame();
  };

  const handleLeaveGame = () => {
    // Disconnect all bots
    botManager.current.disconnectAll();
    botsAdded.current = false;
    
    leaveRoom();
    window.location.href = '/';
  };

  const handleRestart = () => {
    // Disconnect all bots
    botManager.current.disconnectAll();
    botsAdded.current = false;
    
    leaveRoom();
    setAppState('setup');
    setTimeout(() => setupTestGame(), 100);
  };

  // Debug current state
  console.log('Current appState:', appState, 'isConnected:', isConnected, 'room:', !!room);

  // Show connecting state
  if (appState === 'connecting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🃏</div>
          <p className="text-xl">Connecting to test server...</p>
          <p className="text-sm text-gray-400 mt-2">
            Connected: {isConnected ? 'Yes' : 'No'} | Room: {room ? 'Yes' : 'No'}
          </p>
        </div>
      </div>
    );
  }

  // Show lobby/waiting state
  if (appState === 'lobby') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🃏</div>
          <p className="text-xl mb-2">Setting up test game...</p>
          <p className="text-sm text-gray-400">
            {gameState.players.size}/{testConfig.numBots + 1} players joined
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Room: {roomId}
          </p>
        </div>
      </div>
    );
  }

  // Show game state
  if (appState === 'game') {
    if (!myPlayerId) return null;

    // Show game table (GameTable will handle showing GameOver when phase is GAME_END)
    const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
    const isLeader = gameState.leadPlayerId === myPlayerId;
    const canPass = !isLeader || !!gameState.currentMeld;
    
    return (
      <>
        {/* Test Controls Overlay */}
        <div className="fixed top-4 right-4 bg-gray-800 bg-opacity-90 p-4 rounded-lg shadow-lg z-50">
          <h3 className="text-white font-bold mb-2">Test Controls</h3>
          <div className="space-y-2 text-sm">
            <div className="text-gray-300">
              Room: {roomId}
            </div>
            <div className="text-gray-300">
              Phase: {gameState.phase}
            </div>
            <div className="text-gray-300">
              Round: {gameState.currentRound}
            </div>
            <div className="text-gray-300">
              Cards/Player: {testConfig.cardsPerPlayer}
            </div>
            <button
              onClick={handleRestart}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs w-full"
            >
              Restart Test
            </button>
          </div>
        </div>

        <GameTable
          players={gameState.players}
          myPlayerId={myPlayerId}
          myHand={gameState.myHand}
          selectedCards={gameState.selectedCards}
          currentMeld={gameState.currentMeld}
          currentTurnPlayerId={gameState.currentTurnPlayerId || ''}
          leadPlayerId={gameState.leadPlayerId || ''}
          deckCount={gameState.deckCount}
          discardTop={gameState.discardTop || undefined}
          consecutivePasses={gameState.consecutivePasses}
          trickMelds={gameState.trickMelds}
          lastTrickMelds={gameState.lastTrickMelds}
          lastError={gameState.lastError}
          lastNotification={gameState.lastNotification}
          phase={gameState.phase}
          winner={gameState.winner}
          finalStandings={gameState.finalStandings}
          onCardSelect={gameState.toggleCardSelection}
          onPlayCards={gameState.playCards}
          onPass={gameState.pass}
          onLeaveGame={handleLeaveGame}
          onPlayAgain={handlePlayAgain}
        />
      </>
    );
  }

  // Default setup state
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🃏</div>
        <p className="text-xl">Initializing test environment...</p>
      </div>
    </div>
  );
};
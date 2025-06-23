import React from 'react';
import { useColyseus } from '../contexts/ColyseusContext';
import { useGameState } from '../hooks/useGameState';
import { WaitingRoom } from './WaitingRoom';
import { PlayerHand } from './PlayerHand';
import { PlayersList } from './PlayersList';
import { Chat } from './Chat';
import { GameTable } from './GameTable';
import { GamePhase } from '../types/game';

export const GameBoard: React.FC = () => {
  const { room, leaveRoom } = useColyseus();
  const gameState = useGameState();
  const [useNewUI, setUseNewUI] = React.useState(() => {
    return localStorage.getItem('useNewGameUI') === 'true';
  });

  const playerId = room?.sessionId,
    myturn = (playerId === gameState.currentTurnPlayerId);

  if (!room) return null;
  
  const toggleUI = () => {
    const newValue = !useNewUI;
    setUseNewUI(newValue);
    localStorage.setItem('useNewGameUI', newValue.toString());
  };

  // Show different layouts based on UI mode and game phase
  if (useNewUI && gameState.phase === GamePhase.PLAYING) {
    return <GameTable roomId={room.roomId} />;
  }

  return (
    <div className="container mx-auto flex flex-col h-screen bg-base-100 max-w-6xl">
      <div className="navbar bg-base-200 px-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">❤️ Heart of Five 🃏</h1>
        </div>
        <div className="flex-none gap-4">
          <button onClick={toggleUI} className="btn btn-sm btn-ghost">
            {useNewUI ? 'Classic View' : 'Table View'}
          </button>
          <button onClick={leaveRoom} className="btn btn-error btn-sm">
            Leave Game
          </button>
        </div>
      </div>

      {gameState.phase === GamePhase.WAITING ? (
        <div className="flex flex-col lg:flex-row flex-1 gap-2 p-2">
          <div className="flex-1 flex flex-col gap-2 order-1 lg:order-1">
            <WaitingRoom roomId={room?.roomId || ''} onStartGame={gameState.startGame} />
            <div className="card bg-base-200 hidden lg:block">
              <PlayersList 
                players={room.state?.players || new Map()} 
                currentTurnPlayerId={gameState.currentTurnPlayerId}
                leadPlayerId={gameState.leadPlayerId}
                myPlayerId={room.sessionId}
              />
            </div>
          </div>
          <div className="w-full lg:w-80 card bg-base-200 order-2 lg:order-2 min-h-[300px] lg:min-h-0">
            <Chat 
              messages={gameState.chatMessages}
              myPlayerId={room.sessionId}
              onSendMessage={gameState.sendChatMessage}
            />
          </div>
          <div className="card bg-base-200 lg:hidden order-3">
            <PlayersList 
              players={room.state?.players || new Map()} 
              currentTurnPlayerId={gameState.currentTurnPlayerId}
              leadPlayerId={gameState.leadPlayerId}
              myPlayerId={room.sessionId}
            />
          </div>
        </div>
      ) : gameState.phase === GamePhase.ROUND_END || gameState.phase === GamePhase.GAME_END ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <div className="card bg-base-200 p-8">
            <h2 className="text-3xl font-bold text-center mb-4">
              {gameState.phase === GamePhase.ROUND_END ? 'Round Complete!' : 'Game Over!'}
            </h2>
            
            <PlayersList 
              players={room.state?.players || new Map()} 
              currentTurnPlayerId={null}
              leadPlayerId={null}
              myPlayerId={room.sessionId}
            />
            
            <div className="mt-6 text-center">
              {gameState.phase === GamePhase.ROUND_END ? (
                <button 
                  onClick={gameState.startGame} 
                  className="btn btn-primary btn-lg"
                >
                  Start Next Round
                </button>
              ) : (
                <div className="space-y-4">
                  <p className="text-xl">Thanks for playing!</p>
                  <button 
                    onClick={leaveRoom} 
                    className="btn btn-error"
                  >
                    Leave Game
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-col lg:flex-row flex-1 gap-2 p-2 overflow-hidden">
            <div className="w-full lg:w-48 h-auto lg:h-full card bg-base-200 overflow-hidden order-2 lg:order-1">
              <PlayersList 
                players={room.state?.players || new Map()} 
                currentTurnPlayerId={gameState.currentTurnPlayerId}
                leadPlayerId={gameState.leadPlayerId}
                myPlayerId={room.sessionId}
              />
            </div>
            
            <div className="card bg-base-200 flex-1 overflow-hidden order-1 lg:order-2">
              <Chat 
                messages={gameState.chatMessages}
                myPlayerId={room.sessionId}
                onSendMessage={gameState.sendChatMessage}
              >
                <PlayerHand 
                  cards={gameState.myHand}
                  selectedCards={gameState.selectedCards}
                  onCardClick={gameState.toggleCardSelection}
                  isMyTurn={gameState.isMyTurn}
                  onPlayCards={gameState.playCards}
                  onPass={gameState.pass}
                  currentMeld={gameState.currentMeld}
                  isLeader={gameState.leadPlayerId === room.sessionId}
                  lastError={gameState.lastError}
                  consecutivePasses={gameState.consecutivePasses}
                />
              </Chat>
            </div>
          </div>
        </div>
      )}
      { false && 
      <details className="collapse bg-base-200 mx-2 mb-2  overflow-scroll">
        <summary className="collapse-title text-xs font-medium cursor-pointer">Debug Info</summary>
        <div className="collapse-content">
          <pre className="bg-base-300 text-xs p-2 rounded">{
              `Player ID: ${playerId}\n` +
              `Is My Turn: ${myturn}\n` +
              `Game Phase: ${gameState.phase}\n` +
              `Current Round: ${gameState.currentRound}`
          }</pre>
          <pre className="bg-base-300 text-xs p-2 rounded mt-2">{
              JSON.stringify(room, null, 2)
          }</pre>
          <pre className="bg-base-300 text-xs p-2 rounded mt-2">{
              JSON.stringify(room?.state, null, 2)
          }</pre>
        </div>
      </details>
      }
    </div>
  );
};

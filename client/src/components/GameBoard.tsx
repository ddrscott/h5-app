import React from 'react';
import { useColyseus } from '../contexts/ColyseusContext';
import { useGameState } from '../hooks/useGameState';
import { WaitingRoom } from './WaitingRoom';
import { PlayingArea } from './PlayingArea';
import { PlayerHand } from './PlayerHand';
import { PlayersList } from './PlayersList';
import { GamePhase } from '../types/game';

export const GameBoard: React.FC = () => {
  const { room, leaveRoom } = useColyseus();
  const gameState = useGameState();

  const playerId = room?.sessionId,
    myturn = (playerId === gameState.currentTurnPlayerId);

  if (!room) return null;

  return (
    <div className="game-board">
      <div className="game-header">
        <h1>❤️ Heart of Five 🃏</h1>
        <div className="game-info">
          <span>Round: {gameState.currentRound}</span>
          <span>Phase: {gameState.phase}</span>
          <span>Room: {room ? room.roomId : 'Loading...'}</span>
          <button onClick={leaveRoom} className="leave-button">
            Leave Game
          </button>
        </div>
      </div>

      {gameState.phase === GamePhase.WAITING ? (
        <WaitingRoom roomId={room?.roomId || ''} onStartGame={gameState.startGame} />
      ) : (
        <div className="game-content">
          <PlayersList 
            players={room.state.players} 
            currentTurnPlayerId={gameState.currentTurnPlayerId}
            myPlayerId={room.sessionId}
          />
          
          <PlayingArea 
            currentMeld={gameState.currentMeld}
            isMyTurn={gameState.isMyTurn}
            currentTurnPlayerId={gameState.currentTurnPlayerId}
            players={gameState.players}
          />
          
          <PlayerHand 
            cards={gameState.myHand}
            selectedCards={gameState.selectedCards}
            onCardClick={gameState.toggleCardSelection}
            isMyTurn={gameState.isMyTurn}
            onPlayCards={gameState.playCards}
            onPass={gameState.pass}
          />
        </div>
      )}
        <pre style={{'marginTop': '3em', 'background': 'black', 'color': 'white'}}>{
            `Player ID: ${playerId}\n` +
            `Is My Turn: ${myturn}\n` +
            `Game Phase: ${gameState.phase}\n` +
            `Current Round: ${gameState.currentRound}`
        }</pre>
        <pre style={{'marginTop': '3em', 'background': 'black', 'color': 'white'}}>{
            JSON.stringify(room, null, 2)
        }</pre>
        <pre style={{'marginTop': '3em', 'background': 'black', 'color': 'white'}}>{
            JSON.stringify(room?.state, null, 2)
        }</pre>
    </div>
  );
};

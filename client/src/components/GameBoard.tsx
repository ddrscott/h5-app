import React from 'react';
import { useColyseus } from '../contexts/ColyseusContext';
import { useGameState } from '../hooks/useGameState';
import { WaitingRoom } from './WaitingRoom';
import { PlayingArea } from './PlayingArea';
import { PlayerHand } from './PlayerHand';
import { PlayersList } from './PlayersList';
import { Chat } from './Chat';
import { GamePhase } from '../types/game';

export const GameBoard: React.FC = () => {
  const { room, leaveRoom } = useColyseus();
  const gameState = useGameState();

  const playerId = room?.sessionId,
    myturn = (playerId === gameState.currentTurnPlayerId);

  if (!room) return null;

  return (
    <div className="game-board-new">
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
        <div className="waiting-room-container">
          <div className="waiting-room-main">
            <WaitingRoom roomId={room?.roomId || ''} onStartGame={gameState.startGame} />
            <div className="waiting-players-section">
              <PlayersList 
                players={room.state?.players || new Map()} 
                currentTurnPlayerId={gameState.currentTurnPlayerId}
                leadPlayerId={gameState.leadPlayerId}
                myPlayerId={room.sessionId}
              />
            </div>
          </div>
          <div className="waiting-chat-section">
            <Chat 
              messages={gameState.chatMessages}
              myPlayerId={room.sessionId}
              onSendMessage={gameState.sendChatMessage}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="game-main-area">
            <div className="players-section">
              <PlayersList 
                players={room.state?.players || new Map()} 
                currentTurnPlayerId={gameState.currentTurnPlayerId}
                leadPlayerId={gameState.leadPlayerId}
                myPlayerId={room.sessionId}
              />
            </div>
            
            <div className="middle-section">
              <PlayingArea 
                currentMeld={gameState.currentMeld}
                isMyTurn={gameState.isMyTurn}
                currentTurnPlayerId={gameState.currentTurnPlayerId}
                players={gameState.players}
              />
            </div>
            
            <div className="chat-section">
              <Chat 
                messages={gameState.chatMessages}
                myPlayerId={room.sessionId}
                onSendMessage={gameState.sendChatMessage}
              />
            </div>
          </div>
          
          <div className="player-hand-section">
            <PlayerHand 
              cards={gameState.myHand}
              selectedCards={gameState.selectedCards}
              onCardClick={gameState.toggleCardSelection}
              isMyTurn={gameState.isMyTurn}
              onPlayCards={gameState.playCards}
              onPass={gameState.pass}
            />
          </div>
        </>
      )}
      <details style={{marginTop: '20px', padding: '0 20px 20px'}}>
        <summary>Debug Info</summary>
        <pre style={{'background': 'black', 'color': 'white', 'padding': '10px', 'marginTop': '10px'}}>{
            `Player ID: ${playerId}\n` +
            `Is My Turn: ${myturn}\n` +
            `Game Phase: ${gameState.phase}\n` +
            `Current Round: ${gameState.currentRound}`
        }</pre>
        <pre style={{'background': 'black', 'color': 'white', 'padding': '10px', 'marginTop': '10px', 'maxHeight': '200px', 'overflow': 'auto'}}>{
            JSON.stringify(room, null, 2)
        }</pre>
        <pre style={{'background': 'black', 'color': 'white', 'padding': '10px', 'marginTop': '10px', 'maxHeight': '200px', 'overflow': 'auto'}}>{
            JSON.stringify(room?.state, null, 2)
        }</pre>
      </details>
    </div>
  );
};

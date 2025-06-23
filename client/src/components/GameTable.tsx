import React, { useState } from 'react';
import { useColyseus } from '../contexts/ColyseusContext';
import { useGameState } from '../hooks/useGameState';
import { Card } from '../types/game';
import './GameTable.css';

interface GameTableProps {
  roomId: string;
}

export const GameTable: React.FC<GameTableProps> = ({ roomId }) => {
  const { room } = useColyseus();
  const gameState = useGameState();
  
  if (!room || !room.state) {
    return <div>Loading...</div>;
  }

  const userId = room.sessionId;
  const state = room.state as any; // TODO: Update client GameState type to match server
  const currentPlayer = state.players.get(userId);
  const playerHand = gameState.myHand || [];
  
  // Debug logging
  console.log('GameTable render:', { playerHand, gameState });
  
  // Get other players for positioning around table
  const otherPlayers = Array.from(state.players.entries())
    .filter(([id]) => id !== userId)
    .map(([id, player]) => ({ id, player }));

  try {
    return (
      <div className="game-table">
        {/* Green felt background */}
        <div className="table-surface">
        {/* Deck pile */}
        <div className="deck-area">
          <div className="card card-back" />
          <div className="deck-count">{state.deck?.length || 0}</div>
        </div>

        {/* Discard pile */}
        <div className="discard-area">
          {state.discardPile && state.discardPile.length > 0 && (() => {
            const lastCard = state.discardPile[state.discardPile.length - 1];
            if (!lastCard) return null;
            return (
              <div className={`card ${getSuitClass(lastCard.suit)}`}>
                <div className="card-value">{getCardDisplay(lastCard)}</div>
              </div>
            );
          })()}
        </div>

        {/* Current meld area */}
        <div className="meld-area">
          {state.currentMeld && state.currentMeld.cards && state.currentMeld.cards.length > 0 && (
            <div className="current-meld">
              <div className="meld-label">Current Play</div>
              <div className="meld-cards">
                {state.currentMeld.cards.map((card, index) => {
                  if (!card) return null;
                  return (
                    <div 
                      key={`${card.suit}-${card.rank}-${index}`}
                      className={`card ${getSuitClass(card.suit)}`}
                      style={{ transform: `translateX(${index * 30}px)` }}
                    >
                      <div className="card-value">{getCardDisplay(card)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Opponent areas */}
        {otherPlayers.map((opponent, index) => {
          const isTheirTurn = gameState.currentTurnPlayerId === opponent.id;
          const isLeader = gameState.leadPlayerId === opponent.id;
          
          return (
            <div 
              key={opponent.id} 
              className={`opponent-area opponent-${index + 1} ${isTheirTurn ? 'active-turn' : ''}`}
            >
              <div className="opponent-info">
                <div className="opponent-name">
                  {isLeader && '👑 '}
                  {opponent.player.name}
                  {isTheirTurn && ' 🎯'}
                </div>
                <div className="opponent-cards">{opponent.player.handCount} cards</div>
              </div>
              <div className="opponent-hand">
                {Array.from({ length: Math.min(opponent.player.handCount, 7) }).map((_, i) => (
                  <div 
                    key={i} 
                    className="card card-back opponent-card"
                    style={{ transform: `translateX(${i * 15}px)` }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Player hand area */}
      <div className="player-hand-area">
        <div className="player-hand">
          {playerHand.map((card, index) => {
            if (!card || !card.suit || card.rank === undefined) {
              console.error('Invalid card:', card);
              return null;
            }
            
            const cardKey = `${card.suit}-${card.rank}`;
            const isSelected = gameState.selectedCards.has(cardKey);
            const rotation = (index - playerHand.length / 2) * 5;
            
            return (
              <div
                key={`${cardKey}-${index}`}
                className={`card player-card ${getSuitClass(card.suit)} ${isSelected ? 'selected' : ''}`}
                onClick={() => gameState.toggleCardSelection(cardKey)}
                style={{
                  transform: `rotate(${rotation}deg) ${isSelected ? 'translateY(-30px)' : ''}`,
                  transformOrigin: 'bottom center',
                  zIndex: index
                }}
              >
                <div className="card-value">{getCardDisplay(card)}</div>
              </div>
            );
          })}
        </div>
        
        {/* Action buttons */}
        {gameState.isMyTurn && (
          <div className="player-actions">
            <button 
              className="action-button play-button"
              onClick={() => gameState.playCards()}
              disabled={gameState.selectedCards.size === 0}
            >
              Play Cards
            </button>
            <button 
              className="action-button pass-button"
              onClick={() => gameState.pass()}
              disabled={gameState.leadPlayerId === userId && !gameState.currentMeld}
            >
              Pass
            </button>
          </div>
        )}
      </div>

      {/* Score display */}
      <div className="score-display">
        <div className="score-title">Scores</div>
        {Array.from(state.players.entries()).map(([id, player]) => (
          <div key={id} className="score-item">
            <span className="score-name">{player.name}</span>
            <span className="score-value">{player.wins}W / {player.losses}L</span>
          </div>
        ))}
      </div>

      {/* Game controls */}
      <div className="game-controls">
        <button 
          className="control-button menu-button"
          onClick={() => {
            localStorage.setItem('useNewGameUI', 'false');
            window.location.reload();
          }}
          title="Switch to Classic View"
        >
          🎴
        </button>
        <button className="control-button chat-button">💬</button>
      </div>
    </div>
  );
  } catch (error) {
    console.error('GameTable error:', error);
    return (
      <div className="game-table">
        <div style={{ padding: '20px', color: 'white', background: 'red' }}>
          Error rendering game table: {error?.toString()}
        </div>
      </div>
    );
  }
};

// Helper functions
function getSuitClass(suit: string): string {
  const suitClasses: { [key: string]: string } = {
    'H': 'suit-hearts',
    'D': 'suit-diamonds',
    'C': 'suit-clubs',
    'S': 'suit-spades'
  };
  return suitClasses[suit] || '';
}

function getCardDisplay(card: Card): string {
  if (!card || card.rank === undefined || !card.suit) {
    console.error('Invalid card passed to getCardDisplay:', card);
    return '??';
  }
  
  const rankDisplay = card.rank === 14 ? 'A' : 
                      card.rank === 13 ? 'K' :
                      card.rank === 12 ? 'Q' :
                      card.rank === 11 ? 'J' :
                      card.rank.toString();
  
  const suitSymbols: { [key: string]: string } = {
    'H': '♥',
    'D': '♦',
    'C': '♣',
    'S': '♠',
    'J': '🃏' // Joker
  };
  
  return `${rankDisplay}${suitSymbols[card.suit] || ''}`;
}
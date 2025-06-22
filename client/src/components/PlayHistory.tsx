import React from 'react';

export interface GameEvent {
  id: string;
  type: 'meld_played' | 'player_passed' | 'new_leader' | 'round_ended' | 'game_started' | 'player_joined' | 'player_left';
  playerId?: string;
  playerName?: string;
  message: string;
  timestamp: number;
}

interface PlayHistoryProps {
  events: GameEvent[];
}

export const PlayHistory: React.FC<PlayHistoryProps> = ({ events }) => {
  const getEventIcon = (type: GameEvent['type']) => {
    switch (type) {
      case 'meld_played': return '🃏';
      case 'player_passed': return '⏭️';
      case 'new_leader': return '👑';
      case 'round_ended': return '🏆';
      case 'game_started': return '🎮';
      case 'player_joined': return '👋';
      case 'player_left': return '🚪';
      default: return '📝';
    }
  };

  const getEventClassName = (type: GameEvent['type']) => {
    switch (type) {
      case 'meld_played': return 'event-meld';
      case 'player_passed': return 'event-pass';
      case 'new_leader': return 'event-leader';
      case 'round_ended': return 'event-round';
      case 'game_started': return 'event-game';
      case 'player_joined': return 'event-join';
      case 'player_left': return 'event-leave';
      default: return '';
    }
  };

  return (
    <div className="play-history">
      <h3>Game Events</h3>
      <div className="history-events">
        {events.slice(-20).reverse().map((event) => (
          <div 
            key={event.id} 
            className={`history-event ${getEventClassName(event.type)}`}
          >
            <span className="event-icon">{getEventIcon(event.type)}</span>
            <span className="event-message">{event.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
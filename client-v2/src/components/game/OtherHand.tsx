import React from 'react';
import type { Player } from '../../types/game';
import { Card } from '../ui/Card';

interface OtherHandProps {
  opponent: {
    id: string;
    player: Player;
  };
  position: React.CSSProperties;
  isCurrentTurn: boolean;
  isLeader: boolean;
}

export const OtherHand: React.FC<OtherHandProps> = ({
  opponent,
  position,
  isCurrentTurn,
  isLeader
}) => {
  return (
    <div
      className="absolute flex flex-col items-center"
      style={position}
    >
      {/* Player info */}
      <div className={`
        bg-gray-800/90 rounded-lg px-3 py-2 mb-1 transition-all duration-300
        ${isCurrentTurn ? 'ring-2 ring-gold shadow-glow' : ''}
      `}>
        <p className="text-xs font-medium text-center">
          {isLeader && '👑 '}
          {opponent.player.name}
          <span className="font-bold ml-1">({opponent.player.wins}-{opponent.player.losses})</span>
          {isCurrentTurn && ' 🎯'}
        </p>
      </div>
      
      {/* Card stack - only showing top portion */}
      <div className="flex -space-x-12 justify-center">
        {Array.from({ length: Math.min(opponent.player.handCount, 13) }).map((_, i) => (
          <div key={i} className="relative h-12 w-8">
            <Card 
              suit="" 
              rank={0} 
              isBack 
              className="absolute inset-0 w-full h-full"
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-1">{opponent.player.handCount} cards</p>
    </div>
  );
};
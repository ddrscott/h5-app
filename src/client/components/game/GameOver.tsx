import React from 'react';
import { DialogBox } from '../ui/DialogBox';

interface GameOverProps {
  winner: {
    name: string;
    wins: number;
  };
  finalStandings: {
    playerId: string;
    name: string;
    wins: number;
    losses: number;
  }[];
  onPlayAgain: () => void;
  onLeaveGame: () => void;
}

export const GameOver: React.FC<GameOverProps> = ({ winner, finalStandings, onPlayAgain, onLeaveGame }) => {
  return (
    <DialogBox className="max-w-md w-full mx-8">
      {/* Winner Announcement */}
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold mb-2 text-gold">Game Over!</h1>
        <p className="text-lg text-gray-300">
          {winner.name} wins this game!
        </p>
      </div>

      {/* Session Stats */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 text-center text-gray-200">Session Stats</h2>
        <div className="bg-gray-700 rounded p-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-600 text-gray-400">
                <th className="text-left py-2 font-medium">Rank</th>
                <th className="text-left py-2 font-medium">Player</th>
                <th className="text-right py-2 font-medium">Wins</th>
                <th className="text-right py-2 font-medium">Losses</th>
              </tr>
            </thead>
            <tbody>
              {finalStandings.map((player, index) => (
                <tr 
                  key={player.playerId} 
                  className={`border-b border-gray-600/50 ${
                    player.name === winner.name 
                      ? 'text-gold' 
                      : 'text-gray-300'
                  }`}
                >
                  <td className="py-2">
                    {index === 0 && '🥇'}
                    {index === 1 && '🥈'}
                    {index === 2 && '🥉'}
                    {index > 2 && `${index + 1}.`}
                  </td>
                  <td className="py-2 font-medium">{player.name}</td>
                  <td className="text-right py-2 font-semibold">{player.wins}</td>
                  <td className="text-right py-2 text-gray-400">{player.losses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={onLeaveGame}
          className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
        >
          Leave Game
        </button>
        <button
          onClick={onPlayAgain}
          className="btn-primary"
        >
          Play Again
        </button>
      </div>
    </DialogBox>
  );
};
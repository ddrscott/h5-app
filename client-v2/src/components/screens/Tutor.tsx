import React, { useState } from 'react';
import { Card } from '../ui/Card';

interface TutorProps {
  onClose: () => void;
}

export const Tutor: React.FC<TutorProps> = ({ onClose }) => {
  const [currentPage, setCurrentPage] = useState(0);

  const tutorialPages = [
    {
      title: "Welcome to Heart of Five!",
      content: (
        <div className="space-y-4">
          <p>Heart of Five (红心五) is a strategic card game where the goal is to be the first player to get rid of all your cards.</p>
          <div className="flex justify-center space-x-2">
            <Card suit="H" rank={5} className="scale-75" />
            <Card suit="H" rank={6} className="scale-75" />
            <Card suit="H" rank={7} className="scale-75" />
          </div>
          <p className="text-sm text-gray-400">The heart 5 is the most powerful card in the game!</p>
        </div>
      )
    },
    {
      title: "Game Basics",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-bold text-gold">Players & Cards</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>2-6 players can play</li>
              <li>Uses a standard 52-card deck</li>
              <li>Cards are dealt evenly to all players</li>
              <li>First player to run out of cards wins!</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-gold">Card Rankings</h3>
            <p className="text-sm">From lowest to highest: 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2</p>
            <p className="text-sm text-yellow-400">Special: The Heart 5 (♥5) beats everything!</p>
          </div>
        </div>
      )
    },
    {
      title: "Basic Hand Types",
      content: (
        <div className="space-y-4">
          <p className="text-sm">You can play these combinations:</p>
          <div className="space-y-3">
            <div>
              <p className="font-bold text-gold">Singles</p>
              <div className="flex justify-center">
                <Card suit="S" rank={7} className="scale-50" />
              </div>
              <p className="text-xs text-gray-400 text-center">Any single card</p>
            </div>
            <div>
              <p className="font-bold text-gold">Pairs</p>
              <div className="flex justify-center space-x-1">
                <Card suit="H" rank={8} className="scale-50" />
                <Card suit="D" rank={8} className="scale-50" />
              </div>
              <p className="text-xs text-gray-400 text-center">Two cards of the same rank</p>
            </div>
            <div>
              <p className="font-bold text-gold">Triplets (Three of a Kind)</p>
              <div className="flex justify-center space-x-1">
                <Card suit="C" rank={9} className="scale-50" />
                <Card suit="H" rank={9} className="scale-50" />
                <Card suit="S" rank={9} className="scale-50" />
              </div>
              <p className="text-xs text-gray-400 text-center">Three cards of the same rank</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Straights and Sequences",
      content: (
        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <p className="font-bold text-gold">Straight (5+ cards)</p>
              <div className="flex justify-center space-x-1">
                <Card suit="S" rank={5} className="scale-50" />
                <Card suit="H" rank={6} className="scale-50" />
                <Card suit="D" rank={7} className="scale-50" />
                <Card suit="C" rank={8} className="scale-50" />
                <Card suit="S" rank={9} className="scale-50" />
              </div>
              <p className="text-xs text-gray-400 text-center">5 or more consecutive cards (2 cannot be used)</p>
            </div>
            <div>
              <p className="font-bold text-gold">Pair Sequence (2+ pairs)</p>
              <div className="flex justify-center space-x-1">
                <Card suit="C" rank={8} className="scale-50" />
                <Card suit="S" rank={8} className="scale-50" />
                <Card suit="H" rank={9} className="scale-50" />
                <Card suit="D" rank={9} className="scale-50" />
              </div>
              <p className="text-xs text-gray-400 text-center">2 or more consecutive pairs</p>
            </div>
            <div>
              <p className="font-bold text-gold">Triplet Sequence (2+ triplets)</p>
              <div className="flex justify-center space-x-1">
                <Card suit="H" rank={10} className="scale-50" />
                <Card suit="D" rank={10} className="scale-50" />
                <Card suit="C" rank={10} className="scale-50" />
                <Card suit="S" rank={11} className="scale-50" />
                <Card suit="H" rank={11} className="scale-50" />
                <Card suit="C" rank={11} className="scale-50" />
              </div>
              <p className="text-xs text-gray-400 text-center">2 or more consecutive triplets</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Special Hands - Bombs! 💣",
      content: (
        <div className="space-y-4">
          <div className="p-3 bg-red-900/30 border border-red-600/50 rounded-lg mb-4">
            <p className="text-sm text-red-300">🔥 Bombs are special hands that can beat any regular combination!</p>
          </div>
          <div className="space-y-4">
            <div>
              <p className="font-bold text-red-400">Four of a Kind (Bomb)</p>
              <div className="flex justify-center space-x-1">
                <Card suit="H" rank={13} className="scale-50" />
                <Card suit="D" rank={13} className="scale-50" />
                <Card suit="C" rank={13} className="scale-50" />
                <Card suit="S" rank={13} className="scale-50" />
              </div>
              <p className="text-xs text-gray-400 text-center">Beats any non-bomb combination!</p>
            </div>
            <div>
              <p className="font-bold text-red-400">Straight Flush (Super Bomb)</p>
              <div className="flex justify-center space-x-1">
                <Card suit="H" rank={3} className="scale-50" />
                <Card suit="H" rank={4} className="scale-50" />
                <Card suit="H" rank={5} className="scale-50" />
                <Card suit="H" rank={6} className="scale-50" />
                <Card suit="H" rank={7} className="scale-50" />
              </div>
              <p className="text-xs text-gray-400 text-center">5+ consecutive cards of the same suit - Beats four of a kind!</p>
            </div>
            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
              <p className="text-sm text-yellow-300">💡 Bomb Rules:</p>
              <ul className="text-xs text-gray-300 mt-2 space-y-1">
                <li>• Bombs can be played on any combination</li>
                <li>• A bigger bomb beats a smaller bomb</li>
                <li>• Straight flush beats four of a kind</li>
                <li>• Longer straight flush beats shorter one</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "How to Play",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-bold text-gold">Starting the Game</h3>
            <p className="text-sm">The player with the 3 of Diamonds (♦3) goes first and must play it.</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-gold">Taking Turns</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Play a higher card/combination of the same type</li>
              <li>Or pass if you can't (or don't want to) play</li>
              <li>The Heart 5 (♥5) can beat any single card</li>
              <li>Bombs can beat any regular combination!</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-gold">Leading New Tricks</h3>
            <p className="text-sm">When everyone passes, the last player to play leads the next trick with any valid combination.</p>
          </div>
        </div>
      )
    },
    {
      title: "Strategy Tips",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-bold text-gold">🎯 Pro Tips</h3>
            <ul className="list-disc list-inside text-sm space-y-2">
              <li><span className="text-yellow-400">Save the Heart 5:</span> It's your trump card!</li>
              <li><span className="text-yellow-400">Break up pairs:</span> Sometimes it's better to play singles</li>
              <li><span className="text-yellow-400">Count cards:</span> Track what's been played</li>
              <li><span className="text-yellow-400">Control the lead:</span> Leading lets you choose the combination type</li>
              <li><span className="text-red-400">Save your bombs:</span> Use them strategically to take control</li>
              <li><span className="text-red-400">Watch for bombs:</span> Four of a kind and straight flushes are rare but powerful</li>
            </ul>
          </div>
          <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
            <p className="text-sm text-center">Ready to play? Join a game and have fun!</p>
          </div>
        </div>
      )
    }
  ];

  const nextPage = () => {
    if (currentPage < tutorialPages.length - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-900 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gold">How to Play</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <h3 className="text-lg font-bold mb-4 text-center">
            {tutorialPages[currentPage].title}
          </h3>
          {tutorialPages[currentPage].content}
        </div>

        {/* Navigation */}
        <div className="bg-gray-900 px-6 py-4 flex justify-between items-center">
          <button
            onClick={prevPage}
            disabled={currentPage === 0}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentPage === 0
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            Previous
          </button>

          <div className="flex space-x-2">
            {tutorialPages.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentPage ? 'bg-gold' : 'bg-gray-600'
                }`}
              />
            ))}
          </div>

          {currentPage === tutorialPages.length - 1 ? (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gold hover:bg-gold-dark text-gray-900 font-bold rounded-lg transition-colors"
            >
              Start Playing!
            </button>
          ) : (
            <button
              onClick={nextPage}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

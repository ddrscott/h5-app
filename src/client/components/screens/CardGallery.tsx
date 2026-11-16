import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';

interface CardGalleryProps {
  onClose?: () => void;
}

interface CardInfo {
  suit: 'H' | 'D' | 'C' | 'S' | 'J';
  rank: number;
  isBack?: boolean;
}

export const CardGallery: React.FC<CardGalleryProps> = ({ onClose }) => {
  const [selectedCard, setSelectedCard] = useState<CardInfo | null>(null);
  const [hoveredCard, setHoveredCard] = useState<CardInfo | null>(null);
  
  // Define all suits and ranks in game order (3 is lowest, 2 is highest)
  const suits: Array<'H' | 'D' | 'C' | 'S'> = ['H', 'D', 'C', 'S'];
  // Order: 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2
  const ranks = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 1, 2];

  // Convert game rank values for display
  const getDisplayRank = (rank: number): number => {
    if (rank === 1) return 14; // Ace
    else if (rank === 2) return 15; // 2 is highest
    else return rank; // 3-13 stay the same
  };

  const getRankLabel = (rank: number): string => {
    if (rank === 1) return 'A';
    if (rank === 11) return 'J';
    if (rank === 12) return 'Q';
    if (rank === 13) return 'K';
    return rank.toString();
  };

  const getSuitSymbol = (suit: string): string => {
    const symbols: Record<string, string> = {
      'H': '♥',
      'D': '♦',
      'C': '♣',
      'S': '♠'
    };
    return symbols[suit] || '';
  };

  return (
    <div className="fixed inset-0 felt-texture overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-green-800/95 backdrop-blur-sm p-2 sm:p-4 flex justify-between items-center border-b border-green-700">
        <h1 className="text-lg sm:text-2xl font-bold text-gold">Card Gallery</h1>
        <Link
          to="/"
          className="bg-gray-800/90 hover:bg-gray-700 rounded-full p-2 transition-colors inline-block"
          title="Back to Home"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Link>
      </div>

      {/* Main Content - scrollable on mobile */}
      <div className="p-2 sm:p-4">
        {/* Desktop Layout - Hidden on mobile */}
        <div className="hidden sm:block">
          <div className="max-w-[1400px] mx-auto">
            {/* Cards Grid */}
            <div className="space-y-1">
              {/* Regular Suits */}
              {suits.map((suit) => (
                <div key={suit} className="flex gap-1">
                  {ranks.map((rank) => {
                    const displayRank = getDisplayRank(rank);
                    const cardInfo = { suit, rank: displayRank };
                    const isHovered = hoveredCard?.suit === suit && hoveredCard?.rank === displayRank;
                    const isSelected = selectedCard?.suit === suit && selectedCard?.rank === displayRank;
                    
                    return (
                      <div 
                        key={`${suit}-${rank}`} 
                        className="flex-1 aspect-[7/10] relative"
                        onMouseEnter={() => setHoveredCard(cardInfo)}
                        onMouseLeave={() => setHoveredCard(null)}
                        onClick={() => setSelectedCard(isSelected ? null : cardInfo)}
                      >
                        <Card 
                          suit={suit} 
                          rank={displayRank}
                          className="w-full h-full cursor-pointer absolute inset-0"
                          style={{ opacity: (hoveredCard || selectedCard) && !isHovered && !isSelected ? 0.6 : 1 }}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
              
              {/* Special Cards Row */}
              <div className="flex gap-1">
                <div 
                  className="flex-1 aspect-[7/10] relative"
                  onMouseEnter={() => setHoveredCard({ suit: 'J', rank: 16 })}
                  onMouseLeave={() => setHoveredCard(null)}
                  onClick={() => setSelectedCard(selectedCard?.suit === 'J' && selectedCard?.rank === 16 ? null : { suit: 'J', rank: 16 })}
                >
                  <Card 
                    suit="J" 
                    rank={16}
                    className="w-full h-full cursor-pointer absolute inset-0"
                    style={{ opacity: (hoveredCard || selectedCard) && !(hoveredCard?.suit === 'J' && hoveredCard?.rank === 16) && !(selectedCard?.suit === 'J' && selectedCard?.rank === 16) ? 0.6 : 1 }}
                  />
                </div>
                
                <div 
                  className="flex-1 aspect-[7/10] relative"
                  onMouseEnter={() => setHoveredCard({ suit: 'J', rank: 17 })}
                  onMouseLeave={() => setHoveredCard(null)}
                  onClick={() => setSelectedCard(selectedCard?.suit === 'J' && selectedCard?.rank === 17 ? null : { suit: 'J', rank: 17 })}
                >
                  <Card 
                    suit="J" 
                    rank={17}
                    className="w-full h-full cursor-pointer absolute inset-0"
                    style={{ opacity: (hoveredCard || selectedCard) && !(hoveredCard?.suit === 'J' && hoveredCard?.rank === 17) && !(selectedCard?.suit === 'J' && selectedCard?.rank === 17) ? 0.6 : 1 }}
                  />
                </div>
                
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={`empty-${i}`} className="flex-1"></div>
                ))}
                
                <div 
                  className="flex-1 aspect-[7/10] relative"
                  onMouseEnter={() => setHoveredCard({ suit: 'J', rank: 0, isBack: true })}
                  onMouseLeave={() => setHoveredCard(null)}
                  onClick={() => setSelectedCard(selectedCard?.isBack ? null : { suit: 'J', rank: 0, isBack: true })}
                >
                  <Card 
                    isBack={true}
                    className="w-full h-full cursor-pointer absolute inset-0"
                    style={{ opacity: (hoveredCard || selectedCard) && !hoveredCard?.isBack && !selectedCard?.isBack ? 0.6 : 1 }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Layout - Visible only on mobile */}
        <div className="sm:hidden">
          {/* Show cards in a vertical scrollable list grouped by suit */}
          <div className="space-y-2">
            {suits.map((suit) => (
              <div key={suit}>
                <div className="grid grid-cols-7 gap-1 px-2">
                  {ranks.map((rank) => {
                    const displayRank = getDisplayRank(rank);
                    const cardInfo = { suit, rank: displayRank };
                    const isSelected = selectedCard?.suit === suit && selectedCard?.rank === displayRank;
                    
                    return (
                      <div 
                        key={`${suit}-${rank}`} 
                        className="aspect-[7/10] relative"
                        onClick={() => setSelectedCard(isSelected ? null : cardInfo)}
                      >
                        <Card 
                          suit={suit} 
                          rank={displayRank}
                          className="w-full h-full cursor-pointer absolute inset-0"
                          style={{ opacity: selectedCard && !isSelected ? 0.6 : 1 }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {/* Special Cards */}
            <div>
              <div className="grid grid-cols-7 gap-1 px-2">
                <div 
                  className="aspect-[7/10] relative"
                  onClick={() => setSelectedCard(selectedCard?.suit === 'J' && selectedCard?.rank === 16 ? null : { suit: 'J', rank: 16 })}
                >
                  <Card 
                    suit="J" 
                    rank={16}
                    className="w-full h-full cursor-pointer absolute inset-0"
                    style={{ opacity: selectedCard && !(selectedCard?.suit === 'J' && selectedCard?.rank === 16) ? 0.6 : 1 }}
                  />
                </div>
                
                <div 
                  className="aspect-[7/10] relative"
                  onClick={() => setSelectedCard(selectedCard?.suit === 'J' && selectedCard?.rank === 17 ? null : { suit: 'J', rank: 17 })}
                >
                  <Card 
                    suit="J" 
                    rank={17}
                    className="w-full h-full cursor-pointer absolute inset-0"
                    style={{ opacity: selectedCard && !(selectedCard?.suit === 'J' && selectedCard?.rank === 17) ? 0.6 : 1 }}
                  />
                </div>
                
                <div 
                  className="aspect-[7/10] relative"
                  onClick={() => setSelectedCard(selectedCard?.isBack ? null : { suit: 'J', rank: 0, isBack: true })}
                >
                  <Card 
                    isBack={true}
                    className="w-full h-full cursor-pointer absolute inset-0"
                    style={{ opacity: selectedCard && !selectedCard?.isBack ? 0.6 : 1 }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enlarged Card Preview - Desktop only */}
      {(hoveredCard || selectedCard) && (
        <div className="hidden sm:block fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50">
          <div className="transform scale-[3] drop-shadow-2xl">
            <Card 
              suit={hoveredCard?.suit || selectedCard?.suit || 'H'} 
              rank={hoveredCard?.rank || selectedCard?.rank || 0}
              isBack={hoveredCard?.isBack || selectedCard?.isBack}
              className="shadow-2xl"
            />
          </div>
          {selectedCard && (
            <p className="text-center mt-20 text-sm text-gold bg-gray-900/90 px-3 py-1 rounded">
              Click again to deselect
            </p>
          )}
        </div>
      )}

      {/* Mobile Selected Card Preview */}
      {selectedCard && (
        <div className="sm:hidden fixed inset-x-0 bottom-0 p-4 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700">
          <div className="flex items-center justify-center gap-4">
            <div className="transform scale-[1.5]">
              <Card 
                suit={selectedCard.suit} 
                rank={selectedCard.rank}
                isBack={selectedCard.isBack}
                className="shadow-2xl"
              />
            </div>
            <div className="text-sm text-gold">
              <p>Tap again to deselect</p>
              <p className="text-xs text-gray-400 mt-1">
                {selectedCard.isBack ? 'Card Back' : 
                 `${getRankLabel(selectedCard.rank === 15 ? 2 : selectedCard.rank === 14 ? 1 : selectedCard.rank)} of ${
                   selectedCard.suit === 'H' ? 'Hearts' : 
                   selectedCard.suit === 'D' ? 'Diamonds' : 
                   selectedCard.suit === 'C' ? 'Clubs' : 
                   selectedCard.suit === 'S' ? 'Spades' : 'Joker'
                 }`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
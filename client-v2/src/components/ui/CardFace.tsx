import React from 'react';

interface CardFaceProps {
  suit: 'H' | 'D' | 'C' | 'S' | 'J';
  rank: number;
  className?: string;
  selected?: boolean;
}

const SUIT_SYMBOLS = {
  H: '♥',
  D: '♦',
  C: '♣',
  S: '♠'
};

// Get display value for rank
const getRankDisplay = (rank: number): string => {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return rank.toString();
};

// Get suit color
const getSuitColor = (suit: 'H' | 'D' | 'C' | 'S'): string => {
  return suit === 'H' || suit === 'D' ? 'var(--card-red)' : '#000000';
};

export const CardFace: React.FC<CardFaceProps> = React.memo(({ suit, rank, className = '', selected = false }) => {
  const rankDisplay = getRankDisplay(rank);
  const isSpecialCard = suit === 'H' && rank === 5; // Heart 5 is special
  const suitColor = isSpecialCard ? '#fbbf24' : getSuitColor(suit);

  // Handle Joker cards
  if (suit === 'J') {
    const isBlackJoker = rank === 16;
    const jokerColor = isBlackJoker ? '#000000' : 'var(--card-red)';
    
    return (
      <div className={`card-base ${className}`} style={isBlackJoker ? { filter: 'grayscale(100%)' } : undefined}>
        <svg
          viewBox="0 0 70 100"
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Card background */}
          <rect 
            width="70" 
            height="100" 
            rx="4" 
            fill={isBlackJoker ? '#f5f5f5' : 'white'} 
            stroke={selected ? '#ffd700' : 'none'}
            strokeWidth={selected ? '4' : '0'}
          />
          
          {/* Top left Joker text - vertically stacked */}
          <g transform="translate(4, 5)">
            <text
              x="0"
              y="9"
              fill={jokerColor}
              fontSize="10"
              fontWeight="bold"
              fontFamily="Arial, sans-serif"
            >
              J
            </text>
            <text
              x="0"
              y="16"
              fill={jokerColor}
              fontSize="7"
              fontWeight="bold"
              fontFamily="Arial, sans-serif"
            >
              O
            </text>
            <text
              x="0"
              y="22"
              fill={jokerColor}
              fontSize="7"
              fontWeight="bold"
              fontFamily="Arial, sans-serif"
            >
              K
            </text>
            <text
              x="0"
              y="28"
              fill={jokerColor}
              fontSize="7"
              fontWeight="bold"
              fontFamily="Arial, sans-serif"
            >
              E
            </text>
            <text
              x="0"
              y="34"
              fill={jokerColor}
              fontSize="7"
              fontWeight="bold"
              fontFamily="Arial, sans-serif"
            >
              R
            </text>
            <text
              x="8"
              y="8"
              fill={jokerColor}
              fontSize="6"
              fontWeight="bold"
              fontFamily="Arial, sans-serif"
            >
              {isBlackJoker ? 'small' : 'BIG'}
            </text>
          </g>
          
          {/* Top right - skip this corner */}
          
          {/* Bottom left - skip this corner */}
          
          {/* Bottom right Joker text (rotated) - vertically stacked */}
          <g transform="translate(66, 95) rotate(180)">
            <text
              x="0"
              y="8"
              fill={jokerColor}
              fontSize="10"
              fontWeight="bold"
              fontFamily="Arial, sans-serif"
            >
              J
            </text>
            <text
              x="0"
              y="16"
              fill={jokerColor}
              fontSize="7"
              fontWeight="bold"
              fontFamily="Arial, sans-serif"
            >
              O
            </text>
            <text
              x="0"
              y="22"
              fill={jokerColor}
              fontSize="7"
              fontWeight="bold"
              fontFamily="Arial, sans-serif"
            >
              K
            </text>
            <text
              x="0"
              y="28"
              fill={jokerColor}
              fontSize="7"
              fontWeight="bold"
              fontFamily="Arial, sans-serif"
            >
              E
            </text>
            <text
              x="0"
              y="34"
              fill={jokerColor}
              fontSize="7"
              fontWeight="bold"
              fontFamily="Arial, sans-serif"
            >
              R
            </text>
            <text
              x="8"
              y="8"
              fill={jokerColor}
              fontSize="6"
              fontWeight="bold"
              fontFamily="Arial, sans-serif"
            >
              {isBlackJoker ? 'small' : 'BIG'}
            </text>
          </g>
          
          {/* Center symbol */}
          <text
            x="35"
            y="55"
            fontSize="30"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            🎭
          </text>
          
        </svg>
      </div>
    );
  }

  const suitSymbol = SUIT_SYMBOLS[suit];

  return (
    <div className={`card-base ${className}`}>
      <svg
        viewBox="0 0 70 100"
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Card background */}
        <rect 
          width="70" 
          height="100" 
          rx="4" 
          fill={isSpecialCard ? "#374151" : "white"} 
          stroke={selected ? '#ffd700' : 'none'}
          strokeWidth={selected ? '4' : '0'}
        />
        
        
        {/* Top left rank and suit */}
        <g transform="translate(5, 5)">
          <text
            x="0"
            y="12"
            fill={suitColor}
            fontSize="14"
            fontWeight="bold"
            fontFamily="Arial, sans-serif"
          >
            {rankDisplay}
          </text>
          <text
            x="0"
            y="22"
            fill={suitColor}
            fontSize="10"
            fontFamily="Arial, sans-serif"
          >
            {suitSymbol}
          </text>
        </g>
        
        {/* Bottom right rank and suit (rotated) */}
        <g transform="translate(65, 95) rotate(180)">
          <text
            x="0"
            y="12"
            fill={suitColor}
            fontSize="14"
            fontWeight="bold"
            fontFamily="Arial, sans-serif"
          >
            {rankDisplay}
          </text>
          <text
            x="0"
            y="22"
            fill={suitColor}
            fontSize="10"
            fontFamily="Arial, sans-serif"
          >
            {suitSymbol}
          </text>
        </g>
        
        {/* Center suit symbol(s) */}
        {rank === 1 && (
          // Ace - single large center symbol
          <g transform="translate(35, 50)">
            <text
              x="0"
              y="0"
              fill={suitColor}
              fontSize="30"
              fontFamily="Arial, sans-serif"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {suitSymbol}
            </text>
          </g>
        )}
        
        {rank >= 2 && rank <= 10 && (
          // Number cards - arrange suit symbols
          <g>
            {getNumberCardLayout(rank).map((pos, index) => (
              <g key={index} transform={`translate(${pos.x}, ${pos.y}) ${pos.rotate ? 'rotate(180)' : ''}`}>
                <text
                  x="0"
                  y="0"
                  fill={suitColor}
                  fontSize="16"
                  fontFamily="Arial, sans-serif"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {suitSymbol}
                </text>
              </g>
            ))}
          </g>
        )}
        
        {rank >= 11 && rank <= 13 && (
          // Face cards - large center letter
          <text
            x="35"
            y="60"
            fill={suitColor}
            fontSize="40"
            fontWeight="bold"
            fontFamily="Georgia, serif"
            textAnchor="middle"
          >
            {rankDisplay}
          </text>
        )}
      </svg>
    </div>
  );
});

CardFace.displayName = 'CardFace';

// Helper function to get suit positions for number cards
function getNumberCardLayout(rank: number): Array<{x: number, y: number, rotate?: boolean}> {
  const layouts: Record<number, Array<{x: number, y: number, rotate?: boolean}>> = {
    2: [
      {x: 35, y: 25},
      {x: 35, y: 75, rotate: true}
    ],
    3: [
      {x: 35, y: 25},
      {x: 35, y: 50},
      {x: 35, y: 75, rotate: true}
    ],
    4: [
      {x: 25, y: 25},
      {x: 45, y: 25},
      {x: 25, y: 75, rotate: true},
      {x: 45, y: 75, rotate: true}
    ],
    5: [
      {x: 25, y: 25},
      {x: 45, y: 25},
      {x: 35, y: 50},
      {x: 25, y: 75, rotate: true},
      {x: 45, y: 75, rotate: true}
    ],
    6: [
      {x: 25, y: 25},
      {x: 45, y: 25},
      {x: 25, y: 50},
      {x: 45, y: 50},
      {x: 25, y: 75, rotate: true},
      {x: 45, y: 75, rotate: true}
    ],
    7: [
      {x: 25, y: 25},
      {x: 45, y: 25},
      {x: 35, y: 37.5},
      {x: 25, y: 50},
      {x: 45, y: 50},
      {x: 25, y: 75, rotate: true},
      {x: 45, y: 75, rotate: true}
    ],
    8: [
      {x: 25, y: 25},
      {x: 45, y: 25},
      {x: 35, y: 37.5},
      {x: 25, y: 50},
      {x: 45, y: 50},
      {x: 35, y: 62.5, rotate: true},
      {x: 25, y: 75, rotate: true},
      {x: 45, y: 75, rotate: true}
    ],
    9: [
      {x: 25, y: 20},
      {x: 45, y: 20},
      {x: 25, y: 40},
      {x: 45, y: 40},
      {x: 35, y: 50},
      {x: 25, y: 60, rotate: true},
      {x: 45, y: 60, rotate: true},
      {x: 25, y: 80, rotate: true},
      {x: 45, y: 80, rotate: true}
    ],
    10: [
      {x: 25, y: 20},
      {x: 45, y: 20},
      {x: 35, y: 30},
      {x: 25, y: 40},
      {x: 45, y: 40},
      {x: 25, y: 60, rotate: true},
      {x: 45, y: 60, rotate: true},
      {x: 35, y: 70, rotate: true},
      {x: 25, y: 80, rotate: true},
      {x: 45, y: 80, rotate: true}
    ]
  };
  
  return layouts[rank] || [];
}

import React from 'react';
import { Card } from './Card';

interface BannerProps {
  className?: string;
}

export const Banner: React.FC<BannerProps> = ({ className = '' }) => {
    return (
      <div className={className}>
        {/* Decorative cards */}
        <div className="flex justify-center mb-1 sm:mb-2 space-x-1">
          <Card suit="H" rank={5} className="transform -rotate-12 scale-[0.4] sm:scale-50" />
          <Card suit="H" rank={5} className="transform rotate-6 scale-[0.4] sm:scale-50" />
          <Card suit="H" rank={5} className="transform -rotate-6 scale-[0.4] sm:scale-50" />
          <Card suit="H" rank={5} className="transform rotate-12 scale-[0.4] sm:scale-50" />
        </div>

        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-bold text-center mb-1 text-gold">
          Heart of Five
        </h1>
        <p className="text-center text-gray-300 mb-2 sm:mb-4 text-lg sm:text-xl">
          红心五
        </p>
      </div>
    )
}

import React from 'react';
import { Card } from './Card';

interface BannerProps {
  className?: string;
}

export const Banner: React.FC<BannerProps> = ({ className = '' }) => {
    return (
      <div className={className}>
        {/* Decorative cards */}
        <div className="flex justify-center mb-4 space-x-2">
          <Card suit="H" rank={5} className="transform -rotate-12 scale-75" />
          <Card suit="H" rank={5} className="transform rotate-6 scale-75" />
          <Card suit="H" rank={5} className="transform -rotate-6 scale-75" />
          <Card suit="H" rank={5} className="transform rotate-12 scale-75" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-center mb-2 text-gold">
          Heart of Five
        </h1>
        <p className="text-center text-gray-300 mb-6 text-2xl">
          红心五
        </p>
      </div>
    )
}

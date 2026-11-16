import React from 'react';
import { Card } from './Card';

interface HeartOfFiveDisplayProps {
  className?: string;
  cardClassName?: string;
  showTitle?: boolean;
  titleClassName?: string;
}

export const HeartOfFiveDisplay: React.FC<HeartOfFiveDisplayProps> = ({ 
  className = '',
  cardClassName = 'transform scale-75',
  showTitle = true,
  titleClassName = ''
}) => {
  return (
    <div className={className}>
      {/* Decorative cards */}
      <div className="flex justify-center mb-4 space-x-2">
        <Card suit="H" rank={5} className={`${cardClassName} -rotate-12`} />
        <Card suit="H" rank={5} className={`${cardClassName} rotate-6`} />
        <Card suit="H" rank={5} className={`${cardClassName} -rotate-6`} />
        <Card suit="H" rank={5} className={`${cardClassName} rotate-12`} />
      </div>

      {showTitle && (
        <>
          {/* Title */}
          <h1 className={`text-3xl font-bold text-center mb-2 text-gold ${titleClassName}`}>
            Heart of Five
          </h1>
          <p className="text-center text-gray-300 mb-6 text-2xl">
            红心五
          </p>
        </>
      )}
    </div>
  );
};
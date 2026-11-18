import React from 'react';
import type { Card as CardType } from '../../types/game';
import { CardFace, CardBack } from './CardFace';

interface CardProps extends Partial<CardType> {
  className?: string;
  isBack?: boolean;
  onClick?: () => void;
  selected?: boolean;
  style?: React.CSSProperties;
}

/**
 * A card at rest. It fills its box when the caller sizes it (a w-* class or a style width) and
 * is 4.375em x 6.125em otherwise. The table's moving cards are built from CardFace directly.
 */
export const Card: React.FC<CardProps> = ({
  suit = '',
  rank = 0,
  className = '',
  isBack = false,
  onClick,
  selected = false,
  style,
}) => {
  const sized = /(^|\s)(w-|h-|inset-)/.test(className) || style?.width !== undefined;
  return (
    <div
      className={`relative ${className}`}
      onClick={onClick}
      style={{
        ...(sized ? {} : { width: '4.375em', height: '6.125em' }),
        filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))',
        ...style,
      }}
    >
      {isBack ? <CardBack /> : <CardFace suit={suit} rank={rank} selected={selected} />}
    </div>
  );
};

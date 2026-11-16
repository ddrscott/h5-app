import { useState, useCallback } from 'react';
import type { Card } from '../types/game';

interface AnimationConfig {
  startPosition: {
    left?: string;
    right?: string;
    top?: string;
    bottom?: string;
  };
  endPosition: {
    left?: string;
    right?: string;
    top?: string;
    bottom?: string;
  };
  duration?: number;
  delay?: number;
  stagger?: number;
  arrangeAsArc?: boolean;
  groupRotation?: number;
}

export const useAnimatedCards = () => {
  const [animatingCards, setAnimatingCards] = useState<Card[]>([]);
  const [animationConfig, setAnimationConfig] = useState<AnimationConfig | null>(null);
  
  const animateCards = useCallback((cards: Card[], config: AnimationConfig) => {
    setAnimatingCards(cards);
    setAnimationConfig(config);
  }, []);
  
  const clearAnimation = useCallback(() => {
    setAnimatingCards([]);
    setAnimationConfig(null);
  }, []);
  
  return {
    animatingCards,
    animationConfig,
    animateCards,
    clearAnimation,
  };
};
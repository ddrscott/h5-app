import React from 'react';
import type { Card as CardType } from '../../types/game';
import { Card } from '../ui/Card';

interface PlayerHandProps {
  hand: CardType[];
  selectedCards: Set<string>;
  onCardSelect: (cardKey: string) => void;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  hand,
  selectedCards,
  onCardSelect
}) => {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [containerWidth, setContainerWidth] = React.useState(window.innerWidth);
  const [cardScale, setCardScale] = React.useState(1);
  const [rotationOffset, setRotationOffset] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // Carousel rotation limits - adjust these for better UX
  const maxRotationLeft = -20; // Maximum rotation to the left (negative degrees)
  const maxRotationRight = 20;  // Maximum rotation to the right (positive degrees)
  const elasticOverflow = 8; // How far beyond limits we allow during gestures (elastic effect)
  
  // Touch/swipe state
  const [touchStart, setTouchStart] = React.useState<{ x: number; time: number } | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [lastTap, setLastTap] = React.useState<number>(0);
  const animationRef = React.useRef<number | null>(null);
  
  // Apply elastic resistance when going beyond rotation limits
  const applyElasticResistance = (targetRotation: number) => {
    if (targetRotation < maxRotationLeft) {
      // Beyond left limit - apply elastic resistance
      const overflow = maxRotationLeft - targetRotation;
      const resistance = Math.min(overflow * 0.3, elasticOverflow); // Diminishing returns
      return maxRotationLeft - resistance;
    } else if (targetRotation > maxRotationRight) {
      // Beyond right limit - apply elastic resistance
      const overflow = targetRotation - maxRotationRight;
      const resistance = Math.min(overflow * 0.3, elasticOverflow); // Diminishing returns
      return maxRotationRight + resistance;
    }
    return targetRotation; // Within normal limits
  };

  // Smooth animation to target rotation
  const animateToRotation = (targetRotation: number, duration: number = 300) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startRotation = rotationOffset;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentRotation = startRotation + (targetRotation - startRotation) * easeOut;
      
      setRotationOffset(currentRotation);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };
  
  // Keyboard handler for resetting view
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key === 'c' && e.ctrlKey)) {
        animateToRotation(0, 400);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Clean up any running animations
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    const updateDimensions = () => {
      // Update container width
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      } else {
        setContainerWidth(window.innerWidth);
      }
      
      // Calculate dynamic card scale based on screen width and number of cards
      // Base card width is 64px (4em at 16px base)
      const baseCardWidth = 64;
      const minCardWidth = 48; // Minimum card width
      const maxCardWidth = 64; // Maximum card width
      const cardOverlap = 0.4; // Cards overlap by 40%
      
      // Calculate how many cards we need to fit
      const effectiveCardWidth = baseCardWidth * (1 - cardOverlap);
      const currentContainerWidth = containerRef.current?.offsetWidth || window.innerWidth;
      const availableWidth = currentContainerWidth * 0.9; // Use 90% of container
      const totalCardsWidth = hand.length * effectiveCardWidth;
      
      if (totalCardsWidth > availableWidth) {
        // Scale down cards to fit
        const requiredScale = availableWidth / totalCardsWidth;
        const finalScale = Math.max(requiredScale, minCardWidth / baseCardWidth);
        setCardScale(finalScale);
      } else {
        // Cards fit, use full size up to max
        setCardScale(Math.min(1, maxCardWidth / baseCardWidth));
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [hand.length]);

  // Calculate arc positions for each card
  const getCardTransform = (index: number, total: number, containerWidth: number, scale: number) => {
    if (total <= 1) return { rotate: 0, translateX: 0, translateY: 0 };
    
    // ignore for now.
    var containerWidth = 500;
    // Constants for card layout
    const baseCardWidth = 64; // Base card width in pixels
    const scaledCardWidth = baseCardWidth * scale; // Apply dynamic scaling
    const minSpacing = scaledCardWidth * 0.6; // Cards overlap by 40%
    const maxSpread = containerWidth * 0.9; // Use up to 90% of container width
    
    // Calculate ideal spread based on number of cards
    const idealSpread = (total - 1) * minSpacing;
    const actualSpread = Math.min(idealSpread, maxSpread);
    
    // Position cards evenly across the spread
    const cardSpacing = actualSpread / Math.max(1, total - 1);
    const startX = -actualSpread / 2;
    const cardX = startX + (index * cardSpacing);
    
    // Large circle parameters - center is below the screen
    const circleRadius = containerWidth * 0.8; // Large radius
    const circleCenterY = window.innerHeight + circleRadius * 0.95; // Center below viewport - increased to lower cards
    
    // Calculate the angle for this card position on the circle
    // Cards are spread along a small arc of the large circle
    const maxAnglePerCard = 6; // Maximum 10 degrees between cards
    const idealMaxAngle = 45; // Ideal maximum angle spread in degrees
    const actualMaxAngle = Math.min(idealMaxAngle, (total - 1) * maxAnglePerCard);
    const angleStep = total > 1 ? actualMaxAngle / (total - 1) : 0;
    const baseCardAngle = -actualMaxAngle / 2 + (index * angleStep) - 5;
    const cardAngleRad = (baseCardAngle * Math.PI) / 180; // Convert to radians for positioning
    
    // Calculate position on the circle circumference
    // x = cx + r * sin(θ)
    // y = cy - r * cos(θ) (subtract because CSS Y increases downward)
    const circleX = 0; // Circle centered horizontally
    const circleY = circleCenterY - circleRadius * Math.cos(cardAngleRad);
    
    // The actual card position relative to container
    const actualX = circleRadius * Math.sin(cardAngleRad);
    const actualY = window.innerHeight - circleY; // Convert to position from bottom
    
    // Card rotation matches the arc angle (no additional rotation offset here)
    const rotation = baseCardAngle;
    
    return { 
      rotate: rotation,
      translateX: actualX,
      translateY: -actualY // Negative because we're lifting from bottom
    };
  };

  // Touch/Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, time: Date.now() });
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || !isDragging) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart.x;
    const sensitivity = 0.15; // Reduced sensitivity for better control
    const targetRotation = deltaX * sensitivity;
    const newRotation = applyElasticResistance(targetRotation);
    
    setRotationOffset(newRotation);
    e.preventDefault(); // Prevent scrolling
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || !isDragging) return;
    
    const currentTime = Date.now();
    const tapLength = currentTime - touchStart.time;
    
    // Check for double-tap (quick tap without significant movement)
    if (tapLength < 200 && Math.abs(e.changedTouches[0].clientX - touchStart.x) < 10) {
      if (currentTime - lastTap < 300) {
        // Double tap detected - reset to center with smooth animation
        animateToRotation(0, 400);
      }
      setLastTap(currentTime);
    } else {
      // Smooth bounce back to limits if we're in the elastic zone
      if (rotationOffset < maxRotationLeft || rotationOffset > maxRotationRight) {
        const targetRotation = Math.max(maxRotationLeft, Math.min(maxRotationRight, rotationOffset));
        animateToRotation(targetRotation, 250); // Shorter bounce-back animation
      }
    }
    
    // End the drag
    setTouchStart(null);
    setIsDragging(false);
  };

  // Mouse wheel handler for desktop
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const sensitivity = 0.3; // Reduced sensitivity for better control
    const deltaRotation = e.deltaX * sensitivity;
    const targetRotation = rotationOffset + deltaRotation;
    const newRotation = applyElasticResistance(targetRotation);
    
    setRotationOffset(newRotation);
    
    // Smooth bounce back from elastic zone after a brief delay
    setTimeout(() => {
      const currentRotation = rotationOffset + deltaRotation;
      if (currentRotation < maxRotationLeft || currentRotation > maxRotationRight) {
        const bounceTarget = Math.max(maxRotationLeft, Math.min(maxRotationRight, currentRotation));
        animateToRotation(bounceTarget, 200); // Quick, smooth bounce
      }
    }, 100);
  };

  // Calculate the transform origin to match the circle center used for positioning
  const circleRadius = 500 * 0.8; // Same as in getCardTransform
  const circleCenterY = window.innerHeight + circleRadius * 0.95;
  const transformOriginY = circleCenterY - window.innerHeight; // Distance from bottom of viewport

  return (
      <div className="absolute bottom-[-1em] portrait:bottom-[2em] left-0 right-[-4em] flex justify-center" ref={containerRef}>
      <div 
        className="relative"
        style={{
          width: '100%',
          height: '8em',
          touchAction: 'pan-x', // Allow horizontal touch gestures
          transform: `rotate(${rotationOffset}deg)`, // Apply carousel rotation to entire container
          transformOrigin: `center ${transformOriginY}px`, // Rotate around the center of the large circle below
          transition: isDragging ? 'none' : 'transform 0.2s ease-out', // Smooth transitions when not dragging
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {hand.map((card, index) => {
          const cardKey = card.code || `${card.suit}-${card.rank}`;
          const isSelected = selectedCards.has(cardKey);
          const { rotate, translateX, translateY } = getCardTransform(index, hand.length, containerWidth, cardScale);

          // Calculate lift for hover and selected states
          const isHovered = hoveredIndex === index;
          const baseLift = 0; // No base lift, arc handles positioning
          // Only apply lift once - either for hover OR selected, not both
          const cardLift = (isHovered || isSelected) ? -15 : 0;
          const totalTranslateY = baseLift + translateY + cardLift;

          return (
            <div
              key={cardKey}
              className={`player-card ${isSelected ? 'selected' : ''}`}
              style={{
                position: 'absolute',
                left: '50%',
                width: `${4 * cardScale}em`,
                height: `${6 * cardScale}em`,
                marginLeft: `${-2 * cardScale}em`, // Half of card width to center
                zIndex: index,
                transform: `translateX(${translateX}px) translateY(${totalTranslateY}px) rotate(${rotate}deg) ${isHovered ? 'scale(1.05)' : ''}`,
                transformOrigin: 'center bottom',
                cursor: 'pointer',
                transition: isDragging ? 'none' : 'transform 0.2s ease-out', // Smooth transitions when not dragging
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <Card
                {...card}
                onClick={() => onCardSelect(cardKey)}
                selected={isSelected}
                className="w-full h-full"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

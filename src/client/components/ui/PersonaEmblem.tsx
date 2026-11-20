import React from 'react';
import { personaOf } from '../../bots/personas';

/**
 * Each bot personality's emblem: an original, bold ink silhouette, drawn to read at 16px on a
 * paper tag and at 60px in a seat's portrait panel. Shark: a fin cutting a wave. Regular: a level
 * beam. Hothead: a flame. Turtle: a hex shell. Rookie: a sprout. Anything else: a plain bot head.
 */
const SHAPES: Record<string, React.ReactNode> = {
  shark: (
    <>
      <path d="M5 30 C13 29 19 21 21 5 C25 15 30 25 36 30 Z" />
      <path d="M2 35.5 q4.5 -4 9 0 t9 0 t9 0 t9 0" fill="none" strokeWidth="3.2" strokeLinecap="square" />
    </>
  ),
  regular: (
    <>
      <path d="M20 6 V31 M6 12 H34" fill="none" strokeWidth="3.6" />
      <path d="M2 23 L7 12 L12 23 Z M28 23 L33 12 L38 23 Z" />
      <path d="M11 35 H29 L26 30 H14 Z" />
    </>
  ),
  hothead: (
    <path d="M20 3 C27 13 33 17 31 27 C30 34 25 37.5 20 37.5 C13.5 37.5 8.5 33 9.5 25.5 C10.5 19.5 14.5 17.5 15.5 11 C19 16.5 19 20 22 22.5 C23.5 16 22.5 9.5 20 3 Z M20 37.5 C16.5 37.5 14 35 15 31 C16 28 18.5 27 19 24 C22 27 25 29.5 24.5 33 C24 36 22 37.5 20 37.5 Z" fillRule="evenodd" />
  ),
  turtle: (
    <>
      <path d="M20 4 L34 12 V28 L20 36 L6 28 V12 Z" />
      <path d="M20 13 L26 16.5 V23.5 L20 27 L14 23.5 V16.5 Z M20 4 V13 M34 12 L26 16.5 M34 28 L26 23.5 M20 36 V27 M6 28 L14 23.5 M6 12 L14 16.5" fill="none" stroke="#FAFAF7" strokeWidth="2.2" />
    </>
  ),
  rookie: (
    <>
      <path d="M20 37 V19" fill="none" strokeWidth="3.6" />
      <path d="M20 23 C11 23 5.5 17 5.5 9.5 C14 9.5 20 14 20 23 Z" />
      <path d="M20 19 C27 19 33.5 14.5 34.5 7 C26 7 20.5 11 20 19 Z" />
      <path d="M12 37 H28" fill="none" strokeWidth="3.6" />
    </>
  ),
  bot: (
    <>
      <path d="M20 3 V9" fill="none" strokeWidth="3.2" />
      <path d="M7 10 H33 V32 H7 Z M13 18 V24 H18 V18 Z M22 18 V24 H27 V18 Z" fillRule="evenodd" />
      <path d="M3 17 V25 M37 17 V25 M14 36 H26" fill="none" strokeWidth="3.2" />
    </>
  ),
};

export const PersonaEmblem: React.FC<{ persona?: string; size?: number; color?: string; className?: string }> = ({ persona, size = 16, color = '#0B0B0D', className = '' }) => {
  const id = personaOf(persona)?.id ?? 'bot';
  return (
    <svg aria-hidden viewBox="0 0 40 40" width={size} height={size} className={className} fill={color} stroke={color} strokeLinejoin="miter">
      <g strokeWidth="0">{SHAPES[id] ?? SHAPES.bot}</g>
    </svg>
  );
};

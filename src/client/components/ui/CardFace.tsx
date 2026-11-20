import React from 'react';

/**
 * Card faces, drawn in SVG on a 100x140 box (5:7, a poker card). Design notes in docs/VISUALS.md.
 *
 * `rank` is the server's rank: 3..13 as printed, 14 = A, 15 = 2, 16 = small joker, 17 = big joker.
 * Corner indices are large on purpose: in a fanned hand on a phone only the left strip shows.
 */

export const RED = '#D7192B';
export const BLACK = '#141416';
export const INK = '#0B0B0D';
export const ORANGE = '#E85D00';
export const PAPER = '#FAFAF7';

type SuitCode = 'H' | 'D' | 'C' | 'S';

/** Suit shapes on a 100x100 box. */
export const Pip: React.FC<{ suit: SuitCode; x: number; y: number; size: number; flip?: boolean; fill?: string }> = ({ suit, x, y, size, flip, fill }) => {
  const color = fill ?? (suit === 'H' || suit === 'D' ? RED : BLACK);
  const s = size / 100;
  const t = `translate(${x - size / 2} ${y - size / 2}) scale(${s})${flip ? ' rotate(180 50 50)' : ''}`;
  return (
    <g transform={t} fill={color}>
      {suit === 'H' && <path d="M50 92 C 22 70 3 52 3 31 C 3 16 14 5 28 5 C 38 5 46 11 50 21 C 54 11 62 5 72 5 C 86 5 97 16 97 31 C 97 52 78 70 50 92 Z" />}
      {suit === 'D' && <path d="M50 2 Q 68 30 88 50 Q 68 70 50 98 Q 32 70 12 50 Q 32 30 50 2 Z" />}
      {suit === 'S' && <path d="M50 3 C 74 26 96 42 96 62 C 96 76 86 85 73 85 C 64 85 57 81 53 74 C 54 84 58 91 67 97 L 33 97 C 42 91 46 84 47 74 C 43 81 36 85 27 85 C 14 85 4 76 4 62 C 4 42 26 26 50 3 Z" />}
      {suit === 'C' && (
        <>
          <circle cx="50" cy="27" r="21" />
          <circle cx="26" cy="60" r="21" />
          <circle cx="74" cy="60" r="21" />
          <circle cx="50" cy="52" r="12" />
          <path d="M46 56 C 45 76 41 88 32 97 L 68 97 C 59 88 55 76 54 56 Z" />
        </>
      )}
    </g>
  );
};

const RANK_LABEL: Record<number, string> = { 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2' };
export const rankLabel = (rank: number) => RANK_LABEL[rank] ?? String(rank);

// Pip layouts for 2..10 on the 100x140 face, [x, y, flipped].
const L = 38, C = 50, R = 62;
const PIPS: Record<number, Array<[number, number, boolean?]>> = {
  2: [[C, 32], [C, 108, true]],
  3: [[C, 32], [C, 70], [C, 108, true]],
  4: [[L, 32], [R, 32], [L, 108, true], [R, 108, true]],
  5: [[L, 32], [R, 32], [C, 70], [L, 108, true], [R, 108, true]],
  6: [[L, 32], [R, 32], [L, 70], [R, 70], [L, 108, true], [R, 108, true]],
  7: [[L, 32], [R, 32], [C, 51], [L, 70], [R, 70], [L, 108, true], [R, 108, true]],
  8: [[L, 32], [R, 32], [C, 51], [L, 70], [R, 70], [C, 89, true], [L, 108, true], [R, 108, true]],
  9: [[L, 28], [R, 28], [L, 56], [R, 56], [C, 70], [L, 84, true], [R, 84, true], [L, 112, true], [R, 112, true]],
  10: [[L, 28], [R, 28], [C, 42], [L, 56], [R, 56], [L, 84, true], [R, 84, true], [C, 98, true], [L, 112, true], [R, 112, true]],
};

/** Indices: Barlow ExtraBold, picked for legibility at a glance. Face letters: Bangers lettering. */
const SANS = 'Barlow, "Arial Narrow", Arial, sans-serif';
const LETTERING = 'Bangers, Impact, sans-serif';

const Index: React.FC<{ label: string; suit: SuitCode; color: string; pipFill?: string }> = ({ label, suit, color, pipFill }) => (
  <g>
    <text
      x={label.length > 1 ? 4.5 : 7.5} y="31" fill={color} fontFamily={SANS} fontWeight="800" fontSize="31"
      {...(label.length > 1 ? { textLength: 27, lengthAdjust: 'spacingAndGlyphs' } : {})}
    >{label}</text>
    <Pip suit={suit} x={label.length > 1 ? 18 : 17} y={45} size={19} fill={pipFill} />
  </g>
);

/**
 * The Heart of Five: an ink double frame, a dry-brush ring in red round a big heart, five small
 * ink hearts, screentone shading, and the 红心五 seal stamp. Our own marks, nothing borrowed.
 */
const HeartFive: React.FC = () => {
  const id = React.useId().replace(/:/g, '');
  return (
    <>
      <defs>
        <pattern id={`h5tone${id}`} width="3.2" height="3.2" patternUnits="userSpaceOnUse">
          <circle cx="1.6" cy="1.6" r="0.75" fill={RED} opacity="0.35" />
        </pattern>
        <filter id={`h5brush${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="1.4 0.12" numOctaves="2" seed="11" />
          <feDisplacementMap in="SourceGraphic" scale="3.2" />
        </filter>
      </defs>
      <rect x="3.5" y="3.5" width="93" height="133" rx="3" fill="none" stroke={INK} strokeWidth="2.4" />
      <rect x="7" y="7" width="86" height="126" rx="1.5" fill="none" stroke={RED} strokeWidth="0.9" />
      <Index label="5" suit="H" color={RED} />
      <g transform="rotate(180 50 70)"><Index label="5" suit="H" color={RED} /></g>
      <circle cx="50" cy="70" r="31" fill={`url(#h5tone${id})`} />
      {/* one loaded brush stroke, lifting off before it closes */}
      <g filter={`url(#h5brush${id})`} fill="none" stroke={RED} strokeLinecap="round">
        <circle cx="50" cy="70" r="26" strokeWidth="4.6" strokeDasharray="140 24" transform="rotate(-70 50 70)" />
        <circle cx="50" cy="70" r="26" strokeWidth="1.6" strokeDasharray="120 44" transform="rotate(-40 50 70)" opacity="0.8" />
      </g>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i * 72 - 90) * (Math.PI / 180);
        return <Pip key={i} suit="H" x={50 + Math.cos(a) * 35} y={70 + Math.sin(a) * 35} size={8.5} fill={INK} />;
      })}
      <Pip suit="H" x={50} y={71} size={34} />
      <text x="50" y="78" textAnchor="middle" fill={PAPER} stroke={INK} strokeWidth="0.6" paintOrder="stroke" fontFamily={LETTERING} fontSize="22">5</text>
      {/* seal stamp: 红心五 */}
      <g transform="translate(9 96) rotate(-5)">
        <rect width="13" height="30" rx="0.8" fill={RED} />
        <rect x="1.4" y="1.4" width="10.2" height="27.2" rx="0.5" fill="none" stroke={PAPER} strokeWidth="0.7" opacity="0.9" />
        {['红', '心', '五'].map((ch, i) => (
          <text key={ch} x="6.5" y={9.6 + i * 8.6} textAnchor="middle" fill={PAPER} fontSize="7.4" fontWeight="900" fontFamily="'H5 Seal', serif">{ch}</text>
        ))}
      </g>
    </>
  );
};

const Joker: React.FC<{ big: boolean }> = ({ big }) => {
  const color = big ? RED : BLACK;
  const star = (r1: number, r2: number) =>
    Array.from({ length: 16 }, (_, i) => {
      const r = i % 2 ? r2 : r1;
      const a = (i * 22.5 - 90) * (Math.PI / 180);
      return `${(50 + Math.cos(a) * r).toFixed(2)},${(70 + Math.sin(a) * r).toFixed(2)}`;
    }).join(' ');
  const letters = (
    <g fontFamily={LETTERING} fontSize="13.5" fill={color} textAnchor="middle">
      {'JOKER'.split('').map((ch, i) => <text key={i} x="11" y={17 + i * 11.5}>{ch}</text>)}
    </g>
  );
  return (
    <>
      {letters}
      <g transform="rotate(180 50 70)">{letters}</g>
      <circle cx="50" cy="70" r="29" fill={color} opacity="0.07" />
      <polygon points={star(27, 11)} fill={color} stroke={INK} strokeWidth="1" strokeLinejoin="miter" />
      <polygon points={star(13, 6)} fill={big ? ORANGE : PAPER} />
      <circle cx="50" cy="70" r="3.4" fill={color} />
      <text x="50" y="116" textAnchor="middle" fontFamily={LETTERING} fontSize="10" letterSpacing="1.5" fill={color}>
        {big ? 'BIG' : 'SMALL'}
      </text>
    </>
  );
};

const Face: React.FC<{ rank: number; suit: SuitCode; color: string }> = ({ rank, suit, color }) => {
  const letter = rankLabel(rank);
  const crown = rank - 10; // J 1, Q 2, K 3
  const xs = crown === 1 ? [50] : crown === 2 ? [43, 57] : [37, 50, 63];
  return (
    <>
      <rect x="26" y="22" width="48" height="96" fill={color} opacity="0.06" />
      <path d="M26 22 H74 V118 H26 Z" fill="none" stroke={INK} strokeWidth="1.6" />
      <path d="M29 25 H71 V115 H29 Z" fill="none" stroke={color} strokeWidth="0.5" />
      {xs.map((x) => <Pip key={`t${x}`} suit={suit} x={x} y={38} size={10} />)}
      {xs.map((x) => <Pip key={`b${x}`} suit={suit} x={x} y={102} size={10} flip />)}
      <text x="50" y="89" textAnchor="middle" fill={color} fontFamily={LETTERING} fontSize="54">{letter}</text>
    </>
  );
};

interface CardFaceProps {
  suit: string;
  rank: number;
  className?: string;
  selected?: boolean;
}

export const isHeartFive = (suit: string, rank: number) => suit === 'H' && rank === 5;

/**
 * A card's drawing as plain SVG elements, built once per card and reused by every copy of it on
 * screen. Pip, Index, Face and Joker are pure functions, so they're called here instead of being
 * mounted as components: mounting a played card then only creates its SVG nodes, which keeps the
 * frame where a meld leaves the hand short (docs/VISUALS.md, Performance). HeartFive keeps its
 * hook (useId), so it stays a component.
 */
const faceCache = new Map<string, React.ReactNode>();
function flatten(node: React.ReactNode): React.ReactNode {
  if (Array.isArray(node)) return node.map(flatten);
  if (!React.isValidElement(node)) return node;
  const el = node as React.ReactElement<{ children?: React.ReactNode }>;
  if (typeof el.type === 'function' && el.type !== HeartFive) {
    const out = flatten((el.type as (p: unknown) => React.ReactNode)(el.props));
    // a component in a list carried the key; hand it to what it drew
    return el.key != null && React.isValidElement(out) ? React.cloneElement(out, { key: el.key }) : out;
  }
  const kids = el.props.children;
  if (kids === undefined) return el;
  return Array.isArray(kids) ? React.cloneElement(el, undefined, ...kids.map(flatten)) : React.cloneElement(el, undefined, flatten(kids));
}
function faceArt(s: SuitCode, rank: number, isJoker: boolean, h5: boolean, label: string, color: string): React.ReactNode {
  const key = `${s}${rank}${isJoker ? 'j' : ''}`;
  let art = faceCache.get(key);
  if (art === undefined) {
    art = flatten(
      <>
        <rect width="100" height="140" rx="6" fill={PAPER} />
        {/* a light ink outline, like a card drawn on the page */}
        <rect x="0.8" y="0.8" width="98.4" height="138.4" rx="5.4" fill="none" stroke={INK} strokeWidth="1.6" strokeOpacity="0.85" />
        {isJoker ? <Joker big={rank === 17} /> : h5 ? <HeartFive /> : (
          <>
            <Index label={label} suit={s} color={color} />
            <g transform="rotate(180 50 70)"><Index label={label} suit={s} color={color} /></g>
            {rank >= 3 && rank <= 10 && PIPS[rank].map(([x, y, f], i) => <Pip key={i} suit={s} x={x} y={y} size={16} flip={f} />)}
            {rank === 15 && PIPS[2].map(([x, y, f], i) => <Pip key={i} suit={s} x={x} y={y} size={20} flip={f} />)}
            {rank >= 11 && rank <= 13 && <Face rank={rank} suit={s} color={color} />}
            {rank === 14 && (
              <>
                <circle cx="50" cy="70" r="30" fill="none" stroke={color} strokeWidth="0.8" opacity="0.35" />
                <Pip suit={s} x={50} y={70} size={42} />
              </>
            )}
          </>
        )}
      </>,
    );
    faceCache.set(key, art);
  }
  return art;
}

/**
 * Build every face's drawing while the browser is idle, a few at a time, so the first time a card
 * is played its drawing is already made and the launch frame only creates DOM nodes.
 */
function warmFaces() {
  const todo: Array<[SuitCode, number, boolean]> = [];
  for (const su of ['H', 'D', 'C', 'S'] as SuitCode[]) for (let r = 3; r <= 15; r++) todo.push([su, r, false]);
  todo.push(['H', 16, true], ['H', 17, true]);
  const idle = (cb: (d: { timeRemaining: () => number }) => void) =>
    typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(() => cb({ timeRemaining: () => 8 }), 200);
  const step = (d: { timeRemaining: () => number }) => {
    while (todo.length && d.timeRemaining() > 2) {
      const [su, r, j] = todo.pop()!;
      faceArt(su, r, j, !j && isHeartFive(su, r), rankLabel(r), su === 'H' || su === 'D' ? RED : BLACK);
    }
    if (todo.length) idle(step);
  };
  idle(step);
}
if (typeof window !== 'undefined') warmFaces();

export const CardFace: React.FC<CardFaceProps> = React.memo(({ suit, rank, className = '', selected = false }) => {
  const isJoker = suit === 'J' || rank === 16 || rank === 17;
  const s = (['H', 'D', 'C', 'S'].includes(suit) ? suit : 'H') as SuitCode;
  const color = s === 'H' || s === 'D' ? RED : BLACK;
  const h5 = !isJoker && isHeartFive(s, rank);
  const label = rankLabel(rank);
  const name = isJoker ? (rank === 17 ? 'Big joker' : 'Small joker') : `${label} of ${{ H: 'hearts', D: 'diamonds', C: 'clubs', S: 'spades' }[s]}`;

  return (
    <div className={`card-face relative w-full h-full ${className}`} role="img" aria-label={name}>
      <svg viewBox="0 0 100 140" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {faceArt(s, rank, isJoker, h5, label, color)}
        {selected && <rect x="1.5" y="1.5" width="97" height="137" rx="5" fill="none" stroke="#E85D00" strokeWidth="3" />}
      </svg>
      {h5 && <div className="foil" style={{ borderRadius: '6% / 4.3%' }} />}
    </div>
  );
});
CardFace.displayName = 'CardFace';

const BACK_BURST = Array.from({ length: 28 }, (_, i) => {
  const r = i % 2 ? 16 : 27 - (i % 4 === 0 ? 0 : 3);
  const a = (i * (360 / 28) - 90) * (Math.PI / 180);
  return `${(50 + Math.cos(a) * r).toFixed(2)},${(70 + Math.sin(a) * r * 1.12).toFixed(2)}`;
}).join(' ');
/** The back: an ink field of screentone dots inside a paper border, and an orange impact burst holding five ink hearts. */
let backArt: React.ReactNode = null;
export const CardBack: React.FC<{ className?: string }> = React.memo(({ className = '' }) => {
  // One drawing shared by every back on screen (seat fans, the deal, opponents' cards in flight).
  // The dot pattern's id is fixed: every copy defines the same pattern, so any of them will do.
  backArt ??= flatten(
    <>
      <defs>
        <pattern id="h5backdot" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="2" cy="2" r="0.9" fill={PAPER} opacity="0.22" />
        </pattern>
      </defs>
      <rect width="100" height="140" rx="6" fill={PAPER} />
      <rect x="0.8" y="0.8" width="98.4" height="138.4" rx="5.4" fill="none" stroke={INK} strokeWidth="1.6" />
      <rect x="5" y="5" width="90" height="130" rx="1.5" fill={INK} />
      <rect x="5" y="5" width="90" height="130" rx="1.5" fill="url(#h5backdot)" />
      <rect x="8.5" y="8.5" width="83" height="123" fill="none" stroke={PAPER} strokeWidth="0.8" opacity="0.6" />
      <polygon points={BACK_BURST} fill={ORANGE} stroke={PAPER} strokeWidth="1.4" strokeLinejoin="miter" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`rotate(${i * 72} 50 70)`}>
          <Pip suit="H" x={50} y={61} size={9.5} fill={INK} flip />
        </g>
      ))}
      <circle cx="50" cy="70" r="2.6" fill={INK} />
    </>,
  );
  return (
    <div className={`relative w-full h-full ${className}`} aria-label="Card back" role="img">
      <svg viewBox="0 0 100 140" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">{backArt}</svg>
    </div>
  );
});
CardBack.displayName = 'CardBack';

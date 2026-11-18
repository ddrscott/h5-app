import React from 'react';

/**
 * Card faces, drawn in SVG on a 100x140 box (5:7, a poker card). Design notes in docs/VISUALS.md.
 *
 * `rank` is the server's rank: 3..13 as printed, 14 = A, 15 = 2, 16 = small joker, 17 = big joker.
 * Corner indices are large on purpose: in a fanned hand on a phone only the left strip shows.
 */

export const RED = '#C7352C';
export const BLACK = '#1C1D24';
export const BRASS = '#D6A54A';
export const BRASS_DEEP = '#8C6420';
export const PAPER = '#F6F0E2';

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

const MONO = '"JetBrains Mono", ui-monospace, monospace';
const SERIF = '"Fraunces Variable", Georgia, serif';

const Index: React.FC<{ label: string; suit: SuitCode; color: string; pipFill?: string }> = ({ label, suit, color, pipFill }) => (
  <g>
    <text
      x={label.length > 1 ? 4.5 : 8} y="31" fill={color} fontFamily={MONO} fontWeight="800" fontSize="29"
      {...(label.length > 1 ? { textLength: 27, lengthAdjust: 'spacingAndGlyphs' } : {})}
    >{label}</text>
    <Pip suit={suit} x={label.length > 1 ? 18 : 17} y={45} size={19} fill={pipFill} />
  </g>
);

/** The Heart of Five: brass-framed, a seal stamp, five hearts around the five. */
const HeartFive: React.FC = () => (
  <>
    <rect x="3.5" y="3.5" width="93" height="133" rx="4" fill="none" stroke={BRASS} strokeWidth="2.2" />
    <rect x="6.5" y="6.5" width="87" height="127" rx="2.5" fill="none" stroke={BRASS} strokeWidth="0.6" opacity="0.8" />
    <Index label="5" suit="H" color={RED} />
    <g transform="rotate(180 50 70)"><Index label="5" suit="H" color={RED} /></g>
    <circle cx="50" cy="70" r="27" fill="none" stroke={BRASS} strokeWidth="1.4" />
    <circle cx="50" cy="70" r="23.5" fill="none" stroke={BRASS} strokeWidth="0.5" strokeDasharray="1.2 2" />
    {[0, 1, 2, 3, 4].map((i) => {
      const a = (i * 72 - 90) * (Math.PI / 180);
      return <Pip key={i} suit="H" x={50 + Math.cos(a) * 33} y={70 + Math.sin(a) * 33} size={9} fill={BRASS} />;
    })}
    <Pip suit="H" x={50} y={71} size={36} />
    <text x="50" y="76.5" textAnchor="middle" fill={PAPER} fontFamily={SERIF} fontWeight="800" fontSize="20">5</text>
    {/* seal stamp: 红心五 */}
    <g transform="translate(9 96) rotate(-4)">
      <rect width="13" height="30" rx="1.5" fill={RED} />
      <rect x="1.4" y="1.4" width="10.2" height="27.2" rx="1" fill="none" stroke={PAPER} strokeWidth="0.6" opacity="0.85" />
      {['红', '心', '五'].map((ch, i) => (
        <text key={ch} x="6.5" y={9.6 + i * 8.6} textAnchor="middle" fill={PAPER} fontSize="7.4" fontWeight="900" fontFamily="'H5 Seal', serif">{ch}</text>
      ))}
    </g>
  </>
);

const Joker: React.FC<{ big: boolean }> = ({ big }) => {
  const color = big ? RED : BLACK;
  const star = (r1: number, r2: number) =>
    Array.from({ length: 16 }, (_, i) => {
      const r = i % 2 ? r2 : r1;
      const a = (i * 22.5 - 90) * (Math.PI / 180);
      return `${(50 + Math.cos(a) * r).toFixed(2)},${(70 + Math.sin(a) * r).toFixed(2)}`;
    }).join(' ');
  const letters = (
    <g fontFamily={MONO} fontWeight="800" fontSize="12" fill={color} textAnchor="middle">
      {'JOKER'.split('').map((ch, i) => <text key={i} x="11" y={17 + i * 11.5}>{ch}</text>)}
    </g>
  );
  return (
    <>
      {letters}
      <g transform="rotate(180 50 70)">{letters}</g>
      <circle cx="50" cy="70" r="29" fill={color} opacity="0.07" />
      <polygon points={star(27, 11)} fill={color} />
      <polygon points={star(13, 6)} fill={big ? BRASS : PAPER} />
      <circle cx="50" cy="70" r="3.4" fill={color} />
      <text x="50" y="114" textAnchor="middle" fontFamily={MONO} fontWeight="700" fontSize="8" letterSpacing="2" fill={color}>
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
      <rect x="26" y="22" width="48" height="96" fill={color} opacity="0.07" />
      <rect x="26" y="22" width="48" height="96" fill="none" stroke={color} strokeWidth="1.1" />
      <rect x="29" y="25" width="42" height="90" fill="none" stroke={color} strokeWidth="0.4" />
      {xs.map((x) => <Pip key={`t${x}`} suit={suit} x={x} y={38} size={10} />)}
      {xs.map((x) => <Pip key={`b${x}`} suit={suit} x={x} y={102} size={10} flip />)}
      <text x="50" y="86" textAnchor="middle" fill={color} fontFamily={SERIF} fontWeight="700" fontSize="46">{letter}</text>
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
        <rect width="100" height="140" rx="6" fill={h5 ? '#FBF3DC' : PAPER} />
        <rect x="0.5" y="0.5" width="99" height="139" rx="5.5" fill="none" stroke="#000" strokeOpacity="0.18" />
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
        {selected && <rect x="1.5" y="1.5" width="97" height="137" rx="5" fill="none" stroke="#E85D00" strokeWidth="3" />}
      </svg>
      {/* light from above: a soft sheen across the stock */}
      <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '6% / 4.3%', background: 'linear-gradient(160deg, rgba(255,255,255,.35) 0%, rgba(255,255,255,0) 38%, rgba(0,0,0,0) 70%, rgba(60,40,10,.10) 100%)' }} />
      {h5 && <div className="foil" style={{ borderRadius: '6% / 4.3%' }} />}
    </div>
  );
});
CardFace.displayName = 'CardFace';

/** The back: ink field inside a paper border, a lattice of hearts, and a five-heart rosette. */
export const CardBack: React.FC<{ className?: string }> = React.memo(({ className = '' }) => {
  const id = React.useId().replace(/:/g, '');
  return (
    <div className={`relative w-full h-full ${className}`} aria-label="Card back" role="img">
      <svg viewBox="0 0 100 140" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`lat${id}`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 6 H12 M6 0 V12" stroke={BRASS} strokeWidth="0.5" opacity="0.35" />
            <g transform="translate(3.6 3.6) scale(0.048)"><path fill="#E85D00" opacity="0.55" d="M50 92 C 22 70 3 52 3 31 C 3 16 14 5 28 5 C 38 5 46 11 50 21 C 54 11 62 5 72 5 C 86 5 97 16 97 31 C 97 52 78 70 50 92 Z" /></g>
          </pattern>
        </defs>
        <rect width="100" height="140" rx="6" fill={PAPER} />
        <rect x="5" y="5" width="90" height="130" rx="2.5" fill="#152633" />
        <rect x="5" y="5" width="90" height="130" rx="2.5" fill={`url(#lat${id})`} />
        <rect x="8" y="8" width="84" height="124" rx="1.5" fill="none" stroke={BRASS} strokeWidth="0.8" opacity="0.7" />
        <circle cx="50" cy="70" r="24" fill="#152633" stroke={BRASS} strokeWidth="1.2" />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} transform={`rotate(${i * 72} 50 70)`}>
            <Pip suit="H" x={50} y={57} size={13} fill="#E85D00" flip />
          </g>
        ))}
        <circle cx="50" cy="70" r="3" fill={BRASS} />
      </svg>
      <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '6% / 4.3%', background: 'linear-gradient(160deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 40%)' }} />
    </div>
  );
});
CardBack.displayName = 'CardBack';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

/**
 * Big words over the pile when a play deserves them. Size, color and hang time scale with how
 * strong the play is. A new play's callout replaces the current one at once; a queued one (a
 * player going out) waits its turn, so two never print on top of each other.
 */
export interface CalloutSpec {
  text: string;
  level: 1 | 2 | 3 | 4;
  sub?: string;
  x: number;
  y: number;
  /** widest it may be here without running into a seat (GameTable works out the lane) */
  maxW?: number;
  /** font size in px; defaults to the level's size */
  fontPx?: number;
  /** stack the word on two lines (split at the middle space) */
  lines?: 1 | 2;
  /** tilt in degrees once settled */
  tilt?: number;
  /** how far it may scale past 1 before running off the screen (caps the pop-in overshoot) */
  maxScale?: number;
  /** wait for the current callout to finish instead of replacing it */
  queue?: boolean;
}

type Item = CalloutSpec & { id: number };
const listeners = new Set<(c: Item) => void>();
let nextId = 1;

export function showCallout(c: CalloutSpec) {
  const item = { ...c, id: nextId++ };
  listeners.forEach((l) => l(item));
}

/** Largest size per level, as [min px, vw, max px]. */
const SIZE: Record<number, [number, number, number]> = { 1: [26, 7, 40], 2: [32, 9, 60], 3: [44, 13, 104], 4: [34, 10, 84] };

/** The lettering face. Measuring before it loads would size every callout for the fallback. */
const FACE = 'Bangers';
if (typeof document !== 'undefined') void document.fonts?.load(`48px ${FACE}`).catch(() => {});

/**
 * Font size for a callout: as big as its level allows, but always one line that fits `maxW`
 * (Bangers caps run about 0.5em wide; the burst frame adds about 0.7em).
 */
export function calloutFontPx(level: number, vw: number, text: string, maxW: number) {
  const [lo, v, hi] = SIZE[level] ?? SIZE[1];
  const byLevel = Math.max(lo, Math.min(hi, (vw * v) / 100));
  return Math.max(18, Math.min(byLevel, (maxW - 16) / (text.length * 0.5 + (level >= 2 ? 0.7 : 0.1))));
}
/** Smallest a callout may shrink to find a clear spot, per level: big plays stay big. */
export const CALLOUT_FLOOR: Record<number, number> = { 1: 24, 2: 32, 3: 48, 4: 44 };
let ruler: CanvasRenderingContext2D | null = null;
/** Split a callout at the space nearest its middle, for a two-line stack. */
export function splitCallout(text: string): [string, string] | null {
  let best = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (best < 0 || Math.abs(i - text.length / 2) < Math.abs(best - text.length / 2))) best = i;
  return best < 0 ? null : [text.slice(0, best), text.slice(best + 1)];
}
/** How much a callout tilts: about 4 degrees, less on a long word so its ends don't swing far. */
export const calloutTilt = (level: number, w: number) => (level === 4 ? 0 : Math.min(4, (Math.asin(Math.min(1, 24 / w)) * 180) / Math.PI));
/**
 * Box of a callout at a font size, on one line or stacked on two: the widest line (measured with
 * the real face, plus its stroke) or the name tag, whichever is wider, and the half height of the
 * word(s) + tag. The tilt is left to the caller.
 */
export function calloutSize(font: number, text: string, level: number, sub?: string, lines: 1 | 2 = 1) {
  ruler ??= document.createElement('canvas').getContext('2d');
  const parts = lines === 2 ? splitCallout(text) ?? [text] : [text];
  let ink = 0;
  for (const t of parts) {
    let m = t.length * 0.52 * font;
    if (ruler) {
      ruler.font = `${font}px ${FACE}, Impact, sans-serif`;
      m = ruler.measureText(t).width;
    }
    ink = Math.max(ink, m + t.length * LETTER_SPACING * font);
  }
  // Stroke on both sides, then the burst frame around the word for plays loud enough to get one.
  const word = ink + font * 0.14 + 16 + (level >= 2 ? font * BURST_PAD_X * 2 : 0);
  const tag = sub ? sub.length * 8.8 + 18 : 0;
  return { w: Math.max(word, tag), hh: calloutHalfHeight(font, parts.length, level) };
}
/** Half the height a callout takes (word lines + burst + name tag), for finding it a clear lane. */
export const calloutHalfHeight = (fontPx: number, lines = 1, level = 1) =>
  (fontPx * (0.95 * lines + 0.03 + (level >= 2 ? BURST_PAD_Y * 2 : 0)) + 28) / 2 + 4;
const LETTER_SPACING = 0.03;
/** How far the burst reaches past the word, in ems, on each side. */
const BURST_PAD_X = 0.38;
const BURST_PAD_Y = 0.3;

/**
 * Per level: the lettering (fill, ink stroke), the burst behind it (none for small plays), the
 * focus lines inside the burst, a made-up sound effect in katakana, and how long it hangs.
 */
const STYLE: Record<number, { size: string; color: string; stroke: string; hold: number; burst?: string; lines?: string; sfx?: string }> = {
  1: { size: 'clamp(26px, 7vw, 40px)', color: '#FAFAF7', stroke: '#0B0B0D', hold: 650 },
  2: { size: 'clamp(32px, 9vw, 60px)', color: '#0B0B0D', stroke: '#FAFAF7', hold: 900, burst: '#FAFAF7', lines: 'rgba(11,11,13,.22)', sfx: 'ズバッ' },
  3: { size: 'clamp(44px, 13vw, 104px)', color: '#FAFAF7', stroke: '#0B0B0D', hold: 1250, burst: '#E85D00', lines: 'rgba(11,11,13,.3)', sfx: 'ドドン' },
  4: { size: 'clamp(34px, 10vw, 84px)', color: '#FAFAF7', stroke: '#0B0B0D', hold: 1500, burst: '#D7192B', lines: 'rgba(11,11,13,.34)', sfx: 'ゴゴゴ' },
};

/** A tiny seeded random, so each callout's burst is jagged in its own way but stable per render. */
function rand(seed: number) {
  let t = seed * 2654435761;
  return () => { t ^= t << 13; t ^= t >>> 17; t ^= t << 5; return ((t >>> 0) % 1000) / 1000; };
}

/**
 * The impact burst: a jagged star stretched to the callout's box, with a ring of focus lines
 * clipped inside it. Spikes touch the box edge, so it never reaches past the space the callout
 * was given.
 */
const Burst: React.FC<{ fill: string; lines: string; seed: number; big: boolean }> = ({ fill, lines, seed, big }) => {
  const r = rand(seed);
  const n = big ? 22 : 16;
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + (r() - 0.5) * 0.08;
    const k = i % 2 === 0 ? 0.94 + r() * 0.06 : 0.7 + r() * 0.08;
    pts.push(`${(50 + Math.cos(a) * 50 * k).toFixed(2)},${(50 + Math.sin(a) * 50 * k).toFixed(2)}`);
  }
  const rays: React.ReactNode[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + r() * 0.05;
    const r0 = 0.5 + r() * 0.14;
    rays.push(<line key={i} x1={50 + Math.cos(a) * 50 * r0} y1={50 + Math.sin(a) * 50 * r0} x2={50 + Math.cos(a) * 60} y2={50 + Math.sin(a) * 60} />);
  }
  const id = `burst${seed}`;
  return (
    <svg aria-hidden className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs><clipPath id={id}><polygon points={pts.join(' ')} /></clipPath></defs>
      {/* hard ink offset under the burst, the way a panel sits on the page */}
      <polygon points={pts.join(' ')} fill="#000" transform="translate(1.4 2.2)" />
      <polygon points={pts.join(' ')} fill={fill} stroke="#0B0B0D" strokeWidth={big ? 5 : 4} vectorEffect="non-scaling-stroke" strokeLinejoin="miter" />
      <g clipPath={`url(#${id})`} stroke={lines} strokeWidth={1.4} vectorEffect="non-scaling-stroke">{rays}</g>
    </svg>
  );
};

/**
 * Where the pop-in starts. The spring undershoots below 1 and rebounds about 16% of the way back
 * above it (40% overshoot twice for the big-play spring), so start low enough that the rebound
 * stays inside the screen, and no higher than the screen allows for the first visible frames.
 */
function popFrom(item: Item) {
  const want = item.level >= 3 ? 2.6 : 1.8;
  const room = item.maxScale ?? Infinity;
  if (!Number.isFinite(room)) return want;
  const k = item.level >= 3 ? 0.16 : 0.05;
  return Math.max(1, Math.min(want, 1 + (room - 1) / k, room * 1.6));
}

export const Callouts: React.FC = () => {
  const [item, setItem] = useState<Item | null>(null);
  const [waiting, setWaiting] = useState<Item[]>([]);
  const itemRef = useRef(item);
  itemRef.current = item;
  useEffect(() => {
    const on = (c: Item) => {
      if (c.queue && itemRef.current) setWaiting((w) => [...w, c]);
      else setItem(c);
    };
    listeners.add(on);
    return () => { listeners.delete(on); };
  }, []);
  useEffect(() => {
    if (!item) return;
    const t = window.setTimeout(() => setItem((cur) => (cur?.id === item.id ? null : cur)), STYLE[item.level].hold);
    return () => clearTimeout(t);
  }, [item]);
  // Next in line goes up once the current one has had a moment to leave.
  useEffect(() => {
    if (item || waiting.length === 0) return;
    const t = window.setTimeout(() => { setItem(waiting[0]); setWaiting((w) => w.slice(1)); }, 160);
    return () => clearTimeout(t);
  }, [item, waiting]);

  const st = item ? STYLE[item.level] : null;
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 60 }} aria-live="polite">
      <AnimatePresence>
        {item && st && (
          <motion.div
            key={item.id}
            className="absolute flex flex-col items-center"
            style={{ left: item.x, top: item.y }}
            initial={{ x: '-50%', y: '-50%', scale: popFrom(item), rotate: item.level >= 3 ? -12 : -6, opacity: 0 }}
            animate={{ x: '-50%', y: '-50%', scale: 1, rotate: -(item.tilt ?? (item.level === 4 ? 0 : 4)), opacity: 1 }}
            exit={{ y: '-62%', opacity: 0, scale: 0.92, transition: { duration: 0.28, ease: 'easeIn' } }}
            transition={{ type: 'spring', stiffness: item.level >= 3 ? 620 : 520, damping: item.level >= 3 ? 14 : 20 }}
          >
            <div
              className="relative flex items-center justify-center"
              style={{ fontSize: item.fontPx ?? st.size, padding: st.burst ? `${BURST_PAD_Y}em ${BURST_PAD_X}em` : 0 }}
            >
              {st.burst && <Burst fill={st.burst} lines={st.lines!} seed={item.id} big={item.level >= 3} />}
              {st.sfx && (
                <motion.span
                  aria-hidden
                  className="font-sfx absolute select-none"
                  style={{
                    right: '-0.05em', top: '-0.18em', fontSize: '0.34em',
                    color: item.level === 2 ? '#0B0B0D' : '#FAFAF7',
                    WebkitTextStroke: `${item.level === 2 ? 3 : 4}px ${item.level === 2 ? '#FAFAF7' : '#0B0B0D'}`,
                    paintOrder: 'stroke fill', lineHeight: 1, whiteSpace: 'nowrap',
                  }}
                  initial={{ scale: 0.4, rotate: 24, opacity: 0 }}
                  animate={{ scale: 1, rotate: 12, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 700, damping: 16, delay: 0.06 }}
                >
                  {st.sfx}
                </motion.span>
              )}
              <span
                className="relative font-display leading-[0.95] text-center"
                style={{
                  maxWidth: item.fontPx ? 'none' : '92vw',
                  textWrap: item.fontPx ? 'nowrap' : 'balance',
                  fontWeight: 400,
                  color: st.color,
                  WebkitTextStroke: `${item.level >= 3 ? 8 : 6}px ${st.stroke}`,
                  paintOrder: 'stroke fill',
                  letterSpacing: `${LETTER_SPACING}em`,
                  textShadow: item.level === 2 ? 'none' : `0.05em 0.06em 0 ${st.stroke}`,
                }}
              >
                {item.lines === 2 && splitCallout(item.text) ? splitCallout(item.text)!.map((t, i) => <React.Fragment key={i}>{i > 0 && <br />}{t}</React.Fragment>) : item.text}
              </span>
            </div>
            {item.sub && (
              <span className="relative mt-1 font-sans tabular-nums text-[12px] font-extrabold tracking-[0.14em] uppercase text-ink bg-paper px-2.5 py-0.5 border-2 border-ink" style={{ clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)' }}>
                {item.sub}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

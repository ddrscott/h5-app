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

/**
 * Font size for a callout: as big as its level allows, but always one line that fits `maxW`
 * (Fraunces Black caps run about 0.66em wide, plus the stroke).
 */
export function calloutFontPx(level: number, vw: number, text: string, maxW: number) {
  const [lo, v, hi] = SIZE[level] ?? SIZE[1];
  const byLevel = Math.max(lo, Math.min(hi, (vw * v) / 100));
  return Math.max(18, Math.min(byLevel, (maxW - 16) / (text.length * 0.66)));
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
    let m = t.length * 0.74 * font;
    if (ruler) {
      ruler.font = `${level >= 3 ? 'italic ' : ''}900 ${font}px "Fraunces Variable", Georgia, serif`;
      m = ruler.measureText(t).width;
    }
    ink = Math.max(ink, m + t.length * 0.01 * font);
  }
  const word = ink + 8 + font * 0.07 + 8;
  const tag = sub ? sub.length * 8.8 + 18 : 0;
  return { w: Math.max(word, tag), hh: calloutHalfHeight(font, parts.length) };
}
/** Half the height a callout takes (word lines + name tag), for finding it a clear lane. */
export const calloutHalfHeight = (fontPx: number, lines = 1) => (fontPx * (0.92 * lines + 0.03) + 28) / 2 + 4;

const STYLE: Record<number, { size: string; color: string; stroke: string; hold: number; glow: string }> = {
  1: { size: 'clamp(26px, 7vw, 40px)', color: '#F6F0E2', stroke: '#0A1012', hold: 650, glow: 'rgba(0,0,0,0)' },
  2: { size: 'clamp(32px, 9vw, 60px)', color: '#F2CF7E', stroke: '#0A1012', hold: 900, glow: 'rgba(214,165,74,.45)' },
  3: { size: 'clamp(44px, 13vw, 104px)', color: '#FF7A1A', stroke: '#0A1012', hold: 1250, glow: 'rgba(232,93,0,.7)' },
  4: { size: 'clamp(34px, 10vw, 84px)', color: '#F6F0E2', stroke: '#8E1F1A', hold: 1500, glow: 'rgba(199,53,44,.8)' },
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
            {item.level === 4 && (
              <motion.div
                aria-hidden
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{ width: 260, height: 260, marginLeft: -130, marginTop: -130, background: 'radial-gradient(circle, rgba(199,53,44,.55), rgba(199,53,44,0) 65%)' }}
                initial={{ scale: 0.2, opacity: 1 }}
                animate={{ scale: 2.4, opacity: 0 }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
              />
            )}
            <span
              className="font-display leading-[0.92] text-center"
              style={{
                fontSize: item.fontPx ?? st.size,
                maxWidth: item.fontPx ? 'none' : '92vw',
                textWrap: item.fontPx ? 'nowrap' : 'balance',
                fontWeight: 900,
                fontStyle: item.level >= 3 ? 'italic' : 'normal',
                color: st.color,
                WebkitTextStroke: `${item.level >= 3 ? 7 : 5}px ${st.stroke}`,
                paintOrder: 'stroke fill',
                letterSpacing: '0.01em',
                fontVariationSettings: '"SOFT" 100, "WONK" 1, "opsz" 144',
                textShadow: `0 4px 0 ${st.stroke}, 0 0 28px ${st.glow}`,
              }}
            >
              {item.lines === 2 && splitCallout(item.text) ? splitCallout(item.text)!.map((t, i) => <React.Fragment key={i}>{i > 0 && <br />}{t}</React.Fragment>) : item.text}
            </span>
            {item.sub && (
              <span className="mt-1 font-mono text-[11px] font-bold tracking-[0.2em] uppercase text-bone/90 bg-ink/70 px-2 py-0.5 border border-white/15">
                {item.sub}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

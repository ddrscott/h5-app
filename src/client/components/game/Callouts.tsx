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
/** Half the height a callout takes (word + name tag), for finding it a clear lane. */
export const calloutHalfHeight = (fontPx: number) => (fontPx * 0.95 + 28) / 2 + 4;

const STYLE: Record<number, { size: string; color: string; stroke: string; hold: number; glow: string }> = {
  1: { size: 'clamp(26px, 7vw, 40px)', color: '#F6F0E2', stroke: '#0A1012', hold: 650, glow: 'rgba(0,0,0,0)' },
  2: { size: 'clamp(32px, 9vw, 60px)', color: '#F2CF7E', stroke: '#0A1012', hold: 900, glow: 'rgba(214,165,74,.45)' },
  3: { size: 'clamp(44px, 13vw, 104px)', color: '#FF7A1A', stroke: '#0A1012', hold: 1250, glow: 'rgba(232,93,0,.7)' },
  4: { size: 'clamp(34px, 10vw, 84px)', color: '#F6F0E2', stroke: '#8E1F1A', hold: 1500, glow: 'rgba(199,53,44,.8)' },
};

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
            initial={{ x: '-50%', y: '-50%', scale: item.level >= 3 ? 2.6 : 1.8, rotate: item.level >= 3 ? -12 : -6, opacity: 0 }}
            animate={{ x: '-50%', y: '-50%', scale: 1, rotate: item.level === 4 ? 0 : -4, opacity: 1 }}
            exit={{ y: '-90%', opacity: 0, scale: 0.92, transition: { duration: 0.28, ease: 'easeIn' } }}
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
                maxWidth: item.maxW ? Math.max(140, item.maxW) : '92vw',
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
              {item.text}
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

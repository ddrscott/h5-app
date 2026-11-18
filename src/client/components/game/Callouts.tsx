import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

/**
 * Big words over the pile when a play deserves them. Size, color and hang time scale with how
 * strong the play is; the next callout replaces the current one at once, so nothing queues up.
 */
export interface CalloutSpec {
  text: string;
  level: 1 | 2 | 3 | 4;
  sub?: string;
  x: number;
  y: number;
}

type Item = CalloutSpec & { id: number };
const listeners = new Set<(c: Item) => void>();
let nextId = 1;

export function showCallout(c: CalloutSpec) {
  const item = { ...c, id: nextId++ };
  listeners.forEach((l) => l(item));
}

const STYLE: Record<number, { size: string; color: string; stroke: string; hold: number; glow: string }> = {
  1: { size: 'clamp(26px, 7vw, 40px)', color: '#F6F0E2', stroke: '#0A1012', hold: 650, glow: 'rgba(0,0,0,0)' },
  2: { size: 'clamp(32px, 9vw, 60px)', color: '#F2CF7E', stroke: '#0A1012', hold: 900, glow: 'rgba(214,165,74,.45)' },
  3: { size: 'clamp(44px, 13vw, 104px)', color: '#FF7A1A', stroke: '#0A1012', hold: 1250, glow: 'rgba(232,93,0,.7)' },
  4: { size: 'clamp(40px, 12vw, 84px)', color: '#F6F0E2', stroke: '#8E1F1A', hold: 1500, glow: 'rgba(199,53,44,.8)' },
};

export const Callouts: React.FC = () => {
  const [item, setItem] = useState<Item | null>(null);
  useEffect(() => {
    const on = (c: Item) => setItem(c);
    listeners.add(on);
    return () => { listeners.delete(on); };
  }, []);
  useEffect(() => {
    if (!item) return;
    const t = window.setTimeout(() => setItem((cur) => (cur?.id === item.id ? null : cur)), STYLE[item.level].hold);
    return () => clearTimeout(t);
  }, [item]);

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
                fontSize: st.size,
                maxWidth: '92vw',
                textWrap: 'balance',
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

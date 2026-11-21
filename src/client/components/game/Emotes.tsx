import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { registry } from '../../fx/layout';

/**
 * Chinese internet reactions that pop off a player's seat on the big moments: 牛！ for the Heart 5,
 * 666 for a bomb, 绝了！ for a straight flush, and 溜了！ for the first one out. A paper sticker with an
 * ink outline and a hard offset, tilted, that floats up and fades. Purely decoration: it never takes
 * a click. (The loser's 我太难了 sits on the results screen, GameOver.tsx, since that covers the seats
 * the moment the game ends.)
 */
export interface EmoteSpec {
  /** whose seat it pops off (your own id for your plate) */
  playerId: string;
  text: string;
  /** orange sticker instead of paper, for the loudest moments */
  hot?: boolean;
}

interface Live extends EmoteSpec { id: number; x: number; y: number; tilt: number }

const HOLD_MS = 1900;
let listener: ((e: EmoteSpec) => void) | null = null;

/** Pop an emote off a seat. Safe to call before the layer mounts (it's dropped). */
export function showEmote(e: EmoteSpec) { listener?.(e); }

let nextId = 1;

export const Emotes: React.FC = () => {
  const [live, setLive] = useState<Live[]>([]);
  useEffect(() => {
    listener = (e) => {
      const r = registry.seatRect(e.playerId);
      const vw = window.innerWidth;
      // just above the seat's plate, kept on screen
      const x = Math.min(vw - 70, Math.max(70, r ? r.left + r.width / 2 : vw / 2));
      const y = Math.max(70, r ? r.top - 12 : window.innerHeight / 2);
      const id = nextId++;
      const tilt = (id % 2 ? -1 : 1) * (5 + (id % 3) * 2);
      // one per seat at a time: a new one replaces that seat's last
      setLive((l) => [...l.filter((o) => o.playerId !== e.playerId), { ...e, id, x, y, tilt }]);
      window.setTimeout(() => setLive((l) => l.filter((o) => o.id !== id)), HOLD_MS);
    };
    return () => { listener = null; };
  }, []);

  return (
    <div aria-hidden className="fixed inset-0 pointer-events-none" style={{ zIndex: 62 }}>
      <AnimatePresence>
        {live.map((e) => (
          <motion.div
            key={e.id}
            className="absolute"
            style={{ left: e.x, top: e.y }}
            initial={{ x: '-50%', y: '-60%', scale: 0.2, rotate: e.tilt * 3, opacity: 0 }}
            animate={{ x: '-50%', y: '-100%', scale: 1, rotate: e.tilt, opacity: 1 }}
            exit={{ y: '-170%', opacity: 0, transition: { duration: 0.35, ease: 'easeIn' } }}
            transition={{ type: 'spring', stiffness: 520, damping: 15 }}
          >
            <span
              className="font-sfx block whitespace-nowrap leading-none border-[3px] border-ink px-3 pt-2 pb-1.5 text-[clamp(26px,4.2vw,44px)]"
              style={{
                background: e.hot ? '#E85D00' : '#FAFAF7',
                color: e.hot ? '#FAFAF7' : '#0B0B0D',
                boxShadow: '4px 5px 0 #000',
                WebkitTextStroke: e.hot ? '1px #0B0B0D' : undefined,
                paintOrder: 'stroke fill',
              }}
            >
              {e.text}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

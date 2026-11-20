import React from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { CardFace } from './CardFace';

interface BannerProps {
  className?: string;
}

const FAN: Array<{ suit: string; rank: number; x: number; r: number; y: number }> = [
  { suit: 'S', rank: 14, x: -1.9, r: -20, y: 18 },
  { suit: 'D', rank: 15, x: -0.95, r: -10, y: 5 },
  { suit: 'H', rank: 5, x: 0, r: 0, y: -10 },
  { suit: 'C', rank: 13, x: 0.95, r: 10, y: 5 },
  { suit: 'J', rank: 17, x: 1.9, r: 20, y: 18 },
];

/**
 * The title: five cards fanned around the Heart of Five, breathing on their own and leaning
 * toward the pointer as a group.
 */
export const Banner: React.FC<BannerProps> = ({ className = '' }) => {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 120, damping: 14 });
  const sy = useSpring(my, { stiffness: 120, damping: 14 });
  const rotY = useTransform(sx, [-1, 1], [-14, 14]);
  const rotX = useTransform(sy, [-1, 1], [10, -10]);
  const w = 'clamp(62px, 17vw, 112px)';

  return (
    <div
      className={`select-none ${className}`}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
        my.set(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
      onPointerLeave={() => { mx.set(0); my.set(0); }}
    >
      {/* focus lines rushing at the fan, the opening splash page */}
      <div aria-hidden className="relative">
        <div className="speed-lines absolute left-1/2 top-1/2 pointer-events-none"
          style={{ width: 1400, height: 1400, marginLeft: -700, marginTop: -620, color: 'rgba(250,250,247,.09)',
            WebkitMaskImage: 'radial-gradient(circle, transparent 14%, #000 30%, transparent 60%)', maskImage: 'radial-gradient(circle, transparent 14%, #000 30%, transparent 60%)' }} />
      </div>
      <motion.div className="relative mx-auto" style={{ width: `calc(${w} * 4.2)`, height: `calc(${w} * 1.75)`, rotateX: rotX, rotateY: rotY, transformPerspective: 900 }}>
        {FAN.map((c, i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{ width: w, aspectRatio: '5 / 7', marginLeft: `calc(${w} / -2)`, marginTop: `calc(${w} * -0.7)`, zIndex: c.rank === 5 ? 10 : i, filter: 'drop-shadow(5px 6px 0 rgba(0,0,0,.85))' }}
            initial={{ y: 120, rotate: 0, opacity: 0, x: 0 }}
            animate={{ y: c.y, rotate: c.r, opacity: 1, x: `calc(${w} * ${c.x * 0.78})` }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.15 + Math.abs(i - 2) * 0.08 }}
            whileHover={{ y: c.y - 16, scale: 1.06, transition: { type: 'spring', stiffness: 500, damping: 16 } }}
          >
            <div className="w-full h-full idle-float" style={{ animationDelay: `${-i * 0.7}s` }}>
              <CardFace suit={c.suit} rank={c.rank} />
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div className="text-center mt-2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <h1 className="relative font-display text-paper leading-[0.88] tracking-[0.03em] text-[clamp(52px,14vw,104px)]"
          style={{ WebkitTextStroke: '0.09em #0B0B0D', paintOrder: 'stroke fill', textShadow: '0.07em 0.07em 0 #000' }}>
          Heart <span className="text-blood">of</span> Five
        </h1>
        <div className="mt-3 flex items-center justify-center gap-3">
          <span className="font-seal font-black text-[14px] px-1.5 py-0.5 bg-blood text-paper border-2 border-ink shadow-hard-sm -rotate-3 whitespace-nowrap shrink-0">红心五</span>
          <span className="font-display text-[16px] sm:text-[18px] tracking-[0.08em] text-bone">A family card brawl · 2–6 players</span>
        </div>
      </motion.div>
    </div>
  );
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'motion/react';
import type { Card as CardType } from '../../types/game';
import { CardFace, CardBack } from '../ui/CardFace';
import type { Viewport, Slot } from '../../fx/layout';
import { fan } from '../../fx/layout';
import { sfx } from '../../fx/sound';
import { haptics } from '../../fx/haptics';

interface PlayerHandProps {
  hand: CardType[];
  selectedCards: Set<string>;
  onCardSelect: (cardKey: string) => void;
  vp: Viewport;
  /** Changes when a new deal lands, so the hand animates in from the table. */
  dealId: number;
  myTurn: boolean;
}

const keyOf = (c: CardType) => c.code || `${c.rank}${c.suit}`;

interface HandCardProps {
  card: CardType;
  slot: Slot;
  index: number;
  vp: Viewport;
  selected: boolean;
  dealing: boolean;
  dealDelay: number;
  onPointerDown: (code: string, e: React.PointerEvent) => void;
  onKeyToggle: (code: string) => void;
}

const HandCard: React.FC<HandCardProps> = React.memo(({ card, slot, index, vp, selected, dealing, dealDelay, onPointerDown, onKeyToggle }) => {
  const code = keyOf(card);
  const reduce = useReducedMotion();
  const [hover, setHover] = useState(false);
  // Our own press dip. Motion's whileTap would turn Enter on a focused card into a synthetic
  // pointerdown, which toggles the card off just as Enter plays it.
  const [pressed, setPressed] = useState(false);
  // Tilt toward the pointer (desktop): springy rotateX/Y plus a highlight that follows it.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 260, damping: 18 });
  const sy = useSpring(py, { stiffness: 260, damping: 18 });
  const rotateY = useTransform(sx, [0, 1], [-16, 16]);
  const rotateX = useTransform(sy, [0, 1], [14, -14]);
  const shineX = useTransform(sx, [0, 1], ['0%', '100%']);
  const shineY = useTransform(sy, [0, 1], ['0%', '100%']);
  const shine = useTransform([shineX, shineY], ([x, y]) => `radial-gradient(circle at ${x} ${y}, rgba(255,255,255,.45), rgba(255,255,255,0) 55%)`);

  const lift = selected ? vp.H * 0.26 : hover ? vp.H * 0.12 : 0;
  const scale = hover ? 1.07 : selected ? 1.03 : 1;
  const travelY = -(vp.h - vp.handBase - vp.H / 2 - vp.pileY);

  return (
    <motion.div
      data-card={code}
      data-rot={slot.rot.toFixed(2)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${card.code ?? ''}${selected ? ', selected' : ''}`}
      className="absolute cursor-pointer outline-none focus-visible:[&_.ring-focus]:opacity-100"
      style={{
        left: '50%', bottom: vp.handBase, width: vp.W, height: vp.H, marginLeft: -vp.W / 2,
        zIndex: slot.z, transformOrigin: '50% 100%', touchAction: 'none',
      }}
      initial={dealing && !reduce ? { x: 0, y: travelY, rotate: (index % 2 ? 1 : -1) * (20 + index * 7), scale: 0.5, opacity: 0 } : false}
      animate={{ x: slot.x, y: slot.y - lift, rotate: hover ? slot.rot * 0.4 : slot.rot, scale: pressed ? scale * 0.94 : scale, opacity: 1 }}
      transition={{
        type: 'spring', stiffness: selected || hover ? 520 : 380, damping: selected ? 19 : 26, mass: 0.8,
        delay: dealing ? dealDelay : 0,
        opacity: { duration: 0.12, delay: dealing ? dealDelay : 0 },
      }}
      onPointerDown={(e) => { setPressed(true); onPointerDown(code, e); }}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') { setHover(true); sfx.hover(); } }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width);
        py.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => { setHover(false); setPressed(false); px.set(0.5); py.set(0.5); }}
      onKeyDown={(e) => { if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); onKeyToggle(code); } }}
    >
      {/* idle sway: each card breathes on its own phase */}
      <div className="w-full h-full idle-float" style={{ animationDelay: `${-(index * 0.41) % 3.6}s` }}>
        <motion.div
          className="relative w-full h-full"
          style={{ rotateX: reduce ? 0 : rotateX, rotateY: reduce ? 0 : rotateY, transformPerspective: 600 }}
          initial={dealing && !reduce ? { scaleX: 1 } : false}
          animate={dealing && !reduce ? { scaleX: [1, 0.04, 1] } : undefined}
          transition={{ duration: 0.34, delay: dealDelay + 0.32, times: [0, 0.5, 1] }}
        >
          {/* contact shadow: grows and softens as the card lifts */}
          <motion.div
            aria-hidden
            className="absolute inset-0"
            // a soft shadow drawn as a gradient, not a blur filter: a filter re-rasters the whole
            // blur every frame the shadow moves, and there are fourteen of these
            style={{ borderRadius: '10% / 7%', background: 'radial-gradient(ellipse 60% 56% at 50% 52%, rgba(0,0,0,.6) 55%, rgba(0,0,0,0) 100%)', transform: 'scale(1.12)' }}
            animate={{ y: 4 + lift * 0.35, scale: 1 - lift / vp.H * 0.12, opacity: 0.55 - lift / vp.H * 0.6 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          />
          <CardFace suit={card.suit} rank={card.rank} />
          {dealing && !reduce && (
            <motion.div className="absolute inset-0" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.01, delay: dealDelay + 0.49 }}>
              <CardBack />
            </motion.div>
          )}
          {/* light catching the card as you tilt it */}
          {/* only while hovered: a blend mode makes the browser composite the card's backdrop separately */}
          {hover && <motion.div aria-hidden className="absolute inset-0 pointer-events-none" style={{ borderRadius: '6% / 4.3%', background: shine, mixBlendMode: 'soft-light' }} />}
          {/* selection: ember edge and a warm underglow */}
          <motion.div
            aria-hidden
            className="absolute -inset-[3px] pointer-events-none"
            style={{ borderRadius: '8% / 6%', boxShadow: '0 0 0 2.5px #E85D00, 0 0 18px 2px rgba(232,93,0,.55)' }}
            initial={false}
            animate={{ opacity: selected ? 1 : 0 }}
            transition={{ duration: 0.12 }}
          />
          <div aria-hidden className="ring-focus absolute -inset-[5px] opacity-0 pointer-events-none" style={{ outline: '2px dashed #F2CF7E', borderRadius: 4 }} />
        </motion.div>
      </div>
    </motion.div>
  );
});
HandCard.displayName = 'HandCard';

export const PlayerHand: React.FC<PlayerHandProps> = ({ hand, selectedCards, onCardSelect, vp, dealId, myTurn }) => {
  const slots = useMemo(() => fan(hand.length, vp).slots, [hand.length, vp]);
  const selectedRef = useRef(selectedCards);
  selectedRef.current = selectedCards;

  // A new deal plays the deal-in animation for about a second; anything after that is instant.
  const [dealingFor, setDealingFor] = useState(0);
  useEffect(() => {
    if (!dealId || hand.length === 0) return;
    setDealingFor(dealId);
    const n = hand.length;
    const timers: number[] = [];
    for (let i = 0; i < n; i++) timers.push(window.setTimeout(() => sfx.deal(), i * 55 + 30));
    timers.push(window.setTimeout(() => setDealingFor(0), n * 55 + 900));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, hand.length > 0]);
  const dealing = dealingFor !== 0 && dealingFor === dealId;

  const onSelectRef = useRef(onCardSelect);
  onSelectRef.current = onCardSelect;
  // Stable callbacks so a re-render of the table doesn't re-render every card.
  const toggle = useCallback((code: string) => {
    const wasSelected = selectedRef.current.has(code);
    onSelectRef.current(code);
    if (wasSelected) sfx.deselect();
    else { sfx.select(selectedRef.current.size + 1); haptics.tap(); }
  }, []);

  // Press on a card to toggle it; keep the pointer down and sweep across others to give them
  // the same state (select a run in one stroke, or clear several).
  const drag = useRef<{ mode: 'select' | 'deselect'; seen: Set<string> } | null>(null);
  const onPointerDown = useCallback((code: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const mode = selectedRef.current.has(code) ? 'deselect' : 'select';
    drag.current = { mode, seen: new Set([code]) };
    toggle(code);
  }, [toggle]);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-card]');
      const code = el?.dataset.card;
      if (!code || d.seen.has(code)) return;
      d.seen.add(code);
      const isSel = selectedRef.current.has(code);
      if ((d.mode === 'select') !== isSel) toggle(code);
    };
    const up = () => { drag.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: vp.handBase + vp.H * 2.2 }}>
      {/* your-turn warmth under the hand */}
      <motion.div
        aria-hidden
        className="absolute left-1/2 pointer-events-none"
        style={{ bottom: vp.handBase - vp.H * 0.6, width: Math.min(vp.w * 1.1, 1100), height: vp.H * 2.4, marginLeft: -Math.min(vp.w * 1.1, 1100) / 2,
          background: 'radial-gradient(ellipse 50% 50% at 50% 60%, rgba(232,93,0,.30), rgba(232,93,0,0) 70%)' }}
        initial={false}
        animate={{ opacity: myTurn ? 1 : 0 }}
        transition={{ duration: 0.4 }}
      />
      <div className="absolute inset-0 pointer-events-auto" style={{ pointerEvents: 'none' }}>
        {hand.map((card, i) => {
          const code = keyOf(card);
          return (
            <div key={`${dealId}-${code}`} className="pointer-events-auto">
              <HandCard
                card={card}
                slot={slots[i]}
                index={i}
                vp={vp}
                selected={selectedCards.has(code)}
                dealing={dealing}
                dealDelay={i * 0.055}
                onPointerDown={onPointerDown}
                onKeyToggle={toggle}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

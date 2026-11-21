import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'motion/react';
import type { Card as CardType } from '../../types/game';
import { CardFace, CardBack } from '../ui/CardFace';
import type { Viewport, Slot } from '../../fx/layout';
import { fan } from '../../fx/layout';
import { sfx } from '../../fx/sound';
import { haptics } from '../../fx/haptics';
import { codeOf, loadOrder, moveTo, reconcile, sameOrder, saveOrder, sortCodes, type SortKind } from '../../fx/handOrder';
import { loadSeat } from '../../net/seat';

interface PlayerHandProps {
  hand: CardType[];
  selectedCards: Set<string>;
  onCardSelect: (cardKey: string) => void;
  vp: Viewport;
  /** Changes when a new deal lands, so the hand animates in from the table. */
  dealId: number;
  myTurn: boolean;
}

const keyOf = codeOf;

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
  onKeyMove: (code: string, by: number) => void;
  /** Where this card is while you drag it (slot coordinates), or null when it sits in the fan. */
  drag: { x: number; y: number } | null;
  /** Some card is being dragged: the rest stop reacting to hover so they just make room. */
  dragging: boolean;
}

const HandCard: React.FC<HandCardProps> = React.memo(({ card, slot, index, vp, selected, dealing, dealDelay, onPointerDown, onKeyToggle, onKeyMove, drag, dragging }) => {
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

  const hovered = hover && !dragging;
  const lift = drag ? 0 : selected ? vp.H * 0.26 : hovered ? vp.H * 0.12 : 0;
  const scale = drag ? 1.1 : hovered ? 1.07 : selected ? 1.03 : 1;
  const travelY = -(vp.h - vp.handBase - vp.H / 2 - vp.pileY);

  return (
    <motion.div
      data-card={code}
      data-rot={slot.rot.toFixed(2)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${card.code ?? ''}${selected ? ', selected' : ''}`}
      className={`absolute outline-none select-none focus-visible:[&_.ring-focus]:opacity-100 ${drag ? 'cursor-grabbing' : 'cursor-pointer'}`}
      style={{
        left: '50%', bottom: vp.handBase, width: vp.W, height: vp.H, marginLeft: -vp.W / 2,
        zIndex: drag ? 200 : slot.z, transformOrigin: '50% 100%', touchAction: 'none',
      }}
      initial={dealing && !reduce ? { x: 0, y: travelY, rotate: (index % 2 ? 1 : -1) * (20 + index * 7), scale: 0.5, opacity: 0 } : false}
      animate={drag
        ? { x: drag.x, y: drag.y, rotate: 0, scale, opacity: 1 }
        : { x: slot.x, y: slot.y - lift, rotate: hovered ? slot.rot * 0.4 : slot.rot, scale: pressed ? scale * 0.94 : scale, opacity: 1 }}
      transition={drag
        // held: stay glued to the finger with just a hint of spring
        ? { type: 'spring', stiffness: 1600, damping: 70, mass: 0.5 }
        : {
          type: 'spring', stiffness: selected || hovered ? 520 : 380, damping: selected ? 19 : 26, mass: 0.8,
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
      onKeyDown={(e) => {
        if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); onKeyToggle(code); }
        // Shift+arrows move the focused card along the hand
        else if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); onKeyMove(code, e.key === 'ArrowLeft' ? -1 : 1); }
      }}
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
          {hovered && <motion.div aria-hidden className="absolute inset-0 pointer-events-none" style={{ borderRadius: '6% / 4.3%', background: shine, mixBlendMode: 'soft-light' }} />}
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

/** How far a press has to travel before it turns into a drag (a finger wobbles more than a mouse). */
const DRAG_PX = { mouse: 5, touch: 10 };

interface Press {
  code: string;
  pointerId: number;
  touch: boolean;
  x0: number;
  y0: number;
  /** pointer minus the card's centre, so the card doesn't jump to sit centred under it */
  grabX: number;
  grabY: number;
  /** null: still deciding; true: dragging; false: neither a tap nor a drag (a finger swiped up or down) */
  drag: boolean | null;
}

/**
 * Where a fanned card's centre looks to be, in slot coordinates. Cards tilt about their bottom
 * edge, so a tilted card's centre leans off its slot point by half its height.
 */
const seenCentre = (slot: Slot, H: number, lift = 0) => {
  const t = (slot.rot * Math.PI) / 180;
  return { x: slot.x + (H / 2) * Math.sin(t), y: slot.y - lift + (H / 2) * (1 - Math.cos(t)) };
};

/** This tab's room and seat, so a reload finds its own order (the FX lab has none and keeps it in memory). */
const seatTag = () => { const s = loadSeat(); return s ? `${s.roomId.toUpperCase()}/${s.sessionId}` : null; };

export const PlayerHand: React.FC<PlayerHandProps> = ({ hand, selectedCards, onCardSelect, vp, dealId, myTurn }) => {
  const selectedRef = useRef(selectedCards);
  selectedRef.current = selectedCards;

  // ---------- the order: yours alone, kept for the round and across a reload ----------
  const [stored, setStored] = useState<string[] | null>(() => { const t = seatTag(); return t ? loadOrder(t) : null; });
  const order = useMemo(() => reconcile(stored, hand), [stored, hand]);
  const byCode = useMemo(() => new Map(hand.map((c) => [keyOf(c), c])), [hand]);
  useEffect(() => {
    if (!stored || !sameOrder(stored, order)) setStored(order);
    const t = seatTag();
    if (t && order.length) saveOrder(t, order);
  }, [order, stored]);
  // a new deal always starts in rank order (reconcile spots that too; this covers a lookalike hand)
  const firstDeal = useRef(dealId);
  useEffect(() => {
    if (dealId === firstDeal.current) return;
    firstDeal.current = dealId;
    setStored(null);
  }, [dealId]);
  const orderRef = useRef(order);
  orderRef.current = order;

  // ---------- dragging ----------
  const [dragView, setDragView] = useState<{ code: string; x: number; y: number; to: number } | null>(null);
  const dragRef = useRef(dragView);
  dragRef.current = dragView;
  const live = dragView && byCode.has(dragView.code) ? dragView : null;
  const shown = live ? moveTo(order, live.code, live.to) : order;
  const fanned = useMemo(() => fan(shown.length, vp), [shown.length, vp]);
  const slots = fanned.slots;
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const vpRef = useRef(vp);
  vpRef.current = vp;
  const boxRef = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);

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

  /** Slot coordinates (what a card's x/y animate to) for a point on screen. */
  const toSlot = (clientX: number, clientY: number) => {
    const r = boxRef.current!.getBoundingClientRect();
    const v = vpRef.current;
    return { x: clientX - (r.left + r.width / 2), y: clientY - (r.bottom - v.handBase - v.H / 2) };
  };

  // Tap a card to select it; press and slide it sideways to move it. A tap selects on release, so
  // a drag never selects anything and a tap never moves anything.
  const onPointerDown = useCallback((code: string, e: React.PointerEvent) => {
    if (e.button !== 0 || press.current || !boxRef.current) return;
    const i = orderRef.current.indexOf(code);
    const slot = slotsRef.current[i];
    if (!slot) return;
    const p = toSlot(e.clientX, e.clientY);
    const H = vpRef.current.H;
    // a selected card rides higher, and so does one under the mouse
    const c = seenCentre(slot, H, selectedRef.current.has(code) ? H * 0.26 : e.pointerType === 'mouse' ? H * 0.12 : 0);
    press.current = {
      code, pointerId: e.pointerId, touch: e.pointerType !== 'mouse', x0: e.clientX, y0: e.clientY,
      grabX: p.x - c.x, grabY: p.y - c.y, drag: null,
    };
     
  }, []);

  useEffect(() => {
    // the slot whose card would look nearest the held card (rows count a bit more than columns)
    const nearest = (x: number, y: number) => {
      const s = slotsRef.current;
      const H = vpRef.current.H;
      let best = 0, bestD = Infinity;
      for (let i = 0; i < s.length; i++) {
        const c = seenCentre(s[i], H);
        const d = (c.x - x) ** 2 + ((c.y - y) * 1.4) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    };
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (!p || e.pointerId !== p.pointerId || p.drag === false) return;
      if (p.drag === null) {
        const dx = e.clientX - p.x0, dy = e.clientY - p.y0;
        const far = Math.hypot(dx, dy) > (p.touch ? DRAG_PX.touch : DRAG_PX.mouse);
        if (!far) return;
        // a finger has to go sideways; one that slides up or down is neither a tap nor a drag
        if (p.touch && Math.abs(dx) < Math.abs(dy)) { p.drag = false; return; }
        p.drag = true;
        haptics.tap();
      }
      const at = toSlot(e.clientX, e.clientY);
      const x = at.x - p.grabX, y = at.y - p.grabY;
      const view = { code: p.code, x, y, to: nearest(x, y) };
      dragRef.current = view;
      setDragView(view);
    };
    const up = (e: PointerEvent) => {
      const p = press.current;
      if (!p || e.pointerId !== p.pointerId) return;
      press.current = null;
      if (p.drag === null) { toggle(p.code); return; }
      if (!p.drag) return;
      const d = dragRef.current;
      if (d && orderRef.current.includes(d.code)) {
        const next = moveTo(orderRef.current, d.code, d.to);
        if (!sameOrder(next, orderRef.current)) { setStored(next); sfx.deal(); }
      }
      setDragView(null);
    };
    const cancel = (e: PointerEvent) => {
      if (press.current && e.pointerId === press.current.pointerId) { press.current = null; setDragView(null); }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
     
  }, [toggle]);

  // the card being dragged left the hand (the round ended, say): let go of it
  useEffect(() => {
    if (dragView && !byCode.has(dragView.code)) { press.current = null; setDragView(null); }
  }, [dragView, byCode]);

  const keyMove = useCallback((code: string, by: number) => {
    const o = orderRef.current;
    const at = o.indexOf(code);
    if (at < 0) return;
    setStored(moveTo(o, code, at + by));
    // React moves the card's node, which can drop focus; give it back
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-card="${CSS.escape(code)}"]`)?.focus());
  }, []);

  const sortBy = (kind: SortKind) => {
    const next = sortCodes(hand, kind);
    if (sameOrder(next, order)) return;
    setStored(next);
    sfx.deal();
  };
  const sortedAs: SortKind | null = sameOrder(order, sortCodes(hand, 'rank')) ? 'rank' : sameOrder(order, sortCodes(hand, 'suit')) ? 'suit' : null;
  // Over the right end of the hand's top row, clear of that card even when it's selected. The arc
  // dips at the ends, so this sits lower than the middle of the hand and away from your plate.
  const endSlot = slots[fanned.rows === 2 ? Math.ceil(slots.length / 2) - 1 : slots.length - 1];
  const sortBottom = vp.handBase + vp.H + (endSlot ? -endSlot.y : 0) + vp.H * 0.26 + (vp.w < 640 ? 2 : 4);
  const sortRight = Math.max(8, vp.w / 2 - ((endSlot?.x ?? 0) + vp.W / 2));

  return (
    <div ref={boxRef} data-hand-order={order.join(' ')} className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: vp.handBase + vp.H * 2.2 }}>
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
      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        {shown.map((code, i) => {
          const card = byCode.get(code);
          if (!card) return null;
          const held = live && live.code === code ? live : null;
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
                onKeyMove={keyMove}
                drag={held ? { x: held.x, y: held.y } : null}
                dragging={!!live}
              />
            </div>
          );
        })}
      </div>
      {hand.length > 1 && (
        <SortControl bottom={sortBottom} right={sortRight} stack={vp.w < 640} active={sortedAs} onSort={sortBy} />
      )}
    </div>
  );
};

/**
 * Two small sort tabs by the hand's right end: by rank (the deal order) and by suit. On a phone
 * your plate and the turn banner sit right above the hand, so the tabs stack into a short column
 * beside the plate, with the label turned on its side.
 */
const SortControl: React.FC<{ bottom: number; right: number; stack: boolean; active: SortKind | null; onSort: (k: SortKind) => void }> = ({ bottom, right, stack, active, onSort }) => (
  <div
    role="group"
    aria-label="Sort your hand"
    data-sort-control
    className="absolute flex items-stretch pointer-events-auto select-none border-2 border-paper/70 bg-ink"
    style={{ bottom, right, boxShadow: '2px 2px 0 0 #000' }}
  >
    <span
      className={`grid place-items-center text-bone/70 font-bold uppercase ${stack ? 'px-0.5 text-[9px] tracking-[0.1em]' : 'px-1.5 text-[10px] tracking-[0.08em]'}`}
      style={stack ? { writingMode: 'vertical-rl', transform: 'rotate(180deg)' } : undefined}
    >
      Sort
    </span>
    <div className={`flex ${stack ? 'flex-col' : ''}`}>
      {(['rank', 'suit'] as const).map((k, i) => (
        <button
          key={k}
          type="button"
          data-sort={k}
          onClick={() => onSort(k)}
          aria-pressed={active === k}
          title={k === 'rank' ? 'Sort by rank' : 'Sort by suit'}
          className={`font-display leading-none tracking-[0.05em] transition-colors border-paper/70 border-l-2 ${stack ? `h-6 px-1.5 text-[14px] ${i ? 'border-t-2' : ''}` : 'h-7 px-2 text-[15px]'} ${active === k ? 'bg-ember text-ink' : 'text-paper hover:text-ember'}`}
        >
          {k === 'rank' ? 'Rank' : 'Suit'}
        </button>
      ))}
    </div>
  </div>
);

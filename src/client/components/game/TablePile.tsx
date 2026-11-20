import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Card as CardType, Meld } from '../../types/game';
import { CardFace, CardBack } from '../ui/CardFace';
import type { Viewport } from '../../fx/layout';
import { registry, meldFit, pileFlat, BESIDE_GAP } from '../../fx/layout';
import type { MeldFit } from '../../fx/layout';
import { playFx } from '../../fx/meld';
import type { PlayFx } from '../../fx/meld';

interface Props {
  trickMelds: Meld[];
  vp: Viewport;
  myPlayerId: string;
  /** Fired when a new meld's last card touches the table. */
  onLand: (meld: Meld, fx: PlayFx) => void;
  /** Fired when a finished trick is collected. */
  onSweep?: (winnerId: string) => void;
}

interface Flight {
  ox: number; oy: number; orot: number; os: number; faceDown: boolean;
}
interface Shown {
  key: string;
  meld: Meld;
  index: number;
  /** wobble so stacks look tossed, not placed */
  rot: number;
  flights: Flight[] | null;
}

const meldKey = (m: Meld, i: number) => `${i}:${m.playerId}:${m.cards.map((c) => c.code ?? `${c.rank}${c.suit}`).join(',')}`;
const CONTACT = 0.44; // seconds from launch to touching the table
const DURATION = 0.62;
const STAGGER = 0.04;

const cache = new Map<string, { fit: MeldFit; slots: Array<{ x: number; y: number; rot: number }> }>();
/** Same objects for the same size, so memoized cards don't re-render. */
function layoutOf(n: number, vp: Viewport) {
  const k = `${n}:${vp.w}:${vp.PW}:${Math.round(vp.meldRoom)}`;
  let v = cache.get(k);
  if (!v) {
    const fit = meldFit(n, vp, vp.meldRoom);
    const slots = Array.from({ length: n }, (_, i) => {
      const c = i - (n - 1) / 2;
      return { x: c * fit.spacing, y: Math.abs(c) * 1.2, rot: c * 2.2 };
    });
    v = { fit, slots };
    cache.set(k, v);
  }
  return v;
}

/**
 * The newest meld is laid out by meldFit(): it fans tighter before it shrinks, never draws below
 * the readable floor (MIN_MELD_W), and may spill past the ring rather than get smaller. Older melds
 * keep its spacing (so their corners still show), then slide back, shrink and dim; anything past
 * the third is gone. They stay inside the pile's clear band, and the sideways nudge is cut down
 * when it would push a wide meld past it.
 */
function ageOffset(age: number, index: number, vp: Viewport, n: number, newestN: number) {
  const { fit } = layoutOf(n, vp);
  if (age === 0) return { x: 0, y: 0, scale: fit.scale, dim: 0, opacity: 1 };
  const dir = index % 2 ? 1 : -1;
  const raw = fit.half / fit.scale;
  const flat = pileFlat(vp);
  // level with the newest meld (flat) they get its room; stacked above it, only the pile's
  const fs = Math.min(1, fit.scale, (flat ? vp.meldRoom : vp.pileHalf) / raw);
  const half = raw * fs;
  const nudge = (want: number, scale: number) => Math.max(0, Math.min(want, vp.pileHalf - half * scale));
  if (flat) {
    // Wide felt: slide older melds out to either side of the newest, level with it, so nothing
    // stacks above the meld you have to beat and its callout gets the band overhead.
    const newest = layoutOf(newestN, vp).fit.half;
    const beside = (scale: number) => Math.min(newest + BESIDE_GAP + half * scale, vp.meldRoom - half * scale);
    if (age === 1) return { x: dir * beside(0.8), y: -vp.PH * 0.06, scale: 0.8 * fs, dim: 0.42, opacity: 1 };
    if (age === 2) return { x: -dir * beside(0.66), y: -vp.PH * 0.1, scale: 0.66 * fs, dim: 0.62, opacity: 1 };
    return { x: -dir * beside(0.55), y: -vp.PH * 0.12, scale: 0.55 * fs, dim: 0.8, opacity: 0 };
  }
  if (age === 1) return { x: dir * nudge(vp.PW * 0.42, 0.8), y: -vp.PH * 0.34, scale: 0.8 * fs, dim: 0.42, opacity: 1 };
  if (age === 2) return { x: -dir * nudge(vp.PW * 0.3, 0.66), y: -vp.PH * 0.56, scale: 0.66 * fs, dim: 0.62, opacity: 1 };
  return { x: 0, y: -vp.PH * 0.7, scale: 0.55 * fs, dim: 0.8, opacity: 0 };
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export const TablePile: React.FC<Props> = ({ trickMelds, vp, myPlayerId, onLand, onSweep }) => {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<Shown[]>([]);
  const [sweep, setSweep] = useState<{ id: number; items: Shown[]; tx: number; ty: number } | null>(null);
  const [pushDelay, setPushDelay] = useState(0);
  const first = useRef(true);
  const onLandRef = useRef(onLand);
  onLandRef.current = onLand;
  const onSweepRef = useRef(onSweep);
  onSweepRef.current = onSweep;
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useLayoutEffect(() => {
    const prev = shownRef.current;
    const prevKeys = new Set(prev.map((s) => s.key));
    const timers: number[] = [];

    // The trick ended: collect what's on the table toward whoever won it.
    if (trickMelds.length === 0) {
      if (prev.length && !first.current) {
        const winner = prev[prev.length - 1].meld.playerId;
        const r = registry.seatRect(winner);
        const tx = r ? r.left + r.width / 2 - vp.pileX : 0;
        const ty = r ? r.top + r.height / 2 - vp.pileY : vp.h - vp.pileY;
        const id = Date.now();
        setSweep({ id, items: prev, tx, ty });
        onSweepRef.current?.(winner);
        timers.push(window.setTimeout(() => setSweep((s) => (s?.id === id ? null : s)), 900));
      }
      setShown([]);
      first.current = false;
      return () => { /* the sweep clears itself */ };
    }

    const next: Shown[] = trickMelds.map((meld, index) => {
      const key = meldKey(meld, index);
      const old = prev.find((s) => s.key === key);
      if (old) return { ...old, flights: null };
      const rot = ((hash(key) % 100) / 100) * 10 - 5;
      let flights: Flight[] | null = null;
      if (!first.current && !prevKeys.has(key)) {
        const mine = meld.playerId === myPlayerId;
        const seat = registry.seatRect(meld.playerId);
        // the meld's box is scaled by meldFit, so its children's offsets are too
        const fs = layoutOf(meld.cards.length, vp).fit.scale;
        flights = meld.cards.map((c) => {
          const f = ((): Flight => {
            const o = mine ? registry.takeOrigin(c.code ?? '') : null;
            if (o) {
              return {
                ox: o.rect.left + o.rect.width / 2 - vp.pileX,
                oy: o.rect.top + o.rect.height / 2 - vp.pileY,
                orot: o.rotate, os: o.rect.width / vp.PW, faceDown: false,
              };
            }
            if (seat) {
              return {
                ox: seat.left + seat.width / 2 - vp.pileX, oy: seat.top + seat.height / 2 - vp.pileY,
                orot: 0, os: Math.max(0.25, seat.height / 1.4 / vp.PW), faceDown: !mine,
              };
            }
            return { ox: 0, oy: vp.h - vp.pileY, orot: 0, os: 1, faceDown: false };
          })();
          return { ...f, ox: f.ox / fs, oy: f.oy / fs, os: f.os / fs };
        });
        const landAt = (CONTACT + (meld.cards.length - 1) * STAGGER) * 1000;
        timers.push(window.setTimeout(() => onLandRef.current(meld, playFx(meld.type, meld.cards)), reduce ? 0 : landAt));
      }
      return { key, meld, index, rot, flights };
    });
    const hasNew = next.some((s) => s.flights);
    setPushDelay(hasNew && !reduce ? CONTACT : 0);
    setShown(next);
    first.current = false;
    return () => { /* landing timers must survive re-renders */ };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trickMelds]);

  // Clear nothing on unmount; timers just call into a stale table harmlessly.
  useEffect(() => () => { first.current = true; }, []);

  const n = shown.length;
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 35 }}>
      {shown.map((s, i) => {
        const age = n - 1 - i;
        const off = ageOffset(age, s.index, vp, s.meld.cards.length, shown[n - 1].meld.cards.length);
        const { slots } = layoutOf(s.meld.cards.length, vp);
        return (
          <motion.div
            key={s.key}
            className="absolute"
            style={{ left: vp.pileX, top: vp.pileY, zIndex: 10 + i }}
            initial={false}
            animate={{ x: off.x, y: off.y, scale: off.scale, rotate: s.rot * (1 + age * 0.6), opacity: off.opacity }}
            transition={{ type: 'spring', stiffness: 300, damping: 26, delay: age > 0 ? pushDelay : 0 }}
          >
            {s.meld.cards.map((card, ci) => (
              <PileCard
                key={card.code ?? ci}
                card={card}
                slot={slots[ci]}
                vp={vp}
                flight={s.flights?.[ci] ?? null}
                delay={ci * STAGGER}
                dim={off.dim}
                reduce={!!reduce}
                spin={playFx(s.meld.type, s.meld.cards).level >= 3 ? 1 : 0}
              />
            ))}
          </motion.div>
        );
      })}

      {sweep && sweep.items.map((s, i) => {
        const age = sweep.items.length - 1 - i;
        const off = ageOffset(age, s.index, vp, s.meld.cards.length, sweep.items[sweep.items.length - 1].meld.cards.length);
        const { slots } = layoutOf(s.meld.cards.length, vp);
        return (
          <motion.div
            key={`sw-${sweep.id}-${s.key}`}
            className="absolute"
            style={{ left: vp.pileX, top: vp.pileY, zIndex: 5 + i }}
            initial={{ x: off.x, y: off.y, scale: off.scale, rotate: s.rot, opacity: off.opacity }}
            animate={{ x: sweep.tx, y: sweep.ty, scale: 0.22, rotate: s.rot + (i % 2 ? 40 : -40), opacity: 0 }}
            transition={{ duration: reduce ? 0.2 : 0.55, ease: [0.5, 0, 0.75, 0], delay: reduce ? 0 : age * 0.05 }}
          >
            {s.meld.cards.map((card, ci) => (
              <div key={card.code ?? ci} className="absolute" style={{
                width: vp.PW, height: vp.PH, left: -vp.PW / 2, top: -vp.PH / 2,
                transform: `translate(${slots[ci].x}px, ${slots[ci].y}px) rotate(${slots[ci].rot}deg)`,
              }}>
                <CardFace suit={card.suit} rank={card.rank} />
              </div>
            ))}
          </motion.div>
        );
      })}
    </div>
  );
};

const PileCard: React.FC<{
  card: CardType; slot: { x: number; y: number; rot: number }; vp: Viewport;
  flight: Flight | null; delay: number; dim: number; reduce: boolean; spin: number;
}> = React.memo(({ card, slot, vp, flight, delay, dim, reduce, spin }) => {
  const base = { width: vp.PW, height: vp.PH, left: -vp.PW / 2, top: -vp.PH / 2 };
  let initial: Record<string, number> | false = false;
  let animate: Record<string, number | number[]> = { x: slot.x, y: slot.y, rotate: slot.rot, scaleX: 1, scaleY: 1, opacity: 1 };
  let transition: Record<string, unknown> = { type: 'spring', stiffness: 300, damping: 26 };

  if (flight && reduce) {
    initial = { x: slot.x, y: slot.y, rotate: slot.rot, opacity: 0 };
    transition = { duration: 0.2 };
  } else if (flight) {
    const { ox, oy, orot, os } = flight;
    const dist = Math.hypot(slot.x - ox, slot.y - oy);
    // Bend the path: a lob that rises above the straight line, leaning sideways a little.
    const mx = (ox + slot.x) / 2 + (ox > slot.x ? 1 : -1) * dist * 0.08;
    const my = Math.min(oy, slot.y) - (50 + dist * 0.22);
    const turn = (ox > 0 ? -1 : 1) * (spin ? 360 : 22);
    initial = { x: ox, y: oy, rotate: orot, scaleX: os, scaleY: os, opacity: 1 };
    animate = {
      x: [ox, mx, slot.x, slot.x, slot.x],
      y: [oy, my, slot.y, slot.y, slot.y],
      rotate: [orot, (orot + slot.rot) / 2 + turn / 2, slot.rot + turn, slot.rot + turn, slot.rot + turn],
      scaleX: [os, 1.16, 1.1, 0.97, 1],
      scaleY: [os, 1.16, 0.86, 1.04, 1],
      opacity: 1,
    };
    transition = { duration: DURATION, delay, times: [0, 0.4, 0.71, 0.86, 1], ease: ['easeOut', 'easeIn', 'easeOut', 'easeInOut'] };
  }

  const flipDown = !!flight && flight.faceDown && !reduce;
  return (
    <motion.div data-pile className="absolute" style={{ ...base, borderRadius: '6% / 4.3%', boxShadow: '0 8px 14px -4px rgba(0,0,0,.5)' }} initial={initial} animate={animate} transition={transition}>
      <CardFace suit={card.suit} rank={card.rank} />
      {flipDown && (
        <motion.div className="absolute inset-0" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.06, delay: delay + DURATION * 0.3 }}>
          <CardBack />
        </motion.div>
      )}
      <motion.div aria-hidden className="absolute inset-0 bg-black pointer-events-none" style={{ borderRadius: '6% / 4.3%' }} initial={false} animate={{ opacity: dim }} transition={{ duration: 0.3 }} />
    </motion.div>
  );
});
PileCard.displayName = 'PileCard';

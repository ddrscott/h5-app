import { useEffect, useState } from 'react';

/** Viewport-driven sizes for the table. Card width W, height H (5:7). */
export interface Viewport {
  w: number; h: number; portrait: boolean;
  /** hand card size */
  W: number; H: number;
  /** cards on the table */
  PW: number; PH: number;
  /** where the pile sits, in px from the top-left */
  pileX: number; pileY: number;
  /** distance from the bottom of the screen to the hand's baseline */
  handBase: number;
}

/** Where the Pass/Play bar's top edge sits, in px from the bottom (12px gap + 48px buttons). */
export const BAR_TOP = 60;

function measure(): Viewport {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const portrait = h > w;
  const W = Math.round(Math.max(54, Math.min(108, w * 0.165, h * 0.125)));
  const H = Math.round(W * 1.4);
  const PW = Math.round(W * (portrait ? 0.9 : 0.86));
  const PH = Math.round(PW * 1.4);
  // The hand's lowest corner clears the button bar by this much; fan() lifts the arc to suit.
  const handBase = BAR_TOP + 10;
  return { w, h, portrait, W, H, PW, PH, pileX: w / 2, pileY: h * 0.43, handBase };
}

export interface Slot { x: number; y: number; rot: number; z: number }
export interface Fan { slots: Slot[]; rows: number; /** px the hand reaches above handBase, selection lift included */ top: number }

/**
 * Lay the hand out on a wide arc, wrapping to two rows when one row would bury the indices.
 * Every card stays inside the screen (rotation included), and the arc is lifted so the lowest
 * corner sits on handBase, clear of the buttons.
 */
export function fan(n: number, vp: Viewport): Fan {
  const margin = vp.portrait ? 10 : 24;
  const avail = Math.min(vp.w - margin * 2, 1040);
  const minSlice = vp.portrait ? 30 : 34;
  const R = Math.max(vp.w * 1.25, 900);
  const tilt = vp.portrait ? 0.9 : 1.25;
  const spacing = (m: number) => {
    if (m <= 1) return 0;
    let s = Math.min(vp.W * 0.62, (avail - vp.W) / (m - 1));
    // Rotation swings the outer cards' top corners outward; give that room back.
    const half = ((m - 1) / 2) * s;
    const rot = (half / R) * tilt;
    const swing = vp.H * Math.sin(rot) + (vp.W / 2) * (Math.cos(rot) - 1);
    if (half + vp.W / 2 + swing > avail / 2) s = Math.max(8, (avail / 2 - vp.W / 2 - swing) / ((m - 1) / 2));
    return s;
  };
  let rows = 1;
  let perRow = n;
  if (n > 1 && spacing(n) < minSlice) { rows = 2; perRow = Math.ceil(n / 2); }
  const s = spacing(perRow);
  const raw: Slot[] = [];
  let drop = 0;
  for (let i = 0; i < n; i++) {
    const row = rows === 2 && i >= perRow ? 1 : 0;
    const j = row ? i - perRow : i;
    const m = rows === 2 ? (row ? n - perRow : perRow) : n;
    const x = (j - (m - 1) / 2) * s;
    const rot = (x / R) * tilt;
    const yArc = (x * x) / (2 * R);
    const rowLift = rows === 2 && row === 0 ? -vp.H * 0.5 : 0;
    // how far below handBase this card's lowest corner reaches
    if (row === (rows === 2 ? 1 : 0)) drop = Math.max(drop, yArc + (vp.W / 2) * Math.sin(Math.abs(rot)));
    raw.push({ x, y: yArc + rowLift, rot: rot * (180 / Math.PI), z: i });
  }
  const slots = raw.map((sl) => ({ ...sl, y: sl.y - drop }));
  // the centre card rises by `drop` when the arc is lifted, and a selected card lifts H*0.26 more
  const top = drop + vp.H + (rows === 2 ? vp.H * 0.5 : 0) + vp.H * 0.26;
  return { slots, rows, top };
}

export interface SeatBox { x: number; y: number; hw: number; hh: number }

/** Half sizes of an opponent's seat (card fan + nameplate), for keeping text off them. */
export const seatHalf = (compact: boolean) => (compact ? { hw: 68, hh: 42 } : { hw: 104, hh: 48 });
/** Height of the status chip + your nameplate stack. */
const STATUS_H = 62;
const HEADER = 58;

/**
 * Split the felt into lanes so nothing prints on top of anything else: your status stack sits on
 * the hand, the pile sits midway between the top seats and that stack, and the inlay ring fits in
 * the same gap.
 */
export function tableLanes(vp: Viewport, seats: SeatBox[], handTop: number) {
  const statusBottom = vp.handBase + handTop + 6;
  const statusTop = vp.h - statusBottom - STATUS_H;
  const col = vp.PW * 0.9;
  let band = HEADER;
  for (const b of seats) {
    if (b.y > vp.h * 0.3) continue;
    if (Math.abs(b.x - vp.w / 2) - b.hw > col) continue;
    band = Math.max(band, b.y + b.hh);
  }
  const pileY = Math.round((band + statusTop) / 2 + vp.PH * 0.12);
  // the motto's letters reach out to about 1.12r on top and 1.26r at the bottom
  const ringR = Math.max(60, Math.min(vp.w * 0.36, vp.h * 0.2, 230, (pileY - band - 6) / 1.12, (statusTop - pileY - 10) / 1.26));
  // The motto runs along the top and bottom arcs (about ±50° around each pole); show an arc only
  // where no seat sits on it.
  const arcClear = (radius: number, from: number, to: number) => {
    for (let a = from; a <= to; a += 5) {
      const t = (a * Math.PI) / 180;
      const x = vp.w / 2 + Math.sin(t) * radius;
      const y = pileY - Math.cos(t) * radius;
      for (const b of seats) if (Math.abs(b.x - x) < b.hw + 10 && Math.abs(b.y - y) < b.hh + 10) return false;
    }
    return true;
  };
  const mottoTop = arcClear(ringR * 1.08, -52, 52);
  const mottoBottom = arcClear(ringR * 1.16, 128, 232);
  const outerRing = arcClear(ringR * 1.22, 0, 355);
  return { statusBottom, statusTop, pileY, ringR, band, mottoTop, mottoBottom, outerRing };
}

/**
 * Where a callout can go: the y nearest the top of the pile where a line of the given half
 * height doesn't run into any seat, and how wide it may be there.
 */
export function calloutLane(vp: Viewport, seats: SeatBox[], pileY: number, hh: number, want: number) {
  const freeAt = (y: number) => {
    let half = vp.w / 2 - 12;
    for (const b of seats) {
      if (Math.abs(b.y - y) >= b.hh + hh) continue;
      half = Math.min(half, Math.abs(b.x - vp.w / 2) - b.hw - 8);
    }
    return Math.max(0, half * 2);
  };
  let best = { y: pileY - vp.PH * 0.55, maxW: 0 };
  const start = pileY - vp.PH * 0.45;
  const stop = HEADER + hh;
  for (let y = start; y >= stop; y -= 3) {
    const f = freeAt(y);
    if (f >= want) return { y, maxW: f };
    if (f > best.maxW) best = { y, maxW: f };
  }
  return best;
}

export function useViewport(): Viewport {
  const [v, setV] = useState(measure);
  useEffect(() => {
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setV(measure())); };
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); cancelAnimationFrame(raf); };
  }, []);
  return v;
}

/**
 * Where things are on screen right now, so a card can fly from the right spot: each seat's card
 * fan, and the hand cards you just played (captured at the moment you pressed Play).
 */
const seatEls = new Map<string, HTMLElement>();
const origins = new Map<string, { rect: DOMRect; rotate: number; at: number }>();

export const registry = {
  seat(id: string, el: HTMLElement | null) {
    if (el) seatEls.set(id, el); else seatEls.delete(id);
  },
  seatRect(id: string): DOMRect | null {
    return seatEls.get(id)?.getBoundingClientRect() ?? null;
  },
  /** Remember where these hand cards are before they leave the hand. */
  captureHand(codes: string[]) {
    const now = performance.now();
    for (const code of codes) {
      const el = document.querySelector<HTMLElement>(`[data-card="${CSS.escape(code)}"]`);
      if (!el) continue;
      const rot = Number(el.dataset.rot ?? 0);
      origins.set(code, { rect: el.getBoundingClientRect(), rotate: rot, at: now });
    }
  },
  takeOrigin(code: string) {
    const o = origins.get(code);
    origins.delete(code);
    if (!o || performance.now() - o.at > 4000) return null;
    return o;
  },
};

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
  /** how far the pile may spread either side of pileX before it reaches a seat */
  pileHalf: number;
  /**
   * how far the newest meld alone may spread either side of pileX: only seats level with it
   * count, so a seat straight above the pile doesn't squeeze it
   */
  meldRoom: number;
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
  return { w, h, portrait, W, H, PW, PH, pileX: w / 2, pileY: h * 0.43, pileHalf: w / 2 - 12, meldRoom: w / 2 - 12, handBase };
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

/** How far above pileY the oldest visible meld reaches (its offset plus half its scaled height). */
export const PILE_UP = 0.9;

/** Card spacing in a meld of n on the table, tightened to fit within maxHalf of the centre. */
export function meldSpacing(n: number, vp: Pick<Viewport, 'w' | 'PW'>, maxHalf: number) {
  if (n <= 1) return 0;
  const loose = Math.min(vp.PW * 0.46, (Math.min(vp.w, 900) * 0.8 - vp.PW) / (n - 1));
  // cards are tilted a couple of degrees, so leave a few px for their corners
  const fit = (2 * (maxHalf - 4) - vp.PW) / (n - 1);
  return Math.max(vp.PW * 0.2, Math.min(loose, fit));
}
/**
 * Readability floor for the newest meld. CardFace prints the corner rank at 29 units on a 100-unit
 * face, so the rank's font size is CORNER_RANK times the card's width. MIN_RANK_PX is the smallest
 * rank we let the play you have to beat show: easy to read from arm's length, about the distance
 * to a car's centre screen. That makes MIN_MELD_W the narrowest the newest meld's cards ever draw.
 */
export const CORNER_RANK = 0.29;
export const MIN_RANK_PX = 20;
export const MIN_MELD_W = Math.ceil(MIN_RANK_PX / CORNER_RANK);
/** The least of each covered card's width a tight fan leaves showing: the corner rank and suit. */
export const MIN_STRIP = 0.36;

export interface MeldFit {
  /** scale of the whole meld; above 1 when table cards are smaller than MIN_MELD_W */
  scale: number;
  /** card spacing before scaling */
  spacing: number;
  /** half the meld's on-screen width, scale included */
  half: number;
}

/**
 * Size and spacing for a meld of n as the newest play, within `room` either side of the centre.
 * In order: lay it out loosely; tighten the fan until only MIN_STRIP of each card shows; then
 * shrink, but never below MIN_MELD_W. If it still doesn't fit, it spills past `room` rather than
 * getting any smaller.
 */
export function meldFit(n: number, vp: Pick<Viewport, 'w' | 'PW'>, room: number): MeldFit {
  const floor = MIN_MELD_W / vp.PW;
  const base = Math.max(1, floor);
  const half = (scale: number, spacing: number) => scale * (((n - 1) / 2) * spacing + vp.PW / 2) + 4;
  if (n <= 1) return { scale: base, spacing: 0, half: half(base, 0) };
  const tight = vp.PW * MIN_STRIP;
  const loose = Math.max(tight, Math.min(vp.PW * 0.46, (Math.min(vp.w, 900) * 0.8 - vp.PW) / (n - 1)));
  // the spacing that just fits at this scale; cards tilt a little, which the 4px covers
  const fitAt = (scale: number) => (2 * ((room - 4) / scale) - vp.PW) / (n - 1);
  const sp = Math.min(loose, fitAt(base));
  if (sp >= tight) return { scale: base, spacing: sp, half: half(base, sp) };
  const scale = Math.min(base, Math.max(floor, (room - 4) / (((n - 1) / 2) * tight + vp.PW / 2)));
  return { scale, spacing: tight, half: half(scale, tight) };
}

/** Half the width of a meld of n laid out with meldSpacing. */
export function meldHalf(n: number, vp: Pick<Viewport, 'w' | 'PW'>, maxHalf: number) {
  return ((n - 1) / 2) * meldSpacing(n, vp, maxHalf) + vp.PW / 2 + 4;
}
/** Gap between the newest meld and an older one set beside it. */
export const BESIDE_GAP = 10;
/**
 * True when the felt level with the newest meld (meldRoom) is wide enough to set older melds beside
 * it (a five-card meld at 0.8 scale next to a five-card meld) instead of stacking them above it. Then the pile reaches no
 * higher than the newest meld, which leaves the band above it for the callout.
 */
export function pileFlat(vp: Pick<Viewport, 'w' | 'PW' | 'meldRoom'>) {
  const h5 = meldHalf(5, vp, vp.meldRoom);
  return h5 * 1.8 + BESIDE_GAP <= vp.meldRoom;
}

export interface SeatBox { x: number; y: number; hw: number; hh: number }

/** Half sizes of an opponent's seat (card fan + nameplate), for keeping text off them. */
export const seatHalf = (compact: boolean, scale = 1) =>
  compact ? { hw: 71, hh: 42 } : { hw: 104 * scale, hh: 48 * scale };
/**
 * How much bigger than its base size an opponent's seat draws on a large screen. Phones stay at 1;
 * a 1440x900 laptop gets about 1.15 and a big monitor up to 1.6, so the seats don't look like
 * stamps next to your own hand.
 */
export const seatScale = (vp: { w: number; h: number }, compact: boolean) =>
  compact ? 1 : Math.min(1.6, Math.max(1, Math.min(vp.w / 1100, vp.h / 780)));
/** How much bigger your own character plate draws: the same as the opponents' seats, so yours never reads smaller. */
export const myPlateScale = (vp: { w: number; h: number }) => seatScale(vp, vp.w < 640);
/** Full width of an opponent's seat (portrait + plate) at scale 1; your own plate is at least this wide off a phone. */
export const SEAT_W = 64 - 10 + 154;
/** Height of the status chip + your nameplate stack, at plate scale 1. */
const STATUS_H = 84;
const HEADER = 58;

/**
 * Split the felt into lanes so nothing prints on top of anything else: your status stack sits on
 * the hand, the pile sits midway between the top seats and that stack, and the inlay ring fits in
 * the same gap.
 */
export function tableLanes(vp: Viewport, seats: SeatBox[], handTop: number) {
  const statusBottom = vp.handBase + handTop + 6;
  const statusTop = vp.h - statusBottom - STATUS_H - (myPlateScale(vp) - 1) * 62;
  const col = vp.PW * 0.9;
  let band = HEADER;
  for (const b of seats) {
    if (b.y > vp.h * 0.3) continue;
    if (Math.abs(b.x - vp.w / 2) - b.hw > col) continue;
    band = Math.max(band, b.y + b.hh);
  }
  const want = Math.round((band + statusTop) / 2 + vp.PH * 0.12);
  // The pile reaches up to the third meld back (PILE_UP) and down half a card. Find the resting y
  // where it has the most room sideways, so a settled meld never covers a side seat's plate:
  // keep the middle when it has room for a full five-card spread, else slide to the clearest band.
  const up = vp.PH * PILE_UP, down = vp.PH * 0.58;
  const freeAt = (y: number) => {
    let half = vp.w / 2 - 10;
    for (const b of seats) {
      if (b.y + b.hh < y - up || b.y - b.hh > y + down) continue;
      half = Math.min(half, Math.abs(b.x - vp.w / 2) - b.hw - 6);
    }
    return Math.max(vp.PW * 0.5, half);
  };
  const enough = meldHalf(5, vp, Infinity) + vp.PW * 0.42;
  let pileY = want;
  let pileHalf = freeAt(want);
  if (pileHalf < enough) {
    const lo = band + up + 4, hi = statusTop - down - 4;
    for (let y = Math.round(lo); y <= hi; y += 2) {
      const f = freeAt(y);
      if (f > pileHalf + 1 || (Math.abs(f - pileHalf) <= 1 && Math.abs(y - want) < Math.abs(pileY - want))) { pileY = y; pileHalf = f; }
    }
  }
  // Keep the newest meld itself (at the readable floor, tilted as it lands) between the top seat's
  // plate and your status chip. When the felt is too short for both, split the difference.
  const mh = Math.max(vp.PH, MIN_MELD_W * 1.4);
  const meldLo = band + mh * 0.6 + 4, meldHi = statusTop - mh * 0.62 - 6;
  const settled = meldLo <= meldHi ? Math.min(meldHi, Math.max(meldLo, pileY)) : (meldLo + meldHi) / 2;
  if (Math.abs(settled - pileY) > 0.5) { pileY = Math.round(settled); pileHalf = freeAt(pileY); }
  // The newest meld only has to clear seats level with it, so a seat straight above doesn't
  // squeeze it the way it squeezes the stacked older melds.
  let meldRoom = vp.w / 2 - 10;
  for (const b of seats) {
    if (b.y + b.hh < pileY - mh * MELD_UP || b.y - b.hh > pileY + mh * 0.58) continue;
    const dx = Math.abs(b.x - vp.w / 2) - b.hw - 6;
    if (dx > vp.PW * 0.5) meldRoom = Math.min(meldRoom, dx);
  }
  meldRoom = Math.max(pileHalf, meldRoom);
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
  return { statusBottom, statusTop, pileY, pileHalf, meldRoom, ringR, band, mottoTop, mottoBottom, outerRing };
}

/** How far above pileY the newest meld's top edge reaches (half a card plus the landing squash). */
export const MELD_UP = 0.53;

export interface CalloutPlace { x: number; y: number; fontPx: number; maxW: number; maxScale: number; lines: 1 | 2; tilt: number }
export interface CalloutBox { w: number; hh: number; tilt: number }

/**
 * Where a callout goes and how big it is. The word gets a spot of its own: never over a seat, never
 * over the newest meld (it may ride over the dimmed older ones), never under the header or into
 * your status stack. It tries, in order: above the whole pile, just above the newest meld, the band
 * between the pile and your status chip, then the open felt beside the meld. A long phrase may stack
 * on two lines to fit. Only when none of that fits at full size does the font step down, and it
 * stops at the level's floor unless the screen is too small to hold even that.
 *
 * `size(font, lines)` gives the box at that font (null when the text can't stack on two lines).
 */
export function placeCallout(o: {
  vp: Viewport; seats: SeatBox[]; pileY: number; statusTop: number;
  /** half width of the newest meld, 0 when the table is empty */
  meldHalfW: number;
  /** the newest meld's scale (above 1 when it's drawn up to the readable floor) */
  meldScale?: number;
  full: number; floor: number;
  size: (font: number, lines: 1 | 2) => CalloutBox | null;
}): CalloutPlace {
  const { vp, seats, pileY, statusTop, meldHalfW } = o;
  const gap = 14, edge = 8;
  const mph = vp.PH * (o.meldScale ?? 1);
  const meldTop = pileY - mph * MELD_UP, meldBottom = pileY + mph * 0.58;
  const pileTop = Math.min(meldTop, pileFlat(vp) ? meldTop : pileY - vp.PH * PILE_UP);
  const cx = vp.pileX;
  // the word tilts, so its ends reach a little higher and lower than its centre
  const reach = (c: CalloutBox) => c.hh + (c.w / 2) * Math.sin((c.tilt * Math.PI) / 180) + 2;
  const hits = (x: number, y: number, c: CalloutBox) => {
    const w = c.w, hhT = reach(c);
    if (x - w / 2 < edge || x + w / 2 > vp.w - edge) return true;
    if (y - hhT < HEADER || y + hhT > statusTop) return true;
    for (const b of seats) {
      if (Math.abs(b.x - x) < b.hw + w / 2 + 6 && Math.abs(b.y - y) < b.hh + hhT + 4) return true;
    }
    if (meldHalfW > 0 && Math.abs(x - cx) < meldHalfW + w / 2 + gap && y + hhT > meldTop - gap && y - hhT < meldBottom + gap) return true;
    return false;
  };
  const spotFor = (c: CalloutBox) => {
    const hhT = reach(c);
    const above = (from: number) => { for (let y = from; y >= HEADER + hhT; y -= 3) if (!hits(cx, y, c)) return y; return null; };
    let y = above(pileTop - hhT - gap);
    if (y === null) y = above(meldTop - hhT - gap);
    if (y !== null) return { x: cx, y };
    for (let yy = meldBottom + hhT + gap; yy <= statusTop - hhT; yy += 3) if (!hits(cx, yy, c)) return { x: cx, y: yy };
    // beside the meld: nearest the pile's centre line first, either side
    const off = meldHalfW + gap + c.w / 2;
    for (let d = 0; d <= vp.h; d += 3) {
      for (const yy of d ? [pileY - d, pileY + d] : [pileY]) {
        for (const x of [cx - off, cx + off]) if (!hits(x, yy, c)) return { x, y: yy };
      }
      if (pileY - d < HEADER && pileY + d > statusTop) break;
    }
    return null;
  };
  const done = (at: { x: number; y: number }, c: CalloutBox, font: number, lines: 1 | 2): CalloutPlace => {
    const room = 2 * Math.min(at.x, vp.w - at.x) - edge * 2;
    return { ...at, fontPx: font, maxW: c.w, maxScale: Math.max(1, room / c.w), lines, tilt: c.tilt };
  };
  const floor = Math.min(o.full, o.floor);
  // past the floor only when the screen is too small to hold it anywhere
  const last = Math.min(floor, Math.max(18, floor * 0.7));
  for (let font = o.full; ; font = Math.max(last, font * 0.93)) {
    for (const lines of [1, 2] as const) {
      const c = o.size(font, lines);
      if (!c) continue;
      const at = spotFor(c);
      if (at) return done(at, c, font, lines);
    }
    if (font <= last) break;
  }
  // Nothing clear even then (a very small screen): take the spot that covers the least, where a
  // seat costs most, then your status stack, then the newest meld's edge.
  const ov = (x: number, y: number, c: CalloutBox, bx: number, by: number, hw: number, hh: number) =>
    Math.max(0, Math.min(x + c.w / 2, bx + hw) - Math.max(x - c.w / 2, bx - hw)) *
    Math.max(0, Math.min(y + reach(c), by + hh) - Math.max(y - reach(c), by - hh));
  let best: { cost: number; place: CalloutPlace } | null = null;
  for (const lines of [1, 2] as const) {
    const c = o.size(last, lines);
    if (!c) continue;
    const hhT = reach(c);
    for (let y = HEADER + hhT; y <= vp.h - hhT; y += 4) {
      for (let x = Math.max(edge + c.w / 2, cx - vp.w); x <= Math.min(vp.w - edge - c.w / 2, cx + vp.w); x += 6) {
        let cost = 0;
        for (const b of seats) cost += 4 * ov(x, y, c, b.x, b.y, b.hw + 6, b.hh + 4);
        cost += 2 * ov(x, y, c, vp.w / 2, (statusTop + vp.h) / 2, vp.w, (vp.h - statusTop) / 2);
        if (meldHalfW > 0) cost += ov(x, y, c, cx, (meldTop + meldBottom) / 2, meldHalfW, (meldBottom - meldTop) / 2);
        cost += Math.abs(x - cx) * 0.01;
        if (!best || cost < best.cost) best = { cost, place: done({ x, y }, c, last, lines) };
      }
    }
  }
  return best!.place;
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

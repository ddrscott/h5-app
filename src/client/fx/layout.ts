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

/**
 * Half sizes of an opponent's seat (the face-down fan held above the nameplate, the plate's hard
 * offset included), for keeping text and cards off them. Measured from Seat.tsx (PLATE_W 172,
 * PLATE_W_COMPACT 128).
 */
export const seatHalf = (compact: boolean, scale = 1) =>
  compact ? { hw: 67, hh: 41 } : { hw: 89 * scale, hh: 42 * scale };
/**
 * The size an opponent's seat started from on a large screen before seats were sized from free space
 * (seatLayout): phones 1, a 1440x900 laptop about 1.15, a big monitor up to 1.6. Your own plate still
 * draws at this size, since it shares the bottom of the screen with your hand; seatLayout never draws
 * an opponent smaller than it.
 */
export const seatScale = (vp: { w: number; h: number }, compact: boolean) =>
  compact ? 1 : Math.min(1.6, Math.max(1, Math.min(vp.w / 1100, vp.h / 780)));
/** How much bigger your own character plate draws (see seatScale). */
export const myPlateScale = (vp: { w: number; h: number }) => seatScale(vp, vp.w < 640);
/** The biggest an opponent's seat draws: about a 380px plate with a 30px name. */
export const SEAT_MAX_SCALE = 2.3;
/** An active seat pops this much bigger (Seat.tsx), so spacing allows for it. */
const ACTIVE_POP = 1.06;

export interface SeatLayout { scale: number; spots: Array<{ x: number; y: number }>; boxes: SeatBox[] }

/**
 * Opponent seats sized from the free felt rather than a fixed number. `anchors` are the seat
 * centres from seatSpots. Starting from SEAT_MAX_SCALE and stepping down, each try clamps the seats
 * inside the screen and under the header, lifts a side seat that would reach the hand, and keeps the
 * largest scale where:
 *  - no two seats touch (the active seat's pop included),
 *  - no seat reaches your hand or your status stack,
 *  - the newest five-card meld draws exactly as it does with seats at their old size (meldFit), and
 *    no seat covers it (unless the old-size seats already did, as on a 640x640 car screen),
 *  - the ring keeps at least RING_KEEP of its old radius (the top seat may grow into the felt above
 *    it, nudging the pile down a little).
 * Phones keep the compact seat at scale 1: their felt has no room to spare.
 */
const RING_KEEP = 0.86;
export function seatLayout(vp: Viewport, anchors: Array<{ x: number; y: number }>, handTop: number, compact: boolean): SeatLayout {
  const handY = vp.h - vp.handBase - handTop;
  const place = (scale: number) => {
    const half = seatHalf(compact, scale);
    const hw = half.hw * ACTIVE_POP, hh = half.hh * ACTIVE_POP;
    const spots = anchors.map((p) => {
      const x = Math.min(vp.w - hw - 6, Math.max(hw + 6, p.x));
      let y = Math.min(p.y, handY - 8 - hh);
      y = Math.max(HEADER + hh - 2, y);
      return { x, y };
    });
    return { scale, spots, boxes: spots.map((p) => ({ ...p, ...half })) };
  };
  const base = place(seatScale(vp, compact));
  if (compact || anchors.length === 0) return base;
  const lanes0 = tableLanes(vp, base.boxes, handTop);
  const fit0 = meldFit(5, vp, lanes0.meldRoom);
  // how much of the newest five-card meld's box (at the readable floor) the seats cover
  const meldCover = (t: SeatLayout, pileY: number, half: number) => {
    const mh = Math.max(vp.PH, MIN_MELD_W * 1.4);
    const top = pileY - mh * MELD_UP - 4, bottom = pileY + mh * 0.58 + 4;
    let area = 0;
    for (const b of t.boxes) {
      const hw = b.hw * ACTIVE_POP, hh = b.hh * ACTIVE_POP;
      const ox = Math.min(b.x + hw, vp.w / 2 + half) - Math.max(b.x - hw, vp.w / 2 - half);
      const oy = Math.min(b.y + hh, bottom) - Math.max(b.y - hh, top);
      if (ox > 0 && oy > 0) area += ox * oy;
    }
    return area;
  };
  const cover0 = meldCover(base, lanes0.pileY, fit0.half);
  const ok = (t: SeatLayout) => {
    const hw = t.boxes[0].hw * ACTIVE_POP, hh = t.boxes[0].hh * ACTIVE_POP;
    for (let i = 0; i < t.spots.length; i++) {
      const a = t.spots[i];
      if (a.x - hw < 2 || a.x + hw > vp.w - 2 || a.y - hh < HEADER - 6) return false;
      if (a.y + hh > handY - 4) return false;
      for (let j = i + 1; j < t.spots.length; j++) {
        const b = t.spots[j];
        if (Math.abs(a.x - b.x) < hw * 2 + 10 && Math.abs(a.y - b.y) < hh * 2 + 8) return false;
      }
    }
    const lanes = tableLanes(vp, t.boxes, handTop);
    // your status stack: the turn banner (up to about 420px wide) over your plate
    for (const a of t.spots) {
      if (Math.abs(a.x - vp.w / 2) < hw + 220 && a.y + hh > lanes.statusTop - 6) return false;
    }
    if (lanes.ringR < lanes0.ringR * RING_KEEP) return false;
    const fit = meldFit(5, vp, lanes.meldRoom);
    if (fit.scale < fit0.scale - 0.001 || fit.spacing < fit0.spacing - 0.5) return false;
    // never cover more of the newest meld than seats at their old size did (none, on most screens)
    if (meldCover(t, lanes.pileY, fit.half) > cover0 + 1) return false;
    return true;
  };
  for (let scale = SEAT_MAX_SCALE; scale > base.scale; scale = Math.round((scale - 0.05) * 100) / 100) {
    const t = place(scale);
    if (ok(t)) return t;
  }
  return base;
}
/** Full width of an opponent's name plate at scale 1 (Seat.tsx PLATE_W); your own plate is at least this wide off a phone. */
export const SEAT_W = 172;
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
  // The ring: the round play area the cards land in, as big as the gap between the top seats' plates
  // and your status chip allows (it may pass under a side seat; seats draw on top of it). On a
  // cramped screen (a car's 640x640) it keeps a floor just wider than a five-card meld, so the ring
  // still frames the play, passing under the top plate and your status chip if it has to.
  const ringFloor = Math.min(vp.w / 2 - 8, Math.max(mh * 0.62 + 26, meldHalf(5, vp, meldRoom) * Math.max(1, MIN_MELD_W / vp.PW) + 12));
  const ringR = Math.round(Math.max(ringFloor, Math.min(vp.w * 0.42, 300, pileY - band - 8, statusTop - pileY - 4)));
  const ringBand = ringBandW(ringR);
  // The motto runs along the ring's tone band, HEART OF FIVE over the top and the house line under
  // the bottom. An arc shows only where no seat or status chip sits on it, and where the cards
  // don't reach into the band (older melds stack up toward the top arc, the newest meld down).
  const r = ringR - ringBand / 2;
  const obstacles = [...seats, { x: vp.w / 2, y: statusTop + 30, hw: 150, hh: 30 }];
  const arcClear = (radius: number, from: number, to: number) => {
    for (let a = from; a <= to; a += 5) {
      const t = (a * Math.PI) / 180;
      const x = vp.w / 2 + Math.sin(t) * radius;
      const y = pileY - Math.cos(t) * radius;
      if (x < 4 || x > vp.w - 4 || y < HEADER - 10) return false;
      for (const b of obstacles) if (Math.abs(b.x - x) < b.hw + 6 && Math.abs(b.y - y) < b.hh + 6) return false;
    }
    return true;
  };
  const flat = pileFlat({ w: vp.w, PW: vp.PW, meldRoom });
  const reachUp = flat ? mh * MELD_UP + 6 : vp.PH * PILE_UP + 6;
  const mottoTop = ringR - ringBand > reachUp && arcClear(r, -48, 48);
  const mottoBottom = ringR - ringBand > mh * 0.6 + 6 && arcClear(r, 125, 235);
  const outerRing = arcClear(ringR + 10, 0, 355);
  return { statusBottom, statusTop, pileY, pileHalf, meldRoom, ringR, band, mottoTop, mottoBottom, outerRing };
}

/** How far above pileY the newest meld's top edge reaches (half a card plus the landing squash). */
export const MELD_UP = 0.53;
/** Width of the ring's screentone band, where the motto is lettered. */
export const ringBandW = (ringR: number) => Math.round(Math.max(16, Math.min(30, ringR * 0.15)));

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
/**
 * Seat rects, read while the browser is idle (layout is clean then, so the read is free) and on
 * resize. A play's flight starts in the same frame React commits the new meld, when reading a rect
 * would force a whole-page layout; it uses these instead. A seat moves only when the layout does,
 * and a few px of a fan growing or shrinking since the last read doesn't show in a flight.
 */
const seatRects = new Map<string, DOMRect>();
let refreshing = false;
function refreshSeatRects() {
  if (refreshing || typeof window === 'undefined') return;
  refreshing = true;
  const run = () => {
    refreshing = false;
    seatEls.forEach((el, id) => seatRects.set(id, el.getBoundingClientRect()));
  };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 500 });
  else setTimeout(run, 100);
}
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => { seatRects.clear(); refreshSeatRects(); });
  // keep them fresh as seats change size (the fan follows the card count) and the table settles
  setInterval(refreshSeatRects, 1000);
}

export const registry = {
  seat(id: string, el: HTMLElement | null) {
    // an inline ref is called with null and then the element on every render, so a null only
    // drops the element; the last rect stays until the next refresh replaces it
    if (el) { if (seatEls.get(id) !== el) { seatEls.set(id, el); refreshSeatRects(); } } else seatEls.delete(id);
  },
  seatRect(id: string): DOMRect | null {
    const cached = seatRects.get(id);
    if (cached) { refreshSeatRects(); return cached; }
    const el = seatEls.get(id);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    seatRects.set(id, r);
    return r;
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

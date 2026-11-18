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

function measure(): Viewport {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const portrait = h > w;
  const W = Math.round(Math.max(54, Math.min(108, w * 0.165, h * 0.125)));
  const H = Math.round(W * 1.4);
  const PW = Math.round(W * (portrait ? 0.9 : 0.86));
  const PH = Math.round(PW * 1.4);
  const handBase = (portrait ? 84 : 80) + (h < 560 ? -10 : 0);
  return { w, h, portrait, W, H, PW, PH, pileX: w / 2, pileY: h * (portrait ? 0.43 : 0.43), handBase };
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

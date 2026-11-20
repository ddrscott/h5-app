import { useEffect, useRef } from 'react';
import { reducedMotion } from './prefs';

/**
 * One full-screen canvas for sparks, embers and confetti. It only runs its frame loop while
 * particles are alive, caps the count, and does nothing at all under reduced motion.
 *
 * Kept cheap so it never steals frames from cards in flight: the canvas's size is cached (reading
 * clientWidth in the loop would force a style and layout pass mid-frame), its backing store is
 * capped at about 1.3 megapixels, each frame clears only the box the last frame drew in, and a
 * quality dial drops the particle count when frames start running long (a slow phone or a car).
 */
type Kind = 'spark' | 'ember' | 'confetti' | 'heart';
interface P {
  x: number; y: number; vx: number; vy: number; life: number; max: number;
  size: number; color: string; kind: Kind; rot: number; vr: number; drag: number; g: number;
}

const MAX = 420;
let parts: P[] = [];
let canvas: HTMLCanvasElement | null = null;
let raf = 0;
let last = 0;
/** css size of the canvas and its pixel ratio, set on mount and resize */
let cw = 0, ch = 0, ratio = 1;
/** the box the previous frame drew in, in css px */
let dirty: [number, number, number, number] | null = null;
/** 0.35..1: how many of each burst's particles to spawn; falls when frames run long, recovers slowly */
let quality = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 8) <= 4 ? 0.7 : 1;
let frameEma = 16.7;
/** most pixels the backing store may hold; past this the canvas draws a little soft instead */
const MAX_PIXELS = 1.3e6;

const PALETTES = {
  // Signal Orange and paper: the bomb's sparks.
  ember: ['#FF7A1A', '#E85D00', '#FAFAF7', '#FFB27A'],
  // Ink-and-paper flecks with a little red: everyday plays and the Heart 5.
  ink: ['#FAFAF7', '#D9D9D4', '#D7192B', '#FAFAF7'],
  confetti: ['#E85D00', '#FAFAF7', '#D7192B', '#0B0B0D', '#9A9AA0', '#FF7A1A'],
};

export interface BurstOpts {
  x: number; y: number; count?: number; kind?: Kind;
  palette?: keyof typeof PALETTES; speed?: number; spread?: number; angle?: number; gravity?: number;
}

function loop(t: number) {
  if (!canvas) { raf = 0; return; }
  const raw = t - last || 16.7;
  const dt = Math.min(0.033, raw / 1000);
  last = t;
  frameEma = frameEma * 0.85 + Math.min(raw, 100) * 0.15;
  if (frameEma > 24) quality = Math.max(0.35, quality * 0.92);
  else if (frameEma < 18) quality = Math.min(1, quality + 0.004);
  const g = canvas.getContext('2d')!;
  g.setTransform(ratio, 0, 0, ratio, 0, 0);
  if (dirty) g.clearRect(dirty[0], dirty[1], dirty[2] - dirty[0], dirty[3] - dirty[1]);
  parts = parts.filter((p) => (p.life += dt) < p.max);
  // running slow: thin out what's already flying too
  const cap = Math.round(MAX * quality);
  if (parts.length > cap) parts.length = cap;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of parts) {
    p.vx *= 1 - p.drag * dt;
    p.vy = p.vy * (1 - p.drag * dt) + p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    const k = 1 - p.life / p.max;
    // the drawn box, with room for a spark's tail and a confetti flake's spin
    const pad = p.kind === 'spark' ? Math.abs(p.vx * 0.035) + Math.abs(p.vy * 0.035) + p.size + 2 : p.size + 2;
    if (p.x - pad < x0) x0 = p.x - pad;
    if (p.y - pad < y0) y0 = p.y - pad;
    if (p.x + pad > x1) x1 = p.x + pad;
    if (p.y + pad > y1) y1 = p.y + pad;
    g.globalAlpha = Math.min(1, k * 1.6);
    g.fillStyle = p.color;
    if (p.kind === 'confetti') {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.scale(1, Math.abs(Math.cos(p.rot * 1.7)) + 0.15);
      g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      g.restore();
    } else if (p.kind === 'heart') {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot * 0.2);
      const s = p.size / 10;
      g.scale(s, s);
      g.beginPath();
      g.moveTo(0, 3);
      g.bezierCurveTo(-5, -1, -4, -6, 0, -3);
      g.bezierCurveTo(4, -6, 5, -1, 0, 3);
      g.fill();
      g.restore();
    } else if (p.kind === 'spark') {
      g.strokeStyle = p.color;
      g.lineWidth = p.size * k;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
      g.stroke();
    } else {
      g.beginPath();
      g.arc(p.x, p.y, p.size * (0.4 + 0.6 * k), 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  dirty = parts.length ? [Math.max(0, x0), Math.max(0, y0), Math.min(cw, x1), Math.min(ch, y1)] : null;
  if (parts.length) raf = requestAnimationFrame(loop);
  else { raf = 0; canvas.style.visibility = 'hidden'; }
}

export const particles = {
  burst(o: BurstOpts) {
    if (!canvas || reducedMotion()) return;
    const kind = o.kind ?? 'spark';
    const pal = PALETTES[o.palette ?? (kind === 'confetti' ? 'confetti' : 'ember')];
    const n = Math.min(Math.round((o.count ?? 40) * quality), MAX - parts.length);
    const speed = o.speed ?? 520;
    const spread = o.spread ?? Math.PI * 2;
    const angle = o.angle ?? -Math.PI / 2;
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = speed * (0.35 + Math.random() * 0.75);
      parts.push({
        x: o.x, y: o.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0,
        max: kind === 'confetti' ? 2.2 + Math.random() * 1.4 : kind === 'ember' ? 1.1 + Math.random() * 0.9 : 0.45 + Math.random() * 0.45,
        size: kind === 'confetti' ? 7 + Math.random() * 6 : kind === 'heart' ? 9 + Math.random() * 8 : 2 + Math.random() * 2.5,
        color: pal[(Math.random() * pal.length) | 0], kind,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14,
        drag: kind === 'confetti' ? 1.6 : kind === 'spark' ? 2.4 : 1.2,
        g: o.gravity ?? (kind === 'confetti' ? 420 : kind === 'ember' ? -40 : 260),
      });
    }
    // shown only while something is flying, so an idle canvas adds nothing to compositing
    if (!raf) { canvas.style.visibility = 'visible'; last = performance.now(); raf = requestAnimationFrame(loop); }
  },
  /** Confetti from both top corners, for a win. */
  celebrate() {
    const w = window.innerWidth;
    particles.burst({ x: -10, y: window.innerHeight * 0.25, kind: 'confetti', count: 90, angle: -Math.PI / 4, spread: 0.9, speed: 900 });
    particles.burst({ x: w + 10, y: window.innerHeight * 0.25, kind: 'confetti', count: 90, angle: -Math.PI * 3 / 4, spread: 0.9, speed: 900 });
  },
};

export function FxCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const size = () => {
      cw = window.innerWidth;
      ch = window.innerHeight;
      ratio = Math.min(2, window.devicePixelRatio || 1, Math.sqrt(MAX_PIXELS / Math.max(1, cw * ch)));
      c.width = Math.round(cw * ratio);
      c.height = Math.round(ch * ratio);
      dirty = null;
    };
    size();
    canvas = c;
    window.addEventListener('resize', size);
    return () => {
      window.removeEventListener('resize', size);
      if (canvas === c) canvas = null;
      cancelAnimationFrame(raf);
      raf = 0;
      parts = [];
    };
  }, []);
  return <canvas ref={ref} aria-hidden className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 70, visibility: 'hidden' }} />;
}

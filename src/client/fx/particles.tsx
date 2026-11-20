import { useEffect, useRef } from 'react';
import { reducedMotion } from './prefs';

/**
 * One full-screen canvas for sparks, embers and confetti. It only runs its frame loop while
 * particles are alive, caps the count, and does nothing at all under reduced motion.
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
  const dt = Math.min(0.033, (t - last) / 1000 || 0.016);
  last = t;
  const g = canvas.getContext('2d')!;
  const dpr = canvas.width / canvas.clientWidth;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  parts = parts.filter((p) => (p.life += dt) < p.max);
  for (const p of parts) {
    p.vx *= 1 - p.drag * dt;
    p.vy = p.vy * (1 - p.drag * dt) + p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    const k = 1 - p.life / p.max;
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
  if (parts.length) raf = requestAnimationFrame(loop);
  else { raf = 0; g.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight); }
}

export const particles = {
  burst(o: BurstOpts) {
    if (!canvas || reducedMotion()) return;
    const kind = o.kind ?? 'spark';
    const pal = PALETTES[o.palette ?? (kind === 'confetti' ? 'confetti' : 'ember')];
    const n = Math.min(o.count ?? 40, MAX - parts.length);
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
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
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
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(window.innerWidth * dpr);
      c.height = Math.round(window.innerHeight * dpr);
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
  return <canvas ref={ref} aria-hidden className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 70 }} />;
}

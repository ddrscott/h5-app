import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bot, Crown, WifiOff } from 'lucide-react';
import type { Player } from '../../types/game';
import { CardBack } from '../ui/CardFace';
import { KickButton } from '../ui/KickButton';
import { PersonaBadge } from '../ui/PersonaBadge';
import { registry } from '../../fx/layout';

/** The server plays for an absent player after this long (room.ts TURN_TIMEOUT_MS). */
export const ABSENT_TURN_MS = 30_000;

const ORDINAL = ['', '1ST', '2ND', '3RD', '4TH', '5TH', '6TH'];

export interface SeatProps {
  player: Player;
  x: number;
  y: number;
  active: boolean;
  leader: boolean;
  /** this seat's place this game, once out */
  place?: number;
  /** bumps when this player passes, to stamp PASS */
  passBeat: number;
  compact: boolean;
  /** draws the whole seat this much bigger on a large screen (see seatScale) */
  scale?: number;
  onKick?: () => void;
}

/** Initials for the avatar tile: "Balanced Betty" → BB, "Balanced Betty 2" → B2. */
const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const last = parts[parts.length - 1];
  if (parts.length > 1 && /^\d+$/.test(last)) return (parts[0][0] + last).toUpperCase().slice(0, 3);
  const s = parts.length > 1 ? parts[0][0] + parts[1][0] : [...parts[0]].slice(0, 2).join('');
  return s.toUpperCase();
};

let nameRuler: CanvasRenderingContext2D | null = null;
/**
 * Font size for a seat's name in its caption box: the largest up to `max` at which the longest
 * word fits `room` across, so a name only ever breaks between words ("Aggressive / Annie"), never
 * inside one. Measured with Barlow at weight 800.
 */
export function nameFontPx(name: string, room: number, max: number, min = 9) {
  return nameFit(name, room, max, min).px;
}

/**
 * Same as nameFontPx, plus whether the longest word still overflows at the `min` floor. When it
 * does (a 20-letter single word on a phone seat), the caption has to break inside the word rather
 * than get clipped mid-letter at its slanted edge.
 */
const fitCache = new Map<string, { px: number; breakAnywhere: boolean }>();
export function nameFit(name: string, room: number, max: number, min = 9): { px: number; breakAnywhere: boolean } {
  const key = `${name}|${room}|${max}|${min}`;
  const hit = fitCache.get(key);
  if (hit) return hit;
  const out = measureName(name, room, max, min);
  // only remember a measurement taken in the real face, not the fallback it shows while loading
  if (typeof document !== 'undefined' && document.fonts?.status === 'loaded') fitCache.set(key, out);
  return out;
}
/**
 * Font size for a one-line seat name (the full plate off a phone): the largest up to `max` at which
 * the whole name fits `room`, stopping at `min`; past that the caption ends in an ellipsis.
 */
export function lineFontPx(name: string, room: number, max: number, min: number) {
  return nameFit(name.replace(/\s+/g, '\u00a0'), room, max, min).px;
}
function measureName(name: string, room: number, max: number, min: number): { px: number; breakAnywhere: boolean } {
  nameRuler ??= typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  const longest = name.split(/[ \t\n]+/).reduce((a, b) => (b.length > a.length ? b : a), '');
  if (!longest) return { px: max, breakAnywhere: false };
  let w = longest.length * 0.56 * 100;
  if (nameRuler) { nameRuler.font = '800 100px Barlow, ui-sans-serif, system-ui, sans-serif'; w = nameRuler.measureText(longest).width; }
  const ideal = Math.floor((room / w) * 100 * 2) / 2;
  return { px: Math.max(min, Math.min(max, ideal)), breakAnywhere: ideal < min };
}

/** Avatar letters for everyone at the table, made unique when two players' initials collide. */
export function seatBadges(players: Array<{ id: string; name: string }>): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Map<string, number>();
  for (const p of players) {
    const base = initials(p.name);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    out.set(p.id, n === 1 ? base : `${base[0]}${n}`);
  }
  return out;
}

/** A countdown ring for an absent player's turn, so the table knows the room will move for them. */
const TimerRing: React.FC<{ startedAt: number; size: number }> = ({ startedAt, size }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, 1 - (now - startedAt) / ABSENT_TURN_MS);
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="absolute -inset-[5px] pointer-events-none" width={size + 10} height={size + 10} viewBox={`-5 -5 ${size + 10} ${size + 10}`} aria-label={`${Math.ceil(left * 30)} seconds`}>
      <circle cx={size / 2} cy={size / 2} r={r + 3} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="2.5" />
      <circle
        cx={size / 2} cy={size / 2} r={r + 3} fill="none" stroke="#E85D00" strokeWidth="3"
        strokeDasharray={c} strokeDashoffset={c * (1 - left)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .25s linear' }}
      />
    </svg>
  );
};

/**
 * Plate widths: the leaning ink plate holds the name and the record line, nothing else, so it can
 * be a little wider than the old plate beside a portrait. The face-down hand sits outside it.
 */
export const PLATE_W = 172;
export const PLATE_W_COMPACT = 128;
const PLATE_SHAPE = 'polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)';
const PLATE_INNER = 'polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)';

export const Seat: React.FC<SeatProps> = React.memo(({ player, x, y, active, leader, place, passBeat, compact, scale = 1, onKick }) => {
  const absent = player.isActive === false;
  const out = player.isOut || (place !== undefined && place > 0);
  const [turnStart, setTurnStart] = useState(0);
  useEffect(() => { if (active) setTurnStart(Date.now()); }, [active]);

  const [stamp, setStamp] = useState(0);
  useEffect(() => {
    if (!passBeat) return;
    setStamp(passBeat);
    const t = window.setTimeout(() => setStamp(0), 1300);
    return () => clearTimeout(t);
  }, [passBeat]);

  const fanCount = Math.min(player.handCount, compact ? 6 : 8);
  const backW = compact ? 18 : 24;
  const plateW = compact ? PLATE_W_COMPACT : PLATE_W;
  // caption room: plate width less its padding, the caption's own padding and its 5px slanted edge
  const nameRoom = plateW - 28 - 12 - 6 - 5;
  const nameSize = nameFit(player.name, nameRoom, 12);
  // off a phone the name is one line, as big as fits the plate before it falls back to an ellipsis
  const linePx = compact ? 0 : lineFontPx(player.name, nameRoom, 16, 13);
  // A passed seat stays a solid ink panel (nothing behind shows through); its paper and ink go
  // gray instead, and the PASS stamp and card count keep full strength.
  const dim = player.hasPassed && !active ? 'grayscale(1) brightness(0.58)' : undefined;
  const fanW = backW + Math.max(0, fanCount - 1) * backW * 0.34;

  return (
    <motion.div
      className="absolute z-30 flex flex-col items-center w-max"
      style={{ left: x, top: y, x: '-50%', y: '-50%' }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: (active ? 1.06 : 1) * scale }}
      transition={{ type: 'spring', stiffness: 400, damping: 24 }}
    >
      {/*
        The seat is a leaning ink name plate with the player's face-down hand held up above it, the
        cards tucked just behind the plate's top edge and the count beside them. The plate holds
        the name in a caption box and a record line with the personality chip.
      */}
      <div data-plate className="relative flex flex-col items-center" style={{ width: plateW + 5 }}>
        {/* their hand, face down: a small fan whose size follows the card count */}
        <div className="relative z-0 flex justify-center w-full" style={{ height: backW * 1.4 + 2, marginBottom: compact ? -5 : -7 }}>
          <div ref={(el) => registry.seat(player.id, el)} className="relative" style={{ height: backW * 1.4 + 2, width: fanW }}>
            {Array.from({ length: fanCount }).map((_, i) => {
              const c = i - (fanCount - 1) / 2;
              return (
                <motion.div
                  key={i}
                  className="absolute top-0"
                  style={{ width: backW, height: backW * 1.4, left: i * backW * 0.34, borderRadius: 2, filter: dim, transformOrigin: '50% 100%' }}
                  initial={{ opacity: 0, y: -12, rotate: 0 }}
                  animate={{ opacity: 1, y: Math.abs(c) * 1.2, rotate: c * 6 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22, delay: i * 0.02 }}
                >
                  <CardBack />
                </motion.div>
              );
            })}
            {player.handCount > 0 && (
              <span className={`absolute z-40 top-[42%] -translate-y-1/2 ${compact ? '-right-[30px]' : '-right-[34px]'}`}>
                <motion.span
                  key={player.handCount}
                  initial={{ scale: 1.5 }}
                  animate={{ scale: 1 }}
                  data-count
                  className="relative grid place-items-center min-w-[24px] h-[22px] px-1 font-display text-[16px] leading-none pt-px bg-paper text-ink border-2 border-ink rotate-3 shadow-[2px_2px_0_#000]"
                >
                  {player.handCount}
                </motion.span>
                {active && absent && turnStart > 0 && <TimerRing startedAt={turnStart} size={24} />}
              </span>
            )}
            {/* PASS: a stamp that thunks onto their cards */}
            <AnimatePresence>
              {stamp > 0 && (
                <motion.div
                  key={stamp}
                  data-stamp
                  className="absolute z-30 pointer-events-none font-display text-[19px] leading-none tracking-[0.08em] px-2 pt-1 pb-0.5 border-[3px] border-ink text-ink bg-paper shadow-hard-sm -left-5 top-1/2"
                  initial={{ y: '-50%', scale: 1.8, rotate: -14, opacity: 0 }}
                  animate={{ y: '-50%', scale: 1, rotate: -8, opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.25 } }}
                  transition={{ type: 'spring', stiffness: 700, damping: 20 }}
                >
                  PASS
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* the plate, with its hard offset drawn as a shape behind it (orange on its turn) */}
        <div className="relative z-10 self-start" style={{ width: plateW }}>
          <span aria-hidden className="absolute inset-0 translate-x-[5px] translate-y-[5px]" style={{ background: active ? '#E85D00' : '#000', clipPath: PLATE_SHAPE }} />
          <span aria-hidden className="absolute inset-0" style={{ background: active ? '#E85D00' : dim ? '#848482' : '#FAFAF7', clipPath: PLATE_SHAPE }} />
          <span aria-hidden className="absolute inset-[3px]" style={{ background: '#0B0B0D', clipPath: PLATE_INNER }} />
          {dim && <span aria-hidden className="tone absolute inset-[3px] text-paper/[0.12]" style={{ clipPath: PLATE_INNER }} />}
          {leader && (
            <Crown size={18} strokeWidth={2.75} className="absolute z-20 -top-3 -left-1 text-ember fill-paper drop-shadow-[2px_2px_0_#000]" aria-label="Leads this trick" />
          )}
          <div className="relative flex flex-col items-start gap-1 pl-4 pr-3 py-1.5">
            {/*
              name in a caption box; full names, two lines on a phone rather than "Aggressive…",
              broken only between words (the font shrinks until the longest word fits)
            */}
            <p data-seat-name className={`max-w-full -rotate-2 -ml-1 px-1.5 pt-[2px] pb-[1px] font-extrabold break-normal ${compact ? 'leading-[1.1] line-clamp-2' : 'leading-tight truncate'} ${active ? 'bg-ember text-ink' : 'bg-paper text-ink'}`}
              style={{ filter: dim, clipPath: 'polygon(0 0, 100% 0, calc(100% - 5px) 100%, 0 100%)', fontSize: compact ? nameSize.px : linePx, overflowWrap: compact && nameSize.breakAnywhere ? 'anywhere' : undefined }}>
              {player.name}
            </p>
            <p className={`font-sans tabular-nums ${compact ? 'text-[11px]' : 'text-[12px]'} font-semibold text-mist flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-none`} style={{ filter: dim }}>
              {absent && <WifiOff size={11} className="text-paper" aria-label="Disconnected" />}
              <span>{player.wins}W·{player.losses}L</span>
              {/* a bot's personality: emblem and name, the blurb on hover; on its turn it says it's thinking */}
              {player.isBot && <PersonaBadge persona={player.persona} thinking={active && !out && !absent} compact={compact} />}
              {out && place ? <span className="font-display text-[13px] leading-none px-1 pt-px bg-paper text-ink">{ORDINAL[place] ?? `${place}TH`}</span> : null}
              {onKick && absent && <KickButton name={player.name} onConfirm={onKick} />}
            </p>
          </div>
        </div>
      </div>
      {player.autopilot && (
        <div
          className="mt-2 flex items-center gap-1 px-1.5 py-0.5 bg-ink border-2 border-ember text-[11px] font-bold text-bone max-w-[150px]"
          title={`${player.autopilot}, an uploaded bot, is playing for ${player.name}`}
          data-autopilot
        >
          <Bot size={11} className="text-ember shrink-0" aria-label="Bot playing" />
          <span className="truncate">{player.autopilot}</span>
        </div>
      )}

    </motion.div>
  );
}, (a, b) =>
  // Only redraw when something this seat shows changed: the table re-renders on every state
  // message, and the players map hands us a fresh object each time.
  a.x === b.x && a.y === b.y && a.active === b.active && a.leader === b.leader && a.place === b.place &&
  a.passBeat === b.passBeat && a.compact === b.compact && a.scale === b.scale && !a.onKick === !b.onKick &&
  a.player.id === b.player.id && a.player.name === b.player.name && a.player.handCount === b.player.handCount &&
  a.player.hasPassed === b.player.hasPassed && a.player.isActive === b.player.isActive && a.player.isOut === b.player.isOut &&
  a.player.position === b.player.position && a.player.wins === b.player.wins && a.player.losses === b.player.losses &&
  a.player.isBot === b.player.isBot && a.player.persona === b.player.persona && a.player.autopilot === b.player.autopilot);
Seat.displayName = 'Seat';

/** Seat centers for the opponents, in turn order after you (clockwise from your left). */
export function seatSpots(k: number, w: number, h: number, portrait: boolean): Array<{ x: number; y: number }> {
  const P: Record<number, Array<[number, number]>> = portrait
    ? {
        1: [[50, 12]],
        2: [[17, 27], [83, 27]],
        3: [[15, 33], [50, 11], [85, 33]],
        4: [[15, 41], [28, 13], [72, 13], [85, 41]],
        5: [[15, 47], [17, 21], [50, 10], [83, 21], [85, 47]],
      }
    : {
        1: [[50, 13]],
        2: [[22, 20], [78, 20]],
        3: [[10, 42], [50, 12], [90, 42]],
        4: [[10, 46], [32, 13], [68, 13], [90, 46]],
        5: [[9, 50], [22, 17], [50, 11], [78, 17], [91, 50]],
      };
  return (P[k] ?? P[5]).map(([px, py]) => ({ x: (px / 100) * w, y: (py / 100) * h }));
}

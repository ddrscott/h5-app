import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bot, Crown, WifiOff } from 'lucide-react';
import type { Player } from '../../types/game';
import { CardBack } from '../ui/CardFace';
import { KickButton } from '../ui/KickButton';
import { PersonaBadge } from '../ui/PersonaBadge';
import { PersonaEmblem } from '../ui/PersonaEmblem';
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
  /** avatar letters, unique at this table (see seatBadges) */
  badge?: string;
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
  nameRuler ??= typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  const longest = name.split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), '');
  if (!longest) return max;
  let w = longest.length * 0.56 * 100;
  if (nameRuler) { nameRuler.font = '800 100px Barlow, ui-sans-serif, system-ui, sans-serif'; w = nameRuler.measureText(longest).width; }
  return Math.max(min, Math.min(max, Math.floor((room / w) * 100 * 2) / 2));
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

export const Seat: React.FC<SeatProps> = ({ player, x, y, active, leader, place, passBeat, compact, scale = 1, badge, onKick }) => {
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

  const fanCount = Math.min(player.handCount, compact ? 5 : 8);
  const backW = compact ? 18 : 24;
  const pw = compact ? 46 : 64, ph = compact ? 60 : 82;
  const colW = compact ? 88 : 140;
  const portraitFill = out ? '#8E8E8F' : active ? '#E85D00' : '#FAFAF7';
  const P = 'polygon(0 0, 100% 0, 100% 80%, 78% 100%, 0 100%)';

  return (
    <motion.div
      className="absolute z-30 flex flex-col items-center w-max"
      style={{ left: x, top: y, x: '-50%', y: '-50%' }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: player.hasPassed && !active ? 0.62 : 1, scale: (active ? 1.06 : 1) * scale }}
      transition={{ type: 'spring', stiffness: 400, damping: 24 }}
    >
      {/*
        The seat is a comic panel: a tilted portrait frame (the bot's emblem, or a person's
        initials, on paper with screentone) overlapping a leaning ink plate that holds the name in
        a caption box, their face-down hand and their record.
      */}
      <div data-plate className="relative flex items-center" style={{ filter: `drop-shadow(5px 5px 0 ${active ? '#E85D00' : '#000'})` }}>
        {/* portrait frame */}
        <div className="relative z-10 shrink-0 -rotate-[4deg]" style={{ width: pw, height: ph, marginRight: -10 }}>
          <span aria-hidden className="absolute inset-0" style={{ background: active ? '#0B0B0D' : '#FAFAF7', clipPath: P }} />
          <span aria-hidden className="absolute inset-[3px]" style={{ background: '#0B0B0D', clipPath: P }} />
          <span aria-hidden className="absolute inset-[5px] overflow-hidden" style={{ background: portraitFill, clipPath: P }}>
            <span className="tone absolute inset-0 text-ink/25" style={{ clipPath: 'polygon(0 62%, 100% 30%, 100% 100%, 0 100%)' }} />
          </span>
          <div className="absolute inset-[5px] grid place-items-center">
            {player.isBot ? (
              <PersonaEmblem persona={player.persona} size={compact ? 30 : 42} className={active && !out && !absent ? 'animate-pulse' : ''} />
            ) : (
              <span className={`font-display leading-none tracking-[0.02em] text-ink pt-1 ${compact ? 'text-[22px]' : 'text-[32px]'}`}>{badge ?? initials(player.name)}</span>
            )}
          </div>
          {player.isBot && (
            <span className="absolute -bottom-1.5 left-0.5 font-display text-[12px] leading-none tracking-[0.04em] px-1 pt-[3px] pb-[1px] bg-ink text-paper border-[1.5px] border-paper">
              {badge ?? initials(player.name)}
            </span>
          )}
          {active && absent && turnStart > 0 && <TimerRing startedAt={turnStart} size={pw} />}
          {leader && (
            <Crown size={18} strokeWidth={2.75} className="absolute -top-3 -left-2 text-ember fill-paper drop-shadow-[2px_2px_0_#000]" aria-label="Leads this trick" />
          )}
        </div>

        {/* the plate */}
        <div className="relative" style={{ width: colW + 14 }}>
          <span aria-hidden className="absolute inset-0" style={{ background: active ? '#E85D00' : '#FAFAF7', clipPath: 'polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)' }} />
          <span aria-hidden className="absolute inset-[3px]" style={{ background: '#0B0B0D', clipPath: 'polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)' }} />
          <div className="relative flex flex-col items-start gap-1 pl-4 pr-3 py-1.5">
            {/*
              name in a caption box; full names, two lines on a phone rather than "Aggressive…",
              broken only between words (the font shrinks until the longest word fits)
            */}
            <p data-seat-name className={`max-w-full -rotate-2 -ml-1 px-1.5 pt-[2px] pb-[1px] font-extrabold break-normal ${compact ? 'leading-[1.1] line-clamp-2' : 'text-[13px] leading-tight truncate'} ${active ? 'bg-ember text-ink' : 'bg-paper text-ink'}`}
              style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 5px) 100%, 0 100%)', fontSize: compact ? nameFontPx(player.name, colW + 14 - 28 - 12 - 6, 12) : undefined }}>
              {player.name}
            </p>
            {/* their hand, face down: a small fan whose size follows the card count */}
            <div ref={(el) => registry.seat(player.id, el)} className="relative" style={{ height: backW * 1.4 + 2, width: backW + Math.max(0, fanCount - 1) * backW * 0.34 }}>
              {Array.from({ length: fanCount }).map((_, i) => {
                const c = i - (fanCount - 1) / 2;
                return (
                  <motion.div
                    key={i}
                    className="absolute top-0"
                    style={{ width: backW, height: backW * 1.4, left: i * backW * 0.34, borderRadius: 2 }}
                    initial={{ opacity: 0, y: -12, rotate: 0 }}
                    animate={{ opacity: 1, y: Math.abs(c) * 1.2, rotate: c * 6 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22, delay: i * 0.02 }}
                  >
                    <CardBack />
                  </motion.div>
                );
              })}
              {player.handCount > 0 && (
                <motion.span
                  key={player.handCount}
                  initial={{ scale: 1.5 }}
                  animate={{ scale: 1 }}
                  data-count
                  className="absolute z-40 -right-7 top-1/2 -translate-y-1/2 min-w-[24px] h-[22px] px-1 grid place-items-center font-display text-[16px] leading-none pt-px bg-paper text-ink border-2 border-ink rotate-3"
                >
                  {player.handCount}
                </motion.span>
              )}
              {/* PASS: a stamp that thunks onto their cards */}
              <AnimatePresence>
                {stamp > 0 && (
                  <motion.div
                    key={stamp}
                    data-stamp
                    className="absolute z-30 pointer-events-none font-display text-[19px] leading-none tracking-[0.08em] px-2 pt-1 pb-0.5 border-[3px] border-ink text-ink bg-paper shadow-hard-sm -left-3 top-1/2"
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
            <p className="font-sans tabular-nums text-[11px] font-semibold text-mist flex items-center gap-1 leading-none">
              {absent && <WifiOff size={11} className="text-paper" aria-label="Disconnected" />}
              <span>{player.wins}W·{player.losses}L</span>
              {/* a bot's personality; on its turn the badge says it's thinking */}
              {player.isBot && <PersonaBadge persona={player.persona} thinking={active && !out && !absent} compact={compact} />}
              {out && place ? <span className="font-display text-[13px] leading-none px-1 pt-px bg-paper text-ink">{ORDINAL[place] ?? `${place}TH`}</span> : null}
            </p>
          </div>
        </div>
        {onKick && absent && <KickButton name={player.name} onConfirm={onKick} />}
      </div>
      {player.autopilot && (
        <div
          className="mt-1 flex items-center gap-1 px-1.5 py-0.5 bg-ink border-2 border-ember text-[11px] font-bold text-bone max-w-[150px]"
          title={`${player.autopilot}, an uploaded bot, is playing for ${player.name}`}
          data-autopilot
        >
          <Bot size={11} className="text-ember shrink-0" aria-label="Bot playing" />
          <span className="truncate">{player.autopilot}</span>
        </div>
      )}

    </motion.div>
  );
};

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

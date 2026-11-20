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
  const backW = compact ? 20 : 26;
  const av = compact ? 34 : 40;

  return (
    <motion.div
      className="absolute z-30 flex flex-col items-center w-max"
      style={{ left: x, top: y, x: '-50%', y: '-50%' }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: player.hasPassed && !active ? 0.62 : 1, scale: (active ? 1.06 : 1) * scale }}
      transition={{ type: 'spring', stiffness: 400, damping: 24 }}
    >
      {/* their hand, face down: a small fan whose size follows the card count */}
      <div ref={(el) => registry.seat(player.id, el)} className="relative mb-1" style={{ height: backW * 1.4 + 4, width: backW + Math.max(0, fanCount - 1) * backW * 0.32 }}>
        {Array.from({ length: fanCount }).map((_, i) => {
          const c = i - (fanCount - 1) / 2;
          return (
            <motion.div
              key={i}
              className="absolute top-0"
              style={{ width: backW, height: backW * 1.4, left: i * backW * 0.32, borderRadius: 2, boxShadow: '0 2px 3px rgba(0,0,0,.4)' }}
              initial={{ opacity: 0, y: -12, rotate: 0 }}
              animate={{ opacity: 1, y: Math.abs(c) * 1.5, rotate: c * 7 }}
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
            className="absolute z-20 -right-3 -top-2 min-w-[24px] h-[22px] px-1 grid place-items-center font-display text-[15px] leading-none pt-px bg-paper text-ink border-2 border-ink shadow-hard-sm"
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
              className="absolute z-10 pointer-events-none font-display text-[19px] leading-none tracking-[0.08em] px-2 pt-1 pb-0.5 border-[3px] border-ink text-ink bg-paper shadow-hard-sm"
              // low on the fan with its right edge short of the card count (top right), so the count stays readable
              style={{ top: (backW * 1.4 + 4) * 0.72, right: 14 }}
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

      {/* nameplate */}
      <div
        data-plate
        className={`relative flex items-center gap-2 pl-1 pr-2.5 py-1 border-[3px] bg-ink transition-colors duration-200 ${
          active ? 'border-ember shadow-[5px_5px_0_0_#E85D00]' : 'border-paper shadow-hard'
        }`}
        style={{ maxWidth: compact ? 136 : 210 }}
      >
        {/* the portrait: a small comic panel, screentone shading behind hand-lettered initials */}
        <div className="relative shrink-0 grid place-items-center font-display text-[17px] leading-none tracking-[0.04em] text-ink"
          style={{ width: av, height: av }}>
          <span aria-hidden className="absolute inset-0 border-2 border-ink"
            style={{ background: out ? '#8E8E8F' : active ? '#E85D00' : '#FAFAF7', clipPath: 'polygon(0 0, 100% 0, 100% 78%, 82% 100%, 0 100%)' }} />
          <span aria-hidden className="tone absolute inset-0 text-ink/25" style={{ clipPath: 'polygon(0 55%, 100% 25%, 100% 78%, 82% 100%, 0 100%)' }} />
          <span className="relative pt-0.5">{badge ?? initials(player.name)}</span>
          {active && absent && turnStart > 0 && <TimerRing startedAt={turnStart} size={av} />}
          {leader && (
            // top-right, so on the left seat it stays on screen
            <Crown size={16} strokeWidth={2.75} className="absolute -top-3 -right-2.5 text-ember fill-paper drop-shadow-[2px_2px_0_#000]" aria-label="Leads this trick" />
          )}
        </div>
        <div className="min-w-0 leading-tight">
          {/* full names, always: wrap to two lines on a phone rather than cut "Aggressive…" */}
          <p className={`font-bold break-words ${compact ? 'text-[12px] leading-[1.1] line-clamp-2' : 'text-[13px] truncate'} ${active ? 'text-ember-hot' : 'text-bone'}`}>
            {player.name}
          </p>
          <p className="font-sans tabular-nums text-[11px] font-semibold text-mist flex items-center gap-1">
            {absent && <WifiOff size={11} className="text-paper" aria-label="Disconnected" />}
            {/* the live prompt sits on the stats line, so the name keeps both of its lines */}
            <span>{player.wins}W·{player.losses}L</span>
            {/* a bot's personality; on its turn the badge says it's thinking */}
            {player.isBot && <PersonaBadge persona={player.persona} thinking={active && !out && !absent} compact={compact} />}
            {out && place ? <span className="font-display text-[13px] leading-none px-1 pt-px bg-paper text-ink">{ORDINAL[place] ?? `${place}TH`}</span> : null}
          </p>
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

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { LogOut, Play, Trophy } from 'lucide-react';
import type { Player } from '../../types/game';
import { sfx } from '../../fx/sound';
import { haptics } from '../../fx/haptics';
import { particles } from '../../fx/particles';
import { reducedMotion } from '../../fx/prefs';

interface Standing { playerId: string; name: string; wins: number; losses: number }

interface GameOverProps {
  winner: { id?: string; name: string; wins: number };
  finalStandings: Standing[];
  players?: Map<string, Player>;
  myPlayerId?: string;
  onPlayAgain: () => void;
  onLeaveGame: () => void;
  isHost?: boolean;
  hostName?: string;
}

/** What each player's record was before this game ended, to count up from. Lives across games. */
const lastSeen = new Map<string, { wins: number; losses: number }>();

const CountUp: React.FC<{ from: number; to: number; delay: number; onTick?: () => void; className?: string }> = ({ from, to, delay, onTick, className }) => {
  const [v, setV] = useState(from);
  const tick = useRef(onTick);
  tick.current = onTick;
  useEffect(() => {
    if (from === to || reducedMotion()) { setV(to); return; }
    const timers: number[] = [];
    const steps = to - from;
    for (let i = 1; i <= steps; i++) {
      timers.push(window.setTimeout(() => { setV(from + i); tick.current?.(); }, delay * 1000 + i * 140));
    }
    return () => timers.forEach(clearTimeout);
  }, [from, to, delay]);
  return (
    <motion.span key={v} className={className} initial={{ scale: v === from ? 1 : 1.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 14 }}>
      {v}
    </motion.span>
  );
};

const ORD = ['—', '1st', '2nd', '3rd', '4th', '5th', '6th'];

export const GameOver: React.FC<GameOverProps> = ({ winner, finalStandings, players, myPlayerId, onPlayAgain, onLeaveGame, isHost = true, hostName = 'the host' }) => {
  const iWon = !!myPlayerId && (winner.id ? winner.id === myPlayerId : players?.get(myPlayerId)?.name === winner.name);

  // Rows in finishing order for this game: who went out 1st, 2nd... and the one left holding cards.
  const rows = [...finalStandings].map((s) => {
    const p = players?.get(s.playerId);
    return { ...s, place: p?.isOut && p.position ? p.position : 0, cardsLeft: p && !p.isOut ? p.handCount : 0 };
  }).sort((a, b) => (a.place || 99) - (b.place || 99) || b.wins - a.wins);

  const before = useRef(new Map(rows.map((r) => {
    const seen = lastSeen.get(r.playerId);
    const wasWinner = r.playerId === winner.id;
    const wasLoser = !r.place && rows.filter((x) => !x.place).length === 1;
    return [r.playerId, seen ?? { wins: r.wins - (wasWinner ? 1 : 0), losses: r.losses - (wasLoser ? 1 : 0) }];
  })));
  useEffect(() => {
    rows.forEach((r) => lastSeen.set(r.playerId, { wins: r.wins, losses: r.losses }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t1 = window.setTimeout(() => {
      if (iWon) { sfx.win(); haptics.win(); particles.celebrate(); }
      else { sfx.gameOver(); particles.burst({ x: window.innerWidth / 2, y: window.innerHeight * 0.3, kind: 'confetti', count: 50, speed: 600 }); }
    }, 250);
    const t2 = iWon ? window.setTimeout(() => particles.celebrate(), 1300) : 0;
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let tickN = 0;
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-ink/70 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} />
      <motion.div
        className="relative panel w-full max-w-md p-5 sm:p-6"
        initial={{ y: 40, scale: 0.9, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24, delay: 0.1 }}
        role="dialog"
        aria-labelledby="go-title"
      >
        <p className="section-head mb-3">game_result</p>
        <div className="flex items-center gap-3 mb-1">
          <motion.div
            className="grid place-items-center w-12 h-12 bg-brass text-ink shrink-0"
            initial={{ rotate: -30, scale: 0 }}
            animate={{ rotate: -4, scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 14, delay: 0.35 }}
          >
            <Trophy size={26} strokeWidth={2.4} />
          </motion.div>
          <motion.h1
            id="go-title"
            className="font-display font-black leading-[0.95] text-[clamp(30px,8vw,44px)] text-paper"
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.3 }}
          >
            {iWon ? 'You win!' : <>{winner.name} <span className="text-brass">wins</span></>}
          </motion.h1>
        </div>
        <p className="text-sm text-mist mb-5">{iWon ? 'First out. The table is yours.' : 'First out takes the game.'}</p>

        <div className="border border-white/10 mb-5">
          <div className="grid grid-cols-[3.2rem_1fr_3rem_3rem] px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] text-mist border-b border-white/10">
            <span>OUT</span><span>PLAYER</span><span className="text-right">W</span><span className="text-right">L</span>
          </div>
          {rows.map((r, i) => {
            const b = before.current.get(r.playerId) ?? { wins: r.wins, losses: r.losses };
            const me = r.playerId === myPlayerId;
            const first = r.place === 1;
            return (
              <motion.div
                key={r.playerId}
                className={`relative grid grid-cols-[3.2rem_1fr_3rem_3rem] items-center px-3 py-2 border-b border-white/5 last:border-b-0 ${first ? 'bg-brass/10' : ''}`}
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26, delay: 0.55 + i * 0.12 }}
              >
                <span className={`font-mono text-[13px] font-bold ${first ? 'text-brass' : r.place ? 'text-bone/80' : 'text-cinnabar'}`}>
                  {r.place ? ORD[r.place] : 'last'}
                </span>
                <span className={`truncate text-[14px] ${me ? 'text-paper font-semibold' : 'text-bone/90'}`}>
                  {me && <span className="font-mono text-ember">$ </span>}{r.name}
                  {!r.place && r.cardsLeft > 0 && <span className="ml-2 font-mono text-[10px] text-mist">{r.cardsLeft} left</span>}
                </span>
                <CountUp className={`text-right font-mono text-[15px] font-bold ${first ? 'text-brass-light' : 'text-bone'}`} from={b.wins} to={r.wins} delay={0.9 + i * 0.12} onTick={() => sfx.tick(tickN++)} />
                <CountUp className="text-right font-mono text-[15px] text-mist" from={b.losses} to={r.losses} delay={1.0 + i * 0.12} onTick={() => sfx.tick(tickN++)} />
              </motion.div>
            );
          })}
        </div>

        <motion.div className="flex gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
          <button onClick={onLeaveGame} className="btn-secondary">
            <LogOut size={16} /> Leave
          </button>
          {isHost ? (
            <button onClick={onPlayAgain} className="btn-primary flex-1" autoFocus>
              <Play size={16} /> Play again
            </button>
          ) : (
            <p className="flex-1 self-center text-sm text-mist text-right">Waiting for {hostName} to deal</p>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

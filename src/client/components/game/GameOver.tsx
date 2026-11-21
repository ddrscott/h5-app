import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { BarChart3, Check, LogOut, Play, Trophy } from 'lucide-react';
import { useAccount } from '../../contexts/AccountContext';
import { useRoom } from '../../contexts/RoomContext';
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

/** Under the standings: "Saved to your stats" for a signed-in player, a sign-in nudge for a guest. */
const StatsLine: React.FC = () => {
  const { account, openSignIn, openStats } = useAccount();
  const { statsStatus } = useRoom();
  if (account === undefined) return null;
  if (account === null) {
    return (
      <div className="flex items-center justify-between gap-3 mb-4 text-[13px]" data-stats-line="guest">
        <span className="text-mist font-semibold">Guest results vanish with the room.</span>
        <button onClick={openSignIn} className="text-bone underline underline-offset-4 decoration-white/30 hover:text-ember hover:decoration-ember transition-colors shrink-0">
          Sign in to keep your stats
        </button>
      </div>
    );
  }
  const text = statsStatus.state === 'saved' ? 'Saved to your stats'
    : statsStatus.state === 'tracking' ? 'Saving to your stats…'
    : 'Your stats count from the next game';
  return (
    <div className="flex items-center justify-between gap-3 mb-4 text-[13px]" data-stats-line={statsStatus.state}>
      <span className={`inline-flex items-center gap-1.5 ${statsStatus.state === 'saved' ? 'text-paper' : 'text-mist'}`}>
        {statsStatus.state === 'saved' && <Check size={15} strokeWidth={2.6} />}{text}
      </span>
      <button onClick={openStats} className="inline-flex items-center gap-1.5 text-bone hover:text-ember transition-colors shrink-0">
        <BarChart3 size={14} /> Your stats
      </button>
    </div>
  );
};

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
  const title = iWon ? 'YOU WIN!' : `${winner.name} WINS!`;
  // as big as the slab allows: the whole title on one line, at most 13vw and 20vh
  const titleSize = `min(13vw, ${Math.round(150 / Math.max(6, title.length))}vw, 20vh)`;
  const slabFill = iWon ? '#E85D00' : '#FAFAF7';
  const slab = 'polygon(0 18%, 100% 0, 100% 82%, 0 100%)';
  return (
    <div className="fixed inset-0 z-[75] overflow-y-auto overflow-x-hidden" role="dialog" aria-labelledby="go-title">
      <motion.div className="fixed inset-0 bg-ink/85" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} />
      <div className="relative min-h-full flex flex-col items-center justify-center gap-4 sm:gap-6 py-6 px-3">
        {/*
          The winner's slab: a full-bleed panel slashed across the screen at an angle, the title in
          giant lettering on it, a black offset slab behind. It cuts in from the left.
        */}
        <motion.div
          className="relative w-[140vw] -rotate-[5deg]"
          initial={{ x: '-110%' }}
          animate={{ x: '0%' }}
          transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.1 }}
        >
          <div aria-hidden className="absolute inset-0 bg-black" style={{ clipPath: slab, transform: 'translate(0, 14px)' }} />
          <div aria-hidden className="absolute inset-0 bg-paper" style={{ clipPath: slab }} />
          <div aria-hidden className="absolute inset-[6px_0] overflow-hidden" style={{ clipPath: slab, background: slabFill }}>
            <div className="speed-lines absolute left-1/2 top-1/2 w-[3000px] h-[3000px] -ml-[1500px] -mt-[1500px]" style={{ color: 'rgba(11,11,13,.12)' }} />
            <div className="tone absolute inset-0" style={{ color: 'rgba(11,11,13,.12)' }} />
          </div>
          <div className="relative flex flex-col items-center px-[20vw] pt-[max(28px,5vh)] pb-[max(24px,4.5vh)]">
            <p className="section-head !bg-ink !text-paper mb-2 rotate-[2deg]">Game result</p>
            <motion.h1
              id="go-title"
              className="font-display leading-[0.9] tracking-[0.02em] whitespace-nowrap text-center"
              style={{
                fontSize: titleSize,
                color: iWon ? '#FAFAF7' : '#0B0B0D',
                WebkitTextStroke: iWon ? 'max(4px, 0.05em) #0B0B0D' : '0',
                paintOrder: 'stroke fill',
                textShadow: iWon ? '0.05em 0.06em 0 #0B0B0D' : '0.04em 0.05em 0 rgba(11,11,13,.25)',
              }}
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 520, damping: 16, delay: 0.32 }}
            >
              {title}
            </motion.h1>
            <motion.span
              aria-hidden
              className="font-sfx absolute right-[21vw] top-[8%] text-[clamp(26px,5vw,64px)] leading-none"
              style={{ color: iWon ? '#0B0B0D' : '#E85D00', WebkitTextStroke: '3px #FAFAF7', paintOrder: 'stroke fill' }}
              initial={{ scale: 0.3, rotate: 30, opacity: 0 }}
              animate={{ scale: 1, rotate: 12, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 600, damping: 14, delay: 0.5 }}
            >
              砰！
            </motion.span>
          </div>
        </motion.div>

        <motion.p
          className="font-display text-[clamp(20px,3vw,30px)] leading-none tracking-[0.04em] text-paper -rotate-2"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        >
          <Trophy size={22} strokeWidth={2.6} className="inline -mt-1.5 mr-2 text-ember" />
          {iWon ? 'First one out. Nobody laid a finger on you.' : 'First one out takes it all.'}
        </motion.p>

        {/* the standings: one cut strip per player, stepping down like panels on a page */}
        <div className="w-full max-w-xl 2xl:max-w-3xl 2xl:text-[1.15em] -rotate-[1.5deg] flex flex-col gap-2">
          <div className="relative z-10 grid grid-cols-[3.6rem_1fr_3rem_3rem] px-6 font-display text-[15px] leading-none tracking-[0.08em] text-bone" style={{ marginRight: (rows.length - 1) * 10, textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}>
            <span>OUT</span><span>PLAYER</span><span className="text-right">W</span><span className="text-right">L</span>
          </div>
          {rows.map((r, i) => {
            const b = before.current.get(r.playerId) ?? { wins: r.wins, losses: r.losses };
            const me = r.playerId === myPlayerId;
            const first = r.place === 1;
            const strip = 'polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)';
            return (
              <motion.div
                key={r.playerId}
                data-standing
                className="relative"
                style={{ marginLeft: i * 10, marginRight: (rows.length - 1 - i) * 10, filter: `drop-shadow(5px 5px 0 ${first ? '#E85D00' : '#000'})` }}
                initial={{ x: -60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26, delay: 0.55 + i * 0.12 }}
              >
                <span aria-hidden className="absolute inset-0 bg-paper" style={{ clipPath: strip }} />
                {!first && <span aria-hidden className="absolute inset-[3px]" style={{ clipPath: strip, background: me ? '#202023' : '#0B0B0D' }} />}
                <div className="relative grid grid-cols-[3.6rem_1fr_3rem_3rem] items-center px-6 py-2.5">
                  <span className={`font-display text-[26px] leading-none tracking-[0.03em] ${first ? 'text-ink' : r.place ? 'text-bone' : 'text-blood'}`}>
                    {r.place ? ORD[r.place] : 'last'}
                  </span>
                  {/* name on one line (it may truncate); the stuck-with count gets a line of its own so it always lands whole */}
                  <span className="min-w-0 flex flex-col items-start gap-0.5">
                    {/* the YOU chip sits beside the name, never inside it, so a long name truncates before the chip does */}
                    <span className="max-w-full min-w-0 flex items-center gap-2">
                      <span className={`min-w-0 truncate text-[16px] ${first ? 'text-ink font-extrabold' : me ? 'text-paper font-extrabold' : 'text-bone font-semibold'}`}>{r.name}</span>
                      {me && <span data-you className={`shrink-0 font-display text-[15px] leading-tight tracking-[0.05em] px-1.5 pt-px ${first ? 'bg-ink text-ember' : 'bg-ember text-ink'}`}>YOU</span>}
                    </span>
                    {!r.place && r.cardsLeft > 0 && (
                      <span data-stuck className="whitespace-nowrap font-display text-[14px] leading-none tracking-[0.06em] px-1.5 pt-[3px] pb-px bg-blood text-paper -rotate-2">
                        STUCK WITH {r.cardsLeft}
                      </span>
                    )}
                  </span>
                  <CountUp className={`text-right font-display text-[26px] leading-none ${first ? 'text-ink' : 'text-bone'}`} from={b.wins} to={r.wins} delay={0.9 + i * 0.12} onTick={() => sfx.tick(tickN++)} />
                  <CountUp className={`text-right font-display text-[26px] leading-none ${first ? 'text-ink/60' : 'text-mist'}`} from={b.losses} to={r.losses} delay={1.0 + i * 0.12} onTick={() => sfx.tick(tickN++)} />
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div className="w-full max-w-xl 2xl:max-w-3xl panel-cut px-7 pt-4 pb-5" style={{ ['--cut' as string]: '18px', ['--lean' as string]: '12px' }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }}>
          <StatsLine />
          <div className="flex gap-3">
            <button onClick={onLeaveGame} className="btn-secondary">
              <LogOut size={16} /> Leave
            </button>
            {isHost ? (
              <button onClick={onPlayAgain} className="btn-primary flex-1 !text-[24px]" autoFocus>
                <Play size={18} /> Play again
              </button>
            ) : (
              <p className="flex-1 self-center text-sm text-mist text-right">Waiting for {hostName} to deal</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

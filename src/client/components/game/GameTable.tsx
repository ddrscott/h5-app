import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { Crown, LogOut, X } from 'lucide-react';
import { MuteButton } from '../ui/MuteButton';
import type { Card as CardType, Player, Meld } from '../../types/game';
import { GamePhase } from '../../types/game';
import { PlayerHand } from './PlayerHand';
import { Seat, seatSpots } from './Seat';
import { TablePile } from './TablePile';
import { Callouts, showCallout, calloutFontPx, calloutHalfHeight } from './Callouts';
import { GameOver } from './GameOver';
import { DialogBox } from '../ui/DialogBox';
import { CardBack } from '../ui/CardFace';
import { useViewport, registry, fan, tableLanes, calloutLane, seatHalf } from '../../fx/layout';
import type { Viewport } from '../../fx/layout';
import { bus } from '../../fx/bus';
import { sfx } from '../../fx/sound';
import { haptics } from '../../fx/haptics';
import { particles, FxCanvas } from '../../fx/particles';
import { reducedMotion } from '../../fx/prefs';
import { selectionLabel } from '../../fx/meld';
import { whyNot } from '../../fx/rules';
import { seatBadges } from './Seat';
import type { PlayFx } from '../../fx/meld';

interface GameTableProps {
  players: Map<string, Player>;
  myPlayerId: string;
  myHand: CardType[];
  selectedCards: Set<string>;
  currentMeld?: Meld | null;
  currentTurnPlayerId: string | null;
  leadPlayerId: string | null;
  deckCount: number;
  discardTop?: CardType;
  consecutivePasses: number;
  trickMelds: Meld[];
  lastTrickMelds: Meld[];
  lastError?: string | null;
  lastNotification?: string | null;
  phase: GamePhase;
  winner?: { id: string; name: string; wins: number };
  finalStandings?: { playerId: string; name: string; wins: number; losses: number }[];
  /** Seat order from the server; opponents sit clockwise from your left in this order. */
  turnOrder?: string[];
  onCardSelect: (cardKey: string) => void;
  onPlayCards: () => void;
  onPass: () => void;
  onLeaveGame: () => void;
  onPlayAgain: () => void;
  /** Only the host gets the "Play Again" button and can remove players whose connection dropped. */
  isHost?: boolean;
  hostName?: string;
  onKick?: (playerId: string) => void;
}

const MELD_NAME: Record<string, string> = {
  SINGLE: 'single', PAIR: 'pair', THREE_OF_KIND: 'triple', BOMB: 'bomb', SISTERS: 'sisters',
  FULL_HOUSE: 'full house', RUN: 'straight', STRAIGHT_FLUSH: 'straight flush',
};
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];

/**
 * The inlay on the table where melds land. The house motto runs along its top and bottom arcs
 * only, so the side seats never sit on its letters, and the ring is sized to fit between the top
 * seat and your status stack.
 */
const TableInlay: React.FC<{ vp: Viewport; r: number; top: boolean; bottom: boolean; outer: boolean }> = ({ vp, r, top, bottom, outer }) => {
  return (
    <div aria-hidden className="absolute pointer-events-none" style={{ left: vp.pileX - r * 1.5, top: vp.pileY - r * 1.5, width: r * 3, height: r * 3 }}>
      <svg viewBox="-150 -150 300 300" className="w-full h-full">
        <defs>
          {/* top arc, left to right */}
          <path id="inlayTop" d="M -100,0 a 100,100 0 0,1 200,0" />
          {/* bottom arc, also left to right so it reads upright */}
          <path id="inlayBottom" d="M -108,0 a 108,108 0 0,0 216,0" />
          <radialGradient id="inlayLight">
            <stop offset="0%" stopColor="#2E7366" stopOpacity="0.55" />
            <stop offset="70%" stopColor="#2E7366" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle r="140" fill="url(#inlayLight)" />
        {outer && <circle r="122" fill="none" stroke="#D6A54A" strokeOpacity="0.22" strokeWidth="0.8" />}
        <g className="spin-slow" style={{ transformOrigin: '0 0' }}>
          <circle r="88" fill="none" stroke="#D6A54A" strokeOpacity="0.18" strokeWidth="0.6" strokeDasharray="2 4" />
        </g>
        <g fill="#D6A54A" fillOpacity="0.34" fontSize="11" fontFamily='"JetBrains Mono", "H5 Seal", monospace' fontWeight="700" letterSpacing="3">
          {top && <text><textPath href="#inlayTop" startOffset="50%" textAnchor="middle">✦ HEART OF FIVE ✦</textPath></text>}
          {bottom && <text><textPath href="#inlayBottom" startOffset="50%" textAnchor="middle">红心五 · IT'S DA BOMB</textPath></text>}
        </g>
      </svg>
    </div>
  );
};

/** Card backs dealt out to each opponent's seat at the start of a game. */
const DealSprites: React.FC<{ id: number; seats: string[]; vp: Viewport }> = ({ id, seats, vp }) => {
  const [targets, setTargets] = useState<Array<{ key: string; x: number; y: number; delay: number }>>([]);
  useEffect(() => {
    if (!id || reducedMotion()) return;
    const t = window.setTimeout(() => {
      const list: Array<{ key: string; x: number; y: number; delay: number }> = [];
      seats.forEach((sid, si) => {
        const r = registry.seatRect(sid);
        if (!r) return;
        for (let k = 0; k < 6; k++) {
          list.push({ key: `${id}-${sid}-${k}`, x: r.left + r.width / 2 - vp.pileX, y: r.top + r.height / 2 - vp.pileY, delay: k * 0.09 + si * 0.03 });
        }
      });
      setTargets(list);
    }, 30);
    const clear = window.setTimeout(() => setTargets([]), 1600);
    return () => { clearTimeout(t); clearTimeout(clear); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const w = vp.PW * 0.42;
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 34 }}>
      {targets.map((t, i) => (
        <motion.div
          key={t.key}
          className="absolute"
          style={{ left: vp.pileX - w / 2, top: vp.pileY - w * 0.7, width: w, height: w * 1.4 }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 0, scale: 1.4 }}
          animate={{ x: t.x, y: t.y, rotate: (i % 2 ? 1 : -1) * 200, opacity: [0, 1, 1, 0], scale: 0.7 }}
          transition={{ duration: 0.42, delay: t.delay, ease: [0.2, 0.6, 0.35, 1], opacity: { duration: 0.42, delay: t.delay, times: [0, 0.1, 0.8, 1] } }}
        >
          <CardBack />
        </motion.div>
      ))}
    </div>
  );
};

export const GameTable: React.FC<GameTableProps> = ({
  players, myPlayerId, myHand, selectedCards, currentMeld, currentTurnPlayerId, leadPlayerId,
  trickMelds, lastTrickMelds, lastError, lastNotification, phase, winner, finalStandings, turnOrder = [],
  onCardSelect, onPlayCards, onPass, onLeaveGame, onPlayAgain, isHost = true, hostName = 'the host', onKick,
}) => {
  const rawVp = useViewport();
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [flash, setFlash] = useState<{ id: number; color: string } | null>(null);
  const [passBeats, setPassBeats] = useState<Record<string, number>>({});
  const isPlaying = phase === GamePhase.PLAYING;
  const isMyTurn = isPlaying && currentTurnPlayerId === myPlayerId;
  const isLeader = leadPlayerId === myPlayerId;
  const canPass = isLeader ? !!currentMeld : true;
  const me = players.get(myPlayerId);

  // ---------- seats, clockwise from your left ----------
  const order = useMemo(() => {
    const ids = turnOrder.filter((id) => players.has(id));
    players.forEach((_, id) => { if (!ids.includes(id)) ids.push(id); });
    return ids;
  }, [turnOrder, players]);
  const opponents = useMemo(() => {
    const at = order.indexOf(myPlayerId);
    const rot = at < 0 ? order : [...order.slice(at + 1), ...order.slice(0, at)];
    return rot.filter((id) => id !== myPlayerId);
  }, [order, myPlayerId]);
  // ---------- lanes: hand, status stack, pile, ring and callouts never share pixels ----------
  const compact = rawVp.w < 640;
  const half = seatHalf(compact);
  const spots = useMemo(() => seatSpots(opponents.length, rawVp.w, rawVp.h, rawVp.portrait)
    .map((p) => ({ x: Math.min(rawVp.w - half.hw * 1.06 - 6, Math.max(half.hw * 1.06 + 6, p.x)), y: Math.max(56 + half.hh, p.y) })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [opponents.length, rawVp, compact]);
  const boxes = useMemo(() => spots.map((p) => ({ ...p, ...half })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [spots]);
  const handTop = fan(Math.max(1, myHand.length), rawVp).top;
  const lanes = useMemo(() => tableLanes(rawVp, boxes, handTop), [rawVp, boxes, handTop]);
  const vp = useMemo(() => ({ ...rawVp, pileY: lanes.pileY, pileHalf: lanes.pileHalf }), [rawVp, lanes.pileY, lanes.pileHalf]);
  /** A clear spot for a callout: one line, sized to the lane, never over a seat. */
  const lane = useCallback((text: string, level: number) => {
    const want = Math.min(vp.w - 24, 760);
    const full = calloutFontPx(level, vp.w, text, want);
    // Shrink a step at a time until a clear band is found; past that, take the widest spot.
    let best: { y: number; maxW: number; fontPx: number } | null = null;
    for (const k of [1, 0.85, 0.72]) {
      const font = full * k;
      const l = calloutLane(vp, boxes, vp.pileY, calloutHalfHeight(font), want);
      const fontPx = Math.min(font, calloutFontPx(level, vp.w, text, l.maxW));
      if (l.maxW >= want) return { y: l.y, maxW: l.maxW, fontPx };
      if (!best || fontPx > best.fontPx) best = { y: l.y, maxW: l.maxW, fontPx };
    }
    return best!;
  }, [vp, boxes]);
  const badges = useMemo(() => seatBadges(Array.from(players.values())), [players]);
  const placeOf = (p?: Player) => (p?.isOut && p.position ? p.position : undefined);

  // ---------- screen shake ----------
  const shake = useCallback((px: number) => {
    if (!scope.current || reducedMotion() || px <= 0) return;
    const a = px, b = px * 0.6;
    void animate(scope.current, { x: [0, -a, a * 0.9, -b, b * 0.7, -b * 0.4, 0], y: [0, a * 0.5, -a * 0.6, b * 0.5, -b * 0.3, 0, 0] }, { duration: 0.42 + px * 0.012, ease: 'easeOut' });
  }, [animate, scope]);

  const flashOnce = (color: string) => { if (!reducedMotion()) setFlash({ id: Date.now(), color }); };

  // ---------- a meld lands ----------
  const onLand = useCallback((meld: Meld, fx: PlayFx) => {
    const who = meld.playerId === myPlayerId ? 'You' : players.get(meld.playerId)?.name ?? '';
    const n = meld.cards.length;
    sfx.land(fx.level >= 3 ? 3 : n >= 5 ? 2 : 1);
    const cx = vp.pileX, cy = vp.pileY;
    if (fx.heart5) {
      sfx.heart5(); haptics.heart5(); shake(10); flashOnce('rgba(199,53,44,.35)');
      particles.burst({ x: cx, y: cy, kind: 'heart', palette: 'brass', count: 34, speed: 520 });
      particles.burst({ x: cx, y: cy, kind: 'ember', palette: 'brass', count: 40, speed: 260 });
    } else if (fx.level === 3) {
      sfx.bomb(); haptics.bomb(); shake(18); flashOnce('rgba(255,180,90,.42)');
      particles.burst({ x: cx, y: cy, kind: 'spark', count: 150, speed: 900 });
      particles.burst({ x: cx, y: cy, kind: 'ember', count: 70, speed: 340 });
    } else if (fx.level === 2) {
      sfx.flourish(1); shake(5);
      particles.burst({ x: cx, y: cy, kind: 'spark', palette: 'brass', count: 34, speed: 520 });
    } else {
      shake(n > 1 ? 3 : 1.5);
      if (n > 1) particles.burst({ x: cx, y: cy + vp.PH * 0.4, kind: 'spark', palette: 'brass', count: 8 + n * 2, speed: 260, angle: -Math.PI / 2, spread: Math.PI * 0.9 });
    }
    if (fx.label) {
      showCallout({ text: fx.label, level: fx.level as 1 | 2 | 3 | 4, sub: who, x: cx, ...lane(fx.label, fx.level) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPlayerId, players, vp, shake, lane]);

  // ---------- passes, deals, errors ----------
  const [dealId, setDealId] = useState(() =>
    isPlaying && myHand.length > 0 && trickMelds.length === 0 && lastTrickMelds.length === 0 ? 1 : 0);
  useEffect(() => bus.on((e) => {
    if (e.type === 'pass') {
      sfx.pass();
      setPassBeats((b) => ({ ...b, [e.playerId]: (b[e.playerId] ?? 0) + 1 }));
    } else if (e.type === 'gameStarted') {
      setDealId((d) => d + 1);
    } else if (e.type === 'error') {
      sfx.error();
    }
  }), []);

  // ---------- your turn ----------
  const lastCue = useRef(0);
  useEffect(() => {
    if (!isMyTurn) return;
    const now = performance.now();
    if (now - lastCue.current < 900) return;
    lastCue.current = now;
    // Let the play that handed you the turn land first.
    const t = window.setTimeout(() => { sfx.yourTurn(); haptics.yourTurn(); }, 380);
    return () => clearTimeout(t);
  }, [isMyTurn, currentTurnPlayerId]);

  // ---------- someone goes out ----------
  const outSeen = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isPlaying && phase !== GamePhase.ROUND_END && phase !== GamePhase.GAME_END) return;
    players.forEach((p, id) => {
      if (!p.isOut) { outSeen.current.delete(id); return; }
      if (outSeen.current.has(id)) return;
      outSeen.current.add(id);
      const place = p.position || 1;
      const mine = id === myPlayerId;
      const r = mine ? registry.seatRect(myPlayerId) : registry.seatRect(id);
      const x = r ? r.left + r.width / 2 : vp.w / 2;
      const y = r ? r.top + r.height / 2 : vp.h / 2;
      window.setTimeout(() => {
        sfx.out();
        particles.burst({ x, y, kind: 'confetti', count: place === 1 ? 70 : 36, speed: 520 });
        if (mine && place === 1) particles.celebrate();
        const text = mine ? (place === 1 ? 'YOU WENT OUT FIRST!' : `OUT · ${ORD[place]?.toUpperCase()}`) : `OUT · ${ORD[place]?.toUpperCase()}`;
        const level = place === 1 ? 2 : 1;
        // Waits for a play's callout to finish instead of printing over it.
        showCallout({ text, level, sub: mine ? 'You' : p.name, x: vp.w / 2, ...lane(text, level), queue: true });
      }, 650);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, phase]);

  // ---------- actions ----------
  const selected = myHand.filter((c) => selectedCards.has(c.code || `${c.rank}${c.suit}`));
  const playLabel = selectionLabel(selected);
  // The client knows the table, so say why a selection won't go before the tap (the server agrees).
  const blocked = isMyTurn && selected.length > 0 ? whyNot(selected, currentMeld) : null;
  const canPlay = isMyTurn && selected.length > 0 && !blocked;
  const play = () => {
    if (!canPlay) return;
    sfx.whoosh(selected.length > 3 ? 1.4 : 1);
    onPlayCards();
  };
  const pass = () => {
    if (!isMyTurn || !canPass) return;
    onPass();
  };
  const clearSel = () => { selectedCards.forEach((k) => onCardSelect(k)); sfx.deselect(); };

  const keyRef = useRef({ play, pass, clearSel });
  keyRef.current = { play, pass, clearSel };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      // Enter plays, even with a card focused (Space toggles that card); buttons keep their own Enter.
      if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName !== 'BUTTON') keyRef.current.play();
      else if (e.key === 'p' || e.key === 'P') keyRef.current.pass();
      else if (e.key === 'Escape') keyRef.current.clearSel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------- where the turn light shines ----------
  const activeIdx = opponents.indexOf(currentTurnPlayerId ?? '');
  const light = activeIdx >= 0 ? spots[activeIdx] : isMyTurn ? { x: vp.w / 2, y: vp.h - vp.handBase - vp.H * 0.5 } : null;

  const activeName = currentTurnPlayerId ? players.get(currentTurnPlayerId)?.name : undefined;
  const myPlace = placeOf(me);
  const status: { big: string; small?: string; hot: boolean; err?: boolean; lead?: boolean } | null = !isPlaying ? null
    : lastError ? { big: 'Not that', small: lastError, hot: false, err: true }
    : lastNotification && !isMyTurn ? { big: lastNotification, hot: false, lead: true }
    : myPlace ? { big: `You're out · ${ORD[myPlace]}`, small: activeName ? `${activeName} to play` : undefined, hot: false }
    : isMyTurn && !currentMeld ? { big: 'Your lead', small: 'play anything', hot: true }
    : isMyTurn ? { big: 'Your turn', small: `beat the ${MELD_NAME[currentMeld?.type ?? ''] ?? 'table'} or pass`, hot: true }
    : activeName ? { big: `${activeName}`, small: 'is thinking', hot: false } : null;

  const isEnd = phase === GamePhase.GAME_END || phase === GamePhase.ROUND_END;
  // Give the last play a moment to land (and the OUT callout to pop) before the results cover it.
  const [showEnd, setShowEnd] = useState(isEnd);
  useEffect(() => {
    if (!isEnd) { setShowEnd(false); return; }
    const t = window.setTimeout(() => setShowEnd(true), reducedMotion() ? 0 : 1500);
    return () => clearTimeout(t);
  }, [isEnd]);
  const computedWinner = winner ?? (() => {
    if (!isEnd) return null;
    let best: Player | undefined;
    players.forEach((p) => { if (!best || p.wins > best.wins) best = p; });
    return best ? { id: best.id, name: best.name, wins: best.wins } : null;
  })();
  const computedStandings = finalStandings ?? (isEnd
    ? Array.from(players.values()).map((p) => ({ playerId: p.id, name: p.name, wins: p.wins, losses: p.losses })).sort((a, b) => b.wins - a.wins)
    : null);

  return (
    <div className="fixed inset-0 felt-texture overflow-hidden overflow-clip">
      <motion.div ref={scope} className="absolute inset-0 overflow-hidden overflow-clip">
        <TableInlay vp={vp} r={lanes.ringR} top={lanes.mottoTop} bottom={lanes.mottoBottom} outer={lanes.outerRing} />

        {/* the lamp over whoever's turn it is */}
        <motion.div
          aria-hidden
          className="absolute pointer-events-none rounded-full"
          style={{ width: 460, height: 460, left: -230, top: -230, background: 'radial-gradient(circle, rgba(255,190,120,.16), rgba(255,190,120,0) 62%)' }}
          initial={false}
          animate={light ? { x: light.x, y: light.y, opacity: 1 } : { opacity: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />

        {opponents.map((id, i) => {
          const p = players.get(id);
          if (!p || !spots[i]) return null;
          return (
            <Seat
              key={id}
              player={p}
              x={spots[i].x}
              y={spots[i].y}
              active={isPlaying && currentTurnPlayerId === id}
              leader={leadPlayerId === id}
              place={placeOf(p)}
              passBeat={passBeats[id] ?? 0}
              compact={compact}
              badge={badges.get(id)}
              onKick={isHost && onKick ? () => onKick(id) : undefined}
            />
          );
        })}

        <TablePile trickMelds={trickMelds} vp={vp} myPlayerId={myPlayerId} onLand={onLand} onSweep={() => sfx.whoosh(0.5)} />
        <DealSprites id={dealId} seats={opponents} vp={vp} />

        {/* your nameplate and the turn status */}
        <div
          className="absolute left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 pointer-events-none"
          style={{ bottom: lanes.statusBottom, maxWidth: 'calc(100vw - 16px)' }}
        >
          <AnimatePresence mode="wait">
            {status && (
              <motion.div
                key={status.err ? `e:${status.small}` : status.big}
                role={status.err ? 'alert' : undefined}
                className={`flex items-baseline gap-2 px-3 py-1 border ${status.err ? 'bg-cinnabar-deep text-paper border-cinnabar max-w-[min(92vw,560px)] flex-wrap justify-center text-center' : 'whitespace-nowrap'} ${status.hot ? 'bg-ember text-ink border-ember-hot shadow-[0_6px_24px_-6px_rgba(232,93,0,.8)]' : status.err ? '' : status.lead ? 'bg-ink/90 text-brass-light border-brass/60 font-mono uppercase tracking-[0.14em]' : 'bg-ink/80 text-bone border-white/15'}`}
                initial={{ y: 14, opacity: 0, scale: status.hot ? 0.8 : 1 }}
                animate={status.err ? { y: 0, opacity: 1, scale: 1, x: [0, -6, 6, -3, 0] } : { y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -8, opacity: 0, transition: { duration: 0.12 } }}
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              >
                <span className={`text-[13px] font-extrabold ${status.hot ? 'font-mono uppercase tracking-[0.14em]' : 'font-semibold'}`}>
                  {status.hot && <span className="text-ink/60">$ </span>}
                  {status.lead && <Crown size={13} className="inline -mt-0.5 mr-1.5 text-brass" />}
                  {status.big}
                </span>
                {status.small && <span className={`text-[12px] ${status.hot ? 'text-ink/75' : status.err ? 'text-paper/90' : 'text-mist'}`}>{status.small}</span>}
              </motion.div>
            )}
          </AnimatePresence>
          {me && (
            <div ref={(el) => registry.seat(myPlayerId, el)} className="relative flex items-center gap-2 px-2 py-0.5 bg-ink/60 border border-white/10 font-mono text-[11px] text-mist">
              {isLeader && <Crown size={12} className="text-brass" aria-label="You lead this trick" />}
              <span className="text-bone font-semibold font-sans text-[12px]">{me.name}</span>
              <span>{me.wins}W·{me.losses}L</span>
              <AnimatePresence>
                {(passBeats[myPlayerId] ?? 0) > 0 && (
                  <PassStamp key={passBeats[myPlayerId]} />
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <PlayerHand hand={myHand} selectedCards={selectedCards} onCardSelect={onCardSelect} vp={vp} dealId={dealId} myTurn={isMyTurn} />

        {/* actions: always in the same place so your thumb learns them */}
        {isPlaying && !myPlace && (
          <div className="absolute inset-x-0 z-40 flex justify-center gap-2 px-3" style={{ bottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            <motion.button
              onClick={pass}
              disabled={!isMyTurn || !canPass}
              className="btn-secondary min-w-[88px] h-12"
              whileTap={{ scale: 0.94 }}
              title="Pass (P)"
            >
              Pass
            </motion.button>
            <motion.button
              onClick={play}
              disabled={!canPlay}
              className="btn-primary flex-1 min-w-0 max-w-[300px] h-12 !px-3 sm:!px-5 text-[14px] sm:text-[15px] whitespace-nowrap"
              aria-describedby={blocked ? 'play-why' : undefined}
              animate={canPlay ? { scale: [1, 1.04, 1] } : { scale: 1 }}
              transition={{ duration: 0.25 }}
              key={canPlay ? `p${selected.length}` : 'off'}
              title="Play (Enter)"
            >
              {isMyTurn && blocked ? (
                <span id="play-why" className="normal-case font-semibold text-[12px] sm:text-[14px] tracking-normal truncate">{selected.length === 1 ? 'Single' : playLabel ?? `${selected.length} cards`} · {blocked}</span>
              ) : isMyTurn ? (
                <>
                  Play{playLabel ? <span className="opacity-80 normal-case font-semibold">· {playLabel}</span> : selected.length ? <span className="opacity-70">· {selected.length}</span> : null}
                </>
              ) : 'Wait'}
            </motion.button>
            <AnimatePresence>
              {selected.length > 0 && (
                <motion.button
                  onClick={clearSel}
                  className="btn-secondary w-12 h-12 !px-0"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  title="Clear selection (Esc)"
                  aria-label="Clear selection"
                >
                  <X size={18} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* header */}
      <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-50 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="font-seal grid place-items-center w-9 h-9 bg-cinnabar text-paper font-black text-[11px] leading-[1.05] text-center shadow-[inset_0_0_0_2px_rgba(246,240,226,.5)] -rotate-3" aria-hidden>
            红心<br />五
          </div>
          <span className="hidden sm:block font-mono text-[11px] tracking-[0.2em] text-mist">HEART OF FIVE</span>
        </div>
        <div className="flex gap-2 pointer-events-auto">
          <MuteButton />
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="grid place-items-center w-10 h-10 bg-ink/80 border border-white/15 text-bone hover:border-ember transition-colors"
            title="Leave game"
            aria-label="Leave game"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.id}
            aria-hidden
            className="fixed inset-0 pointer-events-none"
            style={{ background: flash.color, zIndex: 65 }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            onAnimationComplete={() => setFlash(null)}
          />
        )}
      </AnimatePresence>

      <Callouts />
      <FxCanvas />

      {showLeaveConfirm && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[80]" onClick={() => setShowLeaveConfirm(false)} />
          <DialogBox className="max-w-sm z-[81]">
            <p className="section-head mb-2">leave_table</p>
            <h3 className="font-display text-2xl font-bold mb-2">Leave the game?</h3>
            <p className="text-gray-300 mb-5 text-sm">Your seat stays at the table, and the room plays for you after 30 seconds each turn.</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowLeaveConfirm(false); onLeaveGame(); }} className="btn-primary flex-1">Leave</button>
              <button onClick={() => setShowLeaveConfirm(false)} className="btn-secondary flex-1">Stay</button>
            </div>
          </DialogBox>
        </>
      )}

      {isEnd && showEnd && computedWinner && computedStandings && (
        <GameOver
          winner={computedWinner}
          finalStandings={computedStandings}
          players={players}
          myPlayerId={myPlayerId}
          onPlayAgain={onPlayAgain}
          onLeaveGame={onLeaveGame}
          isHost={isHost}
          hostName={hostName}
        />
      )}
    </div>
  );
};

const PassStamp: React.FC = () => {
  const [on, setOn] = useState(true);
  useEffect(() => { const t = setTimeout(() => setOn(false), 1200); return () => clearTimeout(t); }, []);
  if (!on) return null;
  return (
    <motion.span
      className="absolute left-full ml-2 top-1/2 font-mono font-extrabold text-[12px] tracking-[0.2em] px-2 py-0.5 border-2 border-bone/80 text-bone bg-ink/80"
      initial={{ y: '-50%', scale: 1.8, rotate: -14, opacity: 0 }}
      animate={{ y: '-50%', scale: 1, rotate: -8, opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 700, damping: 20 }}
    >
      PASS
    </motion.span>
  );
};

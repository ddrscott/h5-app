import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { Crown, LogOut, X } from 'lucide-react';
import { MuteButton } from '../ui/MuteButton';
import type { Card as CardType, Player, Meld } from '../../types/game';
import { GamePhase } from '../../types/game';
import { PlayerHand } from './PlayerHand';
import { Seat, seatSpots } from './Seat';
import { TablePile } from './TablePile';
import { Callouts, showCallout, calloutFontPx, calloutSize, calloutTilt, splitCallout, CALLOUT_FLOOR } from './Callouts';
import { GameOver } from './GameOver';
import { DialogBox } from '../ui/DialogBox';
import { CardBack } from '../ui/CardFace';
import { useViewport, registry, fan, tableLanes, placeCallout, meldFit, seatHalf, seatScale, myPlateScale, SEAT_W, MELD_UP } from '../../fx/layout';
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
  /** Extra buttons for the header, left of the mute switch (the bring-your-own-bot button). */
  headerExtra?: React.ReactNode;
}

const MELD_NAME: Record<string, string> = {
  SINGLE: 'single', PAIR: 'pair', THREE_OF_KIND: 'triple', BOMB: 'bomb', SISTERS: 'sisters',
  FULL_HOUSE: 'full house', RUN: 'straight', STRAIGHT_FLUSH: 'straight flush',
};
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];

/**
 * The stage: one angled manga panel laid across the whole table at the pile's height, flat ink
 * between two heavy paper gutter rules, so the play area reads as a panel cut out of the
 * screentone page around it (index.css .felt-texture). The house motto sits on the rules as two
 * caption boxes, each shown only where no seat covers it.
 */
/** Geometry of the stage band: its edges' lean, and where the two motto caption boxes go. */
function stageGeom(vp: Pick<Viewport, 'w' | 'pileY'>, r: number, seats: Array<{ x: number; y: number; hw: number; hh: number }>) {
  const { w } = vp;
  const top = vp.pileY - r * 1.08, bottom = vp.pileY + r * 0.98;
  const lean = Math.min(w * 0.045, 54);
  const yAt = (edge: number, x: number) => edge + lean - (2 * lean * x) / w;
  const deg = (-Math.atan2(2 * lean, w) * 180) / Math.PI;
  const clear = (x: number, y: number, hw: number) => seats.every((b) => Math.abs(b.x - x) > b.hw + hw + 8 || Math.abs(b.y - y) > b.hh + 22);
  const chips = [
    { x: w * 0.3, y: yAt(top, w * 0.3), text: 'HEART OF FIVE' },
    { x: w * 0.7, y: yAt(bottom, w * 0.7), text: "红心五 · IT'S DA BOMB!" },
    // Below about 1080px the band is short and older melds stack up into the rules, so the
  // lettering would sit half under cards: leave it off there.
  ].filter((c) => w >= 1080 && clear(c.x, c.y, c.text.length * 5.5));
  return { top, bottom, lean, yAt, deg, chips };
}
/** The motto chips as boxes, so a callout never lands on decorative lettering. */
const chipBoxes = (g: ReturnType<typeof stageGeom>) =>
  g.chips.map((c) => { const hw = c.text.length * 5.6 + 18; return { x: c.x, y: c.y, hw, hh: 16 + hw * Math.abs(Math.sin((g.deg * Math.PI) / 180)) }; });

const TableStage: React.FC<{ vp: Viewport; r: number; seats: Array<{ x: number; y: number; hw: number; hh: number }> }> = ({ vp, r, seats }) => {
  const { w, h } = vp;
  const { top, bottom, yAt, deg, chips } = stageGeom(vp, r, seats);
  const band = `-20,${yAt(top, -20)} ${w + 20},${yAt(top, w + 20)} ${w + 20},${yAt(bottom, w + 20)} -20,${yAt(bottom, -20)}`;
  return (
    <svg aria-hidden data-stage className="absolute inset-0 pointer-events-none" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {/* the gutter: a thin outer rule, then the panel with its heavy paper border */}
      <polyline points={`-20,${yAt(top, -20) - 11} ${w + 20},${yAt(top, w + 20) - 11}`} stroke="#FAFAF7" strokeOpacity=".5" strokeWidth="2" fill="none" />
      <polyline points={`-20,${yAt(bottom, -20) + 11} ${w + 20},${yAt(bottom, w + 20) + 11}`} stroke="#FAFAF7" strokeOpacity=".5" strokeWidth="2" fill="none" />
      <polygon points={band} fill="#0B0B0D" stroke="#FAFAF7" strokeWidth="5" />
      {chips.map((c) => (
        <g key={c.text} transform={`translate(${c.x} ${c.y}) rotate(${deg})`}>
          <polygon points={`${-c.text.length * 5.6 - 12},-12 ${c.text.length * 5.6 + 16},-12 ${c.text.length * 5.6 + 10},12 ${-c.text.length * 5.6 - 12},12`} fill="#FAFAF7" />
          <text y="6.5" textAnchor="middle" fontSize="18" letterSpacing="1.5" fill="#0B0B0D" fontFamily='Bangers, "H5 Seal", Impact, sans-serif'>{c.text}</text>
        </g>
      ))}
    </svg>
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
  onCardSelect, onPlayCards, onPass, onLeaveGame, onPlayAgain, isHost = true, hostName = 'the host', onKick, headerExtra,
}) => {
  const rawVp = useViewport();
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [impact, setImpact] = useState<{ id: number; kind: 'bomb' | 'heart5'; text: string; top: number; bottom: number } | null>(null);
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
  const sScale = seatScale(rawVp, compact);
  const half = seatHalf(compact, sScale);
  const spots = useMemo(() => seatSpots(opponents.length, rawVp.w, rawVp.h, rawVp.portrait)
    .map((p) => ({ x: Math.min(rawVp.w - half.hw * 1.06 - 6, Math.max(half.hw * 1.06 + 6, p.x)), y: Math.max(56 + half.hh, p.y) })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [opponents.length, rawVp, compact, sScale]);
  const boxes = useMemo(() => spots.map((p) => ({ ...p, ...half })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [spots]);
  const handTop = fan(Math.max(1, myHand.length), rawVp).top;
  const lanes = useMemo(() => tableLanes(rawVp, boxes, handTop), [rawVp, boxes, handTop]);
  const vp = useMemo(() => ({ ...rawVp, pileY: lanes.pileY, pileHalf: lanes.pileHalf, meldRoom: lanes.meldRoom }), [rawVp, lanes.pileY, lanes.pileHalf, lanes.meldRoom]);
  /** A clear spot for a callout: its own space, sized by the play, never over a seat or the newest meld. */
  const lane = useCallback((text: string, level: number, sub: string | undefined, meldN: number) => {
    // On a phone a bomb or the Heart 5 starts from the full width and shrinks only until it clears
    // the seats and the motto chips, so it never sits on anyone's plate or card count.
    const wide = vp.w < 640 && level >= 3;
    let full = wide ? 200 : calloutFontPx(level, vp.w, text, Infinity);
    while (full > 16 && calloutSize(full, text, level).w > vp.w - 24) full *= 0.96;
    const fit = meldN > 0 ? meldFit(meldN, vp, vp.meldRoom) : null;
    const p = placeCallout({
      vp, seats: [...boxes, ...chipBoxes(stageGeom(vp, lanes.ringR, boxes))], pileY: vp.pileY, statusTop: lanes.statusTop,
      meldHalfW: fit?.half ?? 0, meldScale: fit?.scale ?? 1,
      full, floor: wide ? 28 : CALLOUT_FLOOR[level] ?? 24,
      size: (f, lines) => {
        if (lines === 2 && !splitCallout(text)) return null;
        const c = calloutSize(f, text, level, sub, lines);
        return { ...c, tilt: calloutTilt(level, c.w) };
      },
    });
    return { x: p.x, y: p.y, fontPx: p.fontPx, maxW: p.maxW, maxScale: p.maxScale, lines: p.lines, tilt: p.tilt };
  }, [vp, boxes, lanes.statusTop, lanes.ringR]);
  const trickRef = useRef(0);
  trickRef.current = trickMelds[trickMelds.length - 1]?.cards.length ?? 0;
  const badges = useMemo(() => seatBadges(Array.from(players.values())), [players]);
  const placeOf = (p?: Player) => (p?.isOut && p.position ? p.position : undefined);

  // ---------- screen shake ----------
  // Short and hard, like a panel jolting: never longer than about 0.4s, so play isn't held up.
  const shake = useCallback((px: number) => {
    if (!scope.current || reducedMotion() || px <= 0) return;
    const a = px, b = px * 0.55;
    void animate(scope.current, { x: [0, -a, a * 0.9, -b, b * 0.5, 0], y: [0, a * 0.6, -a * 0.5, b * 0.4, 0, 0] }, { duration: Math.min(0.4, 0.22 + px * 0.01), ease: 'easeOut' });
  }, [animate, scope]);

  /**
   * The full-screen impact frame for a bomb or the Heart 5 (skipped under reduced motion). It keeps
   * the newest meld's band clear, so the cards that did it stay in view. Says whether it ran.
   */
  const impactOnce = (kind: 'bomb' | 'heart5', text: string, n: number) => {
    if (reducedMotion()) return false;
    const fit = meldFit(n, vp, vp.meldRoom);
    const mph = vp.PH * fit.scale;
    setImpact({ id: Date.now(), kind, text, top: vp.pileY - mph * MELD_UP - 10, bottom: vp.pileY + mph * 0.58 + 10 });
    return true;
  };

  const clearImpact = useCallback(() => setImpact(null), []);

  // ---------- a meld lands ----------
  const onLand = useCallback((meld: Meld, fx: PlayFx) => {
    const who = meld.playerId === myPlayerId ? 'You' : players.get(meld.playerId)?.name ?? '';
    const n = meld.cards.length;
    sfx.land(fx.level >= 3 ? 3 : n >= 5 ? 2 : 1);
    const cx = vp.pileX, cy = vp.pileY;
    let framed = false;
    if (fx.heart5) {
      sfx.heart5(); haptics.heart5(); shake(12); framed = impactOnce('heart5', fx.label ?? 'HEART OF FIVE', n);
      particles.burst({ x: cx, y: cy, kind: 'heart', palette: 'ink', count: 34, speed: 520 });
      particles.burst({ x: cx, y: cy, kind: 'ember', palette: 'ink', count: 40, speed: 260 });
    } else if (fx.level === 3) {
      sfx.bomb(); haptics.bomb(); shake(16); framed = impactOnce('bomb', fx.label ?? 'BOMB!', n);
      particles.burst({ x: cx, y: cy, kind: 'spark', count: 150, speed: 900 });
      particles.burst({ x: cx, y: cy, kind: 'ember', count: 70, speed: 340 });
    } else if (fx.level === 2) {
      sfx.flourish(1); shake(5);
      particles.burst({ x: cx, y: cy, kind: 'spark', palette: 'ink', count: 34, speed: 520 });
    } else {
      shake(n > 1 ? 3 : 1.5);
      if (n > 1) particles.burst({ x: cx, y: cy + vp.PH * 0.4, kind: 'spark', palette: 'ink', count: 8 + n * 2, speed: 260, angle: -Math.PI / 2, spread: Math.PI * 0.9 });
    }
    if (fx.label) {
      const label = fx.label;
      const go = () => showCallout({ text: label, level: fx.level as 1 | 2 | 3 | 4, sub: who, ...lane(label, fx.level, who, n) });
      // After a finisher frame the callout pops in as the frame cuts out, not underneath it.
      if (framed) window.setTimeout(go, IMPACT_MS - 80); else go();
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
        const sub = mine ? 'You' : p.name;
        showCallout({ text, level, sub, ...lane(text, level, sub, trickRef.current), queue: true });
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
        <TableStage vp={vp} r={lanes.ringR} seats={boxes} />

        {/* the lamp over whoever's turn it is */}
        <motion.div
          aria-hidden
          className="tone absolute pointer-events-none"
          style={{ width: 420, height: 420, left: -210, top: -210, color: 'rgba(232,93,0,.28)', WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 66%)', maskImage: 'radial-gradient(circle, #000 0%, transparent 66%)' }}
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
              scale={sScale}
              badge={badges.get(id)}
              onKick={isHost && onKick ? () => onKick(id) : undefined}
            />
          );
        })}

        <TablePile trickMelds={trickMelds} vp={vp} myPlayerId={myPlayerId} onLand={onLand} onSweep={() => sfx.whoosh(0.5)} />
        <DealSprites id={dealId} seats={opponents} vp={vp} />

        {/* your nameplate and the turn status */}
        <div
          className="absolute left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2.5 pointer-events-none"
          style={{ bottom: lanes.statusBottom, maxWidth: 'calc(100vw - 16px)' }}
        >
          <AnimatePresence mode="wait">
            {status && (
              <motion.div
                key={status.err ? `e:${status.small}` : status.big}
                role={status.err ? 'alert' : undefined}
                className={`flex items-baseline gap-2.5 ${status.hot ? 'pl-6 pr-7 pt-1.5 pb-1 -rotate-2' : 'pl-4 pr-5 py-1'} ${status.err ? 'bg-blood text-paper max-w-[min(92vw,560px)] flex-wrap justify-center text-center' : 'whitespace-nowrap'} ${status.hot ? 'bg-ember text-ink' : status.err ? '' : status.lead ? 'bg-paper text-ink' : 'bg-ink text-paper'}`}
                style={{ clipPath: status.hot ? 'polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)' : 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)', boxShadow: status.hot ? 'inset 0 -5px 0 rgba(0,0,0,.25)' : !status.err && !status.lead ? 'inset 0 2px 0 #FAFAF7, inset 0 -2px 0 #FAFAF7' : undefined }}
                initial={{ y: 14, opacity: 0, scale: status.hot ? 0.8 : 1 }}
                animate={status.err ? { y: 0, opacity: 1, scale: 1, x: [0, -6, 6, -3, 0] } : { y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -8, opacity: 0, transition: { duration: 0.12 } }}
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              >
                <span className={`${status.hot ? 'font-display text-[30px] leading-none tracking-[0.04em] uppercase' : 'font-display text-[18px] leading-none tracking-[0.05em] uppercase'}`}>
                  
                  {status.lead && <Crown size={14} strokeWidth={2.5} className="inline -mt-1 mr-1.5 text-ink" />}
                  {status.big}
                </span>
                {status.small && <span className={`${status.hot ? 'text-[15px] font-bold' : 'text-[13px] font-semibold'} ${status.hot ? 'text-ink/80' : status.err ? 'text-paper/90' : status.lead ? 'text-ink/70' : 'text-bone'}`}>{status.small}</span>}
              </motion.div>
            )}
          </AnimatePresence>
          {me && <MyPlate k={myPlateScale(vp)} minW={vp.w >= 640 ? SEAT_W * myPlateScale(vp) : 0} name={me.name} badge={badges.get(myPlayerId)} wins={me.wins} losses={me.losses} live={isMyTurn} leader={isLeader} out={!!myPlace} passBeat={passBeats[myPlayerId] ?? 0} plateRef={(el) => registry.seat(myPlayerId, el)} />}
        </div>

        <PlayerHand hand={myHand} selectedCards={selectedCards} onCardSelect={onCardSelect} vp={vp} dealId={dealId} myTurn={isMyTurn} />

        {/* actions: always in the same place so your thumb learns them */}
        {isPlaying && !myPlace && (
          <div className="absolute inset-x-0 z-40 flex justify-center gap-2 px-3" style={{ bottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            <motion.button
              onClick={pass}
              disabled={!isMyTurn || !canPass}
              className="btn-secondary min-w-[104px] h-12 !text-[22px]"
              whileTap={{ scale: 0.94 }}
              title="Pass (P)"
            >
              Pass
            </motion.button>
            <motion.button
              onClick={play}
              disabled={!canPlay}
              className="btn-primary flex-1 min-w-0 max-w-[360px] h-12 !px-3 sm:!px-5 !text-[20px] sm:!text-[24px] whitespace-nowrap"
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
          <div className="font-seal grid place-items-center w-9 h-9 bg-blood text-paper font-black text-[11px] leading-[1.05] text-center border-2 border-ink shadow-[inset_0_0_0_2px_rgba(250,250,247,.55),3px_3px_0_#000] -rotate-3" aria-hidden>
            红心<br />五
          </div>
          <span className="hidden sm:block font-display text-[18px] tracking-[0.06em] text-bone">HEART OF FIVE</span>
        </div>
        <div className="flex gap-2 pointer-events-auto">
          {headerExtra}
          <MuteButton />
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="icon-btn"
            title="Leave game"
            aria-label="Leave game"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {impact && <ImpactFrame key={impact.id} kind={impact.kind} text={impact.text} w={vp.w} h={vp.h} cx={vp.pileX} cy={vp.pileY} clearTop={impact.top} clearBottom={impact.bottom} onDone={clearImpact} />}
      </AnimatePresence>

      <Callouts />
      <FxCanvas />

      {showLeaveConfirm && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[80]" onClick={() => setShowLeaveConfirm(false)} />
          <DialogBox className="max-w-sm z-[81]">
            <p className="section-head mb-3">Leave table</p>
            <h3 className="font-display text-[34px] leading-none tracking-[0.03em] mb-3">Leaving already?</h3>
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

/**
 * The finisher frame for a bomb or the Heart 5: for about half a second the play owns the screen.
 * The page flashes (paper for a bomb, red for the Heart 5) and focus lines rush at the pile, then a
 * full-bleed slashed panel cuts in across the bigger of the two bands either side of the newest
 * meld, carrying the word in giant tilted lettering (40-60% of the screen's width), while an ink
 * slash with the sound effect cuts the other way across the opposite band. Both cut out again and
 * the table is back. The newest meld's own band stays clear the whole time, so you always see the
 * cards that did it. It never takes input, and reduced motion skips it (impactOnce).
 */
export const IMPACT_MS = 560;
const IMPACT_TILT = (6 * Math.PI) / 180;
let impactRuler: CanvasRenderingContext2D | null = null;
/** Width of a line of finisher lettering at 100px, in the display face. */
const impactUnit = (t: string) => {
  impactRuler ??= typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  if (!impactRuler) return t.length * 52;
  impactRuler.font = '100px Bangers, Impact, sans-serif';
  return impactRuler.measureText(t).width + t.length * 2; // letter-spacing .02em
};
/**
 * Font size, stretch and line split for the finisher word. The tilted block (widest line, plus the
 * stroke on both sides and the shadow, by the stack's height) has to fit `budget` across and the
 * band's height down. On a phone a long word stacks on two lines, split where the wider line is
 * narrowest.
 */
export function impactFit(text: string, w: number, bandH: number, narrow: boolean) {
  const budget = w * (narrow ? 0.92 : 0.58);
  const cos = Math.cos(IMPACT_TILT), sin = Math.sin(IMPACT_TILT);
  const options: string[][] = [[text]];
  if (narrow) text.split('').forEach((c, i) => { if (c === ' ') options.push([text.slice(0, i), text.slice(i + 1)]); });
  let best = { font: 0, stretch: 1, words: [text] };
  for (const words of options) {
    const unit = Math.max(...words.map(impactUnit)) / 100;
    // per px of font: line ink + stroke (0.06 each side) + shadow (0.06), and the stack's height
    const across = (s: number) => (unit * s + 0.18) * cos + words.length * 0.92 * sin;
    const byH = (bandH * 0.72) / (words.length * 0.95);
    const font = Math.max(30, Math.min(budget / across(1), byH));
    const stretch = Math.min(1.3, ((budget / font - words.length * 0.92 * sin) / cos - 0.18) / unit);
    if (font > best.font + 0.5) best = { font, stretch: Math.max(1, stretch), words };
  }
  // the 30px floor must still fit
  const unit = Math.max(...best.words.map(impactUnit)) / 100;
  const maxF = budget / ((unit * best.stretch + 0.18) * cos + best.words.length * 0.92 * sin);
  if (best.font > maxF) best.font = maxF;
  return best;
}
const ImpactFrame: React.FC<{ kind: 'bomb' | 'heart5'; text: string; w: number; h: number; cx: number; cy: number; clearTop: number; clearBottom: number; onDone: () => void }> = ({ kind, text, w, h, cx, cy, clearTop, clearBottom, onDone }) => {
  const heart = kind === 'heart5';
  useEffect(() => { const t = window.setTimeout(onDone, IMPACT_MS + 40); return () => clearTimeout(t); }, [onDone]);
  const narrow = w < 640;
  const above = Math.max(0, clearTop), below = Math.max(0, h - clearBottom);
  const mainTop = above >= below;
  const band = (top: boolean) => (top ? { y0: 0, y1: clearTop } : { y0: clearBottom, y1: h });
  const main = band(mainTop), minor = band(!mainTop);
  const mainH = main.y1 - main.y0, minorH = minor.y1 - minor.y0;
  // Lettering: as wide as 58% of the screen (92% on a phone), as tall as the band allows. Each line
  // is measured with the real face, and the fit counts the -6° tilt, the ink stroke and the drop
  // shadow, so the word always lands whole inside the frame. A horizontal stretch up to 1.3 makes
  // up the width when the band is short.
  const fit = impactFit(text, w, mainH, narrow);
  const { font, stretch, words } = fit;
  const lean = Math.min(w * 0.08, mainH * 0.28);
  const slash = (y0: number, y1: number, l: number) => `polygon(0 ${y0 + l}px, 100% ${y0}px, 100% ${y1 - l}px, 0 ${y1}px)`;
  const fill = heart ? '#D7192B' : '#E85D00';
  const sfx = heart ? 'ゴゴゴ' : 'ドドン';
  // the newest meld's band stays clear of the flash and lines
  const mask = `linear-gradient(to bottom, #000 0, #000 ${clearTop}px, transparent ${clearTop}px, transparent ${clearBottom}px, #000 ${clearBottom}px)`;
  const t = IMPACT_MS / 1000;
  const cut = { duration: t, times: [0, 0.14, 0.72, 1], ease: 'easeOut' as const };
  return (
    <div aria-hidden data-impact={kind} className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 58 }}>
      <div className="absolute inset-0" style={{ WebkitMaskImage: mask, maskImage: mask }}>
        <motion.div className="absolute inset-0" style={{ background: heart ? '#D7192B' : '#FAFAF7' }}
          initial={{ opacity: 0 }} animate={{ opacity: [0, 0.95, 0.85, 0] }} transition={{ duration: t * 0.5, times: [0, 0.15, 0.55, 1] }} />
        <motion.div
          className="impact-lines speed-lines absolute"
          style={{ left: cx - 1600, top: cy - 1600, width: 3200, height: 3200, color: heart ? '#0B0B0D' : '#0B0B0D' }}
          initial={{ rotate: 0, scale: 1.3, opacity: 0 }}
          animate={{ rotate: 4, scale: 1, opacity: [0, 0.55, 0.45, 0] }}
          transition={{ duration: t, ease: 'easeOut', opacity: { duration: t, times: [0, 0.12, 0.7, 1] } }}
        />
      </div>
      {/* the word's slash: black offset, then the hot panel with a paper edge, then the lettering */}
      <motion.div className="absolute inset-0" initial={{ x: mainTop ? '-105%' : '105%' }} animate={{ x: ['-105%', '0%', '0%', '105%'].map((v) => (mainTop ? v : v.startsWith('-') ? v.slice(1) : `-${v}`)) }} transition={cut}>
        <div className="absolute inset-0" style={{ background: '#000', clipPath: slash(main.y0 + 14, main.y1 + 6, lean), transform: 'translate(14px, 0)' }} />
        <div className="absolute inset-0" style={{ background: '#FAFAF7', clipPath: slash(main.y0, main.y1, lean) }} />
        <div className="absolute inset-0 overflow-hidden" style={{ background: fill, clipPath: slash(main.y0 + 5, main.y1 - 5, lean) }}>
          <div className="speed-lines absolute" style={{ left: cx - 1600, top: cy - 1600, width: 3200, height: 3200, color: 'rgba(11,11,13,.22)' }} />
          <div className="tone absolute inset-0" style={{ color: 'rgba(11,11,13,.18)' }} />
        </div>
        <motion.div
          data-impact-word
          className="absolute left-0 right-0 flex flex-col items-center justify-center font-display text-paper"
          style={{ top: main.y0, height: mainH, fontSize: font, lineHeight: 0.92, letterSpacing: '0.02em', WebkitTextStroke: `${Math.max(5, font * 0.06)}px #0B0B0D`, paintOrder: 'stroke fill', textShadow: `${font * 0.06}px ${font * 0.07}px 0 #0B0B0D` }}
          initial={{ scale: 1.25, rotate: -10 }}
          animate={{ scale: 1, rotate: -6 }}
          transition={{ type: 'spring', stiffness: 700, damping: 18 }}
        >
          {words.map((wd, i) => <span key={i} className="block whitespace-nowrap" style={{ transform: `scaleX(${stretch})` }}>{wd}</span>)}
        </motion.div>
      </motion.div>
      {/* the counter-slash: ink with the sound effect, cutting in from the other side */}
      {minorH > 70 && (
        <motion.div className="absolute inset-0" initial={{ x: mainTop ? '105%' : '-105%' }} animate={{ x: mainTop ? ['105%', '0%', '0%', '-105%'] : ['-105%', '0%', '0%', '105%'] }} transition={{ ...cut, times: [0, 0.2, 0.7, 1] }}>
          <div className="absolute inset-0" style={{ background: '#FAFAF7', clipPath: slash(minor.y0 + minorH * 0.12, minor.y1 - minorH * 0.12, -Math.min(lean, minorH * 0.2)) }} />
          <div className="absolute inset-0" style={{ background: '#0B0B0D', clipPath: slash(minor.y0 + minorH * 0.12 + 4, minor.y1 - minorH * 0.12 - 4, -Math.min(lean, minorH * 0.2)) }} />
          <div className="font-sfx absolute left-0 right-0 flex items-center justify-center" style={{ top: minor.y0, height: minorH, fontSize: Math.min(minorH * 0.5, w * (narrow ? 0.2 : 0.12)), color: fill, WebkitTextStroke: '4px #FAFAF7', paintOrder: 'stroke fill', transform: 'rotate(5deg)', lineHeight: 1 }}>
            {sfx}
          </div>
        </motion.div>
      )}
    </div>
  );
};

/**
 * Your own seat, as a character panel like everyone else's: a tilted cut portrait frame with your
 * initials overlapping a leaning ink plate that holds your name in a caption box and your record.
 * Portrait and plate go orange on your turn. It sits under the status chip, above your hand.
 */
const MyPlate: React.FC<{ k: number; minW: number; name: string; badge?: string; wins: number; losses: number; live: boolean; leader: boolean; out: boolean; passBeat: number; plateRef: (el: HTMLDivElement | null) => void }> = ({ k, minW, name, badge, wins, losses, live, leader, out, passBeat, plateRef }) => {
  const P = 'polygon(0 0, 100% 0, 100% 80%, 76% 100%, 0 100%)';
  const fill = out ? '#8E8E8F' : live ? '#E85D00' : '#FAFAF7';
  return (
    <div ref={plateRef} data-plate data-my-plate className="relative flex items-center" style={{ minWidth: minW, filter: `drop-shadow(4px 4px 0 #000)` }}>
      <div className="relative z-10 shrink-0 -rotate-[5deg]" style={{ width: 46 * k, height: 56 * k, marginRight: -8 * k }}>
        <span aria-hidden className="absolute inset-0" style={{ background: live ? '#0B0B0D' : '#FAFAF7', clipPath: P }} />
        <span aria-hidden className="absolute inset-[3px]" style={{ background: '#0B0B0D', clipPath: P }} />
        <span aria-hidden className="absolute inset-[5px] overflow-hidden" style={{ background: fill, clipPath: P }}>
          <span className="tone absolute inset-0 text-ink/25" style={{ clipPath: 'polygon(0 62%, 100% 30%, 100% 100%, 0 100%)' }} />
        </span>
        <span className="absolute inset-[5px] grid place-items-center font-display leading-none tracking-[0.02em] text-ink pt-1" style={{ fontSize: 23 * k }}>{badge ?? name.slice(0, 2).toUpperCase()}</span>
        {leader && <Crown size={15} strokeWidth={2.75} className="absolute -top-2.5 -left-2 text-ember fill-paper drop-shadow-[2px_2px_0_#000]" aria-label="You lead this trick" />}
      </div>
      <div className="relative flex-1">
        <span aria-hidden className="absolute inset-0" style={{ background: live ? '#E85D00' : '#FAFAF7', clipPath: 'polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)' }} />
        <span aria-hidden className="absolute inset-[3px]" style={{ background: '#0B0B0D', clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)' }} />
        <div className="relative flex items-center justify-between gap-2 pl-4 pr-4" style={{ paddingTop: 7 * k, paddingBottom: 7 * k }}>
          <span className={`-rotate-2 px-1.5 pt-[2px] pb-[1px] font-extrabold leading-tight whitespace-nowrap max-w-[46vw] truncate ${live ? 'bg-ember text-ink' : 'bg-paper text-ink'}`}
            style={{ fontSize: 14 * k, clipPath: 'polygon(0 0, 100% 0, calc(100% - 5px) 100%, 0 100%)' }}>{name}</span>
          <span className="font-sans tabular-nums font-semibold text-mist whitespace-nowrap" style={{ fontSize: 12 * k }}>{wins}W·{losses}L</span>
        </div>
      </div>
      <AnimatePresence>
        {passBeat > 0 && <PassStamp key={passBeat} />}
      </AnimatePresence>
    </div>
  );
};

const PassStamp: React.FC = () => {
  const [on, setOn] = useState(true);
  useEffect(() => { const t = setTimeout(() => setOn(false), 1200); return () => clearTimeout(t); }, []);
  if (!on) return null;
  return (
    <motion.span
      className="absolute left-full ml-2 top-1/2 font-display text-[18px] leading-none tracking-[0.08em] px-2 pt-1 pb-0.5 border-[3px] border-ink text-ink bg-paper shadow-hard-sm"
      initial={{ y: '-50%', scale: 1.8, rotate: -14, opacity: 0 }}
      animate={{ y: '-50%', scale: 1, rotate: -8, opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 700, damping: 20 }}
    >
      PASS
    </motion.span>
  );
};

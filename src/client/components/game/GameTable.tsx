import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { Crown, LogOut, X } from 'lucide-react';
import { MuteButton } from '../ui/MuteButton';
import type { Card as CardType, Player, Meld } from '../../types/game';
import { GamePhase } from '../../types/game';
import { PlayerHand } from './PlayerHand';
import { Seat, seatSpots } from './Seat';
import { TablePile } from './TablePile';
import { Callouts, showCallout, dismissCallout, onCalloutBox, calloutFontPx, calloutSize, calloutTilt, splitCallout, CALLOUT_FLOOR } from './Callouts';
import { GameOver } from './GameOver';
import { DialogBox } from '../ui/DialogBox';
import { CardBack } from '../ui/CardFace';
import { useViewport, registry, fan, tableLanes, placeCallout, meldFit, seatHalf, seatScale, myPlateScale, ringBandW, SEAT_W } from '../../fx/layout';
import type { Viewport } from '../../fx/layout';
import { bus } from '../../fx/bus';
import { sfx } from '../../fx/sound';
import { haptics } from '../../fx/haptics';
import { particles, FxCanvas } from '../../fx/particles';
import { reducedMotion } from '../../fx/prefs';
import { selectionLabel } from '../../fx/meld';
import { whyNot } from '../../fx/rules';
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
 * The ring: the round play area in the middle of the table where every meld lands, like a mat
 * circle drawn in ink on the screentone page. Flat ink inside, so the cards pop; a band of
 * screentone round the edge, held between a thin inner rule and a heavy paper brush stroke that
 * lifts off before it closes (the same dry brush as the Heart 5's ring); a faint gutter rule
 * outside that. The house motto is lettered along the band, HEART OF FIVE over the top and the
 * house line under the bottom, each arc only where nothing sits on it (tableLanes), and it steps
 * aside while a callout is printed over it. Static: it sits on its own compositor layer, so cards
 * flying over it never make it repaint.
 */
const MOTTO_TOP = 'HEART OF FIVE';
const MOTTO_BOTTOM = "红心五 · IT'S DA BOMB!";
const TableRing: React.FC<{ cx: number; cy: number; r: number; top: boolean; bottom: boolean; outer: boolean }> = React.memo(({ cx, cy, r, top, bottom, outer }) => {
  const band = ringBandW(r);
  const font = Math.round(band * 0.7);
  const tr = r - band / 2;
  const pad = 16;
  const size = (r + pad) * 2;
  // Hide an arc of lettering while a callout's box overlaps it: decorative text never sits under a word.
  const [hide, setHide] = useState({ top: false, bottom: false });
  useEffect(() => onCalloutBox((b) => {
    if (!b) { setHide({ top: false, bottom: false }); return; }
    const arc = (deg: number, up: boolean) => {
      const a = (deg * Math.PI) / 180;
      const hh = (tr * (1 - Math.cos(a))) / 2 + band / 2;
      const y = up ? cy - tr + hh - band / 2 : cy + tr - hh + band / 2;
      return Math.abs(b.x - cx) < b.hw + tr * Math.sin(a) && Math.abs(b.y - y) < b.hh + hh;
    };
    setHide({ top: arc(50, true), bottom: arc(58, false) });
  }), [cx, cy, tr, band]);
  const id = `ring${Math.round(r)}`;
  return (
    <div aria-hidden data-ring className="absolute pointer-events-none" style={{ left: cx - size / 2, top: cy - size / 2, width: size, height: size, willChange: 'transform' }}>
      <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} className="overflow-visible">
        <defs>
          <pattern id={`${id}tone`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
            <circle cx="3" cy="3" r="1.25" fill="#FAFAF7" opacity="0.26" />
          </pattern>
          <filter id={`${id}brush`} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency={`${(0.9 * 100 / r).toFixed(3)} 0.06`} numOctaves="2" seed="5" />
            <feDisplacementMap in="SourceGraphic" scale="5" />
          </filter>
          {/* top arc left to right; bottom arc also left to right, so both read upright */}
          <path id={`${id}top`} d={`M ${-tr} 0 A ${tr} ${tr} 0 0 1 ${tr} 0`} />
          <path id={`${id}bot`} d={`M ${-tr} 0 A ${tr} ${tr} 0 0 0 ${tr} 0`} />
        </defs>
        {outer && <circle r={r + 10} fill="none" stroke="#FAFAF7" strokeOpacity="0.45" strokeWidth="2" />}
        <circle r={r} fill="#0B0B0D" />
        <circle r={tr} fill="none" stroke={`url(#${id}tone)`} strokeWidth={band} />
        <circle r={r - band} fill="none" stroke="#FAFAF7" strokeOpacity="0.55" strokeWidth="1.5" />
        {/* the brush stroke: one heavy loaded pass that lifts off before it closes, and a dry second pass */}
        <g filter={`url(#${id}brush)`} fill="none" stroke="#FAFAF7" strokeLinecap="round">
          <circle r={r} strokeWidth="5.5" strokeDasharray={`${(2 * Math.PI * r * 0.93).toFixed(1)} ${(2 * Math.PI * r).toFixed(1)}`} transform="rotate(-62)" />
          <circle r={r + 3} strokeWidth="1.6" strokeOpacity="0.7" strokeDasharray={`${(2 * Math.PI * r * 0.78).toFixed(1)} ${(2 * Math.PI * r).toFixed(1)}`} transform="rotate(-20)" />
        </g>
        <g fill="#FAFAF7" stroke="#0B0B0D" strokeWidth={Math.max(3, font * 0.28)} paintOrder="stroke" fontSize={font} letterSpacing={font * 0.12}
          fontFamily='Bangers, "H5 Seal", Impact, sans-serif' dominantBaseline="central" style={{ transition: 'opacity .2s ease' }}>
          {top && <text style={{ opacity: hide.top ? 0 : 1, transition: 'opacity .2s ease' }}><textPath href={`#${id}top`} startOffset="50%" textAnchor="middle">{MOTTO_TOP}</textPath></text>}
          {bottom && <text style={{ opacity: hide.bottom ? 0 : 1, transition: 'opacity .2s ease' }}><textPath href={`#${id}bot`} startOffset="50%" textAnchor="middle">{MOTTO_BOTTOM}</textPath></text>}
        </g>
      </svg>
    </div>
  );
});
TableRing.displayName = 'TableRing';

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
          style={{ left: vp.pileX - w / 2, top: vp.pileY - w * 0.7, width: w, height: w * 1.4, willChange: 'transform, opacity' }}
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
    // the seats, so it never sits on anyone's plate or card count.
    const wide = vp.w < 640 && level >= 3;
    let full = wide ? 200 : calloutFontPx(level, vp.w, text, Infinity);
    while (full > 16 && calloutSize(full, text, level).w > vp.w - 24) full *= 0.96;
    const fit = meldN > 0 ? meldFit(meldN, vp, vp.meldRoom) : null;
    const p = placeCallout({
      vp, seats: boxes, pileY: vp.pileY, statusTop: lanes.statusTop,
      meldHalfW: fit?.half ?? 0, meldScale: fit?.scale ?? 1,
      full, floor: wide ? 28 : CALLOUT_FLOOR[level] ?? 24,
      size: (f, lines) => {
        if (lines === 2 && !splitCallout(text)) return null;
        const c = calloutSize(f, text, level, sub, lines);
        return { ...c, tilt: calloutTilt(level, c.w) };
      },
    });
    return { x: p.x, y: p.y, fontPx: p.fontPx, maxW: p.maxW, maxScale: p.maxScale, lines: p.lines, tilt: p.tilt };
  }, [vp, boxes, lanes.statusTop]);
  const trickRef = useRef(0);
  trickRef.current = trickMelds[trickMelds.length - 1]?.cards.length ?? 0;
  // One stable kick handler per seat, so a memoized Seat doesn't redraw for a fresh closure.
  const onKickRef = useRef(onKick);
  onKickRef.current = onKick;
  const kicks = useMemo(() => new Map(opponents.map((id) => [id, () => onKickRef.current?.(id)])), [opponents]);
  const placeOf = (p?: Player) => (p?.isOut && p.position ? p.position : undefined);

  // ---------- screen shake ----------
  // Short and hard, like a panel jolting: never longer than about 0.4s, so play isn't held up.
  const shake = useCallback((px: number) => {
    if (!scope.current || reducedMotion() || px <= 0) return;
    const a = px, b = px * 0.55;
    // The whole table gets its own layer only while it shakes, so the jolt moves it without
    // repainting it; a full-screen layer left in place would cost every frame of compositing.
    const el = scope.current;
    el.style.willChange = 'transform';
    void animate(el, { x: [0, -a, a * 0.9, -b, b * 0.5, 0], y: [0, a * 0.6, -a * 0.5, b * 0.4, 0, 0] }, { duration: Math.min(0.4, 0.22 + px * 0.01), ease: 'easeOut' })
      .then(() => { el.style.willChange = ''; });
  }, [animate, scope]);

  /**
   * The full-screen impact frame for a bomb or the Heart 5 (skipped under reduced motion). It keeps
   * the newest meld's band clear, so the cards that did it stay in view. Says whether it ran.
   */
  const impactOnce = (kind: 'bomb' | 'heart5', text: string, n: number) => {
    if (reducedMotion()) return false;
    const fit = meldFit(n, vp, vp.meldRoom);
    const mph = vp.PH * fit.scale;
    // keep the ring clear, and the newest meld too where it spills past the ring into a wedge
    showImpact({ id: Date.now(), kind, text, cx: vp.pileX, cy: vp.pileY, clear: Math.max(lanes.ringR + 10, mph * 1.02 + 8) });
    return true;
  };


  // ---------- a meld lands ----------
  const onLand = useCallback((meld: Meld, fx: PlayFx) => {
    const who = meld.playerId === myPlayerId ? 'You' : players.get(meld.playerId)?.name ?? '';
    const n = meld.cards.length;
    sfx.land(fx.level >= 3 ? 3 : n >= 5 ? 2 : 1);
    const cx = vp.pileX, cy = vp.pileY;
    let framed = false;
    // the last play's word goes as this one lands; this play's word (if any) replaces it below
    if (!fx.label || fx.heart5 || fx.level === 3) dismissCallout();
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
        <TableRing cx={vp.pileX} cy={vp.pileY} r={lanes.ringR} top={lanes.mottoTop} bottom={lanes.mottoBottom} outer={lanes.outerRing} />

        {/* the lamp over whoever's turn it is */}
        <motion.div
          aria-hidden
          className="tone absolute pointer-events-none"
          style={{ width: 420, height: 420, left: -210, top: -210, color: 'rgba(232,93,0,.28)', willChange: 'transform', WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 66%)', maskImage: 'radial-gradient(circle, #000 0%, transparent 66%)' }}
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
              onKick={isHost && onKick ? kicks.get(id) : undefined}
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
          {me && <MyPlate k={myPlateScale(vp)} minW={vp.w >= 640 ? SEAT_W * myPlateScale(vp) : 0} name={me.name} wins={me.wins} losses={me.losses} live={isMyTurn} leader={isLeader} out={!!myPlace} passBeat={passBeats[myPlayerId] ?? 0} plateRef={(el) => registry.seat(myPlayerId, el)} />}
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

      <ImpactLayer w={vp.w} h={vp.h} />

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
 * The finisher frame for a bomb or the Heart 5: for about half a second the play owns the screen,
 * and all of it bursts out of the ring. The page outside the ring flashes (paper for a bomb, red
 * for the Heart 5) and ink focus lines shoot out from the ring's edge. A wedge whose sides are rays
 * from the ring's centre bursts out over the bigger side, above or below the ring: Signal Orange
 * for a bomb, blood red for the Heart 5, with a paper edge and a black offset, carrying the word in
 * giant tilted lettering. A narrower ink wedge with the sound effect bursts the other way. Both
 * swell a little and fade. The ring (and the newest meld, if it spills past it) stays clear the
 * whole time, so you always see the cards that did it. It never takes input, and reduced motion
 * skips it (impactOnce). It lives in its own layer component, so it never re-renders the table.
 */
export const IMPACT_MS = 560;
const IMPACT_TILT = (6 * Math.PI) / 180;
/** Half-angles of the word's wedge and the sound effect's wedge. */
const WEDGE_MAIN = (58 * Math.PI) / 180;
const WEDGE_MINOR = (34 * Math.PI) / 180;
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
export function impactFit(text: string, budget: number, bandH: number, narrow: boolean) {
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

/** A wedge between two rays from (cx, cy), from radius r0 out past the screen, as an SVG/CSS path. */
function wedgePath(cx: number, cy: number, r0: number, far: number, a1: number, a2: number) {
  const P = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  const mid = (a1 + a2) / 2;
  return `M ${P(r0, a1)} L ${P(far, a1)} L ${P(far, mid)} L ${P(far, a2)} L ${P(r0, a2)} A ${r0.toFixed(1)} ${r0.toFixed(1)} 0 0 0 ${P(r0, a1)} Z`;
}

export interface ImpactSpec { id: number; kind: 'bomb' | 'heart5'; text: string; cx: number; cy: number; clear: number }
const impactListeners = new Set<(s: ImpactSpec) => void>();
const showImpact = (s: ImpactSpec) => impactListeners.forEach((l) => l(s));

/** Holds the finisher frame, so firing one re-renders this layer and nothing else. */
const ImpactLayer: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const [spec, setSpec] = useState<ImpactSpec | null>(null);
  useEffect(() => { impactListeners.add(setSpec); return () => { impactListeners.delete(setSpec); }; }, []);
  const done = useCallback(() => setSpec(null), []);
  return (
    <AnimatePresence>
      {spec && <ImpactFrame key={spec.id} {...spec} w={w} h={h} onDone={done} />}
    </AnimatePresence>
  );
};

const ImpactFrame: React.FC<ImpactSpec & { w: number; h: number; onDone: () => void }> = ({ kind, text, w, h, cx, cy, clear, onDone }) => {
  const heart = kind === 'heart5';
  useEffect(() => { const t = window.setTimeout(onDone, IMPACT_MS + 40); return () => clearTimeout(t); }, [onDone]);
  const narrow = w < 640;
  const bleed = Math.round(Math.max(w, h) * 0.06);
  const geo = useMemo(() => {
    const above = cy - clear, below = h - cy - clear;
    const up = above >= below;
    const far = Math.hypot(w, h) * 1.4;
    const dir = up ? -Math.PI / 2 : Math.PI / 2;
    // the word's band: from the screen edge to just short of the ring, on the bigger side
    const y0 = up ? 6 : cy + clear + 10, y1 = up ? cy - clear - 10 : h - 6;
    const bandH = Math.max(40, y1 - y0);
    const yc = (y0 + y1) / 2;
    // Fit the word to the screen first, then to the wedge: its inner edge, nearest the ring, is the
    // narrowest part of the wedge the word has to sit in.
    let budget = Math.min(w - 24, w * (narrow ? 0.92 : 0.58));
    let fit = impactFit(text, budget, bandH, narrow);
    for (let k = 0; k < 3; k++) {
      const blockH = fit.words.length * fit.font * 0.95;
      const dIn = Math.abs(cy - yc) - blockH / 2;
      const room = 2 * Math.max(0, dIn) * Math.tan(WEDGE_MAIN) - 16;
      if (room >= budget - 1) break;
      budget = Math.max(120, room);
      fit = impactFit(text, budget, bandH, narrow);
    }
    const inset = 6 / Math.max(60, clear);
    const minorDir = -dir;
    const minorBand = up ? below : above;
    // focus lines: tapered ink rays from just outside the ring to past the screen's corners
    const rays: string[] = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2 + ((i * 37) % 11) * 0.004;
      const r0 = clear + 8 + ((i * 53) % 7) * 9;
      const da = 0.006 + ((i * 29) % 5) * 0.0025;
      const P = (r: number, t: number) => `${(cx + r * Math.cos(t)).toFixed(1)},${(cy + r * Math.sin(t)).toFixed(1)}`;
      rays.push(`M${P(r0, a)} L${P(far, a - da)} L${P(far, a + da)} Z`);
    }
    return {
      up, far, y0, bandH, fit, minorBand,
      main: wedgePath(cx, cy, clear, far, dir - WEDGE_MAIN, dir + WEDGE_MAIN),
      mainFill: wedgePath(cx, cy, clear + 6, far, dir - WEDGE_MAIN + inset, dir + WEDGE_MAIN - inset),
      minor: wedgePath(cx, cy, clear + 4, far, minorDir - WEDGE_MINOR, minorDir + WEDGE_MINOR),
      minorFill: wedgePath(cx, cy, clear + 9, far, minorDir - WEDGE_MINOR + inset, minorDir + WEDGE_MINOR - inset),
      rays: rays.join(' '),
      hole: `M${-bleed} ${-bleed} H${w + bleed} V${h + bleed} H${-bleed} Z M${cx - clear} ${cy} a${clear} ${clear} 0 1 0 ${clear * 2} 0 a${clear} ${clear} 0 1 0 ${-clear * 2} 0 Z`,
    };
  }, [cx, cy, clear, w, h, text, narrow, bleed]);
  const { font, stretch, words } = geo.fit;
  const fill = heart ? '#D7192B' : '#E85D00';
  const sfx = heart ? 'ゴゴゴ' : 'ドドン';
  const t = IMPACT_MS / 1000;
  const origin = `${cx}px ${cy}px`;
  const burst = { duration: t, times: [0, 0.16, 0.72, 1], ease: 'easeOut' as const };
  const clip = (d: string) => ({ clipPath: `path('${d}')`, WebkitClipPath: `path('${d}')` });
  const minorY0 = geo.up ? cy + clear + 10 : 0, minorY1 = geo.up ? h : cy - clear - 10;
  return (
    <div aria-hidden data-impact={kind} className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 58 }}>
      {/* the flash and the focus lines shooting out of the ring, everywhere but the ring: one layer,
          so the frame adds as little full-screen compositing as it can */}
      {/* it bleeds past the screen, so it still covers the edges while it's scaled down */}
      <motion.svg className="absolute" width={w + bleed * 2} height={h + bleed * 2} viewBox={`${-bleed} ${-bleed} ${w + bleed * 2} ${h + bleed * 2}`}
        style={{ left: -bleed, top: -bleed, transformOrigin: `${cx + bleed}px ${cy + bleed}px`, willChange: 'transform, opacity' }}
        initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1.04, opacity: [0, 1, 0.7, 0] }}
        transition={{ duration: t, ease: 'easeOut', opacity: { duration: t, times: [0, 0.1, 0.55, 1] } }}>
        <path d={geo.hole} fillRule="evenodd" fill={heart ? '#D7192B' : '#FAFAF7'} fillOpacity="0.88" />
        <path d={geo.rays} fill="#0B0B0D" fillOpacity="0.62" />
      </motion.svg>
      {/* the word's wedge: black offset, then the hot panel with a paper edge, then the lettering */}
      <motion.div className="absolute inset-0" style={{ transformOrigin: origin, willChange: 'transform, opacity' }}
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: [0.92, 1, 1, 1.1], opacity: [0, 1, 1, 0] }} transition={burst}>
        <div className="absolute inset-0" style={{ background: '#000', ...clip(geo.main), transform: 'translate(10px, 10px)' }} />
        <div className="absolute inset-0" style={{ background: '#FAFAF7', ...clip(geo.main) }} />
        <div className="absolute inset-0" style={{ background: fill, ...clip(geo.mainFill) }}>
          <div className="tone absolute inset-0" style={{ color: 'rgba(11,11,13,.18)' }} />
        </div>
        <motion.div
          data-impact-word
          className="absolute left-0 right-0 flex flex-col items-center justify-center font-display text-paper"
          style={{ left: cx - w / 2, top: geo.y0, height: geo.bandH, fontSize: font, lineHeight: 0.92, letterSpacing: '0.02em', WebkitTextStroke: `${Math.max(5, font * 0.06)}px #0B0B0D`, paintOrder: 'stroke fill', textShadow: `${font * 0.06}px ${font * 0.07}px 0 #0B0B0D` }}
          initial={{ scale: 1.25, rotate: -10 }}
          animate={{ scale: 1, rotate: -6 }}
          transition={{ type: 'spring', stiffness: 700, damping: 18 }}
        >
          {words.map((wd, i) => <span key={i} className="block whitespace-nowrap" style={{ transform: `scaleX(${stretch})` }}>{wd}</span>)}
        </motion.div>
      </motion.div>
      {/* the counter-burst: a narrower ink wedge with the sound effect, the other way */}
      {geo.minorBand > 70 && (
        <motion.div className="absolute inset-0" style={{ transformOrigin: origin, willChange: 'transform, opacity' }}
          initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: [0.92, 1, 1, 1.1], opacity: [0, 1, 1, 0] }} transition={{ ...burst, times: [0, 0.22, 0.7, 1] }}>
          <div className="absolute inset-0" style={{ background: '#FAFAF7', ...clip(geo.minor) }} />
          <div className="absolute inset-0" style={{ background: '#0B0B0D', ...clip(geo.minorFill) }} />
          <div className="font-sfx absolute left-0 right-0 flex items-center justify-center" style={{ top: minorY0, height: Math.max(0, minorY1 - minorY0), fontSize: Math.min(geo.minorBand * 0.42, w * (narrow ? 0.2 : 0.12)), color: fill, WebkitTextStroke: '4px #FAFAF7', paintOrder: 'stroke fill', transform: 'rotate(5deg)', lineHeight: 1 }}>
            {sfx}
          </div>
        </motion.div>
      )}
    </div>
  );
};

/**
 * Your own seat, the same leaning ink name plate as everyone else's: your name in a caption box and
 * your record, with the hard offset drawn as a shape behind it. It goes orange on your turn and sits
 * under the status chip, above your hand.
 */
const MyPlate: React.FC<{ k: number; minW: number; name: string; wins: number; losses: number; live: boolean; leader: boolean; out: boolean; passBeat: number; plateRef: (el: HTMLDivElement | null) => void }> = ({ k, minW, name, wins, losses, live, leader, out, passBeat, plateRef }) => {
  const shape = 'polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)';
  const inner = 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)';
  return (
    <div ref={plateRef} data-plate data-my-plate className="relative flex items-center" style={{ minWidth: minW }}>
      <div className="relative flex-1">
        <span aria-hidden className="absolute inset-0 translate-x-[4px] translate-y-[4px]" style={{ background: live ? '#E85D00' : '#000', clipPath: shape }} />
        <span aria-hidden className="absolute inset-0" style={{ background: out ? '#8E8E8F' : live ? '#E85D00' : '#FAFAF7', clipPath: shape }} />
        <span aria-hidden className="absolute inset-[3px]" style={{ background: '#0B0B0D', clipPath: inner }} />
        {leader && <Crown size={15} strokeWidth={2.75} className="absolute z-10 -top-2.5 -left-1 text-ember fill-paper drop-shadow-[2px_2px_0_#000]" aria-label="You lead this trick" />}
        <div className="relative flex items-center justify-between gap-3 pl-4 pr-4" style={{ paddingTop: 7 * k, paddingBottom: 7 * k }}>
          <span className={`-rotate-2 px-1.5 pt-[2px] pb-[1px] font-extrabold leading-tight whitespace-nowrap max-w-[56vw] truncate ${live ? 'bg-ember text-ink' : 'bg-paper text-ink'}`}
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

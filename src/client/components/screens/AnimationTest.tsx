import React, { useEffect, useMemo, useState } from 'react';
import type { Card, Meld, Player } from '../../types/game';
import { GamePhase, MeldType } from '../../types/game';
import { GameTable } from '../game/GameTable';
import { bus } from '../../fx/bus';
import { registry } from '../../fx/layout';

/**
 * /h5/animation: the real GameTable driven by a scripted, offline game, so every effect (deal,
 * plays, bomb, Heart 5, pass, sweep, going out, game over) can be triggered and judged on demand.
 */
const S = ['C', 'D', 'H', 'S'];
const code = (rank: number, suit: string) => (rank === 16 ? 'jj' : rank === 17 ? 'JJ' : `${({ 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2' } as Record<number, string>)[rank] ?? rank}${suit}`);
const card = (rank: number, suit: string): Card => ({ rank, suit: rank >= 16 ? 'J' : suit, code: code(rank, suit) });

const ME = 'me';
const OPP = ['ann', 'bo', 'cy'];

function startingHand(): Card[] {
  return [card(3, 'H'), card(4, 'S'), card(5, 'H'), card(6, 'D'), card(7, 'C'), card(8, 'H'), card(9, 'S'),
    card(10, 'D'), card(11, 'C'), card(12, 'H'), card(12, 'S'), card(13, 'D'), card(14, 'C'), card(17, 'J')];
}

function basePlayers(hand: number): Map<string, Player> {
  const mk = (id: string, name: string, handCount: number, wins = 0, losses = 0): Player =>
    ({ id, name, handCount, isActive: true, hasPassed: false, isOut: false, wins, losses });
  return new Map([
    [ME, mk(ME, 'Scott', hand, 2, 1)],
    ['ann', mk('ann', 'Grandma Ann', 13, 3, 0)],
    ['bo', mk('bo', 'Bo', 13, 0, 2)],
    ['cy', mk('cy', 'Cousin Cy', 13, 1, 3)],
  ]);
}

export const AnimationTest: React.FC = () => {
  const [hand, setHand] = useState<Card[]>(startingHand);
  const [players, setPlayers] = useState(() => basePlayers(14));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [trick, setTrick] = useState<Meld[]>([]);
  const [turn, setTurn] = useState<string>(ME);
  const [lead, setLead] = useState<string>(ME);
  const [phase, setPhase] = useState<GamePhase>(GamePhase.PLAYING);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState(true);

  const setCount = (id: string, delta: number, patch: Partial<Player> = {}) =>
    setPlayers((m) => {
      const n = new Map(m);
      const p = n.get(id)!;
      n.set(id, { ...p, handCount: Math.max(0, p.handCount + delta), ...patch });
      return n;
    });

  const oppPlay = (id: string, cards: Card[], type: MeldType) => {
    setTrick((t) => [...t, { cards, type, playerId: id }]);
    setCount(id, -cards.length, { hasPassed: false });
    bus.emit({ type: 'meld', playerId: id, cards: cards.map((c) => c.code!), meldType: type });
    const next = OPP[(OPP.indexOf(id) + 1) % OPP.length] ?? ME;
    setTurn(id === 'cy' ? ME : next);
  };
  const pass = (id: string) => {
    bus.emit({ type: 'pass', playerId: id });
    setCount(id, 0, { hasPassed: true });
  };
  const sweep = (winner: string) => {
    setTrick([]);
    setLead(winner);
    setTurn(winner);
    setPlayers((m) => new Map([...m].map(([k, p]) => [k, { ...p, hasPassed: false }])));
    setNote(winner === ME ? 'Your lead' : `${players.get(winner)?.name} leads`);
    setTimeout(() => setNote(null), 1800);
  };

  const steps: Array<[string, () => void]> = useMemo(() => [
    ['Deal', () => {
      setHand(startingHand()); setPlayers(basePlayers(14)); setTrick([]); setSelected(new Set());
      setPhase(GamePhase.PLAYING); setTurn(ME); setLead(ME);
      bus.emit({ type: 'gameStarted', round: 1 });
    }],
    ['Ann: pair', () => oppPlay('ann', [card(9, 'H'), card(9, 'D')], MeldType.PAIR)],
    ['Bo: triple', () => oppPlay('bo', [card(10, 'H'), card(10, 'C'), card(10, 'S')], MeldType.THREE_OF_KIND)],
    ['Cy: straight', () => oppPlay('cy', [card(5, 'S'), card(6, 'C'), card(7, 'S'), card(8, 'D'), card(9, 'C')], MeldType.RUN)],
    ['Ann: BOMB', () => oppPlay('ann', S.map((s) => card(11, s)), MeldType.BOMB)],
    ['Bo: str. flush', () => oppPlay('bo', [7, 8, 9, 10, 11].map((r) => card(r, 'D')), MeldType.STRAIGHT_FLUSH)],
    ['Cy: single', () => oppPlay('cy', [card(13, 'S')], MeldType.SINGLE)],
    ['Ann: full house', () => oppPlay('ann', [card(12, 'H'), card(12, 'C'), card(12, 'S'), card(6, 'D'), card(6, 'H')], MeldType.FULL_HOUSE)],
    ['Bo: sisters', () => oppPlay('bo', [card(6, 'H'), card(6, 'S'), card(7, 'D'), card(7, 'C'), card(8, 'H'), card(8, 'S')], MeldType.SISTERS)],
    ['Cy: 8-card run', () => oppPlay('cy', [6, 7, 8, 9, 10, 11, 12, 13].map((r, i) => card(r, S[i % 4])), MeldType.RUN)],
    ['Cy: Heart 5', () => oppPlay('cy', [card(5, 'H')], MeldType.SINGLE)],
    ['Bo passes', () => pass('bo')],
    ['All pass → sweep', () => { pass('bo'); setTimeout(() => pass('cy'), 250); setTimeout(() => sweep(trick[trick.length - 1]?.playerId ?? ME), 700); }],
    ['Ann goes out', () => setCount('ann', -99, { isOut: true, position: 1 })],
    ['Game over', () => {
      setPlayers((m) => {
        const n = new Map(m);
        n.set('ann', { ...n.get('ann')!, isOut: true, position: 1, handCount: 0, wins: 4 });
        n.set('bo', { ...n.get('bo')!, isOut: true, position: 2, handCount: 0 });
        n.set(ME, { ...n.get(ME)!, isOut: true, position: 3, handCount: 0 });
        n.set('cy', { ...n.get('cy')!, handCount: 3, losses: 4 });
        return n;
      });
      setPhase(GamePhase.GAME_END);
    }],
    ['Error', () => { setError("That doesn't beat the table."); bus.emit({ type: 'error', message: 'x' }); setTimeout(() => setError(null), 2500); }],
    ['My turn ↔', () => setTurn((t) => (t === ME ? 'ann' : ME))],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [trick, players]);

  // Scripted access for recordings: window.__lab['Ann: BOMB']()
  useEffect(() => { (window as unknown as { __lab: unknown }).__lab = Object.fromEntries(steps); }, [steps]);

  return (
    <>
      <GameTable
        players={players}
        myPlayerId={ME}
        myHand={hand}
        selectedCards={selected}
        currentMeld={trick[trick.length - 1] ?? null}
        currentTurnPlayerId={turn}
        leadPlayerId={lead}
        deckCount={0}
        consecutivePasses={0}
        trickMelds={trick}
        lastTrickMelds={[]}
        lastError={error}
        lastNotification={note}
        phase={phase}
        turnOrder={[ME, ...OPP]}
        onCardSelect={(k) => setSelected((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
        onPlayCards={() => {
          const cards = hand.filter((c) => selected.has(c.code!));
          const type = cards.length === 1 ? MeldType.SINGLE : cards.length === 2 ? MeldType.PAIR : cards.length === 3 ? MeldType.THREE_OF_KIND : cards.length === 4 ? MeldType.BOMB : MeldType.RUN;
          registry.captureHand(cards.map((c) => c.code!));
          setHand((h) => h.filter((c) => !selected.has(c.code!)));
          setSelected(new Set());
          setTrick((t) => [...t, { cards, type, playerId: ME }]);
          setCount(ME, -cards.length);
          setTurn('ann');
        }}
        onPass={() => { pass(ME); setTurn('ann'); }}
        onLeaveGame={() => window.location.assign('/h5/')}
        onPlayAgain={() => steps[0][1]()}
        isHost
      />
      <div className="fixed left-2 top-14 z-[90] w-[148px] panel p-2 flex flex-col gap-1 max-h-[80vh] overflow-auto" style={{ display: panel ? undefined : 'none' }}>
        <p className="section-head mb-1">Fx lab</p>
        {steps.map(([label, fn]) => (
          <button key={label} onClick={fn} className="text-left text-[11px] font-sans tabular-nums px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-white/10">{label}</button>
        ))}
        <button onClick={() => setPanel(false)} className="text-[10px] font-sans tabular-nums text-mist mt-1">hide panel</button>
      </div>
    </>
  );
};

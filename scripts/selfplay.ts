/**
 * Self-play: bots against bots on the real rules engine, no browser and no network.
 *
 *   npm run selfplay                       # the standard set of tables
 *   npm run selfplay -- --deals 50         # fewer games (each deal is played once per seating)
 *   npm run selfplay -- --rollouts 600     # let the search bots think harder
 *   npm run selfplay -- --table shark,old:balanced,old:balanced,old:balanced
 *
 * Seats are named by persona (shark, regular, hothead, turtle, rookie) or by one of the old
 * rule-based strategies (old:balanced, old:aggressive, old:cautious). Every deal is seeded, and is
 * replayed with the entrants rotated through the seats, so nobody wins on seat luck. Search bots
 * get a fixed number of rollouts per move rather than a clock, which keeps runs repeatable.
 *
 * Reported per entrant: how often it went out first (win) and how often it was the one left
 * holding cards (last). "illegal" counts answers the rules refused; the referee then makes the
 * move the room would make for an absent player.
 */
import { GameState, GamePhase } from '../src/worker/game/GameState';
import type { Card as EngineCard } from '../src/worker/game/GameState';
import { checkMove } from '../src/client/bots/contract';
import type { BotDecide, BotMove, ViewEvent } from '../src/client/bots/contract';
import { buildView } from '../src/client/bots/view';
import { personaBot } from '../src/client/bots/builtin';
import { isPersonaId } from '../src/client/bots/personas';
import { makeRng } from '../src/client/bots/search/cards';
import { createStrategy } from '../src/client/bots/strategies';
import { BotStrategy } from '../src/client/bots/types';
import type { BotConfig, GameContext } from '../src/client/bots/types';
import { BALANCED_BETTY } from '../src/client/bots/configs';
import type { Player } from '../src/client/types/game';

// The engine and the old strategies log every turn. Not here.
const say = console.log.bind(console);
console.log = () => {};
console.error = () => {};
console.warn = () => {};
// The old strategies wait a moment before every move to look human. Not here either.
(BotStrategy.prototype as unknown as { simulateThinking: () => Promise<void> }).simulateThinking = async () => {};

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const DEALS = Number(arg('deals', '75'));
const ROLLOUTS = Number(arg('rollouts', '400'));
const SEED = Number(arg('seed', '1'));
const CUSTOM = arg('table', '');

/** A seat's brain: the contract function, whatever is behind it. */
function entrant(spec: string, rng: () => number): BotDecide {
  // "shark:flat" and "shark:tree" force plain playouts or the search tree; "shark:x4" gives four times the rollouts.
  const [base, ...mods] = spec.split(':');
  if (isPersonaId(base)) {
    const times = Number(mods.find((m) => /^x\d+$/.test(m))?.slice(1) ?? 1);
    const tree = mods.includes('flat') ? false : mods.includes('tree') ? true : undefined;
    return personaBot(base, { rng, rollouts: ROLLOUTS * times, tree });
  }
  const kind = spec.replace(/^old:/, '');
  if (kind !== 'balanced' && kind !== 'aggressive' && kind !== 'cautious') throw new Error(`Unknown entrant "${spec}"`);
  const config: BotConfig = { ...BALANCED_BETTY, name: spec, chatEnabled: false, decisionDelay: { min: 0, max: 0 } };
  const strategy = createStrategy(kind, config);
  // The old strategies read a GameContext, not a view; the referee slips it to them here.
  return async (view) => {
    const d = await strategy.makeDecision(contextFor.get(view.me)!);
    return d.action === 'play' && d.cards?.length
      ? { action: 'play', cards: d.cards.map((c) => c.code ?? '') }
      : { action: 'pass' };
  };
}
const contextFor = new Map<string, GameContext>();

interface Tally {
  games: number;
  wins: number;
  lasts: number;
  illegal: number;
}

async function playGame(specs: string[], seats: string[], dealSeed: number, tallies: Map<string, Tally>): Promise<void> {
  // The deal, and everything the old strategies roll dice for, comes from this seed.
  Math.random = makeRng(dealSeed);
  const state = new GameState();
  const ids = seats.map((_, i) => `seat${i}`);
  ids.forEach((id) => state.addPlayer(id, id, true));
  state.initializeDeck();
  state.dealCards();

  const bots = new Map(ids.map((id, i) => [id, entrant(seats[i], makeRng(dealSeed * 31 + i))]));
  const specOf = new Map(ids.map((id, i) => [id, seats[i]]));
  const history: ViewEvent[] = [];

  for (let turn = 0; turn < 2000 && state.phase === GamePhase.PLAYING; turn++) {
    const id = state.currentTurnPlayerId;
    const me = state.players.get(id)!;
    const players = new Map<string, Player>();
    state.players.forEach((p, pid) => players.set(pid, {
      id: pid, name: p.name, handCount: p.handCount, isActive: true, hasPassed: p.hasPassed, isOut: p.isOut,
      wins: 0, losses: 0, isBot: true,
    }));
    const context: GameContext = {
      myHand: me.hand.map((c) => ({ suit: c.suit, rank: c.rank, code: c.code })),
      currentMeld: state.currentMeld
        ? { cards: state.currentMeld.cards.map((c) => ({ suit: c.suit, rank: c.rank, code: c.code })), type: state.currentMeld.type, playerId: state.currentMeld.playerId } as GameContext['currentMeld']
        : null,
      isLeader: state.leadPlayerId === id,
      consecutivePasses: state.consecutivePasses,
      players,
      myPlayerId: id,
      currentRound: 0,
      phase: state.phase as unknown as GameContext['phase'],
      turnOrder: [...state.turnOrder],
      playedCards: state.discardPile.map((c) => c.code),
      history,
    };
    contextFor.set(id, context);
    const view = buildView(context, 1000);

    let move: BotMove;
    try {
      move = await bots.get(id)!(view);
    } catch {
      move = { action: 'pass' };
    }
    if (checkMove(view, move) !== null) {
      tallies.get(specOf.get(id)!)!.illegal++;
      const auto = state.autoMove(id)!;
      move = auto.action === 'pass' ? auto : { action: 'play', cards: auto.cards.map((c) => c.code) };
    }

    if (move.action === 'pass') {
      if (!state.pass(id)) throw new Error(`The engine refused a pass the rules allowed (${specOf.get(id)})`);
      history.push({ playerId: id, cards: null });
    } else {
      const codes = move.cards;
      const cards = codes.map((code) => me.hand.find((c) => c.code === code)) as EngineCard[];
      if (!state.playMeld(id, cards)) throw new Error(`The engine refused ${codes.join(' ')} from ${specOf.get(id)}`);
      history.push({ playerId: id, cards: codes });
    }
  }
  if (state.phase === GamePhase.PLAYING) throw new Error('A game never ended');

  state.players.forEach((p, pid) => {
    const t = tallies.get(specOf.get(pid)!)!;
    t.games++;
    if (state.roundWinnerId === pid) t.wins++;
    if (p.losses > 0) t.lasts++;
  });
  void specs;
}

async function runTable(title: string, specs: string[]): Promise<void> {
  const tallies = new Map<string, Tally>();
  for (const s of specs) tallies.set(s, { games: 0, wins: 0, lasts: 0, illegal: 0 });
  const started = Date.now();
  let games = 0;
  for (let d = 0; d < DEALS; d++) {
    for (let r = 0; r < specs.length; r++) {
      const seats = specs.map((_, i) => specs[(i + r) % specs.length]);
      await playGame(specs, seats, SEED * 100_003 + d, tallies);
      games++;
    }
  }
  const even = 100 / specs.length;
  say(`\n${title}`);
  say(`${games} games, ${specs.length} players, ${ROLLOUTS} rollouts per move, ${((Date.now() - started) / 1000).toFixed(0)}s. Even odds: ${even.toFixed(1)}% each way.`);
  say('| entrant | seats | win (first out) | last (left holding cards) | illegal answers |');
  say('|---|---|---|---|---|');
  for (const [spec, t] of tallies) {
    const count = specs.filter((s) => s === spec).length;
    const pct = (x: number) => `${((100 * x) / t.games).toFixed(1)}%`;
    say(`| ${spec} | ${count} | ${pct(t.wins)} | ${pct(t.lasts)} | ${t.illegal} |`);
  }
}

const TABLES: Array<[string, string[]]> = [
  ['One Shark at a table of old Balanced bots', ['shark', 'old:balanced', 'old:balanced', 'old:balanced']],
  ['Shark against one of each old strategy', ['shark', 'old:balanced', 'old:aggressive', 'old:cautious']],
  ['The personalities against each other', ['shark', 'hothead', 'turtle', 'rookie']],
  ['Regular among the old bots', ['regular', 'old:balanced', 'old:aggressive', 'old:cautious']],
  ['Rookie among the old bots', ['rookie', 'old:balanced', 'old:aggressive', 'old:cautious']],
];

const tables = CUSTOM ? [[`Custom table`, CUSTOM.split(',').map((s) => s.trim())] as [string, string[]]] : TABLES;
for (const [title, specs] of tables) await runTable(title, specs);

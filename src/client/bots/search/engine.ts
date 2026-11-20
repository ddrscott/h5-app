import type { BotMove, BotView, ViewCard } from '../contract';
import type { Persona } from '../personas';
import { classify, cardStrength } from '../../../shared/rules';
import { DECK, SLOTS, SLOT_ACE, makeRng, slotOf } from './cards';
import { lockedWin, solveDuel, unbeatable, unseenOf } from './exact';
import { countsOf, isControl, legalPlays, tableOf } from './legal';
import type { LegalPlay } from './legal';
import { T_BOMB, T_NONE } from './moves';
import type { Move } from './moves';
import { copySim, handCost, newSim, rollout, simPass, simPlay } from './sim';
import { Tree, newNode } from './tree';
import type { Node } from './tree';

/**
 * How a built-in bot picks its move.
 *
 * The game hides the other hands, so the bot can't search the real deal. Instead it imagines
 * deals: every card it hasn't seen is shuffled and handed out to the other seats in the sizes
 * they're known to hold (leaning away from deals where somebody passed on a trick they could
 * cheaply have taken). In each imagined deal it tries every move it could make and plays the rest
 * of the game out with a fast rule-of-thumb player in every seat. Moves are scored by where the
 * bot finishes, averaged over the deals; moves that are clearly behind get dropped so the time
 * goes to the close calls. It can stop at any moment and answer with the best move so far.
 *
 * Before any of that it checks what's certain (see exact.ts): a move that goes out, a locked win,
 * and the solved two-player endgame.
 */

export interface ThinkOptions {
  persona: Persona;
  /** randomness for dealing and slips; seeded in tests and self-play */
  rng?: () => number;
  /** overrides the persona: true grows a search tree, false uses plain playouts only */
  tree?: boolean;
  /** play exactly this many rollouts and ignore the clock (tests and self-play) */
  rollouts?: number;
  now?: () => number;
  /** hands the thread back between slices so the page stays live */
  pause?: () => Promise<void>;
  /** how long one slice of thinking may hold the thread, in milliseconds */
  sliceMs?: number;
}

export interface ThinkResult {
  move: BotMove;
  rollouts: number;
  /** what decided it: forced, out, slip, locked, solved, search or instinct */
  how: string;
}

interface Arm {
  play: LegalPlay<ViewCard> | null; // null: pass
  bias: number;
  prior: number;
  sum: number;
  sq: number;
  n: number;
  /** the search tree under this move */
  node: Node;
}

const PASS: BotMove = { action: 'pass' };
const playOf = (p: LegalPlay<ViewCard>): BotMove => ({ action: 'play', cards: p.cards.map((c) => c.code) });
const keyOf = (m: Move) => `${m.type}:${[...m.slots].sort((a, b) => a - b).join(',')}`;

/** What each finishing place is worth to this persona, indexed by place (1 = first out). */
function placeValues(n: number, persona: Persona): Float64Array {
  const v = new Float64Array(n + 1);
  for (let place = 2; place < n; place++) v[place] = n === 3 ? 0 : 0.12 - (0.24 * (place - 2)) / (n - 3);
  v[1] = persona.winValue;
  v[n] = persona.lastValue;
  return v;
}

interface Job {
  /** One more imagined deal, tried with every move still in the running. False when there's nothing left to learn. */
  round(): boolean;
  rollouts(): number;
  pick(): ThinkResult;
}

function lowestSingle(hand: ViewCard[]): BotMove {
  const low = hand.reduce((a, b) => (cardStrength(b) < cardStrength(a) ? b : a));
  return { action: 'play', cards: [low.code] };
}

/** Everything that can be settled without sampling, or the search job when it can't. */
function prepare(view: BotView, opts: ThinkOptions): ThinkResult | Job {
  const persona = opts.persona;
  const rng = opts.rng ?? Math.random;
  const hand = view.hand;
  const tableCards = view.table && view.table.cards.length ? view.table.cards : null;
  const canPass = view.canPass && tableCards !== null;
  const done = (move: BotMove, how: string): ThinkResult => ({ move, rollouts: 0, how });

  const plays = legalPlays(hand, tableCards);
  if (plays.length === 0) return done(canPass || hand.length === 0 ? PASS : lowestSingle(hand), 'forced');
  if (plays.length === 1 && !canPass) return done(playOf(plays[0]), 'forced');

  // Nothing beats going out right now.
  const finisher = plays.find((p) => p.cards.length === hand.length);
  if (finisher) return done(playOf(finisher), 'out');

  if (rng() < persona.blunder) {
    const i = Math.floor(rng() * (plays.length + (canPass ? 1 : 0)));
    return done(i < plays.length ? playOf(plays[i]) : PASS, 'slip');
  }

  // ---- the table, in simulator terms ----
  const n = view.players.length;
  const me = view.players.findIndex((p) => p.id === view.me);
  const myCounts = countsOf(hand);
  const table = tableOf(tableCards);

  const arms: Arm[] = plays.map((play) => {
    const after = Int8Array.from(myCounts);
    for (const s of play.move.slots) after[s]--;
    const left = hand.length - play.cards.length;
    const controls = play.cards.filter(isControl).length + (play.move.type === T_BOMB ? 2 : 0);
    return {
      play,
      prior: -handCost(after),
      bias: persona.shedBias * play.cards.length + persona.controlBias * controls * Math.min(1, left / 6),
      sum: 0,
      sq: 0,
      n: 0,
      node: newNode(),
    };
  });
  if (canPass) arms.push({ play: null, prior: -handCost(myCounts) - 0.35, bias: persona.passBias, sum: 0, sq: 0, n: 0, node: newNode() });

  const score = (a: Arm) => (a.n ? a.sum / a.n : 0) + a.bias + (a.prior * 0.15) / (1 + a.n / 4);
  const choose = (from: Arm[], how: string, rollouts: number): ThinkResult => {
    let best = from[0];
    if (persona.temperature > 0 && from.length > 1) {
      // Near-equal moves get picked at random; clearly worse ones almost never.
      const top = Math.max(...from.map(score));
      const weights = from.map((a) => Math.exp((score(a) - top) / persona.temperature));
      let r = rng() * weights.reduce((x, y) => x + y, 0);
      for (let i = 0; i < from.length; i++) {
        r -= weights[i];
        if (r <= 0) {
          best = from[i];
          break;
        }
      }
    } else {
      for (const a of from) if (score(a) > score(best)) best = a;
    }
    return { move: best.play ? playOf(best.play) : PASS, rollouts, how };
  };

  const opponents: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i !== me && !view.players[i].out && view.players[i].cards > 0) opponents.push(i);
  }
  if (me < 0 || opponents.length === 0) return choose(arms, 'instinct', 0);

  // ---- what hasn't been seen ----
  const gone = new Set<string>(hand.map((c) => c.code));
  for (const c of tableCards ?? []) gone.add(c.code);
  if (persona.countsCards) for (const code of view.played) gone.add(code);
  let pool = DECK.filter((c) => !gone.has(c.code));
  const need = opponents.reduce((sum, i) => sum + view.players[i].cards, 0);
  if (pool.length < need) {
    // The view doesn't add up (it shouldn't happen): fall back to everything but my own hand.
    pool = DECK.filter((c) => !hand.some((h) => h.code === c.code));
    if (pool.length < need) return choose(arms, 'instinct', 0);
  }
  const maxHand = Math.max(...opponents.map((i) => view.players[i].cards));

  // ---- certainties ----
  if (persona.exact) {
    const unseen = unseenOf(pool, countsOf(pool), maxHand);
    const byKey = new Map(arms.filter((a) => a.play).map((a) => [keyOf(a.play!.move), a]));

    if (table.type === T_NONE) {
      const line = hand.length <= 14 ? lockedWin(Int8Array.from(myCounts), unseen) : null;
      const first = line && byKey.get(keyOf(line[0]));
      if (first) return choose([first], 'locked', 0);
    } else {
      for (const a of arms) {
        if (!a.play || hand.length > 14 || !unbeatable(a.play.move, unseen)) continue;
        const rest = Int8Array.from(myCounts);
        for (const s of a.play.move.slots) rest[s]--;
        if (lockedWin(rest, unseen, 1500)) return choose([a], 'locked', 0);
      }
    }

    // The last duel: one opponent, and every card I can't see is in their hand.
    const owner = view.table?.playerId ? view.players.findIndex((p) => p.id === view.table!.playerId) : -1;
    if (
      opponents.length === 1 && pool.length === need && hand.length + need <= 30 &&
      (table.type === T_NONE || owner === opponents[0])
    ) {
      const winners = solveDuel(Int8Array.from(myCounts), countsOf(pool), table);
      if (winners && winners.length) {
        const keys = new Set(winners.map((w) => (w === 'pass' ? 'pass' : keyOf(w))));
        const winning = arms.filter((a) => keys.has(a.play ? keyOf(a.play.move) : 'pass'));
        if (winning.length) {
          winning.sort((x, y) => y.prior - x.prior);
          return choose([winning[0]], 'solved', 0);
        }
      }
    }
  }

  // ---- the search ----
  let alive = arms;
  if (alive.length > 24) {
    const pass = alive.filter((a) => !a.play);
    alive = [...alive.filter((a) => a.play).sort((x, y) => y.prior - x.prior).slice(0, 24), ...pass];
  }

  const root = newSim(n);
  for (let i = 0; i < n; i++) {
    const p = view.players[i];
    root.left[i] = i === me ? hand.length : p.cards;
    if (i !== me && (p.out || p.cards <= 0)) {
      root.out[i] = 1;
      root.left[i] = 0;
      root.outCount++;
    }
  }
  root.cnt.set(myCounts, me * SLOTS);
  root.turn = me;
  root.last = view.table?.playerId ? view.players.findIndex((p) => p.id === view.table!.playerId) : -1;
  root.passes = view.consecutivePasses;
  root.tType = table.type;
  root.tStr = table.str;
  root.tLen = table.len;
  root.tGs = table.gs;
  const work = newSim(n);
  const values = placeValues(n, persona);

  // Passes are weak evidence: someone who let a low single or pair go by probably had no loose
  // card to take it with. Deals that say otherwise are mostly thrown back.
  const noSingleAbove = new Int8Array(n).fill(99);
  const noPairAbove = new Int8Array(n).fill(99);
  if (persona.countsCards) {
    const byCode = new Map(DECK.map((c) => [c.code, c]));
    let current: ReturnType<typeof classify> | null = null;
    for (const e of view.history) {
      if (e.cards) {
        current = classify(e.cards.flatMap((code) => byCode.get(code) ?? []));
        continue;
      }
      const seat = view.players.findIndex((p) => p.id === e.playerId);
      if (seat < 0 || !current) continue;
      if (current.type === 'SINGLE') noSingleAbove[seat] = Math.min(noSingleAbove[seat], current.strength);
      if (current.type === 'PAIR') noPairAbove[seat] = Math.min(noPairAbove[seat], current.strength);
    }
  }
  const doubts = (): number => {
    let v = 0;
    for (const seat of opponents) {
      const o = seat * SLOTS;
      for (let s = Math.max(0, noSingleAbove[seat] - 2); s <= SLOT_ACE; s++) {
        if (root.cnt[o + s] === 1) {
          v++;
          break;
        }
      }
      for (let s = Math.max(0, noPairAbove[seat] - 2); s < SLOT_ACE; s++) {
        if (root.cnt[o + s] === 2) {
          v++;
          break;
        }
      }
    }
    return v;
  };

  const poolSlots = Int8Array.from(pool.map(slotOf));
  const deal = () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      for (let i = 0; i < need; i++) {
        const j = i + Math.floor(rng() * (poolSlots.length - i));
        const t = poolSlots[i];
        poolSlots[i] = poolSlots[j];
        poolSlots[j] = t;
      }
      let at = 0;
      for (const seat of opponents) {
        const o = seat * SLOTS;
        root.cnt.fill(0, o, o + SLOTS);
        for (let k = 0; k < root.left[seat]; k++) root.cnt[o + poolSlots[at++]]++;
      }
      const v = doubts();
      if (v === 0 || rng() < Math.pow(0.4, v)) return;
    }
  };

  const tree = (opts.tree ?? persona.tree) ? new Tree(me, values, persona.policy) : null;
  let rollouts = 0;
  let rounds = 0;
  return {
    round() {
      deal();
      // Every move meets the same deal and the same luck, so they're compared like for like.
      const seed = Math.floor(rng() * 4294967296);
      for (const arm of alive) {
        copySim(root, work);
        if (arm.play) simPlay(work, me, arm.play.move);
        else simPass(work, me);
        const v = tree
          ? tree.run(arm.node, work, makeRng(seed))
          : values[rollout(work, me, makeRng(seed), persona.policy)];
        arm.sum += v;
        arm.sq += v * v;
        arm.n++;
      }
      rollouts += alive.length;
      rounds++;
      if (rounds >= 12 && rounds % 6 === 0 && alive.length > 1) {
        let best = alive[0];
        for (const a of alive) if (score(a) > score(best)) best = a;
        const variance = (a: Arm) => Math.max(0, a.sq / a.n - (a.sum / a.n) ** 2);
        alive = alive.filter((a) => {
          if (a === best) return true;
          const se = Math.sqrt((variance(a) + variance(best)) / a.n);
          return score(best) - score(a) <= 2.5 * se + 0.02;
        });
      }
      return alive.length > 1;
    },
    rollouts: () => rollouts,
    pick: () => choose(alive, rollouts ? 'search' : 'instinct', rollouts),
  };
}

const isResult = (x: ThinkResult | Job): x is ThinkResult => 'move' in x;

/** The cap on rollouts for a persona, given a fixed allowance. */
function allowance(persona: Persona, rollouts: number): number {
  return Math.min(persona.rolloutCap ?? Infinity, Math.max(1, Math.round(rollouts * persona.effort)));
}

/** Thinks with a fixed number of rollouts, start to finish, without yielding. For tests and self-play. */
export function thinkSync(view: BotView, opts: ThinkOptions): ThinkResult {
  const job = prepare(view, opts);
  if (isResult(job)) return job;
  const cap = allowance(opts.persona, opts.rollouts ?? 400);
  while (job.rollouts() < cap && job.round()) { /* keep going */ }
  return job.pick();
}

/** setTimeout is slowed to a crawl in a background tab; a MessageChannel isn't. */
function defaultPause(): Promise<void> {
  if (typeof MessageChannel === 'undefined') return new Promise((resolve) => setTimeout(resolve, 0));
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(0);
  });
}

/**
 * Thinks until `view.timeBudgetMs` runs out (or it's sure), in short slices with a pause between
 * them so the page never freezes. Answers with the best move found so far.
 */
export async function think(view: BotView, opts: ThinkOptions): Promise<ThinkResult> {
  if (opts.rollouts !== undefined) return thinkSync(view, opts);
  const now = opts.now ?? (() => performance.now());
  const pause = opts.pause ?? defaultPause;
  const slice = opts.sliceMs ?? 10;
  const deadline = now() + Math.max(0, view.timeBudgetMs);

  const job = prepare(view, opts);
  if (isResult(job)) return job;
  const cap = opts.persona.rolloutCap ?? Infinity;
  let more = true;
  while (more && now() < deadline) {
    const sliceEnd = Math.min(deadline, now() + slice);
    while (more && now() < sliceEnd) more = job.rollouts() < cap && job.round();
    if (more) await pause();
  }
  return job.pick();
}

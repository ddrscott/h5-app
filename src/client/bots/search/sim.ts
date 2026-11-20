import { SLOTS, SLOT_ACE, SLOT_H5, SLOT_TWO } from './cards';
import { T_BOMB, T_FULL, T_NONE, T_PAIR, T_RUN, T_SINGLE, T_SISTERS, T_TRIPLE } from './moves';
import type { Move } from './moves';

/**
 * A lean copy of the table for playing a game out thousands of times a second. It follows the
 * room's turn rules (src/worker/game/GameState.ts: playMeld, pass, nextTurn) but keeps only slot
 * counts, and it knows nothing about straight flushes beyond "a bomb is on the table".
 * sim.test.ts plays it in lockstep with the real GameState to keep the two honest.
 */
export interface Sim {
  n: number;
  /** n * 16 slot counts */
  cnt: Int8Array;
  left: Int8Array;
  out: Uint8Array;
  /** finishing place per seat, 0 while still in */
  place: Int8Array;
  outCount: number;
  turn: number;
  /** seat that owns the meld on the table, or -1 */
  last: number;
  passes: number;
  tType: number;
  tStr: number;
  tLen: number;
  tGs: number;
}

export function newSim(n: number): Sim {
  return {
    n,
    cnt: new Int8Array(n * SLOTS),
    left: new Int8Array(n),
    out: new Uint8Array(n),
    place: new Int8Array(n),
    outCount: 0,
    turn: 0,
    last: -1,
    passes: 0,
    tType: T_NONE,
    tStr: 0,
    tLen: 0,
    tGs: 0,
  };
}

export function copySim(a: Sim, b: Sim): void {
  b.cnt.set(a.cnt);
  b.left.set(a.left);
  b.out.set(a.out);
  b.place.set(a.place);
  b.outCount = a.outCount;
  b.turn = a.turn;
  b.last = a.last;
  b.passes = a.passes;
  b.tType = a.tType;
  b.tStr = a.tStr;
  b.tLen = a.tLen;
  b.tGs = a.tGs;
}

function nextIn(sim: Sim, p: number): number {
  for (let i = 1; i <= sim.n; i++) {
    const q = (p + i) % sim.n;
    if (!sim.out[q]) return q;
  }
  return p;
}

/** The cards are already off the hand; this puts the meld on the table and moves the turn. */
function commit(sim: Sim, p: number, type: number, str: number, len: number, gs: number): void {
  sim.left[p] -= len;
  sim.tType = type;
  sim.tStr = str;
  sim.tLen = len;
  sim.tGs = gs;
  sim.last = p;
  sim.passes = 0;
  if (sim.left[p] <= 0) {
    sim.out[p] = 1;
    sim.outCount++;
    sim.place[p] = sim.outCount;
  }
  sim.turn = nextIn(sim, p);
}

export function simPlay(sim: Sim, p: number, m: Move): void {
  const o = p * SLOTS;
  for (let i = 0; i < m.slots.length; i++) sim.cnt[o + m.slots[i]]--;
  commit(sim, p, m.type, m.str, m.len, m.gs);
}

export function simPass(sim: Sim, p: number): void {
  sim.passes++;
  const lastIn = sim.last >= 0 && !sim.out[sim.last];
  const needed = sim.n - sim.outCount - (lastIn ? 1 : 0);
  if (sim.passes >= needed) {
    // The trick is over: the meld's owner leads, or the next seat when the owner is out.
    const leader = lastIn ? sim.last : nextIn(sim, sim.last >= 0 ? sim.last : p);
    sim.tType = T_NONE;
    sim.tStr = 0;
    sim.tLen = 0;
    sim.tGs = 0;
    sim.passes = 0;
    sim.turn = leader;
    return;
  }
  sim.turn = nextIn(sim, p);
}

/** True once at most one seat still holds cards. */
export const simOver = (sim: Sim): boolean => sim.n - sim.outCount <= 1;

// ---------------------------------------------------------------------------
// The rollout policy: a fast, sensible player used for every seat while a game is played out.
// ---------------------------------------------------------------------------

export interface PolicyParams {
  /** chance of an off-book lead, so playouts don't all look alike */
  eps: number;
  /** chance of spending a 2, a joker or the Heart 5 to take a trick when nothing forces it */
  premium: number;
  /** chance of breaking a pair or triple to follow */
  breakUp: number;
  /** chance of bombing when nothing forces it */
  bomb: number;
}

export const DEFAULT_POLICY: PolicyParams = { eps: 0.06, premium: 0.4, breakUp: 0.12, bomb: 0.08 };

// wholeMeld() answers through these, to stay allocation-free.
let wType = 0;
let wStr = 0;
let wGs = 0;

/** If the whole hand (total cards) is one meld, sets wType/wStr/wGs and returns true. */
function wholeMeld(c: Int8Array, o: number, total: number): boolean {
  let distinct = 0;
  let minS = 99;
  let maxS = -1;
  let c1 = 0;
  let c2 = 0;
  let c3 = 0;
  for (let s = 0; s < SLOTS; s++) {
    const k = c[o + s];
    if (!k) continue;
    distinct++;
    if (s < minS) minS = s;
    if (s > maxS) maxS = s;
    if (k === 1) c1++;
    else if (k === 2) c2++;
    else if (k === 3) c3++;
  }
  wGs = 0;
  if (total === 1) {
    wType = T_SINGLE;
    wStr = maxS === SLOT_H5 ? 18 : maxS + 3;
    return true;
  }
  if (maxS > SLOT_TWO) return false; // jokers and the lone Heart 5 only go out as singles here
  if (distinct === 1) {
    wType = total === 2 ? T_PAIR : total === 3 ? T_TRIPLE : T_BOMB;
    wStr = minS + 3;
    return true;
  }
  if (total === 5 && distinct === 2 && c3 === 1 && c2 === 1) {
    wType = T_FULL;
    wStr = (c[o + minS] === 3 ? minS : maxS) + 3;
    return true;
  }
  const consecutive = maxS - minS + 1 === distinct;
  if (consecutive && (c2 === distinct || c3 === distinct)) {
    wType = T_SISTERS;
    wStr = maxS + 3;
    wGs = c2 === distinct ? 2 : 3;
    return true;
  }
  if (c1 === distinct && distinct >= 5) {
    if (consecutive && maxS <= SLOT_ACE) {
      wType = T_RUN;
      wStr = maxS + 3;
      return true;
    }
    if (distinct === 5 && c[o] && c[o + 1] && c[o + 2] && c[o + SLOT_ACE] && c[o + SLOT_TWO]) {
      wType = T_RUN;
      wStr = 5;
      return true;
    }
  }
  return false;
}

function minOthers(sim: Sim, p: number): number {
  let m = 99;
  for (let q = 0; q < sim.n; q++) {
    if (q !== p && !sim.out[q] && sim.left[q] < m) m = sim.left[q];
  }
  return m;
}

// lowestUnit() answers through these.
let uType = 0;
let uStr = 0;
let uLen = 0;
let uGs = 0;

/**
 * Takes the natural meld that holds the hand's lowest card off the hand: a run when the low cards
 * line up, sisters, a full house, a triple, a pair, or the lone card. Bombs and the top singles
 * wait until nothing else is left. This is the hand-decomposition heuristic: leading these one by
 * one empties a hand in about as few turns as it can be done.
 */
function lowestUnit(c: Int8Array, o: number): void {
  let s0 = -1;
  for (let s = 0; s <= SLOT_TWO; s++) {
    const k = c[o + s];
    if (k > 0 && k < 4) {
      s0 = s;
      break;
    }
  }
  uGs = 0;
  if (s0 < 0) {
    // Only jokers, the Heart 5 and bombs are left: singles first, low to high.
    for (let s = SLOT_TWO + 1; s < SLOTS; s++) {
      if (c[o + s] > 0) {
        c[o + s]--;
        uType = T_SINGLE;
        uStr = s === SLOT_H5 ? 18 : s + 3;
        uLen = 1;
        return;
      }
    }
    for (let s = 0; s <= SLOT_TWO; s++) {
      if (c[o + s] === 4) {
        c[o + s] = 0;
        uType = T_BOMB;
        uStr = s + 3;
        uLen = 4;
        return;
      }
    }
    uType = T_NONE;
    uLen = 0;
    return;
  }

  const k = c[o + s0];
  if (k === 1) {
    // A run from the lowest card, as long as it is mostly made of loose cards.
    let span = 0;
    while (s0 + span <= SLOT_ACE && c[o + s0 + span] > 0 && c[o + s0 + span] < 4) span++;
    if (span >= 5) {
      let best = 0;
      let bestScore = -99;
      let ones = 0;
      for (let len = 1; len <= span; len++) {
        if (c[o + s0 + len - 1] === 1) ones++;
        if (len < 5) continue;
        const score = ones - 1.5 * (len - ones) + 0.01 * len;
        if (score > bestScore) {
          bestScore = score;
          best = len;
        }
      }
      if (bestScore >= 3) {
        for (let i = 0; i < best; i++) c[o + s0 + i]--;
        uType = T_RUN;
        uStr = s0 + best - 1 + 3;
        uLen = best;
        return;
      }
    }
    c[o + s0]--;
    uType = T_SINGLE;
    uStr = s0 + 3;
    uLen = 1;
    return;
  }

  if (k === 2) {
    let g = 1;
    while (s0 + g <= SLOT_TWO && c[o + s0 + g] === 2) g++;
    if (g >= 2) {
      for (let i = 0; i < g; i++) c[o + s0 + i] = 0;
      uType = T_SISTERS;
      uStr = s0 + g - 1 + 3;
      uLen = 2 * g;
      uGs = 2;
      return;
    }
    c[o + s0] = 0;
    uType = T_PAIR;
    uStr = s0 + 3;
    uLen = 2;
    return;
  }

  // A triple: with a low pair it's a full house.
  for (let q = 0; q <= 10; q++) {
    if (q !== s0 && c[o + q] === 2) {
      c[o + s0] = 0;
      c[o + q] = 0;
      uType = T_FULL;
      uStr = s0 + 3;
      uLen = 5;
      return;
    }
  }
  c[o + s0] = 0;
  uType = T_TRIPLE;
  uStr = s0 + 3;
  uLen = 3;
}

const scratch = new Int8Array(SLOTS);

/**
 * A rough count of the turns it takes to empty a hand: its natural melds, less a share for the
 * cards that win the lead back (bombs, the Heart 5, jokers, 2s). Lower is better.
 */
export function handCost(c: ArrayLike<number>, o = 0): number {
  let total = 0;
  for (let s = 0; s < SLOTS; s++) {
    scratch[s] = c[o + s];
    total += scratch[s];
  }
  let cost = 0;
  let guard = 0;
  while (total > 0 && guard++ < 60) {
    lowestUnit(scratch, 0);
    if (uType === T_NONE) break;
    total -= uLen;
    if (uType === T_BOMB) cost += 0.2;
    else if (uType === T_SINGLE && uStr === 18) cost += 0.2;
    else if (uType === T_SINGLE && uStr >= 16) cost += 0.45;
    else if ((uType === T_SINGLE || uType === T_PAIR) && uStr === 15) cost += 0.6;
    else if (uType === T_SINGLE) cost += 1 + (14 - uStr) * 0.03;
    else cost += 1;
  }
  return cost;
}

function lead(sim: Sim, p: number, rnd: () => number, pp: PolicyParams): void {
  const c = sim.cnt;
  const o = p * SLOTS;
  const total = sim.left[p];

  if (wholeMeld(c, o, total)) {
    for (let s = 0; s < SLOTS; s++) c[o + s] = 0;
    commit(sim, p, wType, wStr, total, wGs);
    return;
  }

  // Two melds left and one of them takes the lead back: play that one first.
  if (c[o + SLOT_H5] && total > 1) {
    c[o + SLOT_H5] = 0;
    if (wholeMeld(c, o, total - 1)) {
      commit(sim, p, T_SINGLE, 18, 1, 0);
      return;
    }
    c[o + SLOT_H5] = 1;
  }
  if (total > 4) {
    for (let s = 0; s <= SLOT_TWO; s++) {
      if (c[o + s] !== 4) continue;
      c[o + s] = 0;
      if (wholeMeld(c, o, total - 4)) {
        commit(sim, p, T_BOMB, s + 3, 4, 0);
        return;
      }
      c[o + s] = 4;
    }
  }

  if (rnd() < pp.eps) {
    // Off-book: whatever group a random card belongs to.
    let pick = Math.floor(rnd() * total);
    for (let s = 0; s < SLOTS; s++) {
      const k = c[o + s];
      if (pick < k) {
        c[o + s] = 0;
        const type = k === 1 ? T_SINGLE : k === 2 ? T_PAIR : k === 3 ? T_TRIPLE : T_BOMB;
        commit(sim, p, type, k === 1 && s === SLOT_H5 ? 18 : s + 3, k, 0);
        return;
      }
      pick -= k;
    }
  }

  if (minOthers(sim, p) === 1) {
    // Somebody is down to one card: don't hand them the trick with a low single.
    for (let s = 0; s <= SLOT_TWO; s++) {
      const k = c[o + s];
      if (k === 2 || k === 3) {
        c[o + s] = 0;
        commit(sim, p, k === 2 ? T_PAIR : T_TRIPLE, s + 3, k, 0);
        return;
      }
    }
    for (let i = 0; i < SLOTS; i++) {
      const s = i === 0 ? SLOT_H5 : SLOT_H5 - i; // 15, 14, ... 0: strongest single first
      const k = c[o + s];
      if (!k) continue;
      if (k === 4) {
        c[o + s] = 0;
        commit(sim, p, T_BOMB, s + 3, 4, 0);
      } else {
        c[o + s]--;
        commit(sim, p, T_SINGLE, s === SLOT_H5 ? 18 : s + 3, 1, 0);
      }
      return;
    }
  }

  lowestUnit(c, o);
  commit(sim, p, uType, uStr, uLen, uGs);
}

function follow(sim: Sim, p: number, rnd: () => number, pp: PolicyParams): void {
  const c = sim.cnt;
  const o = p * SLOTS;
  const total = sim.left[p];
  const tStr = sim.tStr;
  const urgent = total <= 3 || minOthers(sim, p) <= 2;

  switch (sim.tType) {
    case T_SINGLE: {
      for (let s = 0; s <= SLOT_ACE; s++) {
        if (c[o + s] === 1 && s + 3 > tStr) {
          c[o + s] = 0;
          commit(sim, p, T_SINGLE, s + 3, 1, 0);
          return;
        }
      }
      if (urgent || rnd() < pp.premium) {
        for (let s = SLOT_TWO; s < SLOTS; s++) {
          const k = c[o + s];
          const str = s === SLOT_H5 ? 18 : s + 3;
          if (k > 0 && k < 4 && str > tStr) {
            c[o + s]--;
            commit(sim, p, T_SINGLE, str, 1, 0);
            return;
          }
        }
      }
      if (urgent || rnd() < pp.breakUp) {
        for (let s = 0; s <= SLOT_ACE; s++) {
          const k = c[o + s];
          if (k > 1 && k < 4 && s + 3 > tStr) {
            c[o + s]--;
            commit(sim, p, T_SINGLE, s + 3, 1, 0);
            return;
          }
        }
      }
      break;
    }
    case T_PAIR: {
      for (let s = 0; s <= SLOT_TWO; s++) {
        if (c[o + s] === 2 && s + 3 > tStr) {
          if (s >= SLOT_ACE && !urgent && rnd() >= pp.premium) break;
          c[o + s] = 0;
          commit(sim, p, T_PAIR, s + 3, 2, 0);
          return;
        }
      }
      if (urgent || rnd() < pp.breakUp) {
        for (let s = 0; s <= SLOT_TWO; s++) {
          if (c[o + s] === 3 && s + 3 > tStr) {
            c[o + s] = 1;
            commit(sim, p, T_PAIR, s + 3, 2, 0);
            return;
          }
        }
      }
      break;
    }
    case T_TRIPLE: {
      for (let s = 0; s <= SLOT_TWO; s++) {
        if (c[o + s] === 3 && s + 3 > tStr) {
          if (s >= SLOT_ACE && !urgent && rnd() >= pp.premium) break;
          c[o + s] = 0;
          commit(sim, p, T_TRIPLE, s + 3, 3, 0);
          return;
        }
      }
      break;
    }
    case T_FULL: {
      for (let s = 0; s <= SLOT_TWO; s++) {
        if (c[o + s] !== 3 || s + 3 <= tStr) continue;
        let q = -1;
        for (let r = 0; r <= SLOT_TWO; r++) {
          if (r !== s && c[o + r] === 2) {
            q = r;
            break;
          }
        }
        if (q < 0 && urgent) {
          for (let r = 0; r <= SLOT_TWO; r++) {
            if (r !== s && c[o + r] === 3) {
              q = r;
              break;
            }
          }
        }
        if (q < 0) continue;
        c[o + s] = 0;
        c[o + q] -= 2;
        commit(sim, p, T_FULL, s + 3, 5, 0);
        return;
      }
      break;
    }
    case T_SISTERS: {
      const gs = sim.tGs;
      const groups = sim.tLen / gs;
      for (let start = Math.max(0, tStr - groups - 1); start + groups - 1 <= SLOT_TWO; start++) {
        let ok = true;
        for (let i = 0; i < groups; i++) {
          const k = c[o + start + i];
          if (k < gs || k === 4) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        for (let i = 0; i < groups; i++) c[o + start + i] -= gs;
        commit(sim, p, T_SISTERS, start + groups - 1 + 3, sim.tLen, gs);
        return;
      }
      break;
    }
    case T_RUN: {
      const len = sim.tLen;
      for (let start = Math.max(0, tStr - len - 1); start + len - 1 <= SLOT_ACE; start++) {
        let ok = true;
        let broken = 0;
        for (let i = 0; i < len; i++) {
          const k = c[o + start + i];
          if (k < 1 || k === 4) {
            ok = false;
            break;
          }
          if (k > 1) broken++;
        }
        if (!ok) continue;
        if (broken > 1 && !urgent && rnd() >= pp.breakUp + 0.3) continue;
        for (let i = 0; i < len; i++) c[o + start + i]--;
        commit(sim, p, T_RUN, start + len - 1 + 3, len, 0);
        return;
      }
      break;
    }
    case T_BOMB: {
      for (let s = 0; s <= SLOT_TWO; s++) {
        if (c[o + s] === 4 && s + 3 > tStr && (urgent || rnd() < pp.bomb * 3)) {
          c[o + s] = 0;
          commit(sim, p, T_BOMB, s + 3, 4, 0);
          return;
        }
      }
      simPass(sim, p);
      return;
    }
  }

  // Nothing of the same kind (or not worth it): a bomb, when the moment calls for one.
  if (total >= 4) {
    for (let s = 0; s <= SLOT_TWO; s++) {
      if (c[o + s] === 4 && (urgent || total - 4 <= 4 || rnd() < pp.bomb)) {
        c[o + s] = 0;
        commit(sim, p, T_BOMB, s + 3, 4, 0);
        return;
      }
    }
  }
  simPass(sim, p);
}

/** One policy move for whoever's turn it is. */
export function policyMove(sim: Sim, rnd: () => number, pp: PolicyParams): void {
  const p = sim.turn;
  if (sim.tType === T_NONE) lead(sim, p, rnd, pp);
  else follow(sim, p, rnd, pp);
}

/**
 * Plays the game out with the policy until seat `me` is out or is the last one holding cards.
 * Returns the place `me` finishes in (1 = first out, n = last).
 */
export function rollout(sim: Sim, me: number, rnd: () => number, pp: PolicyParams): number {
  for (let guard = 0; guard < 4000; guard++) {
    if (sim.out[me]) return sim.place[me];
    if (simOver(sim)) return sim.n;
    policyMove(sim, rnd, pp);
  }
  return sim.n;
}

/** Plays the game out to the end, so every seat has a place. */
export function rolloutAll(sim: Sim, rnd: () => number, pp: PolicyParams): void {
  for (let guard = 0; guard < 4000 && !simOver(sim); guard++) policyMove(sim, rnd, pp);
}

/** The place a seat finished in after rolloutAll: the one still holding cards is last. */
export const placeOf = (sim: Sim, p: number): number => (sim.out[p] ? sim.place[p] : sim.n);

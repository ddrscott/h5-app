import { SLOTS } from './cards';
import { PASS_KEY, T_BOMB, T_NONE, beats, genMoves } from './moves';
import type { Move } from './moves';
import { placeOf, rolloutAll, simOver, simPass, simPlay } from './sim';
import type { PolicyParams, Sim } from './sim';

/**
 * The search tree under one of the bot's candidate moves. A plain playout lets the rule-of-thumb
 * player make every later decision, which caps how good the answer can get. The tree remembers
 * how the moves after the first one have turned out, for every seat, and steers later playouts
 * toward the ones that worked for whoever made them. More thinking time grows a deeper tree.
 *
 * It is information-set search: one tree is shared by all the imagined deals, a branch is only
 * followed in deals where that play is possible, and each seat picks by its own results.
 */
export interface Node {
  /** playouts through this node */
  n: number;
  /** total reward, for the seat that made the move leading here */
  w: number;
  /** how many times this move was possible when its parent was visited */
  avail: number;
  kids: Map<number, Node> | null;
}

export const newNode = (): Node => ({ n: 0, w: 0, avail: 0, kids: null });

const EXPLORE = 0.7;
const MAX_NODES = 250_000;

/** Which untried move to try first: roughly what a sensible player would reach for. */
function appeal(m: Move, leading: boolean): number {
  if (m.type === T_BOMB) return -60 - m.str;
  if (!leading) return -m.str;
  let low = 99;
  for (let i = 0; i < m.slots.length; i++) if (m.slots[i] < low) low = m.slots[i];
  return -low + 0.3 * m.len;
}

export class Tree {
  private nodes = 0;
  private pathNodes: Node[] = [];
  private pathSeats: number[] = [];

  constructor(private me: number, private values: Float64Array, private policy: PolicyParams) {}

  /**
   * One playout from `sim` (the table right after the candidate move that `root` stands for):
   * down the tree while it knows the way, one new node, then the policy to the end.
   * Returns what the result is worth to the bot.
   */
  run(root: Node, sim: Sim, rnd: () => number): number {
    const { me, pathNodes, pathSeats } = this;
    pathNodes.length = 0;
    pathSeats.length = 0;
    let cur = root;

    while (!simOver(sim) && !sim.out[me]) {
      const p = sim.turn;
      const leading = sim.tType === T_NONE;
      if (!cur.kids) cur.kids = new Map();
      const kids = cur.kids;
      // Widen slowly: a few moves at first, more as the node is visited.
      const limit = 2 + Math.floor(1.5 * Math.sqrt(cur.n));

      let tried = 0;
      let best: Node | null = null;
      let bestMove: Move | null = null;
      let bestScore = -Infinity;
      let fresh: Move | null | undefined; // undefined: nothing untried; null: the pass
      let freshScore = -Infinity;

      if (!leading) {
        const child = kids.get(PASS_KEY);
        if (child) {
          tried++;
          child.avail++;
          best = child;
          bestScore = child.w / child.n + EXPLORE * Math.sqrt(Math.log(child.avail) / child.n);
        } else {
          fresh = null;
          freshScore = -(sim.tStr + 2.5);
        }
      }
      for (const m of genMoves(sim.cnt, p * SLOTS)) {
        if (!beats(m, sim.tType, sim.tStr, sim.tLen, sim.tGs)) continue;
        const child = kids.get(m.key);
        if (child) {
          tried++;
          child.avail++;
          const score = child.w / child.n + EXPLORE * Math.sqrt(Math.log(child.avail) / child.n);
          if (score > bestScore) {
            bestScore = score;
            best = child;
            bestMove = m;
          }
        } else {
          const score = appeal(m, leading);
          if (score > freshScore) {
            freshScore = score;
            fresh = m;
          }
        }
      }

      let next: Node;
      let move: Move | null;
      let grew = false;
      if (fresh !== undefined && (tried < limit || !best) && this.nodes < MAX_NODES) {
        next = newNode();
        next.avail = 1;
        kids.set(fresh ? fresh.key : PASS_KEY, next);
        this.nodes++;
        move = fresh;
        grew = true;
      } else if (best) {
        next = best;
        move = bestMove;
      } else {
        break;
      }

      if (move) simPlay(sim, p, move);
      else simPass(sim, p);
      pathNodes.push(next);
      pathSeats.push(p);
      cur = next;
      if (grew) break;
    }

    rolloutAll(sim, rnd, this.policy);
    root.n++;
    for (let i = 0; i < pathNodes.length; i++) {
      pathNodes[i].n++;
      pathNodes[i].w += this.values[placeOf(sim, pathSeats[i])];
    }
    return this.values[placeOf(sim, me)];
  }
}

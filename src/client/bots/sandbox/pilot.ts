import type { Room } from '../../net/rooms';
import type { Card, Meld } from '../../types/game';
import type { BotMove, BotView } from './contract';
import { BotSandbox, DEFAULT_BUDGET_MS, clampBudget } from './BotSandbox';
import { checkMove, fallbackMove, legalMoves } from './moves';

/** Timeouts and crashes allowed in one game before the bot is benched. */
export const MAX_STRIKES = 3;
/** A bot that answers instantly still waits this long, so people can follow the play. */
const MIN_TURN_MS = 700;

export interface PilotStatus {
  enabled: boolean;
  thinking: boolean;
  strikes: number;
  /** The latest thing worth telling the player ("too slow, passed for it"). */
  note: string | null;
}

export interface PilotOptions {
  budgetMs?: number;
  /** Labels the seat for the table (room "autopilot" message). Off for a seat that is a bot anyway. */
  announce?: boolean;
  /** Called when the bot struck out, after the pilot turned itself off. */
  onStrikeOut?: (why: string) => void;
}

type AnyState = {
  phase?: string;
  currentTurnPlayerId?: string | null;
  leadPlayerId?: string | null;
  currentMeld?: Meld | null;
  turnOrder?: string[];
  players?: Map<string, { id: string; name: string; handCount: number; isOut: boolean; hasPassed: boolean }>;
};

const codes = (cards: Array<{ code?: string }>) => cards.map((c) => c.code ?? '');

/** Builds the view a bot gets: only what the human in this seat can see. */
export function buildView(state: AnyState, me: string, hand: Card[], history: BotView['history'], budgetMs: number): BotView {
  const table = state.currentMeld && state.currentMeld.cards?.length ? state.currentMeld : null;
  const order = state.turnOrder?.length ? state.turnOrder : [...(state.players?.keys() ?? [])];
  const sorted = [...hand].sort((a, b) => a.rank - b.rank || a.suit.localeCompare(b.suit));
  return {
    me,
    hand: codes(sorted),
    legalMoves: legalMoves(sorted, table),
    table: table ? { cards: codes(table.cards), type: String(table.type), by: table.playerId } : null,
    players: order.flatMap((id) => {
      const p = state.players?.get(id);
      return p ? [{ id, name: p.name, cards: p.handCount, out: !!p.isOut, passed: !!p.hasPassed }] : [];
    }),
    history: history.map((h) => ({ ...h })),
    timeBudgetMs: clampBudget(budgetMs),
  };
}

/**
 * Plays one seat with an uploaded bot. It listens to the same room the seat's owner uses, asks
 * the sandboxed bot for a move on each of the seat's turns, checks the answer against the legal
 * moves, and sends an ordinary play or pass. The server still referees.
 */
export class SeatPilot {
  private sandbox: BotSandbox | null = null;
  private botName: string | null = null;
  private hand: Card[] = [];
  private history: BotView['history'] = [];
  /** Bumps on every play, pass, and new trick or game, so each turn is handled once. */
  private tick = 0;
  private handledTurn: string | null = null;
  private sentTurn: string | null = null;
  private fellBack: string | null = null;
  private offs: Array<() => void> = [];
  private listeners = new Set<(s: PilotStatus) => void>();
  private status: PilotStatus = { enabled: false, thinking: false, strikes: 0, note: null };
  private readonly budgetMs: number;

  constructor(private readonly room: Room, private readonly me: string, private readonly opts: PilotOptions = {}) {
    this.budgetMs = clampBudget(opts.budgetMs ?? DEFAULT_BUDGET_MS);
    this.offs.push(
      room.onMessage('your_hand', ({ cards }: { cards: Card[] }) => { this.hand = Array.isArray(cards) ? cards : []; this.check(); }),
      room.onMessage('game_started', () => {
        this.history = [];
        this.tick++;
        this.set({ strikes: 0 });
      }),
      room.onMessage('meld_played', (d: { playerId: string; cards: string[] }) => {
        this.history.push({ by: d.playerId, cards: [...(d.cards ?? [])] });
        this.tick++;
      }),
      room.onMessage('player_passed', (d: { playerId: string }) => {
        this.history.push({ by: d.playerId, pass: true });
        this.tick++;
      }),
      room.onMessage('new_leader', () => { this.tick++; }),
      room.onMessage('error', () => this.onRefused()),
      room.onStateChange(() => this.check()),
      room.onConnection((s) => { if (s === 'connected' && this.status.enabled) this.announce(); }),
    );
  }

  subscribe(fn: (s: PilotStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => { this.listeners.delete(fn); };
  }

  getStatus() { return this.status; }

  /** Swaps the bot that plays the seat (null for none). Turns autoplay off when the bot goes away. */
  setBot(bot: { name: string; code: string } | null) {
    this.sandbox?.destroy();
    this.sandbox = bot ? new BotSandbox(bot.code) : null;
    if (this.sandbox) this.sandbox.onLog = (text) => console.info(`[bot ${bot!.name}]`, text);
    this.botName = bot?.name ?? null;
    if (!bot && this.status.enabled) this.setEnabled(false);
    else if (this.status.enabled) { this.announce(); this.preload(); }
  }

  /** Loads the bot ahead of its first turn, so a broken script shows up right away. */
  private preload() {
    const sandbox = this.sandbox;
    sandbox?.start().catch((err) => { if (sandbox === this.sandbox) this.set({ note: `${this.botName} didn't load: ${err.message}` }); });
  }

  setEnabled(on: boolean) {
    if (on && !this.sandbox) return;
    if (on) this.preload();
    this.set({ enabled: on, note: null, thinking: false });
    // a turn we already answered stays answered; one abandoned mid-think gets another go
    if (this.sentTurn !== this.turnKey()) this.handledTurn = null;
    this.announce();
    if (on) this.check();
  }

  dispose() {
    this.offs.forEach((off) => off());
    this.offs = [];
    this.sandbox?.destroy();
    this.sandbox = null;
    this.listeners.clear();
  }

  private announce() {
    if (this.opts.announce === false) return;
    this.room.send('autopilot', { name: this.status.enabled ? this.botName : null });
  }

  private set(patch: Partial<PilotStatus>) {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach((fn) => fn(this.status));
  }

  private get state(): AnyState { return (this.room.state ?? {}) as AnyState; }

  private turnKey() { return `${this.tick}:${this.state.currentTurnPlayerId}`; }

  private myTurn() {
    const s = this.state;
    return s.phase === 'PLAYING' && s.currentTurnPlayerId === this.me;
  }

  private table(): Meld | null {
    const m = this.state.currentMeld;
    return m && m.cards?.length ? m : null;
  }

  private check() {
    if (!this.status.enabled || !this.sandbox || !this.myTurn() || this.hand.length === 0) return;
    const key = this.turnKey();
    if (this.handledTurn === key) return;
    this.handledTurn = key;
    void this.takeTurn(key);
  }

  private async takeTurn(key: string) {
    const sandbox = this.sandbox!;
    const hand = this.hand.slice();
    const table = this.table();
    const view = buildView(this.state, this.me, hand, this.history, this.budgetMs);
    const started = performance.now();
    this.set({ thinking: true });
    const result = await sandbox.decide(view, this.budgetMs);
    if (sandbox !== this.sandbox) return; // bot swapped mid-think

    let move: BotMove | null = null;
    let note: string | null = null;
    let strike = false;
    if (result.kind === 'move') {
      move = checkMove(result.move, hand, table);
      if (!move) note = `${this.botName} answered ${JSON.stringify(result.move)?.slice(0, 80)}, which isn't a legal move, so it ${table ? 'passed' : 'led its lowest card'}.`;
    } else if (result.kind === 'timeout') {
      strike = true;
      note = `${this.botName} ran past its ${(this.budgetMs / 1000).toFixed(1)}s limit and was stopped`;
    } else {
      strike = true;
      note = `${this.botName} hit an error: ${result.message}`;
    }
    const strikes = this.status.strikes + (strike ? 1 : 0);
    if (strike) note += `. Strike ${strikes} of ${MAX_STRIKES}.`;
    move ??= fallbackMove(hand, table);

    const wait = MIN_TURN_MS - (performance.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.set({ thinking: false, strikes, ...(note ? { note } : {}) });

    if (strikes >= MAX_STRIKES && strike) {
      const why = `${this.botName} struck out (${MAX_STRIKES} timeouts or crashes this game), so you have your seat back.`;
      // still answer this turn, with the safe move, so the table doesn't wait
      if (this.myTurn() && this.turnKey() === key) this.send(key, fallbackMove(hand, table));
      this.setEnabled(false);
      this.set({ note: why });
      this.opts.onStrikeOut?.(why);
      return;
    }
    if (!this.status.enabled || !this.myTurn() || this.turnKey() !== key) return; // the human moved, or took over
    this.send(key, move);
  }

  private send(key: string, move: BotMove) {
    this.sentTurn = key;
    if ('pass' in move) this.room.send('pass');
    else this.room.send('play', { cards: move.cards });
  }

  /** The server turned down what we sent (it shouldn't): play the safe move instead, once per turn. */
  private onRefused() {
    const key = this.turnKey();
    if (this.sentTurn !== key || this.fellBack === key || !this.myTurn()) return;
    this.fellBack = key;
    this.send(key, fallbackMove(this.hand, this.table()));
  }
}

import type { BotView } from '../contract';
import { FRAME_HTML, PRELUDE_LINES, workerSource } from './frame';

/** How long a bot gets per move unless told otherwise. */
export const DEFAULT_BUDGET_MS = 2000;
/** No move ever gets longer than this, well under the server's 30s turn timer. */
export const HARD_CAP_MS = 5000;
/** How long a bot's script may take to load before it's stopped. */
export const LOAD_TIMEOUT_MS = 5000;
/** Largest script we'll run. */
export const MAX_SCRIPT_BYTES = 200 * 1024;

export type DecideResult =
  | { kind: 'move'; move: unknown; ms: number }
  | { kind: 'timeout'; ms: number }
  | { kind: 'error'; message: string };

export const clampBudget = (ms: number) => Math.max(100, Math.min(HARD_CAP_MS, Math.round(ms) || DEFAULT_BUDGET_MS));

/**
 * Runs one uploaded bot in a Web Worker inside a sandboxed, opaque-origin iframe (see frame.ts for
 * what that blocks). The app talks to it only with postMessage and JSON. A move that runs past its
 * budget gets the worker terminated and the iframe thrown away; the next decide() starts a fresh one.
 */
export class BotSandbox {
  private frame: HTMLIFrameElement | null = null;
  private onMessage: ((e: MessageEvent) => void) | null = null;
  private starting: Promise<void> | null = null;
  private live = false;
  private nextId = 1;
  private pending = new Map<number, (r: DecideResult) => void>();

  /** console.log output from the bot, for the player's devtools. */
  onLog: ((text: string) => void) | null = null;

  constructor(private readonly code: string) {}

  /** Loads the bot. Rejects with a readable message when it won't load (syntax error, no decide, too slow). */
  start(): Promise<void> {
    if (this.live) return Promise.resolve();
    if (this.starting) return this.starting;
    this.starting = new Promise<void>((resolve, reject) => {
      const frame = document.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.setAttribute('aria-hidden', 'true');
      frame.title = 'Bot sandbox';
      frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden;pointer-events:none';
      frame.srcdoc = FRAME_HTML;

      let settled = false;
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        this.kill();
        reject(new Error(message));
      };
      const timer = window.setTimeout(() => fail(`The bot took longer than ${LOAD_TIMEOUT_MS / 1000}s to load, so it was stopped.`), LOAD_TIMEOUT_MS);

      this.onMessage = (e: MessageEvent) => {
        if (!this.frame || e.source !== this.frame.contentWindow) return;
        const m = e.data;
        if (!m || typeof m !== 'object') return;
        switch (m.type) {
          case 'frame-ready':
            this.frame.contentWindow?.postMessage({ type: 'load', source: workerSource(this.code) }, '*');
            break;
          case 'ready':
            clearTimeout(timer);
            if (m.ok) {
              settled = true;
              this.live = true;
              resolve();
            } else {
              fail(String(m.error ?? 'The bot did not load.'));
            }
            break;
          case 'move':
          case 'error': {
            const done = this.pending.get(m.id);
            if (!done) break;
            this.pending.delete(m.id);
            done(m.type === 'move' ? { kind: 'move', move: m.move, ms: 0 } : { kind: 'error', message: String(m.message) });
            break;
          }
          case 'crash': {
            const line = Number(m.line) > PRELUDE_LINES ? ` (line ${Number(m.line) - PRELUDE_LINES})` : '';
            const message = `${String(m.message)}${line}`;
            clearTimeout(timer);
            if (!settled) { fail(message); break; }
            this.kill(message);
            break;
          }
          case 'log':
            this.onLog?.(String(m.text));
            break;
        }
      };
      window.addEventListener('message', this.onMessage);
      this.frame = frame;
      document.body.appendChild(frame);
    }).finally(() => { this.starting = null; });
    return this.starting;
  }

  /** Asks the bot for a move. Never throws; a slow bot is terminated and comes back fresh next time. */
  async decide(view: BotView, budgetMs = view.timeBudgetMs): Promise<DecideResult> {
    try {
      await this.start();
    } catch (err) {
      return { kind: 'error', message: err instanceof Error ? err.message : String(err) };
    }
    const budget = clampBudget(budgetMs);
    const id = this.nextId++;
    const t0 = performance.now();
    return new Promise<DecideResult>((resolve) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        this.kill();
        resolve({ kind: 'timeout', ms: Math.round(performance.now() - t0) });
      }, budget);
      this.pending.set(id, (r) => {
        clearTimeout(timer);
        resolve(r.kind === 'move' ? { ...r, ms: Math.round(performance.now() - t0) } : r);
      });
      this.frame?.contentWindow?.postMessage({ type: 'decide', id, view: { ...view, timeBudgetMs: budget } }, '*');
    });
  }

  /** Terminates the worker and drops the frame. Anything waiting gets an error. */
  private kill(reason = 'The bot was stopped.') {
    // The frame calls worker.terminate(); dropping the frame a moment later ends anything left.
    const frame = this.frame;
    frame?.contentWindow?.postMessage({ type: 'kill' }, '*');
    if (frame) window.setTimeout(() => frame.remove(), 50);
    if (this.onMessage) window.removeEventListener('message', this.onMessage);
    this.onMessage = null;
    this.frame = null;
    this.live = false;
    const waiting = [...this.pending.values()];
    this.pending.clear();
    waiting.forEach((done) => done({ kind: 'error', message: reason }));
  }

  destroy() {
    this.kill();
  }
}

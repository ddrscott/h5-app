import React, { useEffect, useState } from 'react';
import { BotSandbox } from '../../bots/sandbox/BotSandbox';
import type { DecideResult } from '../../bots/sandbox/BotSandbox';
import { sampleTurn } from '../bots/testRun';
import starter from '../../bots/sandbox/examples/starter-bot.js?raw';
import escape from '../../bots/sandbox/examples/escape-bot.js?raw';
import timeout from '../../bots/sandbox/examples/timeout-bot.js?raw';
import slowStart from '../../bots/sandbox/examples/slow-start-bot.js?raw';

const EXAMPLES: Record<string, string> = { starter, escape, timeout, 'slow-start': slowStart };

interface LabRun { result: DecideResult; logs: string[]; wallMs: number; mainThreadTicks: number }

/**
 * Runs one bot on a sample turn, twice in a row, in a fresh sandbox, and records its console
 * output. The second turn shows a bot that was stopped comes back fresh. While it runs, a timer on
 * the page counts ticks, which shows a spinning bot doesn't freeze the page.
 */
async function run(code: string, budgetMs = 2000, turns = 1): Promise<LabRun[]> {
  const out: LabRun[] = [];
  const sandbox = new BotSandbox(code);
  const logs: string[] = [];
  sandbox.onLog = (t) => logs.push(t);
  try {
    for (let i = 0; i < turns; i++) {
      let ticks = 0;
      const timer = window.setInterval(() => ticks++, 50);
      const t0 = performance.now();
      const result = await sandbox.decide(sampleTurn(i % 2 === 1).view, budgetMs);
      clearInterval(timer);
      // logs arrive just ahead of the answer; give stragglers a beat
      await new Promise((r) => setTimeout(r, 50));
      out.push({ result, logs: logs.splice(0), wallMs: Math.round(performance.now() - t0), mainThreadTicks: ticks });
    }
  } finally {
    sandbox.destroy();
  }
  return out;
}

declare global {
  interface Window { __botLab?: { run: typeof run; examples: Record<string, string>; frames: () => number } }
}

/** /h5/botlab: a page for trying the bot sandbox by hand and from scripts/smoke-bot-sandbox.mjs. */
export const BotLab: React.FC = () => {
  const [name, setName] = useState('starter');
  const [code, setCode] = useState(EXAMPLES.starter);
  const [budget, setBudget] = useState(2000);
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState<LabRun[]>([]);

  useEffect(() => {
    window.__botLab = { run, examples: EXAMPLES, frames: () => document.querySelectorAll('iframe[sandbox]').length };
    return () => { delete window.__botLab; };
  }, []);

  const go = async () => {
    setBusy(true);
    setRuns(await run(code, budget, 2));
    setBusy(false);
  };

  return (
    <div className="min-h-dvh felt-texture p-4 sm:p-8 text-bone">
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <p className="section-head">Lab</p>
          <h1 className="font-display text-3xl font-black text-paper">Bot sandbox</h1>
          <p className="text-sm text-gray-300 mt-1">Runs a bot on two sample turns (following a single 8, then leading) in a fresh sandbox.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.keys(EXAMPLES).map((k) => (
            <button key={k} className={k === name ? 'btn-primary' : 'btn-secondary'} onClick={() => { setName(k); setCode(EXAMPLES[k]); setRuns([]); }}>{k}</button>
          ))}
        </div>
        <textarea className="field bot-code-input h-64" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} aria-label="Bot code" />
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-300">Budget (ms) <input className="field w-28 inline-block ml-2" type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} /></label>
          <button className="btn-primary" disabled={busy} onClick={go}>{busy ? 'Running…' : 'Run'}</button>
        </div>
        {runs.map((r, i) => (
          <div key={i} className="panel p-3 text-sm space-y-1" data-testid="lab-run">
            <p><b>Turn {i + 1}:</b> {r.result.kind === 'move' ? `answered ${JSON.stringify(r.result.move)} in ${r.result.ms} ms` : r.result.kind === 'timeout' ? `stopped after ${r.result.ms} ms` : `error: ${r.result.message}`}</p>
            <p className="text-mist">Page timer kept ticking: {r.mainThreadTicks} ticks in {r.wallMs} ms.</p>
            {r.logs.length > 0 && <pre className="bot-code">{r.logs.join('\n')}</pre>}
          </div>
        ))}
      </div>
    </div>
  );
};

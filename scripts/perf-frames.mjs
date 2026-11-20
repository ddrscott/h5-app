#!/usr/bin/env node
/**
 * Frame times while cards fly to the pile, headless. A requestAnimationFrame logger runs in the
 * page, and each moment (a single, a five-card run, a full house, a bomb, the Heart 5) is played in
 * the FX lab on a fresh deal, at normal speed and with the CPU throttled 4x through CDP
 * (Emulation.setCPUThrottlingRate) to stand in for a car or a phone. With `table` it also records
 * a real game against three built-in bots for a while.
 *
 * Prints p50/p95/max frame time and dropped frames (every frame past one 60Hz interval that a gap
 * swallowed) per moment. Repeats each lab moment REPS times (default 3) and keeps the run with the
 * median dropped count, since one stray GC or a busy dev server can swing a single run. Pass --json to get the rows as JSON, and --trace=dir to save a Chrome
 * performance trace (CDP Tracing) of each lab moment.
 *
 *   [GPU=1] [REPS=3] node scripts/perf-frames.mjs [http://localhost:5173] [1920x1080] [lab|table|both] [--json] [--trace=/tmp/tr]
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const APP = (args[0] || 'http://localhost:5173').replace(/\/$/, '');
const [W, H] = (args[1] || '1920x1080').split('x').map(Number);
const MODE = args[2] || 'both';
const JSON_OUT = flags.includes('--json');
const TRACE = flags.find((f) => f.startsWith('--trace='))?.slice(8);
if (TRACE) mkdirSync(TRACE, { recursive: true });

async function loadPlaywright() {
  try { return await import('playwright'); } catch {
    const root = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(join(root, 'playwright', 'index.mjs')).href);
  }
}

const MOMENTS = [
  ['single', 'Cy: single'],
  ['run5', 'Cy: straight'],
  ['fullhouse', 'Ann: full house'],
  ['bomb', 'Ann: BOMB'],
  ['heart5', 'Cy: Heart 5'],
];
const FRAME = 1000 / 60;

function stats(ts) {
  const d = [];
  for (let i = 1; i < ts.length; i++) d.push(ts[i] - ts[i - 1]);
  if (!d.length) return { frames: 0, p50: 0, p95: 0, max: 0, dropped: 0, long: 0 };
  const s = [...d].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  // vsync'd: a gap of 2 intervals dropped 1 frame, and so on (jitter under 1.5 intervals is none).
  // free-running (GPU=1): every 16.7ms a frame took past the first is a 60Hz frame missed.
  const dropped = d.reduce((n, x) => n + (GPU ? (x > FRAME ? Math.ceil(x / FRAME) - 1 : 0) : x > FRAME * 1.5 ? Math.round(x / FRAME) - 1 : 0), 0);
  return { frames: d.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +s[s.length - 1].toFixed(1), dropped, long: d.filter((x) => x > 50).length };
}

const LOGGER = () => {
  window.__ft = { on: false, ts: [] };
  const tick = (t) => { if (window.__ft.on) window.__ft.ts.push(t); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
};

const { chromium } = await loadPlaywright();
// Two ways to run it:
//  - default: the headless shell, which composites in software at a 120Hz vsync. Compositing cost
//    grows with screen area and layer count, so it stands in for a weak GPU (a car, an old phone).
//  - GPU=1: real Chrome headless with GPU compositing and vsync off, so requestAnimationFrame
//    free-runs and each frame's time is what that frame really cost (about 1ms idle). A frame
//    over 16.7ms here would miss a 60Hz display.
const GPU = !!process.env.GPU;
const browser = await chromium.launch({
  headless: true,
  channel: GPU ? 'chrome' : undefined,
  args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', ...(GPU ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [])],
});
const rows = [];
const runs = [];
const REPS = Number(process.env.REPS || 3);

async function record(page, cdp, ms, act, traceName) {
  if (TRACE && traceName) {
    await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,blink,cc,gpu,viz', transferMode: 'ReturnAsStream' });
  }
  await page.evaluate(() => { window.__ft.ts = []; window.__ft.on = true; });
  await act();
  await page.waitForTimeout(ms);
  const ts = await page.evaluate(() => { window.__ft.on = false; return window.__ft.ts; });
  if (TRACE && traceName) {
    const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
    await cdp.send('Tracing.end');
    const { stream } = await done;
    let data = '';
    for (;;) { const c = await cdp.send('IO.read', { handle: stream }); data += c.data; if (c.eof) break; }
    await cdp.send('IO.close', { handle: stream });
    writeFileSync(join(TRACE, `${traceName}.json`), data);
  }
  return stats(ts);
}

if (MODE === 'lab' || MODE === 'both') {
  for (const rate of [1, 4]) {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const cdp = await page.context().newCDPSession(page);
    await page.addInitScript(LOGGER);
    for (const [name, step] of MOMENTS) for (let rep = 0; rep < REPS; rep++) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await page.goto(`${APP}/h5/animation`);
      await page.waitForFunction(() => window.__lab);
      await page.getByText('hide panel').click();
      const lab = (s) => page.evaluate((k) => window.__lab[k](), s);
      await lab('Deal');
      await page.waitForTimeout(2200);
      await lab('Ann: pair');
      // let the pair's callout come and go, so the idle sample really is idle
      await page.waitForTimeout(2600);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await page.waitForTimeout(300);
      // idle baseline, then the moment: flight, landing, callout and any finisher frame
      const idle = await record(page, cdp, 600, async () => {});
      const r = await record(page, cdp, name === 'bomb' || name === 'heart5' ? 2200 : 1600, () => lab(step), rep === 0 ? `${name}-x${rate}` : null);
      runs.push({ where: 'lab', moment: name, cpu: `${rate}x`, ...r, idleP95: idle.p95 });
      if (rep === REPS - 1) {
        const mine = runs.filter((x) => x.moment === name && x.cpu === `${rate}x`).sort((a, b) => a.dropped - b.dropped);
        rows.push({ ...mine[mine.length >> 1], spread: mine.map((x) => x.dropped).join('/') });
      }
    }
    await page.close();
  }
}

if (MODE === 'table' || MODE === 'both') {
  for (const rate of [1, 4]) {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const cdp = await page.context().newCDPSession(page);
    await page.addInitScript(LOGGER);
    await page.goto(`${APP}/h5/play`);
    await page.waitForSelector('input[placeholder="Enter your name"]');
    await page.fill('input[placeholder="Enter your name"]', 'Scott');
    await page.click('button:has-text("Create New Room")');
    await page.waitForURL(/room=/);
    await page.waitForTimeout(800);
    for (let i = 0; i < 3; i++) { await page.click('button:has-text("Add Bot")'); await page.waitForTimeout(700); }
    await page.click('button:has-text("Start Game")');
    await page.waitForTimeout(3000);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    // Play along for 20s: pass when we can, else lead the top card. Frames are logged throughout,
    // so this is bots' plays, our plays, sweeps and the bots thinking on the same thread.
    await page.evaluate(() => { window.__ft.ts = []; window.__ft.on = true; });
    const end = Date.now() + 20000;
    let plays = 0;
    while (Date.now() < end) {
      const mine = await page.isVisible('text=/^(Your lead|Your turn)$/i').catch(() => false);
      if (mine) {
        const pass = page.locator('button[title="Pass (P)"]');
        if (await pass.isEnabled()) await pass.click();
        else {
          await page.locator('[data-card]').last().click({ force: true, timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(120);
          await page.locator('button[title="Play (Enter)"]').click({ timeout: 3000 }).catch(() => {});
        }
        plays++;
      }
      await page.waitForTimeout(400);
    }
    const ts = await page.evaluate(() => { window.__ft.on = false; return window.__ft.ts; });
    rows.push({ where: 'table', moment: `20s game (${plays} turns)`, cpu: `${rate}x`, ...stats(ts), idleP95: null });
    await page.close();
  }
}

await browser.close();
if (JSON_OUT) console.log(JSON.stringify(rows));
else {
  console.log(`${W}x${H}  ${GPU ? 'GPU compositing, frames free-running' : 'software compositing, 120Hz vsync'}`);
  console.log('where  moment                 cpu  frames  p50   p95   max    dropped  >50ms  idle-p95  dropped per run');
  for (const r of rows) {
    console.log(`${r.where.padEnd(6)} ${r.moment.padEnd(22)} ${r.cpu.padEnd(4)} ${String(r.frames).padStart(6)}  ${String(r.p50).padStart(4)}  ${String(r.p95).padStart(4)}  ${String(r.max).padStart(5)}  ${String(r.dropped).padStart(7)}  ${String(r.long).padStart(5)}  ${String(r.idleP95 ?? '').padEnd(8)}  ${r.spread ?? ''}`);
  }
}

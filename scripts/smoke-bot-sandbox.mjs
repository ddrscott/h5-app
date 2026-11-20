#!/usr/bin/env node
// Checks the bring-your-own-bot sandbox in real browsers: the escape bot can't reach the network,
// storage, or the page; the timeout bot is stopped on time and comes back fresh; a bot that never
// finishes loading is stopped; crashes and syntax errors are reported; the starter bot answers.
//
//   node scripts/smoke-bot-sandbox.mjs http://localhost:5173 [chromium,firefox,webkit]
//
// Needs Playwright (npm i -g playwright, or in this project) and `npm run dev` running.
import http from 'node:http';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const APP = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '');
const ENGINES = (process.argv[3] || 'chromium,firefox,webkit').split(',');

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const root = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(join(root, 'playwright', 'index.mjs')).href);
  }
}

// A server that answers anything from any origin, and counts the requests that reach it.
let hits = 0;
const bait = http.createServer((req, res) => {
  hits++;
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('content-type', req.url.endsWith('.js') ? 'text/javascript' : 'text/plain');
  res.end(req.url.endsWith('.js') ? 'self.escaped = true;' : 'you got out');
});
await new Promise((r) => bait.listen(0, '127.0.0.1', r));
const TARGET = `http://127.0.0.1:${bait.address().port}/`;

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}`);
  if (!ok) failures++;
};

const pw = await loadPlaywright();
for (const engine of ENGINES) {
  console.log(`\n${engine}`);
  const browser = await pw[engine].launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${APP}/h5/botlab`);
  await page.waitForFunction(() => !!window.__botLab);
  const run = (code, budget, turns) => page.evaluate(([c, b, t]) => window.__botLab.run(c, b, t), [code, budget, turns]);
  const example = (name) => page.evaluate((n) => window.__botLab.examples[n], name);

  // 1. escape attempts
  hits = 0;
  const escapeCode = (await example('escape'))
    .replace('const TARGET = "https://example.com/"', `const TARGET = "${TARGET}"`)
    .replace('const APP = "https://example.com/"', `const APP = "${APP}/"`);
  const [esc] = await run(escapeCode, 5000, 1);
  const logs = esc.logs.join('\n');
  check(esc.result.kind === 'move', `escape bot still answered (${esc.result.kind})`);
  for (const what of ['fetch', 'XMLHttpRequest', 'WebSocket', 'importScripts', 'new Worker', 'eval', 'localStorage', 'indexedDB', 'document']) {
    const line = esc.logs.find((l) => l.startsWith(`blocked ${what}:`) || l.startsWith(`ESCAPED ${what}`));
    check(!!line && line.startsWith('blocked'), `${what} blocked${line ? ` (${line.slice(line.indexOf(':') + 2, line.indexOf(':') + 70)})` : ' — no report'}`);
  }
  check(!logs.includes('ESCAPED'), 'nothing escaped');
  check(logs.includes('origin null'), 'bot runs in an opaque origin');
  check(hits === 0, `no request reached the open server (${hits} hits)`);

  // 2. infinite loop in decide(): stopped on time, twice, page stays live
  const t0 = Date.now();
  const loops = await run(await example('timeout'), 500, 2);
  const took = Date.now() - t0;
  check(loops.every((r) => r.result.kind === 'timeout'), `timeout bot stopped both turns (${loops.map((r) => r.result.kind + ' ' + r.result.ms + 'ms').join(', ')})`);
  check(loops.every((r) => r.result.ms < 900), 'each stop came within 900ms of a 500ms budget');
  check(loops.every((r) => r.mainThreadTicks >= 2), `the page kept running meanwhile (${loops.map((r) => r.mainThreadTicks).join(', ')} timer ticks)`);
  check(took < 8000, `two turns of a looping bot took ${took}ms in all (it restarts fresh each turn)`);
  // the default cap: a budget over 5s is clamped
  const capped = await run(await example('timeout'), 60_000, 1);
  check(capped[0].result.kind === 'timeout' && capped[0].result.ms < 5600, `a 60s budget is capped at 5s (stopped at ${capped[0].result.ms}ms)`);

  // 3. never finishes loading
  const s0 = Date.now();
  const [slow] = await run(await example('slow-start'), 2000, 1);
  check(slow.result.kind === 'error' && /longer than 5s to load/.test(slow.result.message), `slow-start bot stopped while loading (${slow.result.message ?? slow.result.kind}, ${Date.now() - s0}ms)`);

  // 4. crashes and junk
  const [boom] = await run('function decide() { throw new Error("boom"); }', 2000, 1);
  check(boom.result.kind === 'error' && boom.result.message.includes('boom'), `a throwing bot is reported (${boom.result.message})`);
  const [syntax] = await run('function decide(view) {\n  return {cards: [\n}', 2000, 1);
  check(syntax.result.kind === 'error', `a syntax error is reported (${syntax.result.message})`);
  const [none] = await run('const x = 1;', 2000, 1);
  check(none.result.kind === 'error' && /No decide/.test(none.result.message), 'a script with no decide() is reported');

  // 5. the starter bot answers both turns
  const starter = await run(await example('starter'), 2000, 2);
  check(starter.every((r) => r.result.kind === 'move' && r.result.move && Array.isArray(r.result.move.cards)),
    `starter bot answers (${starter.map((r) => JSON.stringify(r.result.move)).join(', ')})`);

  await page.waitForTimeout(600);
  check((await page.evaluate(() => window.__botLab.frames())) === 0, 'every sandbox frame was cleaned up');
  check(pageErrors.length === 0, `no page errors${pageErrors.length ? ': ' + pageErrors.join('; ') : ''}`);
  await browser.close();
}

bait.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);

#!/usr/bin/env node
/**
 * Screenshots of the center pile in the FX lab: a pair and a triple on the table, then the newest
 * meld on top, at square (car-like), desktop, tablet and phone sizes. Prints the newest meld's
 * on-screen card width, how much of each card's corner shows, and whether it runs under the hand,
 * the buttons or a seat's plate.
 *
 *   node scripts/shots-pile.mjs [http://localhost:5173] [out-dir] [1000x1000,900x900] [fullhouse,run8]
 */
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const APP = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '');
const OUT = process.argv[3] || 'pile-shots';
const ONLY = process.argv[4]?.split(',');
const MELD_ONLY = process.argv[5]?.split(',');
mkdirSync(OUT, { recursive: true });

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const root = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(join(root, 'playwright', 'index.mjs')).href);
  }
}

const SIZES = ONLY ?? ['1000x1000', '1100x1000', '1200x1100', '900x900', '1920x1080', '1024x768', '768x1024', '390x844', '844x390'];
const MELDS = [
  ['fullhouse', 'Ann: full house'],
  ['run5', 'Cy: straight'],
  ['sisters', 'Bo: sisters'],
  ['single', 'Cy: single'],
  ['run8', 'Cy: 8-card run'],
].filter(([k]) => !MELD_ONLY || MELD_ONLY.includes(k));

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true });
const rows = [];
for (const size of SIZES) {
  const [w, h] = size.split('x').map(Number);
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  for (const [name, step] of MELDS) {
    await page.goto(`${APP}/h5/animation`);
    await page.waitForFunction(() => window.__lab);
    await page.getByText('hide panel').click();
    const lab = (s) => page.evaluate((k) => window.__lab[k](), s);
    await lab('Deal');
    await page.waitForTimeout(2200);
    for (const s of ['Ann: pair', 'Bo: triple', step]) { await lab(s); await page.waitForTimeout(450); }
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const groups = [...new Set([...document.querySelectorAll('[data-pile]')].map((e) => e.parentElement))];
      const g = groups[groups.length - 1];
      const t = new DOMMatrix(getComputedStyle(g).transform);
      const scale = Math.hypot(t.a, t.b);
      const cards = [...g.querySelectorAll('[data-pile]')];
      const cw = cards[0].offsetWidth * scale;
      const xs = cards.map((c) => new DOMMatrix(getComputedStyle(c).transform).e * scale);
      const strips = xs.slice(1).map((x, i) => x - xs[i]);
      const box = cards.map((c) => c.getBoundingClientRect());
      const meld = { l: Math.min(...box.map((b) => b.left)), r: Math.max(...box.map((b) => b.right)), t: Math.min(...box.map((b) => b.top)), b: Math.max(...box.map((b) => b.bottom)) };
      // each card's corner index: the top-left 33% x 40% of the card
      const corners = box.map((b) => ({ l: b.left, r: b.left + cw * 0.33, t: b.top, b: b.top + cw * 1.4 * 0.4 }));
      const hit = (a, b) => a.l < b.right && a.r > b.left && a.t < b.bottom && a.b > b.top;
      const others = [
        ...[...document.querySelectorAll('[data-card]')].map((e) => ['hand', e.getBoundingClientRect()]),
        ...[...document.querySelectorAll('[data-plate]')].map((e) => ['plate', e.getBoundingClientRect()]),
        ...[...document.querySelectorAll('button')].filter((e) => /^(Pass|Play)/.test(e.textContent ?? '')).map((e) => ['button', e.getBoundingClientRect()]),
      ];
      const covered = [...new Set(corners.flatMap((c) => others.filter(([, r]) => hit(c, r)).map(([k]) => k)))];
      return { cw: Math.round(cw), scale: +scale.toFixed(2), minStrip: strips.length ? Math.round(Math.min(...strips)) : null, spill: Math.round(Math.max(0, -meld.l, meld.r - innerWidth)), covered };
    });
    rows.push({ size, name, ...m });
    console.log(size.padEnd(10), name.padEnd(10), `card ${m.cw}px`, `scale ${m.scale}`, `strip ${m.minStrip ?? '-'}px`, m.spill ? `OFFSCREEN ${m.spill}px` : '', m.covered.length ? `CORNER UNDER ${m.covered.join(',')}` : '');
    await page.screenshot({ path: join(OUT, `${size}-${name}.png`) });
  }
  await page.close();
}
await browser.close();

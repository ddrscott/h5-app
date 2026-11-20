#!/usr/bin/env node
// Opponent seat sizes: a mid-trick table in the FX lab (bots, so the personality chips and the
// "thinking" state show), headless, at the sizes the seat layout is judged at. Prints each seat's
// plate and fan size and flags any seat overlapping another seat, the newest meld, the callout,
// your status stack or the hand.
//
//   node scripts/shots-seats.mjs http://localhost:5173 out-dir [NAMES=long]
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const APP = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '');
const OUT = process.argv[3] || 'seat-shots';
mkdirSync(OUT, { recursive: true });
async function loadPlaywright() {
  try { return await import('playwright'); } catch {
    const root = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(join(root, 'playwright', 'index.mjs')).href);
  }
}
const SHOTS = (process.env.SHOTS || '4@1400x1000,4@1100x1000,4@390x844,6@1400x1000').split(',').map((s) => {
  const [n, wh] = s.split('@'); const [w, h] = wh.split('x').map(Number);
  return { n: Number(n), w, h, mobile: w < 640 };
});
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true });
let bad = 0;
for (const s of SHOTS) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.mobile ? 2 : 1, isMobile: s.mobile, hasTouch: s.mobile });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { bad++; console.log('  page error', e.message); });
  await page.goto(`${APP}/h5/animation?bots=1&players=${s.n}${process.env.NAMES === 'long' ? '&names=long' : ''}`);
  await page.waitForFunction(() => window.__lab);
  await page.addStyleTag({ content: '[data-lab-panel]{display:none!important}' });
  await page.waitForTimeout(700);
  const lab = async (step, wait) => { await page.evaluate((x) => window.__lab[x](), step); await page.waitForTimeout(wait); };
  await lab('Ann: pair', 900);
  await lab('Bo: triple', 1000);
  await lab('Cy: straight', 1100);
  const name = `${s.n}p@${s.w}x${s.h}`;
  const rep = await page.evaluate(() => {
    const r = (el) => el.getBoundingClientRect();
    const plates = [...document.querySelectorAll('[data-plate]')].filter((el) => el.querySelector('[data-seat-name]')).map((el) => ({ el, b: r(el), name: el.querySelector('[data-seat-name]')?.textContent }));
    const meld = [...document.querySelectorAll('[data-newest]')];
    const out = [];
    const ov = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    for (let i = 0; i < plates.length; i++) {
      const p = plates[i];
      const nm = p.el.querySelector('[data-seat-name]');
      out.push(`${p.name}: ${Math.round(p.b.width)}x${Math.round(p.b.height)} name ${nm ? getComputedStyle(nm).fontSize : '-'} @${Math.round(p.b.x + p.b.width / 2)},${Math.round(p.b.y + p.b.height / 2)}`);
      for (let j = i + 1; j < plates.length; j++) if (ov(p.b, plates[j].b) > 4) out.push(`!! ${p.name} overlaps ${plates[j].name}`);
      for (const c of document.querySelectorAll('[data-card]')) if (ov(p.b, r(c)) > 4) { out.push(`!! ${p.name} overlaps your hand`); break; }
      for (const c of meld) if (ov(p.b, r(c)) > 4) { out.push(`!! ${p.name} overlaps the pile`); break; }
    }
    return out;
  });
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(name); for (const l of rep) { console.log('  ' + l); if (l.startsWith('!!')) bad++; }
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);

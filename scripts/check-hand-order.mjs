#!/usr/bin/env node
// Rearranging your hand, headless, in a real game against three built-in bots, at the car screen
// (1100x1000, mouse) and a phone (390x844, touch). At each size it:
//   1. drags a card to a new spot and checks the new order (and that nothing got selected),
//   2. taps a card and checks it got selected without moving,
//   3. plays a card and checks the rest kept their order,
//   4. reloads the page and checks the order came back,
//   5. sorts by suit and back by rank.
// It saves a screenshot mid-drag at each size. Run it against `npm run dev`:
//
//   node scripts/check-hand-order.mjs http://localhost:5173 /tmp/hand-order
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const APP = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '');
const OUT = process.argv[3] || 'hand-order-shots';
mkdirSync(OUT, { recursive: true });
async function loadPlaywright() {
  try { return await import('playwright'); } catch {
    const root = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(join(root, 'playwright', 'index.mjs')).href);
  }
}
const SIZES = (process.env.SIZES || '1100x1000,390x844').split(',').map((s) => {
  const [w, h] = s.split('x').map(Number);
  return { w, h, touch: w < 640 };
});
const RANKS = '3456789TJQKA2';
const power = (code) => code === '5H' ? 99 : code === 'JJ' ? 98 : code === 'jj' ? 97 : RANKS.indexOf(code[0]);
const moveTo = (order, code, to) => { const r = order.filter((c) => c !== code); r.splice(to, 0, code); return r; };

let failures = 0;
const check = (ok, what, extra = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? ` (${extra})` : ''}`);
  if (!ok) failures++;
};

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true });
for (const s of SIZES) {
  console.log(`${s.w}x${s.h} ${s.touch ? 'touch' : 'mouse'}`);
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.touch ? 2 : 1, isMobile: s.touch, hasTouch: s.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { failures++; console.log('  page error', e.message); });
  const cdp = await ctx.newCDPSession(page);

  const order = async () => (await page.getAttribute('[data-hand-order]', 'data-hand-order')).split(' ').filter(Boolean);
  const selected = () => page.$$eval('[data-card][aria-pressed=true]', (els) => els.map((e) => e.dataset.card));
  // a point on screen that lands on this card and not on a neighbour covering it
  const spot = (code) => page.evaluate((c) => {
    const el = document.querySelector(`[data-card="${CSS.escape(c)}"]`);
    const r = el.getBoundingClientRect();
    for (let fy = 0.25; fy < 0.95; fy += 0.1) {
      for (let fx = 0.08; fx < 0.95; fx += 0.06) {
        const x = r.left + r.width * fx, y = r.top + r.height * fy;
        if (document.elementFromPoint(x, y)?.closest('[data-card]')?.dataset.card === c) return { x, y };
      }
    }
    return null;
  }, code);
  const centre = (code) => page.evaluate((c) => {
    const r = document.querySelector(`[data-card="${CSS.escape(c)}"]`).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, code);

  // press on a visible part of card `code`, slide it until its centre is over card `onto`'s
  // centre, screenshot mid-drag, let go
  async function drag(code, onto, shotName) {
    const from = await spot(code);
    const a = await centre(code), b = await centre(onto);
    const to = { x: from.x + b.x - a.x, y: from.y + b.y - a.y };
    const steps = 14;
    const at = (i) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
    if (s.touch) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
      for (let i = 1; i <= steps; i++) { const p = at(i); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y }] }); await page.waitForTimeout(25); }
    } else {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      for (let i = 1; i <= steps; i++) { const p = at(i); await page.mouse.move(p.x, p.y); await page.waitForTimeout(25); }
    }
    await page.waitForTimeout(450); // let the others slide aside
    await page.screenshot({ path: join(OUT, shotName) });
    if (s.touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await page.mouse.up();
    await page.waitForTimeout(600);
  }
  async function tap(p) {
    if (s.touch) await page.touchscreen.tap(p.x, p.y);
    else await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(350);
  }

  await page.goto(`${APP}/h5/play`);
  await page.fill('input[placeholder="Enter your name"]', 'Scott');
  await page.click('button:has-text("Create New Room")');
  await page.waitForURL(/room=/);
  await page.waitForTimeout(800);
  for (let i = 0; i < 3; i++) { await page.click('button:has-text("Add Bot")'); await page.waitForTimeout(900); }
  await page.click('button:has-text("Start Game")');
  await page.waitForFunction(() => (document.querySelector('[data-hand-order]')?.getAttribute('data-hand-order') || '').split(' ').length > 5);
  await page.waitForTimeout(2600); // the deal-in animation

  // 1. drag the second card to where the second-to-last one sits
  const before = await order();
  const code = before[1];
  const target = before.length - 2;
  await drag(code, before[target], `${s.w}x${s.h}-mid-drag.png`);
  const afterDrag = await order();
  check(afterDrag.join() === moveTo(before, code, target).join(), `drag moved ${code} from slot 1 to slot ${target}`, afterDrag.join(' '));
  check((await selected()).length === 0, 'the drag selected nothing');

  // 2. tap a card: it gets selected and stays put
  const tapCode = afterDrag[3];
  await tap(await spot(tapCode));
  check((await selected()).join() === tapCode, `tap selected ${tapCode}`, (await selected()).join(' '));
  check((await order()).join() === afterDrag.join(), 'tap left the order alone');
  // a selected card can be dragged too, and stays selected
  const selBefore = await order();
  await drag(tapCode, selBefore[0], `${s.w}x${s.h}-drag-selected.png`);
  check((await order())[0] === tapCode && (await selected()).join() === tapCode, `dragged the selected ${tapCode} to the front and it stayed selected`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 3. play a card (a bot may have to finish its turn first), then check the rest held their order
  let played = null;
  let beforePlay = null;
  const deadline = Date.now() + 90000;
  while (!played && Date.now() < deadline) {
    const mine = await page.isVisible('text=/^(Your lead|Your turn)$/i').catch(() => false);
    if (!mine) { await page.waitForTimeout(300); continue; }
    const hand = await order();
    const pass = page.locator('button[title="Pass (P)"]');
    const leading = !(await pass.isEnabled());
    // lead the 3 of hearts if we hold it (the first trick), else our lowest; follow with our best single
    const pick = leading ? (hand.includes('3H') ? '3H' : [...hand].sort((a, b) => power(a) - power(b))[0]) : [...hand].sort((a, b) => power(b) - power(a))[0];
    await tap(await spot(pick));
    const play = page.locator('button[title="Play (Enter)"]');
    if (await play.isEnabled()) {
      beforePlay = await order();
      await play.click();
      await page.waitForFunction((c) => !document.querySelector('[data-hand-order]').getAttribute('data-hand-order').split(' ').includes(c), pick, { timeout: 5000 });
      played = pick;
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      await pass.click();
    }
    await page.waitForTimeout(500);
  }
  check(!!played, `played a card${played ? ` (${played})` : ''}`);
  if (played) {
    await page.waitForTimeout(800);
    const now = await order();
    check(now.join() === beforePlay.filter((c) => c !== played).join(), 'the rest of the hand kept its order', now.join(' '));

    // 4. a reload brings the same order back
    await page.reload();
    await page.waitForFunction(() => (document.querySelector('[data-hand-order]')?.getAttribute('data-hand-order') || '').length > 0, null, { timeout: 15000 });
    await page.waitForTimeout(1500);
    const reloaded = await order();
    const expect = now.filter((c) => reloaded.includes(c));
    check(reloaded.join() === expect.join() && reloaded.length >= now.length - 3, 'the order survived a reload', reloaded.join(' '));

    // 5. the sort buttons: by suit, then back to rank (the deal order)
    const SUITS = 'CDHSJ';
    const suitOf = (c) => (c === 'jj' || c === 'JJ' ? 'J' : c[1]);
    const rankOf = (c) => (c === 'jj' ? 13 : c === 'JJ' ? 14 : RANKS.indexOf(c[0]));
    await page.click('[data-sort=suit]');
    await page.waitForTimeout(500);
    const suited = await order();
    check(suited.join() === [...suited].sort((a, b) => SUITS.indexOf(suitOf(a)) - SUITS.indexOf(suitOf(b)) || rankOf(a) - rankOf(b)).join(), 'sort by suit', suited.join(' '));
    await page.click('[data-sort=rank]');
    await page.waitForTimeout(500);
    const ranked = await order();
    check(ranked.join() === [...ranked].sort((a, b) => rankOf(a) - rankOf(b) || suitOf(a).localeCompare(suitOf(b))).join(), 'sort by rank', ranked.join(' '));
  }
  await ctx.close();
}
await browser.close();
console.log(failures ? `${failures} failure(s)` : 'all good');
process.exit(failures ? 1 : 0);

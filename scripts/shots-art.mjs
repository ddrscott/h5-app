#!/usr/bin/env node
// Screenshots every screen at the five review sizes, headless, for art-direction before/after
// comparisons (docs/VISUALS.md).
//
//   node scripts/shots-art.mjs http://localhost:5173 out-dir [only-screen-substring]
//
// NAMES=long runs the FX lab with 20-character names (/h5/animation?names=long). Every shot also
// checks that no seat name is cut off without an ellipsis and that your YOU chip on the results
// page lands whole; any miss is listed under page errors.
//
// Writes <out-dir>/<screen>@<w>x<h>.png. Screens: landing, welcome, sign-in, stats, lobby,
// bot panel, a real table mid-trick (built-in bots), the FX lab (deal, every meld callout, bomb,
// Heart 5, game over) and /h5/cards. Signs in with dev codes, so run against `npm run dev` with
// DEV_LOGIN_CODES=1 in .dev.vars.
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const APP = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '');
const OUT = process.argv[3] || 'art-shots';
const ONLY = process.argv[4] || '';
mkdirSync(OUT, { recursive: true });

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const root = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(join(root, 'playwright', 'index.mjs')).href);
  }
}

const VIEWPORTS = [
  { w: 1920, h: 1080 },
  { w: 1100, h: 1000 },
  { w: 1024, h: 768 },
  { w: 640, h: 640 },
  { w: 390, h: 844, mobile: true },
];

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true });
const errors = [];
const want = (name) => !ONLY || name.includes(ONLY);
const run = Date.now().toString(36);

for (const vp of VIEWPORTS) {
  const tag = `${vp.w}x${vp.h}`;
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: vp.mobile ? 2 : 1,
    isMobile: !!vp.mobile,
    hasTouch: !!vp.mobile,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  const shot = async (name) => {
    await page.screenshot({ path: join(OUT, `${name}@${tag}.png`) });
    // long-name guards: a seat name never clips inside its caption, and your YOU chip on the
    // results page is always fully inside its strip
    const clipped = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('[data-seat-name]')) {
        // a one-line caption that ends in an ellipsis is fine; a cut with no ellipsis is not
        if (getComputedStyle(el).textOverflow === 'ellipsis') continue;
        if (el.scrollWidth > el.clientWidth + 1) bad.push(`seat name "${el.textContent}" ${el.scrollWidth}>${el.clientWidth}`);
      }
      for (const you of document.querySelectorAll('[data-you]')) {
        const row = you.closest('[data-standing]')?.getBoundingClientRect();
        const r = you.getBoundingClientRect();
        // hit-test the chip's right end: a chip cut off by a truncating parent isn't what's there
        const hit = document.elementFromPoint(r.right - 3, r.top + r.height / 2);
        if (!row || r.width < 10 || r.right > row.right - 8 || r.left < row.left || !(hit && you.contains(hit))) bad.push(`YOU chip clipped (${Math.round(r.left)}..${Math.round(r.right)} in ${Math.round(row?.left ?? 0)}..${Math.round(row?.right ?? 0)})`);
      }
      return bad;
    });
    for (const b of clipped) errors.push(`${tag} ${name}: ${b}`);
    console.log(`  ${name}@${tag}${clipped.length ? '  !! ' + clipped.join('; ') : ''}`);
  };

  if (want('landing')) {
    await page.goto(`${APP}/h5/`);
    await page.waitForTimeout(1200);
    await shot('01-landing');
  }

  if (want('welcome') || want('signin') || want('stats') || want('lobby') || want('botpanel') || want('table')) {
    await page.goto(`${APP}/h5/play`);
    await page.waitForSelector('input[placeholder="Enter your name"]');
    await page.waitForTimeout(800);
    if (want('welcome')) await shot('02-welcome');

    if (want('signin') || want('stats')) {
      await page.click('text=Sign in to keep your stats');
      await page.waitForTimeout(500);
      await shot('03-signin');
      await page.fill('input[placeholder="you@example.com"]', `art-${run}-${tag}@example.com`);
      await page.click('[role=dialog] button[type=submit]');
      await page.waitForSelector('input[placeholder="123456"]');
      await page.waitForTimeout(400);
      await shot('03-signin-code');
      await page.click('[role=dialog] button[type=submit]');
      await page.waitForSelector('[role=dialog]', { state: 'detached' }).catch(() => {});
      await page.waitForTimeout(600);
      if (await page.isVisible('text=Your stats')) {
        await page.click('text=Your stats');
        await page.waitForTimeout(800);
        await shot('04-stats');
        await page.click('[aria-label=Close]');
        await page.waitForTimeout(300);
      }
    }

    if (want('lobby') || want('botpanel') || want('table')) {
      await page.fill('input[placeholder="Enter your name"]', 'Scott');
      await page.click('button:has-text("Create New Room")');
      await page.waitForURL(/room=/);
      await page.waitForTimeout(800);
      for (let i = 0; i < 3; i++) {
        await page.click('button:has-text("Add Bot")');
        await page.waitForTimeout(900);
      }
      await page.waitForTimeout(600);
      if (want('lobby')) await shot('05-lobby');
      if (want('botpanel')) {
        await page.click('[data-testid=bot-dock-button]');
        await page.waitForTimeout(600);
        await shot('06-botpanel');
        await page.click('[aria-label=Close]').catch(() => {});
        await page.waitForTimeout(300);
      }
      if (want('table')) {
        await page.click('button:has-text("Start Game")');
        // Mid-trick: wait for the deal, play our part when it's our turn (pass, or lead the
        // lowest card), and shoot once the pile holds a play from another seat while a bot thinks.
        await page.waitForTimeout(3500);
        const deadline = Date.now() + 40000;
        while (Date.now() < deadline) {
          const mine = await page.isVisible('text=/^(Your lead|Your turn)$/i').catch(() => false);
          if (mine) {
            const pass = page.locator('button[title="Pass (P)"]');
            if (await pass.isEnabled()) await pass.click();
            else {
              // lead whichever card is on top where we tap (cards overlap on a phone)
              await page.locator('[data-card]').last().click({ force: true, timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(150);
              await page.locator('button[title="Play (Enter)"]').click({ timeout: 3000 }).catch(() => {});
            }
            await page.waitForTimeout(1200);
            continue;
          }
          const piles = await page.locator('[data-pile]').count();
          const botThinking = await page.isVisible('text=is thinking').catch(() => false);
          if (piles >= 2 && botThinking) { await page.waitForTimeout(700); break; }
          await page.waitForTimeout(300);
        }
        await shot('07-table');
      }
      await page.goto('about:blank');
    }
  }

  if (want('lab')) {
    const lab = async (step, wait, name) => {
      await page.evaluate((s) => window.__lab[s](), step);
      await page.waitForTimeout(wait);
      if (name) await shot(name);
    };
    await page.goto(`${APP}/h5/animation${process.env.NAMES === "long" ? "?names=long" : ""}`);
    await page.waitForFunction(() => window.__lab);
    // Hide the lab's control panel so the table is what's shown.
    await page.addStyleTag({ content: '[data-lab-panel]{display:none!important}' });
    await page.waitForTimeout(600);
    await lab('Deal', 900, '10-lab-deal');
    await page.waitForTimeout(2500);
    await lab('Ann: pair', 650, '11-lab-pair');
    await lab('Bo: triple', 650, '12-lab-triple');
    await lab('Cy: straight', 650, '13-lab-straight');
    await page.waitForTimeout(1200);
    await lab('Ann: full house', 650, '14-lab-fullhouse');
    await page.waitForTimeout(1200);
    await lab('Bo: sisters', 650, '15-lab-sisters');
    await page.waitForTimeout(1200);
    // the finisher frame shows once the cards land; catch it mid-beat, then the callout after
    await lab('Ann: BOMB', 0);
    await page.waitForFunction(() => document.querySelector('[data-impact]'), null, { polling: 'raf', timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(60);
    await shot('16-lab-bomb-impact');
    await page.waitForTimeout(900);
    await shot('16-lab-bomb');
    await page.waitForTimeout(1500);
    await lab('Bo: str. flush', 650, '17-lab-strflush');
    await page.waitForTimeout(1500);
    // the finisher frame shows once the cards land; catch it mid-beat, then the callout after
    await lab('Cy: Heart 5', 0);
    await page.waitForFunction(() => document.querySelector('[data-impact]'), null, { polling: 'raf', timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(60);
    await shot('18-lab-heart5-impact');
    await page.waitForTimeout(900);
    await shot('18-lab-heart5');
    await page.waitForTimeout(1500);
    await lab('Bo passes', 600, '19-lab-pass');
    await lab('Game over', 4200, '20-lab-gameover');
  }

  if (want('cards')) {
    await page.goto(`${APP}/h5/cards`);
    await page.waitForTimeout(1200);
    await shot('30-cards');
  }
  await ctx.close();
}

await browser.close();
if (errors.length) {
  console.log('page errors:');
  for (const e of errors) console.log('  ' + e);
}

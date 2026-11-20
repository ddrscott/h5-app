#!/usr/bin/env node
// Screenshots every screen at the four review sizes, headless, for art-direction before/after
// comparisons (docs/VISUALS.md).
//
//   node scripts/shots-art.mjs http://localhost:5173 out-dir [only-screen-substring]
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
    console.log(`  ${name}@${tag}`);
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
        // Let the deal finish and a few bots play.
        await page.waitForTimeout(4500);
        // If it's our turn, play the lowest card so the trick moves on.
        await page.waitForTimeout(3000);
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
    await page.goto(`${APP}/h5/animation`);
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
    await lab('Ann: BOMB', 260, '16-lab-bomb-impact');
    await page.waitForTimeout(500);
    await shot('16-lab-bomb');
    await page.waitForTimeout(1500);
    await lab('Bo: str. flush', 650, '17-lab-strflush');
    await page.waitForTimeout(1500);
    await lab('Cy: Heart 5', 260, '18-lab-heart5-impact');
    await page.waitForTimeout(500);
    await shot('18-lab-heart5');
    await page.waitForTimeout(1500);
    await lab('Bo passes', 600, '19-lab-pass');
    await lab('Game over', 2500, '20-lab-gameover');
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

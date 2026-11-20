#!/usr/bin/env node
// Plays a real game with uploaded bots, headless. Two humans (Hana hosts, Gus joins) each load
// the starter bot (Hana pastes it, Gus uploads the file) and hand it their seat; Hana also seats
// it as an extra player and adds a built-in bot. The game has to finish with nobody touching a
// card, each human has to see the other's bot badge, and then Hana's timeout bot has to strike out
// and hand her seat back.
//
//   node scripts/smoke-bot-game.mjs http://localhost:5173 [screenshot-dir]
//
// Needs Playwright and `npm run dev`. Takes about two minutes.
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '');
const SHOTS = process.argv[3] || 'bot-game-shots';
const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLES = join(HERE, '..', 'src', 'client', 'bots', 'sandbox', 'examples');
mkdirSync(SHOTS, { recursive: true });

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const root = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(join(root, 'playwright', 'index.mjs')).href);
  }
}

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}`);
  if (!ok) failures++;
};

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const viewport = { width: 1280, height: 800 };
const host = await (await browser.newContext({ viewport })).newPage();
const guest = await (await browser.newContext({ viewport })).newPage();
const errors = [];
for (const [who, p] of [['host', host], ['guest', guest]]) p.on('pageerror', (e) => errors.push(`${who}: ${e.message}`));

// seat everyone
await host.goto(`${APP}/h5/play`);
await host.fill('input[placeholder="Enter your name"]', 'Hana');
await host.click('button:has-text("Create New Room")');
await host.waitForURL(/room=/);
const room = new URL(host.url()).searchParams.get('room');
console.log(`room ${room}`);

await guest.goto(`${APP}/h5/play?room=${room}`);
await guest.fill('input[placeholder="Enter your name"]', 'Gus');
await guest.fill('input[aria-label="Room code"]', room);
await guest.click('button:text-is("Join")');
await guest.waitForSelector('text=Pull up a chair');

await host.click('button:has-text("Add Bot")');
await host.waitForTimeout(800);

// Hana pastes the starter bot, says yes to the warning, seats a copy, and hands it her seat
await host.click('[data-testid=bot-dock-button]');
await host.click('button:text-is("Your bots")');
await host.click('section button:has-text("Starter bot")');
await host.click('[data-testid=bot-save]');
check(await host.isVisible('text=This runs code in your browser'), 'first load asks before running code');
await host.screenshot({ path: join(SHOTS, '1-consent.png') });
await host.click('[data-testid=bot-consent-yes]');
await host.click('[data-testid=bot-extra-seat]');
await host.waitForSelector('text=Starter Bot took a seat');
await host.screenshot({ path: join(SHOTS, '2-panel.png') });
await host.click('[data-testid=bot-play-seat]');
check(await host.isVisible('[data-testid=autopilot-strip]'), 'Hana sees "Starter Bot is playing for you"');

// Gus uploads the same bot as a file
await guest.click('[data-testid=bot-dock-button]');
await guest.click('button:text-is("Your bots")');
await guest.setInputFiles('[data-testid=bot-file]', join(EXAMPLES, 'starter-bot.js'));
const loaded = await guest.waitForFunction(() => document.querySelector('[data-testid=bot-code]')?.value.includes('function decide(view)'), null, { timeout: 5000 }).then(() => true, () => false);
check(loaded, 'the file picker loads the script');
await guest.click('[data-testid=bot-save]');
await guest.click('[data-testid=bot-consent-yes]');
await guest.click('[data-testid=bot-play-seat]');

// play
await host.click('button:has-text("Start Game")');
await host.waitForSelector('[data-plate]');
await host.waitForSelector('[data-autopilot]:has-text("starter bot")', { timeout: 15000 }).catch(() => {});
const hostSees = await host.locator('[data-autopilot]').allInnerTexts();
const guestSees = await guest.locator('[data-autopilot]').allInnerTexts();
check(hostSees.length >= 2, `Hana sees bot badges on other seats: ${JSON.stringify(hostSees)}`);
check(guestSees.length >= 2, `Gus sees bot badges, Hana's included: ${JSON.stringify(guestSees)}`);
await host.waitForTimeout(2500);
await host.screenshot({ path: join(SHOTS, '3-host-midgame.png') });
await guest.screenshot({ path: join(SHOTS, '3-guest-midgame.png') });

const t0 = Date.now();
await host.waitForSelector('button:has-text("Play again")', { timeout: 240_000 });
check(true, `the game finished with bots on every seat in ${Math.round((Date.now() - t0) / 1000)}s`);
await host.screenshot({ path: join(SHOTS, '4-game-over.png') });

// strike out: Hana starts the next game, then switches to a bot that never answers
await host.click('button:has-text("Play again")');
await host.waitForSelector('button:has-text("Play again")', { state: 'detached' });
await host.click('[data-testid=bot-dock-button]');
await host.click('button:text-is("Your bots")');
await host.fill('input[aria-label="Bot name"]', 'Spinner');
await host.fill('[data-testid=bot-code]', 'function decide(view) { for (;;) {} }');
await host.click('[data-testid=bot-save]');
// saving picks the new bot; if Starter Bot still had her seat, Spinner takes over at once
if (await host.isVisible('[data-testid=bot-play-seat]')) await host.click('[data-testid=bot-play-seat]');
else await host.click('[aria-label=Close]');
await guest.waitForSelector('[data-autopilot]:has-text("Spinner")', { timeout: 5000 }).catch(() => {});
check(await guest.isVisible('[data-autopilot]:has-text("Spinner")'), 'Gus sees the badge change to Spinner');
const toast = await host.waitForSelector('[data-testid=bot-toast]:has-text("struck out")', { timeout: 180_000 }).then((el) => el.innerText()).catch(() => null);
check(!!toast, `the looping bot strikes out: ${toast}`);
await host.screenshot({ path: join(SHOTS, '5-struck-out.png') });
const gone = (page, sel) => page.waitForSelector(sel, { state: 'detached', timeout: 5000 }).then(() => true, () => false);
check(await gone(host, '[data-testid=autopilot-strip]'), 'Hana has her seat back');
check(await gone(guest, '[data-autopilot]:has-text("Spinner")'), 'the Spinner badge is gone from her seat for Gus');

check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join('; ') : ''}`);
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);

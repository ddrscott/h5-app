#!/usr/bin/env node
// Smoke test for sign-in and permanent stats. Run against `npm run dev` (with DEV_LOGIN_CODES=1
// in .dev.vars, so codes come back on screen and no email goes out):
//
//   node scripts/smoke-stats.mjs http://localhost:5173
//
// It checks that
//   1. a wrong code is refused and the dev code signs in, setting a Path=/h5 cookie,
//   2. a signed-in player and one bot play a whole game over real sockets, and the bot's socket
//      carries the same cookie (as it does from the host's browser) without being counted,
//   3. the room says the game is tracked, then saved, and vs computer goes up by exactly one game,
//      and a Play Again in the same room adds a second,
//   4. a guest's game is not tracked and changes nothing,
//   5. signing out ends the session.
// Needs Node 22+ (global WebSocket). Exits non-zero on the first failure.

const base = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '');
const wsBase = base.replace(/^http/, 'ws') + '/h5/api/rooms';

const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s`;
const log = (...a) => console.log(stamp(), ...a);

function check(cond, msg) {
  if (!cond) {
    console.error(`${stamp()} FAIL ${msg}`);
    process.exit(1);
  }
  log(`ok   ${msg}`);
}

async function api(path, { body, cookie } = {}) {
  const res = await fetch(`${base}/h5${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, setCookie: res.headers.get('set-cookie'), body: await res.json().catch(() => null) };
}

class Seat {
  constructor(name) {
    Object.assign(this, { name, state: null, hand: [], msgs: [], waiters: [] });
  }

  static open(name, room, { opts = {}, cookie } = {}) {
    const seat = new Seat(name);
    const q = `name=${encodeURIComponent(name)}&opts=${encodeURIComponent(JSON.stringify(opts))}`;
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${wsBase}/${room}/ws?${q}`, cookie ? { headers: { Cookie: cookie } } : undefined);
      seat.ws = ws;
      ws.onmessage = (ev) => {
        const f = JSON.parse(ev.data);
        if (f.t === 'joined') Object.assign(seat, { roomId: f.roomId, sessionId: f.sessionId });
        if (f.t === 'state') { seat.state = f.s; resolve(seat); }
        if (f.t === 'msg') {
          seat.msgs.push(f);
          if (f.type === 'your_hand') seat.hand = f.data.cards.map((c) => c.code);
        }
        seat.waiters = seat.waiters.filter((w) => !w());
      };
      ws.onclose = (ev) => reject(new Error(`${name}: closed ${ev.code} ${ev.reason}`));
      ws.onerror = () => {};
    });
  }

  send(type, data = {}) { this.ws.send(JSON.stringify({ t: 'msg', type, data })); }
  has(type) { return this.msgs.some((m) => m.type === type); }

  waitFor(pred, what, ms = 10_000) {
    return new Promise((resolve, reject) => {
      if (pred()) return resolve();
      const timer = setTimeout(() => reject(new Error(`${this.name}: timed out waiting for ${what}`)), ms);
      this.waiters.push(() => { if (!pred()) return false; clearTimeout(timer); resolve(); return true; });
    });
  }

  /** Sends a play and waits for the room's answer: the new hand, or an error. */
  async tryPlay(code) {
    const n = this.msgs.length;
    this.send('play', { cards: [code] });
    await this.waitFor(() => this.msgs.slice(n).some((m) => m.type === 'error' || m.type === 'your_hand'), 'a play answer');
    return !this.msgs.slice(n).some((m) => m.type === 'error');
  }

  close() { this.ws.onclose = null; this.ws.close(); }
}

/** Plays a whole game in singles: lead the lowest card, beat with the lowest that works, else pass. */
async function playOut(seats) {
  const host = seats[0];
  for (let moves = 0; moves < 500; moves++) {
    const s = host.state;
    if (s.phase !== 'PLAYING') return moves;
    const seat = seats.find((x) => x.sessionId === s.currentTurnPlayerId);
    const before = JSON.stringify([s.currentTurnPlayerId, s.discardPile.length, s.consecutivePasses]);
    let played = false;
    if (!s.currentMeld || s.currentMeld.cards.length === 1) {
      for (const code of [...seat.hand]) if (await seat.tryPlay(code)) { played = true; break; }
    }
    if (!played) seat.send('pass');
    await host.waitFor(() => host.state.phase !== 'PLAYING'
      || JSON.stringify([host.state.currentTurnPlayerId, host.state.discardPile.length, host.state.consecutivePasses]) !== before, 'the next turn');
  }
  throw new Error('game did not finish in 500 moves');
}

const email = `smoke-${Date.now()}@example.com`;

// 1. Sign in with a dev code.
const start = await api('/api/auth/start', { body: { email } });
check(start.status === 200 && /^\d{6}$/.test(start.body?.devCode ?? ''), 'start returns a 6-digit dev code (DEV_LOGIN_CODES=1, no email sent)');
const code = start.body.devCode;
const bad = await api('/api/auth/verify', { body: { email, code: String((Number(code) + 1) % 1e6).padStart(6, '0') } });
check(bad.status === 400 && /isn't right/.test(bad.body?.error), `a wrong code is refused: "${bad.body?.error}"`);
const ok = await api('/api/auth/verify', { body: { email, code } });
check(ok.status === 200 && /Path=\/h5;/.test(ok.setCookie) && /HttpOnly/.test(ok.setCookie), 'the right code sets an HttpOnly Path=/h5 session cookie');
const cookie = ok.setCookie.split(';')[0];
const me = await api('/api/me', { cookie });
check(me.body?.email === email, '/api/me knows who we are');
await api('/api/me', { body: { name: 'Smoke' }, cookie });
const before = (await api('/api/stats', { cookie })).body.stats;
log(`     before: vs computer ${JSON.stringify(before.computer)}`);

// 2. A signed-in player against one bot. The bot's socket carries the cookie too.
const human = await Seat.open('Smoke', 'new', { cookie });
const botSeat = await Seat.open('Bot', human.roomId, { opts: { bot: true }, cookie });
log(`     room ${human.roomId}`);
await human.waitFor(() => Object.keys(human.state.players).length === 2, 'two seats');
human.send('startGame');
await human.waitFor(() => human.state.phase === 'PLAYING' && human.hand.length > 0, 'the deal');
await human.waitFor(() => human.has('stats_tracking'), 'stats_tracking');
check(human.msgs.find((m) => m.type === 'stats_tracking').data.bucket === 'computer', 'the room says this game counts, as vs computer');
check(!botSeat.has('stats_tracking'), 'the bot is not tracked, even with the cookie on its socket');
const moves = await playOut([human, botSeat]);
check(['ROUND_END', 'GAME_END'].includes(human.state.phase), `the game played to the end in ${moves} turns`);
await human.waitFor(() => human.has('stats_saved'), 'stats_saved');
const saved = human.msgs.find((m) => m.type === 'stats_saved').data;
check(saved.bucket === 'computer', `the room says the result was saved (place ${saved.place}, ${saved.win ? 'win' : 'loss'})`);

// 3. Stats went up by exactly one game.
const after = (await api('/api/stats', { cookie })).body.stats;
log(`     after:  vs computer ${JSON.stringify(after.computer)}`);
check(after.computer.games === before.computer.games + 1, 'vs computer games went up by one');
check(after.computer.wins + after.computer.losses === before.computer.wins + before.computer.losses + 1, 'and it counted one win or one loss');
check(after.pvp.games === before.pvp.games && after.mixed.games === before.mixed.games, 'PvP and mixed did not change');

// Play Again: the next game in the same room is its own row.
human.msgs = [];
human.send('startGame');
await human.waitFor(() => human.state.phase === 'PLAYING' && human.has('stats_tracking'), 'the second deal');
await playOut([human, botSeat]);
await human.waitFor(() => human.has('stats_saved'), 'stats_saved for game 2');
const again = (await api('/api/stats', { cookie })).body.stats;
check(again.computer.games === before.computer.games + 2, 'Play Again counts the second game separately');
human.close();
botSeat.close();

// 4. A guest game: no tracking, no change.
const guest = await Seat.open('Guest', 'new');
const guestBot = await Seat.open('Bot', guest.roomId, { opts: { bot: true } });
await guest.waitFor(() => Object.keys(guest.state.players).length === 2, 'two seats');
guest.send('startGame');
await guest.waitFor(() => guest.state.phase === 'PLAYING' && guest.hand.length > 0, 'the deal');
await playOut([guest, guestBot]);
await new Promise((r) => setTimeout(r, 500));
check(!guest.has('stats_tracking') && !guest.has('stats_saved'), 'a guest game is neither tracked nor saved');
const still = (await api('/api/stats', { cookie })).body.stats;
check(still.computer.games === again.computer.games, "the guest game didn't touch the signed-in player's stats");
guest.close();
guestBot.close();

// 5. Sign out.
await api('/api/auth/logout', { body: {}, cookie });
check((await api('/api/me', { cookie })).body === null, 'signing out ends the session');
log('all stats checks passed');
process.exit(0);

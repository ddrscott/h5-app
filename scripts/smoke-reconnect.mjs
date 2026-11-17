#!/usr/bin/env node
// Smoke test for keeping your seat. Run against `npm run dev`:
//
//   node scripts/smoke-reconnect.mjs http://localhost:5173
//
// It plays real rooms over WebSockets and checks that
//   1. a dropped lobby seat is kept and taken back with its token,
//   2. a dropped seat mid-game is taken back with its token, hand intact,
//   3. an absent player's turn is played for them after the turn timer (~30 s),
//   4. a connected player's turn is never played for them,
//   5. the host (and only the host) can remove an absent player and play goes on.
// Rooms 3 and 4 run side by side, so the whole thing takes a little over a minute.
// Needs Node 22+ (global WebSocket). Exits non-zero on the first failure.

const base = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '');
const wsBase = base.replace(/^http/, 'ws') + '/h5/api/rooms';
const TURN_TIMEOUT_S = 30;

const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s`;
const log = (...a) => console.log(stamp(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(cond, msg) {
  if (!cond) {
    console.error(`${stamp()} FAIL ${msg}`);
    process.exit(1);
  }
  log(`ok   ${msg}`);
}

/** One player: a socket plus the latest state, hand, and every message, with waits on them. */
class Seat {
  constructor(name) {
    this.name = name;
    this.state = null;
    this.hand = [];
    this.msgs = [];
    this.closed = null;
    this.waiters = [];
  }

  static async create(name, opts = {}) {
    return new Seat(name).open(`${wsBase}/new/ws?name=${encodeURIComponent(name)}&opts=${encodeURIComponent(JSON.stringify(opts))}`);
  }

  static async join(name, roomId) {
    return new Seat(name).open(`${wsBase}/${roomId}/ws?name=${encodeURIComponent(name)}`);
  }

  /** Takes this seat back with its token on a fresh socket. */
  async resume() {
    this.state = null;
    this.closed = null;
    return this.open(`${wsBase}/${this.roomId}/ws?session=${this.sessionId}&token=${this.token}`);
  }

  open(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onmessage = (ev) => {
        const f = JSON.parse(ev.data);
        if (f.t === 'joined') Object.assign(this, { roomId: f.roomId, sessionId: f.sessionId, token: f.token });
        if (f.t === 'state') {
          this.state = f.s;
          resolve(this);
        }
        if (f.t === 'msg') {
          this.msgs.push(f);
          if (f.type === 'your_hand') this.hand = f.data.cards.map((c) => c.code);
        }
        this.waiters = this.waiters.filter((w) => !w());
      };
      ws.onclose = (ev) => {
        this.closed = { code: ev.code, reason: ev.reason };
        reject(new Error(`${this.name}: closed ${ev.code} ${ev.reason}`));
      };
      ws.onerror = () => {};
    });
  }

  send(type, data = {}) {
    this.ws.send(JSON.stringify({ t: 'msg', type, data }));
  }

  /** Drops the socket without saying goodbye, like a phone losing signal or a page reload. */
  drop() {
    this.ws.onclose = () => {};
    this.ws.close();
  }

  until(pred, what, ms = 10_000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${this.name}: timed out waiting for ${what}`)), ms);
      const test = () => {
        let v;
        try { v = this.state && pred(this.state, this); } catch { v = false; }
        if (v) {
          clearTimeout(timer);
          resolve(v);
          return true;
        }
        return false;
      };
      if (!test()) this.waiters.push(test);
    });
  }

  player(id = this.sessionId) {
    return this.state.players[id];
  }
}

async function startGame(host, seats) {
  host.send('startGame');
  await Promise.all(seats.map((s) => s.until((st) => st.phase === 'PLAYING', 'the game to start')));
  await Promise.all(seats.map((s) => s.until((_, me) => me.hand.length > 0, 'a hand')));
}

// 1. The lobby keeps a dropped seat and gives it back.
async function lobbyResume() {
  const host = await Seat.create('Host', { autoStart: false });
  const guest = await Seat.join('Guest', host.roomId);
  log(`room ${host.roomId}: lobby with Host and Guest`);
  guest.drop();
  await host.until((s) => s.players[guest.sessionId]?.isActive === false, 'Guest shown as disconnected');
  await sleep(3000);
  check(!!host.player(guest.sessionId), 'lobby: a dropped player keeps their seat (grace period)');
  await guest.resume();
  check(guest.player().isActive === true && Object.keys(guest.state.players).length === 2,
    'lobby: the same seat comes back with the token, no new player added');
  host.ws.close();
  guest.ws.close();
}

// 2. Mid-game, a dropped seat comes back with its hand.
async function gameResume() {
  const a = await Seat.create('Ann', { autoStart: false });
  const b = await Seat.join('Ben', a.roomId);
  const c = await Seat.join('Cat', a.roomId);
  const all = [a, b, c];
  log(`room ${a.roomId}: three players, game starting`);
  await startGame(a, all);

  const turn = a.state.currentTurnPlayerId;
  const off = all.find((s) => s.sessionId !== turn);
  const handBefore = [...off.hand];
  off.drop();
  await a.until((s) => s.players[off.sessionId].isActive === false, `${off.name} shown as disconnected`);
  check(a.state.currentTurnPlayerId === turn, 'game: a drop does not move the turn');
  off.hand = [];
  await off.resume();
  await off.until((_, me) => me.hand.length > 0, 'hand after resume');
  check(off.player().isActive === true, `game: ${off.name} is back in the same seat`);
  check(JSON.stringify(off.hand) === JSON.stringify(handBefore), 'game: the hand comes back unchanged');
  check(off.msgs.some((m) => m.type === 'game_state'), 'game: resume sends the game state');
  all.forEach((s) => s.ws.close());
}

// 3 + 5. An absent player's turn is played for them; then the host removes them.
async function absentTurn() {
  const a = await Seat.create('Ann', { autoStart: false });
  const b = await Seat.join('Ben', a.roomId);
  const c = await Seat.join('Cat', a.roomId);
  const all = [a, b, c];
  log(`room ${a.roomId}: absent-player turn timer`);
  await startGame(a, all);

  // Drop whoever is up. If that's the host, the kick check below uses another host-less path,
  // so make sure the host stays: pass the turn along until a guest is up.
  let turn = a.state.currentTurnPlayerId;
  let away = all.find((s) => s.sessionId === turn);
  if (away === a) {
    const card = a.hand[a.hand.length - 1];
    a.send('play', { cards: [card] });
    await a.until((s) => s.currentTurnPlayerId !== turn, 'Ann to lead');
    turn = a.state.currentTurnPlayerId;
    away = all.find((s) => s.sessionId === turn);
  }
  const watcher = all.find((s) => s !== away);
  const cardsBefore = watcher.player(away.sessionId).handCount;
  const droppedAt = Date.now();
  away.drop();
  log(`${away.name} dropped on their own turn`);

  await sleep(15_000);
  check(watcher.state.currentTurnPlayerId === away.sessionId, 'timer: nothing happens for the first 15 s');

  await watcher.until((s) => s.currentTurnPlayerId !== away.sessionId, 'the table to play for the absent player', 45_000);
  const waited = (Date.now() - droppedAt) / 1000;
  check(waited >= TURN_TIMEOUT_S - 2 && waited < TURN_TIMEOUT_S + 15,
    `timer: the absent player's turn was played after ${waited.toFixed(1)} s`);
  const chat = watcher.state.chatMessages.map((m) => m.message).join('\n');
  check(/is away, so the table (passed|led)/.test(chat), 'timer: the table says it played for them');
  const after = watcher.player(away.sessionId).handCount;
  check(after === cardsBefore || after === cardsBefore - 1, 'timer: it passed or led a single card');

  // Only the host can remove a seat, and only one whose player is gone.
  const guest = all.find((s) => s !== a && s !== away);
  guest.send('kick', { playerId: away.sessionId });
  await guest.until((_, me) => me.msgs.some((m) => m.type === 'error' && /host/i.test(m.data.message)), 'non-host kick refused');
  check(!!a.player(away.sessionId), 'kick: a non-host cannot remove a seat');
  a.send('kick', { playerId: guest.sessionId });
  await a.until((_, me) => me.msgs.some((m) => m.type === 'error' && /still connected/.test(m.data.message)), 'kick of a connected player refused');
  check(!!a.player(guest.sessionId), 'kick: a connected player cannot be removed');

  a.send('kick', { playerId: away.sessionId });
  await a.until((s) => !s.players[away.sessionId], 'the absent seat to be removed');
  const s = a.state;
  check(!s.turnOrder.includes(away.sessionId), 'kick: the seat is gone from the turn order');
  check(s.phase === 'PLAYING' && [a.sessionId, guest.sessionId].includes(s.currentTurnPlayerId),
    'kick: play goes on with a connected player up');

  const stale = new Seat(away.name);
  Object.assign(stale, { roomId: away.roomId, sessionId: away.sessionId, token: away.token });
  const refused = await stale.resume().then(() => null, () => stale.closed);
  check(refused?.code === 4404, 'kick: the removed seat\'s token no longer works (4404)');
  all.forEach((x) => x !== away && x.ws.close());
}

// 4. Nobody plays for a connected player, however long they think.
async function connectedTurn() {
  const a = await Seat.create('Dee', { autoStart: false });
  const b = await Seat.join('Eli', a.roomId);
  log(`room ${a.roomId}: connected player thinking for ${TURN_TIMEOUT_S + 10} s`);
  await startGame(a, [a, b]);
  const turn = a.state.currentTurnPlayerId;
  const cards = a.state.players[turn].handCount;
  await sleep((TURN_TIMEOUT_S + 10) * 1000);
  check(a.state.currentTurnPlayerId === turn && a.state.players[turn].handCount === cards,
    `connected: nobody played for a connected player after ${TURN_TIMEOUT_S + 10} s`);
  a.ws.close();
  b.ws.close();
}

try {
  log(`smoke-reconnect against ${base}`);
  await lobbyResume();
  await gameResume();
  await Promise.all([absentTurn(), connectedTurn()]);
  log('all checks passed');
  process.exit(0);
} catch (err) {
  console.error(`${stamp()} FAIL ${err.message}`);
  process.exit(1);
}

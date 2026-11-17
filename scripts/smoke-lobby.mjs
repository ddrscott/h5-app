#!/usr/bin/env node
// Lobby smoke test against a running server (Node 22+, which has a global WebSocket).
//
//   npm run dev                                  # in one terminal
//   node scripts/smoke-lobby.mjs http://localhost:5173
//
// Checks: 5 players join and nothing starts; a guest's startGame is refused; a crafted
// object name and a 3,000-character name are cleaned up; a 7th join is refused as full;
// the host's startGame works; chat past 5 messages in 10 seconds is dropped.

const base = (process.argv[2] || 'http://localhost:5173').replace(/\/+$/, '');
const wsBase = `${base.replace(/^http/, 'ws')}/h5/api/rooms`;
const WAIT_MS = 5_000;

let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '  ok  ' : '  FAIL'}  ${label}`);
  if (!cond) failures++;
};

/** Opens a seat. Resolves with a handle once the first state arrives, or rejects with the close code. */
function seat(room, params = {}) {
  const url = new URL(`${wsBase}/${room}/ws`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const me = { ws, state: null, msgs: [], sessionId: null, roomId: null, waiters: [] };
    const poke = () => { me.waiters = me.waiters.filter((w) => !w()); };
    ws.onmessage = (ev) => {
      const f = JSON.parse(ev.data);
      if (f.t === 'joined') Object.assign(me, { sessionId: f.sessionId, roomId: f.roomId });
      if (f.t === 'msg') me.msgs.push(f);
      if (f.t === 'state') {
        const first = !me.state;
        me.state = f.s;
        if (first) resolve(me);
      }
      poke();
    };
    ws.onclose = (ev) => {
      if (!me.state) reject(Object.assign(new Error(ev.reason), { code: ev.code }));
    };
    me.send = (type, data = {}) => ws.send(JSON.stringify({ t: 'msg', type, data }));
    /** Waits until `pred(me)` holds, or WAIT_MS passes. */
    me.until = (pred) => new Promise((res) => {
      const check = () => { if (pred(me)) { res(true); return true; } return false; };
      if (check()) return;
      me.waiters.push(check);
      setTimeout(() => res(false), WAIT_MS);
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = (p) => p.msgs.filter((m) => m.type === 'error').map((m) => m.data.message);

const host = await seat('new', { name: 'Host' });
const room = host.roomId;
console.log(`room ${room} at ${base}`);

const guests = [];
for (const name of ['Bea', 'Cal', 'Dee']) guests.push(await seat(room, { name }));
const longName = await seat(room, { opts: JSON.stringify({ name: 'x'.repeat(3000) }) });
guests.push(longName);
await sleep(500);

ok(Object.keys(host.state.players).length === 5, '5 players are seated');
ok(host.state.phase === 'WAITING', `the game has not started (phase ${host.state.phase})`);
ok(host.state.hostId === host.sessionId, 'the room creator is host');

const guest = guests[0];
guest.send('startGame');
const refused = await guest.until((p) => errors(p).length > 0);
ok(refused && /Only the host/.test(errors(guest)[0]), `a guest's startGame is refused: "${errors(guest)[0]}"`);
await sleep(300);
ok(host.state.phase === 'WAITING', 'still waiting after the guest tried');

const longSeat = host.state.players[longName.sessionId];
ok(longSeat && longSeat.name.length <= 20, `a 3,000-character name is clipped to "${longSeat?.name}"`);

const crafted = await seat(room, { opts: JSON.stringify({ name: { toString: 'evil', length: 9999 } }) });
await host.until((p) => p.state.players[crafted.sessionId]);
const craftedName = host.state.players[crafted.sessionId]?.name;
ok(craftedName === 'Player 6', `a crafted object name becomes "${craftedName}"`);

try {
  const seventh = await seat(room, { name: 'Seventh' });
  ok(false, '7th join is refused');
  seventh.ws.close();
} catch (err) {
  ok(err.code === 4429, `7th join is refused with ${err.code}: "${err.message}"`);
}

host.send('startGame');
const started = await host.until((p) => p.state.phase === 'PLAYING');
ok(started, `the host's startGame starts the game (phase ${host.state.phase})`);

for (let i = 0; i < 7; i++) guest.send('chat', { text: `hi ${i}` });
await guest.until((p) => errors(p).some((e) => /Slow down/.test(e)));
await sleep(300);
const said = host.state.chatMessages.filter((m) => m.playerId === guest.sessionId && /^hi \d$/.test(m.message));
ok(said.length === 5, `chat flood: ${said.length} of 7 messages got through`);
ok(errors(guest).some((e) => /Slow down/.test(e)), 'the flooder got a private notice');
ok(!errors(host).some((e) => /Slow down/.test(e)), 'nobody else saw that notice');

for (const p of [host, ...guests, crafted]) p.ws.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall lobby checks passed');
process.exit(failures ? 1 : 0);

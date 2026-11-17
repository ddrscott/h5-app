Live at https://askscottpierce.com/h5

# Heart of Five (红心五)

A real-time multiplayer card shedding game built with React on Cloudflare Workers and Durable Objects. Race to be the first to play all your cards while mastering the power of the legendary Heart 5!

## Game Overview

Heart of Five is a strategic card game for 2-6 players where the goal is to be the first to empty your hand. What makes this game unique is the Heart 5 - the most powerful card that can beat any combination, adding exciting strategic depth to every game.

## Terminology

Understanding the game structure:

- **Trick/Round**: One play sequence where the leader plays a meld, others follow suit or pass, and a new leader is established
- **Game**: Multiple tricks played until all players except one are out of cards. The last player with cards loses the game
- **Session**: Multiple games played consecutively with cumulative win/loss tracking

## Game Flow

1. **Setup**: Cards are dealt evenly to all players from a standard 52-card deck
2. **First Trick**: The player with 3♥ leads the first trick
3. **Playing Tricks**: 
   - The leader plays any valid meld (single, pair, triple, or special combination)
   - Other players must play a higher meld of the same type or pass
   - When all players pass, the last player to play becomes the new leader
4. **Winning**: 
   - Players who run out of cards are ranked by order (1st, 2nd, etc.)
   - The first player out wins the game
   - The last player with cards loses the game
5. **Game Over**: 
   - Stats screen shows cumulative wins (1st place) and losses (last place)
   - Players can choose to play another game or leave
   - There's no target number of games - play continues as long as desired

## Card Rankings

From lowest to highest: 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2

**Special Card**: The Heart 5 (♥5) beats any combination!

## Valid Melds

- **Single**: Any single card
- **Pair**: Two cards of the same rank
- **Triple**: Three cards of the same rank
- **Bomb**: Four cards of the same rank (beats most combinations)
- **Run/Straight**: 5+ consecutive cards (e.g., 7-8-9-10-J)
- **Sisters**: 3+ consecutive pairs (e.g., 77-88-99)
- **Full House**: Triple + Pair (e.g., 777-88)

## How it runs

Everything runs on Cloudflare: one Worker serves the React client as static assets, and each game table is its own Durable Object.

```
browser ──HTTPS──▶ Worker (src/worker/index.ts) ──▶ static assets (dist/client)
        ──WSS────▶ /h5/api/rooms/:code/ws ──▶ HeartOfFiveRoom Durable Object (src/worker/room.ts)
```

- **One Durable Object per room**, named by its six-character room code. It holds the game state, runs the rules (`src/worker/game/GameState.ts`), and talks to players over WebSockets.
- **Hibernating sockets.** An idle table costs nothing. The full state, hands included, is saved to the object's storage after every action and reloaded when it wakes.
- **Alarms** take the place of server timers: the 30-second auto start, the turn timer for absent players, giving up a dropped lobby seat, and wiping a table nobody has come back to for 30 minutes. Every deadline is saved with the room, so it survives hibernation, and one alarm is set for the earliest.
- **Keeping your seat.** The room hands each player a secret token on join. The client keeps `{roomId, sessionId, token}` in `sessionStorage` (`h5-seat`, see `src/client/net/seat.ts`), so a page reload or a dropped connection takes the same seat back instead of joining as someone new. The host's bots keep theirs the same way (`h5-bots`). A dropped connection never plays or passes for anyone:
  - In the lobby, a dropped seat is kept for 2 minutes before the room gives it up. Leaving on purpose frees it at once.
  - In a game, the seat is kept for good. When it's an absent player's turn, the room waits 30 seconds and then plays for them: a pass when they may pass, their lowest single when they're leading. It never plays for a connected player, and it only runs while someone is still at the table.
  - The host can remove an absent player's seat (the remove control next to their name). Mid-round their cards leave with them and play moves on; if fewer than two players still hold cards, the round ends.
- **Reconnecting.** The client retries a dropped socket for two minutes behind a "Reconnecting…" banner, then shows "Lost connection" with Try again (reload and resume) and Back to home. It stops at once when the room answers with its own 4xxx close code.
- **Client.** `src/client/net/rooms.ts` is a small stand-in for colyseus.js with the same `Room` calls the hooks and bots already used (`onStateChange`, `onMessage`, `send`, `leave`). State arrives as a full public snapshot after each change. Hands never go in it; each player gets their own through the `your_hand` message.

### Wire protocol

JSON text frames on `/h5/api/rooms/new/ws` (create) or `/h5/api/rooms/:code/ws` (join).

| Direction | Frame | When |
|---|---|---|
| server → client | `{t:"joined", roomId, sessionId, token}` | once, when the socket opens |
| server → client | `{t:"state", s}` | after every change |
| server → client | `{t:"msg", type, data}` | game messages: `your_hand`, `your_turn`, `game_started`, `meld_played`, ... |
| server → client | `{t:"bye", code, reason}` | right before the room closes a seated socket on purpose |
| client → server | `{t:"msg", type, data}` | `play`, `pass`, `chat`, `startGame`, `ready`, `kick` (`{playerId}`, host only, absent players only) |
| client → server | `{t:"leave"}` | leaving on purpose |

A room that turns a player away closes the socket with a 4xxx code and a reason the client shows: 4404 not found (also a seat that's gone), 4423 already started, 4429 full. A seated socket can be closed with 4001 (the same seat was opened in another tab) or 4410 (the host removed the seat). The client never retries a 4xxx close, and it forgets the saved seat on 4404 and 4410.

Taking a seat back: open `/h5/api/rooms/:code/ws?session=<sessionId>&token=<token>`. The room answers with the same `joined` frame, the state, `game_state`, `your_hand`, and `your_turn` when it's your turn.

## Served at askscottpierce.com/h5

The Worker owns only `/h5` and `/h5/*` on askscottpierce.com, through two zone routes, with no workers.dev URL. Pages, assets, the service worker, the API, and the room sockets all live under `/h5`. Four places hard-code the prefix, and they have to change together:

- `src/client/base.ts`: `BASE`, used by the router, the API, and links
- `src/worker/index.ts`: `BASE`, which answers 404 outside the prefix
- `vite.config.ts`: `assetsDir: 'h5/assets'`, the service worker path and scope
- `wrangler.jsonc`: the routes and `run_worker_first`

The files in `public/h5/` (icons, `manifest.webmanifest`) are served at `/h5/...`. localStorage keys carry an `h5-` prefix because every app on the domain shares the origin.

## Development

Requires Node 20+.

```bash
npm install
npm run dev        # Vite + the Worker and Durable Object in workerd
```

Open `http://localhost:5173/h5/`. Test at `/h5/`, not `/`: the Worker returns 404 outside the prefix, which is how path mistakes show up early.

```bash
npm test           # game rules and snapshot round trips (node:test)
npm run typecheck  # client, worker, and Vite config
npm run build      # builds dist/client (assets) and dist/h5 (Worker)
```

With `npm run dev` running, a smoke test drives real rooms over WebSockets and checks keeping your seat: a dropped lobby seat and a dropped game seat taken back with the token, an absent player's turn played for them after the 30-second timer, a connected player's turn left alone, and the host removing an absent seat. It takes a little over a minute and exits non-zero on the first failure.

```bash
node scripts/smoke-reconnect.mjs http://localhost:5173
```

Three rule tests fail (a long A-K run, a longer straight flush beating a shorter one, and the all-pass leader test). They failed the same way under Colyseus, before the move to Cloudflare.

## Deploy

```bash
npm run deploy     # build, drop any copied .dev.vars, wrangler deploy
```

Check that the output lists the two `askscottpierce.com/h5` triggers and the `ROOMS` Durable Object binding.

### Project structure

```
├── index.html               # client entry (built to dist/client/index.html, served at /h5/)
├── public/h5/               # icons and web manifest, served at /h5/...
├── src/
│   ├── client/              # React app
│   │   ├── base.ts          # the /h5 prefix
│   │   ├── net/rooms.ts     # WebSocket room client
│   │   ├── bots/            # in-browser bots that join as players
│   │   ├── components/ contexts/ hooks/ types/
│   └── worker/
│       ├── index.ts         # Worker entry: routes /h5/api to rooms, the rest to assets
│       ├── room.ts          # HeartOfFiveRoom Durable Object
│       └── game/GameState.ts  # rules, deal, turns, and snapshots
├── vite.config.ts
└── wrangler.jsonc
```

### Key technologies
- **Server**: Cloudflare Workers, Durable Objects (SQLite-backed, hibernating WebSockets)
- **Client**: React, TypeScript, Vite, Tailwind CSS, with the Cloudflare Vite plugin
- **PWA**: Workbox service worker scoped to `/h5/`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
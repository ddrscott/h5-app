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
- **Alarms** take the place of server timers: wiping a table nobody has come back to for 30 minutes.
- **The host starts the game.** Nothing starts on its own. The room's creator is host; if they leave the lobby, the next seated human takes over, and while the host is disconnected mid-session the next connected human can run "Play Again". Bots count as players but never host. Tables hold 2 to 6 players, because two-deck play (7-8) deals duplicate card codes.
- **Limits.** Every player name, from the `name` query or `opts.name`, goes through `sanitizeName` (strings only, control and bidi characters stripped, 20 characters, falling back to "Player N"). Chat allows 5 messages per 10 seconds per player; extras are dropped and the sender gets a private `error`.
- **Reconnects.** A dropped connection gets a minute to take its seat back with a secret token the room handed out on join.
- **Client.** `src/client/net/rooms.ts` is a small stand-in for colyseus.js with the same `Room` calls the hooks and bots already used (`onStateChange`, `onMessage`, `send`, `leave`). State arrives as a full public snapshot after each change. Hands never go in it; each player gets their own through the `your_hand` message.

### Wire protocol

JSON text frames on `/h5/api/rooms/new/ws` (create) or `/h5/api/rooms/:code/ws` (join).

| Direction | Frame | When |
|---|---|---|
| server → client | `{t:"joined", roomId, sessionId, token}` | once, when the socket opens |
| server → client | `{t:"state", s}` | after every change |
| server → client | `{t:"msg", type, data}` | game messages: `your_hand`, `your_turn`, `game_started`, `meld_played`, ... |
| client → server | `{t:"msg", type, data}` | `play`, `pass`, `chat`, `startGame` (host only), `ready` |
| client → server | `{t:"leave"}` | leaving on purpose |

A room that turns a player away closes the socket with a 4xxx code and a reason the client shows: 4404 not found, 4423 already started, 4429 full (6 players max). The public state's `hostId` says who may start the game; anyone else's `startGame` gets an `error` saying who can.

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

With `npm run dev` running, a lobby smoke test drives real sockets against it: five players join and nothing starts, a guest's `startGame` is refused, crafted and oversized names are cleaned up, a seventh join is refused as full, the host's start works, and a chat flood is cut to five.

```bash
node scripts/smoke-lobby.mjs http://localhost:5173
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
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
- **Alarms** take the place of server timers: the turn timer for absent players, giving up a dropped lobby seat, and wiping a table nobody has come back to for 30 minutes. Every deadline is saved with the room, so it survives hibernation, and one alarm is set for the earliest.
- **The host starts the game.** Nothing starts on its own. The room's creator is host; if they leave the lobby, the next seated human takes over, and while the host is disconnected mid-session the next connected human acts as host (Play Again, removing absent seats). Bots count as players but never host. Tables hold 2 to 6 players, because two-deck play (7-8) deals duplicate card codes.
- **Limits.** Every player name, from the `name` query or `opts.name`, goes through `sanitizeName` (strings only, control and bidi characters stripped, 20 characters, falling back to "Player N"). Chat allows 5 messages per 10 seconds per player; extras are dropped and the sender gets a private `error`.
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
| client → server | `{t:"msg", type, data}` | `play`, `pass`, `chat`, `startGame` (host only), `ready`, `kick` (`{playerId}`, host only, absent players only) |
| client → server | `{t:"leave"}` | leaving on purpose |

A room that turns a player away closes the socket with a 4xxx code and a reason the client shows: 4404 not found (also a seat that's gone), 4423 already started, 4429 full (6 players max). A seated socket can be closed with 4001 (the same seat was opened in another tab) or 4410 (the host removed the seat). The client never retries a 4xxx close, and it forgets the saved seat on 4404 and 4410. The public state's `hostId` says who may start the game; anyone else's `startGame` gets an `error` saying who can.

Taking a seat back: open `/h5/api/rooms/:code/ws?session=<sessionId>&token=<token>`. The room answers with the same `joined` frame, the state, `game_state`, `your_hand`, and `your_turn` when it's your turn.

## Bots

Bots run in the host's browser and join the room as ordinary players (`src/client/bots/`). The host adds them in the lobby by personality.

### How a bot thinks

A bot can't see the other hands, so it imagines them. On its turn it:

1. Lists its legal plays. The candidates come from a fast generator, and every one is then put through the same rules the room uses (`src/shared/rules.ts`), so a bot can't send a play the room would refuse.
2. Takes anything certain (`search/exact.ts`): a play that goes out now; a **locked win**, where the hand splits into melds that nothing still unseen could beat plus at most one other; and the **last duel**, where two players are left, every other card has been seen, and the game is solved outright.
3. Otherwise searches (`search/engine.ts`, `search/tree.ts`). It deals the unseen cards to the other seats at random, in the hand sizes they're known to hold, leaning away from deals where somebody passed on a trick they could cheaply have taken. In each imagined deal it tries every candidate play and plays the game out with a quick rule-of-thumb player in every seat (`search/sim.ts`). That player works from a hand decomposition: lead the natural meld that holds your lowest card, don't break pairs and runs to follow, and keep bombs, 2s, jokers and the Heart 5 back until they win something. A search tree under each candidate remembers which follow-ups worked for whoever made them. Plays are scored by finishing place (first out is best, last holding cards is worst), and plays that fall clearly behind are dropped so the time goes to the close calls.

The search can stop at any moment and answer with the best play so far. If it ever fails, the old rule-based strategy answers instead, and that answer is checked against the rules too.

### Personalities

Each bot seat shows its personality: an icon and a name (hover for the one-line description), and "thinking…" while it works on its move. They're defined in `src/client/bots/personas.ts`.

| Personality | Bot | How it plays | Thinks for |
|---|---|---|---|
| Shark | Expert Emma | Counts every card, grows a search tree, takes every sure thing. The strong one. | 1.5 s |
| Regular | Balanced Betty | A short search and an occasional loose choice. | 0.5 s |
| Hothead | Aggressive Annie | Plays to win outright and doesn't mind coming last. Sheds big, spends bombs and the Heart 5 early, hates passing. | 0.5 s |
| Turtle | Cautious Carl | Plays not to come last. Sits on its 2s, jokers and bombs, and passes more. | 1 s |
| Rookie | Rookie Ricky | Barely searches, forgets what's been played, and makes a random move about one turn in eight. | 0.3 s |

### Thinking time

Every bot has a time budget per move. The lobby's "Thinks for up to" picker sets it when the bot is added (0.5 to 5 seconds; the default is the personality's own pace), and it's stored on the bot as `thinkSeconds`, clamped to 0.2-5 s. The search runs in 10 ms slices and hands the thread back between them, so the table keeps animating while a bot thinks; the pauses use a `MessageChannel`, because a background tab slows `setTimeout` to a crawl. A bot that would be instant still waits about half a second, so cards don't snap down. All of this stays far inside the room's 30-second timer, which only applies to absent players anyway.

Most of the strength arrives in the first few hundred playouts, which takes a few milliseconds. In self-play, eight times the playouts made no measurable difference, so a longer budget buys pacing more than it buys strength.

### The bot contract

A bot is one function, `decide(view) -> move`, and both sides are plain JSON. The types are in `src/client/bots/contract.ts`: the view holds the bot's hand, its legal moves, the meld on the table, every player's card count, the cards played, the history of plays and passes, and the time budget; the move is `{action: "pass"}` or `{action: "play", cards: [...codes]}`. The built-in personalities go through this contract (`builtin.ts`), hosted by `strategies/ContractStrategy.ts`, which builds the view, enforces the deadline, and checks the answer with `checkMove()` before it goes to the room.

### Self-play

```bash
npm run selfplay                       # the standard tables, about a minute
npm run selfplay -- --deals 25         # quicker and noisier
npm run selfplay -- --rollouts 800     # let the search bots think harder
npm run selfplay -- --table shark,regular,old:balanced,old:cautious
```

`scripts/selfplay.ts` plays whole games on the real `GameState` with no browser. Seats are personalities or the old strategies (`old:balanced`, `old:aggressive`, `old:cautious`). Deals are seeded, and each one is replayed with the entrants rotated through the seats. Search bots get a fixed number of playouts per move instead of a clock (400 by default, scaled by personality), so runs repeat exactly.

Results from `npm run selfplay -- --deals 100` (400 games a table, four players, so even odds are 25% each way; "last" is the one left holding cards):

| Table | Entrant | Win | Last |
|---|---|---|---|
| One Shark, three old Balanced | Shark | 79.5% | 0.0% |
| | old Balanced (each) | 6.8% | 33.3% |
| Shark and one of each old strategy | Shark | 79.3% | 0.3% |
| | old Balanced / Aggressive / Cautious | 5.8% / 10.5% / 4.5% | 25.3% / 31.3% / 43.3% |
| The personalities together | Shark | 39.5% | 9.0% |
| | Hothead | 35.0% | 19.5% |
| | Turtle | 17.0% | 5.8% |
| | Rookie | 8.5% | 65.8% |
| Regular and the three old strategies | Regular | 62.8% | 3.3% |
| Rookie and the three old strategies | Rookie | 32.8% | 17.0% |

The search bots never answered with an illegal play. The old strategies did, a handful of times per 400 games; in a live room that play is refused and the bot tries again.

## Look and feel

The art direction, card design, palette, type and motion rules are in [docs/VISUALS.md](docs/VISUALS.md). In short, the game has a lacquered jade table, warm card stock, cinnabar and brass, and Signal Orange for whatever is live. Cards are springy physical objects. Plays fly in from the seat that made them, and combo callouts, shake and particles scale with the play's strength. All sound is synthesized with the Web Audio API (`src/client/fx/sound.ts`), and one mute switch covers sound and vibration. The motion library is `motion` (`motion/react`), and the app runs inside `MotionConfig reducedMotion="user"`, so `prefers-reduced-motion` turns movement into fades.

**No terminal aesthetic in this project.** It's a family card game, so there's no monospace font, no `// SECTION_HEADS`, no snake_case labels, and no `$` prompt markers. That overrides the owner's default visual signature. Keep the orange accent and the hard-edged panels.

Two pages help when working on it:

- `/h5/animation` is the **FX lab**: the real `GameTable` on a scripted offline game, with buttons (and `window.__lab` for scripts) for the deal, every meld type, a bomb, the Heart 5, passes, the sweep, going out, an error and game over.
- `/h5/cards` shows every card face and the back.

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
npm test           # game rules, snapshot round trips, and the bots (node:test)
npm run typecheck  # client, worker, and Vite config
npm run build      # builds dist/client (assets) and dist/h5 (Worker)
```

With `npm run dev` running, two smoke tests drive real sockets against it. The lobby test checks that five players join and nothing starts, a guest's `startGame` is refused, crafted and oversized names are cleaned up, a seventh join is refused as full, the host's start works, and a chat flood is cut to five. The reconnect test checks keeping your seat: a dropped lobby seat and a dropped game seat taken back with the token, an absent player's turn played for them after the 30-second timer, a connected player's turn left alone, and the host removing an absent seat. It takes a little over a minute and exits non-zero on the first failure.

```bash
node scripts/smoke-lobby.mjs http://localhost:5173
node scripts/smoke-reconnect.mjs http://localhost:5173
```

Two rule tests fail: a long A-K run, and a longer straight flush beating a shorter one. Both turn on whether a 2 can sit low in a run, which the owner has yet to settle.

## Deploy

```bash
npm run deploy     # build, drop any copied .dev.vars, wrangler deploy
```

Check that the output lists the two `askscottpierce.com/h5` triggers and the `ROOMS` Durable Object binding.

### Project structure

```
├── docs/VISUALS.md           # art direction and motion rules
├── index.html               # client entry (built to dist/client/index.html, served at /h5/)
├── public/h5/               # icons and web manifest, served at /h5/...
├── src/
│   ├── client/              # React app
│   │   ├── base.ts          # the /h5 prefix
│   │   ├── net/rooms.ts     # WebSocket room client
│   │   ├── bots/            # in-browser bots that join as players
│   │   │   ├── contract.ts  # decide(view) -> move: the bot interface, plain JSON
│   │   │   ├── personas.ts  # the personalities and their dials
│   │   │   └── search/      # imagined deals, playouts, search tree, exact endgames
│   │   ├── components/ contexts/ hooks/ types/
│   │   ├── fx/              # sound, haptics, particles, layout and the FX event bus
│   ├── shared/rules.ts      # what a meld is and what beats what; used by the room and the bots
│   └── worker/
│       ├── index.ts         # Worker entry: routes /h5/api to rooms, the rest to assets
│       ├── room.ts          # HeartOfFiveRoom Durable Object
│       └── game/GameState.ts  # rules, deal, turns, and snapshots
├── scripts/selfplay.ts      # bots against bots on the real rules, for measuring strength
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
Live at https://askscottpierce.com/h5

# Heart of Five (红心五)

A real-time multiplayer card shedding game built with React on Cloudflare Workers and Durable Objects. Race to be the first to play all your cards while mastering the power of the legendary Heart 5!

## Game Overview

Heart of Five is a strategic card game for 2-6 players where the goal is to be the first to empty your hand. What makes this game unique is the Heart 5 - the most powerful card that can beat any combination, adding exciting strategic depth to every game.

## Terminology

Understanding the game structure:

- **Trick/Round**: One play sequence where the leader plays a meld, others follow suit or pass, and a new leader is established
- **Game**: Multiple tricks played until all players except one are out of cards. The last player with cards loses the game
- **Session**: Multiple games played consecutively with cumulative win/loss tracking. Session records end with the room; signed-in players also keep permanent stats across rooms and devices

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
        ──HTTPS──▶ /h5/api/auth/*, /h5/api/me, /h5/api/stats ──▶ D1 "h5" (src/worker/auth.ts)
        ──WSS────▶ /h5/api/rooms/:code/ws ──▶ HeartOfFiveRoom Durable Object (src/worker/room.ts) ──▶ D1 game_results
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
- **Accounts are optional.** Anyone can sign up with an email; guests create and join tables exactly as before and just don't keep stats. Sign-in is the same emailed-code flow as askscottpierce.com/tasks (`src/worker/auth.ts`): a 6-digit code plus a one-click link, only hashes stored in D1, a 30-day `h5sid` cookie with `Path=/h5; HttpOnly; SameSite=Lax; Secure` (never `Path=/`, since every app on the domain shares the origin). A code lasts 10 minutes and allows 5 tries; a resend waits 30 seconds; guesses are also capped per email (10 an hour, 20 a day) and per IP (30 an hour), across resends. The emailed link opens `/h5/?email=…&code=…` and the page submits it with JavaScript (`src/client/contexts/AccountContext.tsx`), because a plain GET that signed you in would be burned by mail scanners. Mail goes from `hey@askscottpierce.com` through the `EMAIL` send_email binding. With `DEV_LOGIN_CODES=1` (only ever in `.dev.vars`) no email is sent and the code comes back in the response and shows on screen.
- **Permanent stats.** The socket upgrade is same-origin, so it carries the session cookie. The Worker looks up the user and passes the id to the room in an `X-H5-User` header, after deleting any header of that name the client sent, so it can't be forged. The room keeps a user per seat (`RoomMeta.users`). Bots never get one, even though a bot's socket comes from the host's browser with the host's cookie. A seat taken back with its token keeps its user; a guest seat that comes back signed in takes the new user. After signing in mid-session the client reopens its socket to the same seat (`Room.refresh()`), so the account counts from the next deal.
  - At every deal the room notes who's seated (`RoomMeta.dealt`), and that decides the bucket: **PvP** when every seat is a person, **mixed** for two or more people plus a bot, **vs computer** for one person and the rest bots (`classifyBucket` in `src/worker/stats.ts`).
  - When a game ends, each signed-in person who was dealt in and is still seated gets one `game_results` row: bucket, finishing place, win (first out), loss (last holding cards). A game that ends with nobody out (the host removed seats until one was left) counts for nobody.
  - Rows are keyed by `(game_key, user_id)` where `game_key` is `<room>:<room created at>:<deal number>`, and written with `INSERT OR IGNORE`. They're queued in `RoomMeta.pendingStats` and saved with the room before the write, so a write cut off by eviction is retried (on the next action or a 30-second alarm) and can never count twice. A room isn't wiped while it still has unsaved results.
  - The room tells a tracked player `stats_tracking` at the deal and `stats_saved` once the row is written; the game-over panel shows "Saved to your stats", or a sign-in nudge for guests. `/h5/api/stats` totals games, wins, losses, win rate, and average place per bucket.
- **Client.** `src/client/net/rooms.ts` is a small stand-in for colyseus.js with the same `Room` calls the hooks and bots already used (`onStateChange`, `onMessage`, `send`, `leave`). State arrives as a full public snapshot after each change. Hands never go in it; each player gets their own through the `your_hand` message.

### Wire protocol

JSON text frames on `/h5/api/rooms/new/ws` (create) or `/h5/api/rooms/:code/ws` (join).

| Direction | Frame | When |
|---|---|---|
| server → client | `{t:"joined", roomId, sessionId, token}` | once, when the socket opens |
| server → client | `{t:"state", s}` | after every change |
| server → client | `{t:"msg", type, data}` | game messages: `your_hand`, `your_turn`, `game_started`, `meld_played`, ... |
| server → client | `{t:"bye", code, reason}` | right before the room closes a seated socket on purpose |
| server → client | `{t:"msg", type:"stats_tracking", data:{bucket}}` | at the deal (and on resume), only to a signed-in seat whose game counts |
| server → client | `{t:"msg", type:"stats_saved", data:{bucket, place, win, loss}}` | once that game's result is written to D1 |
| client → server | `{t:"msg", type, data}` | `play`, `pass`, `chat`, `startGame` (host only), `ready`, `kick` (`{playerId}`, host only, absent players only), `autopilot` (`{name}` or `{name: null}`, labels your seat while an uploaded bot plays it) |
| client → server | `{t:"leave"}` | leaving on purpose |

A room that turns a player away closes the socket with a 4xxx code and a reason the client shows: 4404 not found (also a seat that's gone), 4423 already started, 4429 full (6 players max). A seated socket can be closed with 4001 (the same seat was opened in another tab) or 4410 (the host removed the seat). The client never retries a 4xxx close, and it forgets the saved seat on 4404 and 4410. The public state's `hostId` says who may start the game; anyone else's `startGame` gets an `error` saying who can.

The upgrade request's `h5sid` cookie is the only way a seat gets a user; there's nothing in the protocol for it. `bucket` is `pvp`, `mixed`, or `computer`.

#### Account API

JSON over `/h5/api`, same origin, cookie auth.

| Request | Answer |
|---|---|
| `POST /api/auth/start {email}` | `{ok}`, or `{ok, devCode}` under `DEV_LOGIN_CODES=1`; 429 within 30 s of the last code |
| `POST /api/auth/verify {email, code}` | `{ok}` and `Set-Cookie: h5sid=…`, or 400 `{error}` (wrong, expired, too many tries) |
| `POST /api/auth/logout` | `{ok}`, clears the cookie and the session |
| `GET /api/me` | `{id, email, name}` or `null` |
| `POST /api/me {name}` | sets the display name (same cleanup as table names) |
| `GET /api/stats` | `{stats: {pvp, mixed, computer}}`, each `{games, wins, losses, winRate, avgPlace}`; 401 signed out |

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

## Bring your own bot

A player can upload or paste a JavaScript bot and hand it **their own seat**, and take the seat back at any time. A host can also seat it as an extra player from the lobby. The bot runs in the player's browser. The server doesn't run or trust it: it sees ordinary `play` and `pass` frames and referees them like any other. The only server change is the `autopilot` label, which puts a small bot badge with the bot's name on that seat for everyone at the table. It's cleared when the player takes over or their socket drops.

The bot button sits in the header, next to the mute switch, in the lobby and at the table. Its panel has a file picker and a paste box, the bots saved in this browser (localStorage, `h5-my-bots`; there's no server storage or gallery yet), a test run on a sample turn, a one-screen "How to write a bot" guide, and a downloadable starter bot. While a bot plays for you, a strip under the logo says so, with a Take over button.

### The contract

A bot is a plain script (no `import` or `export`, 200 KB at most) that defines `decide(view)` and returns a move. `decide` may be async, and variables at the top level last between turns. The types are in `src/client/bots/sandbox/contract.ts`; both sides are plain JSON. This is a simpler shape than the built-in bots' contract (`src/client/bots/contract.ts`): card codes as strings and `{pass: true}`. The two haven't been unified yet.

```js
// view
{
  me: "a1b2",                                   // your seat
  hand: ["3C", "3D", "9H", "TS", "5H"],         // your cards, lowest first
  legalMoves: [{ cards: ["9H"] }, { cards: ["TS"] }, { pass: true }],
  table: { cards: ["8S"], type: "SINGLE", by: "c3d4" },  // null when you lead
  players: [{ id, name, cards, out, passed }],  // seat order, you included
  history: [{ by: "c3d4", cards: ["8S"] }, { by: "e5f6", pass: true }],  // this game, oldest first
  timeBudgetMs: 2000
}
// move
{ cards: ["9H"] }   or   { pass: true }
```

Cards are rank then suit: ranks `3 4 5 6 7 8 9 T J Q K A 2`, suits `C D H S`, jokers `jj` and `JJ`. `legalMoves` lists every legal move, a pass included when passing is allowed (never when you lead). For runs and sisters it gives one choice of suits per shape; any other suits from your hand that make the same legal play are accepted too. The starter bot is `src/client/bots/sandbox/examples/starter-bot.js`.

The client works out legal moves with the rules port in `src/client/fx/rules.ts` (`src/client/bots/sandbox/moves.ts`), because the client can't import `GameState.ts` under its strict settings. `src/worker/game/bot-moves.test.ts` holds the two together: every listed move must pass `GameState.describeInvalidPlay`, and the reply check must agree with it on thousands of random plays.

### Security model

- **Where it runs.** Each bot runs in a dedicated Web Worker started from a blob: URL inside a hidden `<iframe sandbox="allow-scripts">` (no `allow-same-origin`). The iframe and the worker get an opaque origin (`null`), so the bot can't reach cookies, localStorage, sessionStorage (where the seat token lives), IndexedDB, or the app's DOM.
- **No network.** The iframe's CSP is `default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:`, and the worker inherits it. With no `connect-src`, fetch, XMLHttpRequest, WebSocket and EventSource fail; `script-src` stops `importScripts` of any remote URL and `eval`. CSP can't tell a bot's own blob: worker from ours, so the worker deletes `Worker` and `SharedWorker` before the bot's code runs.
- **Only JSON in and out.** The app talks to the frame with `postMessage` and checks `event.source`. The view holds only what the human in that seat can see: their own hand, never anyone else's. The reply has to be a legal move (a pass when passing is allowed, or distinct cards from the hand that the rules accept). Anything else becomes a pass, or the lowest single when leading, the same move the server's turn timer plays.
- **Time.** Each move gets 2 seconds by default and never more than 5, well under the server's 30-second timer. On overrun the frame calls `terminate()` on the worker, the frame is thrown away, the fallback move is played, and a fresh sandbox starts for the next turn. A script that doesn't finish loading in 5 seconds is stopped too. Timeouts and crashes are strikes; three in a game turn autoplay off and tell the player. A benched extra seat keeps playing the fallback move so the game goes on.
- **Consent.** Scripts over 200 KB are refused. The first time a player saves or runs a bot, the game asks "This runs code in your browser" and remembers the answer in this browser (`h5-bot-consent`).

### Checking it

With `npm run dev` running, two Playwright scripts (Playwright installed globally or in the project) check the sandbox and a real game:

```bash
node scripts/smoke-bot-sandbox.mjs http://localhost:5173   # chromium, firefox and webkit
node scripts/smoke-bot-game.mjs http://localhost:5173 /tmp/bot-shots
```

The sandbox script runs the test bots in `src/client/bots/sandbox/examples/`. The escape bot tries fetch and XHR against a local server that allows any origin (it must get zero requests), a WebSocket to the game's own room endpoint, `importScripts`, `new Worker`, `eval`, localStorage, IndexedDB and the DOM. The timeout bot spins forever in `decide` and must be stopped within its budget on two turns in a row while the page keeps running; a 60-second budget must be cut to 5. The slow-start bot spins while loading. It also checks that crashes, syntax errors and a missing `decide` are reported, and that every sandbox frame is cleaned up. The game script seats two humans whose starter bots play a whole game with a built-in bot and an extra uploaded-bot seat, checks each human sees the other's badge, then switches the host to a looping bot and checks it strikes out and hands the seat back. `/h5/botlab` runs any bot on two sample turns by hand.

## Look and feel

The art direction, card design, palette, type and motion rules are in [docs/VISUALS.md](docs/VISUALS.md). In short, the game has a lacquered jade table, warm card stock, cinnabar and brass, and Signal Orange for whatever is live. Cards are springy physical objects. Plays fly in from the seat that made them, and combo callouts, shake and particles scale with the play's strength. All sound is synthesized with the Web Audio API (`src/client/fx/sound.ts`), and one mute switch covers sound and vibration. The motion library is `motion` (`motion/react`), and the app runs inside `MotionConfig reducedMotion="user"`, so `prefers-reduced-motion` turns movement into fades.

**No terminal aesthetic in this project.** It's a family card game, so there's no monospace font, no `// SECTION_HEADS`, no snake_case labels, and no `$` prompt markers. That overrides the owner's default visual signature. Keep the orange accent and the hard-edged panels.

Two pages help when working on it:

- `/h5/animation` is the **FX lab**: the real `GameTable` on a scripted offline game, with buttons (and `window.__lab` for scripts) for the deal, every meld type, a bomb, the Heart 5, passes, the sweep, going out, an error and game over.
- `/h5/cards` shows every card face and the back.

`scripts/shots-pile.mjs` drives the FX lab in headless Chromium. It puts a pair and a triple on the table, then a full house, a five-card run, sisters, a single and an eight-card run, at square (car screen), desktop, tablet and phone sizes. It saves a screenshot of each and prints the newest meld's card width, how much of each covered card's corner shows, and whether a corner runs under the hand, a plate or the buttons. Pass sizes and melds to narrow it down:

```bash
node scripts/shots-pile.mjs http://localhost:5173 /tmp/pile 640x640,1000x1000 fullhouse,run8
```

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

`npm run dev` first applies the D1 migrations to the local database (`.wrangler/state`). Copy `.dev.vars.example` to `.dev.vars` so sign-in codes show on screen instead of being emailed; never put `DEV_LOGIN_CODES` anywhere else.

Open `http://localhost:5173/h5/`. Test at `/h5/`, not `/`: the Worker returns 404 outside the prefix, which is how path mistakes show up early.

```bash
npm test           # game rules, snapshots, the bots, stats buckets and idempotency, sign-in codes (node:test)
npm run typecheck  # client, worker, and Vite config
npm run build      # builds dist/client (assets) and dist/h5 (Worker)
```

Tests that touch D1 run the real migrations against `node:sqlite` through a small stand-in (`src/worker/test/d1.ts`).

With `npm run dev` running, three smoke tests drive real sockets against it. The lobby test checks that five players join and nothing starts, a guest's `startGame` is refused, crafted and oversized names are cleaned up, a seventh join is refused as full, the host's start works, and a chat flood is cut to five. The reconnect test checks keeping your seat: a dropped lobby seat and a dropped game seat taken back with the token, an absent player's turn played for them after the 30-second timer, a connected player's turn left alone, and the host removing an absent seat. It takes a little over a minute. The stats test signs in with a dev code (after a wrong one is refused), plays a whole game against a bot whose socket carries the same cookie, sees `stats_tracking` and `stats_saved`, checks vs computer went up by exactly one game and a Play Again adds a second, checks a guest game changes nothing, and signs out. Each exits non-zero on the first failure.

```bash
node scripts/smoke-lobby.mjs http://localhost:5173
node scripts/smoke-reconnect.mjs http://localhost:5173
node scripts/smoke-stats.mjs http://localhost:5173
```

Two rule tests fail: a long A-K run, and a longer straight flush beating a shorter one. Both turn on whether a 2 can sit low in a run, which the owner has yet to settle.

## Deploy

**Every push to `main` deploys.** `.github/workflows/deploy.yml` runs `npm ci`, the typecheck, the remote D1 migrations, then `npm run deploy`, one deploy at a time in push order. That includes Thunder merges to `main`. It needs the repo variable `CLOUDFLARE_ACCOUNT_ID` and the secret `CLOUDFLARE_API_TOKEN`, a token scoped to Workers Scripts Write, D1 Write, and Workers Routes Write on askscottpierce.com. `scripts/ci-token.sh` makes it with `CF_TOKEN_MANAGER` and pipes it straight into `gh secret set`, so it's never printed; running it again makes a second token, so delete the old one in the dashboard. CI skips `npm test` because of the two known rule failures below. Run it locally before you push. You can also run the workflow by hand from the Actions tab.

To deploy from this machine instead:

```bash
npm run db:migrate # apply migrations/ to the remote D1 database "h5" (first deploy, and after any new migration)
npm run deploy     # build, drop any copied .dev.vars, wrangler deploy
```

Check that the output lists the two `askscottpierce.com/h5` triggers, the `ROOMS` Durable Object, the `DB` D1 database, and the `EMAIL` send_email binding. Email Sending is already on for askscottpierce.com, so there's nothing to enable. The D1 database was made with `npx wrangler d1 create h5`; its id is in `wrangler.jsonc`.

### Project structure

```
├── docs/VISUALS.md           # art direction and motion rules
├── migrations/              # D1 schema: users, login codes, sessions, guess limits, game_results
├── index.html               # client entry (built to dist/client/index.html, served at /h5/)
├── public/h5/               # icons and web manifest, served at /h5/...
├── src/
│   ├── client/              # React app
│   │   ├── base.ts          # the /h5 prefix
│   │   ├── net/rooms.ts     # WebSocket room client
│   │   ├── net/account.ts   # sign-in and stats API calls
│   │   ├── components/account/  # sign-in and stats dialogs
│   │   ├── bots/            # in-browser bots that join as players
│   │   │   ├── contract.ts  # decide(view) -> move: the built-in bots' interface, plain JSON
│   │   │   ├── personas.ts  # the personalities and their dials
│   │   │   ├── search/      # imagined deals, playouts, search tree, exact endgames
│   │   │   └── sandbox/     # uploaded bots: their contract, sandbox, legal moves, seat pilot, example bots
│   │   ├── components/ contexts/ hooks/ types/
│   │   ├── fx/              # sound, haptics, particles, layout and the FX event bus
│   ├── shared/rules.ts      # what a meld is and what beats what; used by the room and the bots
│   └── worker/
│       ├── index.ts         # Worker entry: routes /h5/api to rooms, the rest to assets
│       ├── room.ts          # HeartOfFiveRoom Durable Object
│       ├── auth.ts          # email sign-in, sessions, /api/me, /api/stats
│       ├── stats.ts         # stats buckets, result rows, totals
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
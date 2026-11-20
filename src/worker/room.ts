import { DurableObject } from "cloudflare:workers";
import { GameState, GamePhase, Card, Player, Meld, saveState, restoreState, publicState, sanitizeName, RateLimiter } from "./game/GameState";
import type { Env } from "./env";
import { classifyBucket, recordResults, resultRows, type ResultRow, type SeatAtDeal } from "./stats";

/**
 * One Heart of Five table. Each room is its own Durable Object, named by its room code.
 *
 * Wire protocol (JSON text frames):
 *   server → client  {t:"joined", roomId, sessionId, token}   once, right after the socket opens
 *                    {t:"state", s}                            full public state, after every change
 *                    {t:"msg", type, data}                     a game message ("your_hand", "your_turn", ...)
 *                    {t:"bye", code, reason}                   right before the room closes a seat's socket
 *   client → server  {t:"msg", type, data}                     "play", "pass", "chat", "startGame", "ready", "kick", "autopilot"
 *                    {t:"leave"}                               leaving on purpose
 *
 * A dropped socket keeps its seat: in the lobby for LOBBY_GRACE_MS, in a game for good (the host
 * can remove it with "kick"). When it's an absent player's turn, the room plays for them after
 * TURN_TIMEOUT_MS. Every deadline lives in RoomMeta, so it survives hibernation, and one alarm
 * serves them all (see syncAlarm()).
 *
 * Sockets use the hibernation API, so an idle table costs nothing. Anything that has to
 * survive hibernation lives in storage under "room" and is reloaded in the constructor.
 */

export interface HeartOfFiveOptions {
  minPlayers?: number;
  maxPlayers?: number;
  targetWins?: number;
  testMode?: boolean;
  testDeckSize?: number; // Number of cards per player for test mode
  testDeck?: string; // Exact deck specification for test mode (e.g., "5H 6H 7H 8H 5C 3C 4C 5C")
}

interface RoomMeta {
  roomId: string;
  origin: string;
  minPlayers: number;
  maxClients: number;
  testMode: boolean;
  testDeckSize: number;
  testDeck: string;
  locked: boolean;
  createdAt: number;
  creatorName?: string;
  /** Reconnect secrets by session id. A dropped socket can take its seat back with one. */
  tokens: Record<string, string>;
  cleanupAt?: number;
  /** When the room plays for an absent player whose turn it is. */
  turnTimer?: { playerId: string; at: number };
  /** Lobby seats whose socket dropped, and when they're given up. */
  dropDeadlines?: Record<string, number>;
  /** Signed-in user per seat, set by the Worker from the session cookie. Bots never have one. */
  users?: Record<string, string>;
  /** Games dealt in this room so far; part of each game's stats key. */
  gameSeq?: number;
  /** Who was seated when the current game was dealt. Cleared once its results are queued. */
  dealt?: { seq: number; seats: SeatAtDeal[] };
  /** Results waiting to be written to D1. Writes are idempotent, so a retry can't double count. */
  pendingStats?: ResultRow[];
  /** When to retry pendingStats after a failed write. */
  statsRetryAt?: number;
}

interface Attachment {
  sessionId: string;
  left?: boolean;
}

/** The slice of a Colyseus client the game code uses. */
interface Client {
  sessionId: string;
  send(type: string, data?: unknown): void;
}

/** Two-deck play (7-8 players) deals duplicate card codes, so tables stop at 6 until that's fixed. */
const MAX_PLAYERS = 6;
const MIN_PLAYERS = 2;
const CHAT_MAX = 5;
const CHAT_WINDOW_MS = 10_000;
/** How long an empty table waits for someone to come back before it's wiped. */
const EMPTY_ROOM_TTL_MS = 30 * 60_000;
const MAX_FRAME_BYTES = 8_192;
/** How long an absent player's turn waits before the room plays for them. */
const TURN_TIMEOUT_MS = 30_000;
/** How long a lobby seat waits for its dropped player to come back. */
const LOBBY_GRACE_MS = 2 * 60_000;
/** How long to wait before retrying a failed stats write. */
const STATS_RETRY_MS = 30_000;

// Close codes the client turns into join errors.
const CLOSE_NOT_FOUND = 4404;
const CLOSE_LOCKED = 4423;
const CLOSE_FULL = 4429;
const CLOSE_TAKEN = 4409;
const CLOSE_REPLACED = 4001;
const CLOSE_REMOVED = 4410;

/** A player-count option, kept within 2..6. */
const clampPlayers = (n: unknown, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.floor(n))) : fallback;

const randomId = (n: number) => {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
};

export class HeartOfFiveRoom extends DurableObject<Env> {
  private meta: RoomMeta | null = null;
  private state: GameState | null = null;
  private lastStateJson = "";
  private pendingTurnNotification = false;
  /** In memory only: hibernation resetting it just forgives a burst. */
  private chatLimit = new RateLimiter(CHAT_MAX, CHAT_WINDOW_MS);

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<{ meta: RoomMeta; state: unknown }>("room");
      if (saved) {
        this.meta = saved.meta;
        this.state = restoreState(saved.state);
        this.lastStateJson = JSON.stringify(publicState(this.state));
      }
    });
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  // ---------------------------------------------------------------------------
  // Connection handling
  // ---------------------------------------------------------------------------

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get("Upgrade") !== "websocket") {
      return Response.json({ error: "Expected a WebSocket upgrade" }, { status: 426 });
    }

    const url = new URL(req.url);
    const createId = req.headers.get("X-H5-Create");
    // Set only by the Worker (src/worker/index.ts), from the session cookie.
    const userId = req.headers.get("X-H5-User") || undefined;
    const queryName = url.searchParams.get("name");
    let options: HeartOfFiveOptions & { name?: unknown; bot?: unknown } = {};
    try {
      const parsed = JSON.parse(url.searchParams.get("opts") || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) options = parsed;
    } catch {
      /* ignore bad options */
    }

    if (createId) {
      if (this.meta) return this.reject(CLOSE_TAKEN, "Room code collision, try again");
      this.onCreate(createId, url.origin, options);
    }
    if (!this.meta || !this.state) return this.reject(CLOSE_NOT_FOUND, "Room not found");

    // Taking a seat back after a dropped connection.
    const resumeId = url.searchParams.get("session");
    const resumeToken = url.searchParams.get("token");
    if (resumeId && resumeToken) {
      if (this.meta.tokens[resumeId] !== resumeToken || !this.state.players.has(resumeId)) {
        return this.reject(CLOSE_NOT_FOUND, "That seat is gone");
      }
      // Drop any stale socket still holding this seat.
      for (const ws of this.ctx.getWebSockets(resumeId)) {
        this.attach(ws, { sessionId: resumeId, left: true });
        this.closeWith(ws, CLOSE_REPLACED, "This seat was opened somewhere else");
      }
      // A seat keeps the user it has. One that had none (a guest who signed in since) takes the
      // new one, and starts counting from the next deal.
      if (userId && !this.meta.users?.[resumeId] && !this.state.players.get(resumeId)!.isBot) {
        this.meta.users = { ...this.meta.users, [resumeId]: userId };
      }
      const [client, ws] = this.accept(resumeId, resumeToken);
      await this.onReconnect(this.clientFor(ws));
      await this.flush(ws);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (this.meta.locked) return this.reject(CLOSE_LOCKED, "That game already started");
    const cap = Math.min(this.meta.maxClients, MAX_PLAYERS);
    if (this.state.players.size >= cap) {
      return this.reject(CLOSE_FULL, `That table is full (${cap} players max)`);
    }

    const sessionId = randomId(9);
    const token = crypto.randomUUID();
    this.meta.tokens[sessionId] = token;
    const isBot = options.bot === true;
    // A bot's socket comes from its host's browser and carries the host's cookie: never give it the user.
    if (userId && !isBot) this.meta.users = { ...this.meta.users, [sessionId]: userId };
    const [client, ws] = this.accept(sessionId, token);
    this.onJoin(this.clientFor(ws), { name: queryName ?? options.name, bot: isBot });
    await this.flush(ws);
    return new Response(null, { status: 101, webSocket: client });
  }

  private accept(sessionId: string, token: string): [WebSocket, WebSocket] {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [sessionId]);
    this.attach(server, { sessionId });
    server.send(JSON.stringify({ t: "joined", roomId: this.meta!.roomId, sessionId, token }));
    this.meta!.cleanupAt = undefined;
    return [client, server];
  }

  /** Opens and immediately closes a socket, so the browser can read why it was turned away. */
  private reject(code: number, reason: string): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    server.close(code, reason);
    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Closes a seated socket with a reason. The reason goes out first as a {t:"bye"} frame as well,
   * because a server-side close can reach the browser late (or, through the Vite dev proxy, never).
   */
  private closeWith(ws: WebSocket, code: number, reason: string) {
    this.sendTo(ws, { t: "bye", code, reason });
    try { ws.close(code, reason); } catch { /* already closed */ }
  }

  private attach(ws: WebSocket, a: Attachment) {
    ws.serializeAttachment(a);
  }

  private attachment(ws: WebSocket): Attachment {
    return ws.deserializeAttachment() as Attachment;
  }

  private clientFor(ws: WebSocket): Client {
    const { sessionId } = this.attachment(ws);
    return {
      sessionId,
      send: (type, data) => this.sendTo(ws, { t: "msg", type, data }),
    };
  }

  private sendTo(ws: WebSocket, frame: unknown) {
    try {
      ws.send(JSON.stringify(frame));
    } catch {
      /* socket closed under us; its close handler will run */
    }
  }

  /** Live sockets, one per seated client. */
  private get sockets(): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => {
      if (ws.readyState !== WebSocket.OPEN) return false;
      return !this.attachment(ws)?.left;
    });
  }

  private get clients(): Client[] {
    return this.sockets.map((ws) => this.clientFor(ws));
  }

  private broadcast(type: string, data?: unknown, opts: { except?: Client } = {}) {
    for (const ws of this.sockets) {
      if (opts.except && this.attachment(ws).sessionId === opts.except.sessionId) continue;
      this.sendTo(ws, { t: "msg", type, data });
    }
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (!this.meta || !this.state) return;
    if (typeof raw !== "string" || raw.length > MAX_FRAME_BYTES) return;

    let frame: { t?: string; type?: string; data?: any };
    try {
      frame = JSON.parse(raw);
    } catch {
      return;
    }

    const client = this.clientFor(ws);
    if (frame.t === "leave") {
      this.attach(ws, { sessionId: client.sessionId, left: true });
      this.onLeave(client, true);
      await this.flush();
      try { ws.close(1000, "Left the room"); } catch { /* already closed */ }
      await this.scheduleCleanupIfEmpty();
      return;
    }

    if (frame.t === "msg" && typeof frame.type === "string") {
      // hasOwn, so "__proto__" or "constructor" can't reach Object.prototype.
      if (Object.hasOwn(this.handlers, frame.type)) {
        const data = frame.data && typeof frame.data === "object" ? frame.data : {};
        this.handlers[frame.type](client, data);
        await this.flush();
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    try { ws.close(code, reason); } catch { /* already closed */ }
    const a = this.attachment(ws);
    if (!a || a.left || !this.meta || !this.state) {
      await this.scheduleCleanupIfEmpty();
      return;
    }
    this.attach(ws, { ...a, left: true });
    this.onLeave({ sessionId: a.sessionId, send: () => {} }, false);
    await this.flush();
    await this.scheduleCleanupIfEmpty();
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws, 1011, "Socket error");
  }

  /**
   * Sends the public state to everyone if it changed (and always to `fresh`, a socket that just
   * joined), then any queued turn notice, then saves the room. Game messages a handler sent go out
   * before this, so clients see "game_started" before the state that goes with it, the way
   * Colyseus delivered them.
   */
  private async flush(fresh?: WebSocket) {
    if (!this.meta || !this.state) return;
    const json = JSON.stringify(publicState(this.state));
    const frame = `{"t":"state","s":${json}}`;
    if (json !== this.lastStateJson) {
      this.lastStateJson = json;
      for (const ws of this.sockets) {
        try { ws.send(frame); } catch { /* closing */ }
      }
    } else if (fresh) {
      try { fresh.send(frame); } catch { /* closing */ }
    }

    if (this.pendingTurnNotification) {
      this.pendingTurnNotification = false;
      this.deliverTurnNotification();
    }

    this.syncTurnTimer();
    await this.ctx.storage.put("room", { meta: this.meta, state: saveState(this.state) });
    if (this.meta.pendingStats?.length) await this.writeStats();
    await this.syncAlarm();
  }

  /**
   * Writes queued game results to D1, then tells each signed-in player their game was saved. The
   * queue is saved with the room first, so a write cut off by eviction is retried, and the insert
   * ignores rows it already has, so nothing counts twice.
   */
  private async writeStats() {
    const meta = this.meta!;
    const rows = meta.pendingStats ?? [];
    try {
      await recordResults(this.env.DB, rows);
    } catch (e) {
      console.error("room", meta.roomId, "stats write failed; retrying", (e as Error).message);
      meta.statsRetryAt = Date.now() + STATS_RETRY_MS;
      await this.ctx.storage.put("room", { meta, state: saveState(this.state!) });
      return;
    }
    meta.pendingStats = (meta.pendingStats ?? []).filter((r) => !rows.includes(r));
    meta.statsRetryAt = undefined;
    await this.ctx.storage.put("room", { meta, state: saveState(this.state!) });
    for (const r of rows) {
      for (const [sid, uid] of Object.entries(meta.users ?? {})) {
        if (uid !== r.userId) continue;
        for (const ws of this.ctx.getWebSockets(sid)) {
          this.sendTo(ws, { t: "msg", type: "stats_saved", data: { bucket: r.bucket, place: r.place, win: r.win, loss: r.loss } });
        }
      }
    }
  }

  /** Is someone holding this seat right now? */
  private isConnected(sessionId: string): boolean {
    return this.sockets.some((ws) => this.attachment(ws).sessionId === sessionId);
  }

  /** Who acts as host now: the host, or the next connected human while the host is away. */
  private get hostId(): string | null | undefined {
    return this.state?.currentHostId();
  }

  /**
   * Arms the turn timer when it's an absent player's turn and disarms it otherwise. It only runs
   * while somebody is connected, so an abandoned table doesn't play itself out.
   */
  private syncTurnTimer() {
    const meta = this.meta!;
    const state = this.state!;
    const id = state.phase === GamePhase.PLAYING ? state.currentTurnPlayerId : null;
    const away = !!id && state.players.has(id) && !this.isConnected(id) && this.sockets.length > 0;
    if (!away) meta.turnTimer = undefined;
    else if (meta.turnTimer?.playerId !== id) meta.turnTimer = { playerId: id!, at: Date.now() + TURN_TIMEOUT_MS };
  }

  // ---------------------------------------------------------------------------
  // Alarms: the absent player's turn timer, lobby seats given up after
  // a drop, and wiping a table nobody came back to. One alarm, set to the earliest.
  // ---------------------------------------------------------------------------

  private async syncAlarm() {
    const m = this.meta;
    const next = [
      m?.cleanupAt,
      m?.turnTimer?.at,
      m?.statsRetryAt,
      ...Object.values(m?.dropDeadlines ?? {}),
    ].filter((t): t is number => !!t);
    if (next.length) await this.ctx.storage.setAlarm(Math.min(...next));
    else await this.ctx.storage.deleteAlarm();
  }

  private async scheduleCleanupIfEmpty() {
    if (!this.meta || this.sockets.length > 0) return;
    this.meta.cleanupAt = Date.now() + EMPTY_ROOM_TTL_MS;
    await this.ctx.storage.put("room", { meta: this.meta, state: saveState(this.state!) });
    await this.syncAlarm();
  }

  async alarm() {
    if (!this.meta || !this.state) return;
    const now = Date.now();

    if (this.meta.cleanupAt && this.meta.cleanupAt <= now) {
      if (this.sockets.length === 0 && !this.meta.pendingStats?.length) {
        console.log("room", this.meta.roomId, "disposing...");
        this.meta = null;
        this.state = null;
        await this.ctx.storage.deleteAlarm();
        await this.ctx.storage.deleteAll();
        return;
      }
      this.meta.cleanupAt = undefined;
    }

    const drops = this.meta.dropDeadlines ?? {};
    for (const [id, at] of Object.entries(drops)) {
      if (this.state.phase !== GamePhase.WAITING) {
        delete drops[id]; // the game started with them seated; the turn timer covers them now
      } else if (at <= now && !this.isConnected(id)) {
        delete drops[id];
        this.dropSeat(id, "didn't come back");
      }
    }

    if (this.meta.statsRetryAt && this.meta.statsRetryAt <= now) this.meta.statsRetryAt = undefined; // flush() retries

    const timer = this.meta.turnTimer;
    if (timer && timer.at <= now) {
      this.meta.turnTimer = undefined;
      if (this.state.currentTurnPlayerId === timer.playerId && !this.isConnected(timer.playerId)) {
        this.playForAbsent(timer.playerId);
      }
    }

    await this.flush();
  }

  // ---------------------------------------------------------------------------
  // Game room, ported from the Colyseus HeartOfFive room.
  // ---------------------------------------------------------------------------

  private onCreate(roomId: string, origin: string, options: HeartOfFiveOptions) {
    this.meta = {
      roomId,
      origin,
      minPlayers: clampPlayers(options.minPlayers, MIN_PLAYERS),
      maxClients: clampPlayers(options.maxPlayers, MAX_PLAYERS),
      testMode: options.testMode || false,
      testDeckSize: options.testDeckSize || 0,
      testDeck: options.testDeck || "",
      locked: false,
      createdAt: Date.now(),
      tokens: {},
    };

    const state = new GameState();
    state.roomId = roomId;
    state.targetWins = options.targetWins || 10;

    // Pass test mode settings to GameState
    if (this.meta.testMode) {
      state.targetWins = 2; // Quick games for testing
      state.testDeckSize = this.meta.testDeckSize;
      state.testDeck = this.meta.testDeck;
    }
    this.state = state;
    this.lastStateJson = "";
  }

  private inviteUrl(): string {
    const url = new URL(`${this.meta!.origin}/h5/play`);
    url.searchParams.set("room", this.meta!.roomId);
    return url.toString();
  }

  private onJoin(client: Client, options: { name?: unknown; bot: boolean }) {
    const state = this.state!;
    console.log(client.sessionId, "joined!");

    const playerName = sanitizeName(options.name, `Player ${state.players.size + 1}`);
    state.addPlayer(client.sessionId, playerName, options.bot);

    // If this is the first player, they're the room creator
    if (state.players.size === 1) {
      this.meta!.creatorName = playerName;
    }

    client.send("welcome", {
      playerId: client.sessionId,
      roomState: {
        minPlayers: this.meta!.minPlayers,
        maxPlayers: this.meta!.maxClients,
        currentPlayers: state.players.size,
        phase: state.phase,
      },
      inviteUrl: this.inviteUrl(),
    });

    this.broadcast("player_joined", {
      playerId: client.sessionId,
      name: playerName,
      totalPlayers: state.players.size,
    }, { except: client });

    state.addSystemMessage(`👋 ${playerName} joined the game`, "info");
  }

  private handlers: Record<string, (client: Client, message: any) => void> = {
    ready: (client) => {
      const player = this.state!.players.get(client.sessionId);
      if (player) player.isActive = true;
    },

    // The first game and every "Play Again" after it: host only, never automatic.
    startGame: (client) => {
      const state = this.state!;
      const error = state.startError(client.sessionId, this.meta!.minPlayers);
      if (error) {
        client.send("error", { message: error, code: "START_REFUSED" });
        return;
      }
      console.log("Starting new round/game from phase:", state.phase);
      if (state.phase === GamePhase.GAME_END) this.resetGame();
      this.startGame();
    },

    play: (client, message: { cards?: unknown }) => {
      const state = this.state!;
      if (!state.canPlayerPlay(client.sessionId)) {
        const errorMsg = state.phase !== GamePhase.PLAYING
          ? `Cannot play - game is in ${state.phase} phase`
          : "Not your turn!";
        client.send("error", { message: errorMsg });
        return;
      }

      const player = state.players.get(client.sessionId)!;
      const codes = Array.isArray(message.cards) ? message.cards.filter((c): c is string => typeof c === "string") : [];
      const cards = this.parseCards(codes, player);
      if (!cards || cards.length === 0) {
        client.send("error", { message: "Invalid cards!" });
        return;
      }

      // First check if the meld is structurally valid
      const testMeld = new Meld();
      testMeld.setCards(cards);
      if (!testMeld.type) {
        client.send("error", { message: "Invalid card combination! Not a valid meld type." });
        return;
      }

      const success = state.playMeld(client.sessionId, cards);
      if (!success) {
        client.send("error", { message: state.describeInvalidPlay(testMeld) ?? "Invalid play!" });
        return;
      }

      // Send updated hand back to the player who just played
      client.send("your_hand", { cards: player.hand });

      this.broadcast("meld_played", {
        playerId: client.sessionId,
        cards: codes,
        meldType: state.currentMeldType,
      });

      if (state.currentMeld) {
        const cardCodes = state.currentMeld.cards.map((card) => card.code).join(" ");
        state.addChatMessage(client.sessionId, `(played) ${cardCodes}`);
      }

      // The phase may have changed after playMeld()
      const phaseAfterPlay = state.phase as GamePhase;
      if (phaseAfterPlay === GamePhase.ROUND_END || phaseAfterPlay === GamePhase.GAME_END) {
        this.handleRoundEnd();
      } else {
        this.sendTurnNotification();
      }
    },

    pass: (client) => {
      this.doPass(client, true);
    },

    kick: (client, message: { playerId?: unknown }) => {
      const target = typeof message.playerId === "string" ? message.playerId : "";
      if (client.sessionId !== this.hostId) {
        client.send("error", { message: "Only the host can remove a player" });
      } else if (!this.state!.players.has(target) || target === client.sessionId) {
        client.send("error", { message: "That player isn't at the table" });
      } else if (this.isConnected(target)) {
        client.send("error", { message: "That player is still connected" });
      } else {
        this.dropSeat(target, "was removed by the host");
      }
    },

    // The player handed their seat to an uploaded bot ({name}) or took it back ({name: null}). The bot
    // runs in their browser and sends ordinary play/pass frames; this only labels the seat for the table.
    autopilot: (client, message: { name?: unknown }) => {
      const player = this.state!.players.get(client.sessionId);
      if (!player) return;
      const next = message.name == null || message.name === "" ? null : sanitizeName(message.name, "Bot");
      if (player.autopilot === next) return;
      player.autopilot = next;
      this.state!.addSystemMessage(
        next ? `🤖 ${next} is playing for ${player.name}` : `${player.name} took their seat back`,
        "info",
      );
    },

    chat: (client, message: { text?: unknown }) => {
      if (!this.chatLimit.allow(client.sessionId)) {
        client.send("error", {
          message: `Slow down: at most ${CHAT_MAX} messages every ${CHAT_WINDOW_MS / 1000} seconds`,
          code: "CHAT_RATE_LIMITED",
        });
        return;
      }
      const text = typeof message.text === "string" ? message.text : "";
      const success = this.state!.addChatMessage(client.sessionId, text);
      if (!success) {
        client.send("error", { message: "Failed to send message" });
      }
    },
  };

  /** A pass, by the player or by the turn timer on behalf of an absent player. */
  private doPass(client: Client, explicit: boolean) {
    const state = this.state!;
    if (state.phase !== GamePhase.PLAYING) return;

    const previousLeader = state.leadPlayerId;
    const success = state.pass(client.sessionId);
    if (!success) {
      if (!explicit) return;
      if (state.leadPlayerId === client.sessionId && !state.currentMeld) {
        client.send("error", {
          message: "Cannot pass - you must play something as the leader!",
          code: "LEADER_MUST_PLAY",
        });
      } else {
        client.send("error", { message: "Cannot pass!" });
      }
      return;
    }

    this.broadcast("player_passed", { playerId: client.sessionId });
    if (state.players.get(client.sessionId)) {
      state.addChatMessage(client.sessionId, "(passed)");
    }

    // Check if leadership changed after all passes
    if (state.leadPlayerId !== previousLeader && state.consecutivePasses === 0) {
      this.broadcast("new_leader", {
        playerId: state.leadPlayerId,
        message: "All players passed. New leader can play any meld!",
      });
      const leader = state.players.get(state.leadPlayerId);
      if (leader) {
        state.addSystemMessage(`👑 ${leader.name} is the new leader! Can play any meld.`, "success");
      }
      this.sendTurnNotification();
    }

    const phaseAfterPass = state.phase as GamePhase;
    if (phaseAfterPass === GamePhase.ROUND_END || phaseAfterPass === GamePhase.GAME_END) {
      this.handleRoundEnd();
    } else if (state.leadPlayerId === previousLeader) {
      this.sendTurnNotification();
    }
  }

  private handleGameEnd() {
    const state = this.state!;
    if (state.phase !== GamePhase.GAME_END) return;

    let winner: Player | null = null;
    let maxWins = 0;
    state.players.forEach((player) => {
      if (player.wins > maxWins) {
        maxWins = player.wins;
        winner = player;
      }
    });
    const w = winner as Player | null;

    this.broadcast("game_ended", {
      winner: w ? { id: w.id, name: w.name, wins: w.wins } : null,
      finalStandings: this.standings().sort((a, b) => b.wins - a.wins),
    });

    if (w) {
      state.addSystemMessage(`🎉 Game Over! ${w.name} won with ${w.wins} rounds!`, "success");
    }
  }

  private standings() {
    return Array.from(this.state!.players.values()).map((p) => ({
      playerId: p.id,
      name: p.name,
      wins: p.wins,
      losses: p.losses,
    }));
  }

  private onLeave(client: Client, consented: boolean) {
    const state = this.state!;
    console.log(client.sessionId, "left!", consented ? "(consented)" : "(dropped)");
    const player = state.players.get(client.sessionId);
    if (!player) return;

    if (state.phase === GamePhase.WAITING && consented) {
      this.dropSeat(client.sessionId, "left the game");
      return;
    }

    // The seat stays, and the client can take it back with its token (see fetch()). A dropped
    // connection never plays or passes for anyone; the turn timer does that if they stay away.
    player.isActive = false;
    player.autopilot = null; // the bot ran in that browser, so it's gone too
    if (state.phase === GamePhase.WAITING) {
      this.meta!.dropDeadlines = { ...this.meta!.dropDeadlines, [client.sessionId]: Date.now() + LOBBY_GRACE_MS };
    }
    state.addSystemMessage(
      consented ? `🚪 ${player.name} left the table` : `📶 ${player.name} lost connection`,
      "warning",
    );
  }

  /** Takes a seat out of the room for good: the lobby grace ran out, a lobby player left, or the host removed it. */
  private dropSeat(sessionId: string, why: string) {
    const state = this.state!;
    const player = state.players.get(sessionId);
    if (!player) return;
    const before = { phase: state.phase, turn: state.currentTurnPlayerId, lead: state.leadPlayerId };

    for (const ws of this.ctx.getWebSockets(sessionId)) {
      if (this.attachment(ws)?.left) continue; // already on its way out
      this.attach(ws, { sessionId, left: true });
      this.closeWith(ws, CLOSE_REMOVED, "You were removed from the table");
    }
    delete this.meta!.tokens[sessionId];
    if (this.meta!.dropDeadlines) delete this.meta!.dropDeadlines[sessionId];
    if (this.meta!.turnTimer?.playerId === sessionId) this.meta!.turnTimer = undefined;

    state.removeSeat(sessionId);
    this.broadcast("player_left", { playerId: sessionId, totalPlayers: state.players.size });
    state.addSystemMessage(`🚪 ${player.name} ${why}`, "warning");

    if (before.phase === GamePhase.PLAYING) {
      if ((state.phase as GamePhase) === GamePhase.ROUND_END) this.handleRoundEnd();
      else if (state.currentTurnPlayerId !== before.turn || state.leadPlayerId !== before.lead) this.sendTurnNotification();
    }
  }

  /** The turn timer ran out on an absent player: pass for them, or lead their lowest single. */
  private playForAbsent(sessionId: string) {
    const state = this.state!;
    const move = state.autoMove(sessionId);
    const player = state.players.get(sessionId);
    if (!move || !player) return;
    const stub: Client = { sessionId, send: () => {} };
    if (move.action === "pass") {
      state.addSystemMessage(`⏱️ ${player.name} is away, so the table passed for them`, "info");
      this.doPass(stub, false);
    } else {
      state.addSystemMessage(`⏱️ ${player.name} is away, so the table led their lowest card`, "info");
      this.handlers.play(stub, { cards: move.cards.map((c) => c.code) });
    }
  }

  private async onReconnect(client: Client) {
    const state = this.state!;
    console.log(client.sessionId, "reconnected!");

    const player = state.players.get(client.sessionId);
    if (this.meta!.dropDeadlines) delete this.meta!.dropDeadlines[client.sessionId];
    if (player) {
      if (!player.isActive) state.addSystemMessage(`📶 ${player.name} is back`, "success");
      player.isActive = true;
      client.send("game_state", {
        currentTurn: state.currentTurnPlayerId,
        currentMeld: state.currentMeld,
        phase: state.phase,
      });
      client.send("your_hand", { cards: player.hand });
      if (state.phase === GamePhase.PLAYING) this.sendStatsTracking(client);
      if (state.currentTurnPlayerId === client.sessionId) {
        this.sendTurnNotification();
      }
    }
  }

  private resetGame() {
    const state = this.state!;
    state.players.forEach((player) => {
      player.wins = 0;
      player.losses = 0;
      player.position = 0;
    });
    state.currentRound = 0;
    state.roundWinnerId = null;
    state.phase = GamePhase.WAITING;
  }

  private startGame() {
    const state = this.state!;
    if (state.phase !== GamePhase.WAITING && state.phase !== GamePhase.ROUND_END) {
      console.log("Cannot start game - wrong phase:", state.phase);
      return;
    }

    console.log("Starting game/round with", state.players.size, "players");

    // Only lock on first game, not on subsequent rounds
    if (state.phase === GamePhase.WAITING) {
      this.meta!.locked = true;
    } else if (state.phase === GamePhase.ROUND_END) {
      // startNewRound deals the cards itself
      state.startNewRound();
      this.broadcastRoundStart();
      return;
    }

    state.initializeDeck();
    state.dealCards(this.meta!.testDeckSize);
    this.broadcastRoundStart();
  }

  /** Notes who's seated for the game just dealt, which decides its stats bucket and who it counts for. */
  private snapshotDeal() {
    const meta = this.meta!;
    const seq = (meta.gameSeq ?? 0) + 1;
    meta.gameSeq = seq;
    const seats: SeatAtDeal[] = Array.from(this.state!.players.values()).map((p) => ({
      id: p.id,
      isBot: p.isBot,
      userId: p.isBot ? undefined : meta.users?.[p.id],
    }));
    meta.dealt = { seq, seats };
  }

  /** Tells a seat that the current game counts toward its owner's stats, and in which bucket. */
  private sendStatsTracking(client: Client) {
    const dealt = this.meta!.dealt;
    const seat = dealt?.seats.find((s) => s.id === client.sessionId);
    const bucket = dealt && classifyBucket(dealt.seats);
    if (seat?.userId && bucket) client.send("stats_tracking", { bucket });
  }

  /** Queues the finished game's results for every signed-in human who was dealt in. Once per game. */
  private queueStats() {
    const meta = this.meta!;
    const state = this.state!;
    const dealt = meta.dealt;
    if (!dealt) return;
    meta.dealt = undefined;
    const rows = resultRows({
      gameKey: `${meta.roomId}:${meta.createdAt}:${dealt.seq}`,
      roomId: meta.roomId,
      seats: dealt.seats,
      finishOrder: state.finishOrder ?? [],
      present: Array.from(state.players.keys()),
      winnerId: state.roundWinnerId || null,
      finishedAt: Date.now(),
    });
    if (rows.length) meta.pendingStats = [...(meta.pendingStats ?? []), ...rows];
  }

  private broadcastRoundStart() {
    const state = this.state!;
    this.snapshotDeal();
    // Send each player their own hand privately
    for (const client of this.clients) {
      const player = state.players.get(client.sessionId);
      if (player) client.send("your_hand", { cards: player.hand });
    }

    this.broadcast("game_started", {
      currentTurn: state.currentTurnPlayerId,
      leadPlayer: state.leadPlayerId,
      round: state.currentRound,
    });

    state.addSystemMessage(`🎮 Game ${state.currentRound + 1} started!`, "success");
    for (const client of this.clients) this.sendStatsTracking(client);

    // Goes out after the state that shows it's this player's turn (see flush()).
    this.sendTurnNotification();
  }

  private parseCards(cardCodes: string[], player: Player): Card[] | null {
    const cards: Card[] = [];
    for (const code of cardCodes) {
      const card = player.hand.find((c) => c.code === code);
      if (!card || cards.includes(card)) return null;
      cards.push(card);
    }
    return cards;
  }

  private handleRoundEnd() {
    const state = this.state!;
    const isGameEnding = state.phase === GamePhase.GAME_END;
    this.queueStats();

    this.broadcast("round_ended", {
      winner: state.roundWinnerId,
      standings: this.standings(),
    });

    const winner = state.players.get(state.roundWinnerId);
    if (winner) {
      state.addSystemMessage(`🏆 Game ended! ${winner.name} won! Play again?`, "info");
    }

    // Always send game_ended when a round ends (a round is a game in the current terminology)
    this.broadcast("game_ended", {
      winner: winner ? { id: winner.id, name: winner.name, wins: winner.wins } : null,
      finalStandings: this.standings().sort((a, b) => b.wins - a.wins),
    });

    if (isGameEnding) {
      this.handleGameEnd();
    } else {
      state.addSystemMessage(`Ready for next game! Click "Play Again" to continue.`, "info");
    }
  }

  /** Queues a "your_turn" for whoever's turn it is, delivered after the next state broadcast. */
  private sendTurnNotification() {
    this.pendingTurnNotification = true;
  }

  private deliverTurnNotification() {
    const state = this.state!;
    if (state.phase !== GamePhase.PLAYING || !state.currentTurnPlayerId) return;
    const client = this.clients.find((c) => c.sessionId === state.currentTurnPlayerId);
    if (!client) return;

    const isLeader = state.leadPlayerId === state.currentTurnPlayerId;
    const canPlayAnything = isLeader && !state.currentMeld;

    client.send("your_turn", {
      isLeader,
      canPlayAnything,
      currentMeld: state.currentMeld ? {
        type: state.currentMeldType,
        size: state.currentMeldSize,
        cards: state.currentMeld.cards.map((c) => c.code),
      } : null,
      consecutivePasses: state.consecutivePasses,
      message: canPlayAnything ? "You're the leader! Play any meld." :
               isLeader ? "Your turn. You must beat the current meld or pass." :
               "Your turn. Beat the current meld or pass.",
    });
  }
}

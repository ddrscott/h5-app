import { api } from '../base';

/**
 * A small stand-in for colyseus.js, talking to the HeartOfFiveRoom Durable Object
 * (src/worker/room.ts). It keeps the parts of the Colyseus Room API this app uses:
 * state, sessionId, roomId, onStateChange, onMessage, onLeave, onError, send, leave,
 * and removeAllListeners.
 *
 * State arrives as a full snapshot after every change. `players` is rebuilt as a Map so
 * code written against a Colyseus MapSchema (`new Map(state.players)`, `.values()`) still works.
 */

type Handler = (data: any) => void;

/** Where the socket stands. "lost" is final: the room gave up on us or we gave up retrying. */
export type ConnectionStatus = 'connected' | 'reconnecting' | 'lost';
export interface ConnectionInfo {
  code?: number;
  reason?: string;
  /** The server says the room or the seat no longer exists, so a saved seat is useless. */
  seatGone?: boolean;
}

/** A failed connect, with the close code the server gave (4404 not found, 4423 started, ...). */
export class ConnectError extends Error {
  constructor(message: string, readonly code: number) {
    super(message);
  }
}

const CLOSE_NORMAL = 1000;
/** Codes 4000+ are the room's own answers; retrying won't change them. */
const CLOSE_APP = 4000;
const CLOSE_NOT_FOUND = 4404;
const CLOSE_REMOVED = 4410;
const RECONNECT_WINDOW_MS = 2 * 60_000;
const PING_MS = 25_000;
/** Messages that arrive before anyone listens for their type are held, up to this many. */
const MAX_HELD = 50;

function socketUrl(roomId: string, params: Record<string, string>): string {
  const url = new URL(api(`/api/rooms/${encodeURIComponent(roomId)}/ws`), window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

function resumeUrl(roomId: string, sessionId: string, token: string): string {
  return socketUrl(roomId, { session: sessionId, token });
}

function hydrate(s: any) {
  return { ...s, players: new Map(Object.entries(s.players ?? {})) };
}

export class Room<State = any> {
  roomId = '';
  sessionId = '';
  state: State = undefined as unknown as State;

  private ws: WebSocket | null = null;
  /** The secret that takes this seat back after a drop. Save it to resume after a page reload. */
  token = '';
  status: ConnectionStatus = 'connected';
  private statusHandlers: ((status: ConnectionStatus, info: ConnectionInfo) => void)[] = [];
  private stateHandlers: ((state: State) => void)[] = [];
  private messageHandlers = new Map<string, Handler[]>();
  private leaveHandlers: ((code: number) => void)[] = [];
  private errorHandlers: ((code: number, message?: string) => void)[] = [];
  private held: { type: string; data: unknown }[] = [];
  private leaving = false;
  private ping: ReturnType<typeof setInterval> | null = null;

  /** Resolves once the server has seated us and sent the first state. */
  connect(url: string): Promise<this> {
    return new Promise((resolve, reject) => {
      let seated = false;
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onmessage = (ev) => {
        let frame: any;
        try {
          frame = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (frame.t === 'joined') {
          this.roomId = frame.roomId;
          this.sessionId = frame.sessionId;
          this.token = frame.token;
        } else if (frame.t === 'state') {
          this.state = hydrate(frame.s) as State;
          this.stateHandlers.forEach((h) => h(this.state));
          if (!seated) {
            seated = true;
            this.startPing();
            resolve(this);
          }
        } else if (frame.t === 'msg') {
          this.dispatch(frame.type, frame.data);
        } else if (frame.t === 'bye') {
          // The room is closing this socket on purpose (seat opened elsewhere, or removed).
          // Act now rather than wait for the close event, which can arrive late.
          ws.onclose = null;
          this.stopPing();
          try { ws.close(); } catch { /* already closing */ }
          if (!seated) reject(new ConnectError(frame.reason, frame.code));
          else if (ws === this.ws && !this.leaving) this.giveUp(frame.code, frame.reason);
        }
      };

      ws.onclose = (ev) => {
        this.stopPing();
        if (!seated) {
          reject(new ConnectError(ev.reason || 'Could not connect to the game server', ev.code));
          return;
        }
        if (ws !== this.ws) return; // an old socket we already replaced
        if (this.leaving) {
          this.leaveHandlers.forEach((h) => h(ev.code));
          return;
        }
        if (ev.code === CLOSE_NORMAL || ev.code >= CLOSE_APP) {
          this.giveUp(ev.code, ev.reason || 'The game closed the connection');
          return;
        }
        void this.reconnect(ev.code);
      };

      ws.onerror = () => {
        /* onclose follows and decides what to do */
      };
    });
  }

  /**
   * The connection dropped without anyone leaving: try to take our seat back for a while. Stops
   * at once if the room answers with its own close code (the seat or the room is gone).
   */
  private async reconnect(code: number) {
    this.setStatus('reconnecting', { code });
    const deadline = Date.now() + RECONNECT_WINDOW_MS;
    let delay = 500;
    while (Date.now() < deadline && !this.leaving) {
      await new Promise((r) => setTimeout(r, delay));
      if (this.leaving) return;
      try {
        await this.connect(resumeUrl(this.roomId, this.sessionId, this.token));
        this.setStatus('connected', {});
        return;
      } catch (err) {
        if (err instanceof ConnectError && err.code >= CLOSE_APP) {
          this.giveUp(err.code, err.message);
          return;
        }
        delay = Math.min(delay * 2, 5_000);
      }
    }
    if (!this.leaving) this.giveUp(code, 'Lost connection to the game');
  }

  private giveUp(code: number, reason: string) {
    this.stopPing();
    this.setStatus('lost', { code, reason, seatGone: code === CLOSE_NOT_FOUND || code === CLOSE_REMOVED });
    this.errorHandlers.forEach((h) => h(code, reason));
    this.leaveHandlers.forEach((h) => h(code));
  }

  private setStatus(status: ConnectionStatus, info: ConnectionInfo) {
    this.status = status;
    this.statusHandlers.forEach((h) => h(status, info));
  }

  /**
   * Connection status changes. Unlike the other listeners, removeAllListeners() leaves these
   * alone, because the game hooks clear theirs while the app shell still needs to know.
   */
  onConnection(handler: (status: ConnectionStatus, info: ConnectionInfo) => void) {
    this.statusHandlers.push(handler);
    return () => {
      this.statusHandlers = this.statusHandlers.filter((h) => h !== handler);
    };
  }

  private startPing() {
    this.stopPing();
    this.ping = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send('ping');
    }, PING_MS);
  }

  private stopPing() {
    if (this.ping) clearInterval(this.ping);
    this.ping = null;
  }

  private dispatch(type: string, data: unknown) {
    const handlers = this.messageHandlers.get(type);
    if (handlers?.length) {
      handlers.forEach((h) => h(data));
    } else if (this.held.length < MAX_HELD) {
      this.held.push({ type, data });
    }
  }

  onStateChange(handler: (state: State) => void) {
    this.stateHandlers.push(handler);
    // Colyseus fires on the next patch; firing now with what we have saves a round trip.
    if (this.state) handler(this.state);
    return () => {
      this.stateHandlers = this.stateHandlers.filter((h) => h !== handler);
    };
  }

  onMessage<T = any>(type: string, handler: (data: T) => void) {
    const list = this.messageHandlers.get(type) ?? [];
    list.push(handler as Handler);
    this.messageHandlers.set(type, list);

    // Hand over anything of this type that came in before we were listening.
    const mine = this.held.filter((m) => m.type === type);
    if (mine.length) {
      this.held = this.held.filter((m) => m.type !== type);
      mine.forEach((m) => handler(m.data as T));
    }
    return () => {
      this.messageHandlers.set(type, (this.messageHandlers.get(type) ?? []).filter((h) => h !== handler));
    };
  }

  onLeave(handler: (code: number) => void) {
    this.leaveHandlers.push(handler);
  }

  onError(handler: (code: number, message?: string) => void) {
    this.errorHandlers.push(handler);
  }

  send(type: string, data?: unknown) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ t: 'msg', type, data: data ?? {} }));
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.stopPing();
    const ws = this.ws;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: 'leave' }));
      ws.close(CLOSE_NORMAL, 'Left the room');
    } else if (ws?.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  }

  removeAllListeners() {
    this.stateHandlers = [];
    this.messageHandlers.clear();
    this.leaveHandlers = [];
    this.errorHandlers = [];
  }
}

/** Matches the colyseus.js Client calls the app makes. The room name is accepted and ignored: there's one game. */
export class Client {
  async create<State = any>(_roomName: string, options: Record<string, unknown> = {}): Promise<Room<State>> {
    return this.open<State>('new', options);
  }

  async joinById<State = any>(roomId: string, options: Record<string, unknown> = {}): Promise<Room<State>> {
    return this.open<State>(roomId.trim().toUpperCase(), options);
  }

  /** Takes a seat back with the token the room handed out on join, e.g. after a page reload. */
  async resume<State = any>(roomId: string, sessionId: string, token: string): Promise<Room<State>> {
    return new Room<State>().connect(resumeUrl(roomId, sessionId, token));
  }

  /** There's no public room list, so "join any game" starts a new one. */
  async joinOrCreate<State = any>(roomName: string, options: Record<string, unknown> = {}): Promise<Room<State>> {
    return this.create<State>(roomName, options);
  }

  private async open<State>(roomId: string, options: Record<string, unknown>): Promise<Room<State>> {
    const { name, ...rest } = options;
    const params: Record<string, string> = {};
    if (typeof name === 'string') params.name = name;
    if (Object.keys(rest).length) params.opts = JSON.stringify(rest);
    return new Room<State>().connect(socketUrl(roomId, params));
  }
}

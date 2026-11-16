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

const CLOSE_NORMAL = 1000;
const RECONNECT_WINDOW_MS = 60_000;
const PING_MS = 25_000;
/** Messages that arrive before anyone listens for their type are held, up to this many. */
const MAX_HELD = 50;

function socketUrl(roomId: string, params: Record<string, string>): string {
  const url = new URL(api(`/api/rooms/${encodeURIComponent(roomId)}/ws`), window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

function hydrate(s: any) {
  return { ...s, players: new Map(Object.entries(s.players ?? {})) };
}

export class Room<State = any> {
  roomId = '';
  sessionId = '';
  state: State = undefined as unknown as State;

  private ws: WebSocket | null = null;
  private token = '';
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
        }
      };

      ws.onclose = (ev) => {
        this.stopPing();
        if (!seated) {
          reject(new Error(ev.reason || 'Could not connect to the game server'));
          return;
        }
        if (ws !== this.ws) return; // an old socket we already replaced
        if (this.leaving || ev.code === CLOSE_NORMAL || ev.code >= 4000) {
          this.leaveHandlers.forEach((h) => h(ev.code));
          return;
        }
        void this.reconnect(ev.code);
      };

      ws.onerror = () => {
        /* onclose follows and decides what to do */
      };
    });
  }

  /** The connection dropped without anyone leaving: try to take our seat back for a minute. */
  private async reconnect(code: number) {
    const deadline = Date.now() + RECONNECT_WINDOW_MS;
    let delay = 500;
    while (Date.now() < deadline && !this.leaving) {
      await new Promise((r) => setTimeout(r, delay));
      if (this.leaving) return;
      try {
        await this.connect(socketUrl(this.roomId, { session: this.sessionId, token: this.token }));
        return;
      } catch {
        delay = Math.min(delay * 2, 5_000);
      }
    }
    this.errorHandlers.forEach((h) => h(code, 'Lost connection to the game'));
    this.leaveHandlers.forEach((h) => h(code));
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

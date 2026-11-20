import { Client } from '../../net/rooms';
import type { Room } from '../../net/rooms';
import { storageKey } from '../../base';
import { SeatPilot } from './pilot';
import { botLibrary } from './library';
import type { SavedBot } from './library';

/**
 * Uploaded bots the host seats as extra players. Each one is its own connection with `bot: true`
 * (like the built-in bots) and a SeatPilot that always plays. They live in this tab: seats are kept
 * in sessionStorage so a reload brings them back, like BotManager does for built-in bots.
 */

const SEATS_KEY = storageKey('script-seats');
interface SavedSeat { roomId: string; sessionId: string; token: string; botId: string }

export interface ScriptSeat { sessionId: string; bot: SavedBot; room: Room; pilot: SeatPilot }

const seats = new Map<string, ScriptSeat>();
const listeners = new Set<() => void>();

function persist() {
  const list: SavedSeat[] = [...seats.values()].map((s) => ({ roomId: s.room.roomId, sessionId: s.sessionId, token: s.room.token, botId: s.bot.id }));
  try {
    if (list.length) sessionStorage.setItem(SEATS_KEY, JSON.stringify(list));
    else sessionStorage.removeItem(SEATS_KEY);
  } catch { /* they just won't come back after a reload */ }
  listeners.forEach((fn) => fn());
}

function track(room: Room, bot: SavedBot, onNote?: (text: string) => void): ScriptSeat {
  const pilot = new SeatPilot(room, room.sessionId, {
    announce: true,
    // Benched after three strikes: the seat keeps playing the safe move so the game goes on.
    onStrikeOut: (why) => {
      onNote?.(why.replace('so you have your seat back', 'so its seat now plays safe moves'));
      pilot.setBot({ name: bot.name, code: FALLBACK_ONLY });
      pilot.setEnabled(true);
    },
  });
  pilot.setBot(bot);
  pilot.setEnabled(true);
  const seat: ScriptSeat = { sessionId: room.sessionId, bot, room, pilot };
  seats.set(seat.sessionId, seat);
  room.onConnection((status) => {
    if (status === 'lost') {
      pilot.dispose();
      seats.delete(seat.sessionId);
      persist();
    }
  });
  persist();
  return seat;
}

/** A bot that plays the fallback move: pass when it can, otherwise the lowest card it may lead. */
const FALLBACK_ONLY = 'function decide(view) { return view.legalMoves.find((m) => m.pass) || view.legalMoves[0]; }';

export const scriptSeats = {
  list: (roomId: string) => [...seats.values()].filter((s) => s.room.roomId === roomId),
  async add(roomId: string, bot: SavedBot, onNote?: (text: string) => void): Promise<ScriptSeat> {
    const room = await new Client().joinById(roomId, { name: bot.name, bot: true });
    return track(room, bot, onNote);
  },
  remove(sessionId: string) {
    const seat = seats.get(sessionId);
    if (!seat) return;
    seat.pilot.dispose();
    seat.room.leave();
    seats.delete(sessionId);
    persist();
  },
  /** Brings this tab's uploaded-bot seats back after a reload. */
  async resume(roomId: string, onNote?: (text: string) => void) {
    let saved: SavedSeat[] = [];
    try { saved = JSON.parse(sessionStorage.getItem(SEATS_KEY) || '[]'); } catch { saved = []; }
    await Promise.all(saved.filter((s) => s.roomId === roomId && !seats.has(s.sessionId)).map(async (s) => {
      const bot = botLibrary.get(s.botId);
      if (!bot) return;
      try {
        track(await new Client().resume(roomId, s.sessionId, s.token), bot, onNote);
      } catch (err) {
        console.warn(`${bot.name} could not take its seat back:`, err);
      }
    }));
    persist();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};

import { storageKey } from '../base';

/**
 * The seat this tab holds, kept in sessionStorage so a page reload can take it back
 * (`?session=&token=` on the socket URL). sessionStorage is per tab, so two tabs can sit at
 * two different seats, and closing the tab forgets it.
 */
export interface Seat {
  roomId: string;
  sessionId: string;
  token: string;
}

const KEY = storageKey('seat');

const isSeat = (v: unknown): v is Seat => {
  const o = v as Partial<Record<keyof Seat, unknown>> | null;
  return !!o && typeof o.roomId === 'string' && typeof o.sessionId === 'string' && typeof o.token === 'string';
};

export function saveSeat(seat: Seat) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ roomId: seat.roomId, sessionId: seat.sessionId, token: seat.token }));
  } catch {
    /* storage full or blocked: a reload will just join fresh */
  }
}

/** The saved seat, if it's for `roomId` (any room when left out). */
export function loadSeat(roomId?: string): Seat | null {
  try {
    const seat = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!isSeat(seat)) return null;
    if (roomId && seat.roomId.toUpperCase() !== roomId.trim().toUpperCase()) return null;
    return seat;
  } catch {
    return null;
  }
}

export function clearSeat() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

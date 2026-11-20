import { useSyncExternalStore } from 'react';
import { storageKey } from '../../base';
import { MAX_SCRIPT_BYTES } from './BotSandbox';

/** A bot the player saved in this browser. v1 keeps them in localStorage only; nothing goes to the server. */
export interface SavedBot {
  id: string;
  name: string;
  code: string;
  savedAt: number;
}

const BOTS_KEY = storageKey('my-bots');
const CONSENT_KEY = storageKey('bot-consent');
const listeners = new Set<() => void>();
let cache: SavedBot[] | null = null;

function read(): SavedBot[] {
  if (cache) return cache;
  try {
    const list = JSON.parse(localStorage.getItem(BOTS_KEY) || '[]');
    cache = Array.isArray(list)
      ? list.filter((b) => b && typeof b.id === 'string' && typeof b.name === 'string' && typeof b.code === 'string')
      : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(list: SavedBot[]) {
  cache = list;
  try {
    localStorage.setItem(BOTS_KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: the bot still works until the page closes */
  }
  listeners.forEach((fn) => fn());
}

export const scriptBytes = (code: string) => new TextEncoder().encode(code).length;

/** Null when the script can be saved, otherwise why not. */
export function scriptProblem(code: string): string | null {
  if (!code.trim()) return 'The script is empty.';
  const bytes = scriptBytes(code);
  if (bytes > MAX_SCRIPT_BYTES) return `That script is ${Math.ceil(bytes / 1024)} KB. The limit is ${MAX_SCRIPT_BYTES / 1024} KB.`;
  return null;
}

export const botLibrary = {
  list: read,
  get: (id: string | null) => (id ? read().find((b) => b.id === id) ?? null : null),
  save(name: string, code: string): SavedBot {
    const problem = scriptProblem(code);
    if (problem) throw new Error(problem);
    const clean = name.trim().replace(/\s+/g, ' ').slice(0, 20) || 'My bot';
    const existing = read().find((b) => b.name === clean);
    const bot: SavedBot = { id: existing?.id ?? `bot-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: clean, code, savedAt: Date.now() };
    write([bot, ...read().filter((b) => b.id !== bot.id)]);
    return bot;
  },
  remove(id: string) {
    write(read().filter((b) => b.id !== id));
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
  /** The player said yes to "this runs code in your browser" once, in this browser. */
  hasConsent: () => { try { return localStorage.getItem(CONSENT_KEY) === 'yes'; } catch { return false; } },
  giveConsent: () => { try { localStorage.setItem(CONSENT_KEY, 'yes'); } catch { /* asks again next time */ } },
};

export function useSavedBots(): SavedBot[] {
  return useSyncExternalStore(botLibrary.subscribe, read, read);
}

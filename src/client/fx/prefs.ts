import { useSyncExternalStore } from 'react';
import { storageKey } from '../base';

/** Sound and haptics share one switch, remembered across visits. */
const KEY = storageKey('muted');
const listeners = new Set<() => void>();

function read(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
let muted = read();

export const prefs = {
  muted: () => muted,
  setMuted(next: boolean) {
    muted = next;
    try { localStorage.setItem(KEY, next ? '1' : '0'); } catch { /* private mode */ }
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};

export function useMuted(): [boolean, (m: boolean) => void] {
  const m = useSyncExternalStore(prefs.subscribe, prefs.muted, prefs.muted);
  return [m, prefs.setMuted];
}

/** True when the OS asks for reduced motion. Read live, so toggling it applies at once. */
export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

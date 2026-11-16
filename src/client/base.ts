// Served at askscottpierce.com/h5. Keep in step with src/worker/index.ts, vite.config.ts, and wrangler.jsonc.
export const BASE = "/h5";
export const api = (path: string) => `${BASE}${path}`;
/** localStorage is shared by every app on askscottpierce.com, so keys carry the app's prefix. */
export const storageKey = (key: string) => `h5-${key}`;

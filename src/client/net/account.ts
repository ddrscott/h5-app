import { api } from '../base';

/** The signed-in player, from /h5/api/me. */
export interface Account {
  id: string;
  email: string;
  name: string | null;
}

export type Bucket = 'pvp' | 'mixed' | 'computer';
export const BUCKETS: Bucket[] = ['pvp', 'mixed', 'computer'];
export const BUCKET_LABEL: Record<Bucket, string> = { pvp: 'Vs people', mixed: 'Mixed', computer: 'Vs computer' };

export interface BucketStats {
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPlace: number | null;
}
export type Stats = Record<Bucket, BucketStats>;

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(api(path), {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Something went wrong. Try again.');
  return data as T;
}

export const fetchMe = () => call<Account | null>('/api/me');
/** Sends a code. In local dev the code comes back in `devCode` instead of by email. */
export const startSignIn = (email: string) => call<{ ok: true; devCode?: string }>('/api/auth/start', { email });
export const verifyCode = (email: string, code: string) => call<{ ok: true }>('/api/auth/verify', { email, code });
export const signOut = () => call<{ ok: true }>('/api/auth/logout', {});
export const saveName = (name: string) => call<Account>('/api/me', { name });
export const fetchStats = async () => (await call<{ stats: Stats }>('/api/stats')).stats;

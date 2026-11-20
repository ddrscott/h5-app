// Permanent stats for signed-in players. A finished game becomes one game_results row per
// signed-in human, keyed by (game_key, user_id), so writing the same game twice is a no-op.

export type Bucket = "pvp" | "mixed" | "computer";
export const BUCKETS: Bucket[] = ["pvp", "mixed", "computer"];

/** Who sat at the table when a game was dealt. Captured at the deal and kept until the game ends. */
export interface SeatAtDeal {
  id: string;
  isBot: boolean;
  userId?: string;
}

/**
 * Which stats bucket a game counts in, decided by who was seated when it started:
 * every seat human is PvP, one human with bots is vs computer, two or more humans with a bot is mixed.
 * A table with no humans counts for nobody.
 */
export function classifyBucket(seats: Pick<SeatAtDeal, "isBot">[]): Bucket | null {
  const humans = seats.filter((s) => !s.isBot).length;
  const bots = seats.length - humans;
  if (humans === 0) return null;
  if (bots === 0) return humans >= 2 ? "pvp" : null;
  return humans === 1 ? "computer" : "mixed";
}

export interface ResultRow {
  gameKey: string;
  userId: string;
  bucket: Bucket;
  place: number;
  players: number;
  win: boolean;
  loss: boolean;
  roomId: string;
  finishedAt: number;
}

export interface FinishedGame {
  gameKey: string;
  roomId: string;
  seats: SeatAtDeal[];
  /** Seat ids in the order they went out. */
  finishOrder: string[];
  /** Seat ids still at the table when the game ended. */
  present: string[];
  /** The first player out, or null when the game ended without one (it counts for nobody). */
  winnerId: string | null;
  finishedAt: number;
}

/**
 * The rows a finished game writes: one per signed-in human who was dealt in and is still seated.
 * Place is the finishing order; the one left holding cards is last and takes the loss.
 */
export function resultRows(g: FinishedGame): ResultRow[] {
  const bucket = classifyBucket(g.seats);
  if (!bucket || !g.winnerId) return [];
  const present = new Set(g.present);
  const dealt = g.seats.filter((s) => present.has(s.id));
  const out = g.finishOrder.filter((id) => present.has(id));
  const holding = dealt.filter((s) => !out.includes(s.id));
  const players = dealt.length;
  const rows: ResultRow[] = [];
  for (const s of dealt) {
    if (s.isBot || !s.userId) continue;
    const i = out.indexOf(s.id);
    const place = i >= 0 ? i + 1 : players;
    rows.push({
      gameKey: g.gameKey,
      userId: s.userId,
      bucket,
      place,
      players,
      win: s.id === g.winnerId,
      loss: i < 0 && holding.length === 1,
      roomId: g.roomId,
      finishedAt: g.finishedAt,
    });
  }
  return rows;
}

/** Writes result rows. Rows already written (same game, same user) are left alone. */
export async function recordResults(db: D1Database, rows: ResultRow[]): Promise<void> {
  if (!rows.length) return;
  await db.batch(rows.map((r) =>
    db.prepare(
      `INSERT OR IGNORE INTO game_results (game_key, user_id, bucket, place, players, win, loss, room_id, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(r.gameKey, r.userId, r.bucket, r.place, r.players, r.win ? 1 : 0, r.loss ? 1 : 0, r.roomId, r.finishedAt),
  ));
}

export interface BucketStats {
  games: number;
  wins: number;
  losses: number;
  /** Wins over games, 0..1; 0 with no games. */
  winRate: number;
  /** Mean finishing place, or null with no games. */
  avgPlace: number | null;
}

export type Stats = Record<Bucket, BucketStats>;

export async function statsFor(db: D1Database, userId: string): Promise<Stats> {
  const { results } = await db.prepare(
    `SELECT bucket, COUNT(*) AS games, SUM(win) AS wins, SUM(loss) AS losses, AVG(place) AS avg_place
     FROM game_results WHERE user_id = ? GROUP BY bucket`,
  ).bind(userId).all<{ bucket: Bucket; games: number; wins: number; losses: number; avg_place: number }>();
  const stats = {} as Stats;
  for (const b of BUCKETS) {
    const r = results.find((x) => x.bucket === b);
    const games = r?.games ?? 0;
    stats[b] = {
      games,
      wins: r?.wins ?? 0,
      losses: r?.losses ?? 0,
      winRate: games ? (r!.wins ?? 0) / games : 0,
      avgPlace: games ? Math.round(r!.avg_place * 100) / 100 : null,
    };
  }
  return stats;
}

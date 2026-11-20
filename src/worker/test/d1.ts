// A D1Database stand-in over node:sqlite, so tests run the real migrations and SQL.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

class Stmt {
  constructor(private db: DatabaseSync, private sql: string, private args: unknown[] = []) {}
  bind(...args: unknown[]) {
    return new Stmt(this.db, this.sql, args);
  }
  private prepared() {
    // D1 numbers ?1 ?2; node:sqlite wants them bound positionally too, so expand them.
    const order: number[] = [];
    const sql = this.sql.replace(/\?(\d+)?/g, (_m, n) => {
      order.push(n ? Number(n) - 1 : order.length);
      return "?";
    });
    return { st: this.db.prepare(sql), args: order.map((i) => this.args[i] as never) };
  }
  async first<T>() {
    const { st, args } = this.prepared();
    return ((st.all(...args)[0] as T) ?? null);
  }
  async all<T>() {
    const { st, args } = this.prepared();
    return { results: st.all(...args) as T[], success: true, meta: {} };
  }
  async run() {
    const { st, args } = this.prepared();
    if (/\breturning\b/i.test(this.sql)) {
      const rows = st.all(...args);
      return { success: true, results: rows, meta: { changes: rows.length } };
    }
    const r = st.run(...args);
    return { success: true, results: [], meta: { changes: Number(r.changes) } };
  }
}

export function testD1(): D1Database {
  const db = new DatabaseSync(":memory:");
  const dir = join(import.meta.dirname, "../../../migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) db.exec(readFileSync(join(dir, f), "utf8"));
  const d1 = {
    prepare: (sql: string) => new Stmt(db, sql),
    async batch(stmts: Stmt[]) {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    exec: async (sql: string) => db.exec(sql),
    raw: db,
  };
  return d1 as unknown as D1Database;
}

import type { Env } from "./env";
import { currentUser, handleAuth } from "./auth";

export { HeartOfFiveRoom } from "./room";

// Served at askscottpierce.com/h5. Keep in step with src/client/base.ts, vite.config.ts, and wrangler.jsonc.
const BASE = "/h5";

/** Room codes people can read aloud: no 0/O or 1/I/L. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

function newRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

const notFound = () => Response.json({ error: "Not found" }, { status: 404 });

/**
 * /api/rooms/new/ws       open a socket to a brand-new room
 * /api/rooms/:code/ws     open a socket to an existing room (or take a seat back)
 * /api/health             liveness check
 * /api/auth/*, /api/me, /api/stats   sign-in and stats (src/worker/auth.ts)
 */
async function handleApi(req: Request, env: Env, sub: string): Promise<Response> {
  if (sub === "/api/health") return Response.json({ ok: true });
  const auth = await handleAuth(req, env, sub);
  if (auth) return auth;

  const m = /^\/api\/rooms\/([A-Za-z0-9]{1,16})\/ws$/.exec(sub);
  if (!m) return notFound();
  if (req.headers.get("Upgrade") !== "websocket") {
    return Response.json({ error: "Expected a WebSocket upgrade" }, { status: 426 });
  }

  // Headers only this Worker sets: strip anything a client sent under these names, then add the
  // signed-in user (from the session cookie the same-origin upgrade carries) for the room to record.
  const headers = new Headers(req.headers);
  headers.delete("X-H5-Create");
  headers.delete("X-H5-User");
  const user = await currentUser(req, env).catch(() => null);
  if (user) headers.set("X-H5-User", user.id);

  if (m[1] === "new") {
    const code = newRoomCode();
    headers.set("X-H5-Create", code);
    return env.ROOMS.getByName(code).fetch(new Request(req, { headers }));
  }
  return env.ROOMS.getByName(m[1].toUpperCase()).fetch(new Request(req, { headers }));
}

export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    if (path !== BASE && !path.startsWith(`${BASE}/`)) return new Response("Not found", { status: 404 });
    const sub = path.slice(BASE.length);
    if (sub.startsWith("/api/")) return handleApi(req, env, sub);
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;

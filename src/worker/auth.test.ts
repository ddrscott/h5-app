import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { checkCode, handleAuth, MAX_ATTEMPTS } from "./auth";
import { testD1 } from "./test/d1";
import type { Env } from "./env";

const env = (): Env => ({ DB: testD1(), DEV_LOGIN_CODES: "1", EMAIL_FROM: "hey@example.com" } as unknown as Env);
const req = (path: string, body?: unknown, cookie?: string) =>
  new Request(`https://example.com/h5${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.9", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function startCode(e: Env, email: string): Promise<string> {
  const res = await handleAuth(req("/api/auth/start", { email }), e, "/api/auth/start");
  const body = await res!.json() as { devCode: string };
  assert.match(body.devCode, /^\d{6}$/);
  return body.devCode;
}
const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

describe("Sign-in codes", () => {
  test("the right code signs in and sets a /h5 session cookie", async () => {
    const e = env();
    const code = await startCode(e, "Ann@Example.com");
    const res = await handleAuth(req("/api/auth/verify", { email: "ann@example.com", code }), e, "/api/auth/verify");
    assert.equal(res!.status, 200);
    const cookie = res!.headers.get("Set-Cookie")!;
    assert.match(cookie, /Path=\/h5;/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Secure/);
    const me = await (await handleAuth(req("/api/me", undefined, cookie.split(";")[0]), e, "/api/me"))!.json() as { email: string };
    assert.equal(me.email, "ann@example.com");
  });

  test("a wrong code is refused and says how many tries are left", async () => {
    const e = env();
    const code = await startCode(e, "bo@example.com");
    const r = await checkCode(req("/x"), e, "bo@example.com", wrong(code));
    assert.deepEqual(r, { error: `That code isn't right. ${MAX_ATTEMPTS - 1} tries left.` });
  });

  test("an expired code is refused, even when it's right", async () => {
    const e = env();
    const code = await startCode(e, "cy@example.com");
    await e.DB.prepare("UPDATE login_codes SET expires_at = ? WHERE email = ?").bind(Date.now() - 1, "cy@example.com").run();
    assert.deepEqual(await checkCode(req("/x"), e, "cy@example.com", code), { error: "That code expired. Send a new one." });
  });

  test("too many tries burns the code, so even the right one stops working", async () => {
    const e = env();
    const code = await startCode(e, "di@example.com");
    for (let i = 0; i < MAX_ATTEMPTS; i++) await checkCode(req("/x"), e, "di@example.com", wrong(code));
    assert.deepEqual(await checkCode(req("/x"), e, "di@example.com", code), { error: "Too many tries. Send a new code." });
  });

  test("a code works once", async () => {
    const e = env();
    const code = await startCode(e, "ed@example.com");
    assert.ok("cookie" in await checkCode(req("/x"), e, "ed@example.com", code));
    assert.deepEqual(await checkCode(req("/x"), e, "ed@example.com", code), { error: "That code expired. Send a new one." });
  });

  test("a resend within 30 seconds is refused", async () => {
    const e = env();
    await startCode(e, "fy@example.com");
    const res = await handleAuth(req("/api/auth/start", { email: "fy@example.com" }), e, "/api/auth/start");
    assert.equal(res!.status, 429);
  });

  test("guesses are capped per email across resends", async () => {
    const e = env();
    let last: unknown;
    for (let round = 0; round < 3; round++) {
      await e.DB.prepare("DELETE FROM login_codes").run(); // skip the resend cooldown
      const code = await startCode(e, "gu@example.com");
      for (let i = 0; i < 4; i++) last = await checkCode(req("/x"), e, "gu@example.com", wrong(code));
    }
    assert.deepEqual(last, { error: "Too many sign-in attempts. Wait a while, then send a new code." });
  });

  test("signing out ends the session", async () => {
    const e = env();
    const code = await startCode(e, "ha@example.com");
    const r = await checkCode(req("/x"), e, "ha@example.com", code) as { cookie: string };
    const cookie = r.cookie.split(";")[0];
    const out = await handleAuth(req("/api/auth/logout", {}, cookie), e, "/api/auth/logout");
    assert.match(out!.headers.get("Set-Cookie")!, /Max-Age=0/);
    assert.equal(await (await handleAuth(req("/api/me", undefined, cookie), e, "/api/me"))!.json(), null);
  });

  test("a signed-in player can set a display name", async () => {
    const e = env();
    const code = await startCode(e, "iv@example.com");
    const cookie = (await checkCode(req("/x"), e, "iv@example.com", code) as { cookie: string }).cookie.split(";")[0];
    const res = await handleAuth(req("/api/me", { name: "  Ivy\u0000 " }, cookie), e, "/api/me");
    assert.equal((await res!.json() as { name: string }).name, "Ivy");
  });
});

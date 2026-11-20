import type { HeartOfFiveRoom } from "./room";

export interface Env {
  ASSETS: Fetcher;
  ROOMS: DurableObjectNamespace<HeartOfFiveRoom>;
  /** Accounts, sessions, and game results (migrations/). */
  DB: D1Database;
  /** Sign-in emails. */
  EMAIL: SendEmail;
  EMAIL_FROM: string;
  /** "1" only in .dev.vars: sign-in codes come back in the response instead of by email. */
  DEV_LOGIN_CODES?: string;
}

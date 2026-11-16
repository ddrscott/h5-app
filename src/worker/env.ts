import type { HeartOfFiveRoom } from "./room";

export interface Env {
  ASSETS: Fetcher;
  ROOMS: DurableObjectNamespace<HeartOfFiveRoom>;
}

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { classifyBucket, recordResults, resultRows, statsFor, type FinishedGame } from "./stats";
import { testD1 } from "./test/d1";

const human = (id: string, userId?: string) => ({ id, isBot: false, userId });
const bot = (id: string) => ({ id, isBot: true });

describe("Stats buckets", () => {
  test("every seat human is PvP", () => {
    assert.equal(classifyBucket([human("a"), human("b")]), "pvp");
    assert.equal(classifyBucket([human("a"), human("b"), human("c"), human("d")]), "pvp");
  });
  test("two or more humans plus a bot is mixed", () => {
    assert.equal(classifyBucket([human("a"), human("b"), bot("x")]), "mixed");
    assert.equal(classifyBucket([human("a"), bot("x"), human("b"), bot("y")]), "mixed");
  });
  test("one human and the rest bots is vs computer", () => {
    assert.equal(classifyBucket([human("a"), bot("x")]), "computer");
    assert.equal(classifyBucket([bot("x"), human("a"), bot("y"), bot("z")]), "computer");
  });
  test("a table with no humans counts for nobody", () => {
    assert.equal(classifyBucket([bot("x"), bot("y")]), null);
  });
});

const game = (over: Partial<FinishedGame> = {}): FinishedGame => ({
  gameKey: "ROOM01:1:1",
  roomId: "ROOM01",
  seats: [human("a", "u1"), bot("x"), bot("y")],
  finishOrder: ["x", "a"],
  present: ["a", "x", "y"],
  winnerId: "x",
  finishedAt: 1,
  ...over,
});

describe("Result rows", () => {
  test("place follows the finishing order; last with cards takes the loss", () => {
    assert.deepEqual(resultRows(game()).map((r) => [r.userId, r.bucket, r.place, r.win, r.loss]), [["u1", "computer", 2, false, false]]);
    const lost = resultRows(game({ finishOrder: ["x", "y"] }))[0];
    assert.deepEqual([lost.place, lost.win, lost.loss], [3, false, true]);
    const won = resultRows(game({ finishOrder: ["a", "x"], winnerId: "a" }))[0];
    assert.deepEqual([won.place, won.win, won.loss], [1, true, false]);
  });
  test("bots and guests get no rows", () => {
    const rows = resultRows(game({ seats: [human("a", "u1"), human("b"), bot("x")], present: ["a", "b", "x"] }));
    assert.deepEqual(rows.map((r) => [r.userId, r.bucket]), [["u1", "mixed"]]);
  });
  test("a game that ended with nobody out counts for nobody", () => {
    assert.deepEqual(resultRows(game({ winnerId: null, finishOrder: [] })), []);
  });
});

describe("Recording stats", () => {
  test("writing the same game twice counts it once", async () => {
    const db = testD1();
    const rows = resultRows(game({ finishOrder: ["a", "x"], winnerId: "a" }));
    await recordResults(db, rows);
    await recordResults(db, rows); // a retry after hibernation, or a replayed end of game
    await recordResults(db, resultRows(game({ finishOrder: ["a", "x"], winnerId: "a" })));
    const s = await statsFor(db, "u1");
    assert.equal(s.computer.games, 1);
    assert.equal(s.computer.wins, 1);
    assert.equal(s.pvp.games, 0);
  });
  test("totals add up per bucket across games", async () => {
    const db = testD1();
    await recordResults(db, resultRows(game({ gameKey: "R:1:1", finishOrder: ["a", "x"], winnerId: "a" })));
    await recordResults(db, resultRows(game({ gameKey: "R:1:2", finishOrder: ["x", "y"], winnerId: "x" })));
    await recordResults(db, resultRows(game({
      gameKey: "R:1:3", seats: [human("a", "u1"), human("b", "u2")], present: ["a", "b"], finishOrder: ["b"], winnerId: "b",
    })));
    const s = await statsFor(db, "u1");
    assert.deepEqual(s.computer, { games: 2, wins: 1, losses: 1, winRate: 0.5, avgPlace: 2 });
    assert.deepEqual(s.pvp, { games: 1, wins: 0, losses: 1, winRate: 0, avgPlace: 2 });
    assert.deepEqual(s.mixed, { games: 0, wins: 0, losses: 0, winRate: 0, avgPlace: null });
    assert.equal((await statsFor(db, "u2")).pvp.wins, 1);
  });
});

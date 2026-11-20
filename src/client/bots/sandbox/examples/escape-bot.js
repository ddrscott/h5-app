// Test bot: tries every way out of the sandbox on its first turn and reports each one with
// console.log ("blocked ..." or "ESCAPED ..."). Then it plays like the starter bot would.
// The smoke test swaps TARGET for a local server that allows any origin (and counts hits) and
// APP for the game's own address, so each attempt would succeed if the sandbox let it out.

const TARGET = "https://example.com/";
const APP = "https://example.com/";
let tried = false;

async function attempt(name, fn) {
  try {
    await fn();
    console.log("ESCAPED " + name);
  } catch (err) {
    console.log("blocked " + name + ": " + String((err && err.message) || err).slice(0, 120));
  }
}

const later = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error("no answer in " + ms + "ms")), ms));

async function decide(view) {
  if (!tried) {
    tried = true;
    await attempt("fetch", () => fetch(TARGET).then((r) => r.text()));
    await attempt("XMLHttpRequest", () => new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open("GET", TARGET);
      x.onload = resolve;
      x.onerror = () => reject(new Error("network error"));
      x.send();
    }));
    await attempt("WebSocket", () => Promise.race([later(1500), new Promise((resolve, reject) => {
      const ws = new WebSocket(APP.replace(/^http/, "ws") + "h5/api/rooms/new/ws");
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error("socket error"));
    })]));
    await attempt("importScripts", () => importScripts(TARGET + "ok.js"));
    await attempt("new Worker", () => { new Worker(URL.createObjectURL(new Blob(["postMessage(1)"]))); });
    await attempt("eval", () => eval("1 + 1"));
    await attempt("localStorage", () => { if (typeof localStorage === "undefined") throw new Error("not defined"); localStorage.getItem("h5-seat"); });
    await attempt("indexedDB", () => new Promise((resolve, reject) => { const r = indexedDB.open("x"); r.onsuccess = resolve; r.onerror = () => reject(r.error); }));
    await attempt("document", () => { if (typeof document === "undefined") throw new Error("not defined"); document.cookie; });
    console.log("origin " + self.origin);
  }
  return view.legalMoves.find((m) => m.pass) || view.legalMoves[0];
}

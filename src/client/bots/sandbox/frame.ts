/**
 * The two pieces of code the sandbox is built from. Nothing here runs in the app's own page.
 *
 * 1. FRAME_HTML is the srcdoc of a hidden <iframe sandbox="allow-scripts"> (no allow-same-origin),
 *    so it gets an opaque origin: no cookies, no localStorage or sessionStorage (where the seat
 *    token lives), no IndexedDB, and no way into the app's DOM. Its CSP allows only its own inline
 *    script and blob: workers. With no connect-src, default-src 'none' blocks fetch, XHR,
 *    WebSocket and EventSource; script-src blocks importScripts of any remote URL and eval. A
 *    worker made from a blob: URL inherits the frame's CSP and origin.
 *
 * 2. workerSource(code) is the script the frame starts as a dedicated Web Worker: a small prelude,
 *    the uploaded bot wrapped in a function, and the message loop. The prelude removes Worker and
 *    SharedWorker, since CSP can't tell a bot's own blob: worker from ours.
 *
 * Messages, all plain JSON through postMessage:
 *   app → frame   {type:"load", code} · {type:"decide", id, view} · {type:"kill"}
 *   frame → app   {type:"frame-ready"} · {type:"ready", ok, error?} · {type:"move", id, move}
 *                 {type:"error", id, message} · {type:"crash", message, line} · {type:"log", text}
 */

export const FRAME_CSP = "default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:";

const FRAME_SCRIPT = `
(() => {
  let worker = null;
  const up = (m) => parent.postMessage(m, '*');
  addEventListener('message', (e) => {
    if (e.source !== parent) return;
    const m = e.data || {};
    if (m.type === 'load') {
      if (worker) worker.terminate();
      try {
        const url = URL.createObjectURL(new Blob([m.source], { type: 'text/javascript' }));
        worker = new Worker(url);
        URL.revokeObjectURL(url);
        worker.onmessage = (ev) => up(ev.data);
        worker.onerror = (ev) => { ev.preventDefault(); up({ type: 'crash', message: ev.message || 'The bot crashed', line: ev.lineno || 0 }); };
      } catch (err) {
        up({ type: 'crash', message: 'Could not start the bot: ' + String(err && err.message || err) });
      }
    } else if (m.type === 'decide' && worker) {
      worker.postMessage({ type: 'decide', id: m.id, view: m.view });
    } else if (m.type === 'kill' && worker) {
      worker.terminate();
      worker = null;
    }
  });
  up({ type: 'frame-ready' });
})();`;

export const FRAME_HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${FRAME_CSP}">
</head><body><script>${FRAME_SCRIPT}</script></body></html>`;

/** Lines of prelude before the bot's code, so an error's line number can be reported as the bot's own. */
export const PRELUDE_LINES = 12;

/** The whole worker script for one bot. */
export function workerSource(code: string): string {
  const prelude = [
    '"use strict";',
    'const __post = self.postMessage.bind(self);',
    'delete self.Worker; delete self.SharedWorker;',
    'let __logs = 0;',
    'const __log = (...a) => { if (++__logs > 200) return; try { __post({ type: "log", text: a.map((x) => typeof x === "string" ? x : JSON.stringify(x)).join(" ").slice(0, 500) }); } catch (e) {} };',
    'self.console = { log: __log, info: __log, warn: __log, error: __log, debug: __log };',
    'const __decide = (function () {',
    '// ---- your bot starts on the next line ----',
    '',
    '',
    '',
    '',
  ];
  const epilogue = `
;
return typeof decide === "function" ? decide : (typeof self.decide === "function" ? self.decide : null);
})();
self.onmessage = async (e) => {
  const m = e.data || {};
  if (m.type !== "decide") return;
  __logs = 0;
  try {
    const move = await __decide(m.view);
    __post({ type: "move", id: m.id, move: JSON.parse(JSON.stringify(move === undefined ? null : move)) });
  } catch (err) {
    __post({ type: "error", id: m.id, message: String(err && err.message || err).slice(0, 500) });
  }
};
__post(__decide ? { type: "ready", ok: true } : { type: "ready", ok: false, error: "No decide(view) function found. Define function decide(view) { ... } at the top level." });
`;
  return prelude.join('\n') + '\n' + code + '\n' + epilogue;
}

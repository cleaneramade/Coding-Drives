#!/usr/bin/env node
// Drive the running Coding Drives window over the Chrome DevTools Protocol.
//
// electron.cjs opens a debugging socket only when CD_DEBUG_PORT is set in the
// environment at launch, so a normal install never exposes one. Start the dev
// build with it and this script can reload the renderer, assert on real DOM
// state and grab screenshots — all of which beat trying to screenshot the
// window, which loses the foreground lock to whatever is on top.
//
//   $env:CD_DEBUG_PORT='9222'
//   Start-Process 'dist\win-unpacked\Coding Drives.exe'
//
// Usage:
//   node scripts/cdp.mjs reload                  reload the renderer
//   node scripts/cdp.mjs eval "<js>"             evaluate (top-level await ok)
//   node scripts/cdp.mjs shot out.png [x y w h]  screenshot, optional clip
//
// See memory: coding-drives-ui-verification.
import { writeFileSync } from "node:fs";

const PORT = process.env.CD_DEBUG_PORT || "9222";

async function target() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const list = await res.json();
  const page = list.find((t) => t.type === "page" && t.url.includes("5179"));
  if (!page) throw new Error("no Coding Drives page on the debug port — is the dev build running with CD_DEBUG_PORT?");
  return page.webSocketDebuggerUrl;
}

// Minimal CDP client: one socket, id-matched replies, no dependencies.
async function connect() {
  const ws = new WebSocket(await target());
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error("cdp socket failed")); });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    const w = waiting.get(msg.id);
    if (!w) return;
    waiting.delete(msg.id);
    msg.error ? w.no(new Error(msg.error.message)) : w.ok(msg.result);
  };
  const send = (method, params = {}) =>
    new Promise((ok, no) => { const n = ++id; waiting.set(n, { ok, no }); ws.send(JSON.stringify({ id: n, method, params })); });
  return { send, close: () => ws.close() };
}

const [cmd, ...rest] = process.argv.slice(2);
const cdp = await connect();
try {
  if (cmd === "reload") {
    await cdp.send("Page.enable");
    await cdp.send("Page.reload", { ignoreCache: true });
    console.log("reloaded");
  } else if (cmd === "eval") {
    const r = await cdp.send("Runtime.evaluate", {
      expression: `(async () => { ${rest.join(" ")} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      console.error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      process.exitCode = 1;
    } else {
      const v = r.result.value;
      console.log(typeof v === "string" ? v : JSON.stringify(v, null, 1));
    }
  } else if (cmd === "shot") {
    const [out, x, y, w, h] = rest;
    const params = { format: "png" };
    if (w && h) params.clip = { x: +x, y: +y, width: +w, height: +h, scale: 1 };
    const r = await cdp.send("Page.captureScreenshot", params);
    writeFileSync(out, Buffer.from(r.data, "base64"));
    console.log("saved", out);
  } else {
    console.log("usage: cdp.mjs reload | eval \"<js>\" | shot out.png [x y w h]");
  }
} finally {
  cdp.close();
}

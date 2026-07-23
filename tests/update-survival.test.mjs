// Proves the one guarantee that matters on every release: installing a new
// version never loses what the user set.
//
// The install directory (config.json) is wiped and replaced by the NSIS
// installer on every update; userData (user-config.json, projects.json) is not.
// So the test boots the REAL server twice against the SAME userData but two
// DIFFERENT bundled configs — standing in for "user was on 1.5, now they're on
// 1.6, and 1.6 shipped different defaults" — and asserts every user value came
// through untouched.
//
// It runs the actual server.js rather than re-implementing the merge, because a
// reimplementation would happily keep passing after the real merge broke.
//
// Run: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER = path.join(REPO, "server.js");

// Ports are fixed rather than random so a leaked process is obvious instead of
// silently passing on a different port next run.
const PORT_V15_DEFAULT = 5391;   // what "1.5" ships
const PORT_USER_CHOICE = 5392;   // what the user picks
const PORT_V16_DEFAULT = 5393;   // what "1.6" ships — must NOT win

// Bundled defaults as they'd ship inside the install directory.
function bundledConfig({ port, statuses, tools, excludeFolders }) {
  return {
    scanPaths: [],
    excludeFolders,
    backupPath: "",
    designSystemCss: "",
    extraProjectPaths: [],
    tools,
    statuses,
    port,
  };
}

const V15_STATUSES = [
  { id: "in-progress", label: "In Progress", color: "warning" },
  { id: "on-hold",     label: "On Hold",     color: "danger" },
  { id: "done",        label: "Done",        color: "success" },
  { id: "archived",    label: "Archived",    color: "archived" },
];

// "1.6" deliberately ships DIFFERENT defaults for every build-owned key. If any
// of these leak through into the user's live config, the test fails — which is
// exactly the regression we're guarding against.
const V16_STATUSES = [
  { id: "in-progress", label: "RENAMED BY 1.6", color: "info" },
  { id: "shipped",     label: "Shipped",        color: "brand" },
];

async function startServer({ configPath, dataDir, dsDir, port }) {
  const proc = spawn(process.execPath, [SERVER], {
    cwd: REPO,
    env: { ...process.env, PT_CONFIG_PATH: configPath, PT_DATA_DIR: dataDir, PT_DS_DIR: dsDir },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  proc.stdout.on("data", (d) => { output += d; });
  proc.stderr.on("data", (d) => { output += d; });

  // Poll the endpoint rather than scraping stdout for a ready line — one fewer
  // thing to break when a log message is reworded.
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      throw new Error(`server exited early (code ${proc.exitCode}):\n${output}`);
    }
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/config`);
      if (r.ok) return { proc, output: () => output };
    } catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  proc.kill();
  throw new Error(`server never came up on ${port}:\n${output}`);
}

async function stopServer(handle) {
  if (!handle?.proc || handle.proc.exitCode !== null) return;
  const exited = new Promise((r) => handle.proc.once("exit", r));
  handle.proc.kill();
  await exited;
}

test("user data survives an update that changes every bundled default", async (t) => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "cd-update-survival-"));
  const dataDir = path.join(tmp, "userdata", "data");
  const dsDir = path.join(tmp, "userdata", "ds");
  const v15Config = path.join(tmp, "install-v15-config.json");
  const v16Config = path.join(tmp, "install-v16-config.json");
  await fsp.mkdir(dataDir, { recursive: true });

  let server = null;
  t.after(async () => {
    await stopServer(server);
    await fsp.rm(tmp, { recursive: true, force: true });
  });

  await fsp.writeFile(v15Config, JSON.stringify(bundledConfig({
    port: PORT_V15_DEFAULT,
    statuses: V15_STATUSES,
    tools: { vscode: "code.cmd", claude: "claude", codex: "codex", windowsTerminal: "wt.exe" },
    excludeFolders: [".git", "node_modules"],
  })));

  // A project already parked on a legacy status id, to prove the migration
  // runner rehomes it instead of stranding it off the filter row.
  await fsp.writeFile(path.join(dataDir, "projects.json"), JSON.stringify({
    "cHJvai1sZWdhY3k": { status: "idea", note: "seeded before the rename" },
    "cHJvai1kb25l":    { status: "done", note: "keep me" },
  }));

  // ── Boot 1: the user is on "1.5" and configures the app ──────────────────
  server = await startServer({ configPath: v15Config, dataDir, dsDir, port: PORT_V15_DEFAULT });

  // Port is deliberately NOT set here — it's covered by its own test below.
  // Overriding it would make boot 2 listen somewhere else, and every failure in
  // this test would surface as an unhelpful connection timeout instead of a
  // named assertion.
  const userSettings = {
    scanPaths: ["D:\\my-code"],
    excludeFolders: ["Archive", "Scratch"],
    backupPath: "E:\\my-backups",
    designSystemCss: "D:\\my-code\\theme.css",
    tools: { vscode: "D:\\VSCode\\code.cmd", claude: "claude", codex: "codex", windowsTerminal: "wt.exe" },
    statuses: [
      { id: "in-progress", label: "My In Progress", color: "warning" },
      { id: "testing",     label: "Testing",        color: "info" },
      { id: "done",        label: "Done",           color: "success" },
    ],
    headlessTerminals: true,
    taskAgent: "codex",
  };

  const saveRes = await fetch(`http://127.0.0.1:${PORT_V15_DEFAULT}/api/config`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(userSettings),
  });
  assert.equal(saveRes.status, 200, "saving settings should succeed");

  await t.test("legacy status ids are migrated on boot", async () => {
    const db = JSON.parse(await fsp.readFile(path.join(dataDir, "projects.json"), "utf8"));
    assert.equal(db["cHJvai1sZWdhY3k"].status, "in-progress", '"idea" should migrate to "in-progress"');
    assert.equal(db["cHJvai1sZWdhY3k"].note, "seeded before the rename", "migration must not touch other fields");
    const schema = JSON.parse(await fsp.readFile(path.join(dataDir, "schema.json"), "utf8"));
    assert.equal(schema.projects, 1, "schema version should be stamped after migrating");
  });

  await t.test("deleting a status rehomes the projects using it", async () => {
    // "archived" existed in 1.5 and the user's list drops it. No project was on
    // it here, but "done" survives the edit and must stay put.
    const db = JSON.parse(await fsp.readFile(path.join(dataDir, "projects.json"), "utf8"));
    assert.equal(db["cHJvai1kb25l"].status, "done", "a project on a kept status stays put");
  });

  await stopServer(server);
  server = null;

  // ── The update: install dir replaced with "1.6", userData untouched ───────
  // Same port as 1.5 so this test stays reachable and its failures stay legible.
  await fsp.writeFile(v16Config, JSON.stringify(bundledConfig({
    port: PORT_V15_DEFAULT,
    statuses: V16_STATUSES,
    tools: { vscode: "SOMETHING-ELSE.cmd", claude: "claude-v2", codex: "codex-v2", windowsTerminal: "wt-v2.exe" },
    excludeFolders: ["totally", "different"],
  })));

  // ── Boot 2: same userData, brand-new defaults ────────────────────────────
  server = await startServer({ configPath: v16Config, dataDir, dsDir, port: PORT_V15_DEFAULT });
  const cfg = await (await fetch(`http://127.0.0.1:${PORT_V15_DEFAULT}/api/config`)).json();

  await t.test("settings the user set are unchanged", () => {
    assert.deepEqual(cfg.scanPaths, userSettings.scanPaths);
    assert.deepEqual(cfg.excludeFolders, userSettings.excludeFolders);
    assert.equal(cfg.backupPath, userSettings.backupPath);
    assert.equal(cfg.headlessTerminals, true);
    assert.equal(cfg.taskAgent, "codex");
  });

  await t.test("keys that used to live only in the install dir are unchanged", () => {
    // These silently reverted before this work: they had no UI, so they only
    // ever existed in the throwaway box. (port has its own test below.)
    assert.deepEqual(cfg.tools, userSettings.tools, "tool paths must not revert to 1.6's defaults");
    assert.equal(cfg.designSystemCss, userSettings.designSystemCss);
  });

  await t.test("the user's status list wins over the new version's", () => {
    assert.deepEqual(cfg.statuses, userSettings.statuses);
    assert.ok(!cfg.statuses.some((s) => s.label === "RENAMED BY 1.6"), "1.6's labels must not leak in");
    assert.ok(!cfg.statuses.some((s) => s.id === "shipped"), "1.6's new status must not be forced on the user");
  });

  await t.test("project data survives", async () => {
    const db = JSON.parse(await fsp.readFile(path.join(dataDir, "projects.json"), "utf8"));
    assert.equal(db["cHJvai1kb25l"].status, "done");
    assert.equal(db["cHJvai1kb25l"].note, "keep me");
    assert.equal(db["cHJvai1sZWdhY3k"].status, "in-progress");
  });
});

// Split out from the survival test on purpose: the only way to prove the port
// survived is to reach the server on it, so failure here reads as a connection
// timeout. Isolated, that timeout is the diagnosis; mixed into the test above,
// it would mask every other assertion.
test("a user-chosen port survives an update that ships a different default", async (t) => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "cd-port-survival-"));
  const dataDir = path.join(tmp, "userdata", "data");
  const dsDir = path.join(tmp, "userdata", "ds");
  const v15Config = path.join(tmp, "install-v15-config.json");
  const v16Config = path.join(tmp, "install-v16-config.json");
  await fsp.mkdir(dataDir, { recursive: true });

  let server = null;
  t.after(async () => {
    await stopServer(server);
    await fsp.rm(tmp, { recursive: true, force: true });
  });

  const tools = { vscode: "code.cmd", claude: "claude", codex: "codex", windowsTerminal: "wt.exe" };
  await fsp.writeFile(v15Config, JSON.stringify(bundledConfig({
    port: PORT_V15_DEFAULT, statuses: V15_STATUSES, tools, excludeFolders: [".git"],
  })));
  await fsp.writeFile(v16Config, JSON.stringify(bundledConfig({
    port: PORT_V16_DEFAULT, statuses: V15_STATUSES, tools, excludeFolders: [".git"],
  })));

  // The user picks a port on 1.5.
  server = await startServer({ configPath: v15Config, dataDir, dsDir, port: PORT_V15_DEFAULT });
  const res = await fetch(`http://127.0.0.1:${PORT_V15_DEFAULT}/api/config`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ port: PORT_USER_CHOICE }),
  });
  assert.equal(res.status, 200);
  await stopServer(server);
  server = null;

  // 1.6 ships a different default. Coming up on the user's port at all is the
  // assertion — startServer only resolves once that port answers.
  server = await startServer({ configPath: v16Config, dataDir, dsDir, port: PORT_USER_CHOICE });
  const cfg = await (await fetch(`http://127.0.0.1:${PORT_USER_CHOICE}/api/config`)).json();
  assert.equal(cfg.port, PORT_USER_CHOICE, "1.6's default port must not win over the user's choice");

  // And nothing is listening on the default 1.6 would have used.
  await assert.rejects(
    fetch(`http://127.0.0.1:${PORT_V16_DEFAULT}/api/config`),
    "server must not be listening on the bundled default port",
  );
});

// Regression: statusOverrides (the pre-Settings-screen way to recolor/rename)
// used to be applied on top of everything. Once the user saves an explicit
// list, an old override must not win — that would silently revert their edit on
// the next boot, which looks exactly like the data loss this suite exists to
// prevent.
test("a legacy statusOverride does not override the user's own status edit", async (t) => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "cd-status-legacy-"));
  const dataDir = path.join(tmp, "userdata", "data");
  const dsDir = path.join(tmp, "userdata", "ds");
  const cfgPath = path.join(tmp, "install-config.json");
  await fsp.mkdir(dataDir, { recursive: true });

  await fsp.writeFile(cfgPath, JSON.stringify(bundledConfig({
    port: PORT_V15_DEFAULT,
    statuses: V15_STATUSES,
    tools: { vscode: "code.cmd", claude: "claude", codex: "codex", windowsTerminal: "wt.exe" },
    excludeFolders: [".git"],
  })));

  // A user who customised "Done" back when overrides were the only way.
  await fsp.writeFile(path.join(dataDir, "user-config.json"), JSON.stringify({
    statusOverrides: { done: { label: "Complete", color: "brand" } },
  }));

  let server = null;
  t.after(async () => {
    await stopServer(server);
    await fsp.rm(tmp, { recursive: true, force: true });
  });

  server = await startServer({ configPath: cfgPath, dataDir, dsDir, port: PORT_V15_DEFAULT });

  // With no explicit list yet, the legacy override should still show.
  const before = await (await fetch(`http://127.0.0.1:${PORT_V15_DEFAULT}/api/config`)).json();
  assert.equal(
    before.statuses.find((s) => s.id === "done").label, "Complete",
    "a legacy override must still apply for users who never opened the new screen",
  );

  // Now the user renames it in the new screen.
  const res = await fetch(`http://127.0.0.1:${PORT_V15_DEFAULT}/api/config`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      statuses: [
        { id: "in-progress", label: "In Progress", color: "warning" },
        { id: "done",        label: "Finished",    color: "success" },
      ],
    }),
  });
  assert.equal(res.status, 200);

  const after = await (await fetch(`http://127.0.0.1:${PORT_V15_DEFAULT}/api/config`)).json();
  const done = after.statuses.find((s) => s.id === "done");
  assert.equal(done.label, "Finished", "the user's explicit rename must win over the legacy override");
  assert.equal(done.color, "success", "the user's explicit color must win over the legacy override");
});

test("an unusable status list is refused rather than silently reset", async (t) => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "cd-status-guard-"));
  const dataDir = path.join(tmp, "userdata", "data");
  const dsDir = path.join(tmp, "userdata", "ds");
  const cfgPath = path.join(tmp, "install-config.json");
  await fsp.mkdir(dataDir, { recursive: true });

  await fsp.writeFile(cfgPath, JSON.stringify(bundledConfig({
    port: PORT_V15_DEFAULT,
    statuses: V15_STATUSES,
    tools: { vscode: "code.cmd", claude: "claude", codex: "codex", windowsTerminal: "wt.exe" },
    excludeFolders: [".git"],
  })));

  let server = null;
  t.after(async () => {
    await stopServer(server);
    await fsp.rm(tmp, { recursive: true, force: true });
  });

  server = await startServer({ configPath: cfgPath, dataDir, dsDir, port: PORT_V15_DEFAULT });
  const post = (statuses) => fetch(`http://127.0.0.1:${PORT_V15_DEFAULT}/api/config`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ statuses }),
  });

  // Each of these would boot into a filter row with no usable chips.
  for (const [name, bad] of [
    ["empty list",     []],
    ["missing label",  [{ id: "a" }]],
    ["blank label",    [{ id: "a", label: "   " }]],
    ["duplicate ids",  [{ id: "a", label: "A" }, { id: "a", label: "Also A" }]],
  ]) {
    const res = await post(bad);
    assert.equal(res.status, 400, `${name} should be rejected`);
  }

  // The bundled defaults must still be intact after all those rejections.
  const cfg = await (await fetch(`http://127.0.0.1:${PORT_V15_DEFAULT}/api/config`)).json();
  assert.deepEqual(cfg.statuses, V15_STATUSES, "a rejected save must not disturb the live statuses");
});

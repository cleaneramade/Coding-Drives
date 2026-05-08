// Coding Drives — local project tracker. Single-file Express server: scans
// folders, persists status/notes, opens tools, runs robocopy backups.

import express from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// When run inside Electron, electron.cjs points these at the user's writable
// userData folder so projects.json survives across portable .exe runs.
const DATA_DIR    = process.env.PT_DATA_DIR   || path.join(__dirname, "data");
const PUBLIC_DIR  = path.join(__dirname, "public");
const ASSETS_DIR  = path.join(__dirname, "assets");
const DS_OUT_DIR  = process.env.PT_DS_DIR     || path.join(PUBLIC_DIR, "ds");
const CONFIG_PATH = path.join(__dirname, "config.json");
const PROJECTS_DB = path.join(DATA_DIR, "projects.json");
const DS_OUT_FILE = path.join(DS_OUT_DIR, "colors_and_type.css");
const USER_CONFIG_PATH = path.join(DATA_DIR, "user-config.json");

// ─── Config (bundled defaults + user overrides) ─────────────────────────────
function loadBundledConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}
function loadUserConfig() {
  try { return JSON.parse(fs.readFileSync(USER_CONFIG_PATH, "utf8")); }
  catch { return {}; }
}
function loadConfig() {
  const base = loadBundledConfig();
  const user = loadUserConfig();
  // Shallow merge — user overrides win for top-level keys.
  const cfg = { ...base, ...user };
  // extraProjectPaths is union'd so neither side wipes the other.
  cfg.extraProjectPaths = Array.from(new Set([
    ...(base.extraProjectPaths || []),
    ...(user.extraProjectPaths || []),
  ]));
  // Apply per-status overrides (label / color hex) on top of bundled statuses.
  if (user.statusOverrides && Array.isArray(cfg.statuses)) {
    cfg.statuses = cfg.statuses.map((s) => {
      const o = user.statusOverrides[s.id];
      return o ? { ...s, ...(o.label ? { label: o.label } : {}), ...(o.color ? { color: o.color } : {}) } : s;
    });
  }
  return cfg;
}

// Default backup destination — the user's Documents folder when nothing else is configured.
function defaultBackupPath() {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  return path.join(home, "Documents", "Coding Drives Backups");
}
async function saveUserConfig(patch) {
  const next = { ...loadUserConfig(), ...patch };
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.writeFile(USER_CONFIG_PATH, JSON.stringify(next, null, 2));
  return next;
}

// ─── Shared exclusion lists ─────────────────────────────────────────────────
// Heavy folders skipped by both backup and GitHub-prep mirrors. Robocopy /XD
// expects bare folder names, not paths.
const HEAVY_DIRS = [
  "node_modules", ".next", "dist", "build", "out", ".turbo",
  ".vercel", "target", "Pods", ".gradle", ".dart_tool",
];

// Files that almost never belong in a public repo. Checked against basename.
const SECRET_FILE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /\.pem$/i, /\.key$/i, /\.pfx$/i, /\.p12$/i,
  /^id_(rsa|ed25519|ecdsa|dsa)$/i,
  /^firebase-adminsdk.*\.json$/i,
  /^service-account.*\.json$/i,
  /^\.npmrc$/i,
  /^credentials(\.json|\.txt)?$/i,
];

function matchesSecret(basename) {
  return SECRET_FILE_PATTERNS.some((re) => re.test(basename));
}

// ─── Slug helpers (round-trippable folder paths) ────────────────────────────
function toSlug(absPath) {
  return Buffer.from(absPath, "utf8").toString("base64url");
}
function fromSlug(slug) {
  return Buffer.from(slug, "base64url").toString("utf8");
}

// ─── Status DB ──────────────────────────────────────────────────────────────
async function ensureDataDir() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PROJECTS_DB)) await fsp.writeFile(PROJECTS_DB, "{}");
}

// One-shot migration for status renames so existing entries don't end up in
// a status that's no longer in the statuses list (which would orphan them
// from the filter UI). Runs every boot — idempotent.
const STATUS_MIGRATIONS = {
  idea:    "in-progress",   // "Idea" was removed; default is now In Progress
  paused:  "on-hold",       // "Paused" renamed to "On Hold"
};
async function migrateStatusDB() {
  const db = await readDB();
  let changed = false;
  for (const slug of Object.keys(db)) {
    const cur = db[slug]?.status;
    if (cur && STATUS_MIGRATIONS[cur]) {
      db[slug].status = STATUS_MIGRATIONS[cur];
      changed = true;
    }
  }
  if (changed) {
    await writeDB(db);
    console.log("[migrate] updated stored statuses to new IDs");
  }
}
async function readDB() {
  await ensureDataDir();
  try { return JSON.parse(await fsp.readFile(PROJECTS_DB, "utf8")); }
  catch { return {}; }
}
async function writeDB(db) {
  await ensureDataDir();
  await fsp.writeFile(PROJECTS_DB, JSON.stringify(db, null, 2));
}

// ─── Design system CSS sync ─────────────────────────────────────────────────
// Order of preference for the colors/type CSS that powers the app's theme:
//   1. cfg.designSystemCss — an external path the user may have set in config
//   2. assets/design-system.css — the bundled default that ships with the repo
//   3. a one-line stub so the app at least boots
const BUNDLED_DS_CSS = path.join(ASSETS_DIR, "design-system.css");
async function syncDesignSystem(cfg) {
  await fsp.mkdir(DS_OUT_DIR, { recursive: true });
  if (cfg.designSystemCss) {
    try {
      const css = await fsp.readFile(cfg.designSystemCss, "utf8");
      await fsp.writeFile(DS_OUT_FILE, css);
      console.log("[ds] synced colors_and_type.css from", cfg.designSystemCss);
      return;
    } catch (err) {
      console.warn("[ds] external design system CSS not found at", cfg.designSystemCss);
    }
  }
  try {
    const css = await fsp.readFile(BUNDLED_DS_CSS, "utf8");
    await fsp.writeFile(DS_OUT_FILE, css);
    console.log("[ds] using bundled design-system.css");
    return;
  } catch (err) {
    if (!fs.existsSync(DS_OUT_FILE)) {
      await fsp.writeFile(DS_OUT_FILE, "/* fallback — design system not found */\n");
      console.warn("[ds] design system CSS not found at", cfg.designSystemCss);
    }
  }
}

// ─── Project scanner + stack detection ──────────────────────────────────────
async function detectStack(dir) {
  const has = (f) => fs.existsSync(path.join(dir, f));
  const indicators = {
    git:    has(".git"),
    claude: has(".claude") || has("CLAUDE.md"),
    vercel: has(".vercel") || has("vercel.json") || has("vercel.ts"),
    env:    has(".env") || has(".env.local"),
  };

  let stack = "Unknown";
  if (has("next.config.js") || has("next.config.ts") || has("next.config.mjs")) stack = "Next.js";
  else if (has("package.json")) {
    try {
      const pkg = JSON.parse(await fsp.readFile(path.join(dir, "package.json"), "utf8"));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps.next) stack = "Next.js";
      else if (deps.react) stack = "React";
      else if (deps.express || deps.hono || deps.fastify) stack = "Node API";
      else if (deps.vite) stack = "Vite";
      else stack = "Node";
    } catch { stack = "Node"; }
  }
  else if (has("pubspec.yaml")) stack = "Flutter";
  else if (has("pyproject.toml") || has("requirements.txt")) stack = "Python";
  else if (has("Cargo.toml")) stack = "Rust";
  else if (has("go.mod")) stack = "Go";
  else if (has("index.html")) stack = "Static";

  return { stack, indicators };
}

async function describeProject(full, root, source) {
  let stat;
  try { stat = await fsp.stat(full); } catch { return null; }
  if (!stat.isDirectory()) return null;
  const { stack, indicators } = await detectStack(full);
  return {
    slug: toSlug(full),
    name: path.basename(full),
    path: full,
    root,
    source, // "scan" | "extra"
    stack,
    indicators,
    mtime: stat.mtimeMs,
  };
}

async function scanProjects(cfg) {
  const exclude = new Set(cfg.excludeFolders || []);
  const seen = new Set();
  const out = [];

  // Scan root paths.
  for (const root of cfg.scanPaths || []) {
    let entries = [];
    try { entries = await fsp.readdir(root, { withFileTypes: true }); }
    catch (err) { console.warn("[scan] cannot read", root, err.message); continue; }

    for (const ent of entries) {
      if (ent.name.startsWith(".")) continue;
      if (exclude.has(ent.name)) continue;
      const full = path.join(root, ent.name);
      if (seen.has(full.toLowerCase())) continue;
      const desc = await describeProject(full, root, "scan");
      if (desc) { seen.add(full.toLowerCase()); out.push(desc); }
    }
  }

  // Manually-added projects living outside the scan roots.
  for (const full of cfg.extraProjectPaths || []) {
    if (seen.has(full.toLowerCase())) continue;
    const desc = await describeProject(full, path.dirname(full), "extra");
    if (desc) { seen.add(full.toLowerCase()); out.push(desc); }
  }

  out.sort((a, b) => b.mtime - a.mtime);
  return out;
}

// ─── Express app ────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use("/ds",     express.static(DS_OUT_DIR));
app.use("/assets", express.static(ASSETS_DIR));
app.use(express.static(PUBLIC_DIR));

app.get("/api/config", (_req, res) => {
  res.json(loadConfig());
});

app.post("/api/config", async (req, res) => {
  const next = await saveUserConfig(req.body || {});
  res.json(loadConfig());
});

// Native folder/file picker — only available when running inside Electron.
async function nativePicker(opts) {
  if (process.env.PT_ELECTRON !== "1") {
    throw new Error("Native picker only available in the desktop app.");
  }
  const electron = await import("electron");
  const win = global.__codingDrivesWindow;
  return win
    ? electron.dialog.showOpenDialog(win, opts)
    : electron.dialog.showOpenDialog(opts);
}

app.post("/api/dialog/pick-folder", async (_req, res) => {
  try {
    const result = await nativePicker({ properties: ["openDirectory"] });
    if (result.canceled || !result.filePaths?.[0]) return res.json({ canceled: true });
    res.json({ path: result.filePaths[0] });
  } catch (err) {
    res.status(501).json({ error: err.message });
  }
});

app.post("/api/dialog/pick-file", async (req, res) => {
  try {
    const filters = req.body?.filters || [];
    const result = await nativePicker({ properties: ["openFile"], filters });
    if (result.canceled || !result.filePaths?.[0]) return res.json({ canceled: true });
    res.json({ path: result.filePaths[0] });
  } catch (err) {
    res.status(501).json({ error: err.message });
  }
});

// Logo: serves the user's custom logo if uploaded, otherwise the bundled SVG.
app.get("/api/logo", (_req, res) => {
  const userCfg = loadUserConfig();
  if (userCfg.customLogo && fs.existsSync(userCfg.customLogo)) {
    return res.sendFile(userCfg.customLogo);
  }
  res.sendFile(path.join(ASSETS_DIR, "logo.svg"));
});

// Upload (copy) a chosen file to userData and set it as the active logo.
app.post("/api/settings/logo", async (req, res) => {
  const src = String(req.body?.path || "");
  if (!src || !fs.existsSync(src)) return res.status(400).json({ error: "File not found." });
  const ext = path.extname(src).toLowerCase() || ".png";
  if (![".svg", ".png", ".jpg", ".jpeg", ".webp", ".ico"].includes(ext)) {
    return res.status(400).json({ error: "Unsupported image format." });
  }
  const dest = path.join(DATA_DIR, `custom-logo${ext}`);
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.copyFile(src, dest);
  await saveUserConfig({ customLogo: dest });
  res.json({ ok: true, customLogo: dest });
});

app.post("/api/settings/logo/reset", async (_req, res) => {
  const u = loadUserConfig();
  delete u.customLogo;
  await fsp.writeFile(USER_CONFIG_PATH, JSON.stringify(u, null, 2));
  res.json({ ok: true });
});

// Wipe ALL user overrides — back to bundled defaults. Project status DB is preserved.
app.post("/api/settings/reset", async (_req, res) => {
  await fsp.writeFile(USER_CONFIG_PATH, "{}");
  res.json({ ok: true, config: loadConfig() });
});

app.get("/api/projects", async (_req, res) => {
  const cfg = loadConfig();
  const [projects, db] = await Promise.all([scanProjects(cfg), readDB()]);
  const merged = projects.map((p) => {
    const stored = db[p.slug]?.status;
    const status = STATUS_MIGRATIONS[stored] || stored || "in-progress";
    return {
      ...p,
      status,
      notes: db[p.slug]?.notes || "",
      lastBackedUpAt: db[p.slug]?.lastBackedUpAt || db[p.slug]?.lastDuplicatedAt || null,
      updatedAt: db[p.slug]?.updatedAt || null,
    };
  });
  res.json({ projects: merged, statuses: cfg.statuses, backupPath: cfg.backupPath });
});

// Add a folder to the manual project list.
app.post("/api/projects/add", async (req, res) => {
  const folder = String(req.body?.path || "").trim();
  if (!folder) return res.status(400).json({ error: "path required" });
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    return res.status(400).json({ error: "Folder doesn't exist or isn't a directory." });
  }
  const cfg = loadConfig();
  const norm = path.resolve(folder);

  // Already covered by an existing scan root? Tell the user — no need to add manually.
  for (const root of cfg.scanPaths || []) {
    if (path.dirname(norm).toLowerCase() === path.resolve(root).toLowerCase()) {
      return res.json({ ok: true, alreadyTracked: true, project: await describeProject(norm, path.dirname(norm), "scan") });
    }
  }

  const next = Array.from(new Set([...(loadUserConfig().extraProjectPaths || []), norm]));
  await saveUserConfig({ extraProjectPaths: next });
  const desc = await describeProject(norm, path.dirname(norm), "extra");
  res.json({ ok: true, project: desc });
});

// Remove a manually-added folder (does NOT delete the folder, just untracks it).
app.delete("/api/projects/extra/:slug", async (req, res) => {
  const folder = fromSlug(req.params.slug);
  const user = loadUserConfig();
  const filtered = (user.extraProjectPaths || []).filter(
    (p) => path.resolve(p).toLowerCase() !== folder.toLowerCase()
  );
  await saveUserConfig({ extraProjectPaths: filtered });
  res.json({ ok: true });
});

app.post("/api/projects/:slug", async (req, res) => {
  const slug = req.params.slug;
  const folder = fromSlug(slug);
  if (!fs.existsSync(folder)) return res.status(404).json({ error: "folder not found" });

  const db = await readDB();
  const existing = db[slug] || {};
  const update = { ...existing, updatedAt: new Date().toISOString() };
  if (typeof req.body.status === "string") update.status = req.body.status;
  if (typeof req.body.notes  === "string") update.notes  = req.body.notes;
  db[slug] = update;
  await writeDB(db);
  res.json({ ok: true, entry: update });
});

// Detached-spawn helper that handles Node 20+'s restriction on running .cmd/.bat
// files. Without shell:true Node throws EINVAL for those; with shell:true Node
// concatenates args without escaping, so we manually quote every argument.
function spawnDetached(exe, args = [], { cwd } = {}) {
  const isShellScript = /\.(cmd|bat)$/i.test(exe);
  const opts = { detached: true, stdio: "ignore", windowsHide: true, cwd };
  if (isShellScript) {
    const quoted = [`"${exe}"`, ...args.map((a) => `"${a}"`)].join(" ");
    return spawn(quoted, { ...opts, shell: true }).unref();
  }
  return spawn(exe, args, { ...opts, shell: false }).unref();
}

// Run a command and capture stdout/stderr. Returns { code, stdout, stderr }.
// Used for git/gh invocations where we need exit code + output for the UI.
function runCapture(exe, args = [], { cwd } = {}) {
  return new Promise((resolve) => {
    const isShellScript = /\.(cmd|bat)$/i.test(exe);
    const opts = { stdio: ["ignore", "pipe", "pipe"], windowsHide: true, cwd };
    let child;
    if (isShellScript) {
      const quoted = [`"${exe}"`, ...args.map((a) => `"${a}"`)].join(" ");
      child = spawn(quoted, { ...opts, shell: true });
    } else {
      child = spawn(exe, args, { ...opts, shell: false });
    }
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (err) => resolve({ code: -1, stdout, stderr: err.message }));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

// Open Windows Terminal in `folder` and run `cmd` (e.g., "claude" or "codex").
// Uses `cmd.exe /c start "" wt -d <folder> <cmd>` because that's the only
// reliable way to actually surface a visible terminal window from a detached
// child on Windows. The plain spawn(wt.exe, ...) path silently fails when
// windowsHide is true and is flaky against the WindowsApps shim.
//
// `cmd` may be a single CLI name ("claude") or a full command line — we wrap
// it in cmd.exe /k so that if the binary fails (not on PATH, etc.) the user
// can see the error rather than the window slamming shut.
function spawnTerminal(folder, cmd) {
  // `start` treats the first quoted arg as a window title — we pass "" so the
  // first real arg (wt.exe) is recognised as the program. `wt -d folder` opens
  // a tab in that directory; the inner `cmd /k <cmd>` runs the requested CLI
  // and keeps the shell open so the user sees output even if the CLI exits or
  // isn't on PATH.
  return spawn(
    "cmd.exe",
    ["/c", "start", "", "wt.exe", "-d", folder, "cmd", "/k", cmd],
    { detached: true, stdio: "ignore", windowsHide: true, shell: false }
  ).unref();
}

app.post("/api/projects/:slug/open", async (req, res) => {
  const cfg = loadConfig();
  const folder = fromSlug(req.params.slug);
  if (!fs.existsSync(folder)) return res.status(404).json({ error: "folder not found" });

  const tool = req.body?.tool;
  try {
    if (tool === "vscode") {
      spawnDetached(cfg.tools.vscode, [folder]);
    } else if (tool === "claude") {
      spawnTerminal(folder, cfg.tools.claude || "claude");
    } else if (tool === "codex") {
      spawnTerminal(folder, cfg.tools.codex || "codex");
    } else if (tool === "explorer") {
      // Electron's shell.openPath is the canonical, reliable way to open a folder
      // in the system file manager. Plain spawn("explorer.exe", [folder]) silently
      // fails in some Node-on-Windows configurations.
      if (process.env.PT_ELECTRON === "1") {
        const electron = await import("electron");
        const err = await electron.shell.openPath(folder);
        if (err) throw new Error(err);
      } else {
        // Fallback for `node server.js` mode: cmd /c start "" "<path>"
        spawn("cmd.exe", ["/c", "start", "", folder], {
          detached: true, stdio: "ignore", shell: false,
        }).unref();
      }
    } else {
      return res.status(400).json({ error: "unknown tool" });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Backup ────────────────────────────────────────────────────────────────
// Each backup folder gets a marker file so we can confirm we own it before
// using robocopy /MIR (which deletes anything in dest not in source — we never
// want to /MIR an unrelated folder).
const BACKUP_MARKER = ".codingdrives-backup.json";

async function ensureBackupSafe(dest, slug, sourcePath) {
  if (!fs.existsSync(dest)) return; // fresh dest is always safe
  const stat = await fsp.stat(dest);
  if (!stat.isDirectory()) {
    throw new Error(`"${dest}" exists but is not a directory.`);
  }
  const markerPath = path.join(dest, BACKUP_MARKER);
  if (fs.existsSync(markerPath)) {
    const marker = JSON.parse(await fsp.readFile(markerPath, "utf8"));
    if (marker.slug && marker.slug !== slug) {
      throw new Error(
        `"${dest}" is the backup of a different project (${marker.name || marker.sourcePath}). ` +
        `Refusing to overwrite. Choose a different backup destination, or remove the existing folder first.`
      );
    }
    return; // ours, safe to mirror
  }
  // No marker — refuse if the folder isn't empty (could be the user's data).
  const entries = await fsp.readdir(dest);
  if (entries.length > 0) {
    throw new Error(
      `"${dest}" already exists and isn't a Coding Drives backup. ` +
      `Refusing to overwrite. Pick a different destination, or remove the existing folder first.`
    );
  }
}

async function writeBackupMarker(dest, slug, name, sourcePath) {
  const marker = { slug, name, sourcePath, backedUpAt: new Date().toISOString() };
  await fsp.writeFile(path.join(dest, BACKUP_MARKER), JSON.stringify(marker, null, 2));
}

async function backupHandler(req, res) {
  const cfg = loadConfig();
  const slug = req.params.slug;
  const folder = fromSlug(slug);
  if (!fs.existsSync(folder)) return res.status(404).json({ error: "folder not found" });

  const name = path.basename(folder);
  const db = await readDB();

  // Smart destination: prefer the recorded last destination if its parent is
  // still reachable. This gives the user the "update existing backup in place"
  // behavior — even if they later changed the default backup path.
  const recordedDest = db[slug]?.lastBackedUpDest;
  const backupRoot = cfg.backupPath || defaultBackupPath();
  let dest;
  if (recordedDest && fs.existsSync(path.dirname(recordedDest))) {
    dest = recordedDest;
  } else {
    dest = path.join(backupRoot, name);
  }

  // Safety: refuse to mirror over a folder that isn't ours.
  try {
    await ensureBackupSafe(dest, slug, folder);
  } catch (err) {
    return res.status(409).json({ error: err.message });
  }

  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.mkdir(dest, { recursive: true });
  // Marker first so a partial /MIR can still be recognized as ours next time.
  await writeBackupMarker(dest, slug, name, folder);

  const args = [
    folder, dest,
    "/MIR",
    "/XD", ...HEAVY_DIRS,
    "/XF", "*.log", BACKUP_MARKER,
    "/NFL", "/NDL", "/NJH", "/NJS", "/NP",
    "/R:1", "/W:1",
    "/MT:8",
  ];
  const start = Date.now();
  const child = spawn("robocopy.exe", args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });

  let stderr = "";
  child.stderr.on("data", (d) => { stderr += d.toString(); });

  child.on("close", async (code) => {
    const durationMs = Date.now() - start;
    const ok = code !== null && code < 8;
    // Re-write the marker after /MIR (it may have been pruned if source had no marker).
    if (ok) await writeBackupMarker(dest, slug, name, folder).catch(() => {});
    if (ok) {
      const db2 = await readDB();
      db2[slug] = {
        ...(db2[slug] || {}),
        lastBackedUpAt: new Date().toISOString(),
        lastBackedUpDest: dest,
        updatedAt: new Date().toISOString(),
      };
      await writeDB(db2);
    }
    res.json({ ok, exitCode: code, durationMs, dest, stderr: ok ? undefined : stderr });
  });

  child.on("error", (err) => {
    res.status(500).json({ error: err.message });
  });
}
app.post("/api/projects/:slug/backup",    backupHandler);
app.post("/api/projects/:slug/duplicate", backupHandler); // legacy alias

// ─── GitHub prep ───────────────────────────────────────────────────────────
// Walks `dir` (capped depth), collects basenames matching SECRET_FILE_PATTERNS
// and the set of HEAVY_DIRS actually present. We never read file contents.
async function walkForAudit(dir, { maxDepth = 4 } = {}) {
  const heavy = new Set();
  const secrets = [];
  const HEAVY = new Set(HEAVY_DIRS);

  async function walk(d, depth) {
    let entries;
    try { entries = await fsp.readdir(d, { withFileTypes: true }); }
    catch { return; }
    for (const ent of entries) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (HEAVY.has(ent.name)) { heavy.add(ent.name); continue; }
        if (ent.name === ".git") continue;
        if (depth < maxDepth) await walk(full, depth + 1);
      } else if (ent.isFile()) {
        if (matchesSecret(ent.name)) secrets.push(path.relative(dir, full));
      }
    }
  }
  await walk(dir, 0);
  return { heavy: [...heavy], secrets };
}

function detectStackForGitignore(dir) {
  const has = (f) => fs.existsSync(path.join(dir, f));
  if (has("package.json")) return "node";
  if (has("pyproject.toml") || has("requirements.txt")) return "python";
  if (has("Cargo.toml")) return "rust";
  return "generic";
}

const GITIGNORE_TEMPLATES = {
  node: [
    "node_modules/", "dist/", "build/", "out/", ".next/", ".turbo/",
    ".vercel/", "coverage/", "*.log", ".env", ".env.*", "!.env.example",
    ".DS_Store", "Thumbs.db",
  ].join("\n") + "\n",
  python: [
    "__pycache__/", "*.py[cod]", ".venv/", "venv/", "env/", "dist/",
    "build/", "*.egg-info/", ".pytest_cache/", ".mypy_cache/", ".coverage",
    ".env", ".env.*", "!.env.example", ".DS_Store", "Thumbs.db",
  ].join("\n") + "\n",
  rust: [
    "target/", "Cargo.lock", ".env", ".env.*", "!.env.example",
    ".DS_Store", "Thumbs.db",
  ].join("\n") + "\n",
  generic: [
    ".env", ".env.*", "!.env.example",
    "node_modules/", "dist/", "build/", "out/",
    ".DS_Store", "Thumbs.db", "*.log",
  ].join("\n") + "\n",
};

// GET /api/projects/:slug/github/audit — preview what the public copy will contain.
app.get("/api/projects/:slug/github/audit", async (req, res) => {
  const folder = fromSlug(req.params.slug);
  if (!fs.existsSync(folder)) return res.status(404).json({ error: "folder not found" });

  const { heavy, secrets } = await walkForAudit(folder);
  const stack = detectStackForGitignore(folder);
  const missing = {
    gitignore: !fs.existsSync(path.join(folder, ".gitignore")),
    readme: !fs.existsSync(path.join(folder, "README.md")) && !fs.existsSync(path.join(folder, "readme.md")),
    git: !fs.existsSync(path.join(folder, ".git")),
  };
  const suggestedDest = path.join(path.dirname(folder), `${path.basename(folder)}-public`);

  const db = await readDB();
  const prior = db[req.params.slug]?.githubPrep || null;

  res.json({ source: folder, suggestedDest, heavy, secrets, missing, stack, prior });
});

// GET /api/github/check — is `gh` installed and authed?
app.get("/api/github/check", async (_req, res) => {
  const ver = await runCapture("gh", ["--version"]);
  if (ver.code !== 0) return res.json({ installed: false, authed: false });
  const status = await runCapture("gh", ["auth", "status"]);
  // `gh auth status` prints to stderr by design. Either stream may carry the
  // username — check both with a permissive pattern.
  const combined = `${status.stdout}\n${status.stderr}`;
  const authed = status.code === 0;
  const userMatch = combined.match(/account\s+([\w-]+)/i) || combined.match(/Logged in to [^\s]+ as ([\w-]+)/i);
  res.json({ installed: true, authed, user: userMatch ? userMatch[1] : null });
});

// POST /api/projects/:slug/github/prepare — SSE stream of progress events.
// Body: { dest?: string, repoName?: string, visibility?: "public"|"private" }.
app.post("/api/projects/:slug/github/prepare", async (req, res) => {
  const slug = req.params.slug;
  const folder = fromSlug(slug);
  if (!fs.existsSync(folder)) return res.status(404).json({ error: "folder not found" });

  const repoName = String(req.body?.repoName || path.basename(folder)).trim();
  const visibility = req.body?.visibility === "private" ? "private" : "public";
  const dest = String(req.body?.dest || path.join(path.dirname(folder), `${path.basename(folder)}-public`));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (phase, ok, msg, extra = {}) => {
    res.write(`event: step\ndata: ${JSON.stringify({ phase, ok, msg, ...extra })}\n\n`);
  };
  const fail = (phase, msg) => {
    send(phase, false, msg);
    res.write(`event: done\ndata: ${JSON.stringify({ ok: false })}\n\n`);
    res.end();
  };

  try {
    // 1. Refuse if dest exists and isn't empty AND doesn't look like one of
    // our prior prep attempts (presence of .git is a strong signal we put
    // files there during a previous run that didn't reach gh repo create).
    if (fs.existsSync(dest)) {
      const entries = await fsp.readdir(dest);
      const looksLikePriorPrep = entries.includes(".git");
      if (entries.length > 0 && !looksLikePriorPrep) {
        return fail("guard", `Destination "${dest}" already exists and isn't empty. Delete it or pick a different folder.`);
      }
    } else {
      await fsp.mkdir(dest, { recursive: true });
    }

    // 2. Mirror with robocopy, excluding heavy dirs and any file matching
    // the secret patterns. /XF accepts wildcards but not regex, so we expand
    // the regex set into the concrete patterns robocopy understands.
    send("mirror", true, `Copying files to ${dest}…`);
    const xfPatterns = [
      ".env", ".env.*", "*.pem", "*.key", "*.pfx", "*.p12",
      "id_rsa", "id_ed25519", "id_ecdsa", "id_dsa",
      "firebase-adminsdk-*.json", "service-account-*.json",
      ".npmrc", "credentials.json", "credentials.txt",
      "*.log",
    ];
    const robocopyArgs = [
      folder, dest, "/E",
      "/XD", ...HEAVY_DIRS, ".git",
      "/XF", ...xfPatterns,
      "/NFL", "/NDL", "/NJH", "/NJS", "/NP",
      "/R:1", "/W:1", "/MT:8",
    ];
    const mirror = await runCapture("robocopy.exe", robocopyArgs);
    // Robocopy exit codes < 8 are "success-ish". 8+ are real errors.
    if (mirror.code === null || mirror.code >= 8) {
      return fail("mirror", `Robocopy exit code ${mirror.code}. ${mirror.stderr || ""}`.trim());
    }
    send("mirror", true, "Files copied.");

    // 3. Generate .gitignore if missing.
    const giPath = path.join(dest, ".gitignore");
    if (!fs.existsSync(giPath)) {
      const stack = detectStackForGitignore(dest);
      await fsp.writeFile(giPath, GITIGNORE_TEMPLATES[stack] || GITIGNORE_TEMPLATES.generic);
      send("gitignore", true, `Wrote .gitignore (${stack} template).`);
    } else {
      send("gitignore", true, ".gitignore already present; skipped.");
    }

    // 4. Generate README.md if missing.
    const readmePath = path.join(dest, "README.md");
    if (!fs.existsSync(readmePath) && !fs.existsSync(path.join(dest, "readme.md"))) {
      let pkgName = repoName, pkgDesc = "", scriptsBlock = "";
      try {
        const pkg = JSON.parse(await fsp.readFile(path.join(dest, "package.json"), "utf8"));
        pkgName = pkg.productName || pkg.name || repoName;
        pkgDesc = pkg.description || "";
        if (pkg.scripts && Object.keys(pkg.scripts).length) {
          const lines = Object.entries(pkg.scripts)
            .slice(0, 6)
            .map(([k]) => `- \`npm run ${k}\``);
          scriptsBlock = `\n## Scripts\n\n${lines.join("\n")}\n`;
        }
      } catch {}
      const readme = `# ${pkgName}\n\n${pkgDesc || "_Description coming soon._"}\n${scriptsBlock}`;
      await fsp.writeFile(readmePath, readme);
      send("readme", true, "Wrote README.md.");
    } else {
      send("readme", true, "README already present; skipped.");
    }

    // 5. git init + identity fallback + add + commit.
    send("git", true, "Initializing git repository…");
    const gitInit = await runCapture("git", ["init", "-b", "main"], { cwd: dest });
    if (gitInit.code !== 0) return fail("git", `git init failed: ${gitInit.stderr}`);

    // git refuses to commit with no user.name / user.email. If the user has
    // never set these globally we'd hit "Author identity unknown" here. Derive
    // the identity from the authed GitHub account and set it repo-locally so
    // we never touch the user's global git config.
    const haveEmail = (await runCapture("git", ["config", "user.email"], { cwd: dest })).stdout.trim();
    const haveName  = (await runCapture("git", ["config", "user.name"],  { cwd: dest })).stdout.trim();
    if (!haveEmail || !haveName) {
      const ghUser = await runCapture("gh", ["api", "user"], { cwd: dest });
      let login = "", userId = "", name = "", email = "";
      if (ghUser.code === 0) {
        try {
          const u = JSON.parse(ghUser.stdout);
          login  = u.login || "";
          userId = u.id ? String(u.id) : "";
          name   = u.name || u.login || "";
          email  = u.email || "";
        } catch {}
      }
      // GitHub's privacy-preserving no-reply address is the safe default when
      // the user's email is hidden. Format: {id}+{login}@users.noreply.github.com
      if (!email && login) {
        email = userId ? `${userId}+${login}@users.noreply.github.com` : `${login}@users.noreply.github.com`;
      }
      if (!email || !name) {
        return fail("git", "Could not determine git identity from gh. Set git config --global user.email/user.name and retry.");
      }
      const setEmail = await runCapture("git", ["config", "user.email", email], { cwd: dest });
      const setName  = await runCapture("git", ["config", "user.name",  name ], { cwd: dest });
      if (setEmail.code !== 0 || setName.code !== 0) {
        return fail("git", `Failed to set git identity: ${setEmail.stderr || setName.stderr}`);
      }
      send("git", true, `Set local git identity to ${name} <${email}>.`);
    }

    const gitAdd = await runCapture("git", ["add", "."], { cwd: dest });
    if (gitAdd.code !== 0) return fail("git", `git add failed: ${gitAdd.stderr}`);
    const gitCommit = await runCapture("git", ["commit", "-m", "Initial public commit"], { cwd: dest });
    if (gitCommit.code !== 0) return fail("git", `git commit failed: ${gitCommit.stderr || gitCommit.stdout}`);
    send("git", true, "Committed.");

    // 6. gh repo create + push.
    send("gh", true, `Creating ${visibility} repo "${repoName}" on GitHub…`);
    const ghCreate = await runCapture(
      "gh",
      ["repo", "create", repoName, `--${visibility}`, "--source=.", "--push"],
      { cwd: dest }
    );
    if (ghCreate.code !== 0) {
      return fail("gh", `gh repo create failed: ${ghCreate.stderr || ghCreate.stdout}`);
    }
    // gh prints the repo URL on success.
    const urlMatch = (ghCreate.stdout + ghCreate.stderr).match(/https:\/\/github\.com\/[\w.\-]+\/[\w.\-]+/);
    const repoUrl = urlMatch ? urlMatch[0] : `https://github.com/${repoName}`;
    send("gh", true, `Pushed to ${repoUrl}`);

    // 7. Persist completion.
    const db = await readDB();
    db[slug] = {
      ...(db[slug] || {}),
      githubPrep: { publicCopyPath: dest, repoUrl, createdAt: new Date().toISOString() },
      updatedAt: new Date().toISOString(),
    };
    await writeDB(db);

    res.write(`event: done\ndata: ${JSON.stringify({ ok: true, repoUrl, dest })}\n\n`);
    res.end();
  } catch (err) {
    fail("error", err.message || String(err));
  }
});

// ─── Boot ───────────────────────────────────────────────────────────────────
const cfg = loadConfig();
await syncDesignSystem(cfg);
await ensureDataDir();
await migrateStatusDB();
await new Promise((resolve) => {
  app.listen(cfg.port, () => {
    console.log(`\n  Coding Drives → http://localhost:${cfg.port}\n`);
    resolve();
  });
});

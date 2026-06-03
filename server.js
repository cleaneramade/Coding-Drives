// Coding Drives — local project tracker. Single-file Express server: scans
// folders, persists status/notes, opens tools, runs robocopy backups.

import express from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
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

// Serialized read-modify-write for projects.json. Long-running operations
// (backup, github publish) can complete out of order with quick endpoint
// writes (e.g. status flips); without this queue the slow op's readDB()
// snapshot would clobber the fast op's writeDB(). Mutator can be sync or
// async; mutating `db` in place is fine. Returns the final db.
let _dbWriteQueue = Promise.resolve();
function updateDB(mutator) {
  const next = _dbWriteQueue.then(async () => {
    const db = await readDB();
    await mutator(db);
    await writeDB(db);
    return db;
  });
  // Keep the chain alive even if a mutator throws — otherwise one rejected
  // promise poisons every subsequent updateDB call.
  _dbWriteQueue = next.catch(() => {});
  return next;
}

// ─── Design system CSS sync ─────────────────────────────────────────────────
// Order of preference for the colors/type CSS that powers the app's theme:
//   1. cfg.designSystemCss — an external path the user may have set in config
//   2. assets/design-system.css — the bundled default that ships with the repo
//   3. a stub so the app at least boots
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
      console.warn("[ds] no bundled or external design system CSS found");
    }
  }
}

// ─── Language detection (GitHub-Linguist-lite) ──────────────────────────────
// Walks the project tree, counts bytes per language by file extension, returns
// a GitHub-style ranked list. Deliberately approximate — we don't tokenise
// shebangs or parse heredocs — but accurate enough to flag a Next.js+Python
// repo as "TypeScript 62% · Python 28% · CSS 10%" instead of just "Next.js".

const LANG_EXT = {
  // JS / TS
  ".js": "JavaScript", ".jsx": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript",
  ".ts": "TypeScript", ".tsx": "TypeScript", ".mts": "TypeScript", ".cts": "TypeScript",
  // File-based frameworks GitHub treats as their own language
  ".vue": "Vue", ".svelte": "Svelte", ".astro": "Astro",
  // Web markup / styling
  ".html": "HTML", ".htm": "HTML",
  ".css": "CSS",
  ".scss": "SCSS", ".sass": "SCSS",
  ".less": "Less",
  ".styl": "Stylus",
  // Backend
  ".py": "Python", ".pyi": "Python",
  ".rs": "Rust",
  ".go": "Go",
  ".rb": "Ruby", ".rake": "Ruby",
  ".php": "PHP",
  ".java": "Java",
  ".kt": "Kotlin", ".kts": "Kotlin",
  ".scala": "Scala",
  ".cs": "C#",
  ".fs": "F#", ".fsx": "F#",
  ".cpp": "C++", ".cc": "C++", ".cxx": "C++", ".hpp": "C++", ".hh": "C++", ".hxx": "C++",
  ".c": "C", ".h": "C",
  ".swift": "Swift",
  ".m": "Objective-C", ".mm": "Objective-C++",
  ".dart": "Dart",
  ".lua": "Lua",
  ".pl": "Perl", ".pm": "Perl",
  ".r": "R",
  ".jl": "Julia",
  ".ex": "Elixir", ".exs": "Elixir",
  ".erl": "Erlang",
  ".hs": "Haskell",
  ".clj": "Clojure", ".cljs": "Clojure",
  ".zig": "Zig",
  ".nim": "Nim",
  ".sol": "Solidity",
  // Shell / scripts
  ".sh": "Shell", ".bash": "Shell", ".zsh": "Shell", ".fish": "Shell",
  ".ps1": "PowerShell", ".psm1": "PowerShell", ".psd1": "PowerShell",
  ".bat": "Batchfile", ".cmd": "Batchfile",
  // Data / config-y but still useful signal
  ".sql": "SQL",
  ".graphql": "GraphQL", ".gql": "GraphQL",
  ".md": "Markdown", ".mdx": "MDX",
  ".tex": "TeX",
  ".dockerfile": "Dockerfile",
};

// Special-case filenames without extensions that should still count.
const LANG_BY_BASENAME = {
  "Dockerfile": "Dockerfile",
  "Makefile": "Makefile",
  "GNUmakefile": "Makefile",
  "Rakefile": "Ruby",
  "Gemfile": "Ruby",
};

// Mirrors github/linguist's published colours. Keeps the language strip looking
// like a github.com repo card instead of a uniform grey.
// Language palette tuned for the dark card surface used by `.lang-badge`.
// Each badge renders as:
//   background = color @ 15% alpha
//   border     = color @ 55% alpha
//   text       = full color
// which means any hex with Rec. 709 luma below ~110 falls into a band where
// the border and label disappear into the surface. Linguist's canonical
// palette (the source many of these started from) was designed for white
// chips on github.com and ships several values that just don't read on
// dark. Those have been lifted into a luma ≥ ~125 range while keeping each
// language's hue identity intact — TypeScript stays sky-blue, Python stays
// steel-blue, Ruby stays red, etc. — so the row still reads as the
// expected language colors, just legibly.
const LANG_COLORS = {
  "JavaScript":     "#f1e05a",
  "TypeScript":     "#4d96d6",
  "Python":         "#79b1d6",
  "Rust":           "#dea584",
  "Go":             "#00ADD8",
  "Ruby":           "#e57373",
  "PHP":            "#8b9bdc",
  "Java":           "#e8a652",
  "Kotlin":         "#A97BFF",
  "Scala":          "#e0567a",
  "C":              "#a0a0a8",
  "C++":            "#f34b7d",
  "C#":             "#5cba47",
  "F#":             "#b845fc",
  "Swift":          "#F05138",
  "Objective-C":    "#438eff",
  "Objective-C++":  "#6866fb",
  "Dart":           "#00B4AB",
  "HTML":           "#e34c26",
  "CSS":            "#a78bfa",
  "SCSS":           "#c6538c",
  "Less":           "#6a86c5",
  "Stylus":         "#ff6347",
  "Vue":            "#41b883",
  "Svelte":         "#ff3e00",
  "Astro":          "#ff5d01",
  "Shell":          "#89e051",
  "PowerShell":     "#5e8ed4",
  "Batchfile":      "#C1F12E",
  "Lua":            "#7e7eff",
  "Perl":           "#0298c3",
  "R":              "#198CE7",
  "Julia":          "#a270ba",
  "Elixir":         "#b08fc0",
  "Erlang":         "#d870b8",
  "Haskell":        "#a08bc6",
  "Clojure":        "#db5855",
  "Zig":            "#ec915c",
  "Nim":            "#ffc200",
  "Solidity":       "#d18966",
  "Markdown":       "#60a5fa",
  "MDX":            "#fcb32c",
  "SQL":            "#e38c00",
  "GraphQL":        "#ed5fbf",
  "TeX":            "#7eb247",
  "Dockerfile":     "#7faab8",
  "Makefile":       "#7fb84e",
};

// Directories never recursed into. Two camps: vendored deps (node_modules,
// venv, vendor) and build outputs (dist, .next, target). Skipping these is the
// difference between a 30s scan and a 300ms one.
const LANG_IGNORE_DIRS = new Set([
  "node_modules", "bower_components", "jspm_packages",
  "dist", "build", "out", "bin", "obj", "target", "Pods", "DerivedData",
  ".next", ".nuxt", ".svelte-kit", ".astro", ".turbo", ".vercel", ".vite",
  ".cache", ".parcel-cache", "coverage", ".nyc_output",
  ".git", ".hg", ".svn",
  "venv", ".venv", "env", ".env", "__pycache__", ".mypy_cache", ".pytest_cache", ".ruff_cache",
  ".tox", ".eggs",
  "vendor", ".gradle", ".idea", ".vscode", ".dart_tool", ".pub-cache",
  ".expo", ".pnp", ".yarn",
  "node_modules.nosync",
]);

// Files we explicitly skip — lockfiles, minified bundles, source maps, vendored
// libs. Including these inflates JavaScript/JSON byte counts and pushes real
// source down the chart.
const LANG_IGNORE_FILENAMES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "npm-shrinkwrap.json",
  "bun.lockb", "deno.lock",
  "Cargo.lock", "poetry.lock", "Pipfile.lock", "composer.lock", "Gemfile.lock",
  "go.sum",
]);

const LANG_IGNORE_SUFFIXES = [
  ".min.js", ".min.css", ".map", ".bundle.js", ".chunk.js",
];

// Hard cap on the walk. The user has many drives — without this, a stray
// monorepo with a vendored Chromium would burn seconds per refresh. mtime
// caching means we pay this once per project until something changes.
const LANG_MAX_FILES = 8000;
const LANG_MAX_BYTES = 80 * 1024 * 1024;
const LANG_MAX_DEPTH = 12;

function languageForFile(name) {
  if (LANG_BY_BASENAME[name]) return LANG_BY_BASENAME[name];
  // Dockerfile.dev, Dockerfile.prod, etc.
  if (name.startsWith("Dockerfile")) return "Dockerfile";
  for (const suf of LANG_IGNORE_SUFFIXES) {
    if (name.endsWith(suf)) return null;
  }
  const ext = path.extname(name).toLowerCase();
  if (!ext) return null;
  return LANG_EXT[ext] || null;
}

async function detectLanguages(dir) {
  const bytesByLang = new Map();
  let filesSeen = 0;
  let bytesSeen = 0;
  let truncated = false;

  // Files within a directory are stat-ed in parallel; subdirectories also
  // recurse concurrently. The mutating counters (filesSeen / bytesSeen /
  // truncated) are touched only after each await resolves and JS is
  // single-threaded so the reads are race-free. Without this, a project with
  // twenty src/ subdirs serialises the entire walk and a cold scan blocks
  // the event loop for seconds.
  async function walk(d, depth) {
    if (truncated || depth > LANG_MAX_DEPTH) return;
    let entries;
    try { entries = await fsp.readdir(d, { withFileTypes: true }); }
    catch { return; }

    const files = [];
    const subdirs = [];
    for (const ent of entries) {
      const name = ent.name;
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) {
        if (LANG_IGNORE_DIRS.has(name)) continue;
        // Skip dotted dirs by default — .github is fine (workflows are YAML
        // we'd skip anyway), .storybook etc. usually mirror src so dropping
        // them avoids double-counting.
        if (name.startsWith(".") && name !== ".github") continue;
        subdirs.push(name);
        continue;
      }
      if (!ent.isFile()) continue;
      if (LANG_IGNORE_FILENAMES.has(name)) continue;
      const lang = languageForFile(name);
      if (!lang) continue;
      files.push({ name, lang });
    }

    await Promise.all(files.map(async ({ name, lang }) => {
      if (truncated) return;
      let size = 0;
      try { size = (await fsp.stat(path.join(d, name))).size; } catch { return; }
      if (truncated) return;
      bytesByLang.set(lang, (bytesByLang.get(lang) || 0) + size);
      filesSeen++;
      bytesSeen += size;
      if (filesSeen >= LANG_MAX_FILES || bytesSeen >= LANG_MAX_BYTES) truncated = true;
    }));

    if (truncated) return;
    await Promise.all(subdirs.map((name) => walk(path.join(d, name), depth + 1)));
  }
  await walk(dir, 0);

  const total = [...bytesByLang.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return { languages: [], truncated };
  const languages = [...bytesByLang.entries()]
    .map(([name, bytes]) => ({
      name,
      bytes,
      pct: bytes / total,
      color: LANG_COLORS[name] || "#8b8b8b",
    }))
    .sort((a, b) => b.bytes - a.bytes);
  return { languages, truncated };
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

  // Detection runs in priority order — the first stack listed is the
  // "primary" badge. We also collect every other matching stack so
  // polyglot projects (Tauri = Rust + Node, Electron with Python sidecar,
  // Next.js + Python backend, etc.) don't silently lose their secondary
  // identity. The renderer shows up to two badges per card.
  const stacks = [];
  const add = (s) => { if (s && !stacks.includes(s)) stacks.push(s); };

  // Node family — `next.config.*` wins over plain package.json. Inside
  // package.json we still inspect deps so a React/Vite/Express project
  // gets a more specific label than just "Node".
  if (has("next.config.js") || has("next.config.ts") || has("next.config.mjs")) {
    add("Next.js");
  } else if (has("package.json")) {
    try {
      const pkg = JSON.parse(await fsp.readFile(path.join(dir, "package.json"), "utf8"));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps.next) add("Next.js");
      else if (deps.react) add("React");
      else if (deps.express || deps.hono || deps.fastify) add("Node API");
      else if (deps.vite) add("Vite");
      else add("Node");
    } catch { add("Node"); }
  }

  if (has("Cargo.toml")) add("Rust");
  if (has("pyproject.toml") || has("requirements.txt")) add("Python");
  if (has("go.mod")) add("Go");
  if (has("pubspec.yaml")) add("Flutter");

  // index.html alone is only meaningful when nothing else matched —
  // otherwise it's just a Next.js / Vite public/ page.
  if (stacks.length === 0 && has("index.html")) add("Static");
  if (stacks.length === 0) add("Unknown");

  return { stack: stacks[0], stacks, indicators };
}

// Normalises a raw remote URL from .git/config to a clean
// "https://github.com/<owner>/<repo>" form. Returns null if not a GitHub URL.
// Handles SSH (git@github.com:owner/repo.git), HTTPS (https://github.com/...
// optional .git suffix), and the rarely-used ssh:// scheme.
function normalizeGithubUrl(raw) {
  if (typeof raw !== "string") return null;
  const u = raw.trim();
  let m;
  // git@github.com:owner/repo(.git)?
  if ((m = u.match(/^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i))) {
    return `https://github.com/${m[1]}/${m[2]}`;
  }
  // https://github.com/owner/repo(.git)?  or  http://...
  if ((m = u.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i))) {
    return `https://github.com/${m[1]}/${m[2]}`;
  }
  // ssh://git@github.com/owner/repo(.git)?
  if ((m = u.match(/^ssh:\/\/git@github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i))) {
    return `https://github.com/${m[1]}/${m[2]}`;
  }
  return null;
}

// Reads .git/config (synchronously — describeProject runs many of these in
// the scan loop and a sync read of a tiny file is cheaper than the async
// overhead). Returns the normalised github URL of the "origin" remote, or
// null if the project has no .git, no origin, or origin isn't a github URL.
function detectGithubUrl(dir) {
  const cfg = path.join(dir, ".git", "config");
  if (!fs.existsSync(cfg)) return null;
  try {
    const txt = fs.readFileSync(cfg, "utf8");
    // Match the "origin" remote section and pull its url=. The [\s\S]*? lazy
    // body lets us span the few lines between [remote "origin"] and url=.
    const m = txt.match(/\[remote "origin"\][\s\S]*?url\s*=\s*(\S+)/);
    return m ? normalizeGithubUrl(m[1]) : null;
  } catch { return null; }
}

// Local .git/config tells us where origin *was*, not whether it still
// exists on github.com. Without this check, deleting a repo on GitHub
// leaves a stale "Visit" chip on the card forever. We hit
// api.github.com/repos/{owner}/{repo} (with the gh CLI token if installed,
// so private repos resolve correctly) and cache the result. TTLs are
// asymmetric on purpose: hold "exists" for 30 min to avoid rate limits on
// repeated refreshes, but only hold "gone" for 5 min so a re-publish
// recovers the chip quickly.
const GH_VERIFY_TTL_OK_MS = 30 * 60 * 1000;
const GH_VERIFY_TTL_GONE_MS = 5 * 60 * 1000;
const ghVerifyCache = new Map(); // url -> { exists: true|false|null, until: ms }
let cachedGhToken = { value: null, until: 0 };

async function getGhTokenCached() {
  const now = Date.now();
  if (cachedGhToken.until > now) return cachedGhToken.value;
  let tok = null;
  try {
    const r = await runCapture("gh", ["auth", "token"]);
    if (r.code === 0) tok = r.stdout.trim() || null;
  } catch {}
  cachedGhToken = { value: tok, until: now + 5 * 60 * 1000 };
  return tok;
}

async function verifyGithubUrl(url) {
  const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)\/?$/);
  if (!m) return null;
  const apiUrl = `https://api.github.com/repos/${m[1]}/${m[2]}`;
  const headers = { "User-Agent": "Coding-Drives", "Accept": "application/vnd.github+json" };
  const tok = await getGhTokenCached();
  if (tok) headers["Authorization"] = `Bearer ${tok}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(apiUrl, { method: "GET", headers, signal: ctrl.signal });
    if (res.status === 404) return false;
    if (res.status >= 200 && res.status < 400) return true;
    // 401/403/5xx — inconclusive; don't drop the chip on a transient blip.
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Walks the merged project list, drops the githubUrl on any project whose
// remote 404s, and tags it with githubMissing:true so the renderer can
// optionally surface a "repo not found — re-publish?" hint.
async function annotateGithubExistence(projects) {
  const now = Date.now();
  const work = [];
  for (const p of projects) {
    if (!p.githubUrl) continue;
    const cached = ghVerifyCache.get(p.githubUrl);
    if (cached && cached.until > now) {
      if (cached.exists === false) { p.githubMissing = true; p.githubUrl = null; }
      continue;
    }
    const url = p.githubUrl;
    work.push((async () => {
      const exists = await verifyGithubUrl(url);
      const ttl = exists === false ? GH_VERIFY_TTL_GONE_MS : GH_VERIFY_TTL_OK_MS;
      ghVerifyCache.set(url, { exists, until: Date.now() + ttl });
      if (exists === false) { p.githubMissing = true; p.githubUrl = null; }
    })());
  }
  if (work.length) { try { await Promise.all(work); } catch {} }
}

// Stack detection cache. Keyed by full project path; invalidates when the
// folder's mtime changes (a new manifest file or a touched config). Without
// this, /api/projects re-runs ~10-15 sync fs.existsSync per project on every
// poll — quickly hundreds of stat calls per refresh once the user has 50+
// projects, all on disks that may be spinning rust.
const _stackCache = new Map(); // path → { mtime, cachedAt, stack, stacks, indicators, languages, languagesTruncated }
// On Windows, a directory's mtime only updates when entries are added or
// removed *directly* inside it — editing src/index.ts two levels deep doesn't
// touch the project root's mtime, so a pure mtime-keyed cache silently serves
// stale language stats. Pair it with a short TTL so deep edits get picked up
// on the next poll without forcing a per-refresh re-walk.
const STACK_CACHE_TTL_MS = 5 * 60 * 1000;
async function describeProject(full, root, source) {
  let stat;
  try { stat = await fsp.stat(full); } catch { return null; }
  if (!stat.isDirectory()) return null;
  const cached = _stackCache.get(full);
  let stack, stacks, indicators, languages, languagesTruncated;
  const fresh = cached
    && cached.mtime === stat.mtimeMs
    && cached.languages
    && (Date.now() - (cached.cachedAt || 0)) < STACK_CACHE_TTL_MS;
  if (fresh) {
    ({ stack, stacks, indicators, languages, languagesTruncated } = cached);
  } else {
    ({ stack, stacks, indicators } = await detectStack(full));
    ({ languages, truncated: languagesTruncated } = await detectLanguages(full));
    _stackCache.set(full, {
      mtime: stat.mtimeMs,
      cachedAt: Date.now(),
      stack, stacks, indicators, languages, languagesTruncated,
    });
  }
  return {
    slug: toSlug(full),
    name: path.basename(full),
    path: full,
    root,
    source, // "scan" | "extra"
    stack,
    stacks,
    indicators,
    languages,
    languagesTruncated,
    githubUrl: indicators.git ? detectGithubUrl(full) : null,
    mtime: stat.mtimeMs,
  };
}

async function scanProjects(cfg) {
  const exclude = new Set(cfg.excludeFolders || []);
  const seen = new Set();
  const out = [];

  // Scan root paths. Each root's children are describe-d in parallel so a
  // cold cache (every project does fsp.stat + fsp.readdir + per-file size
  // stats for language detection) doesn't serialise into a multi-second
  // event-loop stall that blocks unrelated requests like status flips.
  // Roots themselves stay sequential — they're typically 1-2 paths and
  // serial reads avoid hammering different physical disks at once.
  for (const root of cfg.scanPaths || []) {
    let entries = [];
    try { entries = await fsp.readdir(root, { withFileTypes: true }); }
    catch (err) { console.warn("[scan] cannot read", root, err.message); continue; }

    const candidates = entries.filter((ent) =>
      !ent.name.startsWith(".") && !exclude.has(ent.name)
    );
    const descs = await Promise.all(
      candidates.map((ent) => describeProject(path.join(root, ent.name), root, "scan"))
    );
    for (const desc of descs) {
      if (!desc) continue;
      const key = desc.path.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(desc);
    }
  }

  // Manually-added projects living outside the scan roots. Also parallel —
  // same reasoning as above, with the added wrinkle that extras may live on
  // entirely different drives so concurrent IO is even more beneficial.
  const extras = (cfg.extraProjectPaths || []).filter((full) => !seen.has(full.toLowerCase()));
  const extraDescs = await Promise.all(
    extras.map((full) => describeProject(full, path.dirname(full), "extra"))
  );
  for (const desc of extraDescs) {
    if (!desc) continue;
    const key = desc.path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(desc);
  }

  out.sort((a, b) => b.mtime - a.mtime);
  return out;
}

// ─── Express app ────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "1mb" }));

// No-cache headers on every static asset. Electron's embedded Chromium will
// otherwise hold onto cached app.css / app.js / index.html across relaunches
// — visible as "I made a change but the UI didn't update" after rebuilds.
// Cache-Control: no-store forces a fresh fetch every window load.
const noCache = (_req, res, next) => {
  res.set("Cache-Control", "no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
};
app.use("/ds",     noCache, express.static(DS_OUT_DIR));
app.use("/assets", noCache, express.static(ASSETS_DIR));
app.use(noCache, express.static(PUBLIC_DIR));

app.get("/api/config", (_req, res) => {
  res.json(loadConfig());
});

app.post("/api/config", async (req, res) => {
  const patch = req.body || {};
  // Flipping the stack-badge toggle ON forces a fresh stack/language scan on
  // the next /api/projects so the badge row doesn't paint with stale cached
  // results from before the user enabled it.
  if (patch.showStackBadge === true) _stackCache.clear();
  await saveUserConfig(patch);
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

// Credit-mark logo — ALWAYS the bundled creator avatar, never the user's
// custom logo. The "Made by @cleaneramade" credit is locked by design and
// must remain visible regardless of how a user rebrands the app icon.
app.get("/api/credit-logo", (_req, res) => {
  res.sendFile(path.join(ASSETS_DIR, "logo.svg"));
});

// Updates the Coding Drives shortcut icons (Desktop + Start Menu, per-user
// and machine-wide) so Windows visually reflects the new brand without
// rebuilding the .exe.
//
// AWAITED (not fire-and-forget): the previous fire-and-forget pattern
// silently swallowed every PS failure (path issue, ICO conversion error,
// permission denial). We now capture stdout/stderr + exit code via
// runCapture(), persist a one-line trace to tracker.log, and return a
// structured result so the API endpoint can surface success/failure to
// the renderer as a toast. Adds ~1-3s to the upload response, which is
// fine — the relaunch flow already waits 900ms.
//
// Pass src="" to reset overrides (the script clears IconLocation on each
// .lnk so Windows falls back to the .exe's bundled icon).
async function updateShortcutIcons(srcImagePath) {
  const script = path.join(ASSETS_DIR, "update-shortcut-icons.ps1");
  if (!fs.existsSync(script)) return { ok: false, error: "helper script missing" };
  const r = await runCapture("powershell.exe", [
    "-NoProfile", "-NonInteractive",
    "-ExecutionPolicy", "Bypass",
    "-File", script,
    "-ShortcutName", "Coding Drives",
    "-SourceImage", srcImagePath || "",
    // No -IcoCachePath: the script picks a timestamped path under userData
    // so each upload writes a *new* file. Reusing the same path lets the
    // Windows shell icon cache serve a stale thumbnail.
  ]);
  // Append a single line to tracker.log so the user has a paper trail
  // when something goes wrong. The logger lives in electron.cjs but the
  // file path is stable — userData/tracker.log — so we write directly.
  const userDataDir = process.env.PT_DATA_DIR ? path.dirname(process.env.PT_DATA_DIR) : DATA_DIR;
  const logLine = `[${new Date().toISOString()}] [shortcut-icons] exit=${r.code} stdout=${(r.stdout || "").trim()} stderr=${(r.stderr || "").trim()}\n`;
  try { fs.appendFileSync(path.join(userDataDir, "tracker.log"), logLine); } catch {}
  if (r.code !== 0) {
    return { ok: false, exitCode: r.code, error: ((r.stderr || r.stdout) || `PS exited ${r.code}`).trim() };
  }
  // Parse the JSON status line (last non-empty line of stdout).
  const lastLine = (r.stdout || "").trim().split(/\r?\n/).filter(Boolean).pop() || "{}";
  let parsed = null;
  try { parsed = JSON.parse(lastLine); } catch {}
  if (parsed?.ok) return { ok: true, updated: parsed.updated || 0, icoPath: parsed.icoPath || null };
  return { ok: false, error: parsed?.error || "unparseable PS output" };
}

// SVG can't be wrapped into a Windows .ico via System.Drawing (vector input
// isn't supported). For the desktop-icon update we need a raster image; the
// in-app logo still works fine with SVG.
function isRasterIconFormat(ext) { return [".png", ".jpg", ".jpeg", ".ico"].includes(ext); }

// Upload (copy) a chosen file to userData and set it as the active logo.
app.post("/api/settings/logo", async (req, res) => {
  const src = String(req.body?.path || "");
  if (!src || !fs.existsSync(src)) return res.status(400).json({ error: "File not found." });
  const ext = path.extname(src).toLowerCase() || ".png";
  if (![".svg", ".png", ".jpg", ".jpeg", ".ico"].includes(ext)) {
    return res.status(400).json({ error: "Unsupported image format." });
  }
  const dest = path.join(DATA_DIR, `custom-logo${ext}`);
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.copyFile(src, dest);
  await saveUserConfig({ customLogo: dest });
  // Push the new icon out to the desktop / start-menu shortcuts so they
  // visually update too. Awaited so we can surface the result back to the
  // renderer as a toast — the previous fire-and-forget left failures
  // invisible. Skipped silently for SVG since System.Drawing can't
  // rasterize vector input — the in-app logo still shows fine.
  let shortcutUpdate = null;
  if (isRasterIconFormat(ext)) shortcutUpdate = await updateShortcutIcons(dest);
  res.json({ ok: true, customLogo: dest, shortcutUpdate });
});

app.post("/api/settings/logo/reset", async (_req, res) => {
  const u = loadUserConfig();
  delete u.customLogo;
  await fsp.writeFile(USER_CONFIG_PATH, JSON.stringify(u, null, 2));
  // Reset: re-point the shortcut at a fresh copy of the bundled creator
  // icon. We could just clear IconLocation and let Windows fall back to
  // the .exe's embedded icon, but Windows' shell cache is sticky — keying
  // off the same IconLocation string is what kept the old icon visible
  // even after a clear. Writing a new timestamped ICO from the bundled
  // assets/icon.ico (same source the installer used to embed the .exe
  // icon) gives the shortcut a brand-new IconLocation path each reset,
  // so the cache is always invalidated and the user sees the original
  // creator icon immediately.
  const bundledIcon = path.join(ASSETS_DIR, "icon.ico");
  const shortcutUpdate = await updateShortcutIcons(bundledIcon);
  res.json({ ok: true, shortcutUpdate });
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
    const lastBackedUpDest = db[p.slug]?.lastBackedUpDest || null;
    // The "Replace current" backup card used to be enabled purely on the
    // presence of a lastBackedUpAt timestamp. If the user deleted or moved
    // the backup folder between sessions, the card still said "Overwrite
    // backup from <timestamp>" — misleading. Server-side existence check is
    // cheap (one fs.existsSync) and avoids a renderer round-trip.
    const lastBackedUpExists = !!(lastBackedUpDest && fs.existsSync(lastBackedUpDest));
    return {
      ...p,
      status,
      notes: db[p.slug]?.notes || "",
      lastBackedUpAt: db[p.slug]?.lastBackedUpAt || db[p.slug]?.lastDuplicatedAt || null,
      lastBackedUpDest,
      lastBackedUpExists,
      updatedAt: db[p.slug]?.updatedAt || null,
    };
  });
  // Sync the local-detected github origin against github.com — drop the
  // visit chip + flip the popover back to "publish" mode for any repo the
  // user has since deleted on github.com. Cached per-URL with a TTL, so
  // repeated refreshes don't hammer the API.
  await annotateGithubExistence(merged);
  res.json({
    projects: merged,
    statuses: cfg.statuses,
    backupPath: cfg.backupPath,
    // Optional user-set hex for the Total KPI tile (Settings → Statuses).
    // null when the user hasn't customised it — frontend falls back to the
    // bundled brand violet via CSS tokens.
    totalColor: cfg.totalColor || null,
    // Off by default — the language row already conveys the dominant
    // language, and the stack badge often duplicates it (e.g. NEXT.JS over
    // TYPESCRIPT). User opts in from Settings.
    showStackBadge: cfg.showStackBadge === true,
    // Language badges are the card's primary "what's in here" signal, so
    // default to ON. Treat undefined as enabled so existing installs that
    // never wrote this key keep their current behaviour.
    showLanguageBadges: cfg.showLanguageBadges !== false,
  });
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

// Create a brand-new (empty) project folder under a designated parent, then
// track it. Mirrors /api/projects/add's tracking logic: if the new folder
// lands directly inside an existing scan root the scanner picks it up for
// free (alreadyTracked); otherwise we register it in extraProjectPaths.
app.post("/api/projects/create", async (req, res) => {
  const parent = String(req.body?.parent || "").trim();
  const name   = String(req.body?.name || "").trim();
  if (!parent) return res.status(400).json({ error: "parent folder required" });
  if (!name)   return res.status(400).json({ error: "project name required" });

  // Reject anything that isn't a single, safe folder name. Windows forbids
  // \ / : * ? " < > | in names; we also block path separators outright so a
  // user can't smuggle in "../escape" or a nested "a/b" path.
  if (/[\\/:*?"<>|]/.test(name)) {
    return res.status(400).json({ error: 'Name can\'t contain \\ / : * ? " < > |' });
  }
  if (name === "." || name === ".." || /[. ]$/.test(name)) {
    return res.status(400).json({ error: "That name isn't a valid folder name." });
  }

  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) {
    return res.status(400).json({ error: "Parent folder doesn't exist or isn't a directory." });
  }

  const cfg    = loadConfig();
  const target = path.resolve(parent, name);
  if (fs.existsSync(target)) {
    return res.status(400).json({ error: "A folder with that name already exists there." });
  }

  await fsp.mkdir(target, { recursive: false });

  // Created directly inside a scan root? The scanner owns it — no manual entry.
  for (const root of cfg.scanPaths || []) {
    if (path.dirname(target).toLowerCase() === path.resolve(root).toLowerCase()) {
      return res.json({ ok: true, created: true, alreadyTracked: true, project: await describeProject(target, path.dirname(target), "scan") });
    }
  }

  const next = Array.from(new Set([...(loadUserConfig().extraProjectPaths || []), target]));
  await saveUserConfig({ extraProjectPaths: next });
  const desc = await describeProject(target, path.dirname(target), "extra");
  res.json({ ok: true, created: true, project: desc });
});

// Classify a path for the unified Add Project field. The renderer calls this
// (debounced) as the user types so the primary button can flip between
// "Connect" (folder already exists) and "Create" (folder doesn't exist yet)
// without the user having to pick a mode. States:
//   empty | connect | create | no-parent | bad-name | invalid-file
app.post("/api/path/inspect", (req, res) => {
  const raw = String(req.body?.path || "").trim();
  if (!raw) return res.json({ state: "empty" });

  const cfg = loadConfig();
  // A bare name (no path separator) means "create a project called this" — so
  // resolve it against the user's primary scan folder, NOT the server's CWD.
  // Without this, typing "my-app" would land inside the app's own directory.
  const isBareName = !/[\\/]/.test(raw) && !/^[A-Za-z]:$/.test(raw);
  let norm;
  if (isBareName && (cfg.scanPaths || []).length) {
    norm = path.resolve(cfg.scanPaths[0], raw);
  } else {
    try { norm = path.resolve(raw); } catch { return res.json({ state: "empty" }); }
  }
  const name   = path.basename(norm);
  const parent = path.dirname(norm);

  let exists = false, isDir = false;
  try { const st = fs.statSync(norm); exists = true; isDir = st.isDirectory(); } catch {}

  if (exists) {
    if (!isDir) return res.json({ state: "invalid-file", path: norm });
    // Already sitting directly inside a scan root? Connecting just refreshes it.
    let tracked = false;
    for (const root of cfg.scanPaths || []) {
      if (parent.toLowerCase() === path.resolve(root).toLowerCase()) { tracked = true; break; }
    }
    return res.json({ state: "connect", path: norm, name, alreadyTracked: tracked });
  }

  // Doesn't exist yet → create candidate. Validate parent + the new folder name.
  let parentDir = false;
  try { parentDir = fs.statSync(parent).isDirectory(); } catch {}
  if (!parentDir) return res.json({ state: "no-parent", path: norm, parent });
  const badName = !name || /[\\/:*?"<>|]/.test(name) || name === "." || name === ".." || /[. ]$/.test(name);
  if (badName) return res.json({ state: "bad-name", path: norm, name });
  return res.json({ state: "create", path: norm, name, parent });
});

app.post("/api/projects/:slug", async (req, res) => {
  const slug = req.params.slug;
  const folder = fromSlug(slug);
  if (!fs.existsSync(folder)) return res.status(404).json({ error: "folder not found" });

  let update;
  await updateDB((db) => {
    const existing = db[slug] || {};
    update = { ...existing, updatedAt: new Date().toISOString() };
    if (typeof req.body.status === "string") update.status = req.body.status;
    if (typeof req.body.notes  === "string") update.notes  = req.body.notes;
    db[slug] = update;
  });
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

// Open the project folder as a NEW Code session in the Claude *desktop app*
// via the official deep link (claude://code/new?folder=…), instead of spawning
// a terminal with the CLI. Claude always shows a one-time trust confirmation
// before adopting the folder as its working directory — that gate is by design
// and can't be suppressed. Requires the Claude desktop app, which registers the
// claude:// URL scheme; `shell.openExternal` is the clean path inside Electron,
// with a `cmd /c start` fallback for the bare dev server. The folder is
// URL-encoded so spaces / & / : never reach cmd.exe unescaped.
async function openClaudeDesktop(folder) {
  const uri = "claude://code/new?folder=" + encodeURIComponent(folder);
  if (process.env.PT_ELECTRON === "1") {
    const electron = await import("electron");
    await electron.shell.openExternal(uri);
  } else {
    spawn("cmd.exe", ["/c", "start", "", uri],
      { detached: true, stdio: "ignore", windowsHide: true, shell: false }).unref();
  }
}

// Open the project folder in the Codex *desktop app* via the CLI's
// `codex app <path>` subcommand, instead of spawning a terminal with the CLI.
// Routed through cmd.exe so the `codex` shim (codex.cmd) resolves on PATH;
// windowsHide keeps the launcher console from flashing while the GUI starts.
// If the desktop app isn't installed yet, `codex app` itself offers to install
// it. Unlike Claude's deep link, this needs the codex CLI on PATH — so the
// install gate above still applies to codex in both modes.
function spawnCodexDesktop(folder, codexCmd) {
  return spawn("cmd.exe", ["/c", codexCmd, "app", folder],
    { detached: true, stdio: "ignore", windowsHide: true, shell: false }).unref();
}

// Tools we gate behind an install-confirmation modal. The bare command name
// is what we'll feed to `where.exe`; the npm package is what we'll install
// if the user confirms; displayName is what the modal shows the user.
const INSTALLABLE_TOOLS = {
  claude: { displayName: "Claude Code", npmPackage: "@anthropic-ai/claude-code" },
  codex:  { displayName: "Codex",       npmPackage: "@openai/codex" },
};

// Synchronous PATH check via Windows' `where.exe`. Exit code 0 means the
// command is resolvable on PATH (or one of the PATHEXT extensions). ~10ms
// per call on a warm cache, fine to run inline on each open-tool request.
function isCommandOnPath(cmd) {
  if (!cmd) return false;
  const bare = cmd.split(/[\\/]/).pop().replace(/\.(cmd|exe|bat|ps1)$/i, "");
  try {
    const r = spawnSync("where.exe", [bare], { windowsHide: true, stdio: "ignore" });
    return r.status === 0;
  } catch {
    return false;
  }
}

app.post("/api/projects/:slug/open", async (req, res) => {
  const cfg = loadConfig();
  const folder = fromSlug(req.params.slug);
  if (!fs.existsSync(folder)) return res.status(404).json({ error: "folder not found" });

  const tool = req.body?.tool;

  // Claude "desktop mode" (Settings toggle) routes the Claude button to the
  // desktop app via deep link instead of the CLI. In that mode the CLI being
  // on PATH is irrelevant — the claude:// scheme is what matters — so we skip
  // the install gate below to avoid a spurious "not installed" prompt.
  const claudeDesktop = tool === "claude" && cfg.openClaudeInDesktop === true;

  // Pre-flight install gate. If the requested CLI isn't on PATH we DON'T
  // shell out — instead respond 200 with a notInstalled flag so the
  // frontend can show its own confirmation modal. Windows 11 would
  // otherwise hijack the missing command with its own "install from
  // Store" prompt, which we want to suppress in favour of an in-app flow.
  if (tool && INSTALLABLE_TOOLS[tool] && !claudeDesktop) {
    const cmd = cfg.tools[tool] || tool;
    if (!isCommandOnPath(cmd)) {
      const meta = INSTALLABLE_TOOLS[tool];
      return res.json({
        ok: false,
        notInstalled: true,
        tool,
        displayName: meta.displayName,
        installCmd: `npm install -g ${meta.npmPackage}`,
      });
    }
  }

  try {
    if (tool === "vscode") {
      spawnDetached(cfg.tools.vscode, [folder]);
    } else if (tool === "claude") {
      if (claudeDesktop) {
        await openClaudeDesktop(folder);
      } else {
        spawnTerminal(folder, cfg.tools.claude || "claude");
      }
    } else if (tool === "codex") {
      if (cfg.openCodexInDesktop === true) {
        spawnCodexDesktop(folder, cfg.tools.codex || "codex");
      } else {
        spawnTerminal(folder, cfg.tools.codex || "codex");
      }
    } else if (tool === "explorer") {
      // Open the project folder in Windows Explorer. Earlier revisions tried
      // to be clever — locate an open Explorer window via Shell.Application
      // and, on Win11, drive SendKeys (Ctrl+T, Ctrl+L, Ctrl+V, Enter) against
      // it to open the folder in a new TAB instead of a new window. That
      // silently failed in practice: PowerShell launched with
      // `-WindowStyle Hidden` doesn't have foreground rights, so
      // SetForegroundWindow + SendKeys was a no-op against Explorer and the
      // user saw "nothing happens". Electron's shell.openPath is the
      // dependable path — it always opens the folder (focusing an existing
      // window pointing at the same path when Windows decides to). Fall back
      // to `explorer.exe <path>` only when not running inside Electron.
      if (process.env.PT_ELECTRON === "1") {
        const electron = await import("electron");
        const e = await electron.shell.openPath(folder);
        if (e) throw new Error(e);
      } else {
        spawn("explorer.exe", [folder], {
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

// Install a known CLI on the user's behalf. Only fires after the frontend
// has shown its "Allow Coding Drives to install X" modal and the user
// clicked Allow — we never install silently. Spawns a visible Windows
// Terminal so the user sees `npm install -g …` progress and any errors
// instead of having an installation happen invisibly in the background.
app.post("/api/tools/install", async (req, res) => {
  const tool = req.body?.tool;
  const meta = INSTALLABLE_TOOLS[tool];
  if (!meta) return res.status(400).json({ error: "unknown tool" });

  // cwd for the install terminal: user's home directory. Doesn't matter for
  // a global install, but it's a sane place for the shell to land.
  const cwd = process.env.USERPROFILE || process.env.HOME || __dirname;
  try {
    // Defensive quoting — the package strings in INSTALLABLE_TOOLS are
    // controlled, but quoting prevents future entries with hyphens or scopes
    // from being misparsed by `cmd /k`.
    spawnTerminal(cwd, `npm install -g "${meta.npmPackage}"`);
    res.json({ ok: true, displayName: meta.displayName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Backup ────────────────────────────────────────────────────────────────
// Each backup folder gets a marker file so we can confirm we own it before
// using robocopy /MIR (which deletes anything in dest not in source — we never
// want to /MIR an unrelated folder).
const BACKUP_MARKER = ".codingdrives-backup.json";

// Turn raw Robocopy output into a short, user-facing reason. Robocopy lines
// look like "2026/05/21 14:32:11 ERROR 5 (0x00000005) Copying File ..." with
// the actual cause on the next line ("Access is denied."). We pick the first
// "ERROR" line plus the following non-empty line if present, and fall back to
// a known-code map.
function extractRobocopyError(stdout = "", stderr = "", exitCode) {
  const combined = (stdout + "\n" + stderr).split(/\r?\n/);
  const errorIdx = combined.findIndex((l) => /\bERROR\b/.test(l));
  if (errorIdx !== -1) {
    const errLine = combined[errorIdx].trim();
    const next = (combined[errorIdx + 1] || "").trim();
    const summary = next && !/\bERROR\b/.test(next) ? `${errLine} — ${next}` : errLine;
    return summary.slice(0, 400);
  }
  // No explicit ERROR token: lean on the exit-code semantics from
  // https://learn.microsoft.com/en-us/troubleshoot/windows-server/backup-and-storage/return-codes-used-robocopy-utility
  const codeReasons = {
    8:  "Some files or directories could not be copied (copy errors).",
    16: "Robocopy did not copy any files. Usually a fatal error — check the source/destination paths and permissions.",
  };
  return codeReasons[exitCode] || `Robocopy exited with code ${exitCode}.`;
}

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
  // mode: "replace" (default — overwrite the recorded backup) or "new"
  // (write to a timestamped sibling folder so history is preserved).
  const mode = req.body?.mode === "new" ? "new" : "replace";

  // Optional folder-name override from the modal's input. Validate:
  // - Strip whitespace.
  // - Reject anything that contains a path separator or ".." so the user
  //   can't escape the backupRoot via input.
  // - If empty, fall back to the mode's default.
  const rawFolderName = typeof req.body?.folderName === "string" ? req.body.folderName.trim() : "";
  if (rawFolderName && /[\\/]|\.\./.test(rawFolderName)) {
    return res.status(400).json({ error: "Folder name cannot contain slashes or '..'." });
  }

  const backupRoot = cfg.backupPath || defaultBackupPath();
  const pad = (n) => String(n).padStart(2, "0");
  const now = new Date();
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;

  let folderBasename;
  if (rawFolderName) {
    folderBasename = rawFolderName;
  } else if (mode === "new") {
    folderBasename = `${name}-${stamp}`;
  } else {
    // Replace fallback: prefer the basename of the recorded last
    // destination, otherwise the project name.
    const recordedDest = db[slug]?.lastBackedUpDest;
    folderBasename = recordedDest ? path.basename(recordedDest) : name;
  }

  let dest;
  if (mode === "replace") {
    // Replace mode: if the user hasn't overridden the folder name AND a
    // recorded destination exists with a still-reachable parent, prefer
    // that exact path (handles the case where the user moved their backup
    // root since the last backup). Otherwise resolve under backupRoot.
    const recordedDest = db[slug]?.lastBackedUpDest;
    const recordedBasename = recordedDest ? path.basename(recordedDest) : null;
    if (!rawFolderName && recordedDest && fs.existsSync(path.dirname(recordedDest)) && recordedBasename === folderBasename) {
      dest = recordedDest;
    } else {
      dest = path.join(backupRoot, folderBasename);
    }
  } else {
    dest = path.join(backupRoot, folderBasename);
  }

  // Safety. Replace mode: refuse to mirror over a folder that isn't ours
  // (the marker check). New mode: dest is timestamped so it should be
  // fresh; if a collision somehow exists, refuse rather than clobber.
  try {
    if (mode === "new") {
      if (fs.existsSync(dest)) {
        throw new Error(`Backup destination "${dest}" already exists — wait a moment and try again.`);
      }
    } else {
      await ensureBackupSafe(dest, slug, folder);
    }
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

  // Robocopy writes most diagnostic output (including ERROR lines for
  // disk-full, access-denied, retry-limit-exceeded) to stdout, not stderr.
  // Capture both so failures surface actionable text instead of "Exit code 8".
  let stderr = "";
  let stdout = "";
  child.stderr.on("data", (d) => { stderr += d.toString(); });
  child.stdout.on("data", (d) => { stdout += d.toString(); });

  // Robocopy can emit BOTH 'error' (e.g. ENOENT spawning the exe) and 'close'
  // for the same launch — close fires after error with code:null. Without a
  // guard we'd call res.json() twice and crash with "Cannot set headers after
  // they are sent". Whichever event arrives first wins.
  let responded = false;
  child.on("close", async (code) => {
    if (responded) return;
    responded = true;
    const durationMs = Date.now() - start;
    const ok = code !== null && code < 8;
    // Re-write the marker after /MIR (it may have been pruned if source had no marker).
    if (ok) await writeBackupMarker(dest, slug, name, folder).catch(() => {});
    if (ok) {
      await updateDB((db2) => {
        db2[slug] = {
          ...(db2[slug] || {}),
          lastBackedUpAt: new Date().toISOString(),
          lastBackedUpDest: dest,
          updatedAt: new Date().toISOString(),
        };
      });
    }
    let errorMessage;
    if (!ok) {
      // Pull the most relevant lines from Robocopy's combined output so the
      // toast tells the user "Access is denied" instead of "Exit code 8".
      errorMessage = extractRobocopyError(stdout, stderr, code);
    }
    res.json({
      ok,
      exitCode: code,
      durationMs,
      dest,
      stderr: ok ? undefined : stderr,
      message: errorMessage,
    });
  });

  child.on("error", (err) => {
    if (responded) return;
    responded = true;
    res.status(500).json({ error: err.message });
  });
}
app.post("/api/projects/:slug/backup", backupHandler);

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
  if (has("pyproject.toml") || has("requirements.txt") || has("setup.py")) return "python";
  if (has("Cargo.toml")) return "rust";
  if (has("go.mod")) return "go";
  if (has("pubspec.yaml")) return "flutter";
  // .NET projects ship a *.csproj/*.fsproj/*.vbproj or a *.sln.
  if (anyMatch(dir, /\.(cs|fs|vb)proj$|\.sln$/i)) return "dotnet";
  if (has("pom.xml") || has("build.gradle") || has("build.gradle.kts") || has("settings.gradle")) return "java";
  return "generic";
}

// Secret-content scanner config. Robocopy /XF already drops files by NAME
// (.env, *.pem, id_rsa, etc.); this scanner catches hardcoded secrets
// inside legitimate source files. We accept false negatives over false
// positives — only high-confidence shapes go here.
const SECRET_PATTERNS = [
  { name: "OpenAI/Stripe secret",  re: /\bsk-(?:proj-|live_|test_)?[A-Za-z0-9_\-]{20,}\b/g },
  { name: "Anthropic key",         re: /\bsk-ant-[A-Za-z0-9_\-]{20,}\b/g },
  { name: "GitHub PAT (classic)",  re: /\bghp_[A-Za-z0-9]{20,}\b/g },
  { name: "GitHub fine-grained",   re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { name: "AWS access key",        re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "Slack token",           re: /\bxox[bpoars]-[A-Za-z0-9-]{10,}\b/g },
  { name: "PEM private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { name: "Google API key",        re: /\bAIza[0-9A-Za-z_\-]{35}\b/g },
];
const SECRET_SKIP_DIRS = new Set([
  ".git", ".github", "node_modules", "dist", "build", "out", "target",
  ".next", ".turbo", ".vercel", "vendor", "bin", "obj", ".venv", "venv",
  ".pytest_cache", ".mypy_cache",
]);
const SECRET_SKIP_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
  ".pdf", ".zip", ".tar", ".gz", ".7z", ".rar", ".jar", ".war",
  ".bin", ".dat", ".class", ".so", ".dylib",
  ".mp3", ".mp4", ".mov", ".wav", ".ogg", ".webm",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".lock",
]);
const SECRET_MAX_FILE_BYTES = 256 * 1024;

// Walks `root`, reads small text files, and returns any matches for the
// high-confidence secret shapes above. One finding per (file, kind) keeps
// the abort report compact even when a token leaks into many places.
async function scanForSecrets(root) {
  const findings = [];
  const dirs = [root];
  while (dirs.length) {
    const dir = dirs.pop();
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      if (SECRET_SKIP_DIRS.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { dirs.push(full); continue; }
      if (!ent.isFile()) continue;
      const ext = path.extname(ent.name).toLowerCase();
      if (SECRET_SKIP_EXT.has(ext)) continue;
      let stat;
      try { stat = await fsp.stat(full); } catch { continue; }
      if (stat.size > SECRET_MAX_FILE_BYTES) continue;
      let txt;
      try { txt = await fsp.readFile(full, "utf8"); } catch { continue; }
      for (const { name, re } of SECRET_PATTERNS) {
        re.lastIndex = 0;
        const m = re.exec(txt);
        if (!m) continue;
        const before = txt.slice(0, m.index);
        const line = before.split(/\r?\n/).length;
        const snippet = m[0].length > 12 ? `${m[0].slice(0, 6)}…${m[0].slice(-4)}` : m[0];
        findings.push({
          file: path.relative(root, full).replace(/\\/g, "/"),
          line,
          kind: name,
          snippet,
        });
        break;
      }
    }
  }
  return findings;
}

// Quick non-recursive directory scan that returns true if any entry name
// matches `re`. Used by detectStackForGitignore to spot project files whose
// exact name varies per project (e.g. *.csproj).
function anyMatch(dir, re) {
  try {
    return fs.readdirSync(dir).some((n) => re.test(n));
  } catch {
    return false;
  }
}

// Build a polished README from package.json + GitHub identity. Always
// overwrites the previous README so re-publishing refreshes the content.
// Per-stack command sets. Anchored by buildReadme + the AI prompts so a
// "node" repo's README shows `npm` commands while a "rust" repo shows
// `cargo`. The CI workflow generator reads the same map.
const STACK_COMMANDS = {
  node:    { install: "npm install",                   run: "npm run dev",     build: "npm run build", test: "npm test",                 langLabel: "Node.js" },
  python:  { install: "pip install -r requirements.txt", run: "python main.py", build: "",              test: "pytest",                   langLabel: "Python"  },
  rust:    { install: "cargo build",                   run: "cargo run",       build: "cargo build --release", test: "cargo test",       langLabel: "Rust"    },
  go:      { install: "go mod download",               run: "go run ./...",    build: "go build ./...", test: "go test ./...",           langLabel: "Go"      },
  flutter: { install: "flutter pub get",               run: "flutter run",     build: "flutter build", test: "flutter test",             langLabel: "Flutter" },
  dotnet:  { install: "dotnet restore",                run: "dotnet run",      build: "dotnet build -c Release", test: "dotnet test",    langLabel: ".NET"    },
  java:    { install: "./mvnw install -DskipTests",    run: "./mvnw spring-boot:run", build: "./mvnw package", test: "./mvnw test",      langLabel: "Java"    },
  generic: { install: "",                              run: "",                build: "",              test: "",                         langLabel: ""        },
};

function buildReadme({ pkg, repoName, login, author, stack, stacks = [], dest = "" }) {
  const productName = pkg?.productName || pkg?.name || repoName;
  const description = pkg?.description ||
    (stack !== "generic" ? `A ${(STACK_COMMANDS[stack]?.langLabel || stack)} project.` : `The ${repoName} project.`);
  const version = pkg?.version || "";
  const homepage = pkg?.homepage || "";
  const repoUrl = login ? `https://github.com/${login}/${repoName}` : "";
  const cmds = STACK_COMMANDS[stack] || STACK_COMMANDS.generic;

  // For node projects, prefer the actual script that exists in package.json
  // over the canned "npm run dev". `dev` > `start` > first script the user defined.
  let runCmd = cmds.run;
  let buildCmd = cmds.build;
  let testCmd = cmds.test;
  if (stack === "node") {
    const scripts = pkg?.scripts || {};
    const pick = scripts.dev ? "dev" : scripts.start ? "start" : Object.keys(scripts)[0];
    if (pick) runCmd = `npm run ${pick}`;
    if (scripts.build) buildCmd = "npm run build";
    if (scripts.test)  testCmd  = "npm test";
  }

  // Badges. Always: license. When known: version, language. When detected:
  // framework markers (Electron, Next.js, Tauri, etc.).
  const badges = [`[![License: MIT](https://img.shields.io/badge/License-MIT-6a4dff.svg)](LICENSE)`];
  if (version) badges.push(`![Version](https://img.shields.io/badge/version-${encodeURIComponent(version)}-1f1f23.svg)`);
  if (cmds.langLabel) badges.push(`![${cmds.langLabel}](https://img.shields.io/badge/${encodeURIComponent(cmds.langLabel)}-1f1f23.svg)`);
  if (pkg?.devDependencies?.electron) {
    badges.push(`[![Built with Electron](https://img.shields.io/badge/built%20with-Electron-47848F.svg)](https://www.electronjs.org/)`);
  }
  if (pkg?.dependencies?.next) {
    badges.push(`[![Next.js](https://img.shields.io/badge/Next.js-000000.svg?logo=next.js)](https://nextjs.org/)`);
  }
  if (pkg?.devDependencies?.["@tauri-apps/cli"] || pkg?.dependencies?.["@tauri-apps/api"]) {
    badges.push(`[![Tauri](https://img.shields.io/badge/Tauri-24C8DB.svg?logo=tauri&logoColor=white)](https://tauri.app/)`);
  }
  if (repoUrl) {
    badges.push(`[![Stars](https://img.shields.io/github/stars/${login}/${repoName}?style=social)](${repoUrl})`);
  }

  // Tech stack list — render all detected stacks so polyglot projects
  // (Tauri = Rust + Node) get an honest tech list.
  const techStackList = stacks.length > 0
    ? stacks.map((s) => `- ${STACK_COMMANDS[s.toLowerCase()]?.langLabel || s}`).join("\n")
    : (cmds.langLabel ? `- ${cmds.langLabel}` : "");

  // Project structure — top-level directories, skipping anything in the
  // hidden/heavy-dirs set and the common build outputs. Capped at 8 entries
  // so the README stays scannable.
  let structureBlock = "";
  if (dest) {
    try {
      const SKIP = new Set([".git", ".github", ".vscode", ".idea", "node_modules", "dist", "build", "out", "target", "bin", "obj", "vendor", ".next", ".turbo"]);
      const entries = fs.readdirSync(dest, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith(".") && !SKIP.has(d.name))
        .map((d) => d.name)
        .sort()
        .slice(0, 8);
      if (entries.length > 0) {
        const tree = entries.map((n) => `├── ${n}/`).join("\n");
        structureBlock = `\n## Project structure\n\n\`\`\`\n${productName.toLowerCase().replace(/\s+/g, "-")}/\n${tree}\n\`\`\`\n`;
      }
    } catch {}
  }

  const scriptsBlock = (() => {
    if (stack !== "node") return "";
    const scripts = pkg?.scripts || {};
    const keys = Object.keys(scripts);
    if (!keys.length) return "";
    const lines = keys.slice(0, 8).map((k) => `- \`npm run ${k}\` — ${describeScript(k, scripts[k])}`);
    return `\n## Scripts\n\n${lines.join("\n")}\n`;
  })();

  // Quick start: clone + install + run as one block. Skip clone line if no
  // remote URL yet.
  const quickStartLines = [];
  if (repoUrl) {
    quickStartLines.push(`git clone ${repoUrl}.git`);
    quickStartLines.push(`cd ${repoName}`);
  }
  if (cmds.install) quickStartLines.push(cmds.install);
  if (runCmd)       quickStartLines.push(runCmd);

  // Screenshot placeholder — only render if the project has somewhere a
  // contributor could put screenshots so the section isn't dead weight.
  let screenshotBlock = "";
  if (dest) {
    const has = (rel) => fs.existsSync(path.join(dest, rel));
    if (has("assets") || has("screenshots") || has("docs/images") || has("docs/screenshots")) {
      screenshotBlock = `\n## Screenshots\n\n<!-- Add screenshots to /assets, /screenshots, or /docs/images and link them here. -->\n`;
    }
  }

  return [
    `<div align="center">`,
    ``,
    `# ${productName}`,
    ``,
    description,
    ``,
    badges.join(" "),
    ``,
    `</div>`,
    ``,
    `---`,
    ``,
    `## Quick start`,
    ``,
    quickStartLines.length ? "```bash\n" + quickStartLines.join("\n") + "\n```" : "",
    ``,
    `## Installation`,
    ``,
    cmds.install ? "```bash\n" + cmds.install + "\n```" : "_See project-specific setup notes._",
    ``,
    `## Usage`,
    ``,
    runCmd ? "```bash\n" + runCmd + "\n```" : "_See project-specific run instructions._",
    ``,
    buildCmd ? `## Build\n\n\`\`\`bash\n${buildCmd}\n\`\`\`\n` : "",
    testCmd  ? `## Tests\n\n\`\`\`bash\n${testCmd}\n\`\`\`\n`  : "",
    scriptsBlock.trim() ? scriptsBlock.trim() : "",
    techStackList ? `\n## Tech stack\n\n${techStackList}\n` : "",
    structureBlock.trim(),
    screenshotBlock.trim(),
    `## Contributing`,
    ``,
    `Contributions, issues, and feature requests are welcome.`,
    `See [CONTRIBUTING.md](CONTRIBUTING.md) or open an [issue](${repoUrl ? `${repoUrl}/issues` : "../../issues"}).`,
    ``,
    `## License`,
    ``,
    `MIT${author ? ` © ${author}` : ""} — see [LICENSE](LICENSE) for details.`,
    homepage ? `\n---\n\n[Homepage](${homepage})\n` : "",
  ].filter(Boolean).join("\n");
}

function describeScript(name, cmd) {
  const shortMap = {
    dev: "Run in development mode",
    start: "Start the application",
    build: "Build for production",
    test: "Run the test suite",
    lint: "Lint the codebase",
    server: "Start the server",
  };
  return shortMap[name] || `Runs \`${cmd.length > 60 ? cmd.slice(0, 60) + "…" : cmd}\``;
}

function buildLicenseMIT(author) {
  const year = new Date().getFullYear();
  return `MIT License

Copyright (c) ${year} ${author || "the contributors"}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OF OR OTHER DEALINGS IN
THE SOFTWARE.
`;
}

const GITHUB_TEMPLATES = {
  bugReport: `---
name: Bug report
about: Report something that isn't working
title: '[Bug] '
labels: bug
---

**Describe the bug**
A clear description of what the bug is.

**Steps to reproduce**
1. Go to '…'
2. Click on '…'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment**
- OS:
- Version:
`,
  featureRequest: `---
name: Feature request
about: Suggest an improvement or new feature
title: '[Feature] '
labels: enhancement
---

**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
What you'd like to see happen.

**Alternatives considered**
Any alternative solutions or features you've considered.

**Additional context**
Anything else that helps explain the request.
`,
  pullRequest: `## Description

Brief description of the changes in this PR.

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist

- [ ] My code follows the project style
- [ ] I have tested my changes
- [ ] I have updated documentation as needed
`,
  contributing: `# Contributing

Thanks for considering a contribution.

## How to contribute

1. **Open an issue first** for anything bigger than a typo so we can agree on the approach before you spend time on it.
2. **Fork the repo** and create a feature branch from \`main\`: \`git checkout -b feat/short-description\`.
3. **Make focused commits** — small, well-described commits are easier to review than one large one.
4. **Run the test suite and linters** locally before opening a PR.
5. **Open a pull request** referencing the issue. Fill in the PR template; reviewers will check correctness, scope, and docs.

## Local setup

See the [README](README.md) for install / run / build commands. If a step there fails on a fresh clone, that's a bug worth filing.

## Code style

- Match the surrounding code's conventions.
- Prefer clarity over cleverness.
- Add a comment when the *why* is non-obvious.

## Reporting bugs

Open a [bug report](../../issues/new?template=bug_report.md) with a minimal reproduction and your environment details.
`,
  security: `# Security policy

## Supported versions

Only the latest release receives security updates.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Email the maintainers privately, or use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) if it's enabled on this repo.

Include:

- A description of the issue and its potential impact.
- Steps to reproduce, or a proof-of-concept.
- The version / commit you tested against.
- Your contact for follow-up questions.

We aim to acknowledge within 72 hours and to share a fix or mitigation timeline within seven days.
`,
  dependabot: `version: 2
updates:
  # Update GitHub Actions weekly so workflow versions stay supported.
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
{{ECOSYSTEM_BLOCK}}`,
};

// Per-stack ecosystem block injected into the dependabot template. Keeps
// dependabot quiet for stacks where we don't ship a lockfile-bearing
// manifest in the public copy.
const DEPENDABOT_ECOSYSTEMS = {
  node:    `  - package-ecosystem: "npm"\n    directory: "/"\n    schedule:\n      interval: "weekly"\n    open-pull-requests-limit: 5\n`,
  python:  `  - package-ecosystem: "pip"\n    directory: "/"\n    schedule:\n      interval: "weekly"\n    open-pull-requests-limit: 5\n`,
  rust:    `  - package-ecosystem: "cargo"\n    directory: "/"\n    schedule:\n      interval: "weekly"\n    open-pull-requests-limit: 5\n`,
  go:      `  - package-ecosystem: "gomod"\n    directory: "/"\n    schedule:\n      interval: "weekly"\n    open-pull-requests-limit: 5\n`,
  dotnet:  `  - package-ecosystem: "nuget"\n    directory: "/"\n    schedule:\n      interval: "weekly"\n    open-pull-requests-limit: 5\n`,
  java:    `  - package-ecosystem: "maven"\n    directory: "/"\n    schedule:\n      interval: "weekly"\n    open-pull-requests-limit: 5\n`,
  // No flutter / generic block — flutter has no native dependabot ecosystem,
  // generic doesn't know which manifest you ship.
};

// Per-stack CI workflows. Bare-minimum "install + test (best-effort) + build"
// pipelines that pass on the first push of a fresh repo and give the user
// a green badge without requiring them to author YAML up front.
function buildCiWorkflow(stack) {
  if (stack === "node") {
    return `name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - name: Install
        run: npm ci || npm install
      - name: Test
        run: npm test --if-present
      - name: Build
        run: npm run build --if-present
`;
  }
  if (stack === "python") {
    return `name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.11", "3.12"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: \${{ matrix.python-version }}
      - name: Install
        run: |
          python -m pip install --upgrade pip
          if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
          if [ -f pyproject.toml ]; then pip install . || true; fi
      - name: Test
        run: |
          pip install pytest
          pytest -q || echo "No tests yet."
`;
  }
  if (stack === "rust") {
    return `name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
      - name: Build
        run: cargo build --verbose
      - name: Test
        run: cargo test --verbose
`;
  }
  if (stack === "go") {
    return `name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.22"
      - name: Build
        run: go build ./...
      - name: Test
        run: go test ./...
`;
  }
  return ""; // no CI template for flutter / dotnet / java / generic yet
}

// Pick reasonable repo topics: package.json keywords, plus stack-derived
// defaults. GitHub topics must be lowercase with dashes only.
// Build a topic list for `gh repo edit --add-topic`. Pulls from:
//   1. package.json keywords (the user's own intent — wins on conflicts)
//   2. detected stacks[] array (multi-language repos get every language)
//   3. specific framework deps (nextjs, vue, svelte, tauri, electron, etc.)
// GitHub allows 20 topics max, must be lowercase, only a-z/0-9/dashes.
function buildRepoTopics(pkg, stack, stacks = []) {
  const fromPkg = Array.isArray(pkg?.keywords) ? pkg.keywords : [];

  // Map every detected stack to its canonical GitHub topic.
  const stackToTopic = {
    node: "nodejs", "node api": "nodejs", "next.js": "nextjs", react: "react",
    vite: "vite", python: "python", rust: "rust", go: "golang",
    flutter: "flutter", dotnet: "dotnet", java: "java",
  };
  const stackTopics = [];
  for (const s of [stack, ...stacks]) {
    if (!s) continue;
    const t = stackToTopic[String(s).toLowerCase()];
    if (t) stackTopics.push(t);
  }

  // Framework dep sniff — these survive even if `stack` is just "node".
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  const frameworkTopics = [];
  if (deps.electron)               frameworkTopics.push("electron", "desktop-app");
  if (deps.next)                   frameworkTopics.push("nextjs", "react");
  if (deps.vue)                    frameworkTopics.push("vue");
  if (deps.svelte)                 frameworkTopics.push("svelte");
  if (deps.astro)                  frameworkTopics.push("astro");
  if (deps.remix || deps["@remix-run/react"]) frameworkTopics.push("remix");
  if (deps["@nestjs/core"])        frameworkTopics.push("nestjs");
  if (deps.express)                frameworkTopics.push("express");
  if (deps.fastify)                frameworkTopics.push("fastify");
  if (deps.hono)                   frameworkTopics.push("hono");
  if (deps["@tauri-apps/cli"] || deps["@tauri-apps/api"]) frameworkTopics.push("tauri");
  if (deps.expo)                   frameworkTopics.push("expo", "react-native");
  if (deps["react-native"])        frameworkTopics.push("react-native");
  if (deps.tailwindcss)            frameworkTopics.push("tailwindcss");
  if (deps.typescript)             frameworkTopics.push("typescript");

  const out = new Set();
  for (const t of [...fromPkg, ...stackTopics, ...frameworkTopics]) {
    const norm = String(t).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (norm && norm.length <= 50) out.add(norm); // GitHub also caps at 50 chars
  }
  return [...out].slice(0, 20); // GitHub allows up to 20 topics
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
  go: [
    "bin/", "pkg/", "vendor/", "*.exe", "*.test", "*.out",
    ".env", ".env.*", "!.env.example",
    ".DS_Store", "Thumbs.db",
  ].join("\n") + "\n",
  flutter: [
    ".dart_tool/", ".flutter-plugins", ".flutter-plugins-dependencies",
    ".packages", ".pub-cache/", ".pub/", "build/",
    "android/.gradle/", "android/app/build/", "android/local.properties",
    "ios/Pods/", "ios/.symlinks/", "ios/Flutter/.last_build_id",
    ".env", ".env.*", "!.env.example",
    ".DS_Store", "Thumbs.db",
  ].join("\n") + "\n",
  dotnet: [
    "bin/", "obj/", "*.user", "*.suo", "*.userosscache", "*.sln.docstates",
    ".vs/", "[Dd]ebug/", "[Rr]elease/", "x64/", "x86/",
    "TestResults/", "*.coverage",
    ".env", ".env.*", "!.env.example",
    ".DS_Store", "Thumbs.db",
  ].join("\n") + "\n",
  java: [
    "target/", "build/", "out/", ".gradle/", ".idea/", "*.iml", ".classpath",
    ".project", ".settings/", "bin/", "*.class", "hs_err_pid*",
    ".env", ".env.*", "!.env.example",
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
// Body: {
//   dest?: string,
//   repoName?: string,
//   visibility?: "public"|"private",
//   mode?: "initial"|"overwrite"|"release",
//   version?: string  // required when mode === "release"
// }
// Mode controls the pipeline:
//   initial   — first-time publish: refuse-if-dest-not-empty guard,
//               gh repo create + push (current behavior).
//   overwrite — re-publish into the same -public folder: dest is allowed
//               to already be a git repo; we mirror over it and push the
//               new state on top of existing history (commits persist for
//               rollback). No new release tag.
//   release   — same as overwrite, plus `gh release create v<version>`.
app.post("/api/projects/:slug/github/prepare", async (req, res) => {
  const slug = req.params.slug;
  const folder = fromSlug(slug);
  if (!fs.existsSync(folder)) return res.status(404).json({ error: "folder not found" });

  // Sanitize repoName: GitHub only allows [A-Za-z0-9._-] anyway, and we
  // later substitute this into a cmd.exe-launched shell command (see
  // spawnAiPrompt), so anything outside that set is both pointless and a
  // command-injection vector via `^ & | < > \``.
  const repoNameRaw = String(req.body?.repoName || path.basename(folder)).trim();
  const repoName = repoNameRaw.replace(/[^A-Za-z0-9._-]/g, "-");
  const visibility = req.body?.visibility === "private" ? "private" : "public";
  const destRaw = String(req.body?.dest || path.join(path.dirname(folder), `${path.basename(folder)}-public`));
  // Defence-in-depth: refuse a dest that resolves to the source itself or
  // anywhere inside it. /MIR into your own source would either be a no-op or
  // silently delete project files that aren't under the mirror's exclusion
  // list. Absolute paths the user genuinely typed elsewhere on disk are
  // intentionally allowed — this is a local-first tool, not a sandbox.
  const dest = path.resolve(destRaw);
  const resolvedSource = path.resolve(folder);
  if (dest === resolvedSource || dest.startsWith(resolvedSource + path.sep)) {
    return res.status(400).json({ error: "Destination cannot be inside the source project." });
  }
  const modeRaw = String(req.body?.mode || "initial");
  const mode = modeRaw === "overwrite" || modeRaw === "release" ? modeRaw : "initial";
  // Normalise version: strip a leading "v" so the tag math works whether
  // the user typed "1.2.3" or "v1.2.3".
  const versionRaw = String(req.body?.version || "").trim();
  const version = versionRaw.replace(/^v/i, "");
  if (mode === "release" && !version) {
    return res.status(400).json({ error: "version is required for new-release mode (e.g., 1.2.3)" });
  }

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
    // Re-publish modes skip the guard entirely — dest is *expected* to be
    // a populated git repo from the first publish.
    if (fs.existsSync(dest)) {
      if (mode === "initial") {
        const entries = await fsp.readdir(dest);
        const looksLikePriorPrep = entries.includes(".git");
        if (entries.length > 0 && !looksLikePriorPrep) {
          return fail("guard", `Destination "${dest}" already exists and isn't empty. Delete it or pick a different folder.`);
        }
      }
    } else {
      if (mode !== "initial") {
        return fail("guard", `Re-publish expected the public copy at "${dest}" but it is missing. Pick a different destination or run an initial publish.`);
      }
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
    // Publish-only exclusions: tool-state and build-output dirs that are
    // universally bad to ship in a public OSS repo. Project-specific dirs
    // (`demo`, `data`, etc.) are NOT here — they belong in the project's
    // own .gitignore so other projects' legitimate `data/`/`demo/` folders
    // aren't silently dropped.
    const PREP_EXTRA_EXCLUDES = [".claude", ".codex", ".cursor", "dist"];
    const robocopyArgs = [
      folder, dest, "/E",
      "/XD", ...HEAVY_DIRS, ...PREP_EXTRA_EXCLUDES, ".git",
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

    // 2b. Sanitize config.json — strip user-specific absolute paths so the
    // public copy starts every fresh clone with sensible defaults instead
    // of paths that only resolve on the maintainer's machine.
    const cfgPath = path.join(dest, "config.json");
    if (fs.existsSync(cfgPath)) {
      try {
        const raw = JSON.parse(await fsp.readFile(cfgPath, "utf8"));
        const isUserPath = (s) => typeof s === "string" && /^[a-zA-Z]:\\Users\\/i.test(s);
        const sanitized = {
          ...raw,
          scanPaths: [],
          extraProjectPaths: [],
          backupPath: isUserPath(raw.backupPath) ? "" : (raw.backupPath || ""),
          designSystemCss: isUserPath(raw.designSystemCss) ? "" : (raw.designSystemCss || ""),
          excludeFolders: [".git", ".vscode", ".idea", "node_modules"],
          tools: {
            vscode: isUserPath(raw.tools?.vscode) ? "code.cmd" : (raw.tools?.vscode || "code.cmd"),
            claude: raw.tools?.claude || "claude",
            codex: raw.tools?.codex || "codex",
            windowsTerminal: isUserPath(raw.tools?.windowsTerminal) ? "wt.exe" : (raw.tools?.windowsTerminal || "wt.exe"),
          },
        };
        await fsp.writeFile(cfgPath, JSON.stringify(sanitized, null, 2) + "\n");
        send("sanitize", true, "Sanitized config.json (cleared user-specific paths).");
      } catch (e) {
        send("sanitize", false, `Could not sanitize config.json: ${e.message}`);
      }
    }

    // 3. Pull GitHub identity early — we need the login for README links and
    // the name/email for git's author config. Best-effort; partial info is OK.
    const stack = detectStackForGitignore(dest);
    let pkg = null;
    try { pkg = JSON.parse(await fsp.readFile(path.join(dest, "package.json"), "utf8")); } catch {}

    let ghLogin = "", ghUserId = "", ghName = "", ghEmail = "";
    const ghUser = await runCapture("gh", ["api", "user"]);
    if (ghUser.code === 0) {
      try {
        const u = JSON.parse(ghUser.stdout);
        ghLogin  = u.login || "";
        ghUserId = u.id ? String(u.id) : "";
        ghName   = u.name || u.login || "";
        ghEmail  = u.email || "";
      } catch {}
    }
    if (!ghEmail && ghLogin) {
      ghEmail = ghUserId ? `${ghUserId}+${ghLogin}@users.noreply.github.com` : `${ghLogin}@users.noreply.github.com`;
    }
    const author = pkg?.author?.name || (typeof pkg?.author === "string" ? pkg.author : "") || ghName || ghLogin;

    // 4. Generate .gitignore if missing.
    const giPath = path.join(dest, ".gitignore");
    if (!fs.existsSync(giPath)) {
      await fsp.writeFile(giPath, GITIGNORE_TEMPLATES[stack] || GITIGNORE_TEMPLATES.generic);
      send("gitignore", true, `Wrote .gitignore (${stack} template).`);
    } else {
      send("gitignore", true, ".gitignore already present; skipped.");
    }

    // 5. Always (re)generate README.md and LICENSE — re-publishing should
    // refresh the polished templates. .github/ scaffolding only writes if
    // the .github folder isn't already tracked by the user.
    const readmePath = path.join(dest, "README.md");
    const altReadme  = path.join(dest, "readme.md");
    if (fs.existsSync(altReadme) && !fs.existsSync(readmePath)) {
      // Normalize to canonical capitalization so GitHub renders our content.
      await fsp.unlink(altReadme).catch(() => {});
    }
    // Hand the README generator the cached multi-stack array so polyglot
    // repos (Tauri = Rust + Node) get an honest Tech stack section, plus
    // dest so it can render an auto Project structure block.
    const detected = (_stackCache.get(folder) || {}).stacks || [];
    await fsp.writeFile(readmePath, buildReadme({ pkg, repoName, login: ghLogin, author, stack, stacks: detected, dest }));
    send("readme", true, "Wrote rich README.md (badges, install, usage, scripts, tech stack, license).");

    const licensePath = path.join(dest, "LICENSE");
    await fsp.writeFile(licensePath, buildLicenseMIT(author));
    send("license", true, `Wrote LICENSE (MIT, © ${author || "the contributors"}).`);

    // .github/ scaffolding. Each file written only if missing so we never
    // clobber a customised template the user has been maintaining.
    const ghDir = path.join(dest, ".github");
    await fsp.mkdir(path.join(ghDir, "ISSUE_TEMPLATE"), { recursive: true });
    const writeIfMissing = async (rel, content) => {
      const p = path.join(dest, rel);
      if (fs.existsSync(p)) return false;
      await fsp.mkdir(path.dirname(p), { recursive: true });
      await fsp.writeFile(p, content);
      return true;
    };
    const wroteIssues   = await writeIfMissing(".github/ISSUE_TEMPLATE/bug_report.md",      GITHUB_TEMPLATES.bugReport);
    const wroteFeature  = await writeIfMissing(".github/ISSUE_TEMPLATE/feature_request.md", GITHUB_TEMPLATES.featureRequest);
    const wrotePr       = await writeIfMissing(".github/PULL_REQUEST_TEMPLATE.md",          GITHUB_TEMPLATES.pullRequest);
    if (wroteIssues || wroteFeature || wrotePr) {
      send("github-templates", true, "Wrote .github/ issue and PR templates.");
    } else {
      send("github-templates", true, ".github/ templates already present; skipped.");
    }

    // Top-level community files. Same idempotency rule.
    const wroteContrib = await writeIfMissing("CONTRIBUTING.md", GITHUB_TEMPLATES.contributing);
    const wroteSec     = await writeIfMissing("SECURITY.md",     GITHUB_TEMPLATES.security);
    if (wroteContrib || wroteSec) send("community", true, "Wrote CONTRIBUTING.md and SECURITY.md.");

    // Dependabot config — only when the stack has a supported ecosystem.
    const eco = DEPENDABOT_ECOSYSTEMS[stack];
    if (eco) {
      const dbContent = GITHUB_TEMPLATES.dependabot.replace("{{ECOSYSTEM_BLOCK}}", eco);
      const wroteDb = await writeIfMissing(".github/dependabot.yml", dbContent);
      if (wroteDb) send("dependabot", true, `Wrote .github/dependabot.yml (${stack} + github-actions).`);
    }

    // CI workflow — only if we have a template for this stack AND no
    // workflow already exists. We don't want to second-guess a maintainer
    // who has hand-tuned their own pipeline.
    const ci = buildCiWorkflow(stack);
    const workflowsDir = path.join(dest, ".github", "workflows");
    const workflowsHasYaml = fs.existsSync(workflowsDir) &&
      fs.readdirSync(workflowsDir).some((f) => /\.ya?ml$/i.test(f));
    if (ci && !workflowsHasYaml) {
      await fsp.mkdir(workflowsDir, { recursive: true });
      await fsp.writeFile(path.join(workflowsDir, "ci.yml"), ci);
      send("ci", true, `Wrote .github/workflows/ci.yml (${stack}).`);
    }

    // 6. git init + identity fallback + add + commit.
    // Skip init on re-publish when .git already exists — `git init -b main`
    // on an existing repo silently renames the current branch to "main",
    // which breaks pushes for users whose branch was named anything else
    // (e.g. "master" or a custom branch).
    const hasGitDir = fs.existsSync(path.join(dest, ".git"));
    if (mode === "initial" || !hasGitDir) {
      send("git", true, "Initializing git repository…");
      const gitInit = await runCapture("git", ["init", "-b", "main"], { cwd: dest });
      if (gitInit.code !== 0) return fail("git", `git init failed: ${gitInit.stderr}`);
    } else {
      send("git", true, "Using existing git repository.");
    }

    const haveEmail = (await runCapture("git", ["config", "user.email"], { cwd: dest })).stdout.trim();
    const haveName  = (await runCapture("git", ["config", "user.name"],  { cwd: dest })).stdout.trim();
    if (!haveEmail || !haveName) {
      if (!ghEmail || !ghName) {
        return fail("git", "Could not determine git identity from gh. Set git config --global user.email/user.name and retry.");
      }
      const setEmail = await runCapture("git", ["config", "user.email", ghEmail], { cwd: dest });
      const setName  = await runCapture("git", ["config", "user.name",  ghName ], { cwd: dest });
      if (setEmail.code !== 0 || setName.code !== 0) {
        return fail("git", `Failed to set git identity: ${setEmail.stderr || setName.stderr}`);
      }
      send("git", true, `Set local git identity to ${ghName} <${ghEmail}>.`);
    }

    // Pre-commit secret scan. Robocopy already drops files by name; this
    // catches hardcoded keys inside source files we DO want to publish.
    // Abort before any commit so the user can fix the leak in their working
    // copy and re-run, instead of having to scrub git history.
    send("secret-scan", true, "Scanning for hardcoded secrets…");
    const findings = await scanForSecrets(dest);
    if (findings.length > 0) {
      const list = findings.slice(0, 10)
        .map((f) => `  - ${f.file}:${f.line} — ${f.kind} (${f.snippet})`)
        .join("\n");
      const more = findings.length > 10 ? `\n  …and ${findings.length - 10} more.` : "";
      return fail("secret-scan",
        `Refused to publish: ${findings.length} likely secret(s) found in the public copy.\n` +
        `Move these to environment variables or .env (which is excluded from publishes), then retry:\n` +
        list + more);
    }
    send("secret-scan", true, "No hardcoded secrets detected.");

    const gitAdd = await runCapture("git", ["add", "."], { cwd: dest });
    if (gitAdd.code !== 0) return fail("git", `git add failed: ${gitAdd.stderr}`);
    // Mode-aware commit message — readable in `git log` and useful when
    // the user rolls back later. "nothing to commit" is treated as a
    // success no-op (re-running prepare after a partial earlier run).
    let commitMsg;
    if (mode === "release")        commitMsg = `Release v${version}`;
    else if (mode === "overwrite") commitMsg = `Update ${repoName}`;
    else                           commitMsg = pkg?.version ? `Initial release v${pkg.version}` : "Initial public commit";
    const gitCommit = await runCapture("git", ["commit", "-m", commitMsg], { cwd: dest });
    if (gitCommit.code !== 0 && !/nothing to commit/i.test(gitCommit.stdout + gitCommit.stderr)) {
      return fail("git", `git commit failed: ${gitCommit.stderr || gitCommit.stdout}`);
    }
    send("git", true, "Committed.");

    // 7. gh repo create + push (initial mode), or push-only (re-publish modes).
    let repoUrl;
    if (mode === "initial") {
      send("gh", true, `Creating ${visibility} repo "${repoName}" on GitHub…`);
      const ghCreate = await runCapture(
        "gh",
        ["repo", "create", repoName, `--${visibility}`, "--source=.", "--push"],
        { cwd: dest }
      );
      if (ghCreate.code !== 0) {
        const combined = ghCreate.stderr + ghCreate.stdout;
        if (/already exists/i.test(combined)) {
          // Repo exists from a prior partial run — just ensure the remote and push.
          // Without ghLogin we can't construct a valid URL; bail with a clear
          // message rather than build "https://github.com//repo" which would
          // then fail with a cryptic git error.
          if (!ghLogin) {
            return fail("gh",
              `A repository named "${repoName}" already exists on GitHub, but we couldn't ` +
              `determine your GitHub username (gh api user failed). Run "gh auth status" ` +
              `to check your login, then retry.`);
          }
          repoUrl = `https://github.com/${ghLogin}/${repoName}`;
          send("gh", true, `Repo already exists; pushing to ${repoUrl}…`);
          await runCapture("git", ["remote", "remove", "origin"], { cwd: dest }); // ignore failure
          const addRemote = await runCapture("git", ["remote", "add", "origin", `${repoUrl}.git`], { cwd: dest });
          if (addRemote.code !== 0) return fail("gh", `git remote add failed: ${addRemote.stderr}`);
          const push = await runCapture("git", ["push", "-u", "origin", "main"], { cwd: dest });
          if (push.code !== 0) return fail("gh", `git push failed: ${push.stderr || push.stdout}`);
        } else {
          return fail("gh", `gh repo create failed: ${ghCreate.stderr || ghCreate.stdout}`);
        }
      } else {
        const urlMatch = (ghCreate.stdout + ghCreate.stderr).match(/https:\/\/github\.com\/[\w.\-]+\/[\w.\-]+/);
        if (urlMatch) {
          repoUrl = urlMatch[0];
        } else if (ghLogin) {
          repoUrl = `https://github.com/${ghLogin}/${repoName}`;
        } else {
          // gh push succeeded but we have nothing trustworthy to show the user.
          // Surface the failure rather than display a broken link.
          return fail("gh",
            "gh repo create reported success but we couldn't parse the repository URL " +
            "from its output and your GitHub username is unknown. Check https://github.com/ manually.");
        }
      }
      send("gh", true, `Pushed to ${repoUrl}`);
    } else {
      // Re-publish: dest already has an origin remote from the first
      // publish. Re-detect it from .git/config rather than trusting state
      // — the user may have manually retargeted the remote.
      const detected = detectGithubUrl(dest);
      if (!detected) {
        return fail("gh", "Re-publish expected an existing GitHub remote in the public copy but found none. Did the first publish complete?");
      }
      repoUrl = detected;
      send("gh", true, `Pushing updates to ${repoUrl}…`);
      // Determine the active branch — `git push origin HEAD` works on any
      // branch the user has checked out, so we don't have to assume "main".
      const push = await runCapture("git", ["push", "origin", "HEAD"], { cwd: dest });
      if (push.code !== 0) {
        // Most common cause: remote moved ahead. Try a rebase + push once.
        const pull = await runCapture("git", ["pull", "--rebase", "origin", "HEAD"], { cwd: dest });
        if (pull.code !== 0) {
          return fail("gh", `git push failed and rebase pull failed: ${pull.stderr || push.stderr || push.stdout}`);
        }
        const push2 = await runCapture("git", ["push", "origin", "HEAD"], { cwd: dest });
        if (push2.code !== 0) return fail("gh", `git push failed after rebase: ${push2.stderr || push2.stdout}`);
      }
      send("gh", true, `Pushed to ${repoUrl}`);
    }

    // 8. Polish the repo: description, homepage, topics. Initial mode only —
    // re-publish runs would just re-set the same fields on every press.
    // Best-effort; failures here are non-fatal because the code is already on GitHub.
    if (mode === "initial") try {
      const editArgs = ["repo", "edit", repoUrl];
      if (pkg?.description) editArgs.push("--description", pkg.description.slice(0, 350));
      if (pkg?.homepage)    editArgs.push("--homepage",    pkg.homepage);
      const topics = buildRepoTopics(pkg, stack, (_stackCache.get(folder) || {}).stacks || []);
      for (const t of topics) editArgs.push("--add-topic", t);
      if (editArgs.length > 3) {
        const ed = await runCapture("gh", editArgs, { cwd: dest });
        if (ed.code === 0) {
          const summary = [
            pkg?.description ? "description" : null,
            pkg?.homepage ? "homepage" : null,
            topics.length ? `${topics.length} topic${topics.length === 1 ? "" : "s"}` : null,
          ].filter(Boolean).join(", ");
          send("polish", true, `Set ${summary || "repo metadata"}.`);
        } else {
          send("polish", false, `gh repo edit warning: ${ed.stderr || ed.stdout}`.trim());
        }
      }
    } catch (e) {
      send("polish", false, `Polish step skipped: ${e.message}`);
    }

    // 9. Release tag.
    //   initial   — best-effort first release from package.json's version.
    //   overwrite — explicitly skipped (user picked overwrite, not release).
    //   release   — required: use the user-supplied version, error if it fails.
    if (mode === "initial" && pkg?.version && !/^0\.0\.0/.test(pkg.version)) {
      const tag = `v${pkg.version}`;
      const rel = await runCapture(
        "gh",
        ["release", "create", tag, "--title", tag, "--generate-notes"],
        { cwd: dest }
      );
      if (rel.code === 0) {
        send("release", true, `Created release ${tag}.`);
      } else {
        // Most common cause: tag already exists from a prior run.
        send("release", false, `Release skipped: ${rel.stderr || rel.stdout}`.trim());
      }
    } else if (mode === "release") {
      const tag = `v${version}`;
      send("release", true, `Creating release ${tag}…`);
      const rel = await runCapture(
        "gh",
        ["release", "create", tag, "--title", tag, "--generate-notes"],
        { cwd: dest }
      );
      if (rel.code !== 0) {
        return fail("release", `gh release create failed: ${rel.stderr || rel.stdout}`.trim());
      }
      send("release", true, `Created release ${tag}.`);
    }

    // 10. Persist completion.
    await updateDB((db) => {
      db[slug] = {
        ...(db[slug] || {}),
        githubPrep: { publicCopyPath: dest, repoUrl, createdAt: new Date().toISOString() },
        updatedAt: new Date().toISOString(),
      };
    });

    res.write(`event: done\ndata: ${JSON.stringify({ ok: true, repoUrl, dest })}\n\n`);
    res.end();
  } catch (err) {
    fail("error", err.message || String(err));
  }
});

// ─── GitHub: AI-assisted publish + release ─────────────────────────────────
//
// Three universal prompt templates the user's chosen CLI (Claude Code or
// Codex) gets prefilled with. All single-line on purpose — embedding
// newlines makes cmd-quoting a mess and the CLIs parse sentence-separated
// steps fine. The prose is intentionally written at a grade-6 reading
// level so users new to git/GitHub can follow what their CLI is doing.
//
// Substitutions handled by ai-launch:
//   {{REPO_NAME}}  — desired repo name
//   {{VISIBILITY}} — literal "public" or "private"
//   {{REPO_URL}}   — existing github.com URL (re-publish modes only)
//
// Mirror of the manual prepare pipeline, rewritten in plain language so
// the AI does the same work the manual flow does — universal across any
// project stack.
// Initial publish — first-time push of a project to a brand-new GitHub
// repo. The prompt is structured so the AI does discovery before writing
// anything (avoids generic boilerplate) and produces the same set of
// professional-grade files the manual pipeline produces.
const PUBLISH_PROMPT =
  "You are publishing this project to GitHub for the first time. Be thorough, professional, and idempotent — never overwrite a file the user has clearly customised. " +
  "Inputs: project folder = current directory; repo name = {{REPO_NAME}}; visibility = {{VISIBILITY}}. " +

  "PHASE 1 — DISCOVER. " +
  "Read the project before writing anything. Identify (a) every primary language/runtime by inspecting manifest files (package.json, pyproject.toml/requirements.txt/setup.py, Cargo.toml, go.mod, pubspec.yaml, *.csproj/*.sln, pom.xml/build.gradle, Gemfile, etc.), (b) the framework(s) the code actually uses (Next.js, Vue, Svelte, Astro, Remix, Tauri, Electron, Express, FastAPI, Django, Axum, Actix, Spring, etc.), (c) the run/build/test commands that work on a fresh clone, (d) the project's purpose by skimming the entry file, src/, and any existing README. Polyglot projects must surface every language they use. " +

  "PHASE 2 — SCAFFOLD (only write what's missing). " +
  "README.md — title, one-line tagline, badges (license, version if known, language(s), shields.io stars after push), short Overview that reflects what the code actually does (not generic filler), Quick start (clone + install + run), Installation, Usage, Build, Tests, Tech stack list (every detected language/framework), Project structure (top-level folders), Contributing pointer, License. Use the real install/run/test commands you derived in Phase 1. If README.md exists and has clear hand-written content, ADD missing sections instead of rewriting. " +
  ".gitignore — stack-appropriate; append to existing rather than replace. " +
  "LICENSE — MIT with my display name (from `gh api user`) and current year, only if absent. " +
  ".github/ISSUE_TEMPLATE/bug_report.md, feature_request.md, PULL_REQUEST_TEMPLATE.md — only if absent. " +
  "CONTRIBUTING.md and SECURITY.md — only if absent. " +
  ".github/dependabot.yml — weekly updates for the stack's ecosystem (npm/pip/cargo/gomod/nuget/maven) PLUS github-actions, only if absent. " +
  ".github/workflows/ci.yml — minimal install + test + build pipeline for the stack, only if no workflow file already exists. " +

  "PHASE 3 — VERIFY. " +
  "Grep the project for hardcoded secrets (sk-..., sk-ant-..., ghp_..., github_pat_..., AKIA..., xox[bpoars]-, AIza..., PEM private key blocks). If any are found, STOP, list each finding, and tell me to move them to .env before retrying. Do not push. " +

  "PHASE 4 — COMMIT. " +
  "If the folder isn't a git repo, `git init -b main`. Configure `git config user.name`/`user.email` from `gh api user` if missing. `git add .` and make one clear commit: 'Initial public commit' (or 'Polish for publish' if commits already exist). " +

  "PHASE 5 — CREATE + PUSH. " +
  "Run `gh repo create {{REPO_NAME}} --{{VISIBILITY}} --source=. --remote=origin --push`. If the repo already exists on my account, add the remote and `git push -u origin HEAD` instead. " +

  "PHASE 6 — POLISH THE REPO PAGE. " +
  "Set description (≤350 chars from the README tagline) with `gh repo edit --description \"<line>\"`. If package.json or pyproject.toml has a homepage, add `--homepage <url>`. Add 5–15 lowercase-with-dashes topics relevant to the stack/frameworks using repeated `--add-topic`. If a version field exists, create the first release with `gh release create v<version> --generate-notes`. " +

  "PHASE 7 — REPORT. " +
  "Print a final summary in this exact format on its own lines:\n" +
  "Repo: https://github.com/<user>/<repo>\n" +
  "Visibility: <public|private>\n" +
  "Topics added: <comma-separated list>\n" +
  "Files created: <comma-separated list>\n" +
  "Files skipped (already present): <comma-separated list>\n" +
  "Then STOP. Do not push additional commits or open browsers.";

// Re-publish without a new release tag. Overwrite the published version
// with whatever's in this folder; history stays intact so the user can
// always roll back.
const OVERWRITE_PROMPT =
  "You are pushing the latest code in this folder to an existing GitHub repo. Be careful — history matters, and the user expects a clean diff, not surprise file deletions. " +
  "Inputs: project folder = current directory; repo = {{REPO_URL}}. " +

  "PHASE 1 — INSPECT. " +
  "Run `git status` and `git diff --stat origin/HEAD...HEAD` (or `git diff --stat HEAD~..HEAD` if no remote tracking) to understand what's changed. Read CHANGELOG.md if present to see what shape the user expects commit messages in. " +

  "PHASE 2 — SECRET SCAN. " +
  "Before committing, grep the staged + unstaged tree for sk-..., sk-ant-..., ghp_..., github_pat_..., AKIA..., xox[bpoars]-, AIza..., and PEM private-key headers. If anything matches, STOP and list each finding instead of committing. " +

  "PHASE 3 — REFRESH SCAFFOLDING (light touch). " +
  "Only update README.md if a section is now demonstrably stale (e.g. install command changed). Do NOT regenerate the whole README. Do NOT add new files unless the user clearly added a new ecosystem (e.g. Python files appeared in a Node repo and there's no Python in .github/dependabot.yml — then add one). " +

  "PHASE 4 — COMMIT + PUSH. " +
  "`git add .`. Single commit, short imperative summary (e.g. 'Fix login error', 'Refactor backup pipeline', 'Update README'). `git push origin HEAD`. If push is rejected because the remote moved ahead, `git pull --rebase origin HEAD`, resolve any conflicts (don't drop the user's local changes — ask if uncertain), then push. " +

  "PHASE 5 — REPORT. " +
  "Print on its own lines:\n" +
  "Repo: {{REPO_URL}}\n" +
  "Commit: <sha7> — <message>\n" +
  "Files changed: <N>\n" +
  "Then STOP. Do not create a release tag (that's a separate flow). Do not change visibility. Do not delete files unless the local working copy removed them.";

// Re-publish + cut a new versioned release. Same commit/push as
// OVERWRITE_PROMPT, plus a tagged release with auto-generated notes.
const RELEASE_PROMPT =
  "You are cutting a new versioned release of this project on GitHub. Pick the right version, update version files, push, and create the release with clean notes. " +
  "Inputs: project folder = current directory; repo = {{REPO_URL}}. " +

  "PHASE 1 — STATE OF THE WORLD. " +
  "Run `git log --oneline -n 30`, `gh release list --limit 5`, and read the current version (package.json#version, pyproject.toml's [project].version or [tool.poetry].version, Cargo.toml's [package].version, the version constant in __init__.py, etc.). Identify the version file(s) for this stack. " +

  "PHASE 2 — PICK THE VERSION. " +
  "Apply semver to the commits since the last release: patch for bug fixes, minor for backward-compatible features, major for breaking changes. State the proposed version and a one-line reason. " +

  "PHASE 3 — UPDATE VERSION + CHANGELOG. " +
  "Bump the version in every relevant file (package.json + lockfile if present, pyproject.toml, Cargo.toml, etc.). If CHANGELOG.md exists, prepend a new ## v<version> — <date> section with one bullet per notable commit (grouped: Added / Changed / Fixed / Removed). If no CHANGELOG.md exists, create one in Keep-a-Changelog style. " +

  "PHASE 4 — SECRET SCAN. " +
  "Grep the tree for sk-..., sk-ant-..., ghp_..., github_pat_..., AKIA..., xox[bpoars]-, AIza..., PEM headers. STOP if any match. " +

  "PHASE 5 — COMMIT, PUSH, TAG. " +
  "`git add .`, commit with 'Release v<version>', `git push origin HEAD`. Then `gh release create v<version> --title \"v<version>\" --generate-notes`. If you already wrote a CHANGELOG entry, pass it via `--notes-file` instead of --generate-notes. " +

  "PHASE 6 — REPORT. " +
  "Print on its own lines:\n" +
  "Repo: {{REPO_URL}}\n" +
  "Release: {{REPO_URL}}/releases/tag/v<version>\n" +
  "Version bumped: <old> → <new>\n" +
  "Then STOP. Do not change visibility. Do not push extra commits.";

// Launches the user's chosen CLI in Windows Terminal at `folder`, with the
// prompt as the CLI's first argument so it auto-runs. Same wt + cmd /k
// pattern as spawnTerminal so a CLI failure (not on PATH, etc.) leaves the
// shell open with the error visible. cmd's quoting rule for embedded "" is
// to double them; the prompt template is single-line and uses single quotes
// internally, so escaping double-quotes is the only thing we need.
function spawnAiPrompt(folder, cliExecutable, prompt) {
  const escaped = prompt.replace(/"/g, '""');
  const cmd = `${cliExecutable} "${escaped}"`;
  return spawnTerminal(folder, cmd);
}

// POST /api/projects/:slug/github/ai-launch
// Body: {
//   cli: "claude"|"codex",
//   repoName: string,
//   visibility: "public"|"private",
//   mode?: "initial"|"overwrite"|"release"
// }
// Mode picks the prompt template:
//   initial   — first-time publish (default; uses PUBLISH_PROMPT)
//   overwrite — re-publish with no new release tag (OVERWRITE_PROMPT)
//   release   — re-publish + create a new release (RELEASE_PROMPT)
app.post("/api/projects/:slug/github/ai-launch", async (req, res) => {
  const folder = fromSlug(req.params.slug);
  if (!fs.existsSync(folder)) return res.status(404).json({ error: "folder not found" });

  const cliKey = req.body?.cli === "codex" ? "codex" : "claude";
  // Sanitise repoName before it lands in spawnAiPrompt's `cmd /k …` shell.
  // GitHub repo names only permit [A-Za-z0-9._-]; anything else (^, &, |, <,
  // >, backtick) is interpreted by cmd.exe before our CLI ever sees it.
  const repoNameRaw = String(req.body?.repoName || path.basename(folder)).trim();
  const repoName = repoNameRaw.replace(/[^A-Za-z0-9._-]/g, "-");
  const visibility = req.body?.visibility === "private" ? "private" : "public";
  const modeRaw = String(req.body?.mode || "initial");
  const mode = modeRaw === "overwrite" || modeRaw === "release" ? modeRaw : "initial";
  if (!repoName) return res.status(400).json({ error: "repoName required" });

  // For re-publish modes the repo URL is required so the prompt can show
  // the user (and the CLI) which repo we are about to update.
  const repoUrl = mode === "initial" ? "" : (detectGithubUrl(folder) || "");
  if (mode !== "initial" && !repoUrl) {
    return res.status(400).json({ error: "Project has no GitHub remote. Publish first." });
  }

  const cfg = loadConfig();
  const cliExecutable = cfg.tools?.[cliKey] || cliKey;

  // Pre-flight: without this, a missing Claude/Codex CLI silently flashes a
  // terminal showing "command not found" because spawnTerminal is detached
  // and never reports a failure. Surface the same notInstalled response the
  // open-tool handler uses so the renderer can show its install modal.
  if (INSTALLABLE_TOOLS[cliKey] && !isCommandOnPath(cliExecutable)) {
    const meta = INSTALLABLE_TOOLS[cliKey];
    return res.json({
      ok: false,
      notInstalled: true,
      tool: cliKey,
      displayName: meta.displayName,
      npmPackage: meta.npmPackage,
      installCmd: `npm install -g ${meta.npmPackage}`,
    });
  }

  const tpl = mode === "release" ? RELEASE_PROMPT
            : mode === "overwrite" ? OVERWRITE_PROMPT
            : PUBLISH_PROMPT;
  const prompt = tpl
    .replace(/\{\{REPO_NAME\}\}/g, repoName)
    .replace(/\{\{VISIBILITY\}\}/g, visibility)
    .replace(/\{\{REPO_URL\}\}/g, repoUrl);

  try {
    spawnAiPrompt(folder, cliExecutable, prompt);
    res.json({ ok: true, cli: cliKey, repoName, visibility, mode });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// POST /api/projects/:slug/github/release
// Body: { tag: string, title?: string, notes?: string, autoNotes?: boolean }
// Runs `gh release create <tag>` in the project folder. Project must already
// be a git repo with a github.com remote (auto-detected via githubUrl).
app.post("/api/projects/:slug/github/release", async (req, res) => {
  const folder = fromSlug(req.params.slug);
  if (!fs.existsSync(folder)) return res.status(404).json({ error: "folder not found" });

  const tag = String(req.body?.tag || "").trim();
  if (!tag) return res.status(400).json({ error: "tag required (e.g., v1.0.1)" });
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const notes = typeof req.body?.notes === "string" ? req.body.notes : "";
  const autoNotes = !!req.body?.autoNotes;

  // Sanity: project must have a github.com origin already.
  if (!detectGithubUrl(folder)) {
    return res.status(400).json({ error: "Project has no GitHub remote. Publish first." });
  }

  const args = ["release", "create", tag];
  if (title) args.push("--title", title);
  if (autoNotes) args.push("--generate-notes");
  else if (notes) args.push("--notes", notes);
  else args.push("--generate-notes"); // sensible default

  const r = await runCapture("gh", args, { cwd: folder });
  if (r.code !== 0) {
    return res.status(500).json({ error: (r.stderr || r.stdout || `gh exit ${r.code}`).trim() });
  }
  // gh release create prints the release URL on stdout when successful.
  const releaseUrl = (r.stdout || "").trim().split(/\s+/).find((s) => /^https?:\/\//.test(s)) || null;
  res.json({ ok: true, tag, releaseUrl });
});

// ─── Boot ───────────────────────────────────────────────────────────────────
const cfg = loadConfig();
await syncDesignSystem(cfg);
await ensureDataDir();
await migrateStatusDB();
// Bind explicitly to loopback. Default (0.0.0.0) would expose the API — which
// can spawn robocopy, run git commands, and open arbitrary paths — to any host
// on the same LAN. The Electron window always hits 127.0.0.1, so there is no
// functional reason to listen anywhere else.
//
// Also wire the listen error path: a port-in-use error otherwise leaves the
// startServerInProcess() promise pending forever and the main process hangs
// with no dialog.
await new Promise((resolve, reject) => {
  const server = app.listen(cfg.port, "127.0.0.1", () => {
    console.log(`\n  Coding Drives → http://127.0.0.1:${cfg.port}\n`);
    resolve();
  });
  server.on("error", reject);
});

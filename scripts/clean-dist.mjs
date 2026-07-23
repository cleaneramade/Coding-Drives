// Removes stale installers from dist/ so only the version just built survives.
// Wired into `npm run build` as `postbuild`, so it runs automatically.
//
// Runs AFTER the build on purpose: the new installer already exists by the time
// anything is deleted, so a failed build can never leave dist/ with nothing
// installable in it.
//
// Only touches files it can positively identify as an installer for a DIFFERENT
// version — it matches the artifactName pattern from package.json's build config
// and parses the version out of the filename. Anything it can't parse is left
// alone rather than guessed at.

import { readdir, unlink, stat } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
const current = pkg.version;

// Mirrors "Coding Drives Setup ${version}.exe" from package.json build.win
// .artifactName, plus the .blockmap electron-builder writes beside it.
// Capture group is the version.
const INSTALLER = /^Coding Drives Setup (\d+\.\d+\.\d+.*?)\.exe(\.blockmap)?$/;

let entries;
try {
  entries = await readdir(DIST);
} catch {
  console.log("[clean-dist] no dist/ yet — nothing to prune");
  process.exit(0);
}

const stale = [];
for (const name of entries) {
  const m = INSTALLER.exec(name);
  if (!m) continue;              // not an installer artifact — leave it
  if (m[1] === current) continue; // the build we just made
  stale.push(name);
}

if (!stale.length) {
  console.log(`[clean-dist] dist/ is clean — only ${current} present`);
  process.exit(0);
}

let freed = 0;
for (const name of stale) {
  const p = path.join(DIST, name);
  freed += (await stat(p)).size;
  await unlink(p);
  console.log(`[clean-dist] removed ${name}`);
}
console.log(
  `[clean-dist] pruned ${stale.length} stale file(s), freed ${(freed / 1024 / 1024).toFixed(1)} MB — dist/ now holds ${current} only`,
);

#!/usr/bin/env bash
# Mirror changed runtime files from source into a packaged copy the app
# actually serves. See memory: coding-drives-build-sync.
#
# There are two packaged copies and they play different roles:
#
#   dist/win-unpacked   DEV. Rebuilt with `npm run build:dir`. This is the copy
#                       to run while working — mirror into it, reload the
#                       window, see the change. Default target.
#
#   %LOCALAPPDATA%      PRODUCTION. The installed desktop app. Left alone
#   \Programs\...       during development; refreshed at the end of a session
#                       by running the NSIS installer (`npm run build`).
#
# Usage:
#   scripts/mirror.sh              → dev copy only (dist/win-unpacked)
#   scripts/mirror.sh --installed  → both copies
set -e
SRC="C:/Users/Weedw/Documents/♾️ Coding Projects - Local/Coding Drives"
DEV="/c/Users/Weedw/Documents/♾️ Coding Projects - Local/Coding Drives/dist/win-unpacked/resources/app"
INSTALLED="/c/Users/Weedw/AppData/Local/Programs/Coding Drives/resources/app"

DESTS=("$DEV")
if [ "$1" = "--installed" ] || [ "$1" = "--all" ]; then
  DESTS+=("$INSTALLED")
fi

FILES=(public/index.html public/app.js public/app.css server.js electron.cjs preload.cjs)
for d in "${DESTS[@]}"; do
  if [ ! -d "$d" ]; then
    echo "skipped (not built yet) -> $d"
    continue
  fi
  for f in "${FILES[@]}"; do
    [ -f "$SRC/$f" ] || continue
    mkdir -p "$(dirname "$d/$f")"
    cp "$SRC/$f" "$d/$f"
  done
  # any extra public assets (logo files etc.)
  if [ -d "$SRC/public/ds" ]; then mkdir -p "$d/public/ds"; cp -f "$SRC/public/ds/"* "$d/public/ds/" 2>/dev/null || true; fi
  if [ -d "$SRC/assets" ]; then mkdir -p "$d/assets"; cp -f "$SRC/assets/"*.svg "$SRC/assets/"*.css "$SRC/assets/"*.ps1 "$d/assets/" 2>/dev/null || true; fi
  echo "mirrored -> $d"
done

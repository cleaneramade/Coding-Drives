#!/usr/bin/env bash
# Mirror changed runtime files from source into the packaged copies the app
# actually serves. See memory: coding-drives-build-sync.
set -e
SRC="C:/Users/Weedw/Documents/♾️ Coding Projects - Local/Coding Drives"
DESTS=(
  "/c/Users/Weedw/AppData/Local/Programs/Coding Drives/resources/app"
  "/c/Users/Weedw/Documents/♾️ Coding Projects - Local/Coding Drives/dist/win-unpacked/resources/app"
)
FILES=(public/index.html public/app.js public/app.css server.js electron.cjs preload.cjs)
for d in "${DESTS[@]}"; do
  [ -d "$d" ] || continue
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

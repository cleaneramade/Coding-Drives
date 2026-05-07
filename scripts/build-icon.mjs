// Generates assets/icon.ico from assets/logo.svg in the standard Windows ICO sizes.
// Run once (or on logo change) via `npm run icon`. The build script wires this
// into `npm run build` automatically.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SVG = path.join(ROOT, "assets", "logo.svg");
const OUT = path.join(ROOT, "assets", "icon.ico");

const SIZES = [16, 24, 32, 48, 64, 128, 256];

const svg = await readFile(SVG);
const pngs = await Promise.all(
  SIZES.map((size) =>
    sharp(svg, { density: Math.max(72, size * 4) })
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
  )
);
const ico = await pngToIco(pngs);
await writeFile(OUT, ico);
console.log(`[icon] wrote ${OUT} (${SIZES.join(", ")} px)`);

/**
 * Generate PWA icons from the NetRate logo mark SVG.
 *
 * One-shot script — run once, commit the output PNGs. Source SVG is
 * hardcoded below (mirrors src/app/layout.js:166-172).
 *
 * Output:
 *   public/icons/icon-192.png  (Android / Chrome PWA)
 *   public/icons/icon-512.png  (Android / Chrome PWA maskable)
 *   public/icons/icon-180.png  (iOS Apple Touch Icon)
 *   public/icons/icon-192-maskable.png (with safe-area padding)
 *   public/icons/icon-512-maskable.png
 *
 * Run: node scripts/_generate-pwa-icons.mjs
 */

import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

// Mirrored from src/app/layout.js — 4 parallel bars on a white rounded square.
// Non-maskable: tight 44x44 viewBox, background corner radius 8.
const SVG_NORMAL = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
  <rect width="44" height="44" rx="8" fill="#FFFFFF" stroke="rgba(26,31,46,0.12)"/>
  <rect x="9"  y="24" width="5" height="11" rx="1" fill="#FFC220"/>
  <rect x="17" y="21" width="5" height="14" rx="1" fill="#FFC220"/>
  <rect x="25" y="12" width="5" height="23" rx="1" fill="#2E6BA8"/>
  <rect x="33" y="26" width="5" height="9"  rx="1" fill="#FFC220"/>
</svg>`;

// Maskable: content inset in the center ~80%, background fills the whole canvas.
// Per https://web.dev/maskable-icon/ — safe zone is central 40% of viewbox.
// We scale the 4 bars down and center them. Background is full brand bg so
// the icon looks right when iOS/Android crops to a circle or rounded square.
const SVG_MASKABLE = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#FFFFFF"/>
  <g transform="translate(106 106) scale(6.8)">
    <rect x="9"  y="24" width="5" height="11" rx="1" fill="#FFC220"/>
    <rect x="17" y="21" width="5" height="14" rx="1" fill="#FFC220"/>
    <rect x="25" y="12" width="5" height="23" rx="1" fill="#2E6BA8"/>
    <rect x="33" y="26" width="5" height="9"  rx="1" fill="#FFC220"/>
  </g>
</svg>`;

const OUT_DIR = path.join(process.cwd(), 'public', 'icons');

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const jobs = [
    { svg: SVG_NORMAL,   size: 192, file: 'icon-192.png' },
    { svg: SVG_NORMAL,   size: 512, file: 'icon-512.png' },
    { svg: SVG_NORMAL,   size: 180, file: 'icon-180.png' },
    { svg: SVG_MASKABLE, size: 192, file: 'icon-192-maskable.png' },
    { svg: SVG_MASKABLE, size: 512, file: 'icon-512-maskable.png' },
  ];

  for (const job of jobs) {
    const out = path.join(OUT_DIR, job.file);
    await sharp(Buffer.from(job.svg))
      .resize(job.size, job.size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(out);
    console.log(`wrote ${path.relative(process.cwd(), out)} (${job.size}x${job.size})`);
  }

  // Write the source SVGs alongside so we can re-render if needed.
  await fs.writeFile(path.join(OUT_DIR, 'icon-source.svg'), SVG_NORMAL);
  await fs.writeFile(path.join(OUT_DIR, 'icon-source-maskable.svg'), SVG_MASKABLE);
  console.log('wrote icon-source.svg + icon-source-maskable.svg');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

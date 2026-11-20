#!/usr/bin/env node
/**
 * Renders the app icons from the two checked-in SVGs, headless:
 *
 *   public/h5/icon.svg     the full Heart 5 mark  -> apple-touch-icon.png (180), web-app-manifest-192x192.png,
 *                                                    web-app-manifest-512x512.png, favicon-96x96.png,
 *                                                    and the maskable 192/512 (no card frame, mark inside the safe zone)
 *   public/h5/favicon.svg  the cut for 16-32px    -> favicon.ico (16, 32 and 48, PNG entries)
 *
 *   node scripts/make-icons.mjs [out-dir=public/h5]
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC = 'public/h5';
const OUT = process.argv[2] || SRC;

async function loadPlaywright() {
  try { return await import('playwright'); } catch {
    const root = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(join(root, 'playwright', 'index.mjs')).href);
  }
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: 600, height: 600 } });

/** PNG bytes of an SVG at size px. `inset` shrinks the art onto a paper field (maskable). */
async function render(file, size, inset = 0, bare = false) {
  let svg = readFileSync(join(SRC, file), 'utf8');
  // bare: no card frame, so a launcher's crop doesn't cut through the rules
  if (bare) svg = svg.replace(/<rect x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*" fill="none"[^>]*>/g, '');
  const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const pad = Math.round(size * inset);
  // a roomy viewport, clipped: Chromium won't lay out a 16px-wide window
  await page.setContent(`<html><body style="margin:0;background:#FAFAF7;overflow:hidden">
    <img src="${uri}" style="display:block;position:absolute;left:${pad}px;top:${pad}px;width:${size - pad * 2}px;height:${size - pad * 2}px"></body></html>`);
  await page.waitForFunction(() => document.images[0]?.complete);
  return page.screenshot({ type: 'png', omitBackground: false, clip: { x: 0, y: 0, width: size, height: size } });
}

const out = (name, buf) => { writeFileSync(join(OUT, name), buf); console.log(`  ${name}  ${buf.length} bytes`); };

out('apple-touch-icon.png', await render('icon.svg', 180));
out('favicon-96x96.png', await render('icon.svg', 96));
out('web-app-manifest-192x192.png', await render('icon.svg', 192));
out('web-app-manifest-512x512.png', await render('icon.svg', 512));
// Maskable: launchers crop to a circle or squircle as small as 80% of the tile. Without the card
// frame the mark reaches 39% from the centre, inside that 40% safe circle, on a full paper field.
out('maskable-192x192.png', await render('icon.svg', 192, 0, true));
out('maskable-512x512.png', await render('icon.svg', 512, 0, true));

// favicon.ico: an ICONDIR with PNG-compressed entries (every browser since IE Vista reads these).
const sizes = [16, 32, 48];
const pngs = [];
for (const s of sizes) pngs.push(await render('favicon.svg', s));
// loose copies only when writing somewhere other than public/h5, for looking at them
if (OUT !== SRC) for (const [i, s] of sizes.entries()) out(`favicon-${s}.png`, pngs[i]);
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  head.writeUInt8(s, e); head.writeUInt8(s, e + 1); head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
  head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(pngs[i].length, e + 8); head.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
out('favicon.ico', Buffer.concat([head, ...pngs]));
await browser.close();

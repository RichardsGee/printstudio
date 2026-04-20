#!/usr/bin/env node
/**
 * Strip the blue chromakey background from the spool photo — with a soft
 * feathered edge so anti-aliased border pixels don't leave a blue halo.
 * The green filament is preserved verbatim and tinted per-spool at runtime.
 *
 * Input:  /tmp/spool-src.png
 * Output: public/images/spool.png
 */

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const INPUT = '/tmp/spool-src.png';
const OUTPUT = resolve(HERE, '../public/images/spool.png');

const { data: rgb, info } = await sharp(INPUT)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height } = info;
console.log(`Input: ${width}x${height}`);

const out = Buffer.alloc(width * height * 4);

let removed = 0;
let feathered = 0;

for (let i = 0; i < width * height; i++) {
  const r = rgb[i * 3];
  const g = rgb[i * 3 + 1];
  const b = rgb[i * 3 + 2];

  // "blueness": how much blue dominates over the brightest of R/G
  const blueness = b - Math.max(r, g);

  if (blueness >= 35) {
    // Clearly background blue → fully transparent.
    out[i * 4 + 3] = 0;
    removed++;
    continue;
  }

  if (blueness >= 8) {
    // Edge anti-aliased pixel — keep it but fade alpha toward 0
    // and subtract the blue cast so it blends cleanly.
    const t = (blueness - 8) / 27; // 0..1
    const alpha = Math.round(255 * (1 - t));
    // Blue-cast removal: push blue back toward max(r,g)
    const cleanB = Math.max(r, g);
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = Math.round(b * (1 - t) + cleanB * t);
    out[i * 4 + 3] = alpha;
    feathered++;
    continue;
  }

  out[i * 4] = r;
  out[i * 4 + 1] = g;
  out[i * 4 + 2] = b;
  out[i * 4 + 3] = 255;
}

console.log(`Transparent: ${removed}  Feathered: ${feathered}`);

const raw = await sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
await sharp(raw)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 5 })
  .png({ compressionLevel: 9 })
  .toFile(OUTPUT);

const meta = await sharp(OUTPUT).metadata();
console.log(`Wrote ${OUTPUT} → ${meta.width}x${meta.height}`);

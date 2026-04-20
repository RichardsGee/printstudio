'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Single spool image tinted in-place: we load the real photo with the
 * blue background already removed (public/images/spool.png), and paint
 * every green pixel with the target color, scaled by its luminance so
 * the winding texture is preserved.
 */

interface Props {
  color: string | null;
  active?: boolean;
  size?: number;
  rotating?: boolean;
  label?: string;
  className?: string;
}

const SRC = '/images/spool.png';

let sharedImagePromise: Promise<HTMLImageElement> | null = null;
const tintCache = new Map<string, string>();

function loadImage(): Promise<HTMLImageElement> {
  if (sharedImagePromise) return sharedImagePromise;
  sharedImagePromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = SRC;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
  return sharedImagePromise;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  return [
    parseInt(m.slice(0, 2), 16),
    parseInt(m.slice(2, 4), 16),
    parseInt(m.slice(4, 6), 16),
  ];
}

async function renderTinted(hex: string | null): Promise<string> {
  const cacheKey = hex ?? 'none';
  const cached = tintCache.get(cacheKey);
  if (cached) return cached;

  const img = await loadImage();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(img, 0, 0);

  if (hex) {
    const [tr, tg, tb] = hexToRgb(hex);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = frame.data;
    for (let i = 0; i < px.length; i += 4) {
      const a = px[i + 3];
      if (a === 0) continue;
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const greenness = g - Math.max(r, b);
      if (greenness < 6) continue;
      // Anchor the filament midtone at g=150. Brighter than that lifts the
      // target color toward white; darker pushes it toward black. That way
      // texture survives for ANY target color — including pure white and
      // pure black, which would otherwise clamp flat under a multiply.
      const dlum = g - 150;
      let brR: number, brG: number, brB: number;
      if (dlum > 0) {
        // Lift toward white — cap at 0.35 so pure-black highlights stay
        // matte gray (not bright white).
        const p = Math.min(0.35, dlum / 260);
        brR = Math.round(tr + (255 - tr) * p);
        brG = Math.round(tg + (255 - tg) * p);
        brB = Math.round(tb + (255 - tb) * p);
      } else {
        // Darken toward black — cap at 0.7 so we keep some variation.
        const p = Math.min(0.7, -dlum / 180);
        brR = Math.round(tr * (1 - p));
        brG = Math.round(tg * (1 - p));
        brB = Math.round(tb * (1 - p));
      }
      const strength = Math.min(1, (greenness - 6) / 18);
      px[i] = Math.round(r * (1 - strength) + brR * strength);
      px[i + 1] = Math.round(g * (1 - strength) + brG * strength);
      px[i + 2] = Math.round(b * (1 - strength) + brB * strength);
    }
    ctx.putImageData(frame, 0, 0);
  }

  const url = canvas.toDataURL('image/png');
  tintCache.set(cacheKey, url);
  return url;
}

export function Spool({
  color,
  active = false,
  size = 180,
  rotating = false,
  label,
  className,
}: Props) {
  const hex = normalizeHex(color);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    renderTinted(hex)
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {
        if (alive) setSrc(SRC);
      });
    return () => {
      alive = false;
    };
  }, [hex]);

  return (
    <div
      className={cn('relative inline-block select-none', className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="Spool"
          draggable={false}
          className={cn(
            'absolute inset-0 h-full w-full object-contain pointer-events-none',
            rotating && 'animate-[spin_5s_linear_infinite]',
          )}
          style={{ transformOrigin: '50% 50%' }}
        />
      ) : null}

      {active ? (
        <div
          aria-hidden
          className="absolute rounded-full pointer-events-none animate-pulse"
          style={{
            inset: '2%',
            boxShadow: '0 0 22px 2px rgba(59,130,246,0.55)',
            border: '2px solid rgba(59,130,246,0.85)',
          }}
        />
      ) : null}

      {label ? (
        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-muted-foreground">
          {label}
        </div>
      ) : null}
    </div>
  );
}

function normalizeHex(color: string | null | undefined): string | null {
  if (!color) return null;
  const m = color.match(/^#?([0-9a-fA-F]{6,8})$/);
  if (!m) return null;
  return `#${m[1].slice(0, 6)}`;
}

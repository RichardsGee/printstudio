'use client';

import { cn } from '@/lib/utils';

interface Props {
  /** Cor hex do filamento em trânsito — pode ser null quando sem info. */
  color?: string | null;
  /** Quando true, anima o fluxo de chevrons se movendo pelo tubo. */
  active: boolean;
  className?: string;
}

/**
 * Tubo PTFE preenchido com a cor do filamento, com chevrons (>>>>)
 * em um tom derivado (mais escuro se o filamento é claro; mais claro
 * se é escuro) rolando pra direita indicando fluxo de extrusão.
 */
export function PtfeTube({ color, active, className }: Props) {
  const tint = normalize(color) ?? '#3b82f6';
  // Deriva o tom dos chevrons pra ter contraste confortável vs a cor do tubo.
  const chevronTone = contrastShade(tint);
  // Borda sutil ligeiramente mais escura que o filamento — sensação de tubo real.
  const rim = shiftLuminance(tint, -0.25);

  const chevronSvg = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='12' viewBox='0 0 14 12'><path d='M2 2 L7 6 L2 10' fill='none' stroke='${chevronTone}' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/></svg>`,
  );
  const chevronUrl = `url("data:image/svg+xml;utf8,${chevronSvg}")`;

  return (
    <div
      className={cn('relative h-4 w-full rounded-full overflow-hidden border', className)}
      style={{
        backgroundColor: tint,
        borderColor: rim,
        boxShadow: `inset 0 1px 2px rgba(0,0,0,0.3), inset 0 -1px 1px rgba(255,255,255,0.08)`,
      }}
    >
      {/* Reflexo superior pra dar volume ao tubo */}
      <div
        className="absolute inset-x-0 top-0 h-[35%] pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.22), transparent)',
        }}
      />

      {/* Chevrons rolando sobre o preenchimento colorido do tubo */}
      <div
        className="absolute inset-x-[4%] top-1/2 -translate-y-1/2 h-3 pointer-events-none"
        style={{
          backgroundImage: chevronUrl,
          backgroundRepeat: 'repeat-x',
          backgroundSize: '14px 100%',
          backgroundPosition: 'left center',
          opacity: active ? 1 : 0.35,
          animation: active ? 'ptfe-chevron 1.6s linear infinite' : 'none',
        }}
      />

      <style jsx>{`
        @keyframes ptfe-chevron {
          0% {
            background-position-x: 0;
          }
          100% {
            background-position-x: 14px;
          }
        }
      `}</style>
    </div>
  );
}

function normalize(c: string | null | undefined): string | null {
  if (!c) return null;
  const m = c.match(/^#?([0-9a-fA-F]{6,8})$/);
  return m ? `#${m[1].slice(0, 6)}` : null;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  return [
    parseInt(m.slice(0, 2), 16),
    parseInt(m.slice(2, 4), 16),
    parseInt(m.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number): string =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Escolhe uma tonalidade pros chevrons que contraste com a cor do
 * tubo: se o filamento é claro (luma > 0.55), chevrons ficam ~40%
 * mais escuros. Se é escuro, chevrons ficam ~40% mais claros.
 * Garante legibilidade em qualquer cor de filamento.
 */
function contrastShade(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const delta = lum > 0.55 ? -0.45 : 0.5;
  return shiftLuminance(hex, delta);
}

/**
 * Move a luminância de uma cor hex por `delta` (-1..1). Negativo
 * escurece, positivo clareia misturando com preto/branco.
 */
function shiftLuminance(hex: string, delta: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (delta >= 0) {
    return rgbToHex(r + (255 - r) * delta, g + (255 - g) * delta, b + (255 - b) * delta);
  }
  const k = 1 + delta;
  return rgbToHex(r * k, g * k, b * k);
}

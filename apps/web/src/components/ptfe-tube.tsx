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
 * Tubo PTFE com fluxo de chevrons (>>>>) se movendo da esquerda
 * pra direita indicando o deslocamento do filamento dentro do
 * tubo. Os chevrons herdam a cor do filamento ativo e fazem um
 * loop suave — pacing calibrado pra parecer fluxo contínuo de
 * extrusão, não viagem da cabeça.
 */
export function PtfeTube({ color, active, className }: Props) {
  const tint = normalize(color) ?? '#3b82f6';
  // SVG inline de 1 chevron em data-URI — tinted com a cor do filamento.
  // Escapar o `#` do hex (URI reserved). stroke-linecap round dá ponta
  // suave; viewBox estreito deixa os chevrons próximos uns dos outros.
  const chevron = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='12' viewBox='0 0 14 12'><path d='M2 2 L7 6 L2 10' fill='none' stroke='${tint}' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/></svg>`,
  );
  const chevronUrl = `url("data:image/svg+xml;utf8,${chevron}")`;

  return (
    <div
      className={cn(
        'relative h-3 w-full rounded-full overflow-hidden border border-border/50',
        'bg-gradient-to-b from-white/[0.03] via-black/40 to-white/[0.02]',
        className,
      )}
    >
      {/* Reflexo superior pra dar volume ao tubo */}
      <div className="absolute inset-x-0 top-0 h-[30%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

      {/* Faixa de chevrons — opacidade reduzida quando inativo, */}
      {/* scroll horizontal infinito quando active. */}
      <div
        className="absolute inset-x-[6%] top-1/2 -translate-y-1/2 h-3 pointer-events-none"
        style={{
          backgroundImage: chevronUrl,
          backgroundRepeat: 'repeat-x',
          backgroundSize: '14px 100%',
          backgroundPosition: 'left center',
          opacity: active ? 1 : 0.25,
          animation: active ? 'ptfe-chevron 1.6s linear infinite' : 'none',
          filter: `drop-shadow(0 0 1px ${tint}80)`,
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

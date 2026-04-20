'use client';

import { cn } from '@/lib/utils';

interface Props {
  /** Cor hex do filamento em trânsito — pode ser null quando sem info. */
  color?: string | null;
  /** Quando true, anima um brilho "viajando" sobre o filamento. */
  active: boolean;
  className?: string;
}

/**
 * Tubo PTFE com filamento **contínuo e inteiriço** por dentro. Quando
 * `active`, um brilho translúcido viaja por cima do filamento da
 * esquerda pra direita, indicando fluxo sem cortar o filamento (a
 * versão anterior empilhava 2 segmentos e parecia cortado).
 *
 * Estilo: tubo levemente escuro com reflexo superior, filamento
 * sólido na cor do carrier ativo, e um highlight gradiente animado
 * por cima quando em trânsito.
 */
export function PtfeTube({ color, active, className }: Props) {
  const tint = normalize(color) ?? '#3b82f6';
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

      {/* Filamento contínuo — uma linha só atravessando o tubo todo */}
      <div
        className="absolute top-1/2 left-[6%] right-[6%] -translate-y-1/2 h-[4px] rounded-full"
        style={{
          backgroundColor: tint,
          boxShadow: `0 0 3px ${tint}80`,
        }}
      />

      {/* Brilho viajante — só quando imprimindo. Passa sobre o filamento
          indicando fluxo sem interromper o segmento contínuo. */}
      {active ? (
        <div
          className="absolute top-1/2 left-[6%] right-[6%] -translate-y-1/2 h-[6px] rounded-full pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.65) 50%, transparent 100%)',
            backgroundSize: '30% 100%',
            backgroundRepeat: 'no-repeat',
            animation: 'ptfe-flow 9s linear infinite',
          }}
        />
      ) : null}

      <style jsx>{`
        @keyframes ptfe-flow {
          0% {
            background-position: -30% 0;
          }
          100% {
            background-position: 130% 0;
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

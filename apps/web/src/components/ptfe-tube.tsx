'use client';

import { cn } from '@/lib/utils';

interface Props {
  /** Cor hex do filamento em trânsito — pode ser null quando sem info. */
  color?: string | null;
  /** Quando true, anima o filamento se movendo dentro do tubo. */
  active: boolean;
  className?: string;
}

/**
 * Representação visual de um tubo PTFE com filamento passando por
 * dentro. Quando `active`, uma "linha" colorida do filamento desliza
 * da esquerda pra direita dentro do tubo, simulando o fluxo.
 *
 * Estilo: tubo translúcido/acinzentado como um PTFE real, com
 * brilho sutil nas bordas. O filamento aparece como um segmento
 * contínuo colorido que se repete via CSS keyframes.
 */
export function PtfeTube({ color, active, className }: Props) {
  const tint = normalize(color) ?? '#3b82f6';
  return (
    <div
      className={cn(
        'relative h-3 w-full rounded-full overflow-hidden',
        'border border-border/50',
        // Tubo: gradient vertical pra simular curvatura do PTFE
        'bg-gradient-to-b from-white/[0.03] via-black/40 to-white/[0.02]',
        className,
      )}
    >
      {/* Reflexo superior pra dar volume ao tubo */}
      <div className="absolute inset-x-0 top-0 h-[30%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

      {active ? (
        <>
          {/* Filamento correndo dentro — anima na velocidade do filamento
              real (~mm/s na extrusão), não da cabeça (mm/s de viagem).
              9s por ciclo dá sensação de fluxo constante sem parecer
              acelerado. */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-[4px] rounded-full"
            style={{
              width: '38%',
              backgroundColor: tint,
              boxShadow: `0 0 4px ${tint}aa`,
              animation: 'ptfe-slide 9s linear infinite',
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-[4px] rounded-full"
            style={{
              width: '38%',
              backgroundColor: tint,
              boxShadow: `0 0 4px ${tint}aa`,
              animation: 'ptfe-slide 9s linear infinite',
              animationDelay: '-4.5s',
            }}
          />
        </>
      ) : null}

      <style jsx>{`
        @keyframes ptfe-slide {
          0% {
            transform: translate(-100%, -50%);
          }
          100% {
            transform: translate(260%, -50%);
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

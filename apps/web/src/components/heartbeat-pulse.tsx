'use client';

import { cn } from '@/lib/utils';

interface Props {
  /** Quando true, anima continuamente. False = mostra "flatline". */
  active?: boolean;
  /** Cor do traço (geralmente cor do filamento). */
  color?: string;
  /** Velocidade % reportada pela impressora — modula o BPM. */
  speedPercent?: number | null;
  className?: string;
}

/**
 * Linha de EKG/batimento cardíaco que anda da direita pra esquerda
 * em loop infinito, simulando o "ritmo" da impressão. O tempo do
 * ciclo é proporcional à velocidade da impressora:
 *
 *   - silent (50%)    → ~50 BPM (lento, calmo)
 *   - standard (100%) → ~70 BPM (normal)
 *   - sport (124%)    → ~85 BPM (rápido)
 *   - ludicrous (166%) → ~115 BPM (acelerado)
 *
 * Quando inativo (impressora pausada/concluída/ociosa), só mostra
 * a linha basal estática (sem batimentos).
 */
export function HeartbeatPulse({ active, color, speedPercent, className }: Props) {
  const stroke = color ?? 'currentColor';

  // BPM linear baseado em speedPercent (40 base + 0.45×speed).
  // 100% → 85 BPM. Faixa real: 40-130 (Math.min/max no clamp).
  const bpm = speedPercent != null
    ? Math.max(40, Math.min(130, 40 + speedPercent * 0.45))
    : 70;
  const cycleSec = (60 / bpm).toFixed(2);

  return (
    <div
      className={cn('relative overflow-hidden inline-block', className)}
      aria-hidden
      style={{
        width: 'clamp(60px, 9vw, 110px)',
        height: 'clamp(14px, 1.8vw, 22px)',
      }}
    >
      <style>{`
        @keyframes hb-scroll {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(-50%, 0, 0); }
        }
        .hb-track-${stableId(stroke)} {
          width: 200%;
          height: 100%;
          will-change: transform;
        }
        .hb-track-${stableId(stroke)}.active {
          animation: hb-scroll ${cycleSec}s linear infinite;
        }
      `}</style>

      <div className={cn(`hb-track-${stableId(stroke)}`, active && 'active')}>
        <svg
          viewBox="0 0 200 30"
          preserveAspectRatio="none"
          className="block w-full h-full"
        >
          {/* Padrão EKG repetido 2x (0-100 e 100-200) pra loop seamless */}
          <path
            d={EKG_PATH}
            stroke={stroke}
            fill="none"
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
}

/** Padrão clássico de EKG: baseline → P → QRS → T → baseline, repetido. */
const EKG_PATH = [
  // Ciclo 1 (x: 0 → 100)
  'M 0,15',
  'L 16,15',                   // baseline
  'L 22,13 L 26,15',           // P wave
  'L 36,15',                   // PR segment
  'L 40,5 L 44,4 L 48,26',     // QRS spike
  'L 52,15',                   // S termina
  'L 60,15',                   // ST
  'L 64,12 L 68,12 L 72,15',   // T wave
  'L 100,15',                  // baseline final do ciclo
  // Ciclo 2 (x: 100 → 200) — idêntico, deslocado
  'L 116,15',
  'L 122,13 L 126,15',
  'L 136,15',
  'L 140,5 L 144,4 L 148,26',
  'L 152,15',
  'L 160,15',
  'L 164,12 L 168,12 L 172,15',
  'L 200,15',
].join(' ');

/** ID estável a partir da cor pra evitar colisão de classes CSS quando
 *  vários componentes coexistem com cores diferentes. */
function stableId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 6);
}

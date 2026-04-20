'use client';

import { Zap } from 'lucide-react';
import type { PrinterState } from '@printstudio/shared';
import { cn } from '@/lib/utils';

/**
 * Estima consumo elétrico instantâneo baseado nos targets atuais.
 * Valores de referência pra Bambu A1:
 *   base (MCU + motores idle + câmera)    ~15W
 *   motores imprimindo                    +25W
 *   aquecedor do bico (40W @ 100%)        proporcional ao delta p/ target
 *   aquecedor da mesa (300W @ 100%)       proporcional ao delta p/ target
 *   ventoinhas (soma)                     proporcional ao %
 *
 * É uma estimativa — não há sensor real de corrente. Mas fica
 * próximo o suficiente da realidade pra dar ideia de kWh/custo.
 */
export function estimateWatts(state: PrinterState): number {
  if (state.status === 'OFFLINE' || state.status === 'UNKNOWN') return 0;

  // Base: MCU, placa, câmera, motores parados.
  let watts = 15;

  const printing = state.status === 'PRINTING' || state.status === 'PREPARE';
  if (printing) watts += 25; // motores em movimento

  // Aquecedor do bico (até 40W). Se o delta pro target ainda é grande,
  // está puxando próximo ao max. Quando perto do target, apenas repõe.
  if (state.nozzleTargetTemp && state.nozzleTargetTemp > 50 && state.nozzleTemp !== null) {
    const delta = Math.max(0, state.nozzleTargetTemp - state.nozzleTemp);
    const duty = delta > 10 ? 1 : delta > 2 ? 0.5 : 0.25;
    watts += 40 * duty;
  }

  // Mesa aquecida (até 300W).
  if (state.bedTargetTemp && state.bedTargetTemp > 30 && state.bedTemp !== null) {
    const delta = Math.max(0, state.bedTargetTemp - state.bedTemp);
    const duty = delta > 5 ? 1 : delta > 1 ? 0.5 : 0.2;
    watts += 300 * duty;
  }

  // Ventoinhas (~3W cada a 100%).
  const fans = [
    state.fanPartCoolingPct,
    state.fanAuxPct,
    state.fanChamberPct,
    state.fanHeatbreakPct,
  ];
  for (const pct of fans) {
    if (pct !== null && pct !== undefined) watts += (pct / 100) * 3;
  }

  return Math.round(watts);
}

export function PowerUsage({ state }: { state: PrinterState | undefined }) {
  if (!state) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Zap className="h-3.5 w-3.5" />
        <span>—</span>
      </div>
    );
  }
  const watts = estimateWatts(state);
  const tier = watts < 50 ? 'low' : watts < 200 ? 'mid' : 'high';
  const color = {
    low: 'text-emerald-400',
    mid: 'text-amber-400',
    high: 'text-red-400',
  }[tier];

  return (
    <div className="flex items-center gap-1.5">
      <Zap className={cn('h-3.5 w-3.5', color)} />
      <span className={cn('text-sm font-semibold tabular-nums', color)}>{watts}W</span>
    </div>
  );
}

import type { OnboardingEventType } from '@printstudio/shared';
import { cn } from '@/lib/utils';

const FUNNEL_ORDER: Array<{
  key: OnboardingEventType;
  label: string;
  /** Group: barras com mesmo grupo são alternativas mutuamente exclusivas. */
  group?: number;
}> = [
  { key: 'signup_completed', label: 'Signup completo' },
  { key: 'profile_completed', label: 'Perfil completo' },
  { key: 'bambu_completed', label: 'Bambu vinculado', group: 1 },
  { key: 'bambu_skipped', label: 'Bambu pulado', group: 1 },
  { key: 'printers_added', label: 'Impressoras adicionadas', group: 2 },
  { key: 'printers_skipped', label: 'Impressoras puladas', group: 2 },
];

interface FunnelChartProps {
  data: Array<{ event: OnboardingEventType; count: number }>;
}

/**
 * Funil de onboarding visual (Story 9.8). Custom barras horizontais
 * em vez de recharts pra zero bundle extra. Cada evento mostra:
 * - Label + count
 * - Barra proporcional ao step anterior (drop-off visualizável)
 * - % conversion entre step anterior
 *
 * Alternativas (bambu_completed vs bambu_skipped) ficam lado-a-lado
 * com cores distintas (primary vs warning).
 */
export function FunnelChart({ data }: FunnelChartProps) {
  const counts = new Map(data.map((d) => [d.event, d.count]));
  const totalSignups = counts.get('signup_completed') ?? 0;

  return (
    <div className="space-y-3">
      {FUNNEL_ORDER.map((step) => {
        const count = counts.get(step.key) ?? 0;
        const pct = totalSignups > 0 ? (count / totalSignups) * 100 : 0;
        const isSkip = step.key.endsWith('skipped');
        return (
          <div key={step.key} className="space-y-1">
            <div className="flex items-center justify-between text-caption">
              <span
                className={cn(
                  'uppercase tracking-wider',
                  isSkip ? 'text-warning' : 'text-foreground',
                )}
              >
                {step.label}
              </span>
              <span className="font-mono text-muted-foreground">
                <span data-mc-num className="font-medium text-foreground">
                  {count}
                </span>
                {totalSignups > 0 && (
                  <>
                    {' '}
                    · <span data-mc-num>{pct.toFixed(1)}%</span>
                  </>
                )}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-card/40">
              <div
                className={cn(
                  'h-full transition-all',
                  isSkip ? 'bg-warning/60' : 'bg-primary',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      {totalSignups === 0 && (
        <p
          data-mc-id
          className="pt-2 text-caption font-mono uppercase tracking-wider text-muted-foreground"
        >
          {'// NO DATA · NEED SIGNUP EVENTS'}
        </p>
      )}
    </div>
  );
}

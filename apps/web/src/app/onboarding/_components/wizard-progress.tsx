import { Check } from 'lucide-react';
import type { OnboardingStep } from '@printstudio/shared';
import { cn } from '@/lib/utils';

const STEPS: { id: OnboardingStep; label: string; num: string }[] = [
  { id: 'profile', label: 'Perfil', num: '01' },
  { id: 'bambu_connect', label: 'Bambu', num: '02' },
  { id: 'printers', label: 'Impressoras', num: '03' },
];

const STEP_INDEX: Record<OnboardingStep, number> = {
  profile: 0,
  bambu_connect: 1,
  printers: 2,
};

interface WizardProgressProps {
  current: OnboardingStep;
}

/**
 * Indicador visual de progresso do wizard (3 steps). Mostra steps
 * concluídos com check, atual com dot pulsante, restantes apagados.
 */
export function WizardProgress({ current }: WizardProgressProps) {
  const currentIndex = STEP_INDEX[current];

  return (
    <nav aria-label="Progresso do onboarding" className="mb-8">
      <ol className="flex items-center gap-2 sm:gap-4">
        {STEPS.map((step, i) => {
          const completed = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li
              key={step.id}
              className={cn(
                'flex flex-1 items-center gap-2',
                i < STEPS.length - 1 && 'after:hidden sm:after:block sm:after:h-px sm:after:flex-1 sm:after:bg-[var(--mc-accent-soft)]/30',
              )}
              aria-current={active ? 'step' : undefined}
            >
              <span
                className={cn(
                  'inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-caption font-mono',
                  completed && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary bg-primary/10 text-primary',
                  !completed && !active && 'border-input text-muted-foreground',
                )}
                aria-hidden="true"
              >
                {completed ? (
                  <Check className="size-3.5" />
                ) : active ? (
                  <span className="size-2 animate-pulse rounded-full bg-primary" />
                ) : (
                  step.num
                )}
              </span>
              <span
                className={cn(
                  'text-caption uppercase tracking-wider',
                  active ? 'text-foreground font-semibold' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

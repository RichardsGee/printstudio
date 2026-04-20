'use client';

import { AlertTriangle, AlertCircle, AlertOctagon, Info } from 'lucide-react';
import type { HmsError } from '@printstudio/shared';
import { lookupHmsCode } from '@printstudio/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const SEVERITY_CONFIG: Record<
  HmsError['severity'],
  { label: string; className: string; icon: typeof AlertTriangle }
> = {
  info: {
    label: 'Informativo',
    className: 'border-border/60 bg-muted/30',
    icon: Info,
  },
  warning: {
    label: 'Aviso',
    className: 'border-amber-500/50 bg-amber-500/10 text-amber-200',
    icon: AlertTriangle,
  },
  error: {
    label: 'Erro',
    className: 'border-orange-500/60 bg-orange-500/10 text-orange-200',
    icon: AlertCircle,
  },
  fatal: {
    label: 'Crítico',
    className: 'border-red-500/70 bg-red-500/15 text-red-200',
    icon: AlertOctagon,
  },
};

const ORDER: HmsError['severity'][] = ['fatal', 'error', 'warning', 'info'];

export function HmsErrorsCard({ errors }: { errors: HmsError[] }) {
  if (!errors || errors.length === 0) return null;

  const sorted = [...errors].sort(
    (a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity),
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          Alertas ({errors.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {sorted.map((err, i) => {
            const info = lookupHmsCode(err.code);
            const cfg = SEVERITY_CONFIG[err.severity];
            const Icon = cfg.icon;
            return (
              <li
                key={`${err.code}-${i}`}
                className={cn('rounded-md border px-3 py-2 flex gap-2.5', cfg.className)}
              >
                <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {info?.title ?? err.message ?? 'Erro desconhecido'}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {err.code}
                    </span>
                  </div>
                  {info?.hint ? (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {info.hint}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

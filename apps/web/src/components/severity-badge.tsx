import { Badge } from '@/components/ui/badge';
import { Info, AlertTriangle, OctagonAlert } from 'lucide-react';
import type { EventSeverity } from '@printstudio/shared';

/**
 * Tags técnicas estilo telemetria pra severity de eventos.
 * Convenção: INFO → [INFO], WARN → [WARN], ERROR → [ERR].
 */
const LABELS: Record<EventSeverity, string> = {
  INFO: '[INFO]',
  WARN: '[WARN]',
  ERROR: '[ERR]',
};

const VARIANTS: Record<
  EventSeverity,
  'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'
> = {
  INFO: 'secondary',
  WARN: 'warning',
  ERROR: 'destructive',
};

const ICONS: Record<EventSeverity, React.ElementType> = {
  INFO: Info,
  WARN: AlertTriangle,
  ERROR: OctagonAlert,
};

export function SeverityBadge({ severity }: { severity: EventSeverity }) {
  const Icon = ICONS[severity];
  return (
    <Badge variant={VARIANTS[severity]} className="gap-1.5 font-mono tracking-wider">
      <Icon className="h-3 w-3" />
      {LABELS[severity]}
    </Badge>
  );
}

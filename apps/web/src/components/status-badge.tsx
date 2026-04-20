import { Badge } from '@/components/ui/badge';
import type { PrinterStatus } from '@printstudio/shared';
import {
  Printer,
  Pause,
  CheckCircle2,
  AlertTriangle,
  CloudOff,
  Circle,
  Loader2,
} from 'lucide-react';

const LABELS: Record<PrinterStatus, string> = {
  IDLE: 'Ocioso',
  PREPARE: 'Preparando',
  PRINTING: 'Imprimindo',
  PAUSED: 'Pausado',
  FINISH: 'Concluído',
  FAILED: 'Falhou',
  OFFLINE: 'Offline',
  UNKNOWN: 'Desconhecido',
};

const VARIANTS: Record<
  PrinterStatus,
  'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'
> = {
  IDLE: 'secondary',
  PREPARE: 'warning',
  PRINTING: 'success',
  PAUSED: 'warning',
  FINISH: 'success',
  FAILED: 'destructive',
  OFFLINE: 'outline',
  UNKNOWN: 'outline',
};

const ICONS: Record<PrinterStatus, React.ElementType> = {
  IDLE: Circle,
  PREPARE: Loader2,
  PRINTING: Printer,
  PAUSED: Pause,
  FINISH: CheckCircle2,
  FAILED: AlertTriangle,
  OFFLINE: CloudOff,
  UNKNOWN: Circle,
};

export function StatusBadge({ status }: { status: PrinterStatus }) {
  const Icon = ICONS[status];
  const spin = status === 'PREPARE';
  return (
    <Badge variant={VARIANTS[status]} className="gap-1.5">
      <Icon className={`h-3 w-3 ${spin ? 'animate-spin' : ''}`} />
      {LABELS[status]}
    </Badge>
  );
}

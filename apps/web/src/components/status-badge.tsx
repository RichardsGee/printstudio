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

/**
 * Tags técnicas estilo telemetria — substituem nomes humanizados
 * ("Imprimindo", "Concluído") por convenção de painel de comando.
 * Sincronizado com STATUS_LABELS de kiosk-printer-card.tsx.
 */
const LABELS: Record<PrinterStatus, string> = {
  IDLE: '[STBY]',
  PREPARE: '[BOOT]',
  PRINTING: '[ACTIVE]',
  PAUSED: '[HOLD]',
  FINISH: '[OK]',
  FAILED: '[ERR]',
  OFFLINE: '[NO-LINK]',
  UNKNOWN: '[?]',
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
    <Badge variant={VARIANTS[status]} className="gap-1.5 font-mono tracking-wider">
      <Icon className={`h-3 w-3 ${spin ? 'animate-spin' : ''}`} />
      {LABELS[status]}
    </Badge>
  );
}

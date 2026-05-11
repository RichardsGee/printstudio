import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertTriangle, Ban } from 'lucide-react';

type JobStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

/**
 * Tags técnicas estilo telemetria pra status de print jobs (histórico).
 * Convenção: RUNNING → [ACTIVE], SUCCESS → [OK], FAILED → [ERR], CANCELLED → [ABORT].
 */
const LABELS: Record<JobStatus, string> = {
  RUNNING: '[ACTIVE]',
  SUCCESS: '[OK]',
  FAILED: '[ERR]',
  CANCELLED: '[ABORT]',
};

const VARIANTS: Record<
  JobStatus,
  'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'
> = {
  RUNNING: 'warning',
  SUCCESS: 'success',
  FAILED: 'destructive',
  CANCELLED: 'outline',
};

const ICONS: Record<JobStatus, React.ElementType> = {
  RUNNING: Loader2,
  SUCCESS: CheckCircle2,
  FAILED: AlertTriangle,
  CANCELLED: Ban,
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const Icon = ICONS[status];
  const spin = status === 'RUNNING';
  return (
    <Badge variant={VARIANTS[status]} className="gap-1.5 font-mono tracking-wider">
      <Icon className={`h-3 w-3 ${spin ? 'animate-spin' : ''}`} />
      {LABELS[status]}
    </Badge>
  );
}

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(totalSec: number | null | undefined): string {
  if (totalSec == null || totalSec < 0) return '—';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Returns the wall-clock time when `remainingSec` from now elapses. */
export function formatEtaClock(remainingSec: number | null | undefined): string {
  if (remainingSec == null || remainingSec < 0) return '—';
  const eta = new Date(Date.now() + remainingSec * 1000);
  return eta.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

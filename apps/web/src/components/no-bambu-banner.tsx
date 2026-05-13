import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { getCurrentOrgBambuStatus } from '@/lib/current-org';

/**
 * Banner persistente lembrando user de vincular Bambu (Story 8.7).
 *
 * Aparece quando:
 * - User tem session
 * - org.onboarding_step !== 'done' (pulou ou está incompleto)
 * - org.printerCount === 0 (nenhuma impressora cadastrada)
 *
 * Renderiza `null` caso contrário. Server Component → re-render
 * automático após user vincular e cadastrar impressora.
 *
 * Decisão de produto: NÃO dismissível V1 — UX deliberadamente
 * persistente até user resolver. V1.1 pode adicionar cooldown.
 */
export async function NoBambuBanner() {
  const status = await getCurrentOrgBambuStatus();
  if (!status?.needsBambuBanner) return null;

  return (
    <div
      data-mc-banner
      role="status"
      className="border-b border-warning/40 bg-warning/15"
    >
      <div className="container flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 sm:items-center">
          <AlertTriangle
            className="size-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <div className="space-y-0.5">
            <p
              data-mc-id
              className="text-caption font-mono uppercase tracking-wider text-warning"
            >
              {'// BAMBU · NOT-CONNECTED'}
            </p>
            <p className="text-small">
              Sua conta não tem impressora vinculada. Conecte sua Bambu
              Cloud pra começar a monitorar.
            </p>
          </div>
        </div>
        <Link
          href="/settings/bambu-connect"
          className="inline-flex items-center gap-1.5 self-start rounded-md border border-warning/40 bg-background px-3 py-1.5 text-caption font-medium uppercase tracking-wider text-warning transition-colors hover:bg-warning/10 sm:self-auto"
        >
          Conectar agora
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

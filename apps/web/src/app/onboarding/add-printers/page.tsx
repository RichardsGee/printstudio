import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { BambuDevice } from '@printstudio/shared';
import { requireCurrentOrg } from '@/lib/current-org';
import { getApiBaseServer } from '@/lib/api-base';
import { AddPrintersClient } from './add-printers-client';

export const metadata: Metadata = {
  title: 'Onboarding · Impressoras · PrintStudio',
  robots: { index: false, follow: false },
};

interface DevicesPayload {
  devices: BambuDevice[];
}

/**
 * Busca devices Bambu da org via endpoint do apps/api. Encaminha o
 * cookie de sessão pra autenticar a request.
 *
 * Retorna `null` em qualquer erro (rede, 4xx, 5xx) — UI mostra
 * estado vazio com retry/skip.
 */
async function loadDevices(): Promise<BambuDevice[] | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
    const url = `${getApiBaseServer()}/api/bambu/devices`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });
    if (!res.ok) return null;
    const body = (await res.json()) as DevicesPayload;
    return Array.isArray(body.devices) ? body.devices : null;
  } catch {
    return null;
  }
}

/**
 * Step 3 do wizard — Add Printers (Story 8.5).
 *
 * Server Component carrega org + devices Bambu. Free tier (default
 * 'free') força UI radio (max 1 selecionado). Empty state se 0
 * devices vinculadas à conta Bambu.
 */
export default async function OnboardingAddPrintersPage() {
  const org = await requireCurrentOrg();
  const devices = await loadDevices();

  return (
    <AddPrintersClient
      devices={devices ?? []}
      loadFailed={devices === null}
      plan={org.plan}
    />
  );
}

import type { Metadata } from 'next';
import { SignupClient } from './signup-client';
import { getApiBaseServer } from '@/lib/api-base';

export const metadata: Metadata = {
  title: 'Criar conta · PrintStudio',
  description: 'Crie sua conta no PrintStudio.',
  robots: { index: false, follow: false },
};

interface PrefillData {
  name: string;
  email: string;
}

type InviteStatus =
  | { status: 'ok'; prefill: PrefillData }
  | { status: 'not_found' }
  | { status: 'used' }
  | { status: 'expired' }
  | { status: 'error' };

/**
 * Resolve o invite token via endpoint público da API (Story 8.9).
 *
 * Status codes:
 * - 200: prefill OK
 * - 404 INVITE_NOT_FOUND: token nunca existiu
 * - 410 INVITE_USED: token já foi consumido por outro signup
 * - 410 INVITE_EXPIRED: token passou da expires_at
 *
 * UI usa o status pra mostrar mensagem específica (sem bloquear signup).
 */
async function resolveInvite(token: string): Promise<InviteStatus> {
  try {
    const url = `${getApiBaseServer()}/api/public/invite/${encodeURIComponent(token)}`;
    const res = await fetch(url, { cache: 'no-store' });

    if (res.ok) {
      const body = (await res.json()) as { ok?: boolean; prefill?: PrefillData };
      if (body.ok && body.prefill) {
        return { status: 'ok', prefill: body.prefill };
      }
      return { status: 'error' };
    }

    if (res.status === 404) return { status: 'not_found' };
    if (res.status === 410) {
      const body = (await res.json().catch(() => null)) as {
        error?: { code?: string };
      } | null;
      if (body?.error?.code === 'INVITE_USED') return { status: 'used' };
      return { status: 'expired' };
    }
    return { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}

/**
 * Página `/signup` (Story 8.1).
 *
 * Server Component que resolve invite token (se vier) e renderiza o
 * SignupClient com pre-fill opcional. Robots noindex,nofollow.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const params = await searchParams;
  const rawInvite = params.invite?.trim();
  const inviteToken = rawInvite && rawInvite.length > 0 ? rawInvite : undefined;

  const invite = inviteToken ? await resolveInvite(inviteToken) : null;

  // Pre-fill só rola se status === 'ok'. Em 'used'/'expired'/'not_found'
  // o signup procede normal — UI mostra hint do problema.
  const prefill = invite?.status === 'ok' ? invite.prefill : undefined;
  const inviteWarning =
    invite?.status === 'expired'
      ? 'O convite expirou — você pode criar conta mesmo assim.'
      : invite?.status === 'used'
        ? 'Esse convite já foi usado — você pode criar conta mesmo assim.'
        : invite?.status === 'not_found'
          ? 'Convite não encontrado — você pode criar conta mesmo assim.'
          : undefined;

  return (
    <SignupClient
      inviteToken={inviteToken}
      prefill={prefill}
      inviteWarning={inviteWarning}
    />
  );
}

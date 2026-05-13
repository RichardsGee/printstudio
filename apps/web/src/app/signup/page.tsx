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

/**
 * Resolve o invite token via endpoint público da API. Se válido, retorna
 * `{ name, email }` da waitlist linked. Falha silenciosa — token inválido
 * apenas não pre-popula (não bloqueia signup).
 */
async function resolveInvite(token: string): Promise<PrefillData | null> {
  try {
    const url = `${getApiBaseServer()}/api/public/invite/${encodeURIComponent(token)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { ok?: boolean; prefill?: PrefillData };
    if (!body.ok || !body.prefill) return null;
    return body.prefill;
  } catch {
    return null;
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

  const prefill = inviteToken ? await resolveInvite(inviteToken) : null;

  return (
    <SignupClient inviteToken={inviteToken} prefill={prefill ?? undefined} />
  );
}

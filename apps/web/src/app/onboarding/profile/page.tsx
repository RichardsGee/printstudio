import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { createDb, waitlist } from '@printstudio/db';
import { BR_STATES, type WaitlistRole, type BrazilState } from '@printstudio/shared';
import { requireCurrentOrg } from '@/lib/current-org';
import { ProfileForm } from './profile-form';

export const metadata: Metadata = {
  title: 'Onboarding · Perfil · PrintStudio',
  robots: { index: false, follow: false },
};

interface ProfilePrefill {
  orgName: string;
  state?: BrazilState;
  city?: string;
  role?: WaitlistRole;
}

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return createDb(url);
}

const BR_STATE_SET: ReadonlySet<string> = new Set(BR_STATES);

function isBrazilState(value: string | null): value is BrazilState {
  return value !== null && BR_STATE_SET.has(value);
}

const ROLE_SET = new Set([
  'hobbyist',
  'small_shop',
  'studio',
  'business',
  'other',
]);

function isWaitlistRole(value: string | null): value is WaitlistRole {
  return value !== null && ROLE_SET.has(value);
}

/**
 * Carrega valores pre-fill priorizando dados já gravados na org (caso
 * o user volte ao step depois de editar) e caindo na waitlist linked
 * se org veio de invite.
 */
async function loadPrefill(orgSummary: Awaited<ReturnType<typeof requireCurrentOrg>>): Promise<ProfilePrefill> {
  const base: ProfilePrefill = {
    orgName: orgSummary.name,
  };
  if (isBrazilState(orgSummary.state)) base.state = orgSummary.state;
  if (orgSummary.city) base.city = orgSummary.city;
  if (isWaitlistRole(orgSummary.role)) base.role = orgSummary.role;

  // Se org já tem dados salvos, prioriza eles. Senão tenta puxar do
  // waitlist linked.
  const needsFill = !base.state || !base.role;
  if (needsFill && orgSummary.waitlistId) {
    try {
      const rows = await getDb()
        .select({
          state: waitlist.state,
          city: waitlist.city,
          role: waitlist.role,
        })
        .from(waitlist)
        .where(eq(waitlist.id, orgSummary.waitlistId))
        .limit(1);
      const w = rows[0];
      if (w) {
        if (!base.state && isBrazilState(w.state)) base.state = w.state;
        if (!base.city && w.city) base.city = w.city;
        if (!base.role && isWaitlistRole(w.role)) base.role = w.role;
      }
    } catch {
      // Pre-fill é best-effort — falha silenciosa.
    }
  }

  return base;
}

/**
 * Step 1 do wizard — Perfil (Story 8.3).
 *
 * Server Component carrega org corrente + pre-fill (waitlist linked
 * se vier de invite). O layout pai (`onboarding/layout.tsx`) já
 * validou session e step correto antes desta render rodar.
 */
export default async function OnboardingProfilePage() {
  const org = await requireCurrentOrg();
  const prefill = await loadPrefill(org);

  return <ProfileForm prefill={prefill} fromInvite={org.waitlistId !== null} />;
}

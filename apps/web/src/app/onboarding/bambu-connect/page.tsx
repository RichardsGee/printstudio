import type { Metadata } from 'next';
import { BambuOnboardingClient } from './bambu-onboarding-client';

export const metadata: Metadata = {
  title: 'Onboarding · Conectar Bambu · PrintStudio',
  robots: { index: false, follow: false },
};

/**
 * Step 2 do wizard — Bambu Connect (Story 8.4).
 *
 * Layout pai já validou session + step. Esta página renderiza só o
 * Client Component que combina WizardProgress + BambuConnectFlow
 * (reutilizado de `/settings/bambu-connect`) + skip dialog.
 */
export default function OnboardingBambuConnectPage() {
  return <BambuOnboardingClient />;
}

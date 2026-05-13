import { z } from 'zod';
import { BrazilStateSchema, WaitlistRoleSchema } from './waitlist.js';

/**
 * Schemas compartilhados do onboarding wizard (Stories 8.3 / 8.4 / 8.5).
 *
 * O wizard tem 3 steps com state machine em `organizations.onboarding_step`:
 *   profile → bambu_connect → printers → (completed)
 */

export const OnboardingStepSchema = z.enum([
  'profile',
  'bambu_connect',
  'printers',
]);
export type OnboardingStep = z.infer<typeof OnboardingStepSchema>;

/**
 * Step 1 — Perfil da organização. Coleta qualificação obrigatória pro
 * Admin Panel (Epic 9) e personalização inicial. Reusa `BrazilStateSchema`
 * e `WaitlistRoleSchema` pra manter consistência com o waitlist.
 */
export const OrgProfileSchema = z.object({
  orgName: z
    .string()
    .trim()
    .min(2, 'Nome da organização muito curto')
    .max(100, 'Nome da organização muito longo'),
  state: BrazilStateSchema,
  city: z.string().trim().max(100).optional().or(z.literal('')),
  role: WaitlistRoleSchema,
});
export type OrgProfileInput = z.infer<typeof OrgProfileSchema>;

/**
 * Error codes consistentes nas server actions do onboarding.
 */
export type OnboardingErrorCode =
  | 'INVALID_PAYLOAD'
  | 'UNAUTHORIZED'
  | 'WRONG_STEP'
  | 'INTERNAL_ERROR';

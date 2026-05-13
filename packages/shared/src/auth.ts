import { z } from 'zod';

/**
 * Schemas compartilhados de autenticação — Story 8.1 + 8.2.
 *
 * - SignupSchema: payload do POST /api/auth/signup (form `/signup`)
 * - Password policy: min 12 chars + maiúscula + número + especial
 */

const PASSWORD_RULES = {
  minLength: 12,
  upper: /[A-Z]/,
  digit: /[0-9]/,
  // Cobre os símbolos mais comuns sem exigir teclado específico
  special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/,
} as const;

const PasswordSchema = z
  .string()
  .min(PASSWORD_RULES.minLength, {
    message: `Senha precisa de pelo menos ${PASSWORD_RULES.minLength} caracteres`,
  })
  .max(200, 'Senha muito longa')
  .refine((val) => PASSWORD_RULES.upper.test(val), {
    message: 'Senha precisa de pelo menos 1 letra maiúscula',
  })
  .refine((val) => PASSWORD_RULES.digit.test(val), {
    message: 'Senha precisa de pelo menos 1 número',
  })
  .refine((val) => PASSWORD_RULES.special.test(val), {
    message: 'Senha precisa de pelo menos 1 caractere especial',
  });

export const SignupSchema = z
  .object({
    name: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo'),
    email: z.string().trim().toLowerCase().email('Email inválido').max(200),
    password: PasswordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'Você precisa aceitar os termos' }),
    }),
    inviteToken: z.string().trim().min(1).max(200).optional(),
    // Honeypot — mesmo padrão do waitlist (Story 7.3).
    website: z.string().max(500).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  });
export type SignupInput = z.infer<typeof SignupSchema>;

/**
 * Error codes consistentes do endpoint signup + service createUserWithOrg.
 * Mantidos em sync com a UI de erro do form de signup (Story 8.1).
 */
export type SignupErrorCode =
  | 'INVALID_PAYLOAD'
  | 'EMAIL_EXISTS'
  | 'INVITE_INVALID'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

/**
 * Response do signup bem-sucedido. Cookie de sessão é set pela response,
 * o body só serve pra UI saber pra onde redirecionar.
 */
export const SignupResponseSchema = z.object({
  ok: z.literal(true),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable(),
  }),
  organization: z.object({
    id: z.string().uuid(),
    name: z.string(),
    onboardingStep: z.string(),
  }),
});
export type SignupResponse = z.infer<typeof SignupResponseSchema>;

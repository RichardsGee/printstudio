import { z } from 'zod';

/**
 * Schemas compartilhados pro waitlist (Story 7.3).
 * Usado pelo client (form na landing — story 7.2) e server (endpoint API).
 *
 * Decisões fechadas (PRD 7):
 * - Honeypot field `website` invisible — bots preenchem, humanos não
 * - Email lowercase + UNIQUE no DB
 * - Bambu count em ranges (1/2-3/4-10/11+) mas armazenado como integer
 *   (range médio: 1=1, 2-3=2, 4-10=7, 11+=15)
 */

export const WaitlistRoleSchema = z.enum([
  'hobbyist',
  'small_shop',
  'studio',
  'business',
  'other',
]);
export type WaitlistRole = z.infer<typeof WaitlistRoleSchema>;

export const WaitlistBambuCountRangeSchema = z.enum(['1', '2-3', '4-10', '11+']);
export type WaitlistBambuCountRange = z.infer<typeof WaitlistBambuCountRangeSchema>;

// Map range → integer médio armazenado no DB
export const BAMBU_COUNT_FROM_RANGE: Record<WaitlistBambuCountRange, number> = {
  '1': 1,
  '2-3': 2,
  '4-10': 7,
  '11+': 15,
};

// Brazil UF list (27 estados + DF)
export const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
export const BrazilStateSchema = z.enum(BR_STATES);
export type BrazilState = z.infer<typeof BrazilStateSchema>;

// UTM params opcionais
export const UtmParamsSchema = z.object({
  utm_source: z.string().max(200).optional(),
  utm_medium: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(),
  utm_term: z.string().max(200).optional(),
}).optional();
export type UtmParams = z.infer<typeof UtmParamsSchema>;

/**
 * Payload do POST /api/public/waitlist
 * Validado client-side (form) + server-side (endpoint).
 */
export const WaitlistSubmitSchema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo'),
  email: z.string().trim().toLowerCase().email('Email inválido').max(200),
  bambuCount: WaitlistBambuCountRangeSchema,
  role: WaitlistRoleSchema.default('other'),
  state: BrazilStateSchema.optional(),
  city: z.string().trim().max(100).optional(),
  telegramHandle: z.string().trim().max(50).optional(),
  phone: z.string().trim().max(20).optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Você precisa aceitar os termos' }),
  }),
  // Honeypot — qualquer valor preenchido = bot. Server retorna 200 fake.
  // Aceita string longa pra capturar tudo que bots tentam jogar.
  website: z.string().max(500).optional(),
  // UTM params capturados do client via useSearchParams
  utm: UtmParamsSchema,
  referrer: z.string().max(500).optional(),
}).strict();
export type WaitlistSubmitInput = z.infer<typeof WaitlistSubmitSchema>;

/**
 * Response do submit bem-sucedido.
 */
export const WaitlistSubmitResponseSchema = z.object({
  ok: z.literal(true),
  id: z.string().uuid(),
  position: z.number().int().positive().optional(),
});
export type WaitlistSubmitResponse = z.infer<typeof WaitlistSubmitResponseSchema>;

/**
 * Error codes consistentes do endpoint.
 */
export type WaitlistErrorCode =
  | 'INVALID_PAYLOAD'      // 400 — falhou validação
  | 'EMAIL_ALREADY_EXISTS' // 409 — duplicate
  | 'RATE_LIMITED'         // 429 — muitos cadastros do mesmo IP
  | 'INTERNAL_ERROR';      // 500

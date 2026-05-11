import { z } from 'zod';

/**
 * Schemas pro fluxo de conectar conta Bambu Cloud (Story 4.4).
 *
 * O fluxo é em 2 passos:
 *   1. POST /api/bambu/send-code { email } → api dispara código via Bambu
 *   2. POST /api/bambu/verify-code { email, code } → api faz login,
 *      encripta o JWT, persiste em bambu_credentials, e devolve a lista
 *      de impressoras detectadas pra UI mostrar.
 */

export const BambuSendCodeRequestSchema = z.object({
  email: z.string().email('Email inválido'),
});
export type BambuSendCodeRequest = z.infer<typeof BambuSendCodeRequestSchema>;

export const BambuVerifyCodeRequestSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, 'Código deve ter 6 dígitos'),
});
export type BambuVerifyCodeRequest = z.infer<typeof BambuVerifyCodeRequestSchema>;

/**
 * Subset do que o endpoint Bambu /user/bind devolve. Mantemos só os
 * campos relevantes pra UI mostrar pro usuário escolher.
 */
export const BambuDeviceSchema = z.object({
  serial: z.string(),
  name: z.string(),
  model: z.string(),
  online: z.boolean(),
  // Importante: NÃO incluímos dev_access_code aqui — quem usa cloud não
  // precisa, e nem queremos vazar pro frontend.
});
export type BambuDevice = z.infer<typeof BambuDeviceSchema>;

export const BambuVerifyCodeResponseSchema = z.object({
  organizationId: z.string().uuid(),
  bambuEmail: z.string(),
  bambuUserId: z.string(),
  devices: z.array(BambuDeviceSchema),
});
export type BambuVerifyCodeResponse = z.infer<typeof BambuVerifyCodeResponseSchema>;

/**
 * Erros possíveis (códigos discriminados) retornados pela api.
 * UI usa pra dar mensagem específica em cada caso.
 */
/**
 * Status atual da conexão Bambu da organização do user (GET /api/bambu/status).
 */
export const BambuConnectionStatusSchema = z.discriminatedUnion('connected', [
  z.object({
    connected: z.literal(false),
  }),
  z.object({
    connected: z.literal(true),
    bambuEmail: z.string(),
    bambuUserId: z.string(),
    expiresAt: z.string(), // ISO
    lastSyncedAt: z.string().nullable(),
  }),
]);
export type BambuConnectionStatus = z.infer<typeof BambuConnectionStatusSchema>;

export const BambuErrorCodeSchema = z.enum([
  'BAMBU_VERIFY_REQUIRED', // login retornou loginType: verifyCode (sem code passado)
  'BAMBU_TFA_REQUIRED', // login retornou loginType: tfa (2FA, não suportado)
  'BAMBU_INVALID_CODE', // código de email errado/expirado
  'BAMBU_RATE_LIMITED', // 429 da Bambu
  'BAMBU_UPSTREAM_ERROR', // outros HTTP errors da Bambu
  'INTERNAL_ERROR',
]);
export type BambuErrorCode = z.infer<typeof BambuErrorCodeSchema>;

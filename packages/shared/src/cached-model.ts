import { z } from 'zod';

/**
 * Schemas pro fluxo de upload .3mf vinculado ao bambu_model_id
 * (Story 4.8).
 *
 * Client parseia o .3mf com Three.js ThreeMFLoader e envia o mesh
 * já em formato vertices/indices — server não parseia .3mf nativamente.
 */

export const MeshPayloadSchema = z.object({
  vertices: z.array(z.number()),
  indices: z.array(z.number()),
});
export type MeshPayload = z.infer<typeof MeshPayloadSchema>;

export const CachedModelUploadRequestSchema = z.object({
  bambuModelId: z.string().min(1).max(64),
  plateIndex: z.number().int().positive().default(1),
  filename: z.string().min(1).max(256),
  sizeBytes: z.number().int().nonnegative(),
  meshPayload: MeshPayloadSchema,
});
export type CachedModelUploadRequest = z.infer<typeof CachedModelUploadRequestSchema>;

export const CachedModelResponseSchema = z.object({
  id: z.string().uuid(),
  bambuModelId: z.string(),
  plateIndex: z.number().int(),
  filename: z.string(),
  sizeBytes: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CachedModelResponse = z.infer<typeof CachedModelResponseSchema>;

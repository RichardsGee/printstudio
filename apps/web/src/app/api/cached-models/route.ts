/**
 * POST /api/cached-models — upload de mesh 3D pré-parseado.
 *
 * Client envia o JSON (vertices+indices) já extraído do .3mf via
 * Three.js ThreeMFLoader. Server só persiste em cached_models, vinculado
 * ao bambu_model_id da org do user.
 *
 * Upsert por (org, bambu_model_id) — re-upload do mesmo modelo
 * substitui o anterior.
 */

import { NextResponse } from 'next/server';
import { cachedModels } from '@printstudio/db';
import {
  CachedModelUploadRequestSchema,
  type CachedModelResponse,
} from '@printstudio/shared';
import { getDb, getSessionUser, resolveUserOrganizationId } from '@/lib/bambu-api-helpers';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CachedModelUploadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const organizationId = await resolveUserOrganizationId(user.id);
  if (!organizationId) {
    return NextResponse.json({ error: 'no organization' }, { status: 500 });
  }

  const { bambuModelId, plateIndex, filename, sizeBytes, meshPayload } = parsed.data;
  const now = new Date();

  const inserted = await getDb()
    .insert(cachedModels)
    .values({
      organizationId,
      bambuModelId,
      plateIndex,
      filename,
      sizeBytes,
      meshPayload,
    })
    .onConflictDoUpdate({
      target: [cachedModels.organizationId, cachedModels.bambuModelId, cachedModels.plateIndex],
      set: {
        filename,
        sizeBytes,
        meshPayload,
        updatedAt: now,
      },
    })
    .returning();

  const row = inserted[0]!;
  const response: CachedModelResponse = {
    id: row.id,
    bambuModelId: row.bambuModelId,
    plateIndex: row.plateIndex,
    filename: row.filename,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  return NextResponse.json(response);
}

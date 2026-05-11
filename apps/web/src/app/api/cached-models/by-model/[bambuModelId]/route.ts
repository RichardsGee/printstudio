/**
 * GET /api/cached-models/by-model/{bambuModelId}
 *
 * Retorna o mesh JSON (vertices+indices) cached pra esse modelo Bambu
 * na org do user. Usado pelo RealisticPreview3D quando current print
 * tem currentBambuModelId conhecido.
 *
 * 404 se nada cached — UI faz fallback pro pick_1.png da Bambu Cloud.
 */

import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { cachedModels } from '@printstudio/db';
import { getDb, getSessionUser, resolveUserOrganizationId } from '@/lib/bambu-api-helpers';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bambuModelId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const organizationId = await resolveUserOrganizationId(user.id);
  if (!organizationId) {
    return NextResponse.json({ error: 'no organization' }, { status: 500 });
  }

  const { bambuModelId } = await params;
  const url = new URL(req.url);
  const plateParam = url.searchParams.get('plate');
  const plateIndex = plateParam ? parseInt(plateParam, 10) : 1;
  if (!Number.isFinite(plateIndex) || plateIndex < 1) {
    return NextResponse.json({ error: 'invalid plate' }, { status: 400 });
  }

  const rows = await getDb()
    .select({
      id: cachedModels.id,
      plateIndex: cachedModels.plateIndex,
      filename: cachedModels.filename,
      sizeBytes: cachedModels.sizeBytes,
      meshPayload: cachedModels.meshPayload,
    })
    .from(cachedModels)
    .where(
      and(
        eq(cachedModels.organizationId, organizationId),
        eq(cachedModels.bambuModelId, bambuModelId),
        eq(cachedModels.plateIndex, plateIndex),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: 'not cached' }, { status: 404 });
  }

  return NextResponse.json({
    id: row.id,
    plateIndex: row.plateIndex,
    filename: row.filename,
    sizeBytes: row.sizeBytes,
    meshPayload: row.meshPayload,
  });
}

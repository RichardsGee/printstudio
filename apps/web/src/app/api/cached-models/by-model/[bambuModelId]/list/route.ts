/**
 * GET /api/cached-models/by-model/{bambuModelId}/list
 *
 * Lista todos os plates cached desse modelo na org. UI usa pra decidir
 * se mostra "Vincular" (vazio) ou "Substituir/Remover" (já tem).
 */

import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { cachedModels } from '@printstudio/db';
import { getDb, getSessionUser, resolveUserOrganizationId } from '@/lib/bambu-api-helpers';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bambuModelId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const organizationId = await resolveUserOrganizationId(user.id);
  if (!organizationId) {
    return NextResponse.json({ error: 'no organization' }, { status: 500 });
  }

  const { bambuModelId } = await params;

  const rows = await getDb()
    .select({
      id: cachedModels.id,
      plateIndex: cachedModels.plateIndex,
      filename: cachedModels.filename,
      sizeBytes: cachedModels.sizeBytes,
      updatedAt: cachedModels.updatedAt,
    })
    .from(cachedModels)
    .where(
      and(
        eq(cachedModels.organizationId, organizationId),
        eq(cachedModels.bambuModelId, bambuModelId),
      ),
    )
    .orderBy(asc(cachedModels.plateIndex));

  return NextResponse.json({
    plates: rows.map((r) => ({
      id: r.id,
      plateIndex: r.plateIndex,
      filename: r.filename,
      sizeBytes: r.sizeBytes,
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}

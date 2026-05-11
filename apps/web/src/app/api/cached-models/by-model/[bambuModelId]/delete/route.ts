/**
 * DELETE /api/cached-models/by-model/{bambuModelId}/delete
 *
 * Remove TODOS os plates cached desse modelo na org do user.
 * Útil pra "des-vincular" um .3mf antigo antes de subir outro.
 *
 * (Nota: usa rota separada com /delete pq Next.js Route Handlers no mesmo
 * arquivo conflitam quando tem GET e DELETE no mesmo path com generated
 * types — manter separado é mais simples.)
 */

import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { cachedModels } from '@printstudio/db';
import { getDb, getSessionUser, resolveUserOrganizationId } from '@/lib/bambu-api-helpers';

export async function DELETE(
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

  const deleted = await getDb()
    .delete(cachedModels)
    .where(
      and(
        eq(cachedModels.organizationId, organizationId),
        eq(cachedModels.bambuModelId, bambuModelId),
      ),
    )
    .returning({ id: cachedModels.id, plateIndex: cachedModels.plateIndex });

  return NextResponse.json({ deletedCount: deleted.length, plates: deleted });
}

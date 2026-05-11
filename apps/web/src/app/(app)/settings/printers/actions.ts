'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { createDb, printers } from '@printstudio/db';
import { requireCurrentOrgId } from '@/lib/current-org';

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return createDb(url);
}

export async function renamePrinterAction(
  printerId: string,
  newName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = newName.trim();
  if (trimmed.length < 1) return { ok: false, error: 'Nome não pode ser vazio' };
  if (trimmed.length > 100) return { ok: false, error: 'Nome muito longo (máx 100)' };

  const orgId = await requireCurrentOrgId();
  const db = getDb();

  const [updated] = await db
    .update(printers)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(and(eq(printers.id, printerId), eq(printers.organizationId, orgId)))
    .returning({ id: printers.id });

  if (!updated) return { ok: false, error: 'Impressora não encontrada' };

  // Invalida cache em todas as rotas que mostram o nome.
  revalidatePath('/settings/printers');
  revalidatePath('/kiosk');
  revalidatePath('/dashboard');
  revalidatePath(`/printers/${printerId}`);

  return { ok: true };
}

export async function reorderPrintersAction(
  orderedIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (orderedIds.length === 0) return { ok: false, error: 'Lista vazia' };
  if (orderedIds.length > 100) return { ok: false, error: 'Muitas impressoras' };

  const orgId = await requireCurrentOrgId();
  const db = getDb();

  // Defense in depth: garante que todos os IDs pertencem à org do user.
  const ownedRows = await db
    .select({ id: printers.id })
    .from(printers)
    .where(
      and(eq(printers.organizationId, orgId), inArray(printers.id, orderedIds)),
    );
  const ownedSet = new Set(ownedRows.map((r) => r.id));
  const allOwned = orderedIds.every((id) => ownedSet.has(id));
  if (!allOwned) return { ok: false, error: 'Impressora fora da organização' };

  // Atualiza display_order com CASE WHEN — single statement, atômico.
  const cases = orderedIds
    .map((id, idx) => sql`WHEN ${id} THEN ${idx}`)
    .reduce((acc, frag) => sql`${acc} ${frag}`, sql``);

  await db
    .update(printers)
    .set({
      displayOrder: sql`CASE ${printers.id} ${cases} END`,
      updatedAt: new Date(),
    })
    .where(
      and(eq(printers.organizationId, orgId), inArray(printers.id, orderedIds)),
    );

  revalidatePath('/settings/printers');
  revalidatePath('/kiosk');
  revalidatePath('/dashboard');

  return { ok: true };
}

export async function deletePrinterAction(
  printerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const orgId = await requireCurrentOrgId();
  const db = getDb();

  const [deleted] = await db
    .delete(printers)
    .where(and(eq(printers.id, printerId), eq(printers.organizationId, orgId)))
    .returning({ id: printers.id });

  if (!deleted) return { ok: false, error: 'Impressora não encontrada' };

  revalidatePath('/settings/printers');
  revalidatePath('/kiosk');
  revalidatePath('/dashboard');

  return { ok: true };
}

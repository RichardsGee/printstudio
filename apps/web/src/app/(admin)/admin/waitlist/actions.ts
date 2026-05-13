'use server';

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createDb, waitlist } from '@printstudio/db';
import { requireSuperAdmin } from '@/lib/admin-auth';

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return createDb(url);
}

const WaitlistStatusValues = [
  'new',
  'contacted',
  'engaged',
  'invited',
  'converted',
  'lost',
] as const;
type WaitlistStatusValue = (typeof WaitlistStatusValues)[number];

const UpdateStatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(WaitlistStatusValues),
});

const UpdateNotesInput = z.object({
  id: z.string().uuid(),
  notes: z.string().max(2000),
});

const TagInput = z.object({
  id: z.string().uuid(),
  tag: z.string().trim().min(1).max(50).regex(/^[a-z0-9_-]+$/i, 'Tag inválida'),
});

const IdInput = z.object({ id: z.string().uuid() });

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function fail(message: string): ActionResult {
  return { ok: false, error: message };
}

/**
 * Atualiza o status workflow do lead. Permitidos: 6 valores do enum
 * `waitlist_status`. Story 9.9 vai gravar audit log.
 */
export async function updateWaitlistStatus(
  raw: { id: string; status: WaitlistStatusValue },
): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = UpdateStatusInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Inválido');

  try {
    await getDb()
      .update(waitlist)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(waitlist.id, parsed.data.id));
    revalidatePath('/admin/waitlist');
    return { ok: true };
  } catch {
    return fail('Erro ao atualizar status');
  }
}

/**
 * Atualiza `notes` (texto livre interno, max 2000 chars).
 */
export async function updateWaitlistNotes(
  raw: { id: string; notes: string },
): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = UpdateNotesInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Inválido');

  try {
    await getDb()
      .update(waitlist)
      .set({
        notes: parsed.data.notes.length > 0 ? parsed.data.notes : null,
        updatedAt: new Date(),
      })
      .where(eq(waitlist.id, parsed.data.id));
    revalidatePath('/admin/waitlist');
    return { ok: true };
  } catch {
    return fail('Erro ao salvar notes');
  }
}

/**
 * Adiciona tag ao array `tags` (idempotente — postgres array_append +
 * DISTINCT via subquery). Validação tag: lowercase alfanumérico + `_-`.
 */
export async function addWaitlistTag(
  raw: { id: string; tag: string },
): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = TagInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Tag inválida');
  const tag = parsed.data.tag.toLowerCase();

  try {
    await getDb()
      .update(waitlist)
      .set({
        tags: sql`
          CASE WHEN ${tag} = ANY(${waitlist.tags})
            THEN ${waitlist.tags}
            ELSE array_append(${waitlist.tags}, ${tag})
          END
        `,
        updatedAt: new Date(),
      })
      .where(eq(waitlist.id, parsed.data.id));
    revalidatePath('/admin/waitlist');
    return { ok: true };
  } catch {
    return fail('Erro ao adicionar tag');
  }
}

/**
 * Remove tag específica do array.
 */
export async function removeWaitlistTag(
  raw: { id: string; tag: string },
): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = TagInput.safeParse(raw);
  if (!parsed.success) return fail('Tag inválida');
  const tag = parsed.data.tag.toLowerCase();

  try {
    await getDb()
      .update(waitlist)
      .set({
        tags: sql`array_remove(${waitlist.tags}, ${tag})`,
        updatedAt: new Date(),
      })
      .where(eq(waitlist.id, parsed.data.id));
    revalidatePath('/admin/waitlist');
    return { ok: true };
  } catch {
    return fail('Erro ao remover tag');
  }
}

/**
 * Marca o lead como contatado AGORA. Atualiza `last_contact_at`
 * (preserva `contacted_at` que é first-contact). Também muda status
 * pra 'contacted' se ainda for 'new'.
 */
export async function markWaitlistContacted(
  raw: { id: string },
): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = IdInput.safeParse(raw);
  if (!parsed.success) return fail('ID inválido');

  const now = new Date();
  try {
    await getDb()
      .update(waitlist)
      .set({
        lastContactAt: now,
        contactedAt: sql`COALESCE(${waitlist.contactedAt}, ${now})`,
        status: sql`CASE WHEN ${waitlist.status} = 'new' THEN 'contacted'::waitlist_status ELSE ${waitlist.status} END`,
        updatedAt: now,
      })
      .where(eq(waitlist.id, parsed.data.id));
    revalidatePath('/admin/waitlist');
    return { ok: true };
  } catch {
    return fail('Erro ao marcar contato');
  }
}

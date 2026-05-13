'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createDb, inviteTokens, waitlist } from '@printstudio/db';
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

const INVITE_EXPIRY_DAYS = 30;
const INVITE_TOKEN_BYTES = 24; // base64url(24 bytes) = 32 chars

/**
 * Gera token URL-safe random com ~190 bits de entropia.
 * `crypto.randomBytes` é CSPRNG (não confundir com Math.random).
 */
function makeInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString('base64url');
}

/**
 * Constrói URL completa do invite. Lê `NEXT_PUBLIC_APP_URL` ou cai
 * em `NEXT_PUBLIC_SITE_URL` ou hardcoded prod default.
 *
 * Em dev local com `app.guiaprint3d.com` ainda não existe, retorna
 * o origin que o admin pode trocar antes de mandar.
 */
function buildInviteUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://app.guiaprint3d.com';
  const trimmed = base.replace(/\/$/, '');
  return `${trimmed}/signup?invite=${encodeURIComponent(token)}`;
}

export interface GenerateInviteResult {
  ok: boolean;
  url?: string;
  token?: string;
  expiresAt?: string;
  error?: string;
}

/**
 * Gera invite token novo pro lead (Story 9.4).
 *
 * Transação atômica:
 * 1. Invalida tokens ativos anteriores (set `used_at = now` neles)
 *    — re-gerar nunca deixa 2 tokens ativos simultaneamente
 * 2. INSERT novo token (32 chars URL-safe, 30 days expiry)
 * 3. Atualiza `waitlist.status = 'invited'`
 *
 * Retorna URL completa pra UI mostrar no modal com botão "Copiar".
 *
 * Consumido por Story 8.9 (endpoint `GET /api/public/invite/:token`).
 */
export async function generateInviteToken(
  raw: { id: string },
): Promise<GenerateInviteResult> {
  await requireSuperAdmin();
  const parsed = IdInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'ID inválido' };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const token = makeInviteToken();

  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      // 1. Invalida tokens ativos anteriores deste lead
      await tx
        .update(inviteTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(inviteTokens.waitlistId, parsed.data.id),
            isNull(inviteTokens.usedAt),
          ),
        );

      // 2. INSERT novo token
      await tx.insert(inviteTokens).values({
        token,
        waitlistId: parsed.data.id,
        expiresAt,
      });

      // 3. Marca lead como invited (preserva se já está em status
      // mais avançado tipo 'converted' — não regride)
      await tx
        .update(waitlist)
        .set({
          status: sql`CASE WHEN ${waitlist.status} IN ('converted') THEN ${waitlist.status} ELSE 'invited'::waitlist_status END`,
          updatedAt: now,
        })
        .where(eq(waitlist.id, parsed.data.id));
    });
  } catch {
    return { ok: false, error: 'Erro ao gerar convite' };
  }

  revalidatePath('/admin/waitlist');
  return {
    ok: true,
    token,
    url: buildInviteUrl(token),
    expiresAt: expiresAt.toISOString(),
  };
}

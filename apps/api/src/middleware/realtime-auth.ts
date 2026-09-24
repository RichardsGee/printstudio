import type { FastifyRequest, FastifyReply } from 'fastify';
import { and, eq, inArray } from 'drizzle-orm';
import { verifyRealtimeToken, type RealtimeTokenPayload } from '@printstudio/shared';
import { printers } from '@printstudio/db';
import { config } from '../config.js';
import { db } from '../db.js';

declare module 'fastify' {
  interface FastifyRequest {
    realtime?: RealtimeTokenPayload;
  }
}

/**
 * Autenticação das rotas que o browser chama direto (telemetria). O
 * token vem assinado pelo web — ver `@printstudio/shared/realtime-token`.
 */
export async function requireRealtimeToken(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
  const payload = await verifyRealtimeToken(config.AUTH_SECRET, token);
  if (!payload) {
    return reply.code(401).send({ error: 'unauthorized' });
  }
  req.realtime = payload;
}

/** Devolve só os ids de `printerIds` que pertencem à organização. */
export async function filterOrgPrinterIds(
  organizationId: string,
  printerIds: readonly string[],
): Promise<string[]> {
  if (printerIds.length === 0) return [];
  const rows = await db
    .select({ id: printers.id })
    .from(printers)
    .where(and(eq(printers.organizationId, organizationId), inArray(printers.id, [...printerIds])));
  return rows.map((r) => r.id);
}

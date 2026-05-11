import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { bambuCredentials } from '@printstudio/db';
import type { BambuConnectionStatus } from '@printstudio/shared';
import {
  getDb,
  getSessionUser,
  resolveUserOrganizationId,
} from '@/lib/bambu-api-helpers';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const organizationId = await resolveUserOrganizationId(user.id);
  if (!organizationId) {
    const status: BambuConnectionStatus = { connected: false };
    return NextResponse.json(status);
  }

  const rows = await getDb()
    .select({
      bambuEmail: bambuCredentials.bambuEmail,
      bambuUserId: bambuCredentials.bambuUserId,
      expiresAt: bambuCredentials.accessTokenExpiresAt,
      lastSyncedAt: bambuCredentials.lastSyncedAt,
    })
    .from(bambuCredentials)
    .where(eq(bambuCredentials.organizationId, organizationId))
    .limit(1);

  const row = rows[0];
  const status: BambuConnectionStatus = row
    ? {
        connected: true,
        bambuEmail: row.bambuEmail,
        bambuUserId: row.bambuUserId,
        expiresAt: row.expiresAt.toISOString(),
        lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
      }
    : { connected: false };

  return NextResponse.json(status);
}

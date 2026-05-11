import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { bambuCredentials } from '@printstudio/db';
import { getDb, getSessionUser, resolveUserOrganizationId } from '@/lib/bambu-api-helpers';

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const organizationId = await resolveUserOrganizationId(user.id);
  if (organizationId) {
    await getDb()
      .delete(bambuCredentials)
      .where(eq(bambuCredentials.organizationId, organizationId));
  }
  return new NextResponse(null, { status: 204 });
}

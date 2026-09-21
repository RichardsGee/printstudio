/**
 * GET /api/realtime-token — token curto pro browser falar com a API
 * (WS /ws/client e rotas de telemetria).
 *
 * Web e API ficam em hosts diferentes e não compartilham o cookie do
 * NextAuth. Aqui, onde a sessão existe, assinamos `{ sub, org, exp }`
 * com o AUTH_SECRET; a API confere e escopa tudo pela org.
 */

import { NextResponse } from 'next/server';
import { signRealtimeToken } from '@printstudio/shared';
import { getSessionUser, resolveUserOrganizationId } from '@/lib/bambu-api-helpers';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }

  const organizationId = await resolveUserOrganizationId(user.id);
  if (!organizationId) {
    return NextResponse.json({ error: 'no organization' }, { status: 403, headers: NO_STORE });
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'misconfigured' }, { status: 500, headers: NO_STORE });
  }

  const { token, payload } = await signRealtimeToken(secret, { sub: user.id, org: organizationId });
  return NextResponse.json({ token, expiresAt: payload.exp }, { headers: NO_STORE });
}

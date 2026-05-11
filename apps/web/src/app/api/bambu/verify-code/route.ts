import { NextResponse } from 'next/server';
import {
  BambuVerifyCodeRequestSchema,
  type BambuDevice,
  type BambuVerifyCodeResponse,
} from '@printstudio/shared';
import { bambuCredentials, encrypt, parseKey } from '@printstudio/db';
import {
  errorPayload,
  getDb,
  getSessionUser,
  resolveUserOrganizationId,
} from '@/lib/bambu-api-helpers';
import {
  BambuCloudError,
  getUserId,
  listDevices,
  loginWithCode,
} from '@/lib/bambu-cloud-api';

const credKey = (() => {
  const k = process.env.BAMBU_CRED_KEY;
  if (!k) {
    throw new Error('BAMBU_CRED_KEY not set on the web service');
  }
  return parseKey(k);
})();

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = BambuVerifyCodeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(errorPayload('INTERNAL_ERROR', 'Email ou código inválido'), { status: 400 });
  }
  const { email, code } = parsed.data;

  const organizationId = await resolveUserOrganizationId(user.id);
  if (!organizationId) {
    return NextResponse.json(errorPayload('INTERNAL_ERROR', 'Usuário sem organização'), { status: 500 });
  }

  try {
    const { accessToken, refreshToken, expiresIn } = await loginWithCode(email, code);
    const [devices, bambuUserId] = await Promise.all([
      listDevices(accessToken),
      getUserId(accessToken),
    ]);

    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const encryptedAccess = encrypt(accessToken, credKey);
    const encryptedRefresh = refreshToken ? encrypt(refreshToken, credKey) : null;
    const now = new Date();

    await getDb()
      .insert(bambuCredentials)
      .values({
        organizationId,
        bambuEmail: email,
        bambuUserId,
        encryptedAccessToken: encryptedAccess,
        encryptedRefreshToken: encryptedRefresh,
        accessTokenExpiresAt: expiresAt,
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: bambuCredentials.organizationId,
        set: {
          bambuEmail: email,
          bambuUserId,
          encryptedAccessToken: encryptedAccess,
          encryptedRefreshToken: encryptedRefresh,
          accessTokenExpiresAt: expiresAt,
          lastSyncedAt: now,
          updatedAt: now,
        },
      });

    const mapped: BambuDevice[] = devices.map((d) => ({
      serial: d.dev_id,
      name: d.name,
      model: d.dev_product_name,
      online: d.online,
    }));

    const response: BambuVerifyCodeResponse = {
      organizationId,
      bambuEmail: email,
      bambuUserId,
      devices: mapped,
    };
    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof BambuCloudError) {
      const httpStatus = err.code === 'BAMBU_INVALID_CODE' ? 400 : 502;
      return NextResponse.json(errorPayload(err.code, err.message), { status: httpStatus });
    }
    return NextResponse.json(errorPayload('INTERNAL_ERROR', 'Erro interno'), { status: 500 });
  }
}

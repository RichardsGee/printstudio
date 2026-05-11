import { NextResponse } from 'next/server';
import { BambuSendCodeRequestSchema } from '@printstudio/shared';
import { errorPayload, getSessionUser } from '@/lib/bambu-api-helpers';
import { sendEmailCode, BambuCloudError } from '@/lib/bambu-cloud-api';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = BambuSendCodeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(errorPayload('INTERNAL_ERROR', 'Email inválido'), { status: 400 });
  }
  try {
    await sendEmailCode(parsed.data.email);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof BambuCloudError) {
      return NextResponse.json(errorPayload(err.code, err.message), { status: 502 });
    }
    return NextResponse.json(errorPayload('INTERNAL_ERROR', 'Erro interno'), { status: 500 });
  }
}

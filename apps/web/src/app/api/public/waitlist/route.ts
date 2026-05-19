import { NextResponse, type NextRequest } from 'next/server';
import { getApiBaseServer } from '@/lib/api-base';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proxy de waitlist — Story 7.7 AC 5.
 *
 * A landing agora mora no apps/web (rota `/`), mas o endpoint de
 * cadastro vive no apps/api (Fastify, porta 4000 / api.guiaprint3d.com).
 * Este route handler repassa o POST same-origin → apps/api, então o
 * `WaitlistForm` pode usar path relativo (`/api/public/waitlist`) sem
 * CORS nem expor a URL do backend ao client.
 *
 * Preserva o IP real do cliente via `x-forwarded-for` porque o Fastify
 * faz rate-limit por IP (3 cadastros/hora) — sem isso todo cadastro
 * cairia no IP do servidor apps/web e o rate-limit bloquearia geral.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();

  // EasyPanel/reverse-proxy seta x-forwarded-for com o IP do visitante.
  const forwardedFor =
    req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '';
  const userAgent = req.headers.get('user-agent') ?? '';
  const referer = req.headers.get('referer');

  let upstream: Response;
  try {
    upstream = await fetch(`${getApiBaseServer()}/api/public/waitlist`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
        ...(userAgent ? { 'user-agent': userAgent } : {}),
        ...(referer ? { referer } : {}),
      },
      body,
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro de conexão com o servidor. Tente novamente.',
        },
      },
      { status: 502 },
    );
  }

  // Repassa status + body do Fastify fielmente (o form mapeia os codes).
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      'content-type':
        upstream.headers.get('content-type') ?? 'application/json',
    },
  });
}

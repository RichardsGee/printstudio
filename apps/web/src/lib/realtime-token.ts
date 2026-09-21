'use client';

import { getApiBase } from './bridge-url';

/**
 * Token da API pro browser (ver `app/api/realtime-token/route.ts`).
 * Cacheado até 60s antes de expirar, e com uma única requisição em voo
 * mesmo quando vários componentes pedem ao mesmo tempo.
 */

const RENEW_MARGIN_SEC = 60;

let cached: { token: string; expiresAt: number } | null = null;
let inflight: Promise<string | null> | null = null;

export async function getRealtimeToken(): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - RENEW_MARGIN_SEC > now) return cached.token;
  if (inflight) return inflight;

  inflight = fetch('/api/realtime-token', { credentials: 'same-origin', cache: 'no-store' })
    .then(async (r) => {
      if (!r.ok) return null;
      const data = (await r.json()) as { token: string; expiresAt: number };
      cached = data;
      return data.token;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** `fetch` na API com o token no header. `path` começa com `/api/`. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getRealtimeToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${getApiBase()}${path}`, { ...init, headers });
}

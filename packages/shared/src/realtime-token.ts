/**
 * Token curto que autoriza o browser a falar com a API (WS /ws/client e
 * rotas de leitura de telemetria).
 *
 * Por que existe: o web (NextAuth, cookie no host do web) e a API
 * (outro host) não compartilham cookie. O Next, que sabe quem está
 * logado, assina `{ sub, org, exp }` com o AUTH_SECRET — o mesmo nos
 * dois lados — e a API confere a assinatura e escopa tudo pela `org`.
 *
 * Formato: `base64url(json).base64url(hmac-sha256)`. Web Crypto em vez
 * de `node:crypto` porque este pacote também entra no bundle do browser.
 */

export interface RealtimeTokenPayload {
  /** userId */
  sub: string;
  /** organizationId — tudo na API é filtrado por ela */
  org: string;
  /** unix seconds */
  exp: number;
}

export const REALTIME_TOKEN_TTL_SEC = 10 * 60;

// Deriva uma chave própria em vez de usar o AUTH_SECRET cru, que o
// NextAuth também usa pra outra finalidade.
const KEY_CONTEXT = 'printstudio:realtime-token:v1';

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Sem anotar o retorno: no TS 5.7+ `Uint8Array` genérico precisa sair
// como `Uint8Array<ArrayBuffer>` pra ser aceito pelo crypto.subtle.
function fromBase64Url(input: string) {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) return null;
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  try {
    const bin = atob(padded);
    const out = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

// Sem citar `CryptoKey`: o tipo só existe com a lib DOM, e a API compila sem ela.
type HmacKey = Awaited<ReturnType<typeof crypto.subtle.importKey>>;

async function importKey(secret: string): Promise<HmacKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const derived = new Uint8Array(
    await crypto.subtle.sign('HMAC', base, encoder.encode(KEY_CONTEXT)),
  );
  return crypto.subtle.importKey('raw', derived, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function signRealtimeToken(
  secret: string,
  claims: { sub: string; org: string },
  ttlSec: number = REALTIME_TOKEN_TTL_SEC,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<{ token: string; payload: RealtimeTokenPayload }> {
  const payload: RealtimeTokenPayload = { sub: claims.sub, org: claims.org, exp: nowSec + ttlSec };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await importKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
  return { token: `${body}.${toBase64Url(sig)}`, payload };
}

/** Retorna o payload se assinatura e validade conferem; senão `null`. */
export async function verifyRealtimeToken(
  secret: string,
  token: string | null | undefined,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<RealtimeTokenPayload | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sigPart] = parts as [string, string];
  const sig = fromBase64Url(sigPart);
  const raw = fromBase64Url(body);
  if (!sig || !raw) return null;

  const key = await importKey(secret);
  // crypto.subtle.verify compara em tempo constante.
  const ok = await crypto.subtle.verify('HMAC', key, sig, encoder.encode(body));
  if (!ok) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const p = parsed as Partial<RealtimeTokenPayload>;
  if (typeof p.sub !== 'string' || !p.sub) return null;
  if (typeof p.org !== 'string' || !p.org) return null;
  if (typeof p.exp !== 'number' || p.exp <= nowSec) return null;
  return { sub: p.sub, org: p.org, exp: p.exp };
}

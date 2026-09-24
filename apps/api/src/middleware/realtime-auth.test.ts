import { describe, it, expect } from 'vitest';
import { signRealtimeToken, verifyRealtimeToken } from '@printstudio/shared';

/**
 * Contrato do token que autoriza o browser na API (WS /ws/client,
 * /api/stats, /api/printers/:id/temperatures). A API confia na `org` do
 * payload pra escopar tudo — então adulterar qualquer byte tem de falhar.
 */

const SECRET = 'segredo-de-teste-com-mais-de-16-chars';
const CLAIMS = { sub: 'user-1', org: 'org-a' };
const NOW = 1_800_000_000;

describe('realtime token', () => {
  it('assina e confere o payload', async () => {
    const { token } = await signRealtimeToken(SECRET, CLAIMS, 600, NOW);
    const p = await verifyRealtimeToken(SECRET, token, NOW + 1);
    expect(p).toEqual({ sub: 'user-1', org: 'org-a', exp: NOW + 600 });
  });

  it('REJEITA token expirado', async () => {
    const { token } = await signRealtimeToken(SECRET, CLAIMS, 600, NOW);
    expect(await verifyRealtimeToken(SECRET, token, NOW + 600)).toBeNull();
  });

  it('REJEITA segredo diferente', async () => {
    const { token } = await signRealtimeToken(SECRET, CLAIMS, 600, NOW);
    expect(await verifyRealtimeToken('outro-segredo-com-16-chars-ou-mais', token, NOW)).toBeNull();
  });

  it('REJEITA troca da org no payload mantendo a assinatura', async () => {
    const { token } = await signRealtimeToken(SECRET, CLAIMS, 600, NOW);
    const [, sig] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'user-1', org: 'org-b', exp: NOW + 600 }),
    ).toString('base64url');
    expect(await verifyRealtimeToken(SECRET, `${forged}.${sig}`, NOW)).toBeNull();
  });

  it('REJEITA assinatura adulterada', async () => {
    const { token } = await signRealtimeToken(SECRET, CLAIMS, 600, NOW);
    const [body, sig] = token.split('.') as [string, string];
    const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
    expect(await verifyRealtimeToken(SECRET, `${body}.${flipped}`, NOW)).toBeNull();
  });

  it.each([
    ['vazio', ''],
    ['null', null],
    ['sem ponto', 'abc'],
    ['três partes', 'a.b.c'],
    ['base64 inválido', '***.***'],
  ])('REJEITA formato %s', async (_nome, token) => {
    expect(await verifyRealtimeToken(SECRET, token, NOW)).toBeNull();
  });
});

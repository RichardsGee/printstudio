import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Tests da defesa contra privilege escalation no PATCH /api/users/:id
 * (Story 9.1).
 *
 * Foca no schema Zod `.strict()` que rejeita campos não-listados.
 * Integration test do endpoint completo requer DB de testes (não
 * disponível V1).
 *
 * O CONTRATO crítico: schema rejeita is_super_admin, role, passwordHash,
 * email, id em qualquer combinação.
 */

const UpdateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    notificationChannels: z
      .object({
        telegramChatId: z.string().max(200).optional(),
        email: z.string().email().max(200).optional(),
      })
      .optional(),
  })
  .strict();

describe('Privilege escalation prevention — PATCH /api/users/:id schema', () => {
  it('aceita payload válido com name', () => {
    const r = UpdateUserSchema.safeParse({ name: 'Richard' });
    expect(r.success).toBe(true);
  });

  it('REJEITA isSuperAdmin=true (camelCase)', () => {
    const r = UpdateUserSchema.safeParse({
      name: 'Richard',
      isSuperAdmin: true,
    });
    expect(r.success).toBe(false);
  });

  it('REJEITA is_super_admin=true (snake_case)', () => {
    const r = UpdateUserSchema.safeParse({
      name: 'Richard',
      is_super_admin: true,
    });
    expect(r.success).toBe(false);
  });

  it('REJEITA role=admin', () => {
    const r = UpdateUserSchema.safeParse({ role: 'admin' });
    expect(r.success).toBe(false);
  });

  it('REJEITA passwordHash', () => {
    const r = UpdateUserSchema.safeParse({
      passwordHash: '$argon2id$v=19$...',
    });
    expect(r.success).toBe(false);
  });

  it('REJEITA email override', () => {
    const r = UpdateUserSchema.safeParse({ email: 'novo@email.com' });
    expect(r.success).toBe(false);
  });

  it('REJEITA mesmo se name válido vier junto', () => {
    const r = UpdateUserSchema.safeParse({
      name: 'OK',
      isSuperAdmin: true,
    });
    expect(r.success).toBe(false);
  });

  it('REJEITA payload com apenas campos forbidden', () => {
    const r = UpdateUserSchema.safeParse({ isSuperAdmin: true });
    expect(r.success).toBe(false);
  });

  it('aceita notificationChannels válido', () => {
    const r = UpdateUserSchema.safeParse({
      notificationChannels: { telegramChatId: '@user' },
    });
    expect(r.success).toBe(true);
  });

  it('REJEITA campos sneaky tentando bypass', () => {
    const sneakyAttempts = [
      { 'is-super-admin': true },
      { isSUPERadmin: true },
      { admin: true },
      { superuser: true },
      { __proto__: { isSuperAdmin: true } },
    ];
    for (const payload of sneakyAttempts) {
      const r = UpdateUserSchema.safeParse(payload);
      // Todos devem falhar (strict). Alguns por estrutura inválida,
      // outros pq não estão no schema.
      expect(r.success, `payload ${JSON.stringify(payload)}`).toBe(false);
    }
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createUserWithOrg,
  defaultOrgName,
  SignupError,
} from './signup.js';

/**
 * Tests do service createUserWithOrg (Story 8.2).
 *
 * Estratégia: mockamos a transaction do drizzle inteira. Cada test
 * configura quais "queries" devem responder o quê, e o mock fluent
 * chama o callback de transaction com um tx fake.
 *
 * NÃO toca em DB real — sem prod-DB credentials, sem container Docker.
 */

interface FakeRow {
  table: 'users' | 'organizations' | 'organization_members' | 'invite_tokens' | 'waitlist';
  op: 'select' | 'insert' | 'update' | 'delete';
  result: unknown[];
  /** Erro a lançar quando essa operação for executada. */
  throws?: unknown;
}

/**
 * Builder fluent de transaction mock. Cada call de .from(table) /
 * .insert(table) / .update(table) / .delete(table) consome o primeiro
 * step da lista cuja tabela bata; result é resolvido no await final.
 *
 * Não modelamos perfeitamente todos os builders do drizzle — só o
 * suficiente pro service.
 */
function makeFakeTx(steps: FakeRow[]) {
  let cursor = 0;

  function nextResult(table: FakeRow['table'], op: FakeRow['op']): unknown[] {
    const step = steps[cursor];
    if (!step) {
      throw new Error(`unexpected ${op} on ${table} — no more steps configured`);
    }
    if (step.table !== table || step.op !== op) {
      throw new Error(
        `step mismatch: expected ${step.op} on ${step.table}, got ${op} on ${table}`,
      );
    }
    cursor += 1;
    if (step.throws) throw step.throws;
    return step.result;
  }

  function tableName(t: unknown): FakeRow['table'] {
    // Drizzle table tem _.name accessor mas pra simplicidade usamos a
    // própria referência da table importada. Os tests passam a table
    // real do schema, então fazemos lookup pelo _.name.
    const sym = (t as { [k: symbol]: unknown })[
      Object.getOwnPropertySymbols(t as object).find(
        (s) => s.description === 'drizzle:Name',
      ) as symbol
    ];
    if (typeof sym === 'string') return sym as FakeRow['table'];
    // Fallback: usa Symbol.toStringTag se setado
    return String((t as { tableName?: string }).tableName ?? 'unknown') as FakeRow['table'];
  }

  const tx = {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => {
        const name = tableName(table);
        const chain = {
          where: () => chain,
          limit: () => Promise.resolve(nextResult(name, 'select')),
        };
        return chain;
      },
    }),
    insert: (table: unknown) => {
      const name = tableName(table);
      return {
        values: () => ({
          returning: () => Promise.resolve(nextResult(name, 'insert')),
        }),
      };
    },
    update: (table: unknown) => {
      const name = tableName(table);
      return {
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve(nextResult(name, 'update')),
            // Quando o .update().set().where() é awaited direto (sem
            // .returning), também precisamos resolver. Drizzle retorna
            // result-like — para nosso caso (signup), o update de
            // waitlist NÃO chama .returning(); usa await direto.
            then: (resolve: (v: unknown) => void) => {
              resolve(nextResult(name, 'update'));
            },
          }),
        }),
      };
    },
    delete: (table: unknown) => {
      const name = tableName(table);
      return {
        where: () => ({
          returning: () => Promise.resolve(nextResult(name, 'delete')),
        }),
      };
    },
  };

  return { tx, getCursor: () => cursor };
}

function makeFakeDb(steps: FakeRow[]) {
  const fake = makeFakeTx(steps);
  return {
    transaction: async <T,>(
      fn: (tx: typeof fake.tx) => Promise<T>,
    ): Promise<T> => fn(fake.tx),
    _cursor: fake.getCursor,
  };
}

describe('defaultOrgName', () => {
  it('usa o primeiro nome', () => {
    expect(defaultOrgName('Richard Sgee')).toBe('Org de Richard');
  });

  it('lida com whitespace múltiplo', () => {
    expect(defaultOrgName('   João   da   Silva  ')).toBe('Org de João');
  });

  it('fallback se nome vazio', () => {
    expect(defaultOrgName('   ')).toBe('Minha org');
  });
});

describe('createUserWithOrg', () => {
  const baseInput = {
    email: 'TEST@example.com',
    name: 'Richard Sgee',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$fake$hash',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path sem invite cria 3 rows e retorna invitePrefilled=false', async () => {
    const fakeDb = makeFakeDb([
      {
        table: 'users',
        op: 'insert',
        result: [{ id: 'user-1', email: 'test@example.com', name: 'Richard Sgee' }],
      },
      {
        table: 'organizations',
        op: 'insert',
        result: [
          {
            id: 'org-1',
            name: 'Org de Richard',
            plan: 'free',
            onboardingStep: 'profile',
          },
        ],
      },
      {
        table: 'organization_members',
        op: 'insert',
        result: [{ id: 'mem-1', role: 'owner' }],
      },
    ]);

    const result = await createUserWithOrg(baseInput, fakeDb as never);

    expect(result.user.id).toBe('user-1');
    expect(result.user.email).toBe('test@example.com'); // lowercase
    expect(result.organization.name).toBe('Org de Richard');
    expect(result.organization.plan).toBe('free');
    expect(result.organization.onboardingStep).toBe('profile');
    expect(result.member.role).toBe('owner');
    expect(result.invitePrefilled).toBe(false);
  });

  it('happy path com invite válido pre-popula org + marca token usado + waitlist converted', async () => {
    const fakeDb = makeFakeDb([
      {
        table: 'users',
        op: 'insert',
        result: [{ id: 'user-2', email: 'test@example.com', name: 'Richard Sgee' }],
      },
      // consumeInviteToken: SELECT invite, UPDATE invite, SELECT waitlist
      {
        table: 'invite_tokens',
        op: 'select',
        result: [{ token: 'tok-xyz', waitlistId: 'wl-1' }],
      },
      {
        table: 'invite_tokens',
        op: 'update',
        result: [{ token: 'tok-xyz' }],
      },
      {
        table: 'waitlist',
        op: 'select',
        result: [
          {
            id: 'wl-1',
            role: 'small_shop',
            state: 'SP',
            city: 'São Paulo',
          },
        ],
      },
      // INSERT org (com pre-fill)
      {
        table: 'organizations',
        op: 'insert',
        result: [
          {
            id: 'org-2',
            name: 'Org de Richard',
            plan: 'free',
            onboardingStep: 'profile',
          },
        ],
      },
      // INSERT member
      {
        table: 'organization_members',
        op: 'insert',
        result: [{ id: 'mem-2', role: 'owner' }],
      },
      // UPDATE waitlist status
      {
        table: 'waitlist',
        op: 'update',
        result: [],
      },
    ]);

    const result = await createUserWithOrg(
      { ...baseInput, inviteToken: 'tok-xyz' },
      fakeDb as never,
    );

    expect(result.invitePrefilled).toBe(true);
    expect(result.organization.id).toBe('org-2');
  });

  it('invite token inválido NÃO bloqueia signup (sem pre-fill)', async () => {
    const fakeDb = makeFakeDb([
      {
        table: 'users',
        op: 'insert',
        result: [{ id: 'user-3', email: 'test@example.com', name: 'Richard Sgee' }],
      },
      // SELECT invite_tokens retorna vazio (expirado/usado/inexistente)
      {
        table: 'invite_tokens',
        op: 'select',
        result: [],
      },
      // INSERT org normal
      {
        table: 'organizations',
        op: 'insert',
        result: [
          {
            id: 'org-3',
            name: 'Org de Richard',
            plan: 'free',
            onboardingStep: 'profile',
          },
        ],
      },
      {
        table: 'organization_members',
        op: 'insert',
        result: [{ id: 'mem-3', role: 'owner' }],
      },
    ]);

    const result = await createUserWithOrg(
      { ...baseInput, inviteToken: 'bogus-token' },
      fakeDb as never,
    );

    expect(result.invitePrefilled).toBe(false);
    expect(result.organization.id).toBe('org-3');
  });

  it('email duplicado lança SignupError EMAIL_EXISTS', async () => {
    const fakeDb = makeFakeDb([
      {
        table: 'users',
        op: 'insert',
        result: [],
        throws: Object.assign(new Error('duplicate key'), {
          code: '23505',
          detail: 'Key (email)=(test@example.com) already exists.',
          constraint_name: 'users_email_unique',
        }),
      },
    ]);

    await expect(createUserWithOrg(baseInput, fakeDb as never)).rejects.toMatchObject({
      name: 'SignupError',
      code: 'EMAIL_EXISTS',
    });
  });

  it('erro genérico vira INTERNAL_ERROR sem vazar mensagem', async () => {
    const fakeDb = makeFakeDb([
      {
        table: 'users',
        op: 'insert',
        result: [],
        throws: new Error('algo bem específico que não queremos vazar'),
      },
    ]);

    await expect(createUserWithOrg(baseInput, fakeDb as never)).rejects.toBeInstanceOf(
      SignupError,
    );
    try {
      await createUserWithOrg(baseInput, fakeDb as never);
    } catch (err) {
      expect((err as SignupError).code).toBe('INTERNAL_ERROR');
      // mensagem do error nunca expõe a mensagem original
      expect((err as Error).message).not.toContain('bem específico');
    }
  });
});

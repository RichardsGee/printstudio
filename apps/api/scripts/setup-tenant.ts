/**
 * Setup de uma nova organization + user owner + (opcional) conta Bambu
 * vinculada. Idempotente — pode rodar várias vezes.
 *
 * Uso (2 fases):
 *
 *   FASE A — cria org + user + manda email code Bambu:
 *     ORG_NAME='Talita Shop' \
 *     USER_EMAIL=modabeshop@gmail.com \
 *     USER_PASSWORD='Rinxa080191' \
 *     USER_NAME='Talita' \
 *     BAMBU_EMAIL=modabeshop@gmail.com \
 *     pnpm --filter @printstudio/api exec tsx scripts/setup-tenant.ts
 *
 *   → script imprime o ORG_ID criado e diz "abra o gmail, pegue o
 *     código, e rode de novo com BAMBU_CODE=NNNNNN".
 *
 *   FASE B — vincula conta Bambu com o código recebido:
 *     ORG_NAME='Talita Shop' \
 *     USER_EMAIL=modabeshop@gmail.com \
 *     USER_PASSWORD='Rinxa080191' \
 *     USER_NAME='Talita' \
 *     BAMBU_EMAIL=modabeshop@gmail.com \
 *     BAMBU_CODE=750437 \
 *     pnpm --filter @printstudio/api exec tsx scripts/setup-tenant.ts
 *
 *   → script pula a criação (ORG e USER já existem), faz login Bambu,
 *     encripta JWT, popula bambu_credentials da org.
 */

import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import argon2 from 'argon2';
import { and, eq } from 'drizzle-orm';
import { createDb, organizations, organizationMembers, users, bambuCredentials, encrypt, parseKey } from '@printstudio/db';

const ORG_NAME = process.env.ORG_NAME ?? '';
const USER_EMAIL = process.env.USER_EMAIL ?? '';
const USER_PASSWORD = process.env.USER_PASSWORD ?? '';
const USER_NAME = process.env.USER_NAME ?? '';
const BAMBU_EMAIL = process.env.BAMBU_EMAIL ?? '';
const BAMBU_CODE = process.env.BAMBU_CODE ?? '';
const DATABASE_URL = process.env.DATABASE_URL;
const BAMBU_CRED_KEY = process.env.BAMBU_CRED_KEY;

if (!ORG_NAME || !USER_EMAIL || !USER_PASSWORD || !DATABASE_URL || !BAMBU_CRED_KEY) {
  console.error(
    'Faltam envs obrigatórias: ORG_NAME, USER_EMAIL, USER_PASSWORD, DATABASE_URL, BAMBU_CRED_KEY',
  );
  process.exit(1);
}

const db = createDb(DATABASE_URL);
const credKey = parseKey(BAMBU_CRED_KEY);

const HTTP_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'bambu_network_agent/01.09.05.01',
  'X-BBL-Client-Name': 'OrcaSlicer',
  'X-BBL-Client-Type': 'slicer',
  'X-BBL-Client-Version': '01.09.05.51',
};

// -----------------------------------------------------------------------
// Fase A — cria org / user / membership
// -----------------------------------------------------------------------

console.log(`\n[1/5] org "${ORG_NAME}"`);
let orgRow = (
  await db.select().from(organizations).where(eq(organizations.name, ORG_NAME)).limit(1)
)[0];
if (!orgRow) {
  const inserted = await db
    .insert(organizations)
    .values({ name: ORG_NAME })
    .returning();
  orgRow = inserted[0]!;
  console.log(`  ✨ criada org_id=${orgRow.id}`);
} else {
  console.log(`  ↺ já existe org_id=${orgRow.id}`);
}

console.log(`\n[2/5] user ${USER_EMAIL}`);
const passwordHash = await argon2.hash(USER_PASSWORD);
let userRow = (
  await db.select().from(users).where(eq(users.email, USER_EMAIL)).limit(1)
)[0];
if (!userRow) {
  const inserted = await db
    .insert(users)
    .values({ email: USER_EMAIL, passwordHash, name: USER_NAME || null, role: 'admin' })
    .returning();
  userRow = inserted[0]!;
  console.log(`  ✨ criado user_id=${userRow.id}`);
} else {
  await db
    .update(users)
    .set({ passwordHash, name: USER_NAME || userRow.name })
    .where(eq(users.id, userRow.id));
  console.log(`  ↺ user existe user_id=${userRow.id} — senha atualizada`);
}

console.log(`\n[3/5] membership ${USER_EMAIL} → ${ORG_NAME}`);
const existingMember = await db
  .select()
  .from(organizationMembers)
  .where(
    and(
      eq(organizationMembers.organizationId, orgRow.id),
      eq(organizationMembers.userId, userRow.id),
    ),
  )
  .limit(1);
if (existingMember[0]) {
  console.log(`  ↺ membership já existe (role=${existingMember[0].role})`);
} else {
  await db.insert(organizationMembers).values({
    organizationId: orgRow.id,
    userId: userRow.id,
    role: 'owner',
  });
  console.log(`  ✨ membership criada (owner)`);
}

// -----------------------------------------------------------------------
// Fase B — Bambu Cloud
// -----------------------------------------------------------------------

if (!BAMBU_EMAIL) {
  console.log('\n[4/5] BAMBU_EMAIL não definido — pulando vinculação Bambu.');
  console.log('\n✅ Org + user + membership criados.');
  process.exit(0);
}

if (!BAMBU_CODE) {
  console.log(`\n[4/5] enviando código pra ${BAMBU_EMAIL}...`);
  const res = await fetch(`https://api.bambulab.com/v1/user-service/user/sendemail/code`, {
    method: 'POST',
    headers: HTTP_HEADERS,
    body: JSON.stringify({ email: BAMBU_EMAIL, type: 'codeLogin' }),
  });
  if (!res.ok) {
    console.error(`  ❌ sendemail HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  console.log(`  ✉️  código enviado.`);
  console.log('\n📬 abra o Gmail, pegue o código de 6 dígitos, e rode de novo com:');
  console.log(`    BAMBU_CODE=NNNNNN <as outras envs>...`);
  process.exit(0);
}

console.log(`\n[4/5] login Bambu com code=${BAMBU_CODE.slice(0, 2)}****`);
const loginRes = await fetch(`https://api.bambulab.com/v1/user-service/user/login`, {
  method: 'POST',
  headers: HTTP_HEADERS,
  body: JSON.stringify({ account: BAMBU_EMAIL, code: BAMBU_CODE }),
});
if (!loginRes.ok) {
  console.error(`  ❌ login HTTP ${loginRes.status}: ${await loginRes.text()}`);
  process.exit(1);
}
const loginData = (await loginRes.json()) as {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  loginType?: string;
};
if (!loginData.accessToken) {
  console.error(`  ❌ login sem accessToken (loginType=${loginData.loginType})`);
  process.exit(1);
}
console.log(`  ✅ accessToken (${loginData.accessToken.length} chars, expires in ${loginData.expiresIn}s)`);

console.log(`\n[5/5] /my/preference`);
const prefRes = await fetch(`https://api.bambulab.com/v1/design-user-service/my/preference`, {
  headers: { ...HTTP_HEADERS, Authorization: `Bearer ${loginData.accessToken}` },
});
if (!prefRes.ok) {
  console.error(`  ❌ preference HTTP ${prefRes.status}: ${await prefRes.text()}`);
  process.exit(1);
}
const prefData = (await prefRes.json()) as { uidStr?: string; uid?: number | string };
const bambuUserId = prefData.uidStr ?? (prefData.uid !== undefined ? String(prefData.uid) : '');
if (!bambuUserId) {
  console.error(`  ❌ preference sem uid`);
  process.exit(1);
}
console.log(`  bambuUserId=${bambuUserId}`);

const accessTokenExpiresAt = new Date(Date.now() + (loginData.expiresIn ?? 90 * 86400) * 1000);
const encryptedAccess = encrypt(loginData.accessToken, credKey);
const encryptedRefresh = loginData.refreshToken ? encrypt(loginData.refreshToken, credKey) : null;
const now = new Date();

await db
  .insert(bambuCredentials)
  .values({
    organizationId: orgRow.id,
    bambuEmail: BAMBU_EMAIL,
    bambuUserId,
    encryptedAccessToken: encryptedAccess,
    encryptedRefreshToken: encryptedRefresh,
    accessTokenExpiresAt,
    lastSyncedAt: now,
  })
  .onConflictDoUpdate({
    target: bambuCredentials.organizationId,
    set: {
      bambuEmail: BAMBU_EMAIL,
      bambuUserId,
      encryptedAccessToken: encryptedAccess,
      encryptedRefreshToken: encryptedRefresh,
      accessTokenExpiresAt,
      lastSyncedAt: now,
      updatedAt: now,
    },
  });
console.log(`  ✅ bambu_credentials upsert pra org_id=${orgRow.id}`);

console.log('\n========================================');
console.log('  ✅ TUDO PRONTO');
console.log('========================================');
console.log(`  org_id:        ${orgRow.id}`);
console.log(`  org_name:      ${ORG_NAME}`);
console.log(`  user_id:       ${userRow.id}`);
console.log(`  user_email:    ${USER_EMAIL}`);
console.log(`  bambu_user_id: ${bambuUserId}`);
console.log(`  expires_at:    ${accessTokenExpiresAt.toISOString()}`);
console.log('========================================\n');

process.exit(0);

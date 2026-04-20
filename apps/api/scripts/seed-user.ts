import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import argon2 from 'argon2';
import { createDb, users } from '@printstudio/db';
import { eq } from 'drizzle-orm';

const email = process.argv[2] ?? 'admin@printstudio.local';
const password = process.argv[3] ?? 'admin123';
const name = process.argv[4] ?? 'Richard';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const db = createDb(databaseUrl);

const passwordHash = await argon2.hash(password);

const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

if (existing.length > 0) {
  await db.update(users).set({ passwordHash, name, role: 'admin' }).where(eq(users.email, email));
  console.log(`Updated existing user: ${email}`);
} else {
  await db.insert(users).values({ email, passwordHash, name, role: 'admin' });
  console.log(`Created user: ${email}`);
}

console.log(`Email:    ${email}`);
console.log(`Password: ${password}`);
console.log(`Role:     admin`);

process.exit(0);

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { bambuCredentials, decrypt, parseKey } from '@printstudio/db';
import { config } from './config.js';
import { logger } from './logger.js';

export interface DecryptedBambuCredential {
  organizationId: string;
  bambuEmail: string;
  bambuUserId: string;
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: Date;
}

const sql = postgres(config.DATABASE_URL, { max: 2 });
const db = drizzle(sql);

const credKey = parseKey(config.BAMBU_CRED_KEY);

/**
 * Lê e decripta as credenciais Bambu da organização configurada.
 * Retorna null se a org ainda não conectou conta Bambu.
 */
export async function loadCredential(): Promise<DecryptedBambuCredential | null> {
  const rows = await db
    .select()
    .from(bambuCredentials)
    .where(eq(bambuCredentials.organizationId, config.ORGANIZATION_ID))
    .limit(1);
  const row = rows[0];
  if (!row) {
    logger.warn(
      { organizationId: config.ORGANIZATION_ID },
      'sem bambu_credentials pra essa org — aguardando user conectar via UI',
    );
    return null;
  }
  try {
    const accessToken = decrypt(row.encryptedAccessToken, credKey);
    const refreshToken = row.encryptedRefreshToken
      ? decrypt(row.encryptedRefreshToken, credKey)
      : null;
    return {
      organizationId: row.organizationId,
      bambuEmail: row.bambuEmail,
      bambuUserId: row.bambuUserId,
      accessToken,
      refreshToken,
      accessTokenExpiresAt: row.accessTokenExpiresAt,
    };
  } catch (err) {
    logger.error(
      { err, organizationId: config.ORGANIZATION_ID },
      'Falhou ao decryptar credenciais — chave BAMBU_CRED_KEY mudou?',
    );
    throw err;
  }
}

export async function closeDb(): Promise<void> {
  await sql.end();
}

/**
 * AES-256-GCM helpers pra encriptar credenciais sensíveis (tokens Bambu
 * Cloud) em repouso. Usado pelas tabelas onde guardamos `encrypted_*` em
 * bytea — atualmente: `bambu_credentials`.
 *
 * Formato do output:
 *   [ nonce (12 bytes) || ciphertext (variable) || authTag (16 bytes) ]
 *
 * Total overhead: 28 bytes por blob. Pra JWTs típicos (~150 bytes), isso é
 * ~20% overhead — aceitável.
 *
 * A chave (32 bytes) NÃO é lida deste módulo. Quem usa deve passar como
 * parâmetro — assim a camada de aplicação decide se carrega do env, de
 * KMS, ou de outra fonte. Isso facilita rotação e testes.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

export class CryptoKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoKeyError';
  }
}

export class CryptoDecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoDecryptionError';
  }
}

function assertKey(key: Buffer): void {
  if (!Buffer.isBuffer(key) || key.length !== KEY_LENGTH) {
    throw new CryptoKeyError(
      `Chave inválida: esperado Buffer de ${KEY_LENGTH} bytes, recebido ${
        Buffer.isBuffer(key) ? `${key.length} bytes` : typeof key
      }`,
    );
  }
}

/**
 * Encripta `plaintext` com AES-256-GCM usando a `key` de 32 bytes.
 * Cada chamada gera um nonce aleatório novo — o mesmo plaintext produz
 * ciphertexts diferentes (semanticamente seguro).
 */
export function encrypt(plaintext: string, key: Buffer): Buffer {
  assertKey(key);
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([nonce, ciphertext, authTag]);
}

/**
 * Decripta `blob` (output de `encrypt`) com a mesma `key`. Lança
 * CryptoDecryptionError se o blob foi adulterado (auth tag inválido)
 * ou se a chave está errada.
 */
export function decrypt(blob: Buffer | Uint8Array, key: Buffer): string {
  assertKey(key);
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  if (buf.length < NONCE_LENGTH + TAG_LENGTH) {
    throw new CryptoDecryptionError(`Blob curto demais: ${buf.length} bytes`);
  }
  const nonce = buf.subarray(0, NONCE_LENGTH);
  const authTag = buf.subarray(buf.length - TAG_LENGTH);
  const ciphertext = buf.subarray(NONCE_LENGTH, buf.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, nonce);
  decipher.setAuthTag(authTag);
  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  } catch (err) {
    // GCM auth falha se chave errada OU blob adulterado — semanticamente o mesmo
    throw new CryptoDecryptionError(
      `Decryption falhou: chave errada ou blob adulterado (${(err as Error).message})`,
    );
  }
}

/**
 * Parser pra `BAMBU_CRED_KEY` em base64 (formato natural pra env var).
 *
 *   const key = parseKey(process.env.BAMBU_CRED_KEY);
 */
export function parseKey(b64: string | undefined): Buffer {
  if (!b64) {
    throw new CryptoKeyError('BAMBU_CRED_KEY ausente no env');
  }
  const buf = Buffer.from(b64, 'base64');
  if (buf.length !== KEY_LENGTH) {
    throw new CryptoKeyError(
      `BAMBU_CRED_KEY deve decodar pra ${KEY_LENGTH} bytes, mas decodou pra ${buf.length}. Gere com: openssl rand -base64 32`,
    );
  }
  return buf;
}

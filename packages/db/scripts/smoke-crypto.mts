import { encrypt, decrypt, parseKey, CryptoDecryptionError } from '../src/crypto.js';
import { randomBytes } from 'node:crypto';

const key = randomBytes(32);
const plaintext = 'Bambu access token: eyJhbGc.payload.signature.fake_jwt_for_test';

console.log('plaintext:', plaintext);
console.log('plaintext.length:', plaintext.length, 'bytes');

const blob = encrypt(plaintext, key);
console.log('encrypted blob.length:', blob.length, 'bytes (overhead:', blob.length - plaintext.length, ')');
console.log('blob hex (primeiros 50):', blob.subarray(0, 25).toString('hex'), '...');

const decrypted = decrypt(blob, key);
console.log('decrypted:', decrypted);
console.log('round-trip OK:', decrypted === plaintext ? '✅' : '❌');

console.log('\n=== tampering detection ===');
const tampered = Buffer.from(blob);
tampered[20] ^= 0xff;
try {
  decrypt(tampered, key);
  console.log('❌ tampering NÃO detectado (BUG)');
} catch (err) {
  if (err instanceof CryptoDecryptionError) {
    console.log('✅ tampering detectado:', err.message.slice(0, 80));
  } else {
    throw err;
  }
}

console.log('\n=== wrong-key detection ===');
const wrongKey = randomBytes(32);
try {
  decrypt(blob, wrongKey);
  console.log('❌ wrong-key NÃO detectado (BUG)');
} catch (err) {
  if (err instanceof CryptoDecryptionError) {
    console.log('✅ wrong-key detectado:', err.message.slice(0, 80));
  } else {
    throw err;
  }
}

console.log('\n=== parseKey ===');
const b64 = key.toString('base64');
const parsed = parseKey(b64);
console.log('parse round-trip OK:', parsed.equals(key) ? '✅' : '❌');

try {
  parseKey('short-key');
  console.log('❌ short key NÃO rejeitada (BUG)');
} catch (err) {
  console.log('✅ short key rejeitada:', (err as Error).message.slice(0, 80));
}

process.exit(0);

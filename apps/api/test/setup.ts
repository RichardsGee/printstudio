/**
 * Vitest setup: stub env vars necessárias pelo config.ts.
 * Valores fake — testes não tocam em DB real.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
process.env.API_CORS_ORIGIN = 'http://localhost:3000';
process.env.AUTH_SECRET = 'test-secret-not-used-in-unit-tests';
process.env.CLOUD_API_TOKEN = 'test-token-min-16chars-aaaa';
process.env.BAMBU_CRED_KEY = '0'.repeat(64);
process.env.LOG_LEVEL = 'error';

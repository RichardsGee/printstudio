import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// Em dev, lê o .env do raiz do monorepo (mesmo padrão do api/bridge).
// Em prod, o EasyPanel passa env vars direto no container, então este
// load no-op falha silenciosamente.
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().url(),
  BAMBU_CRED_KEY: z.string().min(32),
  CLOUD_WS_URL: z.string().url(),
  CLOUD_API_TOKEN: z.string().min(16),
  WORKER_ID: z.string().default('worker-cloud-01'),
  ORGANIZATION_ID: z.string().uuid(),
});

export type Config = z.infer<typeof ConfigSchema>;

const parsed = ConfigSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid worker config:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config: Config = parsed.data;

import 'dotenv/config';
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

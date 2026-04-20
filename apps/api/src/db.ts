import { createDb } from '@printstudio/db';
import { config } from './config.js';

export const db = createDb(config.DATABASE_URL);
export type Db = typeof db;

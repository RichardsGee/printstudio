import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database, { type Database as DB } from 'better-sqlite3';
import type { Logger } from '../logger.js';

export interface JobRow {
  id: string;
  printerId: string;
  fileName: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'finished' | 'failed' | 'cancelled';
  durationSec: number | null;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  printer_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  duration_sec INTEGER
);
CREATE INDEX IF NOT EXISTS idx_jobs_printer_id ON jobs(printer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_started_at ON jobs(started_at);
`;

export class JobStore {
  private db: DB;

  constructor(dbPath: string, private readonly logger: Logger) {
    const full = resolve(dbPath);
    mkdirSync(dirname(full), { recursive: true });
    this.db = new Database(full);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA);
    this.logger.info({ dbPath: full }, 'SQLite job store ready');
  }

  insertStart(row: Omit<JobRow, 'finishedAt' | 'durationSec' | 'status'> & { status?: JobRow['status'] }): void {
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO jobs (id, printer_id, file_name, started_at, status) VALUES (?, ?, ?, ?, ?)`,
    );
    stmt.run(row.id, row.printerId, row.fileName, row.startedAt, row.status ?? 'running');
  }

  markFinished(id: string, status: JobRow['status'], finishedAt: string, durationSec: number | null): void {
    const stmt = this.db.prepare(
      `UPDATE jobs SET status = ?, finished_at = ?, duration_sec = ? WHERE id = ?`,
    );
    stmt.run(status, finishedAt, durationSec, id);
  }

  listByPrinter(printerId: string, limit = 50): JobRow[] {
    const rows = this.db
      .prepare(
        `SELECT id, printer_id as printerId, file_name as fileName, started_at as startedAt, finished_at as finishedAt, status, duration_sec as durationSec
         FROM jobs WHERE printer_id = ? ORDER BY started_at DESC LIMIT ?`,
      )
      .all(printerId, limit) as JobRow[];
    return rows;
  }

  close(): void {
    this.db.close();
  }
}

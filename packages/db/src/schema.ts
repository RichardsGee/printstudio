import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  inet,
  jsonb,
  bigserial,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const printerStatusEnum = pgEnum('printer_status', [
  'IDLE',
  'PREPARE',
  'PRINTING',
  'PAUSED',
  'FINISH',
  'FAILED',
  'OFFLINE',
  'UNKNOWN',
]);

export const eventSeverityEnum = pgEnum('event_severity', ['INFO', 'WARN', 'ERROR']);

export const jobStatusEnum = pgEnum('job_status', [
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'CANCELLED',
]);

export const printers = pgTable('printers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  serial: text('serial').notNull().unique(),
  accessCode: text('access_code').notNull(),
  ipAddress: inet('ip_address'),
  model: text('model').default('A1').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const printerState = pgTable('printer_state', {
  printerId: uuid('printer_id')
    .primaryKey()
    .references(() => printers.id, { onDelete: 'cascade' }),
  status: printerStatusEnum('status').default('UNKNOWN').notNull(),
  progressPct: numeric('progress_pct', { precision: 5, scale: 2 }),
  currentLayer: integer('current_layer'),
  totalLayers: integer('total_layers'),
  nozzleTemp: numeric('nozzle_temp', { precision: 5, scale: 1 }),
  nozzleTargetTemp: numeric('nozzle_target_temp', { precision: 5, scale: 1 }),
  bedTemp: numeric('bed_temp', { precision: 5, scale: 1 }),
  bedTargetTemp: numeric('bed_target_temp', { precision: 5, scale: 1 }),
  chamberTemp: numeric('chamber_temp', { precision: 5, scale: 1 }),
  remainingSec: integer('remaining_sec'),
  currentFile: text('current_file'),
  hmsErrors: jsonb('hms_errors').$type<Array<{ code: string; severity: string; message?: string }>>().default([]),
  amsState: jsonb('ams_state').$type<Array<{ slot: number; filamentType: string | null; color: string | null; remainingPct: number | null; active: boolean }>>().default([]),
  activeSlotIndex: integer('active_slot_index'),
  speedMode: text('speed_mode'),
  speedPercent: numeric('speed_percent', { precision: 5, scale: 1 }),
  wifiSignalDbm: integer('wifi_signal_dbm'),
  fanPartCoolingPct: integer('fan_part_cooling_pct'),
  fanAuxPct: integer('fan_aux_pct'),
  fanChamberPct: integer('fan_chamber_pct'),
  nozzleDiameter: text('nozzle_diameter'),
  nozzleType: text('nozzle_type'),
  stage: text('stage'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const printJobs = pgTable('print_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  printerId: uuid('printer_id')
    .references(() => printers.id, { onDelete: 'cascade' })
    .notNull(),
  fileName: text('file_name').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: jobStatusEnum('status').default('RUNNING').notNull(),
  durationSec: integer('duration_sec'),
  filamentUsedG: numeric('filament_used_g', { precision: 7, scale: 2 }),
  layersTotal: integer('layers_total'),
  thumbnailUrl: text('thumbnail_url'),
  errorSummary: text('error_summary'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const events = pgTable('events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  printerId: uuid('printer_id').references(() => printers.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  severity: eventSeverityEnum('severity').default('INFO').notNull(),
  message: text('message').notNull(),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  role: text('role').default('admin').notNull(),
  notificationChannels: jsonb('notification_channels').$type<{
    telegramChatId?: string;
    email?: string;
  }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const printersRelations = relations(printers, ({ one, many }) => ({
  state: one(printerState, {
    fields: [printers.id],
    references: [printerState.printerId],
  }),
  jobs: many(printJobs),
  events: many(events),
}));

export const printerStateRelations = relations(printerState, ({ one }) => ({
  printer: one(printers, {
    fields: [printerState.printerId],
    references: [printers.id],
  }),
}));

export const printJobsRelations = relations(printJobs, ({ one }) => ({
  printer: one(printers, {
    fields: [printJobs.printerId],
    references: [printers.id],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  printer: one(printers, {
    fields: [events.printerId],
    references: [printers.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export type Printer = typeof printers.$inferSelect;
export type NewPrinter = typeof printers.$inferInsert;
export type PrinterStateRow = typeof printerState.$inferSelect;
export type NewPrinterState = typeof printerState.$inferInsert;
export type PrintJob = typeof printJobs.$inferSelect;
export type NewPrintJob = typeof printJobs.$inferInsert;
export type EventRow = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;

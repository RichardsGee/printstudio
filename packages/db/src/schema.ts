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
  boolean,
  pgEnum,
  unique,
  customType,
} from 'drizzle-orm/pg-core';

// Tipo bytea pra colunas de bytes brutos (encrypted blobs). Drizzle não
// tem helper nativo, então definimos via customType. Usa Uint8Array como
// transporte em JS (Buffer é compatível pq é subclasse).
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => 'bytea',
  fromDriver: (val) => new Uint8Array(val),
  toDriver: (val) => Buffer.from(val),
});
import { relations, sql } from 'drizzle-orm';

// UUID determinístico da org "Default" criada pela migration 0005.
// Usado como DEFAULT na coluna organization_id pra manter backward-compat
// com code que ainda não passa org_id explicitamente.
const DEFAULT_ORG_ID = sql`'00000000-0000-0000-0000-000000000001'::uuid`;

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

export const organizationMemberRoleEnum = pgEnum('organization_member_role', [
  'owner',
  'admin',
  'member',
]);

/**
 * Organização — unidade de tenancy no PrintStudio. Cada org tem suas
 * próprias impressoras, jobs, eventos e (futuro) credenciais Bambu cloud.
 *
 * UUID determinístico da "Default" criada pela migration 0005:
 *   00000000-0000-0000-0000-000000000001
 */
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: organizationMemberRoleEnum('role').default('member').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uqOrgUser: unique('uq_organization_members_org_user').on(t.organizationId, t.userId),
  }),
);

export const printers = pgTable(
  'printers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull()
      .default(DEFAULT_ORG_ID),
    name: text('name').notNull(),
    serial: text('serial').notNull(),
    accessCode: text('access_code').notNull(),
    ipAddress: inet('ip_address'),
    model: text('model').default('A1').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // Multi-tenant: serial é único POR ORG, não globalmente. Mesma física
    // impressora pode aparecer em mais de uma org (1 linha por org).
    uqOrgSerial: unique('printers_organization_id_serial_unique').on(t.organizationId, t.serial),
  }),
);

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
  amsUnits: jsonb('ams_units').$type<Array<{ id: number | null; humidityLevel: number | null; humidityPct: number | null; tempC: number | null }>>().default([]),
  activeSlotIndex: integer('active_slot_index'),
  speedMode: text('speed_mode'),
  speedPercent: numeric('speed_percent', { precision: 5, scale: 1 }),
  wifiSignalDbm: integer('wifi_signal_dbm'),
  fanPartCoolingPct: integer('fan_part_cooling_pct'),
  fanAuxPct: integer('fan_aux_pct'),
  fanChamberPct: integer('fan_chamber_pct'),
  fanHeatbreakPct: integer('fan_heatbreak_pct'),
  nozzleDiameter: text('nozzle_diameter'),
  nozzleType: text('nozzle_type'),
  stage: text('stage'),
  doorOpen: boolean('door_open'),
  isFromSdCard: boolean('is_from_sd_card'),
  lifecycle: text('lifecycle'),
  printType: text('print_type'),
  printErrorCode: integer('print_error_code'),
  stateChangeReason: text('state_change_reason'),
  currentBambuModelId: text('current_bambu_model_id'),
  currentTaskCoverUrl: text('current_task_cover_url'),
  currentTaskTopUrl: text('current_task_top_url'),
  currentTaskPickUrl: text('current_task_pick_url'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const printJobs = pgTable('print_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull()
    .default(DEFAULT_ORG_ID),
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

/**
 * Histórico de temperaturas por printer. Inserção throttled a 1
 * amostra/minuto — pra 3 impressoras isso dá ~4300 linhas/dia,
 * trivial em Postgres. O endpoint faz time-bucket no SELECT.
 */
export const temperatureSamples = pgTable('temperature_samples', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull()
    .default(DEFAULT_ORG_ID),
  printerId: uuid('printer_id')
    .references(() => printers.id, { onDelete: 'cascade' })
    .notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  nozzleTemp: numeric('nozzle_temp', { precision: 5, scale: 1 }),
  nozzleTargetTemp: numeric('nozzle_target_temp', { precision: 5, scale: 1 }),
  bedTemp: numeric('bed_temp', { precision: 5, scale: 1 }),
  bedTargetTemp: numeric('bed_target_temp', { precision: 5, scale: 1 }),
  chamberTemp: numeric('chamber_temp', { precision: 5, scale: 1 }),
});

export const events = pgTable('events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull()
    .default(DEFAULT_ORG_ID),
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

/**
 * Credenciais Bambu Cloud por organização. Tokens AES-256-GCM encrypted
 * em repouso (cripto em packages/db/src/crypto.ts, chave BAMBU_CRED_KEY
 * vinda do env). Apenas o worker/api decripta no momento de uso.
 *
 * UNIQUE (organization_id): MVP suporta 1 conta Bambu por org. V2 pode
 * relaxar pra múltiplas contas com índice composto.
 */
export const bambuCredentials = pgTable('bambu_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  bambuEmail: text('bambu_email').notNull(),
  bambuUserId: text('bambu_user_id').notNull(),
  encryptedAccessToken: bytea('encrypted_access_token').notNull(),
  encryptedRefreshToken: bytea('encrypted_refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }).notNull(),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  members: many(organizationMembers),
  printers: many(printers),
  jobs: many(printJobs),
  events: many(events),
  bambuCredentials: one(bambuCredentials, {
    fields: [organizations.id],
    references: [bambuCredentials.organizationId],
  }),
}));

export const bambuCredentialsRelations = relations(bambuCredentials, ({ one }) => ({
  organization: one(organizations, {
    fields: [bambuCredentials.organizationId],
    references: [organizations.id],
  }),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}));

export const printersRelations = relations(printers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [printers.organizationId],
    references: [organizations.id],
  }),
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
  memberships: many(organizationMembers),
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
export type TemperatureSample = typeof temperatureSamples.$inferSelect;
export type NewTemperatureSample = typeof temperatureSamples.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;
export type BambuCredential = typeof bambuCredentials.$inferSelect;
export type NewBambuCredential = typeof bambuCredentials.$inferInsert;

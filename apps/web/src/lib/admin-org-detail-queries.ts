import 'server-only';
import { desc, eq } from 'drizzle-orm';
import {
  createDb,
  events,
  organizationMembers,
  organizations,
  printers,
  users,
} from '@printstudio/db';

let _db: ReturnType<typeof createDb> | null = null;
function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  _db = createDb(url);
  return _db;
}

export interface OrgDetail {
  id: string;
  name: string;
  plan: string;
  onboardingStep: string;
  onboardingCompletedAt: Date | null;
  role: string | null;
  state: string | null;
  city: string | null;
  waitlistId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgMember {
  userId: string;
  email: string;
  name: string | null;
  memberRole: string;
  userRole: string;
  isSuperAdmin: boolean;
  joinedAt: Date;
}

export interface OrgPrinter {
  id: string;
  name: string;
  serial: string;
  model: string;
  displayOrder: number | null;
  createdAt: Date;
}

export interface OrgEvent {
  id: number;
  type: string;
  severity: string;
  message: string;
  printerId: string | null;
  createdAt: Date;
}

export interface OrgFullDetail {
  org: OrgDetail;
  members: OrgMember[];
  printers: OrgPrinter[];
  recentEvents: OrgEvent[];
}

/**
 * Carrega visão completa de uma org pro admin detail (Story 9.6).
 * 4 queries em paralelo via Promise.all. Retorna `null` se org não
 * existe (page chama notFound()).
 */
export async function getOrgFullDetail(orgId: string): Promise<OrgFullDetail | null> {
  const db = getDb();

  const [orgRows, memberRows, printerRows, eventRows] = await Promise.all([
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        plan: organizations.plan,
        onboardingStep: organizations.onboardingStep,
        onboardingCompletedAt: organizations.onboardingCompletedAt,
        role: organizations.role,
        state: organizations.state,
        city: organizations.city,
        waitlistId: organizations.waitlistId,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
      })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1),

    db
      .select({
        userId: users.id,
        email: users.email,
        name: users.name,
        memberRole: organizationMembers.role,
        userRole: users.role,
        isSuperAdmin: users.isSuperAdmin,
        joinedAt: organizationMembers.createdAt,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.organizationId, orgId))
      .orderBy(organizationMembers.createdAt),

    db
      .select({
        id: printers.id,
        name: printers.name,
        serial: printers.serial,
        model: printers.model,
        displayOrder: printers.displayOrder,
        createdAt: printers.createdAt,
      })
      .from(printers)
      .where(eq(printers.organizationId, orgId))
      .orderBy(printers.displayOrder, printers.createdAt),

    db
      .select({
        id: events.id,
        type: events.type,
        severity: events.severity,
        message: events.message,
        printerId: events.printerId,
        createdAt: events.createdAt,
      })
      .from(events)
      .where(eq(events.organizationId, orgId))
      .orderBy(desc(events.createdAt))
      .limit(50),
  ]);

  const org = orgRows[0];
  if (!org) return null;

  return {
    org,
    members: memberRows as OrgMember[],
    printers: printerRows as OrgPrinter[],
    recentEvents: eventRows as OrgEvent[],
  };
}

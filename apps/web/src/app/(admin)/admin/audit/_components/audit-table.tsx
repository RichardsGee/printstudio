'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { AdminAuditRow } from '@/lib/admin-audit-queries';
import { cn } from '@/lib/utils';

interface AuditTableProps {
  rows: AdminAuditRow[];
}

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function payloadPreview(payload: Record<string, unknown> | null): string {
  if (!payload) return '—';
  const json = JSON.stringify(payload);
  return json.length > 80 ? `${json.slice(0, 80)}…` : json;
}

function targetLink(row: AdminAuditRow): string | null {
  if (!row.targetId) return null;
  if (row.targetType === 'org') return `/admin/orgs/${row.targetId}`;
  if (row.targetType === 'waitlist') return `/admin/waitlist`;
  return null;
}

/**
 * Tabela do audit log (Story 9.9). Click no row expande payload JSON
 * formatted. Linka target_id pra entity correspondente quando possível.
 */
export function AuditTable({ rows }: AuditTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--mc-accent-soft)]/30 bg-card/40 p-8 text-center">
        <p
          data-mc-id
          className="text-caption font-mono uppercase tracking-wider text-muted-foreground"
        >
          {'// NO AUDIT ENTRIES'}
        </p>
        <p className="mt-2 text-small text-muted-foreground">
          Nenhuma ação foi registrada com os filtros aplicados.
        </p>
      </div>
    );
  }

  return (
    <Card data-mc-card>
      <CardContent className="p-0">
        <table className="w-full text-small">
          <thead className="bg-card/40 text-caption uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-8"></th>
              <th className="px-3 py-2 text-left font-medium" data-mc-label>
                Timestamp
              </th>
              <th className="px-3 py-2 text-left font-medium" data-mc-label>
                Admin
              </th>
              <th className="px-3 py-2 text-left font-medium" data-mc-label>
                Action
              </th>
              <th className="px-3 py-2 text-left font-medium" data-mc-label>
                Target
              </th>
              <th className="px-3 py-2 text-left font-medium" data-mc-label>
                Payload preview
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const expanded = expandedId === row.id;
              const link = targetLink(row);
              return (
                <Fragment key={row.id}>
                  <tr
                    onClick={() => setExpandedId(expanded ? null : row.id)}
                    className={cn(
                      'cursor-pointer border-t border-[var(--mc-accent-soft)]/20 transition-colors hover:bg-card/30',
                      expanded && 'bg-card/40',
                    )}
                  >
                    <td className="pl-3">
                      {expanded ? (
                        <ChevronDown
                          className="size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : (
                        <ChevronRight
                          className="size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span data-mc-num className="font-mono text-caption">
                        {formatDateTime(row.createdAt)}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="font-mono text-caption">
                        {row.adminEmail}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Badge variant="outline" className="font-mono text-caption">
                        {row.action}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="space-y-0.5">
                        <span
                          data-mc-label
                          className="block text-caption uppercase tracking-wider text-muted-foreground"
                        >
                          {row.targetType}
                        </span>
                        {row.targetId &&
                          (link ? (
                            <Link
                              href={link}
                              onClick={(e) => e.stopPropagation()}
                              className="font-mono text-caption text-primary hover:underline"
                            >
                              {row.targetId.slice(0, 8)}…
                            </Link>
                          ) : (
                            <code className="font-mono text-caption text-muted-foreground">
                              {row.targetId.slice(0, 8)}…
                            </code>
                          ))}
                      </div>
                    </td>
                    <td className="max-w-md px-3 py-2 align-top">
                      <code className="font-mono text-caption text-muted-foreground line-clamp-1">
                        {payloadPreview(row.payload)}
                      </code>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-card/20">
                      <td colSpan={6} className="px-6 py-3">
                        <pre className="overflow-x-auto rounded-md bg-background p-3 font-mono text-caption">
                          {JSON.stringify(
                            {
                              id: row.id,
                              adminUserId: row.adminUserId,
                              adminEmail: row.adminEmail,
                              adminName: row.adminName,
                              action: row.action,
                              targetType: row.targetType,
                              targetId: row.targetId,
                              ipAddress: row.ipAddress,
                              createdAt: row.createdAt,
                              payload: row.payload,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

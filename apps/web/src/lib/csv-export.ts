/**
 * CSV export helpers (Story 9.10).
 *
 * - UTF-8 BOM no início (Excel BR abre sem encoding broken)
 * - Escape RFC 4180: campos com `,`, `"`, `\n` ou `\r` → wrap em
 *   aspas duplas + duplicate aspas internas
 * - Anti-CSV-injection: prefixa campo que começa com `=`, `+`, `-`,
 *   `@`, `\t`, `\r` com `'` (Excel não interpreta como fórmula)
 */

const UTF8_BOM = '﻿';
const CSV_INJECTION_PREFIX = /^[=+\-@\t\r]/;
const CSV_NEEDS_QUOTE = /[",\n\r]/;

export function escapeCsvField(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  let str = String(value);
  if (CSV_INJECTION_PREFIX.test(str)) {
    str = `'${str}`;
  }
  if (CSV_NEEDS_QUOTE.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converte rows em CSV string completo (com BOM + headers + rows).
 * V1 in-memory — adequado pra <50k rows. V2 pode streamar via
 * Response body chunks pra exports maiores.
 *
 * Tipo de coluna usa `keyof T` direto — funciona com qualquer
 * objeto sem precisar de index signature.
 */
export function rowsToCsv<T>(
  rows: readonly T[],
  columns: Array<{ key: keyof T; label: string }>,
): string {
  const lines: string[] = [];
  lines.push(columns.map((c) => escapeCsvField(c.label)).join(','));
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvField(row[c.key])).join(','));
  }
  return UTF8_BOM + lines.join('\r\n') + '\r\n';
}

/**
 * Filename `{entity}-YYYY-MM-DD.csv`.
 */
export function csvFilename(entity: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${entity}-${today}.csv`;
}

/**
 * Response Next.js padronizada pra download CSV. Content-Type +
 * Content-Disposition + body com BOM.
 */
export function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}

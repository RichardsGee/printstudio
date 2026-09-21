#!/usr/bin/env node
/**
 * Regenera packages/bambu-protocol/src/hms-messages.pt-BR.ts a partir da
 * base oficial da Bambu (a mesma que o app Bambu Handy consulta).
 *
 *   node scripts/update-hms-messages.mjs
 *
 * - device_hms   → HMS (16 hex: attr + code)
 * - device_error → print_error (8 hex)
 *
 * Nunca escrever título de HMS à mão: a tabela anterior tinha 16 códigos
 * inventados, 11 inexistentes e 5 com o significado de outro erro.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const URL_BASE = 'https://e.bambulab.com/query.php?lang=pt-BR';
const OUT = fileURLToPath(
  new URL('../packages/bambu-protocol/src/hms-messages.pt-BR.ts', import.meta.url),
);

const res = await fetch(URL_BASE);
if (!res.ok) throw new Error(`base oficial devolveu ${res.status}`);
const json = await res.json();
const data = json?.data;

function table(section, digits) {
  const list = data?.[section]?.['pt-BR'];
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`seção ${section} vazia ou ausente`);
  }
  const out = {};
  for (const { ecode, intro } of list) {
    const key = String(ecode).toUpperCase();
    if (!new RegExp(`^[0-9A-F]{${digits}}$`).test(key)) continue;
    if (typeof intro === 'string' && intro.trim()) out[key] = intro.trim();
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

const hms = table('device_hms', 16);
const printErrors = table('device_error', 8);
const ver = data?.device_hms?.ver ?? json?.ver ?? 'desconhecida';

const header = `/**
 * GERADO por scripts/update-hms-messages.mjs — não editar à mão.
 * Fonte: ${URL_BASE} (versão ${ver})
 * HMS: ${Object.keys(hms).length} códigos · print_error: ${Object.keys(printErrors).length} códigos
 *
 * Fica no bambu-protocol (só servidor: worker/bridge) de propósito — o web
 * não importa este pacote, então as centenas de KB desta tabela não entram no bundle do browser.
 */
`;

const body =
  header +
  `\nexport const HMS_MESSAGES_PT_BR: Readonly<Record<string, string>> = ${JSON.stringify(hms, null, 2)};\n` +
  `\nexport const PRINT_ERROR_MESSAGES_PT_BR: Readonly<Record<string, string>> = ${JSON.stringify(printErrors, null, 2)};\n`;

writeFileSync(OUT, body);
console.log(
  `ok: ${Object.keys(hms).length} HMS + ${Object.keys(printErrors).length} print_error → ${OUT}`,
);

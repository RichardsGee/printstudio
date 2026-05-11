/**
 * POC follow-up: descobrir QUAL endpoint retorna a URL assinada do .3mf
 * que segue o padrão makerworld.bblmw.com/makerworld/model/{m}/{p}/instance/{uuid}.3mf
 *
 * Sabemos do user que essa URL existe. Falta o endpoint que a gera.
 */

import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import { eq } from 'drizzle-orm';
import { createDb, bambuCredentials, decrypt, parseKey } from '@printstudio/db';

const HEADERS_BAMBU = {
  'Content-Type': 'application/json',
  'User-Agent': 'bambu_network_agent/01.09.05.01',
  'X-BBL-Client-Name': 'OrcaSlicer',
  'X-BBL-Client-Type': 'slicer',
  'X-BBL-Client-Version': '01.09.05.51',
};

const HEADERS_MW = {
  'Content-Type': 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};

const TALITA_SHOP = 'ac1cf986-f483-4231-b3a3-3907b66d6b16';

const MODEL_ID = 'US547dc630b5cec1';
const PROFILE_ID = '698596585';
const TASK_ID = 940459631;
const DESIGN_ID = 2625235;
const INSTANCE_ID_NUMERIC = 2898165;

async function probe(label: string, url: string, headers: Record<string, string>) {
  try {
    const res = await fetch(url, { headers });
    const status = res.status;
    const body = await res.text();
    const isJson = body.startsWith('{') || body.startsWith('[');
    let preview = body.slice(0, 400);
    if (isJson) {
      try {
        preview = JSON.stringify(JSON.parse(body), null, 2).slice(0, 600);
      } catch {
        /* ignore */
      }
    }
    const containsTarget = body.includes('.3mf') || body.includes('instance/');
    console.log(`${containsTarget ? '🟢' : status === 200 ? '⚪' : '⚫'} ${status}  ${label}`);
    if (containsTarget) {
      console.log(`    ${url}`);
      console.log(preview.split('\n').map((l) => '    ' + l).join('\n'));
    } else if (status === 200) {
      console.log(`    (200 mas sem .3mf — keys: ${preview.slice(0, 100).replace(/\n/g, ' ')})`);
    }
  } catch (err) {
    console.log(`💥 ${label} — ${(err as Error).message}`);
  }
}

async function main(): Promise<void> {
  const db = createDb(process.env.DATABASE_URL!);
  const key = parseKey(process.env.BAMBU_CRED_KEY!);
  const rows = await db
    .select()
    .from(bambuCredentials)
    .where(eq(bambuCredentials.organizationId, TALITA_SHOP))
    .limit(1);
  const accessToken = decrypt(rows[0]!.encryptedAccessToken, key);
  const A = (h: Record<string, string>) => ({ ...h, Authorization: `Bearer ${accessToken}` });

  console.log('=== api.bambulab.com ===');
  await probe('iot user/profile/{p}/file', `https://api.bambulab.com/v1/iot-service/api/user/profile/${PROFILE_ID}/file`, A(HEADERS_BAMBU));
  await probe('iot user/profile/{p}/3mf', `https://api.bambulab.com/v1/iot-service/api/user/profile/${PROFILE_ID}/3mf`, A(HEADERS_BAMBU));
  await probe('iot user/profile/{p}/instance', `https://api.bambulab.com/v1/iot-service/api/user/profile/${PROFILE_ID}/instance`, A(HEADERS_BAMBU));
  await probe('iot user/profile/{p}/instances', `https://api.bambulab.com/v1/iot-service/api/user/profile/${PROFILE_ID}/instances`, A(HEADERS_BAMBU));
  await probe('iot user/profile/{p}/files', `https://api.bambulab.com/v1/iot-service/api/user/profile/${PROFILE_ID}/files`, A(HEADERS_BAMBU));
  await probe('iot user/profile/{p}?with_files=1', `https://api.bambulab.com/v1/iot-service/api/user/profile/${PROFILE_ID}?with_files=1&model_id=${MODEL_ID}`, A(HEADERS_BAMBU));
  await probe('iot user/model/{m}/file', `https://api.bambulab.com/v1/iot-service/api/user/model/${MODEL_ID}/file`, A(HEADERS_BAMBU));
  await probe('iot user/model/{m}/profile/{p}', `https://api.bambulab.com/v1/iot-service/api/user/model/${MODEL_ID}/profile/${PROFILE_ID}`, A(HEADERS_BAMBU));
  await probe('iot user/model/{m}/3mf', `https://api.bambulab.com/v1/iot-service/api/user/model/${MODEL_ID}/3mf`, A(HEADERS_BAMBU));
  await probe('iot user/task/{t}/file', `https://api.bambulab.com/v1/iot-service/api/user/task/${TASK_ID}/file`, A(HEADERS_BAMBU));
  await probe('iot user/task/{t}/3mf', `https://api.bambulab.com/v1/iot-service/api/user/task/${TASK_ID}/3mf`, A(HEADERS_BAMBU));
  await probe('iot user/task/{t}/print-file', `https://api.bambulab.com/v1/iot-service/api/user/task/${TASK_ID}/print-file`, A(HEADERS_BAMBU));
  await probe('iot user/print/{t}', `https://api.bambulab.com/v1/iot-service/api/user/print/${TASK_ID}`, A(HEADERS_BAMBU));
  await probe('user/my/tasks/{t}', `https://api.bambulab.com/v1/user-service/my/tasks/${TASK_ID}`, A(HEADERS_BAMBU));
  await probe('user/my/tasks/{t}/file', `https://api.bambulab.com/v1/user-service/my/tasks/${TASK_ID}/file`, A(HEADERS_BAMBU));
  await probe('design-user-service/my/design/{d}', `https://api.bambulab.com/v1/design-user-service/my/design/${DESIGN_ID}`, A(HEADERS_BAMBU));

  console.log('\n=== makerworld.com (autenticado via Bearer Bambu) ===');
  await probe('mw design/{d}/profile/{p}/file', `https://makerworld.com/api/v1/design-service/design/${DESIGN_ID}/profile/${PROFILE_ID}/file`, A(HEADERS_MW));
  await probe('mw profile/{p}/file', `https://makerworld.com/api/v1/design-service/profile/${PROFILE_ID}/file`, A(HEADERS_MW));
  await probe('mw profile/{p}/instances', `https://makerworld.com/api/v1/design-service/profile/${PROFILE_ID}/instances`, A(HEADERS_MW));
  await probe('mw instance/{numeric}/file', `https://makerworld.com/api/v1/design-service/instance/${INSTANCE_ID_NUMERIC}/file`, A(HEADERS_MW));
  await probe('mw instance/{numeric}', `https://makerworld.com/api/v1/design-service/instance/${INSTANCE_ID_NUMERIC}`, A(HEADERS_MW));
  await probe('mw model/{m}/instance', `https://makerworld.com/api/v1/design-service/model/${MODEL_ID}/instance`, A(HEADERS_MW));
  await probe('mw design/{d}/instance', `https://makerworld.com/api/v1/design-service/design/${DESIGN_ID}/instance`, A(HEADERS_MW));
  await probe('mw design/{d}/instances', `https://makerworld.com/api/v1/design-service/design/${DESIGN_ID}/instances`, A(HEADERS_MW));
  await probe('mw work/{d} (work = design synonym?)', `https://makerworld.com/api/v1/design-service/works/${DESIGN_ID}`, A(HEADERS_MW));

  console.log('\n=== file-service no api.bambulab.com ===');
  await probe('file-service/profile/{p}', `https://api.bambulab.com/v1/file-service/profile/${PROFILE_ID}`, A(HEADERS_BAMBU));
  await probe('file-service/profile/{p}/file', `https://api.bambulab.com/v1/file-service/profile/${PROFILE_ID}/file`, A(HEADERS_BAMBU));
  await probe('file-service/profile/{p}/3mf', `https://api.bambulab.com/v1/file-service/profile/${PROFILE_ID}/3mf`, A(HEADERS_BAMBU));
  await probe('file-service/task/{t}', `https://api.bambulab.com/v1/file-service/task/${TASK_ID}`, A(HEADERS_BAMBU));

  process.exit(0);
}

main().catch((err) => {
  console.error('erro:', err);
  process.exit(1);
});

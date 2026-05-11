/**
 * POC: descobrir como baixar .3mf do print atual via Bambu Cloud.
 *
 * Pega o accessToken Bambu da org Talita Shop, chama os endpoints que
 * pybambu/Doridian indicaram, e cospe as respostas brutas pra a gente
 * ver onde tem URL real de .3mf ou model file.
 *
 * Endpoints testados:
 *   1. /v1/user-service/my/tasks                              — task list (cover/title/status)
 *   2. /v1/iot-service/api/user/task/{TASK_ID}                — task details (doc diz 403)
 *   3. /v1/iot-service/api/user/project/{PROJECT_ID}          — project details (gcode URL null?)
 *   4. /v1/iot-service/api/user/profile/{PROFILE_ID}?model_id={ID}
 *   5. /v1/user-service/my/tasks?after={ID}                   — paginação?
 *   6. Bambu storage CDN url scraping (se cover funciona, talvez .3mf segue padrão)
 *   7. MakerWorld API: /api/v1/design-service/works/{PROJECT_ID}/3mf-download
 *
 * Roda standalone:
 *   pnpm --filter @printstudio/api exec tsx scripts/poc-bambu-task-files.ts
 */

import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import { eq } from 'drizzle-orm';
import { createDb, bambuCredentials, decrypt, parseKey } from '@printstudio/db';

const HTTP_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'bambu_network_agent/01.09.05.01',
  'X-BBL-Client-Name': 'OrcaSlicer',
  'X-BBL-Client-Type': 'slicer',
  'X-BBL-Client-Version': '01.09.05.51',
};

const TALITA_SHOP = 'ac1cf986-f483-4231-b3a3-3907b66d6b16';

async function main(): Promise<void> {
  const db = createDb(process.env.DATABASE_URL!);
  const key = parseKey(process.env.BAMBU_CRED_KEY!);

  const rows = await db
    .select()
    .from(bambuCredentials)
    .where(eq(bambuCredentials.organizationId, TALITA_SHOP))
    .limit(1);
  const cred = rows[0];
  if (!cred) {
    console.error('sem bambu_credentials da Talita Shop. roda /settings/bambu-connect.');
    process.exit(1);
  }

  const accessToken = decrypt(cred.encryptedAccessToken, key);
  console.log(`token: ${accessToken.slice(0, 12)}...${accessToken.slice(-4)}`);
  console.log(`bambu_user_id: ${cred.bambuUserId}`);

  const auth = { ...HTTP_HEADERS, Authorization: `Bearer ${accessToken}` };

  // ---------- 1. tasklist ----------
  console.log('\n========== [1] GET /v1/user-service/my/tasks ==========');
  const tasksRes = await fetch('https://api.bambulab.com/v1/user-service/my/tasks?limit=10', {
    headers: auth,
  });
  console.log(`HTTP ${tasksRes.status}`);
  const tasksBody = await tasksRes.json();
  console.log(JSON.stringify(tasksBody, null, 2).slice(0, 2500));

  const tasks: Array<Record<string, unknown>> = (tasksBody as { hits?: Array<Record<string, unknown>> }).hits ?? [];
  if (tasks.length === 0) {
    console.log('\nsem tasks. abortando.');
    process.exit(0);
  }
  const latestTask = tasks[0]!;
  const taskId = latestTask.id ?? latestTask.task_id;
  const projectId = latestTask.projectId ?? latestTask.project_id;
  const modelId = latestTask.modelId ?? latestTask.model_id;
  const designId = latestTask.designId ?? latestTask.design_id;
  console.log(`\nlatest task → id=${taskId} project=${projectId} model=${modelId} design=${designId}`);
  console.log(`title: ${latestTask.title}`);
  console.log(`cover: ${latestTask.cover}`);

  // ---------- 2. task details — print FULL configs[] ----------
  if (taskId) {
    console.log(`\n========== [2] GET /v1/iot-service/api/user/task/${taskId} ==========`);
    const r = await fetch(`https://api.bambulab.com/v1/iot-service/api/user/task/${taskId}`, {
      headers: auth,
    });
    console.log(`HTTP ${r.status}`);
    const data = (await r.json()) as { context?: { prefix?: string; configs?: Array<{ name: string; dir: string; url: string }>; plates?: Array<unknown> } };
    if (data.context?.configs) {
      console.log(`prefix: ${data.context.prefix}`);
      console.log(`configs[] (${data.context.configs.length} entries):`);
      data.context.configs.forEach((c, i) => {
        console.log(`  [${i}] ${c.dir}/${c.name}`);
        console.log(`      ${c.url.slice(0, 140)}...`);
      });
    }
    if (data.context?.plates) {
      console.log(`plates[] (${data.context.plates.length} entries):`);
      console.log(JSON.stringify(data.context.plates, null, 2).slice(0, 800));
    }
  }

  // ---------- 3. project details ----------
  if (projectId && projectId !== '0' && projectId !== 0) {
    console.log(`\n========== [3] GET /v1/iot-service/api/user/project/${projectId} ==========`);
    const r = await fetch(`https://api.bambulab.com/v1/iot-service/api/user/project/${projectId}`, {
      headers: auth,
    });
    console.log(`HTTP ${r.status}`);
    console.log((await r.text()).slice(0, 1500));
  }

  // ---------- 4. profile details ----------
  if (latestTask.profileId || latestTask.profile_id) {
    const profileId = latestTask.profileId ?? latestTask.profile_id;
    console.log(`\n========== [4] GET /v1/iot-service/api/user/profile/${profileId}?model_id=${modelId} ==========`);
    const r = await fetch(`https://api.bambulab.com/v1/iot-service/api/user/profile/${profileId}?model_id=${modelId}`, {
      headers: auth,
    });
    console.log(`HTTP ${r.status}`);
    console.log((await r.text()).slice(0, 1500));
  }

  // ---------- 5. MakerWorld design endpoint (designId vs modelId) ----------
  const designOrModel = designId ?? modelId;
  if (designOrModel) {
    console.log(`\n========== [5] GET makerworld.com/api/v1/design-service/works/${designOrModel}/3mf-download ==========`);
    const r = await fetch(`https://makerworld.com/api/v1/design-service/works/${designOrModel}/3mf-download`, {
      headers: auth,
    });
    console.log(`HTTP ${r.status}`);
    console.log((await r.text()).slice(0, 1000));

    console.log(`\n========== [6] GET makerworld.com/api/v1/design-service/design/${designOrModel} ==========`);
    const r2 = await fetch(`https://makerworld.com/api/v1/design-service/design/${designOrModel}`, {
      headers: auth,
    });
    console.log(`HTTP ${r2.status}`);
    console.log((await r2.text()).slice(0, 1500));

    console.log(`\n========== [7] GET makerworld.com/api/v1/design-service/design/${designOrModel}/files ==========`);
    const r3 = await fetch(`https://makerworld.com/api/v1/design-service/design/${designOrModel}/files`, {
      headers: auth,
    });
    console.log(`HTTP ${r3.status}`);
    console.log((await r3.text()).slice(0, 1500));
  }

  console.log('\n--- fim do POC ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('POC erro:', err);
  process.exit(1);
});

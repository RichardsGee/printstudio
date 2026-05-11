/**
 * POC: Bambu Cloud connection (não-oficial, reverse-engineered).
 *
 * Faz o caminho completo SEM precisar de bridge LAN:
 *   1. Solicita código de verificação por email (sendemail/code)
 *   2. Pergunta o código no terminal
 *   3. Login com email+código → JWT accessToken
 *   4. Lista impressoras vinculadas à conta (user/bind)
 *   5. Resolve userId pra montar username MQTT (u_<userId>)
 *   6. Conecta no broker cloud (us.mqtt.bambulab.com:8883) com TLS
 *   7. Subscribe device/{serial}/report de cada impressora
 *   8. Envia pushall pra forçar primeiro snapshot
 *   9. Loga telemetria por 30s e sai
 *
 * Pré-requisitos:
 *   - Impressora em modo CLOUD ou LAN+CLOUD (não LAN-only)
 *   - Acesso ao email da conta (pra receber o código de 6 dígitos)
 *
 * Como rodar:
 *   cd apps/bridge
 *   BAMBU_EMAIL=seu@email.com pnpm tsx scripts/cloud-poc.ts
 *
 * Funciona com contas Gmail/Apple OAuth (não precisa de senha).
 * Bambu manda código no email após o sendemail/code.
 *
 * Referências:
 *   - https://github.com/Doridian/OpenBambuAPI/blob/main/cloud-http.md
 *   - https://github.com/greghesp/ha-bambulab (pybambu/bambu_cloud.py)
 */

import 'dotenv/config';
import mqtt from 'mqtt';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const API_BASE = 'https://api.bambulab.com';
const MQTT_HOST = 'us.mqtt.bambulab.com';
const MQTT_PORT = 8883;
const POLL_DURATION_MS = 30_000;

const HTTP_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'bambu_network_agent/01.09.05.01',
  'X-BBL-Client-Name': 'OrcaSlicer',
  'X-BBL-Client-Type': 'slicer',
  'X-BBL-Client-Version': '01.09.05.51',
};

interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  loginType?: string;
  expiresIn?: number;
  tfaKey?: string;
}

interface Device {
  dev_id: string;
  name: string;
  online: boolean;
  print_status: string;
  dev_model_name: string;
  dev_product_name: string;
  dev_access_code: string;
}

interface BindResponse {
  message: string;
  devices: Device[];
}

interface UserPreference {
  uidStr?: string;
  uid?: number | string;
}

function maskToken(token: string): string {
  if (!token || token.length < 20) return '<short>';
  return `${token.slice(0, 8)}...${token.slice(-4)} (${token.length} chars)`;
}

async function requestEmailCode(email: string): Promise<void> {
  console.log(`\n[1/5] POST ${API_BASE}/v1/user-service/user/sendemail/code`);
  const res = await fetch(`${API_BASE}/v1/user-service/user/sendemail/code`, {
    method: 'POST',
    headers: HTTP_HEADERS,
    body: JSON.stringify({ email, type: 'codeLogin' }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`sendemail HTTP ${res.status}: ${body}`);
  }
  console.log(`  ✅ código enviado pra ${email}`);
}

async function loginWithCode(email: string, code: string): Promise<string> {
  console.log(`\n[3/5] POST ${API_BASE}/v1/user-service/user/login (com code)`);
  const res = await fetch(`${API_BASE}/v1/user-service/user/login`, {
    method: 'POST',
    headers: HTTP_HEADERS,
    body: JSON.stringify({ account: email, code }),
  });
  if (!res.ok) {
    throw new Error(`login HTTP ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as LoginResponse;
  if (!body.accessToken) {
    throw new Error(
      `login sem accessToken. response=${JSON.stringify(body).slice(0, 200)}`,
    );
  }
  console.log(`  ✅ accessToken obtido (${maskToken(body.accessToken)})`);
  return body.accessToken;
}

async function listDevices(accessToken: string): Promise<Device[]> {
  console.log(`\n[4a/5] GET ${API_BASE}/v1/iot-service/api/user/bind`);
  const res = await fetch(`${API_BASE}/v1/iot-service/api/user/bind`, {
    headers: { ...HTTP_HEADERS, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`bind HTTP ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as BindResponse;
  console.log(`  devices=${body.devices.length}`);
  body.devices.forEach((d, i) => {
    console.log(
      `    [${i}] ${d.name}  serial=${d.dev_id}  model=${d.dev_product_name}  online=${d.online}`,
    );
  });
  return body.devices;
}

async function getUserId(accessToken: string): Promise<string> {
  console.log(`\n[4b/5] GET ${API_BASE}/v1/design-user-service/my/preference`);
  const res = await fetch(`${API_BASE}/v1/design-user-service/my/preference`, {
    headers: { ...HTTP_HEADERS, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`preference HTTP ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as UserPreference;
  const uid = body.uidStr ?? (body.uid !== undefined ? String(body.uid) : null);
  if (!uid) {
    throw new Error(`preference sem uid: ${JSON.stringify(body).slice(0, 200)}`);
  }
  console.log(`  userId=${uid}`);
  return uid;
}

function connectMqttCloud(
  userId: string,
  accessToken: string,
  devices: Device[],
): mqtt.MqttClient {
  console.log(`\n[5/5] MQTT connect mqtts://${MQTT_HOST}:${MQTT_PORT}`);
  console.log(`  username=u_${userId}  password=<JWT ${maskToken(accessToken)}>`);

  const client = mqtt.connect(`mqtts://${MQTT_HOST}:${MQTT_PORT}`, {
    username: `u_${userId}`,
    password: accessToken,
    reconnectPeriod: 0,
    connectTimeout: 10_000,
    clientId: `printstudio-poc-${Date.now()}`,
  });

  client.on('connect', () => {
    console.log('  ✅ MQTT connected\n');
    devices.forEach((d) => {
      const reportTopic = `device/${d.dev_id}/report`;
      const requestTopic = `device/${d.dev_id}/request`;
      client.subscribe(reportTopic, (err) => {
        if (err) {
          console.error(`  subscribe ${reportTopic} ERROR:`, err.message);
        } else {
          console.log(`  subscribe ${reportTopic} OK`);
          const pushAll = {
            pushing: {
              sequence_id: '0',
              command: 'pushall',
              version: 1,
              push_target: 1,
            },
          };
          client.publish(requestTopic, JSON.stringify(pushAll));
          console.log(`  → publish pushall em ${requestTopic}`);
        }
      });
    });
  });

  client.on('message', (topic, payload) => {
    const ts = new Date().toISOString().slice(11, 23);
    try {
      const msg = JSON.parse(payload.toString()) as Record<string, unknown>;
      const print = msg.print as Record<string, unknown> | undefined;
      if (print) {
        const summary = {
          serial: topic.split('/')[1],
          stage: print.mc_print_stage,
          progress: print.mc_percent,
          nozzle: print.nozzle_temper,
          bed: print.bed_temper,
          chamber: print.chamber_temper,
          file: print.subtask_name,
        };
        console.log(`[${ts}] state:`, JSON.stringify(summary));
      } else {
        console.log(`[${ts}] ${topic} → keys=${Object.keys(msg).join(',')}`);
      }
    } catch {
      console.log(`[${ts}] ${topic} → ${payload.length} bytes (não-JSON)`);
    }
  });

  client.on('error', (err) => {
    console.error('  MQTT error:', err.message);
  });

  client.on('close', () => {
    console.log('  MQTT closed');
  });

  return client;
}

async function promptCode(): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log('\n[2/5] Aguardando código...');
  const code = await rl.question('  ▶ Digite o código de 6 dígitos do email: ');
  rl.close();
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    throw new Error(`Código inválido (esperado 6 dígitos): "${trimmed}"`);
  }
  return trimmed;
}

async function main(): Promise<void> {
  const email = process.env.BAMBU_EMAIL;
  if (!email) {
    console.error(
      'ERRO: defina BAMBU_EMAIL no env.\n\n' +
        '  Exemplo:\n' +
        '    BAMBU_EMAIL=seu@email.com pnpm tsx scripts/cloud-poc.ts\n',
    );
    process.exit(1);
  }

  console.log('==========================================');
  console.log('  Bambu Cloud POC — email code → MQTT cloud');
  console.log('==========================================');
  console.log(`  email: ${email}`);

  // Permitir pular o passo de pedir código (modo CI/chat-friendly).
  // Se BAMBU_CODE já está setado, NÃO manda novo email (o anterior ainda
  // é válido). Caso contrário, manda email e pede via prompt.
  const presetCode = process.env.BAMBU_CODE;

  if (!presetCode) {
    await requestEmailCode(email);
  } else {
    console.log(`\n[1/5] sendemail SKIP (BAMBU_CODE preset)`);
  }
  const code = presetCode ?? (await promptCode());
  console.log(`\n  usando código: ${code.slice(0, 2)}****`);
  const accessToken = await loginWithCode(email, code);
  const devices = await listDevices(accessToken);
  if (devices.length === 0) {
    console.error('\nNenhuma impressora vinculada à conta. Abortando.');
    process.exit(1);
  }
  const userId = await getUserId(accessToken);
  const client = connectMqttCloud(userId, accessToken, devices);

  console.log(`\nAguardando telemetria por ${POLL_DURATION_MS / 1000}s...\n`);

  const exitTimer = setTimeout(() => {
    console.log('\n[done] tempo esgotado, fechando conexão.');
    client.end(true, undefined, () => process.exit(0));
  }, POLL_DURATION_MS);

  process.on('SIGINT', () => {
    clearTimeout(exitTimer);
    console.log('\n[SIGINT] fechando.');
    client.end(true, undefined, () => process.exit(0));
  });
}

main().catch((err) => {
  console.error('\n❌ POC falhou:', err.message);
  process.exit(1);
});

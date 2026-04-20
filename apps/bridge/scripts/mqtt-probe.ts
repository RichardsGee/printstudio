import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import mqtt from 'mqtt';

const ip = process.env.PRINTER_1_IP!;
const serial = process.env.PRINTER_1_SERIAL!;
const accessCode = process.env.PRINTER_1_ACCESS_CODE!;

console.log(`Probing mqtts://${ip}:8883 (serial ${serial})`);

const client = mqtt.connect(`mqtts://${ip}:8883`, {
  username: 'bblp',
  password: accessCode,
  rejectUnauthorized: false,
  servername: serial,
  reconnectPeriod: 0,
  connectTimeout: 15_000,
  clean: true,
  keepalive: 5,
  protocolVersion: 4,
  clientId: `ha-bambulab-${Math.random().toString(36).slice(2, 10)}`,
});

client.on('connect', (connack) => {
  console.log('✓ CONNECTED', { sessionPresent: connack.sessionPresent, returnCode: connack.returnCode });
  const topic = `device/${serial}/report`;
  console.log(`  Subscribing to ${topic}`);
  client.subscribe(topic, { qos: 0 }, (err, granted) => {
    if (err) console.error('  ✗ SUB ERR:', err.message);
    else {
      console.log('  ✓ SUBSCRIBED', granted);
      const reqTopic = `device/${serial}/request`;
      console.log(`  Publishing pushall to ${reqTopic}`);
      client.publish(reqTopic, JSON.stringify({ pushing: { sequence_id: '1', command: 'pushall' } }));
    }
  });
});

client.on('message', (topic, payload) => {
  const text = payload.toString('utf-8').slice(0, 500);
  console.log(`✓ MESSAGE on ${topic}:`, text.length > 200 ? text.slice(0, 200) + '...' : text);
});

client.on('error', (err) => console.error('✗ ERROR:', err.message));
client.on('close', () => console.log('✗ CLOSE'));
client.on('disconnect', (pkt) => console.log('✗ DISCONNECT packet:', pkt));
client.on('reconnect', () => console.log('… RECONNECT'));
client.on('offline', () => console.log('… OFFLINE'));
client.on('packetreceive', (pkt) => {
  if (pkt.cmd !== 'publish') console.log('  packetreceive:', pkt.cmd, pkt);
});

setTimeout(() => {
  console.log('\n⏱  25s timeout reached, exiting.');
  client.end(true);
  process.exit(0);
}, 25_000);

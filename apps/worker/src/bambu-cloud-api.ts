/**
 * HTTP client minimalista pra api.bambulab.com — apenas o endpoint
 * /user/bind (lista as impressoras vinculadas). Os outros endpoints
 * (login, send-code) ficam no api do PrintStudio (Story 4.4) — worker
 * só consome o accessToken já obtido.
 */

const API_BASE = 'https://api.bambulab.com';

const HTTP_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'bambu_network_agent/01.09.05.01',
  'X-BBL-Client-Name': 'OrcaSlicer',
  'X-BBL-Client-Type': 'slicer',
  'X-BBL-Client-Version': '01.09.05.51',
};

export interface BambuBoundDevice {
  serial: string; // dev_id
  name: string;
  online: boolean;
  productName: string;
}

interface BindApiResponse {
  message: string;
  devices: Array<{
    dev_id: string;
    name: string;
    online: boolean;
    dev_product_name: string;
  }>;
}

export async function listBoundDevices(accessToken: string): Promise<BambuBoundDevice[]> {
  const res = await fetch(`${API_BASE}/v1/iot-service/api/user/bind`, {
    headers: { ...HTTP_HEADERS, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`bind HTTP ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as BindApiResponse;
  return (body.devices ?? []).map((d) => ({
    serial: d.dev_id,
    name: d.name,
    online: d.online,
    productName: d.dev_product_name,
  }));
}

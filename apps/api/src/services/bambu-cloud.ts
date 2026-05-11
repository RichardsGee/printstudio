/**
 * Cliente HTTP pra Bambu Cloud (não-oficial). Encapsula os 3 endpoints
 * que precisamos pra fluxo de "conectar conta":
 *
 *   - sendEmailCode  → dispara código de verificação no email do user
 *   - loginWithCode  → troca email+code por accessToken/refreshToken
 *   - listDevices    → lista impressoras vinculadas à conta (user/bind)
 *   - getUserId      → resolve uid pro MQTT cloud (design-user-service)
 *
 * As respostas de erro são normalizadas em BambuCloudError com `code`
 * compatível com BambuErrorCode do @printstudio/shared.
 */

import type { BambuErrorCode } from '@printstudio/shared';

const API_BASE = 'https://api.bambulab.com';

const HTTP_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'bambu_network_agent/01.09.05.01',
  'X-BBL-Client-Name': 'OrcaSlicer',
  'X-BBL-Client-Type': 'slicer',
  'X-BBL-Client-Version': '01.09.05.51',
};

export class BambuCloudError extends Error {
  constructor(
    public readonly code: BambuErrorCode,
    message: string,
    public readonly upstreamStatus?: number,
  ) {
    super(message);
    this.name = 'BambuCloudError';
  }
}

export interface BambuLoginResult {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number; // segundos
}

export interface BambuDeviceRaw {
  dev_id: string;
  name: string;
  online: boolean;
  print_status: string;
  dev_model_name: string;
  dev_product_name: string;
  dev_access_code: string;
}

interface LoginApiResponse {
  accessToken?: string;
  refreshToken?: string;
  loginType?: string;
  expiresIn?: number;
  tfaKey?: string;
}

interface BindApiResponse {
  message: string;
  devices: BambuDeviceRaw[];
}

interface UserPreferenceApiResponse {
  uidStr?: string;
  uid?: number | string;
}

function throwUpstream(status: number, body: string): never {
  if (status === 429) {
    throw new BambuCloudError('BAMBU_RATE_LIMITED', 'Bambu Cloud rate limit (429)', status);
  }
  throw new BambuCloudError(
    'BAMBU_UPSTREAM_ERROR',
    `Bambu Cloud HTTP ${status}: ${body.slice(0, 200)}`,
    status,
  );
}

export async function sendEmailCode(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/v1/user-service/user/sendemail/code`, {
    method: 'POST',
    headers: HTTP_HEADERS,
    body: JSON.stringify({ email, type: 'codeLogin' }),
  });
  if (!res.ok) throwUpstream(res.status, await res.text());
}

export async function loginWithCode(
  email: string,
  code: string,
): Promise<BambuLoginResult> {
  const res = await fetch(`${API_BASE}/v1/user-service/user/login`, {
    method: 'POST',
    headers: HTTP_HEADERS,
    body: JSON.stringify({ account: email, code }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 400 && body.includes('error')) {
      throw new BambuCloudError(
        'BAMBU_INVALID_CODE',
        'Código inválido ou expirado',
        res.status,
      );
    }
    throwUpstream(res.status, body);
  }
  const data = (await res.json()) as LoginApiResponse;
  if (data.loginType === 'verifyCode') {
    throw new BambuCloudError(
      'BAMBU_VERIFY_REQUIRED',
      'Bambu pediu nova verificação',
      res.status,
    );
  }
  if (data.loginType === 'tfa') {
    throw new BambuCloudError(
      'BAMBU_TFA_REQUIRED',
      'Conta exige 2FA — não suportado nesta versão',
      res.status,
    );
  }
  if (!data.accessToken) {
    throw new BambuCloudError(
      'BAMBU_UPSTREAM_ERROR',
      `Login sem accessToken (loginType=${data.loginType ?? 'unknown'})`,
      res.status,
    );
  }
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? null,
    expiresIn: data.expiresIn ?? 60 * 60 * 24 * 90, // 90d default
  };
}

export async function listDevices(accessToken: string): Promise<BambuDeviceRaw[]> {
  const res = await fetch(`${API_BASE}/v1/iot-service/api/user/bind`, {
    headers: { ...HTTP_HEADERS, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throwUpstream(res.status, await res.text());
  const data = (await res.json()) as BindApiResponse;
  return data.devices ?? [];
}

export async function getUserId(accessToken: string): Promise<string> {
  const res = await fetch(`${API_BASE}/v1/design-user-service/my/preference`, {
    headers: { ...HTTP_HEADERS, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throwUpstream(res.status, await res.text());
  const data = (await res.json()) as UserPreferenceApiResponse;
  const uid = data.uidStr ?? (data.uid !== undefined ? String(data.uid) : null);
  if (!uid) {
    throw new BambuCloudError(
      'BAMBU_UPSTREAM_ERROR',
      'Bambu preference sem uid',
      res.status,
    );
  }
  return uid;
}

'use client';

import { useEffect, useState } from 'react';

export type ConnectionMode = 'lan' | 'cloud';

export interface ConnectionInfo {
  mode: ConnectionMode;
  baseUrl: string;
  wsUrl: string;
  detecting: boolean;
}

const CLOUD_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const CLOUD_WS = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000/ws/client';

export async function detectConnection(): Promise<ConnectionInfo> {
  // TODO: re-enable LAN probe once the bridge exposes a protocol-compatible
  // `/ws/client` endpoint. For now the API (which can be on the same machine
  // in dev) is the only WS path the client speaks.
  return {
    mode: 'cloud',
    baseUrl: CLOUD_API,
    wsUrl: CLOUD_WS,
    detecting: false,
  };
}

export function useConnection(): ConnectionInfo {
  const [info, setInfo] = useState<ConnectionInfo>({
    mode: 'cloud',
    baseUrl: CLOUD_API,
    wsUrl: CLOUD_WS,
    detecting: true,
  });

  useEffect(() => {
    let cancelled = false;
    detectConnection().then((next) => {
      if (!cancelled) setInfo(next);
    });
    // Re-probe when network status flips
    const onOnline = () => {
      detectConnection().then((next) => {
        if (!cancelled) setInfo(next);
      });
    };
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return info;
}

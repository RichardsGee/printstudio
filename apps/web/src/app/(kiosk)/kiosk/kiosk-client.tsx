'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useConnection } from '@/lib/connection';
import { WsClient } from '@/lib/ws-client';
import { usePrinterStore } from '@/lib/store';
import { useWakeLock } from '@/lib/use-wake-lock';
import { KioskPrinterCard } from '@/components/kiosk/kiosk-printer-card';
import { KioskStatusBanner } from '@/components/kiosk/kiosk-status-banner';

interface Props {
  printers: { id: string; name: string }[];
}

export function KioskClient({ printers }: Props) {
  useWakeLock(true);

  const { wsUrl, detecting } = useConnection();
  const states = usePrinterStore((s) => s.states);
  const setState = usePrinterStore((s) => s.setState);
  const pushEvent = usePrinterStore((s) => s.pushEvent);
  const clientRef = useRef<WsClient | null>(null);

  const ids = useMemo(() => printers.map((p) => p.id), [printers]);

  useEffect(() => {
    if (detecting || ids.length === 0) return;

    const client = new WsClient(wsUrl);
    clientRef.current = client;
    const off = client.onMessage((msg) => {
      if (msg.type === 'printer.state') setState(msg.payload);
      else if (msg.type === 'printer.event') pushEvent(msg.payload);
    });

    client.connect();
    client.subscribe(ids);

    return () => {
      off();
      client.close();
    };
  }, [wsUrl, detecting, ids, setState, pushEvent]);

  if (printers.length === 0) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          <div className="text-2xl font-semibold">Nenhuma impressora cadastrada</div>
          <div className="text-sm mt-2">Adicione impressoras no painel admin para vê-las aqui.</div>
        </div>
      </div>
    );
  }

  // Grade adapta às quantidades + breakpoints. Em monitor de parede
  // (≥1280px) chega a 3-4 colunas; em tablet portrait fica 1-2;
  // em phone, sempre 1 coluna.
  const cols = printers.length;
  const gridClass =
    cols === 1
      ? 'grid-cols-1'
      : cols === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : cols === 3
          ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
          : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';

  return (
    <div className="min-h-dvh p-4 md:p-6 space-y-4 md:space-y-6">
      <KioskStatusBanner printers={printers} states={states} />
      <div className={`grid gap-4 md:gap-6 ${gridClass}`}>
        {printers.map((p) => (
          <KioskPrinterCard
            key={p.id}
            printerId={p.id}
            name={p.name}
            state={states[p.id]}
          />
        ))}
      </div>
    </div>
  );
}

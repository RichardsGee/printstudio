'use client';

import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useConnection } from '@/lib/connection';
import { WsClient } from '@/lib/ws-client';
import { usePrinterStore } from '@/lib/store';
import { PrinterCard } from '@/components/printer-card';

interface Props {
  printers: { id: string; name: string }[];
}

export function DashboardClient({ printers }: Props) {
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
      else if (msg.type === 'printer.event') {
        pushEvent(msg.payload);
        if (msg.payload.severity === 'ERROR')
          toast.error(msg.payload.message);
      } else if (msg.type === 'error') {
        toast.error(msg.payload.message);
      }
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
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        Nenhuma impressora cadastrada.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {printers.map((p) => (
        <PrinterCard
          key={p.id}
          printerId={p.id}
          name={p.name}
          state={states[p.id]}
        />
      ))}
    </div>
  );
}

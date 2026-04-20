'use client';

import { Cloud, Wifi } from 'lucide-react';
import { useConnection } from '@/lib/connection';
import { Badge } from '@/components/ui/badge';

export function DualModeIndicator() {
  const { mode, detecting } = useConnection();

  if (detecting) {
    return (
      <Badge variant="outline" className="gap-1.5">
        <span className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" />
        Detectando…
      </Badge>
    );
  }

  if (mode === 'lan') {
    return (
      <Badge variant="success" className="gap-1.5">
        <Wifi className="h-3 w-3" />
        LAN
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1.5">
      <Cloud className="h-3 w-3" />
      Cloud
    </Badge>
  );
}

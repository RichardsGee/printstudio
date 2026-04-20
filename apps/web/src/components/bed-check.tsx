'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const LAN_HOST = process.env.NEXT_PUBLIC_LAN_DISCOVERY_HOST ?? 'localhost';
const LAN_PORT = process.env.NEXT_PUBLIC_LAN_DISCOVERY_PORT ?? '8080';

interface BedCheckResult {
  hasPlate: boolean;
  confidence: 'high' | 'medium' | 'low';
  edgeDensity: number;
  threshold: number;
  previewBase64: string;
  capturedAt: number;
}

const CONF_LABEL: Record<BedCheckResult['confidence'], string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export function BedCheckCard({ printerId }: { printerId: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [result, setResult] = useState<BedCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (): Promise<void> => {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch(
        `http://${LAN_HOST}:${LAN_PORT}/api/printers/${printerId}/bed-check`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data: BedCheckResult = await res.json();
      setResult(data);
      setStatus('ok');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro desconhecido');
      setStatus('error');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Verificação da mesa
        </CardTitle>
        <Button size="sm" variant="outline" onClick={run} disabled={status === 'loading'}>
          {status === 'loading' ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : null}
          Verificar chapa
        </Button>
      </CardHeader>
      <CardContent className="pb-3">
        {status === 'idle' ? (
          <p className="text-xs text-muted-foreground">
            Análise visual da chapa magnética antes de iniciar uma impressão. Captura um
            frame da câmera e verifica se há chapa na mesa.
          </p>
        ) : null}

        {status === 'error' ? (
          <div className="text-xs text-red-400">Falha: {error ?? 'erro'}</div>
        ) : null}

        {status === 'ok' && result ? (
          <div className="grid gap-3 md:grid-cols-[1fr_auto] items-center">
            {/* Preview */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${result.previewBase64}`}
              alt="Frame analisado"
              className="w-full max-w-xs rounded-md border border-border/60"
            />

            <div className="space-y-2">
              <div
                className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-2',
                  result.hasPlate
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                    : 'border-red-500/60 bg-red-500/10 text-red-200',
                )}
              >
                {result.hasPlate ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
                <div>
                  <div className="text-sm font-medium">
                    {result.hasPlate ? 'Chapa detectada' : 'Chapa não detectada'}
                  </div>
                  <div className="text-[11px] opacity-80">
                    Confiança: {CONF_LABEL[result.confidence]}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground font-mono space-y-0.5">
                <div>
                  Edge density: {(result.edgeDensity * 100).toFixed(2)}%
                </div>
                <div>
                  Limiar: {(result.threshold * 100).toFixed(2)}%
                </div>
                <div>
                  {new Date(result.capturedAt).toLocaleTimeString('pt-BR')}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

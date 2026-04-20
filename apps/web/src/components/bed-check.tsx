'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, Loader2, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const LAN_HOST = process.env.NEXT_PUBLIC_LAN_DISCOVERY_HOST ?? 'localhost';
const LAN_PORT = process.env.NEXT_PUBLIC_LAN_DISCOVERY_PORT ?? '8080';

interface BedCheckResult {
  hasPlate: boolean;
  plateClean: boolean | null;
  confidence: 'high' | 'medium' | 'low';
  similarityWithPlate: number | null;
  similarityNoPlate: number | null;
  edgeDensity: number;
  threshold: number;
  mode: 'baseline' | 'heuristic';
  previewBase64: string;
  capturedAt: number;
}

const CONF_LABEL: Record<BedCheckResult['confidence'], string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export function BedCheckCard({ printerId }: { printerId: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'calibrating' | 'ok' | 'error'>('idle');
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

  const calibrate = async (type: 'with' | 'no'): Promise<void> => {
    setStatus('calibrating');
    try {
      const res = await fetch(
        `http://${LAN_HOST}:${LAN_PORT}/api/printers/${printerId}/bed-check/calibrate?type=${type}`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      toast.success(
        type === 'with'
          ? 'Baseline "com chapa" salvo'
          : 'Baseline "sem chapa" salvo',
      );
      setStatus('idle');
    } catch (err) {
      toast.error('Calibração falhou: ' + (err instanceof Error ? err.message : 'erro'));
      setStatus('idle');
    }
  };

  const busy = status === 'loading' || status === 'calibrating';

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Verificação da mesa
        </CardTitle>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="ghost" onClick={() => calibrate('with')} disabled={busy}>
            <Camera className="h-3.5 w-3.5 mr-1.5" />
            Calibrar: com chapa
          </Button>
          <Button size="sm" variant="ghost" onClick={() => calibrate('no')} disabled={busy}>
            <Camera className="h-3.5 w-3.5 mr-1.5" />
            Calibrar: sem chapa
          </Button>
          <Button size="sm" variant="outline" onClick={run} disabled={busy}>
            {status === 'loading' ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : null}
            Verificar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        {status === 'idle' ? (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong className="text-foreground">Primeiro uso:</strong> posicione a mesa com a
              chapa e clique em <strong>Calibrar: com chapa</strong>. Depois remova a chapa e
              clique em <strong>Calibrar: sem chapa</strong>.
            </p>
            <p>
              Com os dois baselines, a detecção compara cada frame atual com as referências —
              muito mais preciso que edge-density puro.
            </p>
          </div>
        ) : null}

        {status === 'calibrating' ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Capturando baseline…
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="text-xs text-red-400">Falha: {error ?? 'erro'}</div>
        ) : null}

        {status === 'ok' && result ? (
          <div className="grid gap-3 md:grid-cols-[1fr_auto] items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${result.previewBase64}`}
              alt="Frame analisado"
              className="w-full max-w-xs rounded-md border border-border/60"
            />

            <div className="space-y-2 min-w-[220px]">
              {/* Chapa presente? */}
              <Indicator
                ok={result.hasPlate}
                okLabel="Chapa detectada"
                failLabel="Chapa não detectada"
                confidence={CONF_LABEL[result.confidence]}
              />

              {/* Mesa limpa? Só aparece se tiver baseline calibrado */}
              {result.plateClean !== null ? (
                <Indicator
                  ok={result.plateClean}
                  okLabel="Mesa limpa"
                  failLabel="Algo detectado na mesa"
                  confidence={
                    result.similarityWithPlate
                      ? `${(result.similarityWithPlate * 100).toFixed(0)}% similar ao baseline`
                      : undefined
                  }
                />
              ) : null}

              {/* Veredito final pra ação */}
              {result.plateClean !== null ? (
                <VerdictBanner hasPlate={result.hasPlate} plateClean={result.plateClean} />
              ) : null}

              <div className="text-[10px] text-muted-foreground font-mono space-y-0.5 pt-1 border-t border-border/40">
                <div>Modo: {result.mode === 'baseline' ? 'comparação' : 'heurística'}</div>
                {result.similarityWithPlate !== null ? (
                  <div>Sim. limpa: {(result.similarityWithPlate * 100).toFixed(1)}%</div>
                ) : null}
                {result.similarityNoPlate !== null ? (
                  <div>Sim. s/ chapa: {(result.similarityNoPlate * 100).toFixed(1)}%</div>
                ) : null}
                <div>Edge density: {(result.edgeDensity * 100).toFixed(2)}%</div>
                <div>{new Date(result.capturedAt).toLocaleTimeString('pt-BR')}</div>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Indicator({
  ok,
  okLabel,
  failLabel,
  confidence,
}: {
  ok: boolean;
  okLabel: string;
  failLabel: string;
  confidence?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border px-2.5 py-1.5',
        ok
          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
          : 'border-red-500/60 bg-red-500/10 text-red-200',
      )}
    >
      {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      <div className="min-w-0">
        <div className="text-xs font-medium">{ok ? okLabel : failLabel}</div>
        {confidence ? <div className="text-[10px] opacity-75 truncate">{confidence}</div> : null}
      </div>
    </div>
  );
}

function VerdictBanner({ hasPlate, plateClean }: { hasPlate: boolean; plateClean: boolean }) {
  const ready = hasPlate && plateClean;
  const message = !hasPlate
    ? '⚠ Coloque a chapa antes de imprimir'
    : !plateClean
      ? '⚠ Remova o que está na mesa'
      : '✓ Pronto pra imprimir';
  return (
    <div
      className={cn(
        'text-xs font-medium rounded px-2.5 py-1.5 text-center',
        ready ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200',
      )}
    >
      {message}
    </div>
  );
}

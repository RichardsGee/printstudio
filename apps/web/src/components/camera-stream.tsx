'use client';

import { useState } from 'react';
import { Play, Square, VideoOff } from 'lucide-react';

const LAN_HOST = process.env.NEXT_PUBLIC_LAN_DISCOVERY_HOST ?? 'printstudio.local';
const LAN_PORT = process.env.NEXT_PUBLIC_LAN_DISCOVERY_PORT ?? '8080';

interface Props {
  printerId: string;
}

/**
 * MJPEG player da câmera A1. A stream é iniciada manualmente pelo
 * usuário — o `<img>` só é montado depois de clicar em "Iniciar", e
 * desmonta ao pausar. Isso evita ter a câmera ligada 24/7 (impressora
 * liga o LED, aquece e consome banda mesmo quando ninguém assiste).
 *
 * O bridge expõe `multipart/x-mixed-replace`, então o browser pinta
 * direto via `<img>` sem decoder JS. Quando a tag desmonta, o HTTP
 * request é abortado — o bridge detecta via o `close` do response e
 * libera a conexão com a impressora (camera-manager).
 */
export function CameraStream({ printerId }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [nonce, setNonce] = useState(0);

  const src = `http://${LAN_HOST}:${LAN_PORT}/api/printers/${printerId}/camera.mjpeg?t=${nonce}`;

  const start = (): void => {
    setStatus('loading');
    setNonce((n) => n + 1);
  };

  const stop = (): void => {
    setStatus('idle');
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
      {status === 'idle' ? (
        <div className="absolute inset-0 grid place-items-center gap-3">
          <button
            type="button"
            onClick={start}
            className="flex items-center gap-2 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium transition-colors shadow-lg"
          >
            <Play className="h-4 w-4 fill-current" />
            Iniciar câmera
          </button>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Ao vivo apenas quando ativada
          </span>
        </div>
      ) : status === 'error' ? (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground gap-2 flex-col">
          <VideoOff className="h-8 w-8" />
          <span>Câmera indisponível</span>
          <div className="flex gap-2">
            <button
              onClick={start}
              className="text-xs underline hover:text-foreground"
            >
              Tentar novamente
            </button>
            <button
              onClick={stop}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Parar
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Câmera da impressora"
            onLoad={() => setStatus('ok')}
            onError={() => setStatus('error')}
            className="h-full w-full object-contain"
          />
          {status === 'loading' ? (
            <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground bg-black/50">
              Conectando câmera…
            </div>
          ) : null}
          {/* Botão pra parar — sobrepõe a stream */}
          <button
            type="button"
            onClick={stop}
            className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 text-white px-2.5 py-1 text-[11px] font-medium transition-colors"
          >
            <Square className="h-3 w-3 fill-current" />
            Parar
          </button>
          {status === 'ok' ? (
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[10px] font-mono text-white/90 bg-red-600/80 backdrop-blur-sm px-1.5 py-0.5 rounded">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              AO VIVO
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { VideoOff } from 'lucide-react';

const LAN_HOST = process.env.NEXT_PUBLIC_LAN_DISCOVERY_HOST ?? 'printstudio.local';
const LAN_PORT = process.env.NEXT_PUBLIC_LAN_DISCOVERY_PORT ?? '8080';

interface Props {
  printerId: string;
}

/**
 * MJPEG stream player. The bridge exposes `multipart/x-mixed-replace` so the
 * browser paints it natively via a plain `<img>` — no JS decoder needed.
 *
 * Bambu A1 only exposes the camera on the LAN, so we hardcode the LAN bridge
 * URL regardless of the app's current connection mode. If the bridge isn't
 * reachable, we surface a disabled state instead of a broken image.
 */
export function CameraStream({ printerId }: Props) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Cache-buster changes whenever we want to force-reconnect the stream.
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    setStatus('loading');
  }, [printerId, nonce]);

  const src = `http://${LAN_HOST}:${LAN_PORT}/api/printers/${printerId}/camera.mjpeg?t=${nonce}`;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
      {status === 'error' ? (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground gap-2 flex-col">
          <VideoOff className="h-8 w-8" />
          <span>Câmera indisponível</span>
          <button
            onClick={() => setNonce((n) => n + 1)}
            className="text-xs underline hover:text-foreground"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
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
        </>
      )}
    </div>
  );
}

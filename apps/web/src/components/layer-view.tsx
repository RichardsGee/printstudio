'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Layers as LayersIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const LAN_HOST = process.env.NEXT_PUBLIC_LAN_DISCOVERY_HOST ?? 'localhost';
const LAN_PORT = process.env.NEXT_PUBLIC_LAN_DISCOVERY_PORT ?? '8080';

interface LayersData {
  fileName: string;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  totalLayers: number;
  layers: Array<{ z: number; paths: number[][][] }>;
}

interface Props {
  printerId: string;
  cacheKey?: string | null;
  currentLayer?: number | null;
  totalLayers?: number | null;
  className?: string;
}

const PAD = 4;

/**
 * Visualização do slice atual baseada no gcode parseado. Renderiza cada
 * camada como um `<g>` SVG com um path por polilinha de extrusão. As
 * camadas já concluídas aparecem em azul esmaecido; a camada atual fica
 * destacada em verde neon; camadas futuras são ocultadas.
 *
 * Performance: todas as camadas são renderizadas uma única vez (sem
 * re-render no React) e a mudança de camada atual apenas atualiza
 * atributos via DOM direto — isso mantém a UI fluida mesmo com 200+
 * camadas e milhares de polilinhas.
 */
export function LayerView({ printerId, cacheKey, currentLayer, totalLayers, className }: Props) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty'>('loading');
  const [data, setData] = useState<LayersData | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const layerGroupsRef = useRef<SVGGElement[]>([]);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    setData(null);
    const url = `http://${LAN_HOST}:${LAN_PORT}/api/printers/${printerId}/layers.json?v=${encodeURIComponent(
      cacheKey ?? 'none',
    )}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((payload: LayersData) => {
        if (!alive) return;
        if (!payload.layers || payload.layers.length === 0) {
          setStatus('empty');
          return;
        }
        setData(payload);
        setStatus('ok');
      })
      .catch(() => {
        if (alive) setStatus('empty');
      });
    return () => {
      alive = false;
    };
  }, [printerId, cacheKey]);

  const { width, height, pathsByLayer } = useMemo(() => {
    if (!data) return { width: 0, height: 0, pathsByLayer: [] as string[][] };
    const w = data.bounds.maxX - data.bounds.minX;
    const h = data.bounds.maxY - data.bounds.minY;
    const ox = data.bounds.minX;
    const oy = data.bounds.minY;
    const pathsByLayer = data.layers.map((layer) =>
      layer.paths.map((poly) => polylineToPath(poly, ox, oy, h)),
    );
    return { width: w, height: h, pathsByLayer };
  }, [data]);

  // Imperatively reflect currentLayer into visibility without re-rendering SVG.
  useEffect(() => {
    const groups = layerGroupsRef.current;
    if (!groups.length) return;
    // `currentLayer` vem 1-indexed do Bambu. Se não tem impressão ativa
    // (null ou 0), mostra o modelo inteiro em preview, sem camada ativa.
    const active = currentLayer && currentLayer > 0;
    const idx = active ? Math.min(currentLayer - 1, groups.length - 1) : -1;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (!g) continue;
      if (!active) g.setAttribute('class', 'layer-preview');
      else if (i < idx) g.setAttribute('class', 'layer-done');
      else if (i === idx) g.setAttribute('class', 'layer-active');
      else g.setAttribute('class', 'layer-future');
    }
  }, [currentLayer, data]);

  return (
    <div
      className={cn(
        'relative aspect-square w-full overflow-hidden rounded-md border border-border/60 bg-[#0a0d14]',
        className,
      )}
    >
      {status === 'ok' && data ? (
        <>
          <svg
            ref={svgRef}
            viewBox={`${-PAD} ${-PAD} ${width + PAD * 2} ${height + PAD * 2}`}
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              <style>{`
                .layer-done path { stroke: hsl(217 70% 45% / 0.45); stroke-width: 0.25; fill: none; }
                .layer-active path { stroke: hsl(142 80% 55%); stroke-width: 0.5; fill: none; filter: drop-shadow(0 0 1px hsl(142 80% 55%)); }
                .layer-future { display: none; }
                .layer-preview path { stroke: hsl(217 50% 55% / 0.3); stroke-width: 0.25; fill: none; }
              `}</style>
            </defs>
            {pathsByLayer.map((paths, i) => (
              <g
                key={i}
                ref={(el) => {
                  if (el) layerGroupsRef.current[i] = el;
                }}
                className="layer-future"
              >
                {paths.map((d, j) => (
                  <path key={j} d={d} />
                ))}
              </g>
            ))}
          </svg>
          <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-[10px] font-mono text-muted-foreground pointer-events-none">
            <span className="flex items-center gap-1">
              <LayersIcon className="h-3 w-3" />
              {currentLayer ?? 0}/{totalLayers ?? data.totalLayers}
            </span>
            {data.layers[Math.max(0, Math.min((currentLayer ?? 1) - 1, data.layers.length - 1))] ? (
              <span>
                Z{' '}
                {data.layers[
                  Math.max(0, Math.min((currentLayer ?? 1) - 1, data.layers.length - 1))
                ].z.toFixed(2)}
                mm
              </span>
            ) : null}
          </div>
        </>
      ) : null}

      {status !== 'ok' ? (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
          <div className="flex flex-col items-center gap-1 text-xs">
            <Box className="h-6 w-6" strokeWidth={1.5} />
            <span>{status === 'loading' ? 'Analisando fatias…' : 'Sem visualização 3D'}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Converte polilinha [[x,y], …] em um atributo SVG "d" flip-Y (porque a
 * mesa da impressora tem origem no canto inferior esquerdo, mas SVG é
 * topo-esquerda). A normalização pelo bounding box mantém tudo dentro do
 * viewBox sem depender de transformação externa.
 */
function polylineToPath(poly: number[][], ox: number, oy: number, height: number): string {
  if (poly.length === 0) return '';
  let d = `M${(poly[0][0] - ox).toFixed(2)},${(height - (poly[0][1] - oy)).toFixed(2)}`;
  for (let i = 1; i < poly.length; i++) {
    d += ` L${(poly[i][0] - ox).toFixed(2)},${(height - (poly[i][1] - oy)).toFixed(2)}`;
  }
  return d;
}

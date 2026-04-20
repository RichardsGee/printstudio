'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Layers as LayersIcon, Maximize2 } from 'lucide-react';
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

// Projeção isométrica 30° — world (x, y, z) → screen (sx, sy).
const COS_A = Math.cos((30 * Math.PI) / 180);
const SIN_A = Math.sin((30 * Math.PI) / 180);

function project(x: number, y: number, z: number, zScale: number): [number, number] {
  const sx = (x - y) * COS_A;
  const sy = (x + y) * SIN_A - z * zScale;
  return [sx, sy];
}

/**
 * Z_SCALE adaptativo: pra modelos baixos (ex. chaveiro 2mm) a altura
 * empilhada seria invisível se usássemos escala 1:1 com o XY. Queremos
 * que a altura projetada represente ~40-50% da maior dimensão XY.
 */
function adaptiveZScale(xRange: number, yRange: number, zMax: number): number {
  if (zMax <= 0.01) return 1;
  const xyExtent = Math.max(xRange, yRange);
  const targetHeight = xyExtent * 0.45;
  const scale = targetHeight / zMax;
  return Math.max(1, Math.min(scale, 30));
}

/**
 * Preview isométrico das camadas do gcode. Mostra sempre o modelo
 * inteiro: camadas já impressas aparecem sólidas em azul, a camada
 * atual é o destaque em verde neon, e camadas futuras ficam como
 * fantasma cinza muito esmaecido — pra o usuário ver a forma final
 * e acompanhar o progresso da impressão ao mesmo tempo.
 *
 * Atualizações em tempo real mudam apenas a `class` de cada `<g>` no
 * DOM — sem re-render React.
 */
export function LayerView({ printerId, cacheKey, currentLayer, totalLayers, className }: Props) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty'>('loading');
  const [data, setData] = useState<LayersData | null>(null);
  const layerGroupsRef = useRef<SVGGElement[]>([]);
  const retryRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let alive = true;
    let attempt = 0;
    setStatus('loading');
    setData(null);

    const fetchOnce = (): void => {
      const url = `http://${LAN_HOST}:${LAN_PORT}/api/printers/${printerId}/layers.json?v=${encodeURIComponent(
        cacheKey ?? 'none',
      )}`;
      fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((payload: LayersData) => {
          if (!alive) return;
          if (!payload.layers || payload.layers.length === 0) {
            throw new Error('empty layers');
          }
          setData(payload);
          setStatus('ok');
        })
        .catch(() => {
          if (!alive) return;
          attempt++;
          const delay = Math.min(3000 * Math.pow(2, attempt - 1), 30000);
          if (attempt === 1) setStatus('empty');
          retryRef.current = setTimeout(fetchOnce, delay);
        });
    };

    fetchOnce();
    return () => {
      alive = false;
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [printerId, cacheKey]);

  const { paths, bounds, zScale } = useMemo(() => {
    if (!data) {
      return {
        paths: [] as string[][],
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
        zScale: 1,
      };
    }
    const xRange = data.bounds.maxX - data.bounds.minX;
    const yRange = data.bounds.maxY - data.bounds.minY;
    const zMax = data.layers.length > 0 ? data.layers[data.layers.length - 1].z : 0;
    const zS = adaptiveZScale(xRange, yRange, zMax);

    let minSX = Number.POSITIVE_INFINITY;
    let maxSX = Number.NEGATIVE_INFINITY;
    let minSY = Number.POSITIVE_INFINITY;
    let maxSY = Number.NEGATIVE_INFINITY;

    const projected: string[][] = data.layers.map((layer) =>
      layer.paths.map((poly) => {
        if (poly.length === 0) return '';
        const [fx, fy] = project(poly[0][0], poly[0][1], layer.z, zS);
        if (fx < minSX) minSX = fx;
        if (fx > maxSX) maxSX = fx;
        if (fy < minSY) minSY = fy;
        if (fy > maxSY) maxSY = fy;
        let d = `M${fx.toFixed(2)},${fy.toFixed(2)}`;
        for (let i = 1; i < poly.length; i++) {
          const [sx, sy] = project(poly[i][0], poly[i][1], layer.z, zS);
          if (sx < minSX) minSX = sx;
          if (sx > maxSX) maxSX = sx;
          if (sy < minSY) minSY = sy;
          if (sy > maxSY) maxSY = sy;
          d += ` L${sx.toFixed(2)},${sy.toFixed(2)}`;
        }
        return d;
      }),
    );

    if (!Number.isFinite(minSX)) {
      minSX = 0;
      maxSX = 0;
      minSY = 0;
      maxSY = 0;
    }
    return {
      paths: projected,
      bounds: { minX: minSX, maxX: maxSX, minY: minSY, maxY: maxSY },
      zScale: zS,
    };
  }, [data]);

  // Aplica status via classe no DOM conforme a camada atual avança.
  // `done` / `active` / `future` — todas são renderizadas e visíveis,
  // apenas com estilos diferentes (nunca escondemos mais).
  useEffect(() => {
    const groups = layerGroupsRef.current;
    if (!groups.length) return;
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

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const pad = Math.max(width, height) * 0.06;
  const currentZ =
    data && currentLayer && currentLayer > 0
      ? data.layers[Math.min(currentLayer - 1, data.layers.length - 1)]?.z
      : null;

  return (
    <div
      className={cn(
        'group relative aspect-square w-full rounded-md border border-border/60 bg-[#060910]',
        'transition-all duration-300 ease-out',
        'hover:scale-[1.12] hover:shadow-2xl hover:shadow-primary/30 hover:border-primary/50 hover:z-10',
        className,
      )}
    >
      <div className="absolute inset-0 overflow-hidden rounded-md">
        {status === 'ok' && data ? (
          <>
            <svg
              viewBox={`${bounds.minX - pad} ${bounds.minY - pad} ${width + pad * 2} ${height + pad * 2}`}
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 h-full w-full"
            >
              <defs>
                <style>{`
                  /* Camadas já impressas — sólidas em azul elétrico */
                  .layer-done path {
                    stroke: hsl(210 95% 62%);
                    stroke-width: 0.3;
                    fill: none;
                    stroke-linejoin: round;
                  }
                  /* Camada atual — destaque em verde neon com glow */
                  .layer-active path {
                    stroke: hsl(142 90% 60%);
                    stroke-width: 0.55;
                    fill: none;
                    stroke-linejoin: round;
                    filter: drop-shadow(0 0 1.2px hsl(142 90% 60%));
                  }
                  /* Camadas futuras — fantasma bem esmaecido pra manter a silhueta */
                  .layer-future path {
                    stroke: hsl(217 30% 50% / 0.15);
                    stroke-width: 0.18;
                    fill: none;
                    stroke-linejoin: round;
                  }
                  /* Preview quando sem impressão — todas com média intensidade */
                  .layer-preview path {
                    stroke: hsl(217 75% 58% / 0.45);
                    stroke-width: 0.22;
                    fill: none;
                    stroke-linejoin: round;
                  }
                `}</style>
              </defs>
              {paths.map((layerPaths, i) => (
                <g
                  key={i}
                  ref={(el) => {
                    if (el) layerGroupsRef.current[i] = el;
                  }}
                  className="layer-future"
                >
                  {layerPaths.map((d, j) => (
                    <path key={j} d={d} />
                  ))}
                </g>
              ))}
            </svg>

            {/* HUD inferior: camada atual + Z */}
            <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between text-[10px] font-mono text-muted-foreground pointer-events-none">
              <span className="flex items-center gap-1 bg-background/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
                <LayersIcon className="h-3 w-3" />
                {currentLayer ?? 0}/{totalLayers ?? data.totalLayers}
              </span>
              {currentZ !== null ? (
                <span className="bg-background/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
                  Z {currentZ.toFixed(2)}mm
                </span>
              ) : null}
            </div>

            {/* Hint de zoom aparece no hover */}
            <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <Maximize2 className="h-3.5 w-3.5 text-primary" />
            </div>
          </>
        ) : null}

        {status !== 'ok' ? (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground">
            <div className="flex flex-col items-center gap-1 text-xs">
              <Box className="h-6 w-6" strokeWidth={1.5} />
              <span>
                {status === 'loading'
                  ? 'Analisando fatias…'
                  : 'Aguardando fatia do próximo trabalho…'}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

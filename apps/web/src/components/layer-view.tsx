'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Layers as LayersIcon, Maximize2, X } from 'lucide-react';
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
  /** Cor hex do filamento ativo — camadas impressas renderizam nessa cor. */
  filamentColor?: string | null;
  className?: string;
}

const COS_A = Math.cos((30 * Math.PI) / 180);
const SIN_A = Math.sin((30 * Math.PI) / 180);

function project(x: number, y: number, z: number, zScale: number): [number, number] {
  return [(x - y) * COS_A, (x + y) * SIN_A - z * zScale];
}

function adaptiveZScale(xRange: number, yRange: number, zMax: number): number {
  if (zMax <= 0.01) return 1;
  const xyExtent = Math.max(xRange, yRange);
  return Math.max(1, Math.min((xyExtent * 0.45) / zMax, 30));
}

function normalizeHex(c: string | null | undefined): string {
  if (!c) return '#3b82f6'; // azul default quando não tem filamento info
  const m = c.match(/^#?([0-9a-fA-F]{6,8})$/);
  return m ? `#${m[1].slice(0, 6)}` : '#3b82f6';
}

/**
 * Preview isométrico das camadas do gcode. As camadas já impressas
 * usam a cor real do filamento ativo; a camada em impressão pulsa em
 * branco quente (contraste forte sobre qualquer cor de filamento);
 * camadas futuras ficam como fantasma bem esmaecido. Click abre
 * modal em tela cheia pra análise detalhada.
 */
export function LayerView({
  printerId,
  cacheKey,
  currentLayer,
  totalLayers,
  filamentColor,
  className,
}: Props) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty'>('loading');
  const [data, setData] = useState<LayersData | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    let attempt = 0;
    let timer: NodeJS.Timeout | null = null;
    setStatus('loading');
    setData(null);

    const run = (): void => {
      const url = `http://${LAN_HOST}:${LAN_PORT}/api/printers/${printerId}/layers.json?v=${encodeURIComponent(
        cacheKey ?? 'none',
      )}`;
      fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((payload: LayersData) => {
          if (!alive) return;
          if (!payload.layers || payload.layers.length === 0) throw new Error('empty');
          setData(payload);
          setStatus('ok');
        })
        .catch(() => {
          if (!alive) return;
          attempt++;
          const delay = Math.min(3000 * Math.pow(2, attempt - 1), 30000);
          if (attempt === 1) setStatus('empty');
          timer = setTimeout(run, delay);
        });
    };
    run();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [printerId, cacheKey]);

  // Escape fecha o modal
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const hex = normalizeHex(filamentColor);
  const currentZ =
    data && currentLayer && currentLayer > 0
      ? data.layers[Math.min(currentLayer - 1, data.layers.length - 1)]?.z
      : null;

  return (
    <>
      <div
        className={cn(
          'group relative aspect-square w-full rounded-md border border-border/60 bg-[#060910] cursor-zoom-in',
          'transition-all duration-300 ease-out',
          'hover:scale-[1.15] hover:shadow-2xl hover:shadow-primary/40 hover:border-primary/60 hover:z-20',
          className,
        )}
        onClick={() => status === 'ok' && setExpanded(true)}
      >
        <div className="absolute inset-0 overflow-hidden rounded-md">
          {status === 'ok' && data ? (
            <>
              <LayerSvg
                data={data}
                currentLayer={currentLayer ?? null}
                color={hex}
                idSuffix="card"
              />
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
              <div className="absolute top-1.5 right-1.5 opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none">
                <Maximize2 className="h-3.5 w-3.5 text-primary" />
              </div>
            </>
          ) : (
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
          )}
        </div>
      </div>

      {expanded && data ? (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm grid place-items-center p-6 cursor-zoom-out"
          onClick={() => setExpanded(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 rounded-full bg-background/70 p-2 hover:bg-background transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
          <div
            className="relative w-full max-w-4xl aspect-square rounded-lg border border-border/40 bg-[#060910] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <LayerSvg
              data={data}
              currentLayer={currentLayer ?? null}
              color={hex}
              idSuffix="modal"
            />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-sm font-mono text-muted-foreground pointer-events-none">
              <span className="flex items-center gap-2 bg-background/70 backdrop-blur px-3 py-1.5 rounded">
                <LayersIcon className="h-4 w-4" />
                Camada {currentLayer ?? 0}/{totalLayers ?? data.totalLayers}
              </span>
              {currentZ !== null ? (
                <span className="bg-background/70 backdrop-blur px-3 py-1.5 rounded">
                  Z {currentZ.toFixed(2)}mm
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * SVG puro renderizando todas as camadas projetadas. Extraído como
 * sub-componente pra reutilizar no card e no modal.
 */
function LayerSvg({
  data,
  currentLayer,
  color,
  idSuffix,
}: {
  data: LayersData;
  currentLayer: number | null;
  color: string;
  idSuffix: string;
}) {
  const groupsRef = useRef<SVGGElement[]>([]);

  const { paths, bounds } = useMemo(() => {
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
    return { paths: projected, bounds: { minX: minSX, maxX: maxSX, minY: minSY, maxY: maxSY } };
  }, [data]);

  useEffect(() => {
    const groups = groupsRef.current;
    if (!groups.length) return;
    const active = currentLayer && currentLayer > 0;
    const idx = active ? Math.min(currentLayer - 1, groups.length - 1) : -1;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (!g) continue;
      if (!active) g.setAttribute('class', `layer-preview-${idSuffix}`);
      else if (i < idx) g.setAttribute('class', `layer-done-${idSuffix}`);
      else if (i === idx) g.setAttribute('class', `layer-active-${idSuffix}`);
      else g.setAttribute('class', `layer-future-${idSuffix}`);
    }
  }, [currentLayer, data, idSuffix]);

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const pad = Math.max(width, height) * 0.06;

  return (
    <svg
      viewBox={`${bounds.minX - pad} ${bounds.minY - pad} ${width + pad * 2} ${height + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <style>{`
          .layer-done-${idSuffix} path {
            stroke: ${color};
            stroke-width: 0.3;
            fill: none;
            stroke-linejoin: round;
            stroke-opacity: 0.92;
          }
          .layer-active-${idSuffix} path {
            stroke: #ffffff;
            stroke-width: 0.55;
            fill: none;
            stroke-linejoin: round;
            filter: drop-shadow(0 0 1.5px ${color});
          }
          .layer-future-${idSuffix} path {
            stroke: ${color};
            stroke-width: 0.18;
            fill: none;
            stroke-linejoin: round;
            stroke-opacity: 0.1;
          }
          .layer-preview-${idSuffix} path {
            stroke: ${color};
            stroke-width: 0.22;
            fill: none;
            stroke-linejoin: round;
            stroke-opacity: 0.5;
          }
        `}</style>
      </defs>
      {paths.map((layerPaths, i) => (
        <g
          key={i}
          ref={(el) => {
            if (el) groupsRef.current[i] = el;
          }}
          className={`layer-future-${idSuffix}`}
        >
          {layerPaths.map((d, j) => (
            <path key={j} d={d} />
          ))}
        </g>
      ))}
    </svg>
  );
}

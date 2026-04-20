'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Layers as LayersIcon, Maximize2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const LAN_HOST = process.env.NEXT_PUBLIC_LAN_DISCOVERY_HOST ?? 'localhost';
const LAN_PORT = process.env.NEXT_PUBLIC_LAN_DISCOVERY_PORT ?? '8080';

interface LayerPath {
  tool: number;
  points: number[][];
}

interface LayersMetadata {
  estimatedSec: number | null;
  modelSec: number | null;
  totalLayers: number | null;
  filamentWeightG: number[];
  filamentLengthMm: number[];
  filamentColors: string[];
  filamentCost: number[];
}

interface LayersData {
  fileName: string;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  totalLayers: number;
  layers: Array<{ z: number; paths: LayerPath[] }>;
  metadata?: LayersMetadata;
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

// Projeção top-down 2D: world (x, y) → screen (sx, sy). Flip Y pra
// alinhar com SVG (origem no topo-esquerda). Muito mais leve que
// isométrico — todas as camadas compartilham o mesmo plano XY e só
// a ordem de desenho define o "empilhamento" visual.
function project(x: number, y: number): [number, number] {
  return [x, -y];
}

function normalizeHex(c: string | null | undefined): string {
  if (!c) return '#3b82f6';
  const m = c.match(/^#?([0-9a-fA-F]{6,8})$/);
  return m ? `#${m[1].slice(0, 6)}` : '#3b82f6';
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  return [
    parseInt(m.slice(0, 2), 16),
    parseInt(m.slice(2, 4), 16),
    parseInt(m.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Garante que a cor tenha luminância mínima pra ficar visível sobre
 * fundo escuro. Se for muito escura (filamento preto/marrom/verde
 * escuro), mistura com branco até alcançar o piso.
 */
function ensureContrast(hex: string, minLum = 0.55): string {
  const [r, g, b] = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum >= minLum) return hex;
  const mix = (minLum - lum) / (1 - lum);
  return rgbToHex(r + (255 - r) * mix, g + (255 - g) * mix, b + (255 - b) * mix);
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

  const hex = ensureContrast(normalizeHex(filamentColor));
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
                toolColors={data.metadata?.filamentColors ?? []}
                fallbackColor={hex}
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
              toolColors={data.metadata?.filamentColors ?? []}
              fallbackColor={hex}
              idSuffix="modal"
            />

            {/* HUD superior — arquivo + tempo + filamentos */}
            <div className="absolute top-3 left-3 right-14 flex items-start justify-between gap-3 pointer-events-none">
              <div className="bg-background/75 backdrop-blur px-3 py-2 rounded min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Arquivo
                </div>
                <div className="text-sm font-medium truncate max-w-xs">
                  {data.fileName}
                </div>
              </div>
              {data.metadata?.estimatedSec ? (
                <div className="bg-background/75 backdrop-blur px-3 py-2 rounded">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Tempo est.
                  </div>
                  <div className="text-sm font-medium tabular-nums">
                    {formatMinutes(data.metadata.estimatedSec)}
                  </div>
                </div>
              ) : null}
            </div>

            <FilamentLegend metadata={data.metadata} />

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

function formatMinutes(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Legenda de filamentos — mostra uma pílula por cor usada com
 * gramagem e comprimento, posicionada no canto inferior-esquerdo
 * do modal.
 */
function FilamentLegend({ metadata }: { metadata?: LayersMetadata }) {
  if (!metadata || metadata.filamentColors.length === 0) return null;
  const rows = metadata.filamentColors.map((color, i) => ({
    color,
    weight: metadata.filamentWeightG[i] ?? null,
    length: metadata.filamentLengthMm[i] ?? null,
  }));
  // Filtra filamentos que realmente têm uso (weight > 0)
  const used = rows.filter((r) => (r.weight ?? 0) > 0.01);
  if (used.length === 0) return null;

  return (
    <div className="absolute top-3 right-14 flex flex-col gap-1.5 items-end pointer-events-none translate-y-[68px]">
      {used.map((r, i) => (
        <div
          key={i}
          className="flex items-center gap-2 bg-background/75 backdrop-blur px-2.5 py-1 rounded text-[11px]"
        >
          <span
            className="h-3 w-3 rounded-full ring-1 ring-white/20 shrink-0"
            style={{ backgroundColor: r.color }}
          />
          <span className="font-mono tabular-nums text-foreground">
            {r.weight !== null ? `${r.weight.toFixed(2)}g` : '—'}
          </span>
          {r.length !== null ? (
            <span className="font-mono tabular-nums text-muted-foreground">
              {(r.length / 1000).toFixed(2)}m
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * SVG isométrico das camadas. Cada polilinha é desenhada na cor
 * do seu tool (filamento) conforme indicado pelo gcode. A camada
 * ativa destaca-se com glow branco; camadas já impressas aparecem
 * em tom sólido reduzido; futuras ficam como silhueta fantasma.
 */
function LayerSvg({
  data,
  currentLayer,
  toolColors,
  fallbackColor,
  idSuffix,
}: {
  data: LayersData;
  currentLayer: number | null;
  toolColors: string[];
  fallbackColor: string;
  idSuffix: string;
}) {
  const groupsRef = useRef<SVGGElement[]>([]);

  const { layerSvgs, bounds } = useMemo(() => {
    let minSX = Number.POSITIVE_INFINITY;
    let maxSX = Number.NEGATIVE_INFINITY;
    let minSY = Number.POSITIVE_INFINITY;
    let maxSY = Number.NEGATIVE_INFINITY;

    // Por camada, concatena TODAS as polilinhas do mesmo tool num único
    // atributo `d` (ex: "M1,2 L3,4 M5,6 L7,8") — gera 1 elemento <path>
    // por combinação (layer × tool) em vez de um por polilinha.
    const layerSvgs = data.layers.map((layer) => {
      const byTool = new Map<number, string>();
      for (const poly of layer.paths) {
        const pts = poly.points;
        if (!pts || pts.length === 0) continue;
        const [fx, fy] = project(pts[0][0], pts[0][1]);
        if (fx < minSX) minSX = fx;
        if (fx > maxSX) maxSX = fx;
        if (fy < minSY) minSY = fy;
        if (fy > maxSY) maxSY = fy;
        let segment = `M${fx.toFixed(1)},${fy.toFixed(1)}`;
        for (let i = 1; i < pts.length; i++) {
          const [sx, sy] = project(pts[i][0], pts[i][1]);
          if (sx < minSX) minSX = sx;
          if (sx > maxSX) maxSX = sx;
          if (sy < minSY) minSY = sy;
          if (sy > maxSY) maxSY = sy;
          segment += `L${sx.toFixed(1)},${sy.toFixed(1)}`;
        }
        const existing = byTool.get(poly.tool);
        byTool.set(poly.tool, existing ? `${existing} ${segment}` : segment);
      }
      return Array.from(byTool.entries()).map(([tool, d]) => ({ tool, d }));
    });

    if (!Number.isFinite(minSX)) {
      minSX = 0;
      maxSX = 0;
      minSY = 0;
      maxSY = 0;
    }
    return { layerSvgs, bounds: { minX: minSX, maxX: maxSX, minY: minSY, maxY: maxSY } };
  }, [data]);

  useEffect(() => {
    const groups = groupsRef.current;
    if (!groups.length) return;
    const active = currentLayer && currentLayer > 0;
    const idx = active ? Math.min(currentLayer - 1, groups.length - 1) : -1;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (!g) continue;
      if (!active) g.setAttribute('class', `lyr-preview-${idSuffix}`);
      else if (i < idx) g.setAttribute('class', `lyr-done-${idSuffix}`);
      else if (i === idx) g.setAttribute('class', `lyr-active-${idSuffix}`);
      else g.setAttribute('class', `lyr-future-${idSuffix}`);
    }
  }, [currentLayer, data, idSuffix]);

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const pad = Math.max(width, height) * 0.06;

  // Resolve cor por tool — usa metadata se tiver, senão fallback.
  const colorFor = (tool: number): string => {
    const raw = toolColors[tool];
    if (raw) return ensureContrast(raw, 0.5);
    return fallbackColor;
  };

  return (
    <svg
      viewBox={`${bounds.minX - pad} ${bounds.minY - pad} ${width + pad * 2} ${height + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <radialGradient id={`bg-${idSuffix}`} cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="hsl(220 40% 9%)" />
          <stop offset="100%" stopColor="hsl(220 55% 3%)" />
        </radialGradient>
        <style>{`
          /* DONE — sólido reduzido na cor do tool */
          .lyr-done-${idSuffix} path { stroke-width: 0.22; stroke-opacity: 0.82; fill: none; stroke-linejoin: round; stroke-linecap: round; }
          /* ACTIVE — branco quente com glow do tool */
          .lyr-active-${idSuffix} path { stroke: #ffffff; stroke-width: 0.48; stroke-opacity: 1; fill: none; stroke-linejoin: round; stroke-linecap: round; filter: drop-shadow(0 0 1.5px currentColor); }
          /* FUTURE — fantasma neutro pra manter a silhueta */
          .lyr-future-${idSuffix} path { stroke: hsl(220 20% 50%); stroke-width: 0.14; stroke-opacity: 0.12; fill: none; stroke-linejoin: round; }
          /* PREVIEW — quando ocioso, cor do tool meio-termo */
          .lyr-preview-${idSuffix} path { stroke-width: 0.18; stroke-opacity: 0.42; fill: none; stroke-linejoin: round; stroke-linecap: round; }
        `}</style>
      </defs>

      <rect
        x={bounds.minX - pad}
        y={bounds.minY - pad}
        width={width + pad * 2}
        height={height + pad * 2}
        fill={`url(#bg-${idSuffix})`}
      />

      {layerSvgs.map((toolGroups, i) => (
        <g
          key={i}
          ref={(el) => {
            if (el) groupsRef.current[i] = el;
          }}
          className={`lyr-future-${idSuffix}`}
        >
          {toolGroups.map(({ tool, d }) => {
            const c = colorFor(tool);
            return <path key={tool} d={d} stroke={c} style={{ color: c }} />;
          })}
        </g>
      ))}
    </svg>
  );
}

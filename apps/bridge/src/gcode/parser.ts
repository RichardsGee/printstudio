/**
 * Minimal gcode parser — extrai o caminho do filamento por camada para
 * visualização. Ignora retrações, aquecimentos, mudanças de ferramenta e
 * outras instruções não-cinemáticas. O objetivo é produzir polilinhas XY
 * compactas que o frontend possa renderizar como SVG.
 *
 * Formato Bambu Studio (BBL):
 *   ; CHANGE_LAYER
 *   ; Z_HEIGHT: 0.16
 *   ; LAYER_HEIGHT: 0.16
 *   G1 X10 Y10 F600       (viagem sem extrusão)
 *   G1 X20 Y10 E0.5 F600  (extrusão)
 *
 * Note: `; CHANGE_LAYER` — com espaço após o `;` — é o formato real do
 * slicer BBL. Outros slicers usam `;LAYER_CHANGE` (sem espaço, invertido);
 * o parser aceita ambos.
 *
 * Uma extrusão começa quando um comando G1 inclui `E` positivo (modo
 * relativo) ou maior que o último `E` (modo absoluto). Viagens sem
 * extrusão quebram a polilinha atual.
 */

export interface LayerPath {
  /** Índice do filamento usado nessa polilinha (0..3 em geral). */
  tool: number;
  /** Pontos XY em mm — sequência contígua de extrusão. */
  points: number[][];
}

export interface LayerData {
  /** Altura Z (mm) no início da camada. */
  z: number;
  /** Polilinhas de extrusão, agrupadas por ferramenta ativa. */
  paths: LayerPath[];
}

export interface GcodeMetadata {
  /** Tempo estimado total em segundos, incluindo pre-heat e purges. */
  estimatedSec: number | null;
  /** Tempo apenas de impressão (sem aquecimento) em segundos. */
  modelSec: number | null;
  /** Total de camadas (igual ao comprimento de `layers` quando o parse bate). */
  totalLayers: number | null;
  /** Gramas por filamento carregado (índice = filament channel). */
  filamentWeightG: number[];
  /** Comprimento em mm por filamento. */
  filamentLengthMm: number[];
  /** Cores hex por filamento. Pode ter espaços vazios (;;). */
  filamentColors: string[];
  /** Custo em moeda do sistema (por kg geralmente) por filamento. */
  filamentCost: number[];
}

export interface LayersData {
  /** Bounding box XY em mm — permite o renderizador centralizar sem recalcular. */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** Total de camadas impressas. Útil para sanidade vs `totalLayers` do MQTT. */
  totalLayers: number;
  /** Array de camadas, ordenadas de baixo para cima. */
  layers: LayerData[];
  /** Metadados extraídos do cabeçalho do gcode. */
  metadata: GcodeMetadata;
}

export function parseGcodeMetadata(text: string): GcodeMetadata {
  // Só precisamos dos primeiros ~500 linhas — metadados vivem no
  // cabeçalho e no rodapé. Procurando só nas 500 primeiras.
  const head = text.slice(0, Math.min(text.length, 80_000));

  const parseDuration = (s: string): number | null => {
    const m = s.match(/(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/);
    if (!m) return null;
    const h = Number(m[1] ?? 0);
    const min = Number(m[2] ?? 0);
    const sec = Number(m[3] ?? 0);
    const total = h * 3600 + min * 60 + sec;
    return total > 0 ? total : null;
  };

  const timeMatch = head.match(
    /;\s*model printing time:\s*([^;\n]+);\s*total estimated time:\s*([^\n]+)/i,
  );
  const modelSec = timeMatch ? parseDuration(timeMatch[1].trim()) : null;
  const estimatedSec = timeMatch ? parseDuration(timeMatch[2].trim()) : null;

  const layerMatch = head.match(/;\s*total layer number:\s*(\d+)/i);
  const totalLayers = layerMatch ? Number(layerMatch[1]) : null;

  const parseNumList = (pattern: RegExp): number[] => {
    const m = head.match(pattern);
    if (!m) return [];
    return m[1]
      .split(/[,;]/)
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n));
  };

  const filamentWeightG = parseNumList(/;\s*total filament weight\s*\[g\]\s*:\s*([^\n]+)/i);
  const filamentLengthMm = parseNumList(/;\s*total filament length\s*\[mm\]\s*:\s*([^\n]+)/i);
  const filamentCost = parseNumList(/;\s*filament_cost\s*=\s*([^\n]+)/i);

  const colorMatch = head.match(/;\s*filament_colour\s*=\s*([^\n]+)/i);
  const filamentColors = colorMatch
    ? colorMatch[1]
        .split(';')
        .map((c) => c.trim())
        .filter((c) => /^#[0-9a-fA-F]{6,8}$/.test(c))
    : [];

  return {
    estimatedSec,
    modelSec,
    totalLayers,
    filamentWeightG,
    filamentLengthMm,
    filamentColors,
    filamentCost,
  };
}

const EMPTY_BOUNDS = {
  minX: Number.POSITIVE_INFINITY,
  maxX: Number.NEGATIVE_INFINITY,
  minY: Number.POSITIVE_INFINITY,
  maxY: Number.NEGATIVE_INFINITY,
};

export function parseGcodeToLayers(text: string): LayersData {
  const lines = text.split('\n');
  const layers: LayerData[] = [];
  const bounds = { ...EMPTY_BOUNDS };

  let currentLayer: LayerData | null = null;
  let pendingPath: number[][] = [];
  let x = 0;
  let y = 0;
  let lastE = 0;
  let absoluteE = true;
  let absolutePos = true;
  let currentTool = 0;

  const flushPath = (): void => {
    if (!currentLayer) return;
    if (pendingPath.length >= 2) {
      currentLayer.paths.push({ tool: currentTool, points: pendingPath });
    }
    pendingPath = [];
  };

  const startLayer = (z: number): void => {
    flushPath();
    currentLayer = { z, paths: [] };
    layers.push(currentLayer);
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw) continue;

    // Comment / directive
    if (raw.startsWith(';')) {
      // `; CHANGE_LAYER` (BBL, leading space) or `;LAYER_CHANGE` (PrusaSlicer).
      if (/^;\s*(CHANGE_LAYER|LAYER_CHANGE)\b/.test(raw)) {
        // The next 1-5 lines usually contain `; Z_HEIGHT:` or `;Z:`.
        let z: number | null = null;
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          const m = lines[j].match(/^;\s*(?:Z_HEIGHT|Z)[:=]\s*([\-0-9.]+)/i);
          if (m) {
            z = Number(m[1]);
            break;
          }
        }
        // Fallback: create a layer even without explicit Z (use previous z+1).
        startLayer(z ?? (layers.length > 0 ? layers[layers.length - 1].z + 0.2 : 0));
      }
      continue;
    }

    // Strip inline comments.
    const cleanIdx = raw.indexOf(';');
    const line = cleanIdx >= 0 ? raw.slice(0, cleanIdx).trim() : raw.trim();
    if (!line) continue;

    // Mode toggles.
    if (line === 'G90') {
      absolutePos = true;
      continue;
    }
    if (line === 'G91') {
      absolutePos = false;
      continue;
    }
    if (line === 'M82') {
      absoluteE = true;
      continue;
    }
    if (line === 'M83') {
      absoluteE = false;
      continue;
    }
    if (line.startsWith('G92')) {
      const eMatch = line.match(/E([\-0-9.]+)/);
      if (eMatch) lastE = Number(eMatch[1]);
      continue;
    }

    // Tool change: `T0`, `T1`, …, `T3` (ou T255 = sem filamento carregado).
    const toolMatch = /^T(\d+)\b/.exec(line);
    if (toolMatch) {
      flushPath();
      const t = Number(toolMatch[1]);
      if (t < 16) currentTool = t;
      continue;
    }

    // Kinematic moves.
    if (line.startsWith('G0') || line.startsWith('G1')) {
      const xm = line.match(/X([\-0-9.]+)/);
      const ym = line.match(/Y([\-0-9.]+)/);
      const em = line.match(/E([\-0-9.]+)/);

      const nx = xm ? (absolutePos ? Number(xm[1]) : x + Number(xm[1])) : x;
      const ny = ym ? (absolutePos ? Number(ym[1]) : y + Number(ym[1])) : y;

      let extruding = false;
      if (em) {
        const eVal = Number(em[1]);
        if (absoluteE) {
          extruding = eVal > lastE + 1e-6;
          lastE = eVal;
        } else {
          extruding = eVal > 1e-6;
          lastE += eVal;
        }
      }

      if (extruding && currentLayer) {
        if (pendingPath.length === 0) {
          pendingPath.push([x, y]);
        }
        pendingPath.push([nx, ny]);
        if (nx < bounds.minX) bounds.minX = nx;
        if (nx > bounds.maxX) bounds.maxX = nx;
        if (ny < bounds.minY) bounds.minY = ny;
        if (ny > bounds.maxY) bounds.maxY = ny;
      } else {
        // Travel move — closes the current polyline.
        flushPath();
      }

      x = nx;
      y = ny;
    }
  }

  flushPath();

  if (!Number.isFinite(bounds.minX)) {
    bounds.minX = 0;
    bounds.maxX = 0;
    bounds.minY = 0;
    bounds.maxY = 0;
  }

  return {
    bounds,
    totalLayers: layers.length,
    layers,
    metadata: parseGcodeMetadata(text),
  };
}

/**
 * Reduz a contagem de pontos sem mudar visivelmente o traçado, usando
 * um limiar simples de distância (Euclidean). Mantém primeiro/último
 * sempre. Para displays ~600px, threshold 0.1mm já é sub-pixel.
 */
export function simplifyLayers(data: LayersData, threshold = 0.1): LayersData {
  const t2 = threshold * threshold;
  const simplified = data.layers.map((layer) => ({
    z: layer.z,
    paths: layer.paths.map((p) => ({
      tool: p.tool,
      points: simplifyPath(p.points, t2),
    })),
  }));
  return { ...data, layers: simplified };
}

function simplifyPath(path: number[][], t2: number): number[][] {
  if (path.length <= 2) return path;
  const out: number[][] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const [px, py] = out[out.length - 1];
    const [x, y] = path[i];
    const dx = x - px;
    const dy = y - py;
    if (dx * dx + dy * dy >= t2) out.push(path[i]);
  }
  out.push(path[path.length - 1]);
  return out;
}

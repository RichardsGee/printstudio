import * as THREE from 'three';

interface LayerPath {
  tool: number;
  points: number[][];
}

interface LayerData {
  z: number;
  paths: LayerPath[];
}

export interface LayersInput {
  layers: LayerData[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

const MIN_AREA_MM2 = 4.0;

/**
 * Convex hull 2D via Andrew's monotone chain. O(n log n).
 * Recebe pontos [x,y]; retorna o polígono fechado em CCW.
 *
 * Por que hull em vez de "maior path fechado"? O gcode da Bambu
 * fragmenta o perímetro em centenas de segmentos curtos (numa layer
 * de 826 paths, só 7 são fechados — e nenhum cobre o contorno todo).
 * Hull dos pontos da layer captura a silhueta externa de forma
 * robusta. Perde concavidades extremas, mas o resultado visual fica
 * fiel pro objetivo "ver o que está imprimindo".
 */
function convexHull(pts: number[][]): number[][] {
  if (pts.length < 3) return pts.slice();

  const sorted = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const cross = (o: number[], a: number[], b: number[]): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower: number[][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: number[][] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/** Shoelace formula — área absoluta em mm². */
function polygonArea(pts: number[][]): number {
  let a = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += pts[i][0] * pts[j][1];
    a -= pts[j][0] * pts[i][1];
  }
  return Math.abs(a) / 2;
}

function collectAllPoints(paths: LayerPath[]): number[][] {
  const all: number[][] = [];
  for (const p of paths) {
    if (!p.points) continue;
    for (const pt of p.points) {
      if (pt && pt.length >= 2) all.push(pt);
    }
  }
  return all;
}

/**
 * Reconstrói um BufferGeometry 3D a partir dos toolpaths de cada
 * camada. Pega o maior polígono fechado (= perímetro externo) por
 * camada, extruda com a altura da camada, mescla tudo em uma única
 * geometria pra render eficiente.
 *
 * Retorna geometria já em Y-up (Three.js convention) e centralizada
 * com chão em y=0.
 */
export function buildMeshFromLayers(input: LayersInput): {
  geometry: THREE.BufferGeometry;
  height: number;
  radius: number;
} | null {
  const geometries: THREE.BufferGeometry[] = [];
  let prevZ = 0;
  let maxZ = 0;

  for (let i = 0; i < input.layers.length; i++) {
    const layer = input.layers[i];

    // Coleta TODOS os pontos da camada (perímetros + infill + travels já
    // filtrados pelo parser) e tira o convex hull pra silhueta externa.
    const allPts = collectAllPoints(layer.paths);
    if (allPts.length < 3) {
      prevZ = layer.z;
      continue;
    }

    const hull = convexHull(allPts);
    const area = polygonArea(hull);
    if (hull.length < 3 || area < MIN_AREA_MM2) {
      prevZ = layer.z;
      continue;
    }

    // Altura da camada = z atual - z anterior. Pra primeira camada,
    // assume que ela parte do chão (z=0).
    const layerHeight = i === 0 ? Math.max(layer.z, 0.1) : layer.z - prevZ;
    if (layerHeight <= 0 || layerHeight > 5) {
      // Salto suspeito (provável defeito de parsing) — ignora.
      prevZ = layer.z;
      continue;
    }

    // Build Three.js Shape a partir do hull.
    const shape = new THREE.Shape();
    shape.moveTo(hull[0][0], hull[0][1]);
    for (let p = 1; p < hull.length; p++) {
      shape.lineTo(hull[p][0], hull[p][1]);
    }

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: layerHeight,
      bevelEnabled: false,
      curveSegments: 1,
      steps: 1,
    });
    // ExtrudeGeometry extruda no eixo Z local da geometria, base em z=0.
    // Translada pra altura real da camada (base = topo da camada anterior).
    geom.translate(0, 0, layer.z - layerHeight);

    geometries.push(geom);
    prevZ = layer.z;
    if (layer.z > maxZ) maxZ = layer.z;
  }

  if (geometries.length === 0) return null;

  // Merge manual — concatena positions + indices reescalando vértices.
  const merged = mergeGeometries(geometries);
  for (const g of geometries) g.dispose();

  // Z-up (.3mf / gcode convention) → Y-up (Three.js).
  merged.rotateX(-Math.PI / 2);

  // Centraliza no chão (y=0) e XZ no centro.
  merged.computeBoundingBox();
  const bbox = merged.boundingBox!;
  const cx = (bbox.max.x + bbox.min.x) / 2;
  const cz = (bbox.max.z + bbox.min.z) / 2;
  const offsetY = bbox.min.y;
  merged.translate(-cx, -offsetY, -cz);

  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  merged.computeVertexNormals();

  const finalBbox = merged.boundingBox!;
  const height = finalBbox.max.y - finalBbox.min.y;
  const radius = merged.boundingSphere!.radius;

  return { geometry: merged, height, radius };
}

/** Merge sem dependência do BufferGeometryUtils — concatena positions e
 *  reindexa pra um único buffer. */
function mergeGeometries(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIdx = 0;
  for (const g of list) {
    const p = g.getAttribute('position');
    totalVerts += p.count;
    totalIdx += g.index ? g.index.count : p.count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const useUint32 = totalVerts > 0xffff;
  const indices = useUint32 ? new Uint32Array(totalIdx) : new Uint16Array(totalIdx);

  let posOffset = 0;
  let idxOffset = 0;
  let baseVertex = 0;

  for (const g of list) {
    const pos = g.getAttribute('position');
    const arr = pos.array as Float32Array;
    positions.set(arr, posOffset * 3);

    if (g.index) {
      const idx = g.index.array;
      for (let k = 0; k < idx.length; k++) {
        indices[idxOffset + k] = idx[k] + baseVertex;
      }
      idxOffset += idx.length;
    } else {
      for (let k = 0; k < pos.count; k++) {
        indices[idxOffset + k] = k + baseVertex;
      }
      idxOffset += pos.count;
    }

    baseVertex += pos.count;
    posOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

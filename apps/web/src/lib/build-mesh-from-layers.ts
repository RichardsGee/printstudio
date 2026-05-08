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

const CLOSED_THRESHOLD_MM2 = 1.0;
const MIN_AREA_MM2 = 4.0;

function isClosedPath(path: LayerPath): boolean {
  const pts = path.points;
  if (!pts || pts.length < 3) return false;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const dx = first[0] - last[0];
  const dy = first[1] - last[1];
  return dx * dx + dy * dy < CLOSED_THRESHOLD_MM2;
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

    // Filtra paths fechados — perímetros são closed loops, infill é zigzag.
    const closedPaths = layer.paths.filter(isClosedPath);
    if (closedPaths.length === 0) {
      prevZ = layer.z;
      continue;
    }

    // Pega o maior polígono fechado por área (= contorno externo).
    let outer = closedPaths[0];
    let outerArea = polygonArea(outer.points);
    for (let j = 1; j < closedPaths.length; j++) {
      const a = polygonArea(closedPaths[j].points);
      if (a > outerArea) {
        outer = closedPaths[j];
        outerArea = a;
      }
    }
    if (outerArea < MIN_AREA_MM2) {
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

    // Build Three.js Shape a partir dos pontos do contorno.
    const shape = new THREE.Shape();
    shape.moveTo(outer.points[0][0], outer.points[0][1]);
    for (let p = 1; p < outer.points.length; p++) {
      shape.lineTo(outer.points[p][0], outer.points[p][1]);
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

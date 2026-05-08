import AdmZip from 'adm-zip';

export interface MeshData {
  /** Flat [x0,y0,z0, x1,y1,z1, ...] em mm. */
  vertices: number[];
  /** Indices [v1,v2,v3, v1,v2,v3, ...] de triângulos. */
  indices: number[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  vertexCount: number;
  triangleCount: number;
  /** Quantidade de instâncias do modelo no .3mf — `<item>` no `<build>`.
   *  Geralmente 1 (single print) mas N quando o usuário arranjou
   *  múltiplas cópias na mesa do slicer. */
  instanceCount: number;
}

/**
 * Extrai o mesh do PRIMEIRO objeto do .3mf — quando o usuário imprime
 * múltiplas cópias do mesmo modelo, o `<build>` tem N `<item>` mas
 * apontando todos pro mesmo `<object>`. Pegando o primeiro objeto
 * de mesh real, mostramos o modelo único como referência visual.
 *
 * Bambu Studio gera .3mf com a "Production Extension" do spec — cada
 * objeto pode estar em um arquivo separado em `3D/Objects/object_X.model`,
 * referenciado a partir do `3D/3dmodel.model`. Suportamos ambos.
 */
export function extractPrimaryMesh(threeMfBuf: Buffer): MeshData | null {
  try {
    const zip = new AdmZip(threeMfBuf);
    const entries = zip.getEntries();

    const modelEntries = entries
      .filter((e) => /^3D\/.*\.model$/i.test(e.entryName))
      .sort((a, b) => {
        const aMain = /^3D\/3dmodel\.model$/i.test(a.entryName);
        const bMain = /^3D\/3dmodel\.model$/i.test(b.entryName);
        if (aMain !== bMain) return aMain ? -1 : 1;
        return a.entryName.localeCompare(b.entryName);
      });

    if (modelEntries.length === 0) return null;

    // Conta instâncias agregando `<item>` em todos os arquivos de modelo
    // (Production Extension pode espalhar `<build>` entre files).
    let totalInstances = 0;
    for (const entry of modelEntries) {
      const xml = entry.getData().toString('utf8');
      totalInstances += countBuildItems(xml);
    }

    for (const entry of modelEntries) {
      const xml = entry.getData().toString('utf8');
      const mesh = parseFirstMeshFromXml(xml);
      if (mesh && mesh.triangleCount > 0) {
        mesh.instanceCount = Math.max(1, totalInstances);
        return mesh;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/** Conta `<item>` dentro de blocos `<build>` (cada item = 1 cópia
 *  do modelo na mesa do slicer). */
function countBuildItems(xml: string): number {
  const buildRe = /<build\b[^>]*>([\s\S]*?)<\/build>/g;
  let total = 0;
  let m: RegExpExecArray | null;
  while ((m = buildRe.exec(xml)) !== null) {
    const inner = m[1];
    const items = inner.match(/<item\b/g);
    if (items) total += items.length;
  }
  return total;
}

function parseFirstMeshFromXml(xml: string): MeshData | null {
  const objectRe = /<object\b[^>]*>([\s\S]*?)<\/object>/g;
  let objectMatch: RegExpExecArray | null;
  while ((objectMatch = objectRe.exec(xml)) !== null) {
    const inner = objectMatch[1];
    const meshMatch = /<mesh\b[^>]*>([\s\S]*?)<\/mesh>/.exec(inner);
    if (!meshMatch) continue;

    const mesh = parseMeshBlock(meshMatch[1]);
    if (mesh && mesh.triangleCount > 0) return mesh;
  }
  return null;
}

function parseMeshBlock(meshXml: string): MeshData | null {
  const vertices: number[] = [];
  const indices: number[] = [];
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  const vertexRe = /<vertex\b([^/>]+)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = vertexRe.exec(meshXml)) !== null) {
    const attrs = m[1];
    const x = parseFloat(attr(attrs, 'x'));
    const y = parseFloat(attr(attrs, 'y'));
    const z = parseFloat(attr(attrs, 'z'));
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    vertices.push(x, y, z);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const triangleRe = /<triangle\b([^/>]+)\/?>/g;
  while ((m = triangleRe.exec(meshXml)) !== null) {
    const attrs = m[1];
    const v1 = parseInt(attr(attrs, 'v1'), 10);
    const v2 = parseInt(attr(attrs, 'v2'), 10);
    const v3 = parseInt(attr(attrs, 'v3'), 10);
    if (!Number.isFinite(v1) || !Number.isFinite(v2) || !Number.isFinite(v3)) continue;
    indices.push(v1, v2, v3);
  }

  if (vertices.length === 0 || indices.length === 0) return null;

  return {
    vertices,
    indices,
    bounds: { minX, maxX, minY, maxY, minZ, maxZ },
    vertexCount: vertices.length / 3,
    triangleCount: indices.length / 3,
    instanceCount: 1, // populado depois pelo caller agregando `<build>` de todos modelos
  };
}

function attr(attrs: string, name: string): string {
  const re = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`);
  const m = re.exec(attrs);
  return m ? m[1] : '';
}

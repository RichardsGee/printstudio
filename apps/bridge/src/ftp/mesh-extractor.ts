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

    // 1) Carrega arquivos de modelo candidatos (main + production-extension splits).
    const modelEntries = entries
      .filter((e) => /^3D\/.*\.model$/i.test(e.entryName))
      .sort((a, b) => {
        // Prioriza o arquivo principal; depois `Objects/object_*` em ordem.
        const aMain = /^3D\/3dmodel\.model$/i.test(a.entryName);
        const bMain = /^3D\/3dmodel\.model$/i.test(b.entryName);
        if (aMain !== bMain) return aMain ? -1 : 1;
        return a.entryName.localeCompare(b.entryName);
      });

    if (modelEntries.length === 0) return null;

    // 2) Itera nos modelos até achar um com mesh real (vertices+triangles).
    //    O 3dmodel.model raiz pode ser só metadado quando usa Production Extension.
    for (const entry of modelEntries) {
      const xml = entry.getData().toString('utf8');
      const mesh = parseFirstMeshFromXml(xml);
      if (mesh && mesh.triangleCount > 0) return mesh;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse rápido por regex — o XML de um `<mesh>` é bem regular
 * (`<vertex x="..." y="..." z="..."/>` e `<triangle v1="..." v2="..." v3="..."/>`).
 * Evita dependência de XML parser e é O(n) em uma passada por bloco.
 *
 * Limita-se ao PRIMEIRO `<object>` com `<mesh>` populado.
 */
function parseFirstMeshFromXml(xml: string): MeshData | null {
  // Acha o primeiro <object ...>...</object> que contenha um <mesh>.
  const objectRe = /<object\b[^>]*>([\s\S]*?)<\/object>/g;
  let objectMatch: RegExpExecArray | null;
  while ((objectMatch = objectRe.exec(xml)) !== null) {
    const inner = objectMatch[1];
    const meshMatch = /<mesh\b[^>]*>([\s\S]*?)<\/mesh>/.exec(inner);
    if (!meshMatch) continue;

    const meshXml = meshMatch[1];
    const mesh = parseMeshBlock(meshXml);
    if (mesh && mesh.triangleCount > 0) return mesh;
  }
  return null;
}

function parseMeshBlock(meshXml: string): MeshData | null {
  // Verts + indices acumulados em arrays nativos.
  const vertices: number[] = [];
  const indices: number[] = [];

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  // <vertex x="..." y="..." z="..."/> — atributos podem vir em qualquer ordem.
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

  // <triangle v1="..." v2="..." v3="..."/>
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
  };
}

function attr(attrs: string, name: string): string {
  const re = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`);
  const m = re.exec(attrs);
  return m ? m[1] : '';
}

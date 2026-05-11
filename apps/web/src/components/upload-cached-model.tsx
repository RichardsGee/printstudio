'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import * as THREE from 'three';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { unzipSync, strFromU8 } from 'fflate';
import { Upload, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { CachedModelUploadRequest } from '@printstudio/shared';

interface Props {
  bambuModelId: string;
  /** Plate atualmente sendo impresso. Upload salva o mesh COMBINADO
   *  vinculado a esse plate. Pra outros plates do mesmo .3mf, upload
   *  novamente quando estiverem em impressão. (Workaround: parser
   *  client-side não consegue separar plates Bambu com confiabilidade.) */
  currentPlateIndex?: number | null;
  /** Callback após upload bem-sucedido. */
  onUploaded?: () => void;
  className?: string;
}

interface CachedPlate {
  id: string;
  plateIndex: number;
  filename: string;
  sizeBytes: number;
  updatedAt: string;
}



/**
 * Botão "Vincular .3mf" (Story 4.8/4.9).
 *
 * Lê o .3mf como ZIP via fflate, extrai a estrutura de plates do
 * Metadata/model_settings.config (XML proprietário Bambu), e gera 1
 * mesh por plate filtrando os objetos no Group do ThreeMFLoader pelo
 * objectId.
 *
 * Faz POST sequencial pra /api/cached-models — 1 por plate.
 * Próximas impressões do mesmo modelo+plate reusam o mesh sem upload.
 */
export function UploadCachedModel({
  bambuModelId,
  currentPlateIndex,
  onUploaded,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [cached, setCached] = useState<CachedPlate[] | null>(null);

  // Checa se já existe cached pra esse modelo (decide entre "Vincular"
  // vs "Substituir + Remover" no UI).
  useEffect(() => {
    let alive = true;
    fetch(`/api/cached-models/by-model/${encodeURIComponent(bambuModelId)}/list`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : { plates: [] }))
      .then((data: { plates: CachedPlate[] }) => {
        if (alive) setCached(data.plates ?? []);
      })
      .catch(() => {
        if (alive) setCached([]);
      });
    return () => {
      alive = false;
    };
  }, [bambuModelId]);

  function handleClick() {
    inputRef.current?.click();
  }

  function handleRemove() {
    if (!cached || cached.length === 0) return;
    const plural = cached.length > 1 ? `${cached.length} plates` : '1 plate';
    if (!confirm(`Remover .3mf vinculado (${plural})? Próximas impressões deste modelo voltam a mostrar a vista ISO da Bambu Cloud.`)) {
      return;
    }
    start(async () => {
      try {
        setProgress('Removendo…');
        const res = await fetch(
          `/api/cached-models/by-model/${encodeURIComponent(bambuModelId)}/delete`,
          { method: 'DELETE', credentials: 'include' },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success('.3mf desvinculado');
        setCached([]);
        onUploaded?.();
      } catch (err) {
        toast.error((err as Error).message || 'Falha ao remover');
      } finally {
        setProgress(null);
      }
    });
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.name.toLowerCase().endsWith('.3mf')) {
      toast.error('Apenas arquivos .3mf são suportados');
      return;
    }

    const plateToSave = currentPlateIndex && currentPlateIndex > 0 ? currentPlateIndex : 1;

    start(async () => {
      try {
        setProgress('Lendo arquivo…');
        const buffer = await file.arrayBuffer();

        setProgress(`Extraindo plate ${plateToSave}…`);
        // Tenta parser dedicado Bambu (filtra só objects do plate via
        // instance_id no model_settings.config). Fallback: combina tudo.
        let mesh: { vertices: number[]; indices: number[] } | null = null;
        try {
          mesh = parsePlateFromBambu3mf(buffer, plateToSave);
        } catch (parseErr) {
          console.warn('Parser plate-aware falhou, usando fallback:', parseErr);
        }
        if (!mesh) {
          setProgress('Plate não detectado, salvando combinado…');
          mesh = await parseCombinedMesh(buffer);
        }

        setProgress(`Enviando plate ${plateToSave}…`);
        const payload: CachedModelUploadRequest = {
          bambuModelId,
          plateIndex: plateToSave,
          filename: file.name,
          sizeBytes: file.size,
          meshPayload: { vertices: mesh.vertices, indices: mesh.indices },
        };
        const res = await fetch('/api/cached-models', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`upload falhou: ${txt.slice(0, 120)}`);
        }

        toast.success(
          `Vinculado ao plate ${plateToSave} · ${(mesh.vertices.length / 3).toLocaleString('pt-BR')} vértices`,
        );
        onUploaded?.();
      } catch (err) {
        toast.error((err as Error).message || 'Falha no upload');
      } finally {
        setProgress(null);
      }
    });
  }

  const hasCached = cached !== null && cached.length > 0;

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <input
        ref={inputRef}
        type="file"
        accept=".3mf,model/3mf"
        className="hidden"
        onChange={handleFile}
        disabled={pending}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        <span className="ml-2 text-xs">
          {progress ?? (hasCached ? 'Substituir .3mf' : 'Vincular .3mf')}
        </span>
      </Button>
      {hasCached ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleRemove}
          disabled={pending}
          title={`${cached!.length} plate(s) vinculado(s)`}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Parseia um .3mf e retorna array de meshes (1 por plate). Usa fflate
 * pra ler o ZIP, ThreeMFLoader pra montar as geometrias com
 * transformações, e parseia Metadata/model_settings.config pra mapear
 * plate_id → object_ids.
 */
/**
 * Parseia .3mf e combina TODOS os meshes em um único PlateMesh.
 * Usado pra salvar o mesh vinculado ao plate atual da impressora.
 * (Versão simplificada — separação por plate Bambu requer parser
 * dedicado pro model_settings.config + build items XML, que é
 * frágil. Workaround atual: 1 upload por plate em uso.)
 */
async function parseCombinedMesh(
  buffer: ArrayBuffer,
): Promise<{ vertices: number[]; indices: number[] }> {
  const loader = new ThreeMFLoader();
  const group = loader.parse(buffer);
  const all: THREE.Mesh[] = [];
  group.traverse((obj: THREE.Object3D) => {
    if (obj instanceof THREE.Mesh && obj.geometry?.getAttribute('position')) {
      all.push(obj);
    }
  });
  if (all.length === 0) {
    throw new Error(
      'ThreeMFLoader não retornou meshes — arquivo .3mf pode estar corrompido',
    );
  }
  const combined = combineMeshes(all);
  if (!combined) throw new Error('Falha ao combinar meshes');
  return combined;
}

function combineMeshes(meshes: THREE.Mesh[]): { vertices: number[]; indices: number[] } | null {
  const vertices: number[] = [];
  const indices: number[] = [];
  let offset = 0;
  const tempVec = new THREE.Vector3();

  for (const mesh of meshes) {
    const geom = mesh.geometry as THREE.BufferGeometry;
    if (!geom) continue;
    mesh.updateMatrixWorld(true);
    const matrix = mesh.matrixWorld;
    const pos = geom.getAttribute('position');
    if (!pos) continue;
    for (let i = 0; i < pos.count; i++) {
      tempVec.fromBufferAttribute(pos as THREE.BufferAttribute, i);
      tempVec.applyMatrix4(matrix);
      vertices.push(tempVec.x, tempVec.y, tempVec.z);
    }
    const idx = geom.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + offset);
    } else {
      for (let i = 0; i < pos.count; i++) indices.push(i + offset);
    }
    offset += pos.count;
  }

  if (vertices.length === 0) return null;
  return { vertices, indices };
}

/**
 * Parser dedicado do .3mf Bambu — extrai SÓ os objetos/instâncias do
 * plate especificado, aplicando os transforms corretos.
 *
 * Estrutura:
 *  - 3D/3dmodel.model define objetos (mesh geometry) e build items
 *    (instâncias com transform). Ordem dos `<item>` no `<build>` define
 *    o instance_id (índice GLOBAL zero-based).
 *  - Metadata/model_settings.config lista plates, e pra cada plate
 *    lista `<model_instance>` com `<metadata key=object_id>` e
 *    `<metadata key=instance_id>` referenciando os build items.
 *
 * Aplica matrix 3MF (12 floats row-major, m41/m42/m43 = translação).
 *
 * Retorna null se algo der errado (caller usa fallback combineMesh).
 */
function parsePlateFromBambu3mf(
  buffer: ArrayBuffer,
  plateIndex: number,
): { vertices: number[]; indices: number[] } | null {
  if (typeof window === 'undefined' || !window.DOMParser) return null;
  const files = unzipSync(new Uint8Array(buffer));

  // DEBUG: lista arquivos do .3mf pra entender estrutura
  console.log('[3mf] arquivos no zip:', Object.keys(files).slice(0, 20));

  const modelRaw = files['3D/3dmodel.model'];
  const settingsRaw = files['Metadata/model_settings.config'];
  if (!modelRaw) {
    console.warn('[3mf] falta 3D/3dmodel.model');
    return null;
  }
  if (!settingsRaw) {
    console.warn('[3mf] falta Metadata/model_settings.config — Bambu não detectado');
    return null;
  }

  const parser = new DOMParser();
  const modelDoc = parser.parseFromString(strFromU8(modelRaw), 'application/xml');
  const settingsDoc = parser.parseFromString(strFromU8(settingsRaw), 'application/xml');

  // 1. objects (definição completa: mesh inline + components). Bambu split-mesh:
  // - <object id="X"> em 3dmodel.model pode ser wrapper com <components>
  //   apontando pra arquivos externos (objectid -> 3D/Objects/object_N.model)
  // - <object> em arquivos externos tem mesh inline
  // Pra resolver um objeto, descemos recursivamente pelos components aplicando
  // composição de transforms (cada component tem seu próprio transform).
  type ObjectDef = {
    mesh: { vertices: Float32Array; indices: number[] } | null;
    components: { objectId: string; matrix: number[] }[];
  };
  const objects = new Map<string, ObjectDef>();

  const parseTransform = (s: string | null): number[] => {
    const arr = (s ?? '1 0 0 0 1 0 0 0 1 0 0 0').trim().split(/\s+/).map(Number);
    return arr.length === 12 ? arr : [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  };

  const extractObjectDef = (obj: Element): ObjectDef => {
    const verts: number[] = [];
    obj.querySelectorAll('mesh > vertices > vertex').forEach((v) => {
      verts.push(
        Number(v.getAttribute('x') ?? 0),
        Number(v.getAttribute('y') ?? 0),
        Number(v.getAttribute('z') ?? 0),
      );
    });
    const tris: number[] = [];
    obj.querySelectorAll('mesh > triangles > triangle').forEach((t) => {
      tris.push(
        Number(t.getAttribute('v1') ?? 0),
        Number(t.getAttribute('v2') ?? 0),
        Number(t.getAttribute('v3') ?? 0),
      );
    });
    const mesh =
      verts.length > 0 && tris.length > 0
        ? { vertices: new Float32Array(verts), indices: tris }
        : null;
    const components: { objectId: string; matrix: number[] }[] = [];
    obj.querySelectorAll('components > component').forEach((c) => {
      const objectId = c.getAttribute('objectid');
      if (!objectId) return;
      components.push({
        objectId,
        matrix: parseTransform(c.getAttribute('transform')),
      });
    });
    return { mesh, components };
  };

  // 1a. Lê arquivos externos 3D/Objects/object_*.model (formato Bambu split-mesh).
  // Indexa pelo número do path E pelo internal <object id> como fallback.
  let splitFileCount = 0;
  for (const path of Object.keys(files)) {
    const match = /^3D\/Objects\/object_(\d+)\.model$/.exec(path);
    if (!match) continue;
    splitFileCount++;
    const fileObjectId = match[1]!;
    try {
      const objDoc = parser.parseFromString(strFromU8(files[path]!), 'application/xml');
      objDoc.querySelectorAll('object').forEach((obj) => {
        const internalId = obj.getAttribute('id');
        const def = extractObjectDef(obj);
        if (!def.mesh && def.components.length === 0) return;
        objects.set(fileObjectId, def);
        if (internalId && internalId !== fileObjectId) objects.set(internalId, def);
      });
    } catch (err) {
      console.warn(`[3mf] falha parsing ${path}:`, err);
    }
  }

  // 1b. Lê 3D/3dmodel.model — geralmente tem wrappers <object> com <components>
  // apontando pros arquivos externos. NÃO usa `objects.has(id)` como guard porque
  // queremos sobrescrever objetos com versão que inclui components.
  let inlineCount = 0;
  modelDoc.querySelectorAll('object').forEach((obj) => {
    const id = obj.getAttribute('id');
    if (!id) return;
    const def = extractObjectDef(obj);
    if (!def.mesh && def.components.length === 0) return;
    objects.set(id, def);
    inlineCount++;
  });

  let withMesh = 0,
    withComp = 0;
  for (const def of objects.values()) {
    if (def.mesh) withMesh++;
    if (def.components.length) withComp++;
  }
  console.log(
    `[3mf] objects: ${splitFileCount} external files + ${inlineCount} inline → ${objects.size} entries (${withMesh} c/ mesh, ${withComp} c/ components)`,
  );
  console.log(`[3mf] objects keys (até 30):`, Array.from(objects.keys()).slice(0, 30));

  // 2. Build items na ordem (instance_id = índice GLOBAL).
  type BuildItem = { objectId: string; matrix: number[] };
  const buildItems: BuildItem[] = [];
  modelDoc.querySelectorAll('build > item').forEach((item) => {
    const objectId = item.getAttribute('objectid');
    if (!objectId) return;
    const transform = (item.getAttribute('transform') ?? '1 0 0 0 1 0 0 0 1 0 0 0')
      .trim()
      .split(/\s+/)
      .map(Number);
    if (transform.length !== 12) return;
    buildItems.push({ objectId, matrix: transform });
  });

  console.log(`[3mf] objects: ${objects.size}, build items: ${buildItems.length}`);
  console.log(
    `[3mf] build items detail:`,
    buildItems.slice(0, 10).map((b) => ({ objectId: b.objectId, tx: b.matrix.slice(9, 12) })),
  );

  if (objects.size === 0 || buildItems.length === 0) return null;

  // 3. Acha o <plate> com plater_id == plateIndex.
  // Bambu usa key="plater_id" (NÃO plate_id) como filho direto de <plate>.
  // Cada <plate> agrupa <model_instance> filhos com object_id/instance_id.
  const allPlates = Array.from(settingsDoc.querySelectorAll('plate'));
  console.log(`[3mf] total <plate> em settings: ${allPlates.length}, buscando id=${plateIndex}`);

  const plateIds: number[] = [];
  let targetPlate: Element | null = null;
  for (const p of allPlates) {
    let pid = -1;
    for (const child of Array.from(p.children)) {
      if (child.tagName.toLowerCase() !== 'metadata') continue;
      const k = child.getAttribute('key');
      if (k === 'plater_id' || k === 'plate_id' || k === 'plate_index' || k === 'plater_index') {
        pid = Number(child.getAttribute('value'));
      }
    }
    if (pid >= 0) plateIds.push(pid);
    if (pid === plateIndex && !targetPlate) targetPlate = p;
  }
  console.log(`[3mf] plate ids encontrados:`, plateIds);

  if (!targetPlate) {
    console.warn(`[3mf] plate ${plateIndex} NÃO encontrado. disponíveis:`, plateIds);
    return null;
  }

  // 4. Lê <model_instance> filhos diretos do targetPlate, e dentro de cada
  // um lê os metadados object_id e instance_id.
  interface InstanceRef {
    objectId: string;
    instanceId: number;
  }
  const refs: InstanceRef[] = [];
  for (const child of Array.from(targetPlate.children)) {
    if (child.tagName.toLowerCase() !== 'model_instance') continue;
    let objId = '';
    let instId = -1;
    for (const m of Array.from(child.children)) {
      if (m.tagName.toLowerCase() !== 'metadata') continue;
      const k = m.getAttribute('key');
      const v = m.getAttribute('value') ?? '';
      if (k === 'object_id') objId = v;
      else if (k === 'instance_id') instId = Number(v);
    }
    if (objId && instId >= 0) refs.push({ objectId: objId, instanceId: instId });
  }
  console.log(`[3mf] model_instances do plate ${plateIndex}: ${refs.length} refs`, refs);

  if (refs.length === 0) {
    console.warn(`[3mf] plate ${plateIndex} sem model_instances`);
    return null;
  }

  // 5. Resolve mesh por objeto, expandindo recursivamente os <components>
  // do Bambu split-mesh. Compõe transforms (inner.matrix × outer.matrix) ao
  // descer cada nível.
  const itemsByObjectId = new Map<string, BuildItem[]>();
  for (const b of buildItems) {
    const arr = itemsByObjectId.get(b.objectId) ?? [];
    arr.push(b);
    itemsByObjectId.set(b.objectId, arr);
  }

  // Composição de transforms 3MF (afim 4x3 row-major).
  // p' = p * inner_R + inner_T (no objeto interno), então no parent:
  //   p'' = p' * outer_R + outer_T
  //       = p * (inner_R * outer_R) + (inner_T * outer_R + outer_T)
  const composeTransform = (inner: number[], outer: number[]): number[] => {
    const r = new Array(12);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        r[i * 3 + j] =
          inner[i * 3]! * outer[j]! +
          inner[i * 3 + 1]! * outer[3 + j]! +
          inner[i * 3 + 2]! * outer[6 + j]!;
      }
    }
    for (let j = 0; j < 3; j++) {
      r[9 + j] =
        inner[9]! * outer[j]! +
        inner[10]! * outer[3 + j]! +
        inner[11]! * outer[6 + j]! +
        outer[9 + j]!;
    }
    return r;
  };

  const allVerts: number[] = [];
  const allIdx: number[] = [];

  const resolveObject = (
    objectId: string,
    transform: number[],
    visited: Set<string>,
  ): number => {
    if (visited.has(objectId)) {
      console.warn(`[3mf] ciclo em object ${objectId}, pulando`);
      return 0;
    }
    const def = objects.get(objectId);
    if (!def) {
      console.warn(`[3mf] resolveObject: object ${objectId} não existe`);
      return 0;
    }
    visited.add(objectId);
    let addedVerts = 0;
    if (def.mesh) {
      const baseIdx = allVerts.length / 3;
      const v = def.mesh.vertices;
      const nVerts = v.length / 3;
      const m = transform;
      for (let i = 0; i < nVerts; i++) {
        const x = v[i * 3]!;
        const y = v[i * 3 + 1]!;
        const z = v[i * 3 + 2]!;
        allVerts.push(
          x * m[0]! + y * m[3]! + z * m[6]! + m[9]!,
          x * m[1]! + y * m[4]! + z * m[7]! + m[10]!,
          x * m[2]! + y * m[5]! + z * m[8]! + m[11]!,
        );
      }
      for (let i = 0; i < def.mesh.indices.length; i++) {
        allIdx.push(def.mesh.indices[i]! + baseIdx);
      }
      addedVerts += nVerts;
    }
    for (const comp of def.components) {
      addedVerts += resolveObject(
        comp.objectId,
        composeTransform(comp.matrix, transform),
        visited,
      );
    }
    visited.delete(objectId);
    return addedVerts;
  };

  for (const ref of refs) {
    const sameObjItems = itemsByObjectId.get(ref.objectId) ?? [];
    const item: BuildItem | undefined =
      sameObjItems[ref.instanceId] ?? sameObjItems[0] ?? buildItems[ref.instanceId];
    if (!item) {
      console.warn(
        `[3mf] ref (object_id=${ref.objectId}, instance_id=${ref.instanceId}) sem build item`,
      );
      continue;
    }
    console.log(
      `[3mf] resolvendo: ref=${ref.objectId} item=${item.objectId} tx=${item.matrix.slice(9, 12).join(',')}`,
    );
    // Tenta primeiro pelo ref.objectId (do model_instance — geralmente é o wrapper
    // composto), depois pelo item.objectId (do build).
    let added = resolveObject(ref.objectId, item.matrix, new Set());
    if (added === 0 && ref.objectId !== item.objectId) {
      console.warn(`[3mf] ref ${ref.objectId} gerou 0 verts; tentando item ${item.objectId}`);
      added = resolveObject(item.objectId, item.matrix, new Set());
    }
    console.log(`[3mf] ref ${ref.objectId}: ${added} verts adicionados`);
  }

  if (allVerts.length === 0) {
    console.warn('[3mf] parser plate-aware: 0 vértices coletados');
    return null;
  }
  console.log(
    `[3mf] parser plate-aware OK: ${allVerts.length / 3} vértices, ${allIdx.length / 3} triângulos`,
  );
  return { vertices: allVerts, indices: allIdx };
}

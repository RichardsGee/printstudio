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

  // 1. objects (mesh data por id). Bambu Studio usa formato split:
  // 3D/3dmodel.model só lista components apontando pra arquivos externos
  // em 3D/Objects/object_N.model (cada um com o mesh inline). Lemos
  // PRIMEIRO os arquivos externos, DEPOIS o 3dmodel.model como fallback
  // pra objects com mesh inline.
  type ObjectMesh = { vertices: Float32Array; indices: number[] };
  const objects = new Map<string, ObjectMesh>();

  function extractMeshFromObjectElement(obj: Element): ObjectMesh | null {
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
    if (verts.length === 0 || tris.length === 0) return null;
    return { vertices: new Float32Array(verts), indices: tris };
  }

  // 1a. Lê arquivos externos 3D/Objects/object_*.model (formato Bambu split)
  let splitFileCount = 0;
  for (const path of Object.keys(files)) {
    if (!path.startsWith('3D/Objects/') || !path.endsWith('.model')) continue;
    splitFileCount++;
    try {
      const objDoc = parser.parseFromString(strFromU8(files[path]!), 'application/xml');
      objDoc.querySelectorAll('object').forEach((obj) => {
        const id = obj.getAttribute('id');
        if (!id) return;
        const mesh = extractMeshFromObjectElement(obj);
        if (mesh) objects.set(id, mesh);
      });
    } catch (err) {
      console.warn(`[3mf] falha parsing ${path}:`, err);
    }
  }
  console.log(`[3mf] objects de arquivos externos: ${splitFileCount} files → ${objects.size} objects`);

  // 1b. Fallback: lê objects inline do 3dmodel.model (formato monolítico)
  let inlineCount = 0;
  modelDoc.querySelectorAll('object').forEach((obj) => {
    const id = obj.getAttribute('id');
    if (!id || objects.has(id)) return;
    const mesh = extractMeshFromObjectElement(obj);
    if (mesh) {
      objects.set(id, mesh);
      inlineCount++;
    }
  });
  if (inlineCount > 0) {
    console.log(`[3mf] +${inlineCount} objects inline do 3dmodel.model`);
  }

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

  // 3. Acha o plate desejado em model_settings.config
  const allPlates = settingsDoc.querySelectorAll('plate');
  console.log(`[3mf] total plates em settings: ${allPlates.length}, buscando plate_id=${plateIndex}`);
  const platesFound: number[] = [];
  let targetPlate: Element | null = null;
  allPlates.forEach((p) => {
    p.querySelectorAll(':scope > metadata').forEach((m) => {
      if (m.getAttribute('key') === 'plate_id') {
        const v = Number(m.getAttribute('value'));
        platesFound.push(v);
        if (v === plateIndex && !targetPlate) targetPlate = p;
      }
    });
  });
  console.log(`[3mf] plate_ids encontrados no settings:`, platesFound);
  if (!targetPlate) {
    console.warn(`[3mf] plate ${plateIndex} NÃO encontrado no settings`);
    return null;
  }

  // 4. Lê os model_instances do plate
  interface InstanceRef {
    objectId: string;
    instanceId: number;
  }
  const refs: InstanceRef[] = [];
  (targetPlate as Element).querySelectorAll('model_instance').forEach((mi) => {
    let objId = '';
    let instId = -1;
    mi.querySelectorAll('metadata').forEach((m) => {
      const k = m.getAttribute('key');
      const v = m.getAttribute('value') ?? '';
      if (k === 'object_id') objId = v;
      else if (k === 'instance_id') instId = Number(v);
    });
    if (objId && instId >= 0) refs.push({ objectId: objId, instanceId: instId });
  });
  console.log(`[3mf] model_instances do plate ${plateIndex}: ${refs.length} refs`, refs);
  console.log(
    `[3mf] XML do plate ${plateIndex} (primeiros 2KB):\n`,
    new XMLSerializer().serializeToString(targetPlate as Element).slice(0, 2000),
  );
  if (refs.length === 0) {
    console.warn(`[3mf] plate ${plateIndex} sem model_instances`);
    return null;
  }

  // 5. Pra cada ref, encontra build item correto e aplica transform.
  // Tenta interpretar instance_id de 2 formas — primeiro como índice
  // global no build, depois como índice por objectId (Bambu varia).
  const itemsByObjectId = new Map<string, BuildItem[]>();
  for (const b of buildItems) {
    const arr = itemsByObjectId.get(b.objectId) ?? [];
    arr.push(b);
    itemsByObjectId.set(b.objectId, arr);
  }

  const allVerts: number[] = [];
  const allIdx: number[] = [];
  let vOffset = 0;

  for (const ref of refs) {
    // Estratégia 1: instance_id como índice global
    let item: BuildItem | undefined = buildItems[ref.instanceId];
    let strategy = 'global';
    if (!item || item.objectId !== ref.objectId) {
      // Estratégia 2: instance_id como índice dentro dos items do mesmo objectId
      item = itemsByObjectId.get(ref.objectId)?.[ref.instanceId];
      strategy = 'per-objectId';
    }
    if (!item) {
      console.warn(
        `[3mf] ref (object_id=${ref.objectId}, instance_id=${ref.instanceId}) sem build item correspondente`,
      );
      continue;
    }
    const obj = objects.get(item.objectId);
    if (!obj) {
      console.warn(`[3mf] objectId ${item.objectId} sem geometry`);
      continue;
    }
    console.log(
      `[3mf] aplicando build item: objectId=${item.objectId} via ${strategy}, tx=${item.matrix.slice(9, 12).join(',')}, verts=${obj.vertices.length / 3}`,
    );

    const m = item.matrix;
    // 3MF transform: row-major; m[0..8] = rotação/escala 3x3, m[9..11] = translação
    // Apply: [x' y' z'] = [x y z] * R + t
    const nVerts = obj.vertices.length / 3;
    for (let i = 0; i < nVerts; i++) {
      const x = obj.vertices[i * 3]!;
      const y = obj.vertices[i * 3 + 1]!;
      const z = obj.vertices[i * 3 + 2]!;
      const nx = x * m[0]! + y * m[3]! + z * m[6]! + m[9]!;
      const ny = x * m[1]! + y * m[4]! + z * m[7]! + m[10]!;
      const nz = x * m[2]! + y * m[5]! + z * m[8]! + m[11]!;
      allVerts.push(nx, ny, nz);
    }
    for (let i = 0; i < obj.indices.length; i++) {
      allIdx.push(obj.indices[i]! + vOffset);
    }
    vOffset += nVerts;
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

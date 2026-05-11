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

interface PlateMesh {
  plateIndex: number;
  vertices: number[];
  indices: number[];
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

        setProgress('Parseando mesh…');
        const combined = await parseCombinedMesh(buffer);

        setProgress(`Enviando plate ${plateToSave}…`);
        const payload: CachedModelUploadRequest = {
          bambuModelId,
          plateIndex: plateToSave,
          filename: file.name,
          sizeBytes: file.size,
          meshPayload: {
            vertices: combined.vertices,
            indices: combined.indices,
          },
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
          `Vinculado ao plate ${plateToSave} · ${(combined.vertices.length / 3).toLocaleString('pt-BR')} vértices`,
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

async function parsePlates(buffer: ArrayBuffer): Promise<PlateMesh[]> {
  const uint8 = new Uint8Array(buffer);
  const files = unzipSync(uint8);

  // Carrega tudo com ThreeMFLoader pra ter geometrias com transform aplicado
  const loader = new ThreeMFLoader();
  const group = loader.parse(buffer);

  // Coleta TODOS os meshes do Group, indexados de várias formas pra
  // maximizar chance de match com object_id do model_settings.config.
  // ThreeMFLoader (Three r184) é inconsistente sobre onde guarda o id
  // do object original — às vezes em mesh.name, às vezes em userData.
  const allMeshes: THREE.Mesh[] = [];
  const meshById = new Map<string, THREE.Mesh[]>();
  function indexBy(key: string | undefined | null, mesh: THREE.Mesh) {
    if (!key) return;
    const k = String(key);
    const list = meshById.get(k) ?? [];
    list.push(mesh);
    meshById.set(k, list);
  }
  group.traverse((obj: THREE.Object3D) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (!obj.geometry || !obj.geometry.getAttribute('position')) return;
    allMeshes.push(obj);
    indexBy(obj.name, obj);
    const ud = obj.userData ?? {};
    indexBy(ud.objectId as string, obj);
    indexBy(ud.id as string, obj);
    indexBy(ud.componentId as string, obj);
  });

  if (allMeshes.length === 0) {
    throw new Error(
      'ThreeMFLoader não retornou meshes — arquivo .3mf pode estar corrompido ou em formato não suportado',
    );
  }

  // Tenta ler model_settings.config (Bambu proprietary) pra detectar plates
  const settingsRaw = files['Metadata/model_settings.config'];
  const platesMap = settingsRaw
    ? parsePlatesFromSettings(strFromU8(settingsRaw))
    : null;

  // Fallback 1: sem mapping de plates ou mapping vazio → tudo vira plate 1
  if (!platesMap || platesMap.size === 0) {
    const combined = combineMeshes(allMeshes);
    if (!combined) throw new Error('Falha ao combinar meshes (geometria vazia)');
    return [{ plateIndex: 1, ...combined }];
  }

  // Tenta gerar 1 mesh por plate usando object_ids do settings
  const result: PlateMesh[] = [];
  let matchedAny = false;
  for (const [plateIndex, objectIds] of platesMap.entries()) {
    const seen = new Set<THREE.Mesh>();
    for (const oid of objectIds) {
      const list = meshById.get(oid);
      if (list) {
        matchedAny = true;
        list.forEach((m) => seen.add(m));
      }
    }
    if (seen.size > 0) {
      const combined = combineMeshes(Array.from(seen));
      if (combined) result.push({ plateIndex, ...combined });
    }
  }

  // Fallback 2: mapping existe mas nenhum object_id casa com mesh
  // (id desencontrado pelo loader) → tudo vira plate 1
  if (!matchedAny || result.length === 0) {
    const combined = combineMeshes(allMeshes);
    if (!combined) throw new Error('Falha ao combinar meshes');
    return [{ plateIndex: 1, ...combined }];
  }

  return result.sort((a, b) => a.plateIndex - b.plateIndex);
}

/**
 * Parsea Bambu model_settings.config (XML) pra extrair plate_id → [object_ids].
 *
 * Estrutura típica:
 *   <plate>
 *     <metadata key="plate_id" value="1"/>
 *     <model_instance>
 *       <metadata key="object_id" value="2"/>
 *     </model_instance>
 *   </plate>
 */
function parsePlatesFromSettings(xml: string): Map<number, string[]> {
  const result = new Map<number, string[]>();
  if (typeof window === 'undefined' || !window.DOMParser) return result;

  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const plates = doc.querySelectorAll('plate');
  plates.forEach((plate) => {
    let plateId: number | null = null;
    plate.querySelectorAll(':scope > metadata').forEach((m) => {
      if (m.getAttribute('key') === 'plate_id') {
        const v = parseInt(m.getAttribute('value') ?? '', 10);
        if (Number.isFinite(v)) plateId = v;
      }
    });
    if (plateId === null) return;
    const objectIds: string[] = [];
    plate.querySelectorAll('model_instance > metadata').forEach((m) => {
      if (m.getAttribute('key') === 'object_id') {
        const v = m.getAttribute('value');
        if (v) objectIds.push(v);
      }
    });
    if (objectIds.length > 0) result.set(plateId, objectIds);
  });
  return result;
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

'use client';

import { useRef, useState, useTransition } from 'react';
import * as THREE from 'three';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { unzipSync, strFromU8 } from 'fflate';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { CachedModelUploadRequest } from '@printstudio/shared';

interface Props {
  bambuModelId: string;
  /** Callback após upload bem-sucedido. */
  onUploaded?: () => void;
  className?: string;
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
export function UploadCachedModel({ bambuModelId, onUploaded, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);

  function handleClick() {
    inputRef.current?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.name.toLowerCase().endsWith('.3mf')) {
      toast.error('Apenas arquivos .3mf são suportados');
      return;
    }

    start(async () => {
      try {
        setProgress('Lendo arquivo…');
        const buffer = await file.arrayBuffer();

        setProgress('Parseando plates…');
        const plates = await parsePlates(buffer);
        if (plates.length === 0) {
          throw new Error('Nenhum plate com mesh encontrado no .3mf');
        }

        for (let i = 0; i < plates.length; i++) {
          const plate = plates[i]!;
          setProgress(`Enviando plate ${i + 1}/${plates.length}…`);
          const payload: CachedModelUploadRequest = {
            bambuModelId,
            plateIndex: plate.plateIndex,
            filename: file.name,
            sizeBytes: file.size,
            meshPayload: {
              vertices: plate.vertices,
              indices: plate.indices,
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
            throw new Error(`upload plate ${plate.plateIndex} falhou: ${txt.slice(0, 120)}`);
          }
        }

        const totalVerts = plates.reduce((s, p) => s + p.vertices.length / 3, 0);
        toast.success(
          `Vinculado: ${plates.length} plate(s) · ${totalVerts.toLocaleString('pt-BR')} vértices`,
        );
        onUploaded?.();
      } catch (err) {
        toast.error((err as Error).message || 'Falha no upload');
      } finally {
        setProgress(null);
      }
    });
  }

  return (
    <>
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
        className={className}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        <span className="ml-2 text-xs">{progress ?? 'Vincular .3mf'}</span>
      </Button>
    </>
  );
}

/**
 * Parseia um .3mf e retorna array de meshes (1 por plate). Usa fflate
 * pra ler o ZIP, ThreeMFLoader pra montar as geometrias com
 * transformações, e parseia Metadata/model_settings.config pra mapear
 * plate_id → object_ids.
 */
async function parsePlates(buffer: ArrayBuffer): Promise<PlateMesh[]> {
  const uint8 = new Uint8Array(buffer);
  const files = unzipSync(uint8);

  // Carrega tudo com ThreeMFLoader pra ter geometrias com transform aplicado
  const loader = new ThreeMFLoader();
  const group = loader.parse(buffer);

  // Coleta meshes por objectId
  const meshesByObjectId = new Map<string, THREE.Mesh[]>();
  group.traverse((obj: THREE.Object3D) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const objectId = String(obj.userData?.objectId ?? obj.userData?.id ?? '');
    if (!objectId) return;
    const list = meshesByObjectId.get(objectId) ?? [];
    list.push(obj);
    meshesByObjectId.set(objectId, list);
  });

  // Lê model_settings.config (Bambu proprietary XML) pra mapear plates
  const settingsRaw = files['Metadata/model_settings.config'];
  const platesMap = settingsRaw
    ? parsePlatesFromSettings(strFromU8(settingsRaw))
    : null;

  if (!platesMap || platesMap.size === 0) {
    // Sem metadados de plate — combina tudo num plate único (fallback)
    const combined = combineMeshes(Array.from(meshesByObjectId.values()).flat());
    return combined ? [{ plateIndex: 1, ...combined }] : [];
  }

  const result: PlateMesh[] = [];
  for (const [plateIndex, objectIds] of platesMap.entries()) {
    const meshes: THREE.Mesh[] = [];
    for (const oid of objectIds) {
      const list = meshesByObjectId.get(oid);
      if (list) meshes.push(...list);
    }
    const combined = combineMeshes(meshes);
    if (combined) {
      result.push({ plateIndex, ...combined });
    }
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

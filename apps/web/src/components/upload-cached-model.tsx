'use client';

import { useRef, useState, useTransition } from 'react';
import * as THREE from 'three';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { CachedModelUploadRequest } from '@printstudio/shared';

interface Props {
  bambuModelId: string;
  /** Callback após upload bem-sucedido — usado pra refresh do RealisticPreview3D. */
  onUploaded?: () => void;
  className?: string;
}

/**
 * Botão "Vincular .3mf a este modelo" (Story 4.8).
 *
 * Quando o user seleciona um .3mf, parseia o arquivo no client usando
 * Three.js ThreeMFLoader, extrai os meshes de TODOS os objetos do
 * modelo, combina em um único BufferGeometry, e envia o JSON
 * (vertices+indices) pro endpoint /api/cached-models.
 *
 * O server só armazena — não precisa ter parser .3mf no Node.
 *
 * Após upload, futuras impressões deste bambuModelId reusam o mesh
 * automaticamente no RealisticPreview3D (mesh rotacionável real,
 * não o pick_1.png isométrico estático).
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
    e.target.value = ''; // permite re-selecionar mesmo arquivo

    if (!file.name.toLowerCase().endsWith('.3mf')) {
      toast.error('Apenas arquivos .3mf são suportados');
      return;
    }

    start(async () => {
      try {
        setProgress('Lendo arquivo…');
        const buffer = await file.arrayBuffer();

        setProgress('Parseando mesh 3D…');
        const meshPayload = await parseThreeMF(buffer);

        setProgress('Enviando…');
        const payload: CachedModelUploadRequest = {
          bambuModelId,
          filename: file.name,
          sizeBytes: file.size,
          meshPayload,
        };
        const res = await fetch('/api/cached-models', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`upload falhou (${res.status}): ${txt.slice(0, 120)}`);
        }

        toast.success(
          `Vinculado: ${file.name} (${(meshPayload.vertices.length / 3).toLocaleString('pt-BR')} vértices)`,
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
 * Parseia um .3mf em ArrayBuffer e retorna mesh combinado em JSON.
 *
 * ThreeMFLoader devolve um Group com N children (cada um = um object
 * do .3mf). Iteramos pra coletar TODOS os geometries — ignora plates
 * (no MVP, todos plates compõem um único mesh visual).
 */
async function parseThreeMF(buffer: ArrayBuffer): Promise<{ vertices: number[]; indices: number[] }> {
  const loader = new ThreeMFLoader();
  const group = loader.parse(buffer);

  const allVertices: number[] = [];
  const allIndices: number[] = [];
  let vertexOffset = 0;

  group.traverse((obj: THREE.Object3D) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const geom = obj.geometry as THREE.BufferGeometry;
    if (!geom) return;

    // Aplica transformação do object (pose no plate)
    obj.updateMatrixWorld(true);
    const matrix = obj.matrixWorld;

    const posAttr = geom.getAttribute('position');
    if (!posAttr) return;
    const tempVec = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      tempVec.fromBufferAttribute(posAttr as THREE.BufferAttribute, i);
      tempVec.applyMatrix4(matrix);
      allVertices.push(tempVec.x, tempVec.y, tempVec.z);
    }

    const idx = geom.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        allIndices.push(idx.getX(i) + vertexOffset);
      }
    } else {
      // Geometry sem index — assume triângulos sequenciais
      for (let i = 0; i < posAttr.count; i++) {
        allIndices.push(i + vertexOffset);
      }
    }
    vertexOffset += posAttr.count;
  });

  if (allVertices.length === 0) {
    throw new Error('Nenhum mesh encontrado no .3mf');
  }

  return { vertices: allVertices, indices: allIndices };
}

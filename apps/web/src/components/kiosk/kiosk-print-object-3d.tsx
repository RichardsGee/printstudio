'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Box } from 'lucide-react';
import { cn } from '@/lib/utils';

const LAN_HOST = process.env.NEXT_PUBLIC_LAN_DISCOVERY_HOST ?? 'localhost';
const LAN_PORT = process.env.NEXT_PUBLIC_LAN_DISCOVERY_PORT ?? '8080';

interface MeshPayload {
  fileName: string;
  vertices: number[];
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

interface Props {
  printerId: string;
  cacheKey?: string | null;
  currentLayer?: number | null;
  totalLayers?: number | null;
  filamentColor?: string | null;
  /** Callback chamado quando a renderização 3D falha — UI pode cair pro 2D. */
  onError?: () => void;
  className?: string;
}

/**
 * Render 3D do objeto sendo impresso, com plano de corte baseado
 * na camada atual. Mesh extraído do `.3mf` pelo bridge, deduplicado
 * pra mostrar 1 instância. Câmera frontal com leve auto-rotation.
 *
 * Acima do plano de corte: ghost translúcido (não impresso ainda).
 * Abaixo: cor sólida do filamento (já impresso).
 * No plano: linha brilhante glow.
 */
export function KioskPrintObject3D({
  printerId,
  cacheKey,
  currentLayer,
  totalLayers,
  filamentColor,
  onError,
  className,
}: Props) {
  const [mesh, setMesh] = useState<MeshPayload | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading');
  const retryRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let alive = true;
    let attempt = 0;
    setStatus('loading');
    setMesh(null);

    const tryFetch = (): void => {
      const fileParam = cacheKey ? `&file=${encodeURIComponent(cacheKey)}` : '';
      const url = `http://${LAN_HOST}:${LAN_PORT}/api/printers/${printerId}/mesh.json?v=${encodeURIComponent(
        cacheKey ?? 'none',
      )}${fileParam}`;

      fetch(url)
        .then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const data: MeshPayload = await r.json();
          if (!alive) return;
          if (!data.vertices?.length || !data.indices?.length) {
            throw new Error('empty mesh');
          }
          setMesh(data);
          setStatus('ok');
        })
        .catch(() => {
          if (!alive) return;
          attempt++;
          if (attempt === 1) setStatus('empty');
          if (attempt >= 5) {
            setStatus('error');
            onError?.();
            return;
          }
          const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
          retryRef.current = setTimeout(tryFetch, delay);
        });
    };
    tryFetch();

    return () => {
      alive = false;
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [printerId, cacheKey, onError]);

  const progress =
    currentLayer != null && totalLayers != null && totalLayers > 0
      ? Math.max(0, Math.min(1, currentLayer / totalLayers))
      : 0;

  return (
    <div
      className={cn(
        'relative w-full h-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-[#0a0f1c] to-[#020409]',
        className,
      )}
    >
      {status === 'ok' && mesh ? (
        <Canvas
          gl={{ localClippingEnabled: true, antialias: true, alpha: true }}
          camera={{ fov: 35, position: [0, 0, 0], near: 0.1, far: 5000 }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <Scene mesh={mesh} progress={progress} filamentColor={filamentColor ?? null} />
          </Suspense>
        </Canvas>
      ) : (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <Box
              strokeWidth={1.2}
              style={{ width: 'clamp(2rem, 4vw, 3.5rem)', height: 'clamp(2rem, 4vw, 3.5rem)' }}
            />
            <span style={{ fontSize: 'clamp(0.75rem, 1.1vw, 0.9375rem)' }}>
              {status === 'loading'
                ? 'Carregando modelo 3D…'
                : status === 'error'
                  ? 'Sem modelo 3D'
                  : 'Aguardando modelo…'}
            </span>
          </div>
        </div>
      )}

      {status === 'ok' && currentLayer != null && totalLayers != null ? (
        <div className="absolute bottom-2 right-2 rounded-md bg-background/80 backdrop-blur-sm border border-border/60 px-2 py-1 font-mono tabular-nums text-foreground pointer-events-none">
          <span style={{ fontSize: 'clamp(0.625rem, 1vw, 0.875rem)' }}>
            {currentLayer}
            <span className="text-muted-foreground"> / {totalLayers}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Componente da cena — separado pra usar `useFrame` e `useThree`. */
function Scene({
  mesh,
  progress,
  filamentColor,
}: {
  mesh: MeshPayload;
  progress: number;
  filamentColor: string | null;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera, size } = useThree();

  // BufferGeometry construída uma vez por mesh — cache via useMemo.
  // Bambu .3mf usa Z-up (Z é altura). A cena usa Y-up (padrão Three.js).
  // Convertemos no buffer pra que o "fill vertical" funcione corretamente.
  const { geometry, height, radius, centerY } = useMemo(() => {
    const verts = new Float32Array(mesh.vertices.length);
    for (let i = 0; i < mesh.vertices.length; i += 3) {
      const x = mesh.vertices[i];
      const y = mesh.vertices[i + 1];
      const z = mesh.vertices[i + 2];
      // Swap Y<->Z pra deixar Z-up do .3mf como Y-up no Three.js.
      verts[i] = x;
      verts[i + 1] = z;
      verts[i + 2] = -y;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    const useUint32 = mesh.indices.some((v) => v > 0xffff);
    geo.setIndex(
      new THREE.BufferAttribute(
        useUint32 ? new Uint32Array(mesh.indices) : new Uint16Array(mesh.indices),
        1,
      ),
    );
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    const bbox = geo.boundingBox!;
    // Centraliza o mesh: chão fica em y=0 (parte de baixo).
    const cx = (bbox.max.x + bbox.min.x) / 2;
    const cz = (bbox.max.z + bbox.min.z) / 2;
    const offsetY = bbox.min.y;
    geo.translate(-cx, -offsetY, -cz);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    const h = bbox.max.y - bbox.min.y;
    const r = geo.boundingSphere!.radius;
    return { geometry: geo, height: h, radius: r, centerY: h / 2 };
  }, [mesh]);

  // Posiciona câmera baseado no raio do mesh — distância pra caber
  // confortavelmente no FOV. Olha pra metade da altura do objeto.
  useEffect(() => {
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 35;
    const aspect = size.width / Math.max(1, size.height);
    // distância pra caber a esfera bounding em ambos os eixos
    const distH = radius / Math.tan((fov * Math.PI) / 360);
    const distW = distH / aspect;
    const dist = Math.max(distH, distW) * 1.6; // folga visual

    camera.position.set(0, centerY * 1.05, dist);
    camera.lookAt(0, centerY * 0.55, 0);
    camera.updateProjectionMatrix();
  }, [camera, radius, centerY, size.width, size.height]);

  // Auto-rotation suave — 8°/s, fica vivo no kiosk sem cansar.
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.14;
    }
  });

  // Plano de corte na altura proporcional ao progresso (em camadas).
  // Como Y aponta pra cima, "abaixo do plano" = já impresso.
  const clipY = height * progress;

  // Clip plane normais:
  // - belowClip: mantém pontos com -Y + clipY > 0 → y < clipY (impresso)
  // - aboveClip: mantém pontos com  Y - clipY > 0 → y > clipY (ghost)
  const clipPlanes = useMemo(() => {
    return {
      below: [new THREE.Plane(new THREE.Vector3(0, -1, 0), clipY)],
      above: [new THREE.Plane(new THREE.Vector3(0, 1, 0), -clipY)],
    };
  }, [clipY]);

  const baseColor = new THREE.Color(normalizeHex(filamentColor));
  const ghostColor = baseColor.clone().lerp(new THREE.Color(0xffffff), 0.4);

  return (
    <>
      {/* Iluminação — ambient pra preencher + key/fill light pra dar volume */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 4, 3]} intensity={1.6} castShadow={false} />
      <directionalLight position={[-3, 2, -2]} intensity={0.55} color="#88aaff" />

      <group ref={groupRef}>
        {/* Mesh "impresso" — abaixo do plano, full color */}
        <mesh geometry={geometry}>
          <meshStandardMaterial
            color={baseColor}
            roughness={0.55}
            metalness={0.05}
            clippingPlanes={progress < 1 ? clipPlanes.below : undefined}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Mesh "ghost" — acima do plano, translúcido */}
        {progress < 1 ? (
          <mesh geometry={geometry}>
            <meshStandardMaterial
              color={ghostColor}
              transparent
              opacity={0.18}
              roughness={0.85}
              metalness={0}
              clippingPlanes={clipPlanes.above}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ) : null}

        {/* Linha brilhante no plano de corte — "print head virtual" */}
        {progress > 0 && progress < 1 ? (
          <mesh position={[0, clipY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[radius * 0.85, radius * 0.95, 64]} />
            <meshBasicMaterial color={baseColor} transparent opacity={0.9} />
          </mesh>
        ) : null}
      </group>

      {/* Chão sutil pra dar contexto de "mesa de impressão" */}
      <mesh position={[0, -0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * 1.6, 64]} />
        <meshBasicMaterial color="#0a0f1c" transparent opacity={0.6} />
      </mesh>
    </>
  );
}

function normalizeHex(c: string | null | undefined): string {
  if (!c) return '#3b82f6';
  const m = c.match(/^#?([0-9a-fA-F]{6,8})$/);
  return m ? `#${m[1].slice(0, 6)}` : '#3b82f6';
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Box } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildMeshFromLayers, type LayersInput } from '@/lib/build-mesh-from-layers';

const LAN_HOST = process.env.NEXT_PUBLIC_LAN_DISCOVERY_HOST ?? 'localhost';
const LAN_PORT = process.env.NEXT_PUBLIC_LAN_DISCOVERY_PORT ?? '8080';

interface LayersPayload extends LayersInput {
  fileName: string;
  totalLayers: number;
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

interface SceneRefs {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  group: THREE.Group;
  printedMaterial: THREE.MeshStandardMaterial;
  ghostMaterial: THREE.MeshStandardMaterial;
  ringMesh: THREE.Mesh;
  belowPlane: THREE.Plane;
  abovePlane: THREE.Plane;
  meshHeight: number;
  meshRadius: number;
  rafId: number | null;
}

/**
 * Render 3D do objeto sendo impresso, reconstruído a partir dos
 * toolpaths do gcode (`layers.json` do bridge). Cada camada vira
 * um polígono extrudado (perímetro externo apenas), empilhados
 * formam o objeto. Plano de corte horizontal mostra o que já foi
 * impresso vs ghost.
 *
 * Por que não usar o mesh direto do .3mf? Bambu Studio strip o mesh
 * antes de mandar pra impressora — o .3mf só tem gcode + metadata.
 * A reconstrução por gcode é a única fonte 3D disponível em runtime.
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
  const [layers, setLayers] = useState<LayersPayload | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading');
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneRefs | null>(null);
  const retryRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch dos layers com retry exponencial.
  useEffect(() => {
    let alive = true;
    let attempt = 0;
    setStatus('loading');
    setLayers(null);

    const tryFetch = (): void => {
      const url = `http://${LAN_HOST}:${LAN_PORT}/api/printers/${printerId}/layers.json?v=${encodeURIComponent(
        cacheKey ?? 'none',
      )}`;

      fetch(url)
        .then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const data: LayersPayload = await r.json();
          if (!alive) return;
          if (!data.layers?.length) throw new Error('empty layers');
          setLayers(data);
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

  // Build da geometria — só refaz quando layers mudam, não a cada frame.
  const builtMesh = useMemo(() => {
    if (!layers) return null;
    try {
      const result = buildMeshFromLayers(layers);
      return result;
    } catch {
      return null;
    }
  }, [layers]);

  // Setup da cena (única por geometria). Recria scene quando o mesh muda.
  useEffect(() => {
    if (!builtMesh || !containerRef.current) return;

    const container = containerRef.current;
    let disposed = false;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      onError?.();
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.localClippingEnabled = true;

    const initialW = container.clientWidth || 300;
    const initialH = container.clientHeight || 300;
    renderer.setSize(initialW, initialH, false);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, initialW / initialH, 0.1, 5000);

    // Lights — ambient pra não ficar com áreas escurão; key+fill pra dar volume.
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(2, 4, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
    fill.position.set(-3, 2, -2);
    scene.add(fill);

    const { geometry, height: meshHeight, radius: meshRadius } = builtMesh;
    const centerY = meshHeight / 2;

    // Posição inicial da câmera baseada no bounding sphere.
    const aspect = initialW / Math.max(1, initialH);
    const distH = meshRadius / Math.tan((35 * Math.PI) / 360);
    const distW = distH / aspect;
    const dist = Math.max(distH, distW) * 1.6;
    camera.position.set(0, centerY * 1.05, dist);
    camera.lookAt(0, centerY * 0.55, 0);

    // Clipping planes — atualizados dinamicamente em updateClip().
    const belowPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    const abovePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    const baseColor = new THREE.Color(normalizeHex(filamentColor));

    const printedMaterial = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.6,
      metalness: 0.05,
      side: THREE.DoubleSide,
      clippingPlanes: [belowPlane],
    });
    const ghostColor = baseColor.clone().lerp(new THREE.Color(0xffffff), 0.4);
    const ghostMaterial = new THREE.MeshStandardMaterial({
      color: ghostColor,
      transparent: true,
      opacity: 0.18,
      roughness: 0.85,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      clippingPlanes: [abovePlane],
    });

    const group = new THREE.Group();
    const printedMesh = new THREE.Mesh(geometry, printedMaterial);
    const ghostMesh = new THREE.Mesh(geometry, ghostMaterial);
    group.add(printedMesh);
    group.add(ghostMesh);

    // Ring brilhante no plano de corte (print head virtual).
    const ringGeo = new THREE.RingGeometry(meshRadius * 0.85, meshRadius * 0.95, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    group.add(ringMesh);

    scene.add(group);

    // Chão sutil — disco escuro lembrando a mesa.
    const floorGeo = new THREE.CircleGeometry(meshRadius * 1.6, 64);
    const floorMat = new THREE.MeshBasicMaterial({
      color: 0x0a0f1c,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.001;
    scene.add(floor);

    const refs: SceneRefs = {
      renderer,
      scene,
      camera,
      group,
      printedMaterial,
      ghostMaterial,
      ringMesh,
      belowPlane,
      abovePlane,
      meshHeight,
      meshRadius,
      rafId: null,
    };
    sceneRef.current = refs;

    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e || disposed) return;
      const w = Math.max(1, Math.floor(e.contentRect.width));
      const h = Math.max(1, Math.floor(e.contentRect.height));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(container);

    let lastFrame = performance.now();
    const tick = (now: number): void => {
      if (disposed) return;
      const dt = (now - lastFrame) / 1000;
      lastFrame = now;
      group.rotation.y += dt * 0.14;
      renderer.render(scene, camera);
      refs.rafId = requestAnimationFrame(tick);
    };
    refs.rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      ro.disconnect();
      if (refs.rafId !== null) cancelAnimationFrame(refs.rafId);
      sceneRef.current = null;
      printedMaterial.dispose();
      ghostMaterial.dispose();
      ringMat.dispose();
      ringGeo.dispose();
      floorMat.dispose();
      floorGeo.dispose();
      geometry.dispose();
      renderer.dispose();
      try {
        container.removeChild(renderer.domElement);
      } catch {
        /* ignore */
      }
    };
  }, [builtMesh, filamentColor, onError]);

  // Atualiza clipping plane sem recriar a cena.
  useEffect(() => {
    const refs = sceneRef.current;
    if (!refs) return;

    const progress =
      currentLayer != null && totalLayers != null && totalLayers > 0
        ? Math.max(0, Math.min(1, currentLayer / totalLayers))
        : 0;
    const clipY = refs.meshHeight * progress;

    refs.belowPlane.constant = clipY;
    refs.abovePlane.constant = -clipY;
    refs.ringMesh.position.y = clipY;
    refs.ringMesh.visible = progress > 0 && progress < 1;
    refs.ghostMaterial.visible = progress < 1;
    refs.printedMaterial.clippingPlanes = progress < 1 ? [refs.belowPlane] : [];
  }, [currentLayer, totalLayers]);

  return (
    <div
      className={cn(
        'relative w-full h-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-[#0a0f1c] to-[#020409]',
        className,
      )}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {status !== 'ok' || !builtMesh ? (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground bg-gradient-to-b from-[#0a0f1c] to-[#020409]">
          <div className="flex flex-col items-center gap-2">
            <Box
              strokeWidth={1.2}
              style={{ width: 'clamp(2rem, 4vw, 3.5rem)', height: 'clamp(2rem, 4vw, 3.5rem)' }}
            />
            <span style={{ fontSize: 'clamp(0.75rem, 1.1vw, 0.9375rem)' }}>
              {status === 'loading'
                ? 'Reconstruindo modelo 3D…'
                : status === 'error'
                  ? 'Sem dados de camadas'
                  : 'Aguardando análise do gcode…'}
            </span>
          </div>
        </div>
      ) : null}

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

function normalizeHex(c: string | null | undefined): string {
  if (!c) return '#3b82f6';
  const m = c.match(/^#?([0-9a-fA-F]{6,8})$/);
  return m ? `#${m[1].slice(0, 6)}` : '#3b82f6';
}

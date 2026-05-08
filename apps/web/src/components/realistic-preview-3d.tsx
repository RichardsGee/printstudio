'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Box, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const LAN_HOST = process.env.NEXT_PUBLIC_LAN_DISCOVERY_HOST ?? 'localhost';
const LAN_PORT = process.env.NEXT_PUBLIC_LAN_DISCOVERY_PORT ?? '8080';

interface MeshPayload {
  fileName: string;
  vertices: number[];
  indices: number[];
  bounds: {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
  };
  vertexCount: number;
  triangleCount: number;
}

interface Props {
  printerId: string;
  currentLayer?: number | null;
  totalLayers?: number | null;
  filamentColor?: string | null;
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
  energyMesh: THREE.Mesh;
  energyTexture: THREE.CanvasTexture;
  belowPlane: THREE.Plane;
  abovePlane: THREE.Plane;
  meshHeight: number;
  meshRadius: number;
  rafId: number | null;
}

/** Cria uma textura vertical de listras pra ser animada subindo na
 *  parede do cilindro de "energia". 4×256px é suficiente. */
function createEnergyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.15, 'rgba(255,255,255,0.05)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.7)');
  grad.addColorStop(0.85, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  return tex;
}

/**
 * Render 3D realista do objeto sendo impresso, usando o `.3mf` que
 * o usuário subiu (não o da impressora — esse não tem mesh).
 *
 * Câmera frontal com auto-rotation suave, plano de corte horizontal
 * que sobe conforme as camadas avançam. Abaixo do corte: cor sólida
 * do filamento (impresso). Acima: ghost translúcido (a imprimir).
 * Anel brilhante no plano = "altura atual da impressão".
 */
export function RealisticPreview3D({
  printerId,
  currentLayer,
  totalLayers,
  filamentColor,
  className,
}: Props) {
  const [mesh, setMesh] = useState<MeshPayload | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error' | 'no-model'>('loading');
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneRefs | null>(null);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    setMesh(null);

    const url = `http://${LAN_HOST}:${LAN_PORT}/api/printers/${printerId}/uploaded-model.json`;
    fetch(url)
      .then(async (r) => {
        if (r.status === 404) throw new Error('no-model');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data: MeshPayload = await r.json();
        if (!alive) return;
        if (!data.vertices?.length || !data.indices?.length) {
          throw new Error('empty mesh');
        }
        setMesh(data);
        setStatus('ok');
      })
      .catch((err) => {
        if (!alive) return;
        setStatus(err.message === 'no-model' ? 'no-model' : 'error');
      });

    return () => {
      alive = false;
    };
  }, [printerId]);

  // Setup da cena (única por mesh).
  useEffect(() => {
    if (!mesh || !containerRef.current) return;
    const container = containerRef.current;
    let disposed = false;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setStatus('error');
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

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(2, 4, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
    fill.position.set(-3, 2, -2);
    scene.add(fill);

    // Z-up (Bambu) → Y-up (Three.js): swap Y<->Z, negate Y pra orientação.
    const verts = new Float32Array(mesh.vertices.length);
    for (let i = 0; i < mesh.vertices.length; i += 3) {
      const x = mesh.vertices[i];
      const y = mesh.vertices[i + 1];
      const z = mesh.vertices[i + 2];
      verts[i] = x;
      verts[i + 1] = z;
      verts[i + 2] = -y;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    const useUint32 = mesh.indices.some((v) => v > 0xffff);
    geometry.setIndex(
      new THREE.BufferAttribute(
        useUint32 ? new Uint32Array(mesh.indices) : new Uint16Array(mesh.indices),
        1,
      ),
    );
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox!;
    const cx = (bbox.max.x + bbox.min.x) / 2;
    const cz = (bbox.max.z + bbox.min.z) / 2;
    const offsetY = bbox.min.y;
    geometry.translate(-cx, -offsetY, -cz);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const meshHeight = bbox.max.y - bbox.min.y;
    const meshRadius = geometry.boundingSphere!.radius;
    const centerY = meshHeight / 2;

    // Zoom mais próximo (1.15 vs antes 1.6) — mostra o detalhe da
    // camada/clipping plane sem ficar com muita borda preta.
    const aspect = initialW / Math.max(1, initialH);
    const distH = meshRadius / Math.tan((35 * Math.PI) / 360);
    const distW = distH / aspect;
    const dist = Math.max(distH, distW) * 1.15;
    camera.position.set(0, centerY * 1.05, dist);
    camera.lookAt(0, centerY * 0.5, 0);

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
    group.add(new THREE.Mesh(geometry, printedMaterial));
    group.add(new THREE.Mesh(geometry, ghostMaterial));

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

    // Cilindro de "energia" subindo do chão — listras animadas que
    // sobem na parede, altura proporcional ao progresso da impressão.
    // Geometry com altura 1 e base em y=0 (translate up) — escalamos
    // o Y conforme as camadas sobem.
    const energyGeo = new THREE.CylinderGeometry(
      meshRadius * 1.05,
      meshRadius * 1.05,
      1,
      48,
      1,
      true, // open ends
    );
    energyGeo.translate(0, 0.5, 0);
    const energyTexture = createEnergyTexture();
    const energyMat = new THREE.MeshBasicMaterial({
      map: energyTexture,
      color: baseColor,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const energyMesh = new THREE.Mesh(energyGeo, energyMat);
    energyMesh.scale.y = 0.001;
    group.add(energyMesh);

    scene.add(group);

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
      renderer, scene, camera, group,
      printedMaterial, ghostMaterial, ringMesh,
      energyMesh, energyTexture,
      belowPlane, abovePlane, meshHeight, meshRadius, rafId: null,
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
      // Listras de energia sobem (texture offset vai pra baixo no UV
      // pra que visualmente as listras se movam pra cima na cilindro).
      energyTexture.offset.y -= dt * 0.6;
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
      energyMat.dispose();
      energyGeo.dispose();
      energyTexture.dispose();
      geometry.dispose();
      renderer.dispose();
      try { container.removeChild(renderer.domElement); } catch { /* */ }
    };
  }, [mesh, filamentColor]);

  // Update clipping plane sem recriar a cena.
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
    // Cilindro de energia sobe junto com a impressão.
    refs.energyMesh.scale.y = Math.max(clipY, 0.001);
    refs.energyMesh.visible = progress > 0 && progress < 1;
  }, [currentLayer, totalLayers]);

  return (
    <div
      className={cn(
        'relative w-full h-full overflow-hidden rounded-md border border-border/60 bg-gradient-to-b from-[#0a0f1c] to-[#020409]',
        className,
      )}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {status !== 'ok' ? (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground bg-gradient-to-b from-[#0a0f1c] to-[#020409]">
          <div className="flex flex-col items-center gap-2 text-center px-6">
            {status === 'loading' ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <Box className="h-8 w-8" strokeWidth={1.2} />
            )}
            <span className="text-xs">
              {status === 'loading'
                ? 'Carregando modelo 3D…'
                : status === 'no-model'
                  ? 'Vincule um .3mf no header pra ver o render realista'
                  : 'Erro carregando modelo'}
            </span>
          </div>
        </div>
      ) : null}

      {status === 'ok' && currentLayer != null && totalLayers != null && totalLayers > 0 ? (
        <div className="absolute bottom-2 right-2 rounded-md bg-background/80 backdrop-blur-sm border border-border/60 px-2 py-1 font-mono tabular-nums text-foreground pointer-events-none">
          <span className="text-xs">
            {currentLayer}<span className="text-muted-foreground"> / {totalLayers}</span>
          </span>
          <span className="ml-2 text-xs font-semibold text-primary">
            {Math.round((currentLayer / totalLayers) * 100)}%
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

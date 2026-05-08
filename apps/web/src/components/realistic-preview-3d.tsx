'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Box, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

import { getBridgeBase } from '@/lib/bridge-url';

type ViewAngle = 'front' | 'iso' | 'top';

const VIEW_LABELS: Record<ViewAngle, string> = {
  front: 'Frontal',
  iso: 'Isométrica',
  top: 'Topo',
};

const VIEW_ORDER: ViewAngle[] = ['front', 'iso', 'top'];

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
  /** Percentual 0-100 reportado pelo MQTT — usado como fallback
   *  quando currentLayer ainda é 0 (primeira camada em andamento). */
  progressPct?: number | null;
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
  dist: number;
  centerY: number;
  rafId: number | null;
}

/**
 * Posiciona a câmera + lookAt baseado no ângulo escolhido. Mantém a
 * distância calculada pelo bounding sphere — o que muda é só posição
 * relativa e ponto pra onde olha.
 */
function applyViewAngle(
  camera: THREE.PerspectiveCamera,
  angle: ViewAngle,
  dist: number,
  centerY: number,
): void {
  switch (angle) {
    case 'front':
      // Eye-level com leve elevação — visão padrão.
      camera.position.set(0, centerY * 1.1, dist);
      camera.lookAt(0, centerY * 0.6, 0);
      break;
    case 'iso':
      // Isométrica 3/4 — câmera elevada, ângulo de 45° no XZ.
      camera.position.set(dist * 0.65, dist * 0.7, dist * 0.65);
      camera.lookAt(0, centerY * 0.4, 0);
      break;
    case 'top':
      // Topo (bird's eye) — pra ver o footprint da peça.
      camera.position.set(0, dist * 1.3, 0.001);
      camera.lookAt(0, 0, 0);
      break;
  }
  camera.updateProjectionMatrix();
}

/** Cria uma textura vertical de UMA listra que nasce em baixo, sobe
 *  e some no topo. Ao repetir (RepeatWrapping), nasce outra embaixo
 *  quando a anterior some — efeito de "carga" cíclica.
 *
 *  Gradient: alpha=0 nas bordas, peak no meio. Quando a textura é
 *  rolada com `offset.y`, cada ciclo é uma listra completa nascendo
 *  → subindo → fadeout no topo. */
function createEnergyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, 'rgba(255,255,255,0.0)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.65, 'rgba(255,255,255,0.0)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // 1 ciclo visível = 1 listra subindo por vez.
  tex.repeat.set(1, 1);
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
  progressPct,
  filamentColor,
  className,
}: Props) {
  const [mesh, setMesh] = useState<MeshPayload | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error' | 'no-model'>('loading');
  const [viewAngle, setViewAngle] = useState<ViewAngle>(() => {
    if (typeof window === 'undefined') return 'front';
    const saved = window.localStorage.getItem('kiosk-view-angle');
    return saved && (VIEW_ORDER as string[]).includes(saved) ? (saved as ViewAngle) : 'front';
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneRefs | null>(null);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    setMesh(null);

    const url = `${getBridgeBase()}/api/printers/${printerId}/uploaded-model.json`;
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
    // Raio do footprint XZ (chão) — diferente do meshRadius que
    // inclui altura. Usado pro cilindro de energia ficar do tamanho
    // da BASE do objeto, não da bounding sphere (que pra objetos
    // altos é bem maior que a base).
    const fx = Math.max(Math.abs(bbox.min.x), Math.abs(bbox.max.x));
    const fz = Math.max(Math.abs(bbox.min.z), Math.abs(bbox.max.z));
    const footprintRadius = Math.sqrt(fx * fx + fz * fz);

    // Padroniza o enquadramento usando as bordas do CILINDRO DE ENERGIA
    // (frame externo) em vez do mesh do objeto. Resultado: todos os
    // prints aparecem com o mesmo "respiro" visual no card,
    // independente da forma/altura específica do objeto. O meshRadius
    // continua sendo usado pra definir o cilindro mas a câmera sai
    // posicionada com base no frame.
    const frameRadius = footprintRadius * 1.35;
    const frameHeight = Math.max(meshHeight, footprintRadius * 1.5);
    const frameRadiusFor3D = Math.sqrt(
      frameRadius * frameRadius + (frameHeight / 2) * (frameHeight / 2),
    );

    const aspect = initialW / Math.max(1, initialH);
    const distH = frameRadiusFor3D / Math.tan((35 * Math.PI) / 360);
    const distW = distH / aspect;
    const dist = Math.max(distH, distW) * 1.25;
    const frameCenterY = frameHeight / 2;
    applyViewAngle(camera, viewAngle, dist, frameCenterY);

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
    // sobem na parede. Raio = footprint do objeto (não bounding
    // sphere) pra não cortar topo de objetos altos.
    const energyGeo = new THREE.CylinderGeometry(
      footprintRadius * 1.1,
      footprintRadius * 1.1,
      1,
      48,
      1,
      true,
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
      belowPlane, abovePlane, meshHeight, meshRadius,
      dist, centerY: frameCenterY, rafId: null,
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
      energyTexture.offset.y -= dt * 0.4;

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

  // Update camera quando o ângulo muda — sem recriar a cena inteira.
  useEffect(() => {
    const refs = sceneRef.current;
    if (!refs) return;
    applyViewAngle(refs.camera, viewAngle, refs.dist, refs.centerY);
  }, [viewAngle, mesh]);

  // Update clipping plane sem recriar a cena.
  // Inclui `mesh` nas deps pra garantir que roda DEPOIS do scene
  // setup (que também depende de mesh) — sem isso, num refresh com
  // currentLayer já populado, a cena monta com clipY=0 e nunca
  // atualiza porque [currentLayer, totalLayers] já estão "estáveis".
  useEffect(() => {
    const refs = sceneRef.current;
    if (!refs) return;
    // Usa o MAIOR entre:
    //   - currentLayer / totalLayers (precisão por camada quando avança)
    //   - progressPct / 100 (cobertura inicial — a impressora reporta
    //     currentLayer=0 durante toda a primeira camada, mas progressPct
    //     já sai de 0 desde o início, então o cilindro nasce na hora).
    const layerProgress =
      currentLayer != null && totalLayers != null && totalLayers > 0
        ? currentLayer / totalLayers
        : 0;
    const pctProgress =
      progressPct != null ? Math.max(0, Math.min(100, progressPct)) / 100 : 0;
    const progress = Math.max(0, Math.min(1, Math.max(layerProgress, pctProgress)));
    const clipY = refs.meshHeight * progress;
    refs.belowPlane.constant = clipY;
    refs.abovePlane.constant = -clipY;
    refs.ringMesh.position.y = clipY;
    refs.ringMesh.visible = progress > 0 && progress < 1;
    refs.ghostMaterial.visible = progress < 1;
    refs.printedMaterial.clippingPlanes = progress < 1 ? [refs.belowPlane] : [];
    // Cilindro de energia tem altura mínima visível mesmo em prints
    // muito curtos / progresso baixo. Sem isso, num chaveiro de 5mm
    // a 5% de progresso, scale.y = 0.25mm (invisível). Mínimo:
    // o maior entre 15% da altura do mesh e 5mm absolutos.
    const minEnergyHeight = Math.max(refs.meshHeight * 0.15, 5);
    refs.energyMesh.scale.y = Math.max(clipY, minEnergyHeight);
    refs.energyMesh.visible = progress > 0 && progress < 1;
  }, [currentLayer, totalLayers, progressPct, mesh]);

  function cycleViewAngle(e: React.MouseEvent): void {
    // Defensivo: se algum dia o componente for envolvido em <Link>,
    // o stopPropagation evita navegar ao trocar ângulo.
    e.preventDefault();
    e.stopPropagation();
    const idx = VIEW_ORDER.indexOf(viewAngle);
    const next = VIEW_ORDER[(idx + 1) % VIEW_ORDER.length];
    setViewAngle(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('kiosk-view-angle', next);
    }
  }

  return (
    <div
      className={cn(
        'relative w-full h-full overflow-hidden rounded-md border border-border/60 bg-gradient-to-b from-[#0a0f1c] to-[#020409]',
        className,
      )}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {status === 'ok' ? (
        <button
          type="button"
          onClick={cycleViewAngle}
          className="absolute top-2 right-2 z-10 inline-flex items-center gap-1.5 rounded-md bg-background/80 backdrop-blur-sm border border-border/60 px-2 py-1 text-foreground hover:bg-background transition-colors"
          aria-label={`Ângulo: ${VIEW_LABELS[viewAngle]} (clica pra trocar)`}
          title={`Ângulo: ${VIEW_LABELS[viewAngle]}`}
        >
          <RotateCcw className="h-3 w-3" />
          <span className="font-mono uppercase tracking-wider" style={{ fontSize: 'clamp(0.5625rem, 0.85vw, 0.75rem)' }}>
            {VIEW_LABELS[viewAngle]}
          </span>
        </button>
      ) : null}

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

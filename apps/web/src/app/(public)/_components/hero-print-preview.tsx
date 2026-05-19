'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';

/**
 * Hero 3D real — Story 7.7 AC 29-33.
 *
 * Renderiza o Benchy real da Bambu (`.3mf` parseado client-side via
 * ThreeMFLoader) com o MESMO visual do kiosk de produção: metade
 * impressa (filamento) + metade ghost (cyan), plano de corte 50%,
 * energia subindo, ring, halo glow, drift auto-rotate.
 *
 * **Decisão (recomendação @po, Change Log 2026-05-18):** em vez de
 * refatorar `realistic-preview-3d.tsx` (componente de produção do
 * kiosk — risco de regressão em /kiosk e /printers/[id]) + geometria
 * procedural (AC 30 original), portamos o approach Benchy real já
 * provado no quick-win `apps/marketing`. `realistic-preview-3d.tsx`
 * fica INTOCADO → backwards-compat trivialmente preservada (AC 29).
 *
 * Three.js entra em chunk lazy separado: o hero.tsx importa este
 * componente via `next/dynamic({ ssr:false })` com o HUD como skeleton
 * (AC 31-32) — o bundle inicial da landing não carrega Three.js.
 */
const ACCENT = '#22d3ee';
const FILAMENT = '#f97316';
const PROGRESS_FIXED = 0.5;
const TOTAL_LAYERS = 240;
const BOAT_SCALE = 1.6;

interface MeshPayload {
  vertices: number[];
  indices: number[];
}

function createEnergyTexture(): THREE.CanvasTexture {
  const W = 32;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 32) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(0, y, W, 1);
  }
  const lanes = [
    { x: 5, w: 2, peakY: 80, intensity: 0.95 },
    { x: 14, w: 4, peakY: 240, intensity: 1.0 },
    { x: 24, w: 2, peakY: 400, intensity: 0.85 },
  ];
  for (const lane of lanes) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(Math.max(0, (lane.peakY - 80) / H), 'rgba(255,255,255,0.0)');
    grad.addColorStop(lane.peakY / H, `rgba(255,255,255,${lane.intensity})`);
    grad.addColorStop(Math.min(1, (lane.peakY + 80) / H), 'rgba(255,255,255,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(lane.x, 0, lane.w, H);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  return tex;
}

function createAlphaGradient(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0.0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.75, 'rgba(255,255,255,1)');
  grad.addColorStop(1.0, 'rgba(255,255,255,1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createPulseTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.42, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,1)');
  grad.addColorStop(0.58, 'rgba(255,255,255,0)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  return tex;
}

function combineMeshes(
  meshes: THREE.Mesh[],
): { vertices: number[]; indices: number[] } | null {
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

async function loadBenchyMesh(): Promise<MeshPayload> {
  const res = await fetch('/demo-benchy.3mf');
  if (!res.ok) throw new Error(`fetch .3mf falhou: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const loader = new ThreeMFLoader();
  const group = loader.parse(buffer);
  const meshes: THREE.Mesh[] = [];
  group.traverse((obj: THREE.Object3D) => {
    if (obj instanceof THREE.Mesh && obj.geometry?.getAttribute('position')) {
      meshes.push(obj);
    }
  });
  if (meshes.length === 0) throw new Error('mesh vazio no .3mf');
  const combined = combineMeshes(meshes);
  if (!combined) throw new Error('falha ao combinar meshes');
  return combined;
}

export function HeroPrintPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mesh, setMesh] = useState<MeshPayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    loadBenchyMesh()
      .then((m) => {
        if (alive) setMesh(m);
      })
      .catch((err) => {
        console.error('[hero-3d] falha carregando Benchy:', err);
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!mesh || !containerRef.current) return;
    const container = containerRef.current;
    let disposed = false;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.localClippingEnabled = true;

    const initialW = container.clientWidth || 400;
    const initialH = container.clientHeight || 400;
    renderer.setSize(initialW, initialH, false);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, initialW / initialH, 0.1, 8000);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(2, 4, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
    fill.position.set(-3, 2, -2);
    scene.add(fill);

    // Z-up (Bambu) → Y-up (Three): swap Y<->Z, negate Y pra orientação.
    const verts = new Float32Array(mesh.vertices.length);
    for (let i = 0; i < mesh.vertices.length; i += 3) {
      const x = mesh.vertices[i]!;
      const y = mesh.vertices[i + 1]!;
      const z = mesh.vertices[i + 2]!;
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
    const finalBox = geometry.boundingBox!;
    const meshHeight = finalBox.max.y - finalBox.min.y;
    const fx = Math.max(Math.abs(finalBox.min.x), Math.abs(finalBox.max.x));
    const fz = Math.max(Math.abs(finalBox.min.z), Math.abs(finalBox.max.z));
    const footprintRadius = Math.sqrt(fx * fx + fz * fz);

    // Frame baseado no mesh ESCALADO pelo BOAT_SCALE (footprint efetivo
    // em world coords após boatScaleGroup.scale).
    const scaledFootprint = footprintRadius * BOAT_SCALE;
    const scaledHeight = meshHeight * BOAT_SCALE;
    const frameRadius = scaledFootprint * 1.35;
    const frameHeight = Math.max(scaledHeight, scaledFootprint * 1.5);
    const frameRadiusFor3D = Math.sqrt(
      frameRadius * frameRadius + (frameHeight / 2) * (frameHeight / 2),
    );

    const aspect = initialW / Math.max(1, initialH);
    const distH = frameRadiusFor3D / Math.tan((35 * Math.PI) / 360);
    const distW = distH / aspect;
    const dist = Math.max(distH, distW) * 1.2;
    const frameCenterY = frameHeight / 2;
    camera.position.set(dist * 0.55, dist * 0.55, dist * 0.7);
    camera.lookAt(0, frameCenterY * 0.4, 0);

    const belowPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    const abovePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    const baseColor = new THREE.Color(FILAMENT);
    const themeColor = new THREE.Color(ACCENT);

    const printedMaterial = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.6,
      metalness: 0.05,
      side: THREE.DoubleSide,
      clippingPlanes: [belowPlane],
    });
    const ghostMaterial = new THREE.MeshStandardMaterial({
      color: themeColor,
      transparent: true,
      opacity: 0.18,
      roughness: 0.85,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      clippingPlanes: [abovePlane],
    });

    // Group raiz (drift sutil) > boatBobGroup > boatScaleGroup
    // (BOAT_SCALE + rotação 180° pra mostrar a proa do Benchy).
    // Energy/pulse/halo ficam no rootGroup (não escalam, não bobam).
    const rootGroup = new THREE.Group();
    const boatBobGroup = new THREE.Group();
    const boatScaleGroup = new THREE.Group();
    boatScaleGroup.scale.set(BOAT_SCALE, BOAT_SCALE, BOAT_SCALE);
    boatScaleGroup.rotation.y = Math.PI;

    const printedMesh = new THREE.Mesh(geometry, printedMaterial);
    const ghostMesh = new THREE.Mesh(geometry, ghostMaterial);
    boatScaleGroup.add(printedMesh);
    boatScaleGroup.add(ghostMesh);

    const ringGeo = new THREE.RingGeometry(
      footprintRadius * BOAT_SCALE * 0.9,
      footprintRadius * BOAT_SCALE * 1.02,
      64,
    );
    const ringMat = new THREE.MeshBasicMaterial({
      color: themeColor,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;

    boatBobGroup.add(boatScaleGroup);
    boatBobGroup.add(ringMesh);
    rootGroup.add(boatBobGroup);

    const effectsRadius = footprintRadius * BOAT_SCALE;
    const energyGeo = new THREE.CylinderGeometry(
      effectsRadius * 1.1,
      effectsRadius * 1.1,
      1,
      48,
      1,
      true,
    );
    energyGeo.translate(0, 0.5, 0);
    const alphaGradient = createAlphaGradient();
    const energyTexture = createEnergyTexture();
    const energyMat = new THREE.MeshBasicMaterial({
      map: energyTexture,
      alphaMap: alphaGradient,
      color: themeColor,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const energyMesh = new THREE.Mesh(energyGeo, energyMat);
    rootGroup.add(energyMesh);

    const pulseTexture = createPulseTexture();
    const pulseMat = new THREE.MeshBasicMaterial({
      map: pulseTexture,
      alphaMap: alphaGradient,
      color: themeColor,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const pulseMesh = new THREE.Mesh(energyGeo, pulseMat);
    rootGroup.add(pulseMesh);

    const haloGeo = new THREE.CylinderGeometry(
      effectsRadius * 1.35,
      effectsRadius * 1.35,
      1,
      48,
      1,
      true,
    );
    haloGeo.translate(0, 0.5, 0);
    const haloMat = new THREE.MeshBasicMaterial({
      alphaMap: alphaGradient,
      color: themeColor,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    rootGroup.add(haloMesh);

    scene.add(rootGroup);

    const floorGeo = new THREE.CircleGeometry(scaledFootprint * 2.5, 64);
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

    // Progress fixo em 50% — metade impressa, metade ghost. Clip planes
    // são world space, então clipY usa a altura JÁ escalada.
    const meshHeightWorld = meshHeight * BOAT_SCALE;
    const clipY = meshHeightWorld * PROGRESS_FIXED;
    belowPlane.constant = clipY;
    abovePlane.constant = -clipY;
    ringMesh.position.y = clipY;
    energyMesh.scale.y = clipY;
    pulseMesh.scale.y = clipY;
    haloMesh.scale.y = clipY;

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

    const startMs = performance.now();
    let lastFrame = startMs;
    let rafId = 0;
    const tick = (now: number): void => {
      if (disposed) return;
      const dt = (now - lastFrame) / 1000;
      const elapsed = (now - startMs) / 1000;
      lastFrame = now;

      rootGroup.rotation.y += dt * 0.04;
      energyTexture.offset.y -= dt * 0.4;
      pulseTexture.offset.y -= dt * 0.85;

      const pulse = (Math.sin(elapsed * ((Math.PI * 2) / 2.4)) + 1) / 2;
      energyMat.opacity = 0.42 + pulse * 0.18;
      pulseMat.opacity = 0.55 + pulse * 0.3;
      haloMat.opacity = 0.1 + pulse * 0.16;
      ringMat.opacity = 0.78 + pulse * 0.22;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      printedMaterial.dispose();
      ghostMaterial.dispose();
      ringMat.dispose();
      ringGeo.dispose();
      floorMat.dispose();
      floorGeo.dispose();
      energyMat.dispose();
      energyGeo.dispose();
      energyTexture.dispose();
      pulseMat.dispose();
      pulseTexture.dispose();
      alphaGradient.dispose();
      haloMat.dispose();
      haloGeo.dispose();
      geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [mesh]);

  const currentLayer = Math.round(PROGRESS_FIXED * TOTAL_LAYERS);
  const progressPct = Math.round(PROGRESS_FIXED * 100);

  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-[var(--mc-accent-soft)]/30 bg-gradient-to-b from-[#020409] via-[#050b16] to-[#020409] shadow-xl"
      data-mc-card
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--mc-accent-soft)_0%,_transparent_60%)] opacity-25" />

      <div className="relative flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p
            data-mc-id
            className="text-caption font-mono uppercase tracking-wider text-primary"
          >
            {'// LIVE · A1-01 · PRINTING'}
          </p>
          <span className="inline-flex size-2 animate-pulse rounded-full bg-primary" />
        </div>

        <div ref={containerRef} className="relative mt-3 flex-1" aria-hidden="true">
          {!mesh && !error && (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground">
              <span className="text-caption font-mono uppercase tracking-wider">
                {'// LOADING MESH…'}
              </span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground">
              <span className="text-caption font-mono uppercase tracking-wider">
                {'// MESH UNAVAILABLE'}
              </span>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-[var(--mc-accent-soft)]/20 pt-3">
          <span className="text-caption font-mono uppercase tracking-wider text-muted-foreground">
            LAYER {currentLayer}/{TOTAL_LAYERS}
          </span>
          <span className="text-caption font-mono uppercase tracking-wider text-primary">
            {progressPct}%
          </span>
        </div>
      </div>
    </div>
  );
}

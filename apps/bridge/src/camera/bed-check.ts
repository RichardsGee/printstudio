import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { CameraManager } from './manager.js';

export interface BedCheckResult {
  hasPlate: boolean;
  /** True se a mesa parece idêntica ao baseline "chapa limpa" — isto é,
   *  sem objetos/restos em cima. null quando não há baseline calibrado. */
  plateClean: boolean | null;
  confidence: 'high' | 'medium' | 'low';
  /** Similaridade média com baseline "com chapa" (0..1). Para distinguir chapa vs sem chapa. */
  similarityWithPlate: number | null;
  /** Similaridade média com baseline "sem chapa" (0..1). */
  similarityNoPlate: number | null;
  /** % de pixels que mudaram significativamente em relação ao baseline "com chapa" (0..1).
   *  Sensível a objetos localizados que a similaridade média não captura. */
  changeRatio: number | null;
  /** Edge density medido no ROI central (fallback e debug). */
  edgeDensity: number;
  threshold: number;
  mode: 'baseline' | 'heuristic';
  /** JPEG base64 (sem prefixo data:) pra UI exibir o que foi analisado. */
  previewBase64: string;
  capturedAt: number;
}

// Pixels com diferença de luma acima deste valor contam como "mudou".
// 25 em escala 0..255 corresponde a ~10% de diferença — filtra ruído de
// compressão JPEG e pequenas variações de iluminação, mas pega qualquer
// objeto sólido.
const PIXEL_CHANGE_THRESHOLD = 25;

// Se mais de 4% dos pixels do ROI mudaram em relação ao baseline de
// referência "mesa limpa", considera que algo está na mesa.
// Com resolução 160×aproximadamente-90 no ROI cropado = ~14400 pixels,
// 4% = 576 pixels alterados (área típica de um objeto pequeno).
const CHANGE_RATIO_THRESHOLD = 0.04;

// ROI da mesa na câmera da A1 — recorte em fração da largura × altura.
// A câmera fica em cima inclinada pra frente, então a mesa ocupa
// roughly 15..85 horizontal e 30..90 vertical do frame.
const ROI = { xMin: 0.15, xMax: 0.85, yMin: 0.30, yMax: 0.90 };

const EDGE_MAGNITUDE_THRESHOLD = 40;
// Limiar de edge density no ROI da mesa — a mesa sem chapa (heatbed liso)
// tem poucos edges; com chapa (PEI texturizado) tem ~10x mais.
const DENSITY_THRESHOLD = 0.04;

// Tamanho usado nas comparações de baseline (SSIM simplificado: diff
// absoluto médio entre grayscale).
const BASELINE_SIZE = 160;

async function cropAndGray(jpeg: Buffer, size: number): Promise<{ data: Buffer; w: number; h: number }> {
  const meta = await sharp(jpeg).metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  if (srcW === 0 || srcH === 0) throw new Error('invalid frame');
  const left = Math.round(srcW * ROI.xMin);
  const top = Math.round(srcH * ROI.yMin);
  const width = Math.round(srcW * (ROI.xMax - ROI.xMin));
  const height = Math.round(srcH * (ROI.yMax - ROI.yMin));
  const { data, info } = await sharp(jpeg)
    .extract({ left, top, width, height })
    .greyscale()
    .resize(size, null, { withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

function computeEdgeDensity(data: Buffer, w: number, h: number): number {
  let edge = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -data[i - w - 1] - 2 * data[i - 1] - data[i + w - 1] +
        data[i - w + 1] + 2 * data[i + 1] + data[i + w + 1];
      const gy =
        -data[i - w - 1] - 2 * data[i - w] - data[i - w + 1] +
        data[i + w - 1] + 2 * data[i + w] + data[i + w + 1];
      if (Math.abs(gx) + Math.abs(gy) > EDGE_MAGNITUDE_THRESHOLD) edge++;
    }
  }
  return edge / ((w - 2) * (h - 2));
}

function computeSimilarity(a: Buffer, b: Buffer): number {
  // 1 - (diff médio absoluto) / 255. Ótimo pra distinguir mudanças
  // globais (chapa vs sem chapa) — mas insensível a objetos pequenos
  // localizados (a média dilui).
  if (a.length !== b.length) return 0;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
  return 1 - diff / (a.length * 255);
}

function computeChangeRatio(a: Buffer, b: Buffer): number {
  // % de pixels que diferem por mais que PIXEL_CHANGE_THRESHOLD em luma.
  // Sensível a objetos localizados — um objeto que ocupa 5% do frame
  // gera changeRatio ~0.05 (vs ~0.02 de diff médio).
  if (a.length !== b.length) return 1;
  let changed = 0;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > PIXEL_CHANGE_THRESHOLD) changed++;
  }
  return changed / a.length;
}

export interface BedCheckBaselines {
  withPlate: Buffer | null;
  noPlate: Buffer | null;
}

export async function analyzeBedFrame(
  jpeg: Buffer,
  baselines: BedCheckBaselines = { withPlate: null, noPlate: null },
): Promise<BedCheckResult> {
  const { data, w, h } = await cropAndGray(jpeg, 320);
  const edgeDensity = computeEdgeDensity(data, w, h);

  let hasPlate = edgeDensity >= DENSITY_THRESHOLD;
  let plateClean: boolean | null = null;
  let mode: BedCheckResult['mode'] = 'heuristic';
  let simPlate: number | null = null;
  let simNo: number | null = null;
  let changeRatio: number | null = null;

  if (baselines.withPlate) {
    const base = await cropAndGray(jpeg, BASELINE_SIZE);
    simPlate = computeSimilarity(base.data, baselines.withPlate);
    changeRatio = computeChangeRatio(base.data, baselines.withPlate);

    if (baselines.noPlate) {
      simNo = computeSimilarity(base.data, baselines.noPlate);
      hasPlate = simPlate > simNo;
    } else {
      hasPlate = simPlate > 0.85;
    }
    // Mesa limpa = chapa presente E poucos pixels alterados vs baseline.
    // Usa changeRatio em vez da similaridade média porque objetos
    // pequenos/localizados só alteram uma fração dos pixels — a média
    // não os captura.
    plateClean = hasPlate && changeRatio < CHANGE_RATIO_THRESHOLD;
    mode = 'baseline';
  }

  // Confidence: em modo baseline, ancora no changeRatio (quão longe do limiar).
  let confidence: BedCheckResult['confidence'] = 'low';
  if (mode === 'baseline' && changeRatio !== null) {
    const delta = Math.abs(changeRatio - CHANGE_RATIO_THRESHOLD);
    confidence = delta > 0.05 ? 'high' : delta > 0.02 ? 'medium' : 'low';
  } else {
    const ratio = edgeDensity / DENSITY_THRESHOLD;
    confidence = ratio >= 2 || ratio <= 0.5 ? 'high' : ratio >= 1.3 || ratio <= 0.75 ? 'medium' : 'low';
  }

  const preview = await sharp(jpeg).resize(480).jpeg({ quality: 65 }).toBuffer();

  return {
    hasPlate,
    plateClean,
    confidence,
    similarityWithPlate: simPlate,
    similarityNoPlate: simNo,
    changeRatio,
    edgeDensity,
    threshold: DENSITY_THRESHOLD,
    mode,
    previewBase64: preview.toString('base64'),
    capturedAt: Date.now(),
  };
}

/**
 * Persiste/carrega baselines grayscale por printer + tipo.
 * Salvos como .raw (sem header) — apenas os bytes grayscale cropados.
 */
export class BedCheckStore {
  constructor(private readonly dir: string) {}

  private fileFor(printerId: string, type: 'with' | 'no'): string {
    return resolve(this.dir, `${printerId}.baseline-${type}.bin`);
  }

  async saveBaseline(printerId: string, type: 'with' | 'no', jpeg: Buffer): Promise<void> {
    const { data } = await cropAndGray(jpeg, BASELINE_SIZE);
    const file = this.fileFor(printerId, type);
    await fs.mkdir(dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  }

  async loadBaselines(printerId: string): Promise<BedCheckBaselines> {
    const withPlate = await fs.readFile(this.fileFor(printerId, 'with')).catch(() => null);
    const noPlate = await fs.readFile(this.fileFor(printerId, 'no')).catch(() => null);
    return { withPlate, noPlate };
  }
}

/**
 * Captura um frame "fresco" da câmera — reusa o último frame se tiver
 * <5s, senão abre a stream brevemente pra pegar um novo e fecha. Assim
 * o bed-check não mantém a câmera ligada depois do uso.
 */
export async function captureFreshFrame(
  cameras: CameraManager,
  printerId: string,
  timeoutMs = 6000,
): Promise<Buffer | null> {
  const cached = cameras.getLatestFrame(printerId);
  if (cached) return cached; // se tem stream aberta, usa o último frame

  return new Promise<Buffer | null>((resolve) => {
    const release = cameras.acquire(printerId);
    let done = false;

    const finish = (frame: Buffer | null): void => {
      if (done) return;
      done = true;
      off();
      clearTimeout(timer);
      release();
      resolve(frame);
    };

    const off = cameras.onFrame(printerId, (jpeg) => finish(jpeg));
    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}

import sharp from 'sharp';
import type { CameraManager } from './manager.js';

export interface BedCheckResult {
  hasPlate: boolean;
  confidence: 'high' | 'medium' | 'low';
  edgeDensity: number;
  threshold: number;
  frameWidth: number;
  frameHeight: number;
  /** JPEG base64 (sem prefixo data:) pra UI exibir o que foi analisado. */
  previewBase64: string;
  capturedAt: number;
}

// Heurística: mesa vazia (sem chapa magnética) expõe o heatbed preto liso
// — pouquíssimos edges. Chapa com textura PEI ou os padrões impressos
// gera edge density uma ordem de grandeza maior. Limiar calibrado empírico
// — ajustável conforme testes do usuário.
const EDGE_MAGNITUDE_THRESHOLD = 40; // escala 0..360 pra Sobel 3x3
const DENSITY_THRESHOLD = 0.025;     // 2.5% dos pixels com edge forte

/**
 * Analisa um frame JPEG da câmera e retorna um veredito sobre a presença
 * da chapa de impressão. Algoritmo: converte pra grayscale, reduz pra
 * 320px, aplica Sobel 3x3 e conta pixels com magnitude acima do limiar.
 *
 * Peças impressas, restos, poeira e texturas do PEI contribuem pro
 * contagem — por isso o mesmo detector também funciona como "mesa limpa?"
 * no futuro, se calibrarmos um limiar superior (mesa vazia com chapa).
 */
export async function analyzeBedFrame(jpeg: Buffer): Promise<BedCheckResult> {
  const { data, info } = await sharp(jpeg)
    .greyscale()
    .resize(320, null, { withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  let edgePixels = 0;
  const w = width;
  const h = height;

  // Sobel 3x3 inline — evita dependência extra.
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i00 = (y - 1) * w + (x - 1);
      const i01 = (y - 1) * w + x;
      const i02 = (y - 1) * w + (x + 1);
      const i10 = y * w + (x - 1);
      const i12 = y * w + (x + 1);
      const i20 = (y + 1) * w + (x - 1);
      const i21 = (y + 1) * w + x;
      const i22 = (y + 1) * w + (x + 1);

      const gx = -data[i00] - 2 * data[i10] - data[i20] + data[i02] + 2 * data[i12] + data[i22];
      const gy = -data[i00] - 2 * data[i01] - data[i02] + data[i20] + 2 * data[i21] + data[i22];
      const mag = Math.abs(gx) + Math.abs(gy); // L1 — mais rápido que sqrt
      if (mag > EDGE_MAGNITUDE_THRESHOLD) edgePixels++;
    }
  }

  const total = (w - 2) * (h - 2);
  const edgeDensity = edgePixels / total;
  const hasPlate = edgeDensity >= DENSITY_THRESHOLD;

  // Confidence baseada em quão longe do limiar está
  const ratio = edgeDensity / DENSITY_THRESHOLD;
  const confidence: BedCheckResult['confidence'] =
    ratio >= 2 || ratio <= 0.5 ? 'high' : ratio >= 1.3 || ratio <= 0.75 ? 'medium' : 'low';

  const preview = await sharp(jpeg).resize(480).jpeg({ quality: 65 }).toBuffer();

  return {
    hasPlate,
    confidence,
    edgeDensity,
    threshold: DENSITY_THRESHOLD,
    frameWidth: w,
    frameHeight: h,
    previewBase64: preview.toString('base64'),
    capturedAt: Date.now(),
  };
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

import { mkdir, readFile, writeFile, stat, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface ModelMeta {
  originalName: string;
  uploadedAt: number;
  size: number;
}

/**
 * Storage local pra arquivos `.3mf` que o usuário sobe pro bridge,
 * pra ser usado como fonte do mesh real (já que o `.3mf` que fica
 * na FTP da impressora não tem geometria — o Bambu Studio strip ela
 * antes de enviar pra impressão).
 *
 * Cada impressora pode ter um modelo associado por vez. Substituir
 * é só fazer upload novo. Cada arquivo é guardado junto com um
 * `.meta.json` contendo nome original + timestamp + tamanho.
 */
export class ModelStore {
  constructor(private readonly baseDir: string) {}

  async ensureDir(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
  }

  private pathFor(printerId: string): string {
    return resolve(this.baseDir, `${printerId}.3mf`);
  }

  private metaPathFor(printerId: string): string {
    return resolve(this.baseDir, `${printerId}.meta.json`);
  }

  async save(printerId: string, data: Buffer, originalName: string): Promise<ModelMeta> {
    await this.ensureDir();
    const meta: ModelMeta = {
      originalName,
      uploadedAt: Date.now(),
      size: data.length,
    };
    await writeFile(this.pathFor(printerId), data);
    await writeFile(this.metaPathFor(printerId), JSON.stringify(meta, null, 2));
    return meta;
  }

  async info(printerId: string): Promise<ModelMeta | null> {
    try {
      const raw = await readFile(this.metaPathFor(printerId), 'utf8');
      return JSON.parse(raw) as ModelMeta;
    } catch {
      return null;
    }
  }

  async load(printerId: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathFor(printerId));
    } catch {
      return null;
    }
  }

  async exists(printerId: string): Promise<boolean> {
    try {
      await stat(this.pathFor(printerId));
      return true;
    } catch {
      return false;
    }
  }

  async remove(printerId: string): Promise<void> {
    try {
      await unlink(this.pathFor(printerId));
    } catch {
      /* não existe */
    }
    try {
      await unlink(this.metaPathFor(printerId));
    } catch {
      /* não existe */
    }
  }
}

import { Client as FtpClient } from 'basic-ftp';
import AdmZip from 'adm-zip';
import { Writable } from 'node:stream';
import type { Logger } from '../logger.js';

/**
 * Fetches print thumbnail from a Bambu A1 via FTPS.
 *
 * Reference: https://github.com/Doridian/OpenBambuAPI/blob/main/ftp.md
 *
 * - FTPS on port 990 (implicit TLS) with user `bblp` + access_code
 * - During a print, the gcode/.3mf is at `/cache/<name>.3mf` (or `.gcode.3mf`)
 * - `.3mf` is a ZIP containing `Metadata/plate_1.png` (the plate thumbnail)
 * - Self-signed cert on the printer TLS
 */
export class ThumbnailFetcher {
  constructor(
    private readonly ip: string,
    private readonly accessCode: string,
    private readonly logger: Logger,
  ) {}

  async fetchLatestThumbnail(fileNameHint?: string | null): Promise<Buffer | null> {
    const client = await this.connect();
    if (!client) return null;

    try {
      const candidates = await this.findCandidatePaths(client, fileNameHint);
      for (const path of candidates) {
        const buf = await this.downloadFile(client, path);
        if (!buf) continue;
        const thumb = extractPlateThumbnail(buf);
        if (thumb) {
          this.logger.info({ path, size: thumb.length }, 'thumbnail extracted');
          return thumb;
        }
      }
      this.logger.debug({ candidates }, 'no thumbnail found in any candidate');
      return null;
    } finally {
      client.close();
    }
  }

  private async connect(): Promise<FtpClient | null> {
    const client = new FtpClient(15_000);
    client.ftp.verbose = false;
    try {
      await client.access({
        host: this.ip,
        port: 990,
        user: 'bblp',
        password: this.accessCode,
        secure: 'implicit',
        secureOptions: { rejectUnauthorized: false },
      });
      return client;
    } catch (err) {
      this.logger.warn(
        { ip: this.ip, err: err instanceof Error ? err.message : String(err) },
        'ftps connect failed',
      );
      client.close();
      return null;
    }
  }

  private async findCandidatePaths(
    client: FtpClient,
    fileNameHint: string | null | undefined,
  ): Promise<string[]> {
    const bases = ['/cache', '/'];
    const paths: string[] = [];

    // 1) If we have a file hint, try direct paths first.
    if (fileNameHint) {
      const clean = fileNameHint.replace(/^\//, '');
      const withoutExt = clean.replace(/\.(gcode|gcode\.3mf|3mf)$/i, '');
      paths.push(`/cache/${clean}`);
      if (!clean.endsWith('.3mf')) paths.push(`/cache/${withoutExt}.3mf`);
      if (!clean.endsWith('.gcode.3mf')) paths.push(`/cache/${withoutExt}.gcode.3mf`);
    }

    // 2) Fall back to listing known dirs and picking the newest .3mf.
    for (const base of bases) {
      try {
        const list = await client.list(base);
        const threeMf = list
          .filter((f) => f.isFile && /\.3mf$/i.test(f.name))
          .sort((a, b) => {
            const at = a.modifiedAt?.getTime() ?? 0;
            const bt = b.modifiedAt?.getTime() ?? 0;
            return bt - at;
          });
        for (const f of threeMf.slice(0, 3)) paths.push(`${base}/${f.name}`.replace(/\/+/g, '/'));
      } catch {
        /* dir may not exist — ignore */
      }
    }

    // Dedup preserving order.
    return Array.from(new Set(paths));
  }

  private async downloadFile(client: FtpClient, path: string): Promise<Buffer | null> {
    const chunks: Buffer[] = [];
    const writable = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        cb();
      },
    });
    try {
      await client.downloadTo(writable, path);
      return Buffer.concat(chunks);
    } catch (err) {
      this.logger.debug(
        { path, err: err instanceof Error ? err.message : String(err) },
        'ftp download failed',
      );
      return null;
    }
  }
}

/** Pull `Metadata/plate_1.png` (or first plate png) out of a .3mf zip buffer. */
export function extractPlateThumbnail(threeMfBuf: Buffer): Buffer | null {
  try {
    const zip = new AdmZip(threeMfBuf);
    const entries = zip.getEntries();
    // Prefer plate_1.png (the full-size composition thumbnail) over small variants.
    const prefer = entries.find(
      (e) => /^Metadata\/plate_1\.png$/i.test(e.entryName) || /^Metadata\/plate_1_bigger\.png$/i.test(e.entryName),
    );
    const fallback =
      prefer ??
      entries.find((e) => /^Metadata\/plate_\d+\.png$/i.test(e.entryName)) ??
      entries.find((e) => /^Metadata\/.*\.png$/i.test(e.entryName));
    if (!fallback) return null;
    return fallback.getData();
  } catch {
    return null;
  }
}

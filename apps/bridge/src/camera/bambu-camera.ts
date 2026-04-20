import { connect as tlsConnect, type TLSSocket } from 'node:tls';
import { EventEmitter } from 'node:events';
import type { Logger } from '../logger.js';

/**
 * Bambu A1 / A1 mini camera client.
 *
 * Protocol reference: https://github.com/Doridian/OpenBambuAPI/blob/main/video.md
 *
 * Flow:
 *   1. Open TLS socket to printer:6000 (self-signed cert → rejectUnauthorized: false)
 *   2. Send 80-byte auth packet:
 *        bytes  0- 3 : 0x00000040  (payload size = 64, little-endian)
 *        bytes  4- 7 : 0x00003000  (type, little-endian)
 *        bytes  8-11 : 0x00000000  (reserved)
 *        bytes 12-15 : 0x00000000  (reserved)
 *        bytes 16-47 : "bblp" right-padded with NULs (32 bytes)
 *        bytes 48-79 : access code right-padded with NULs (32 bytes)
 *   3. Printer streams JPEG frames:
 *        16-byte header:
 *          bytes  0- 3 : payload size (little-endian)
 *          bytes  4- 7 : itrack (ignore)
 *          bytes  8-11 : flags
 *          bytes 12-15 : reserved
 *        followed by `payload size` bytes of JPEG (starts with FFD8, ends with FFD9).
 */
export class BambuCameraClient extends EventEmitter {
  private socket: TLSSocket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private expectedSize: number | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private backoffMs = 1000;

  constructor(
    private readonly ip: string,
    private readonly accessCode: string,
    private readonly logger: Logger,
  ) {
    super();
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    this.buffer = Buffer.alloc(0);
    this.expectedSize = null;
  }

  private connect(): void {
    this.logger.info({ ip: this.ip, port: 6000 }, 'bambu camera connecting');
    const socket = tlsConnect({
      host: this.ip,
      port: 6000,
      rejectUnauthorized: false,
    });
    this.socket = socket;

    socket.once('secureConnect', () => {
      this.logger.info({ ip: this.ip }, 'bambu camera connected, sending auth');
      socket.write(this.buildAuthPacket());
      this.emit('open');
    });

    socket.on('data', (chunk: Buffer) => this.onData(chunk));

    socket.on('error', (err) => {
      this.logger.warn({ ip: this.ip, err: err.message }, 'bambu camera socket error');
    });

    socket.on('close', () => {
      this.logger.warn({ ip: this.ip }, 'bambu camera socket closed');
      this.emit('close');
      this.socket = null;
      this.buffer = Buffer.alloc(0);
      this.expectedSize = null;
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, 30_000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private buildAuthPacket(): Buffer {
    const pkt = Buffer.alloc(80);
    pkt.writeUInt32LE(0x40, 0); // payload size
    pkt.writeUInt32LE(0x3000, 4); // type
    // bytes 8-15 already zeroed
    Buffer.from('bblp', 'ascii').copy(pkt, 16); // username (null-padded)
    Buffer.from(this.accessCode, 'ascii').copy(pkt, 48); // password (null-padded)
    return pkt;
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.backoffMs = 1000; // reset backoff on successful data

    while (true) {
      if (this.expectedSize === null) {
        if (this.buffer.length < 16) return;
        this.expectedSize = this.buffer.readUInt32LE(0);
        this.buffer = Buffer.from(this.buffer.subarray(16));
      }
      if (this.buffer.length < this.expectedSize) return;
      const jpeg = Buffer.from(this.buffer.subarray(0, this.expectedSize));
      this.buffer = Buffer.from(this.buffer.subarray(this.expectedSize));
      this.expectedSize = null;
      if (jpeg.length >= 2 && jpeg[0] === 0xff && jpeg[1] === 0xd8) {
        this.emit('frame', jpeg);
      } else {
        this.logger.debug({ len: jpeg.length }, 'dropped non-JPEG payload');
      }
    }
  }
}

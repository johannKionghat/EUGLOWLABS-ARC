import { NodeSSH } from "node-ssh";

import type { ExecChunk, ExecOpts, ExecResult, ExecutionAdapter } from "./types.js";

export interface VpsAdapterOptions {
  host: string;
  username: string;
  /** Path to a private key file (PEM). Either this or `privateKey` must be set. */
  privateKeyPath?: string;
  /** Inline private key (PEM). */
  privateKey?: string;
  port?: number;
}

/**
 * `ExecutionAdapter` that runs commands and uploads files on a remote
 * VPS via SSH (`node-ssh`).
 *
 * Selected when `target: vps` in `arc.config.yml` (see ADR-0009).
 *
 * The SSH connection is opened lazily on the first call and reused
 * for the lifetime of the adapter. Call {@link disconnect} when done.
 *
 * Provisioning (creating the VPS via the Hetzner API) is intentionally
 * NOT a method of this class — see {@link provisionHetzner} for the
 * orthogonal concern.
 */
export class VPSAdapter implements ExecutionAdapter {
  private readonly client = new NodeSSH();
  private connected = false;

  constructor(private readonly options: VpsAdapterOptions) {}

  private async ensureConnected(): Promise<void> {
    if (this.connected) return;
    await this.client.connect({
      host: this.options.host,
      username: this.options.username,
      port: this.options.port ?? 22,
      privateKeyPath: this.options.privateKeyPath,
      privateKey: this.options.privateKey,
    });
    this.connected = true;
  }

  async exec(cmd: string, opts: ExecOpts = {}): Promise<ExecResult> {
    await this.ensureConnected();
    const start = Date.now();
    const result = await this.client.execCommand(cmd, {
      cwd: opts.cwd,
      execOptions: opts.env ? { env: opts.env } : undefined,
      onStdout: opts.onChunk
        ? (data: Buffer) => {
            const chunk: ExecChunk = { stream: "stdout", data: data.toString() };
            opts.onChunk?.(chunk);
          }
        : undefined,
      onStderr: opts.onChunk
        ? (data: Buffer) => {
            const chunk: ExecChunk = { stream: "stderr", data: data.toString() };
            opts.onChunk?.(chunk);
          }
        : undefined,
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.code ?? 0,
      durationMs: Date.now() - start,
    };
  }

  async copyFile(srcLocalPath: string, destPath: string): Promise<void> {
    await this.ensureConnected();
    await this.client.putFile(srcLocalPath, destPath);
  }

  async readFile(path: string): Promise<string> {
    await this.ensureConnected();
    const result = await this.client.execCommand(`cat ${shellEscape(path)}`);
    if (result.code !== 0) {
      throw new Error(`Failed to read ${path}: ${result.stderr}`);
    }
    return result.stdout;
  }

  async fileExists(path: string): Promise<boolean> {
    await this.ensureConnected();
    const result = await this.client.execCommand(
      `test -e ${shellEscape(path)} && echo yes || echo no`,
    );
    return result.stdout.trim() === "yes";
  }

  describe(): string {
    return `vps:${this.options.host}`;
  }

  /** Close the underlying SSH connection. Idempotent. */
  async disconnect(): Promise<void> {
    if (!this.connected) return;
    this.client.dispose();
    this.connected = false;
  }
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

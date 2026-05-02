import type { ExecutionAdapter } from "../exec/index.js";

export interface TunnelConfig {
  /** Tunnel name (also used as the local config token reference). */
  name: string;
  /** Domain whose `*.<domain>` is routed to localhost. */
  domain: string;
  /** Local Traefik port (typically 80 or 8080). Default 80. */
  localPort?: number;
  /** Path of the cloudflared YAML config to write. */
  configPath?: string;
}

/**
 * Render the YAML body of a Cloudflared tunnel config that maps every
 * `*.<domain>` request to a local Traefik port.
 *
 * The tunnel itself must be created beforehand with `cloudflared tunnel
 * create <name>` so the credentials JSON is in `~/.cloudflared/`.
 */
export function renderCloudflaredConfig(opts: TunnelConfig): string {
  const port = opts.localPort ?? 80;
  return `tunnel: ${opts.name}
credentials-file: ~/.cloudflared/${opts.name}.json

ingress:
  - hostname: "*.${opts.domain}"
    service: http://localhost:${port}
  - service: http_status:404
`;
}

export interface SetupTunnelOptions extends TunnelConfig {
  /** Adapter the tunnel runs on (typically LocalAdapter). */
  adapter: ExecutionAdapter;
}

/**
 * One-shot setup helper: ensures the tunnel exists in Cloudflare,
 * writes the local config, and starts `cloudflared tunnel run`.
 *
 * Each step is its own adapter call so the caller can re-run the
 * helper idempotently — Cloudflare returns "already exists" rather
 * than failing.
 */
export async function setupTunnel(opts: SetupTunnelOptions): Promise<{ exitCode: number }> {
  const configPath = opts.configPath ?? `~/.cloudflared/${opts.name}.yml`;
  const adapter = opts.adapter;
  await adapter.exec(`cloudflared tunnel create ${opts.name} || true`);
  await adapter.exec(`cloudflared tunnel route dns ${opts.name} *.${opts.domain} || true`);
  const yaml = renderCloudflaredConfig(opts);
  // The config is short, write it via shell heredoc rather than a tmp file.
  const escaped = yaml.replace(/'/g, "'\\''");
  await adapter.exec(`mkdir -p $(dirname ${configPath})`);
  await adapter.exec(`printf '%s' '${escaped}' > ${configPath}`);
  const result = await adapter.exec(`cloudflared tunnel --config ${configPath} run ${opts.name}`, {
    onChunk: undefined,
  });
  return { exitCode: result.exitCode };
}

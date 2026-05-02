import type { Provider } from "@euglowlabs/arc-shared";

const HETZNER_API = "https://api.hetzner.cloud/v1";

export interface ProvisionedVps {
  id: number;
  ipv4: string;
  ipv6: string | null;
  status: string;
}

export interface ProvisionHetznerOptions {
  /** Cloud API token, scoped to a project. Read from env or arc.config.yml. */
  apiToken: string;
  /** Server name (also DNS-friendly). */
  name: string;
  /** Hetzner image (e.g. `ubuntu-24.04`). */
  image?: string;
  /** Public SSH key fingerprint(s) registered in the Hetzner project. */
  sshKeyIds?: number[];
}

interface HetznerCreateServerResponse {
  server: {
    id: number;
    status: string;
    public_net: {
      ipv4: { ip: string };
      ipv6: { ip: string | null };
    };
  };
}

/**
 * Provision a VPS on Hetzner from an `ArcConfig.provider` block.
 *
 * Skeleton implementation — calls the Hetzner Cloud API directly via
 * `fetch` so we stay SDK-agnostic. End-to-end orchestration (hardening,
 * Docker install, ARC Agent install) is not part of this function;
 * `arc deploy` (CLI-012) drives the full sequence.
 *
 * See spec-infra §13 (migration locale → VPS).
 */
export async function provisionHetzner(
  provider: Provider,
  options: ProvisionHetznerOptions,
): Promise<ProvisionedVps> {
  const response = await fetch(`${HETZNER_API}/servers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: options.name,
      server_type: provider.plan,
      location: provider.location,
      image: options.image ?? "ubuntu-24.04",
      ssh_keys: options.sshKeyIds ?? [],
      start_after_create: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Hetzner provision failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as HetznerCreateServerResponse;
  return {
    id: data.server.id,
    ipv4: data.server.public_net.ipv4.ip,
    ipv6: data.server.public_net.ipv6.ip,
    status: data.server.status,
  };
}

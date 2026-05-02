import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";

import type { ArcConfig } from "@euglowlabs/arc-shared";

import type { ExecutionAdapter } from "../exec/index.js";
import {
  generateAgentsCompose,
  generateEnvFile,
  generateProdCompose,
  generateSandboxCompose,
} from "../templates/index.js";

const FILES = [
  { name: "docker-compose.prod.yml", render: generateProdCompose },
  { name: "docker-compose.sandbox.yml", render: generateSandboxCompose },
  { name: "docker-compose.agents.yml", render: generateAgentsCompose },
];

export interface DeployOptions {
  /** Where to drop the generated files on the adapter's filesystem. */
  outDir: string;
  /** Skip the `docker compose up` step (useful for tests / dry-runs). */
  skipCompose?: boolean;
  /** Optional logger for progress lines. */
  log?: (line: string) => void;
}

export interface DeployResult {
  writtenPaths: string[];
  composeRan: boolean;
  composeExitCode: number | null;
}

/**
 * Render every project artifact and apply it through the adapter.
 *
 * Pure orchestration — the rendering is done locally (always),
 * then files are pushed onto the adapter's filesystem via
 * `copyFile`. Finally `docker compose up -d` is invoked through
 * `exec`, which the LocalAdapter runs on the host and the
 * VPSAdapter runs over SSH.
 */
export async function deploy(
  cfg: ArcConfig,
  adapter: ExecutionAdapter,
  opts: DeployOptions,
): Promise<DeployResult> {
  const log = opts.log ?? (() => {});
  log(`Deploying project "${cfg.project}" via adapter ${adapter.describe()}`);

  const stagingDir = await mkdtemp(join(tmpdir(), "arc-deploy-"));
  const writtenPaths: string[] = [];

  try {
    const envContent = generateEnvFile(cfg);
    const envSrc = join(stagingDir, ".env");
    await writeFile(envSrc, envContent, "utf8");
    const envDest = posix.join(opts.outDir, ".env");
    await adapter.copyFile(envSrc, envDest);
    writtenPaths.push(envDest);

    for (const file of FILES) {
      const content = file.render(cfg);
      const src = join(stagingDir, file.name);
      await writeFile(src, content, "utf8");
      const dest = posix.join(opts.outDir, file.name);
      await adapter.copyFile(src, dest);
      writtenPaths.push(dest);
      log(`Wrote ${dest}`);
    }
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }

  if (opts.skipCompose === true) {
    return { writtenPaths, composeRan: false, composeExitCode: null };
  }

  const composeArgs = FILES.map((f) => `-f ${posix.join(opts.outDir, f.name)}`).join(" ");
  const cmd = `docker compose ${composeArgs} --env-file ${posix.join(opts.outDir, ".env")} up -d`;
  log(`Running: ${cmd}`);
  const result = await adapter.exec(cmd, {
    onChunk: (chunk) => log(chunk.data.replace(/\n$/, "")),
  });

  return {
    writtenPaths,
    composeRan: true,
    composeExitCode: result.exitCode,
  };
}

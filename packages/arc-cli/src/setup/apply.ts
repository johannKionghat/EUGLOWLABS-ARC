import { randomUUID } from "node:crypto";
import { chmod, mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { cancel, note, select } from "@clack/prompts";
import type { ArcConfig } from "@euglowlabs/arc-shared";

import { runAnsiblePlaybook } from "../ansible/run.js";
import type { ExecutionAdapter } from "../exec/index.js";
import { arcComposeDir, arcPlaybookEntry, arcPlaybooksDir } from "../paths.js";
import { EmbeddedPlaybooksLoader, type PlaybooksLoader } from "../playbooks-loader.js";
import { PLAYBOOKS_MANIFEST } from "../playbooks-manifest.js";
import {
  generateAgentsCompose,
  generateProdCompose,
  generateSandboxCompose,
} from "../templates/index.js";
import { VERSION } from "../version.js";
import { EXIT_CANCELLED, EXIT_ENV_ERROR, EXIT_OK } from "./exit-codes.js";
import {
  type ArcState,
  type LoadStateResult,
  STATE_SCHEMA_VERSION,
  loadStateFile,
  writeStateFile,
} from "./state.js";

/**
 * Minimum `ansible-playbook` version we recommend (informative only).
 *
 * Below this we surface a warning but still proceed — `arc setup --apply`
 * is not blocked. Choice is arbitrary for the MVP and should be revisited
 * during E2E-001 once we know which distros ship with which versions.
 */
export const ANSIBLE_RECOMMENDED_MIN = { major: 2, minor: 14 } as const;

/**
 * Literal user-facing message displayed when `ansible-playbook` is not
 * installed on the host. Stored as a constant so E2E tests assert on
 * the exact string.
 */
export const ANSIBLE_NOT_INSTALLED_MESSAGE = `✗ Ansible n'est pas installé sur cette machine.

arc setup --apply nécessite Ansible pour orchestrer l'installation
de la stack. Installez-le selon votre OS :
  - Ubuntu/Debian : sudo apt install ansible
  - macOS : brew install ansible
  - Autre : https://docs.ansible.com/ansible/latest/installation_guide/

Puis relancez arc setup --apply.`;

/**
 * Thrown by {@link assertAnsibleInstalled} when `ansible-playbook` is
 * absent from the host (binary missing, ENOENT, shell exit 127).
 *
 * The orchestrate layer catches this and prints
 * {@link ANSIBLE_NOT_INSTALLED_MESSAGE} verbatim.
 */
export class AnsibleNotInstalledError extends Error {
  constructor() {
    super(ANSIBLE_NOT_INSTALLED_MESSAGE);
    this.name = "AnsibleNotInstalledError";
  }
}

/**
 * Thrown by {@link assertAnsibleInstalled} when `ansible-playbook` is
 * present but the `--version` invocation fails for any other reason
 * (non-zero exit, empty stdout, unparseable output).
 */
export class AnsibleExecutionError extends Error {
  readonly exitCode: number;
  readonly stderr: string;
  constructor(message: string, exitCode: number, stderr: string) {
    super(message);
    this.name = "AnsibleExecutionError";
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

/**
 * Thrown by {@link listExistingComposes} when the compose directory
 * exists but cannot be read (typically EACCES because the parent
 * directory has restrictive permissions). The orchestrate layer
 * surfaces the path verbatim and exits with EXIT_ENV_ERROR.
 */
export class ComposeDirAccessError extends Error {
  readonly path: string;
  override readonly cause: NodeJS.ErrnoException;
  constructor(path: string, cause: NodeJS.ErrnoException) {
    super(`Cannot read ${path}: ${cause.message}`);
    this.name = "ComposeDirAccessError";
    this.path = path;
    this.cause = cause;
  }
}

export interface AnsibleVersion {
  /** Detected version string, e.g. "2.16.3" or "2.10.0". */
  version: string;
  /** Set when the detected version is below {@link ANSIBLE_RECOMMENDED_MIN}. */
  warning?: string;
}

/**
 * Verify that `ansible-playbook` is callable on the host and capture
 * its version.
 *
 * Three outcomes :
 * - Binary absent (thrown error caught here, or shell exit 127) →
 *   throws {@link AnsibleNotInstalledError}.
 * - Binary present but `--version` failed (other non-zero exit, or
 *   empty/unparseable stdout) → throws {@link AnsibleExecutionError}.
 * - Success → returns the parsed version, optionally with a warning if
 *   it is below {@link ANSIBLE_RECOMMENDED_MIN}.
 */
export async function assertAnsibleInstalled(adapter: ExecutionAdapter): Promise<AnsibleVersion> {
  const cmd = "ansible-playbook --version";
  let result: Awaited<ReturnType<ExecutionAdapter["exec"]>>;
  try {
    result = await adapter.exec(cmd);
  } catch (cause) {
    // Thrown by HostAdapter only when execa itself fails to spawn the
    // shell (rare). Most "binary not found" cases land in exit 127
    // below because we run through `shell: true`.
    if (isEnoent(cause)) {
      throw new AnsibleNotInstalledError();
    }
    throw new AnsibleExecutionError(
      `ansible-playbook --version failed to spawn: ${(cause as Error).message}`,
      -1,
      "",
    );
  }

  if (result.exitCode === 127) {
    throw new AnsibleNotInstalledError();
  }
  if (result.exitCode !== 0) {
    throw new AnsibleExecutionError(
      `ansible-playbook --version exited with code ${result.exitCode}`,
      result.exitCode,
      result.stderr,
    );
  }

  const stdout = result.stdout.trim();
  if (stdout.length === 0) {
    throw new AnsibleExecutionError(
      "ansible-playbook --version returned empty stdout",
      result.exitCode,
      result.stderr,
    );
  }

  const version = parseAnsibleVersion(stdout);
  if (version === null) {
    throw new AnsibleExecutionError(
      `ansible-playbook --version output unparseable: ${stdout.split("\n")[0] ?? ""}`,
      result.exitCode,
      result.stderr,
    );
  }

  const warning = belowMin(version) ? buildVersionWarning(version) : undefined;
  return warning === undefined ? { version } : { version, warning };
}

/**
 * Parse the version string from the first line of `ansible-playbook --version`.
 *
 * Handles both formats observed in the wild :
 * - Modern (>= 2.10) : `ansible-playbook [core 2.16.3]` (sometimes followed by extras)
 * - Legacy (< 2.10) : `ansible-playbook 2.9.27`
 */
function parseAnsibleVersion(stdout: string): string | null {
  const firstLine = stdout.split("\n")[0]?.trim() ?? "";
  const coreMatch = firstLine.match(/\[core\s+([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
  if (coreMatch?.[1]) return coreMatch[1];
  const legacyMatch = firstLine.match(/ansible-playbook\s+([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
  if (legacyMatch?.[1]) return legacyMatch[1];
  return null;
}

function belowMin(version: string): boolean {
  const parts = version.split(".").map((p) => Number.parseInt(p, 10));
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  if (major < ANSIBLE_RECOMMENDED_MIN.major) return true;
  if (major > ANSIBLE_RECOMMENDED_MIN.major) return false;
  return minor < ANSIBLE_RECOMMENDED_MIN.minor;
}

function buildVersionWarning(version: string): string {
  return `ansible-playbook ${version} detected — version >= ${ANSIBLE_RECOMMENDED_MIN.major}.${ANSIBLE_RECOMMENDED_MIN.minor} recommended.`;
}

function isEnoent(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === "ENOENT";
}

// ---------------------------------------------------------------------------
// applyStack — INSTALL-002 Décisions 1-7
// ---------------------------------------------------------------------------

/**
 * Compose filenames managed by `applyStack`, in alphabetical order
 * (stable diffs in `state.json#compose_files`). The names match the
 * existing template renderers in `packages/arc-cli/src/templates/`
 * (CLI-006/007/008) — see INSTALL-002 Décision 1 (a).
 */
export const COMPOSE_FILES = [
  "docker-compose.agents.yml",
  "docker-compose.prod.yml",
  "docker-compose.sandbox.yml",
] as const;

/**
 * Literal banner printed when `applyStack` is invoked with `force: true`
 * — INSTALL-002 Décision 4.d. Stored as a constant so tests assert on
 * the exact string.
 */
export const FORCE_NOTICE = "⚠️  --force enabled, skipping idempotence prompt";

export interface ComposeGenerators {
  prod: (cfg: ArcConfig) => string;
  sandbox: (cfg: ArcConfig) => string;
  agents: (cfg: ArcConfig) => string;
}

const DEFAULT_COMPOSERS: ComposeGenerators = {
  prod: generateProdCompose,
  sandbox: generateSandboxCompose,
  agents: generateAgentsCompose,
};

export interface ApplyStackOptions {
  /** Skip the idempotence prompt — see INSTALL-002 Décision 4. */
  force?: boolean;
  /** Test seam : inject custom compose generators (e.g. throwing one). */
  composers?: ComposeGenerators;
  /** Test seam : inject a clock so duration formatting is deterministic. */
  now?: () => Date;
  /** Test seam : sink for the ansible-playbook stream. Default = stdout. */
  onAnsibleLine?: (line: string) => void;
  /**
   * Test seam : inject a {@link PlaybooksLoader} (defaults to the
   * production embedded manifest). Tests typically pass a no-op loader
   * to keep `~/.arc/playbooks/` untouched. DIST-001 1a-2.
   */
  loader?: PlaybooksLoader;
}

/**
 * Apply the local ARC stack on the host : detect Ansible, prompt for
 * idempotence, generate the three composes under `~/.arc/compose/`,
 * invoke the bundled Ansible playbook, then commit `~/.arc/state.json`.
 *
 * Transactional ordering (INSTALL-002 Décision 2 — corrected after
 * sub-task 4 review : rename moved BEFORE ansible so the playbook can
 * resolve composes at their final path via `docker compose -f
 * ~/.arc/compose/X.yml`. Without this swap, ANSIBLE-001 would have to
 * special-case `.tmp/` paths.) :
 *   1. assertAnsibleInstalled            (no FS side effect)
 *   2. detect existing state + composes
 *   3. prompt user                       (skipped on `--force`)
 *   4. mkdir compose dir + .tmp/ subdir
 *   5. render composes into `.tmp/`
 *   6. rename `.tmp/*.yml` → final paths (atomic per file, drop `.tmp/`)
 *   7. invoke ansible-playbook           (reads composes at final paths)
 *   8. on success : write state.json     (commit marker)
 *
 * Transaction model :
 * - state.json is the **commit marker**. If it exists, the stack was
 *   applied successfully (composes generated AND ansible succeeded).
 * - Failure BEFORE rename (steps 4 or 5) : composes are still in
 *   `.tmp/`, never visible at the final path. `.tmp/` is cleaned up.
 * - Failure AFTER rename but BEFORE state.json (step 7 ansible
 *   non-zero) : composes are in place, state.json absent → next run
 *   detects "partial reset" via the prompt and proposes re-run. The
 *   user can also inspect the generated composes for debugging.
 * - Invariant : `state.json` present ⇒ composes valid AND ansible
 *   applied successfully. `state.json` absent + composes present ⇒
 *   last run failed at step 6 or 7 ; safe to retry.
 */
export async function applyStack(
  cfg: ArcConfig,
  adapter: ExecutionAdapter,
  opts: ApplyStackOptions = {},
): Promise<number> {
  // Step 1 — Ansible detection (always, even with --force per Décision 4.b).
  let ansibleVersion: AnsibleVersion;
  try {
    ansibleVersion = await assertAnsibleInstalled(adapter);
  } catch (err) {
    if (err instanceof AnsibleNotInstalledError) {
      cancel(err.message);
      return EXIT_ENV_ERROR;
    }
    if (err instanceof AnsibleExecutionError) {
      cancel(`✗ ansible-playbook --version failed: ${err.message}`);
      return EXIT_ENV_ERROR;
    }
    throw err;
  }
  if (ansibleVersion.warning !== undefined) {
    note(`⚠️  ${ansibleVersion.warning}`);
  }

  // Step 2 — Detect existing state + composes.
  const composeDir = arcComposeDir();
  let existingComposes: readonly string[];
  try {
    existingComposes = await listExistingComposes(composeDir);
  } catch (err) {
    if (err instanceof ComposeDirAccessError) {
      cancel(`✗ Impossible d'accéder à ${err.path}.\n${err.cause.message}`);
      return EXIT_ENV_ERROR;
    }
    throw err;
  }
  const stateResult = await loadStateFile();
  if (stateResult.status === "future_schema") {
    note(
      `⚠️  ~/.arc/state.json schema_version=${stateResult.rawSchemaVersion} > ${STATE_SCHEMA_VERSION} — schema version inconnue, prudence.`,
    );
  }

  // Step 3 — Idempotence prompt (skipped on --force).
  const nowFn = opts.now ?? (() => new Date());
  if (opts.force === true) {
    if (stateResult.status === "ok" || existingComposes.length > 0) {
      note(FORCE_NOTICE);
    }
  } else {
    const decision = await idempotencePrompt(stateResult, existingComposes, nowFn());
    if (decision === "cancel") {
      cancel("setup --apply cancelled");
      return EXIT_CANCELLED;
    }
    // "proceed" or "no_action_needed" → continue.
  }

  // Step 4 — mkdir compose dir + .tmp/.
  const tmpDir = join(composeDir, ".tmp");
  try {
    await mkdir(composeDir, { recursive: true, mode: 0o700 });
    // Re-chmod : umask may have masked the mode flag passed to mkdir.
    await chmod(composeDir, 0o700);
    // Best-effort wipe of any stale .tmp/ from a previous crashed run.
    await rm(tmpDir, { recursive: true, force: true });
    await mkdir(tmpDir, { recursive: true, mode: 0o700 });
  } catch (err) {
    cancel(`✗ Cannot create ${composeDir}: ${(err as Error).message}`);
    return EXIT_ENV_ERROR;
  }

  // Step 5 — Generate composes into .tmp/.
  const composers = opts.composers ?? DEFAULT_COMPOSERS;
  try {
    await writeComposeFile(join(tmpDir, "docker-compose.prod.yml"), composers.prod(cfg));
    await writeComposeFile(join(tmpDir, "docker-compose.sandbox.yml"), composers.sandbox(cfg));
    await writeComposeFile(join(tmpDir, "docker-compose.agents.yml"), composers.agents(cfg));
  } catch (err) {
    await rm(tmpDir, { recursive: true, force: true });
    cancel(`✗ Compose generation failed: ${(err as Error).message}`);
    return EXIT_ENV_ERROR;
  }

  // Step 6 — Rename .tmp/*.yml → composeDir/*.yml (atomic per file)
  // BEFORE invoking ansible. ANSIBLE-001 will need to read composes at
  // their final paths (e.g. `docker compose -f ~/.arc/compose/...yml`),
  // so they must be in place when the playbook runs.
  try {
    for (const file of COMPOSE_FILES) {
      await rename(join(tmpDir, file), join(composeDir, file));
    }
    await rm(tmpDir, { recursive: true, force: true });
  } catch (err) {
    await rm(tmpDir, { recursive: true, force: true });
    cancel(`✗ Failed to publish composes to ${composeDir}: ${(err as Error).message}`);
    return EXIT_ENV_ERROR;
  }

  // Step 7 — Extract the embedded playbook tree to disk, then invoke
  // ansible-playbook. The tree is bundled into the binary at build time
  // (DIST-001 1a-2 — codegen + EmbeddedPlaybooksLoader) and materialised
  // under ~/.arc/playbooks/<version>/ on every run (idempotent
  // overwrite, ~50 KB I/O — negligible). On failure, composes stay in
  // place — the user can inspect them and rerun. state.json stays
  // absent so the next run detects the partial state via the
  // idempotence prompt.
  const loader = opts.loader ?? new EmbeddedPlaybooksLoader(PLAYBOOKS_MANIFEST);
  try {
    await loader.extractToDisk(arcPlaybooksDir(VERSION));
  } catch (err) {
    cancel(`✗ Failed to extract embedded playbooks: ${(err as Error).message}`);
    return EXIT_ENV_ERROR;
  }

  const runId = randomUUID();
  const onLine = opts.onAnsibleLine ?? ((line: string) => process.stdout.write(`${line}\n`));
  const runResult = await runAnsiblePlaybook(adapter, arcPlaybookEntry(VERSION), {
    extraVars: { arc_playbook_run_id: runId },
    onLine,
  });
  if (runResult.exitCode !== 0) {
    cancel(
      `✗ ansible-playbook failed (exit ${runResult.exitCode}). Composes left in place at ${composeDir} for inspection ; state.json not updated.`,
    );
    return EXIT_ENV_ERROR;
  }

  // Step 8 — Commit : write state.json. THIS is the transactional commit.
  const state: ArcState = {
    schema_version: STATE_SCHEMA_VERSION,
    last_apply: nowFn().toISOString(),
    compose_files: [...COMPOSE_FILES],
    ansible_version: ansibleVersion.version,
    playbook_run_id: runId,
  };
  await writeStateFile(state);
  return EXIT_OK;
}

async function writeComposeFile(path: string, content: string): Promise<void> {
  await writeFile(path, content, { encoding: "utf8", mode: 0o600 });
  // Re-chmod : umask may strip the 0o600 mode flag.
  await chmod(path, 0o600);
}

async function listExistingComposes(composeDir: string): Promise<readonly string[]> {
  try {
    const entries = await readdir(composeDir);
    return entries
      .filter((e) => COMPOSE_FILES.includes(e as (typeof COMPOSE_FILES)[number]))
      .sort();
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    if (e.code === "EACCES" || e.code === "EPERM") {
      throw new ComposeDirAccessError(composeDir, e);
    }
    throw err;
  }
}

type IdempotenceDecision = "proceed" | "cancel";

async function idempotencePrompt(
  state: LoadStateResult,
  existingComposes: readonly string[],
  now: Date,
): Promise<IdempotenceDecision> {
  // First-run path : no state file AND no existing composes → nothing to ask.
  if (state.status === "absent" && existingComposes.length === 0) {
    return "proceed";
  }

  const composesLines = (existingComposes.length > 0 ? existingComposes : COMPOSE_FILES)
    .map((f) => `  - ${f}`)
    .join("\n");

  let header: string;
  if (state.status === "ok") {
    const last = new Date(state.state.last_apply);
    header = `⚠️  Stack ARC déjà appliquée le ${formatHumanDate(last)} (il y a ${formatDuration(now.getTime() - last.getTime())}).\n\nComposes existants dans ~/.arc/compose/ :\n${composesLines}`;
  } else {
    header = `⚠️  Composes existants détectés dans ~/.arc/compose/ :\n${composesLines}`;
  }
  note(header);

  const choice = await select({
    message: "Que souhaitez-vous faire ?",
    options: [
      { value: "cancel", label: "Annuler (recommandé sauf si vous savez ce que vous faites)" },
      { value: "proceed", label: "Réécrire les composes et relancer Ansible" },
    ],
  });
  if (typeof choice === "symbol") return "cancel";
  return choice === "proceed" ? "proceed" : "cancel";
}

function formatHumanDate(d: Date): string {
  // YYYY-MM-DD HH:MM (UTC) — keep deterministic, no locale surprises.
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function formatDuration(ms: number): string {
  if (ms < 0) return "moins d'une minute";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "moins d'une minute";
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} heure${hours > 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  return `${days} jour${days > 1 ? "s" : ""}`;
}

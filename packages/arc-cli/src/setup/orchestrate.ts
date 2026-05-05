import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";

import { cancel, intro, isCancel, note, outro, select, text } from "@clack/prompts";
import type { ArcConfig } from "@euglowlabs/arc-shared";

import { HostAdapter } from "../exec/index.js";
import { promptForConfig } from "../init/prompts.js";
import { writeArcConfig } from "../init/write.js";
import { arcConfigPath, arcUserDir } from "../paths.js";
import { applyStack } from "./apply.js";
import { EXIT_CANCELLED, EXIT_ENV_ERROR, EXIT_OK } from "./exit-codes.js";
import { type DetectionResult, detectExistingConfig } from "./idempotence.js";
import { isSensitiveField, maskSensitiveValue } from "./sensitive.js";
import { loadStateFile } from "./state.js";

// Re-exported for backwards compatibility with existing callers.
export { EXIT_CANCELLED, EXIT_ENV_ERROR, EXIT_OK };

/**
 * Banner shown when `--force` is passed without `--apply`. INSTALL-002
 * Décision 2 : `--force` is informative-only in that case (it still
 * fulfills its INSTALL-001 contract of skipping the "Réutiliser" menu),
 * but the user is warned that the apply-side effect is inactive.
 */
export const FORCE_WITHOUT_APPLY_NOTICE = "⚠️  --force has no effect without --apply";

/**
 * Literal success message printed by `runSetup` when `applyStack`
 * returns 0 — INSTALL-002 Décision 3. `<playbook_run_id>` is substituted
 * with the value committed to `~/.arc/state.json` by `applyStack`.
 */
export const APPLY_SUCCESS_TEMPLATE = `✓ Stack ARC appliquée avec succès.

Composes générés dans ~/.arc/compose/.
Application Ansible : <playbook_run_id>.

Étapes suivantes :
  - Vérifier l'état : arc status
  - Voir les logs : arc logs
  - Migrer un projet : voir docs/migration-guide.md`;

export interface SetupOptions {
  /** Skip the "Réutiliser/Réécrire/Annuler" menu when a valid config exists ; overwrite directly. */
  force?: boolean;
  /** When true, run `applyStack` after the config is written/validated. */
  apply?: boolean;
}

/**
 * Orchestrate the `arc setup` core flow (INSTALL-001).
 *
 * Reads the current state of `~/.arc/arc.config.yml` via the pure
 * detector {@link detectExistingConfig}, branches on the discriminated
 * status, runs prompts as needed, and writes the resulting config.
 *
 * Returns the process exit code — callers (typically `SetupCommand`)
 * forward it without further interpretation. Stack apply (Ansible +
 * composes) is the job of INSTALL-002 and lives outside this module.
 */
export async function runSetup(opts: SetupOptions = {}): Promise<number> {
  intro("EuglowLabs ARC — setup");

  // INSTALL-002 Décision 2 : `--force` without `--apply` is harmless
  // but informative. Surface the notice once, before any FS work.
  if (opts.force === true && opts.apply !== true) {
    note(FORCE_WITHOUT_APPLY_NOTICE);
  }

  const detection = await detectExistingConfig();

  switch (detection.status) {
    case "absent":
      return await handleAbsent(opts);
    case "valid":
      return await handleValid(detection.config, opts);
    case "corrupted":
      return await handleCorrupted(detection, opts);
    case "schema_mismatch":
      return await handleSchemaMismatch(detection, opts);
    case "permission_denied":
      return handlePermissionDenied(detection);
    case "user_dir_invalid":
      return handleUserDirInvalid(detection);
  }
}

async function handleAbsent(opts: SetupOptions): Promise<number> {
  const draft = await promptForConfig();
  if (draft === null) {
    cancel("setup cancelled");
    return EXIT_CANCELLED;
  }
  await ensureUserDir();
  await writeArcConfig(arcConfigPath(), draft, { force: false });
  return await finalizeSuccess(opts);
}

async function handleValid(config: ArcConfig, opts: SetupOptions): Promise<number> {
  if (opts.force === true) {
    return await reprompt(config, { reason: "force" }, opts);
  }

  note(`✓ Configuration ARC existante détectée à ${arcConfigPath()}.`);

  const choice = await select({
    message: "Que souhaitez-vous faire ?",
    options: [
      { value: "reuse", label: "Réutiliser cette configuration" },
      { value: "rewrite", label: "Réécrire (re-prompts avec valeurs actuelles comme defaults)" },
      { value: "cancel", label: "Annuler" },
    ],
  });
  if (isCancel(choice)) {
    cancel("setup cancelled");
    return EXIT_CANCELLED;
  }

  if (choice === "reuse") {
    return await finalizeSuccess(opts);
  }
  if (choice === "cancel") {
    cancel("setup cancelled");
    return EXIT_CANCELLED;
  }
  return await reprompt(config, { reason: "rewrite" }, opts);
}

async function handleCorrupted(
  detection: DetectionResult & { status: "corrupted" },
  opts: SetupOptions,
): Promise<number> {
  note(
    `✗ Configuration corrompue : ${arcConfigPath()}\n\nErreur YAML :\n  ${detection.error.message}`,
  );
  const choice = await select({
    message: "Actions disponibles",
    options: [
      {
        value: "backup",
        label: "Sauvegarder + repartir de zéro (renomme en arc.config.yml.broken-<timestamp>)",
      },
      { value: "cancel", label: "Annuler (vous corrigerez à la main)" },
    ],
  });
  if (isCancel(choice) || choice === "cancel") {
    cancel("setup cancelled");
    return EXIT_CANCELLED;
  }
  await backupCurrentConfig();
  return await handleAbsent(opts);
}

async function handleSchemaMismatch(
  detection: DetectionResult & { status: "schema_mismatch" },
  opts: SetupOptions,
): Promise<number> {
  const issues = detection.errors.issues
    .map((issue) => `  - ${issue.path.join(".") || "<root>"} : ${issue.message}`)
    .join("\n");
  note(`✗ Configuration invalide : ${arcConfigPath()}\n\nChamps invalides :\n${issues}`);

  const choice = await select({
    message: "Actions disponibles",
    options: [
      {
        value: "complete",
        label:
          "Compléter/corriger interactivement (re-prompts avec valeurs valides comme defaults)",
      },
      {
        value: "backup",
        label: "Sauvegarder + repartir de zéro (renomme en arc.config.yml.broken-<timestamp>)",
      },
      { value: "cancel", label: "Annuler (vous corrigerez à la main)" },
    ],
  });
  if (isCancel(choice) || choice === "cancel") {
    cancel("setup cancelled");
    return EXIT_CANCELLED;
  }
  if (choice === "backup") {
    await backupCurrentConfig();
    return await handleAbsent(opts);
  }
  return await reprompt(detection.raw as Partial<ArcConfig>, { reason: "schema-correction" }, opts);
}

function handlePermissionDenied(
  detection: DetectionResult & { status: "permission_denied" },
): number {
  cancel(
    `✗ Permission denied on ${detection.path}.\nResolve the file ownership / mode and rerun \`arc setup\`.`,
  );
  return EXIT_ENV_ERROR;
}

function handleUserDirInvalid(detection: DetectionResult & { status: "user_dir_invalid" }): number {
  cancel(
    `✗ ${detection.reason}.\nMove or remove ${detection.path} (it must be a directory) and rerun \`arc setup\`.`,
  );
  return EXIT_ENV_ERROR;
}

interface RepromptOptions {
  reason: "rewrite" | "schema-correction" | "force";
}

async function reprompt(
  defaults: Partial<ArcConfig>,
  _opts: RepromptOptions,
  setupOpts: SetupOptions,
): Promise<number> {
  const draft = await promptForConfigWithDefaults(defaults);
  if (draft === null) {
    cancel("setup cancelled");
    return EXIT_CANCELLED;
  }
  await ensureUserDir();
  await writeArcConfig(arcConfigPath(), draft, { force: true });
  return await finalizeSuccess(setupOpts);
}

/**
 * Sister of `promptForConfig` used when re-prompting on top of a known
 * draft. Each field's current value is offered as the prompt default ;
 * sensitive fields display only a masked hint and accept empty input
 * to mean "keep the current value".
 *
 * Kept inline here (rather than refactoring `init/prompts.ts`) per the
 * INSTALL-001 hors-scope decision : `arc init` stays untouched.
 */
async function promptForConfigWithDefaults(
  defaults: Partial<ArcConfig>,
): Promise<Partial<ArcConfig> | null> {
  const project = await promptText("project", "Project slug", defaults.project);
  if (project === null) return null;

  const domain = await promptText("domain", "Domain", defaults.domain);
  if (domain === null) return null;

  const email = await promptText("email", "Admin email", defaults.email);
  if (email === null) return null;

  const dnsZone = await promptText("dns.zone", "Cloudflare DNS zone", defaults.dns?.zone ?? domain);
  if (dnsZone === null) return null;

  const dnsToken = await promptText(
    "dns.api_token",
    "Cloudflare API token",
    defaults.dns?.api_token,
  );
  if (dnsToken === null) return null;

  return {
    project,
    domain,
    email,
    dns: {
      provider: "cloudflare",
      zone: dnsZone,
      api_token: dnsToken,
    },
  };
}

async function promptText(
  fieldPath: string,
  label: string,
  currentValue: string | undefined,
): Promise<string | null> {
  const sensitive = isSensitiveField(fieldPath);
  const hasCurrent = typeof currentValue === "string" && currentValue.length > 0;
  let placeholder: string | undefined;
  let initialValue: string | undefined;

  if (sensitive && hasCurrent) {
    placeholder = `${maskSensitiveValue(currentValue as string)} (Entrée pour conserver)`;
    initialValue = undefined;
  } else if (hasCurrent) {
    initialValue = currentValue;
  }

  const result = await text({
    message: label,
    placeholder,
    initialValue,
    validate(value) {
      const trimmed = (value ?? "").trim();
      if (trimmed.length === 0) {
        if (sensitive && hasCurrent) {
          // Empty + sensitive + has current → accepted, means "keep".
          return undefined;
        }
        return "Cannot be empty";
      }
      return undefined;
    },
  });

  if (isCancel(result)) return null;
  const trimmed = result.trim();
  if (trimmed.length === 0 && sensitive && hasCurrent) {
    return currentValue as string;
  }
  return trimmed;
}

async function ensureUserDir(): Promise<void> {
  await mkdir(arcUserDir(), { recursive: true, mode: 0o755 });
}

async function backupCurrentConfig(): Promise<void> {
  const src = arcConfigPath();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dst = `${src}.broken-${stamp}`;
  await mkdir(dirname(dst), { recursive: true, mode: 0o755 });
  await rename(src, dst);
}

/**
 * Convergence point for every successful path through `runSetup`.
 *
 * Without `--apply` : print the canonical INSTALL-001 hint and return
 * EXIT_OK. The wording is frozen — see Décision 4 in INSTALL-002.
 *
 * With `--apply` : re-detect the on-disk config (so `applyStack` always
 * sees the validated, persisted shape), then delegate to `applyStack`
 * with `force` propagated. On EXIT_OK, print the literal Décision 3
 * success message with the run id read from `state.json`.
 */
async function finalizeSuccess(opts: SetupOptions): Promise<number> {
  if (opts.apply !== true) {
    outro(`Configuration written to ${arcConfigPath()}.`);
    noteApplyHint();
    return EXIT_OK;
  }

  const detection = await detectExistingConfig();
  if (detection.status !== "valid") {
    cancel(
      `✗ Internal error : post-write detection returned "${detection.status}". Cannot apply stack.`,
    );
    return EXIT_ENV_ERROR;
  }

  const adapter = new HostAdapter();
  const code = await applyStack(detection.config, adapter, { force: opts.force === true });
  if (code !== EXIT_OK) {
    return code;
  }

  // applyStack writes state.json on success — read back the run id for
  // the literal user message (Décision 3).
  const state = await loadStateFile();
  const runId = state.status === "ok" ? state.state.playbook_run_id : "(state.json absent)";
  note(APPLY_SUCCESS_TEMPLATE.replace("<playbook_run_id>", runId));
  return EXIT_OK;
}

function noteApplyHint(): void {
  note("✓ Configuration validée. Lancez `arc setup --apply` pour appliquer la stack.");
}

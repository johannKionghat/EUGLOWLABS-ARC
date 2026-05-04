import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";

import { cancel, intro, isCancel, note, outro, select, text } from "@clack/prompts";
import type { ArcConfig } from "@euglowlabs/arc-shared";

import { promptForConfig } from "../init/prompts.js";
import { writeArcConfig } from "../init/write.js";
import { arcConfigPath, arcUserDir } from "../paths.js";
import { type DetectionResult, detectExistingConfig } from "./idempotence.js";
import { isSensitiveField, maskSensitiveValue } from "./sensitive.js";

/**
 * Exit codes returned by {@link runSetup}.
 *
 * - 0   — success (config written or kept as-is).
 * - 1   — user cancelled (chose "Annuler" in any menu).
 * - 2   — environment error (permission_denied, user_dir_invalid).
 * - 130 — SIGINT (Ctrl+C). Not produced explicitly by this module —
 *         Node propagates the signal naturally and we never swallow it.
 */
export const EXIT_OK = 0;
export const EXIT_CANCELLED = 1;
export const EXIT_ENV_ERROR = 2;

export interface SetupOptions {
  /** Skip the "Réécrire" confirmation menu when a valid config exists ; overwrite directly. */
  force?: boolean;
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

  const detection = await detectExistingConfig();

  switch (detection.status) {
    case "absent":
      return await handleAbsent();
    case "valid":
      return await handleValid(detection.config, opts);
    case "corrupted":
      return await handleCorrupted(detection);
    case "schema_mismatch":
      return await handleSchemaMismatch(detection);
    case "permission_denied":
      return handlePermissionDenied(detection);
    case "user_dir_invalid":
      return handleUserDirInvalid(detection);
  }
}

async function handleAbsent(): Promise<number> {
  const draft = await promptForConfig();
  if (draft === null) {
    cancel("setup cancelled");
    return EXIT_CANCELLED;
  }
  await ensureUserDir();
  await writeArcConfig(arcConfigPath(), draft, { force: false });
  outro(`Configuration written to ${arcConfigPath()}.`);
  noteApplyHint();
  return EXIT_OK;
}

async function handleValid(config: ArcConfig, opts: SetupOptions): Promise<number> {
  if (opts.force === true) {
    return await reprompt(config, { reason: "force" });
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
    outro("✓ Configuration validée. Lancez `arc setup --apply` pour appliquer la stack.");
    return EXIT_OK;
  }
  if (choice === "cancel") {
    cancel("setup cancelled");
    return EXIT_CANCELLED;
  }
  return await reprompt(config, { reason: "rewrite" });
}

async function handleCorrupted(
  detection: DetectionResult & { status: "corrupted" },
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
  return await handleAbsent();
}

async function handleSchemaMismatch(
  detection: DetectionResult & { status: "schema_mismatch" },
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
    return await handleAbsent();
  }
  return await reprompt(detection.raw as Partial<ArcConfig>, { reason: "schema-correction" });
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

async function reprompt(defaults: Partial<ArcConfig>, _opts: RepromptOptions): Promise<number> {
  const draft = await promptForConfigWithDefaults(defaults);
  if (draft === null) {
    cancel("setup cancelled");
    return EXIT_CANCELLED;
  }
  await ensureUserDir();
  await writeArcConfig(arcConfigPath(), draft, { force: true });
  outro(`Configuration written to ${arcConfigPath()}.`);
  noteApplyHint();
  return EXIT_OK;
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

function noteApplyHint(): void {
  note(
    "✓ Configuration validée. Lancez `arc setup --apply` pour appliquer la stack.\n" +
      "  (Le flag --apply sera livré par INSTALL-002.)",
  );
}

import type { ZodError } from "zod";

/**
 * Discriminator for the three failure modes of {@link loadArcConfig}.
 *
 * - `not-found` — the file does not exist on disk
 * - `syntax`    — the file exists but is not valid YAML
 * - `schema`    — the YAML parses but violates `arcConfigSchema`
 */
export type ConfigErrorKind = "not-found" | "syntax" | "schema";

export interface ConfigErrorOptions {
  path: string;
  /** Bullet list of validation issues (only meaningful for `kind === "schema"`). */
  issues?: string[];
  /** Position of the YAML syntax error (only for `kind === "syntax"`). */
  position?: { line: number; col: number };
  cause?: unknown;
}

/**
 * Loader-specific error, thrown by {@link loadArcConfig}.
 *
 * Callers should catch on this exact class to distinguish loader failures
 * from unrelated runtime errors. `toUserMessage()` produces a string
 * suitable for direct display in the CLI; the structured fields
 * (`kind`, `path`, `issues`, `position`) are kept for programmatic use.
 */
export class ConfigError extends Error {
  override readonly name = "ConfigError";
  readonly kind: ConfigErrorKind;
  readonly path: string;
  readonly issues: readonly string[];
  readonly position: { line: number; col: number } | undefined;

  constructor(kind: ConfigErrorKind, message: string, options: ConfigErrorOptions) {
    super(message, { cause: options.cause });
    this.kind = kind;
    this.path = options.path;
    this.issues = options.issues ?? [];
    this.position = options.position;
  }

  /**
   * Format the error as a user-facing multi-line message.
   * Suitable for `process.stderr.write` or `console.error`.
   */
  toUserMessage(): string {
    switch (this.kind) {
      case "not-found":
        return `Config file not found: ${this.path}`;
      case "syntax": {
        const where = this.position
          ? `${this.path}:${this.position.line}:${this.position.col}`
          : this.path;
        return `Invalid YAML at ${where} — ${this.message}`;
      }
      case "schema": {
        const header = `Invalid arc.config.yml at ${this.path}:`;
        const bullets = this.issues.map((issue) => `  - ${issue}`).join("\n");
        return `${header}\n${bullets}`;
      }
    }
  }
}

/**
 * Convert a {@link ZodError} into a flat list of `path.to.field: message`
 * strings, suitable for {@link ConfigError}'s `issues`.
 *
 * Numeric path segments (array indices) are wrapped in `[N]` for
 * readability: `projects[0].subdomain` rather than `projects.0.subdomain`.
 */
export function formatZodError(error: ZodError): string[] {
  return error.issues.map((issue) => {
    let path = "";
    for (const segment of issue.path) {
      if (typeof segment === "number") {
        path = `${path}[${segment}]`;
      } else {
        path = path === "" ? String(segment) : `${path}.${String(segment)}`;
      }
    }
    return path === "" ? issue.message : `${path}: ${issue.message}`;
  });
}

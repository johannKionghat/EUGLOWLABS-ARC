/**
 * Heuristic detection of sensitive config fields by name.
 *
 * Used by the re-prompt flow (Réécrire / schema_mismatch correction) to
 * mask current values in the prompt default rendering. The match is
 * case-insensitive on segment names ; the dotted path is normalised so
 * any segment along it can trigger the match.
 *
 * Examples of fields treated as sensitive :
 * - `dns.api_token`              → true
 * - `backups.r2.secret_access_key` → true
 * - `supabase.jwt_secret`        → true
 * - `project`                    → false
 * - `domain`                     → false
 */

/**
 * Substrings that mark a field as sensitive when present anywhere in
 * the dotted path. Convention frozen by the user spec : "secret",
 * "token", "password", "key" — broad on purpose so any new field that
 * carries auth material is masked by default.
 */
const SENSITIVE_TOKENS: readonly string[] = ["secret", "token", "password", "passwd", "key"];

export function isSensitiveField(path: string): boolean {
  const segments = path.toLowerCase().split(".");
  return segments.some((segment) => SENSITIVE_TOKENS.some((needle) => segment.includes(needle)));
}

/**
 * Render a sensitive value as a masked hint for prompts.
 *
 * Shows the trailing 3 characters as a recognition aid ; the rest is
 * replaced with `***`. Empty / very short values are fully masked.
 */
export function maskSensitiveValue(value: string): string {
  if (value.length <= 4) {
    return "***";
  }
  const tail = value.slice(-3);
  return `***...${tail}`;
}

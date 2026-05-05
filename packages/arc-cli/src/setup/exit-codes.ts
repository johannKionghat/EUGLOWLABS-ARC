/**
 * Exit codes shared across the `arc setup` orchestration and apply
 * layers. Centralised so circular imports between
 * `setup/orchestrate.ts` (which composes the apply layer in
 * INSTALL-002 sub-task 5) and `setup/apply.ts` are avoided.
 *
 * - 0   — success.
 * - 1   — user cancelled (chose "Annuler" in any menu).
 * - 2   — environment error (permission_denied, mkdir fail, ansible
 *         absent, ansible-playbook non-zero exit, compose generation
 *         throw, etc.).
 * - 130 — SIGINT (Ctrl+C). Not produced explicitly by these modules —
 *         Node propagates the signal naturally.
 */
export const EXIT_OK = 0;
export const EXIT_CANCELLED = 1;
export const EXIT_ENV_ERROR = 2;

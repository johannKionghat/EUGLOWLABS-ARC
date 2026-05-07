/**
 * Typed errors for the Cloudflare API client.
 *
 * Hierarchy (consumers can `instanceof CloudflareAuthError` etc.):
 *
 *   Error
 *   └── CloudflareApiError      (base — any non-2xx response)
 *       ├── CloudflareAuthError       (401, 403)
 *       ├── CloudflareRateLimitError  (429)
 *       ├── CloudflareNotFoundError   (404)
 *       └── CloudflareValidationError (400)
 *
 * `override readonly cause` is required by TypeScript's noImplicitOverride
 * since ES2022 added Error.cause to the lib (cf. INSTALL-002 fix `a63ecd1`).
 */

export interface CloudflareApiErrorArgs {
  /** HTTP status code (0 if network error). */
  status: number;
  /** Cloudflare error code (from response body, 1003/1004/...). Optional. */
  code?: number;
  /** Human-readable message. */
  message: string;
  /** Underlying cause (network error, ZodError, etc.). */
  cause?: unknown;
}

export class CloudflareApiError extends Error {
  readonly status: number;
  readonly code: number | undefined;
  override readonly cause: unknown;

  constructor(args: CloudflareApiErrorArgs) {
    super(args.message);
    this.name = "CloudflareApiError";
    this.status = args.status;
    this.code = args.code;
    this.cause = args.cause;
  }
}

export class CloudflareAuthError extends CloudflareApiError {
  constructor(args: CloudflareApiErrorArgs) {
    super(args);
    this.name = "CloudflareAuthError";
  }
}

export class CloudflareRateLimitError extends CloudflareApiError {
  constructor(args: CloudflareApiErrorArgs) {
    super(args);
    this.name = "CloudflareRateLimitError";
  }
}

export class CloudflareNotFoundError extends CloudflareApiError {
  constructor(args: CloudflareApiErrorArgs) {
    super(args);
    this.name = "CloudflareNotFoundError";
  }
}

export class CloudflareValidationError extends CloudflareApiError {
  constructor(args: CloudflareApiErrorArgs) {
    super(args);
    this.name = "CloudflareValidationError";
  }
}

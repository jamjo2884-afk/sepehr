import type { SocialPage } from './types';

/**
 * Shared connector utilities: rate-limit-aware retries, pagination loops
 * and a credential sanitizer. All limits live here as constants — never
 * hardcoded inside a connector.
 */

/** Maximum attempts for a rate-limited request (1 initial + N retries). */
export const SOCIAL_CONNECTOR_MAX_RETRIES = 3;

/** Base delay before the first retry, in ms. */
export const SOCIAL_CONNECTOR_BACKOFF_BASE_MS = 500;

/** Backoff multiplier per retry (exponential). */
export const SOCIAL_CONNECTOR_BACKOFF_FACTOR = 2;

/** Cap on a single backoff wait, in ms. */
export const SOCIAL_CONNECTOR_BACKOFF_MAX_MS = 10_000;

/**
 * HTTP statuses that trigger a retry (rate limit + transient server
 * errors). Kept as a constant so the retry policy is centralized.
 */
export const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/** Statuses that definitely must NOT be retried. */
export const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404]);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `fn` with retry + exponential backoff for rate-limit / transient
 * errors. Never retries 4xx auth errors. Returns the last error after
 * `SOCIAL_CONNECTOR_MAX_RETRIES` attempts.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  onAttempt?: (attempt: number, error: unknown) => void,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < SOCIAL_CONNECTOR_MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (isNonRetryable(err) || attempt === SOCIAL_CONNECTOR_MAX_RETRIES - 1) {
        break;
      }
      onAttempt?.(attempt + 1, err);
      const backoff = Math.min(
        SOCIAL_CONNECTOR_BACKOFF_BASE_MS *
          SOCIAL_CONNECTOR_BACKOFF_FACTOR ** attempt,
        SOCIAL_CONNECTOR_BACKOFF_MAX_MS,
      );
      await sleep(backoff);
    }
  }
  throw lastError;
}

function isNonRetryable(err: unknown): boolean {
  if (err instanceof HttpError) {
    return NON_RETRYABLE_STATUSES.has(err.status);
  }
  return false;
}

/** Whether an HTTP status is retryable (used by tests / future code). */
export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

/** A fetch-style error carrying an HTTP status. */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * Fetch with a retry wrapper. `request` returns the raw Response; the
 * caller provides the response body accessor. Any non-ok response throws
 * an `HttpError`.
 */
export async function fetchWithRetry(
  request: () => Promise<Response>,
  onAttempt?: (attempt: number, error: unknown) => void,
): Promise<Response> {
  return withRetry(async () => {
    const res = await request();
    if (!res.ok) {
      throw new HttpError(res.status, `HTTP ${res.status}`);
    }
    return res;
  }, onAttempt);
}

/**
 * Loop over a paginated endpoint until every page is consumed. `pageFn`
 * returns a `SocialPage`; the loop follows `next` until it is null or
 * absent. `maxPages` guards against infinite loops.
 */
export async function fetchAllPages<T>(
  pageFn: (token: string | null) => Promise<SocialPage<T>>,
  maxPages = 100,
): Promise<T[]> {
  const out: T[] = [];
  let token: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const result = await pageFn(token);
    out.push(...result.items);
    if (result.next === null || result.next === undefined) break;
    token = result.next;
  }
  return out;
}

/**
 * Redact every known secret from a message so error logs / UI never leak
 * tokens. `secrets` are the credential values in play for this request.
 */
export function sanitizeErrorMessage(
  message: string,
  secrets: string[],
): string {
  let out = message;
  for (const secret of secrets) {
    if (secret && secret.length >= 4) {
      out = out.split(secret).join('[redacted]');
    }
  }
  return out;
}

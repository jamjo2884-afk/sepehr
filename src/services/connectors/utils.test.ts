import { describe, expect, it, vi } from 'vitest';
import {
  fetchAllPages,
  fetchWithRetry,
  HttpError,
  sanitizeErrorMessage,
  withRetry,
} from './utils';

describe('connectors/utils — retry + pagination + sanitizer', () => {
  it('pagination: follows `next` until null', async () => {
    const items = await fetchAllPages<number>((token) =>
      Promise.resolve({
        items: token ? [3] : [1, 2],
        next: token ? null : 'page-2',
      }),
    );
    expect(items).toEqual([1, 2, 3]);
  });

  it('pagination: guards against infinite loops via maxPages', async () => {
    const fn = vi.fn(async () => ({ items: [1], next: 'again' }));
    const items = await fetchAllPages<number>(fn, 3);
    expect(items).toEqual([1, 1, 1]);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('withRetry: retries rate-limit errors up to the max', async () => {
    const calls: number[] = [];
    await expect(
      withRetry(async () => {
        calls.push(1);
        throw new HttpError(429, 'Too Many Requests');
      }),
    ).rejects.toBeInstanceOf(HttpError);
    // 1 initial + 2 retries (max 3 attempts total).
    expect(calls.length).toBe(3);
  });

  it('withRetry: never retries 4xx auth errors', async () => {
    const calls: number[] = [];
    await expect(
      withRetry(async () => {
        calls.push(1);
        throw new HttpError(401, 'Unauthorized');
      }),
    ).rejects.toBeInstanceOf(HttpError);
    expect(calls.length).toBe(1);
  });

  it('withRetry: returns the value on success', async () => {
    const value = await withRetry(async () => 'ok');
    expect(value).toBe('ok');
  });

  it('fetchWithRetry: non-ok responses throw HttpError with the status', async () => {
    const res = { ok: false, status: 500 } as Response;
    await expect(fetchWithRetry(() => Promise.resolve(res))).rejects.toThrow(
      HttpError,
    );
  });

  it('sanitizeErrorMessage: redacts secrets from messages', () => {
    const msg = sanitizeErrorMessage(
      'token bot123:ABC failed with bot123:ABC inside',
      ['bot123:ABC'],
    );
    expect(msg).not.toContain('bot123:ABC');
    expect(msg).toContain('[redacted]');
  });

  it('sanitizeErrorMessage: short secrets are left untouched', () => {
    const msg = sanitizeErrorMessage('x is short', ['ab']);
    expect(msg).toBe('x is short');
  });
});

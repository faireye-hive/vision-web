import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchJsonWithTimeout } from './http';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function pendingUntilAborted(signal: AbortSignal) {
  return new Promise<never>((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

describe('bounded JSON requests', () => {
  it('aborts a server that never sends headers and releases the deadline', async () => {
    let signal!: AbortSignal;
    vi.stubGlobal('fetch', vi.fn((_url, init) => {
      signal = init.signal;
      return pendingUntilAborted(signal);
    }));
    const result = expect(fetchJsonWithTimeout('https://example.com', {}, 100)).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the deadline active while a JSON body is stalled', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => ({
      ok: true,
      json: () => pendingUntilAborted(init.signal),
    })));
    const result = expect(fetchJsonWithTimeout('https://example.com', {}, 100)).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('propagates caller cancellation and does not start an already cancelled request', async () => {
    const fetchMock = vi.fn((_url, init) => pendingUntilAborted(init.signal));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const result = expect(fetchJsonWithTimeout('https://example.com', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await result;
    await expect(fetchJsonWithTimeout('https://example.com', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns successful JSON and reports HTTP failures without leaving timers', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: 42 }) })
      .mockResolvedValueOnce({ ok: false, status: 503 }));
    await expect(fetchJsonWithTimeout('https://example.com')).resolves.toEqual({ value: 42 });
    await expect(fetchJsonWithTimeout('https://example.com')).rejects.toThrow('HTTP 503');
    expect(vi.getTimerCount()).toBe(0);
  });
});

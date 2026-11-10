import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const summary = { author: 'alice', permlink: 'article' };
function stalledFetch(_url: string, init: RequestInit) {
  return new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true }));
}

describe('language discovery request lifecycle', () => {
  it.each(['browse', 'details'])('expires a stalled %s request and permits a fresh successful load', async (stage) => {
    const { getLanguageDiscoveryFeed } = await import('./combflowApi');
    const fetchMock = vi.fn();
    if (stage === 'details') fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ posts: [summary] }) });
    fetchMock.mockImplementationOnce(stalledFetch);
    vi.stubGlobal('fetch', fetchMock);
    const result = expect(getLanguageDiscoveryFeed({ language: 'pt' })).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(10000);
    await result;
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ posts: [summary] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ ...summary, title: 'Recovered' }] });
    const posts = await getLanguageDiscoveryFeed({ language: 'pt' });
    expect(posts[0]).toMatchObject({ ...summary, title: 'Recovered' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['browse', 'details'])('cancels the %s stage when the caller leaves or changes filters', async (stage) => {
    const { getLanguageDiscoveryFeed } = await import('./combflowApi');
    const fetchMock = vi.fn();
    if (stage === 'details') fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ posts: [summary] }) });
    fetchMock.mockImplementationOnce(stalledFetch);
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const result = expect(getLanguageDiscoveryFeed({ language: 'pt', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await result;
    expect(fetchMock).toHaveBeenCalledTimes(stage === 'details' ? 2 : 1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns predefined languages if the languages endpoint never responds', async () => {
    const { getCombflowLanguages, PREDEFINED_TOP_LANGUAGES } = await import('./combflowApi');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(stalledFetch));
    const result = getCombflowLanguages();
    await vi.advanceTimersByTimeAsync(10000);
    expect(await result).toEqual(PREDEFINED_TOP_LANGUAGES);
    expect(vi.getTimerCount()).toBe(0);
  });
});

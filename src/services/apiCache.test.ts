import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function storage() {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; }, key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => { data.delete(key); }
  };
}
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
  vi.stubGlobal('window', { sessionStorage: storage(), localStorage: storage() });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('API cache lifecycle', () => {
  it('shares the community catalog across mounts and retries a failed first load', async () => {
    const { loadCommunityCatalog } = await import('./communityCatalog');
    const read = vi.fn().mockRejectedValueOnce(new Error('Offline'));
    vi.stubGlobal('fetch', read);
    await expect(loadCommunityCatalog()).rejects.toThrow('Offline');
    read.mockResolvedValue({ ok: true, json: async () => [{ name: 'hive-123' }] });
    await Promise.all([loadCommunityCatalog(), loadCommunityCatalog()]);
    await loadCommunityCatalog();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('keeps expired data for failed refresh, replaces it on recovery, and bounds offline retention', async () => {
    const { apiCache, fetchWithCache } = await import('./apiCache');
    apiCache.set('feed', ['old'], 1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(apiCache.has('feed')).toBe(false);
    expect(apiCache.get('feed')).toBeNull();
    const offline = vi.fn().mockRejectedValue(new Error('Offline'));
    await expect(fetchWithCache('feed', offline)).resolves.toEqual(['old']);
    await expect(fetchWithCache('feed', async () => ['fresh'], { ttl: 1000 })).resolves.toEqual(['fresh']);
    expect(apiCache.get('feed')).toEqual(['fresh']);
    await vi.advanceTimersByTimeAsync(31 * 60_000);
    await expect(fetchWithCache('feed', offline)).rejects.toThrow('Offline');
  });

  it('shares concurrent refreshes and does not cache failed reads', async () => {
    const { apiCache, fetchWithCache } = await import('./apiCache');
    const read = vi.fn().mockResolvedValue(['new']);
    await Promise.all([fetchWithCache('a', read, { forceRefresh: true }), fetchWithCache('a', read, { forceRefresh: true })]);
    expect(read).toHaveBeenCalledTimes(1);
    await expect(fetchWithCache('failure', async () => { throw new Error('Offline'); })).rejects.toThrow();
    expect(apiCache.has('failure')).toBe(false);
  });

  it('requires a live result on forced verification, even if a normal read can fall back offline', async () => {
    const { apiCache, fetchWithCache } = await import('./apiCache');
    apiCache.set('roles', ['old-admin'], 1000);
    await vi.advanceTimersByTimeAsync(1000);
    const offline = vi.fn().mockRejectedValue(new Error('Offline'));
    const normal = fetchWithCache('roles', offline);
    const verify = fetchWithCache('roles', offline, { forceRefresh: true });
    await expect(normal).resolves.toEqual(['old-admin']);
    await expect(verify).rejects.toThrow('Offline');
  });

  it.each(['key', 'pattern', 'clear', 'write'])('prevents a pending old read from restoring data after %s', async (action) => {
    const { apiCache, fetchWithCache } = await import('./apiCache');
    let resolve!: (value: string) => void;
    const old = fetchWithCache('account:alice', () => new Promise<string>(done => { resolve = done; }));
    if (action === 'key') apiCache.invalidate('account:alice');
    if (action === 'pattern') apiCache.invalidatePattern(/^account:/g);
    if (action === 'clear') apiCache.clear();
    if (action === 'write') apiCache.set('account:alice', 'new');
    resolve('old'); await old;
    expect(apiCache.get('account:alice')).toBe(action === 'write' ? 'new' : null);
    if (action !== 'write') {
      await fetchWithCache('account:alice', async () => 'reloaded');
      expect(apiCache.get('account:alice')).toBe('reloaded');
    }
  });

  it('removes a previous persistent value when its replacement is memory-only', async () => {
    const { apiCache } = await import('./apiCache');
    apiCache.set('posts', 'old', 60_000, true);
    expect(window.localStorage.getItem('hive_cache_v1:posts')).not.toBeNull();
    apiCache.set('posts', [{ permlink: 'new', body: 'article' }], 60_000);
    expect(window.localStorage.getItem('hive_cache_v1:posts')).toBeNull();
    vi.resetModules();
    expect((await import('./apiCache')).apiCache.get('posts')).toBeNull();
  });

  it('continues in memory if browser storage getters throw', async () => {
    vi.stubGlobal('window', Object.defineProperties({}, {
      sessionStorage: { get() { throw new Error('Storage denied'); } },
      localStorage: { get() { throw new Error('Storage denied'); } }
    }));
    const { apiCache } = await import('./apiCache');
    apiCache.set('account', { name: 'alice' });
    expect(apiCache.get('account')).toEqual({ name: 'alice' });
    expect(() => apiCache.clear()).not.toThrow();
    expect(apiCache.get('account')).toBeNull();
  });
});

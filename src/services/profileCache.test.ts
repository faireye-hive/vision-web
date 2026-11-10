import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
  const data = new Map<string, string>();
  vi.stubGlobal('window', { sessionStorage: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => { data.delete(key); }
  } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('expires profiles in memory and storage without renewing old sections on partial updates', async () => {
  const { getProfileCache, setProfileCache } = await import('./profileCache');
  setProfileCache('@Alice', { profile: { name: 'Alice' } });
  await vi.advanceTimersByTimeAsync(4 * 60_000);
  setProfileCache('alice', { comments: [] });
  expect(getProfileCache('alice')?.profile).toEqual({ name: 'Alice' });
  await vi.advanceTimersByTimeAsync(60_000);
  expect(getProfileCache('alice')).toBeNull();
  expect(window.sessionStorage.getItem('hive_prof_alice')).toBeNull();
});

it('accepts fresh session snapshots and rejects expired snapshots after a reload', async () => {
  const { setProfileCache } = await import('./profileCache');
  setProfileCache('alice', { profile: { name: 'Alice' } });
  vi.resetModules();
  expect((await import('./profileCache')).getProfileCache('alice')?.profile.name).toBe('Alice');
  await vi.advanceTimersByTimeAsync(5 * 60_000);
  vi.resetModules();
  expect((await import('./profileCache')).getProfileCache('alice')).toBeNull();
});

it('drops profile and feed snapshots after publication without invalidating other authors posts', async () => {
  const { setProfileCache, getProfileCache, invalidateAccountContentCache } = await import('./profileCache');
  const { apiCache } = await import('./apiCache');
  setProfileCache('alice.test', { profile: { name: 'Alice' } });
  apiCache.set('account_posts:blog:alice.test:20', ['old']);
  apiCache.set('account_posts:blog:alicextest:20', ['other']);
  apiCache.set('ranked_posts:hot:::20::', ['old']);
  invalidateAccountContentCache('alice.test');
  expect(getProfileCache('alice.test')).toBeNull();
  expect(apiCache.has('account_posts:blog:alice.test:20')).toBe(false);
  expect(apiCache.has('ranked_posts:hot:::20::')).toBe(false);
  expect(apiCache.has('account_posts:blog:alicextest:20')).toBe(true);
});

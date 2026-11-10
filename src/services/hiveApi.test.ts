import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('dompurify', () => ({ default: { addHook: vi.fn() } }));

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal('window', { location: { protocol: 'https:' }, dispatchEvent: vi.fn(), addEventListener: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Hive RPC failure handling', () => {
  it('deduplicates a failed call, handles its cleanup rejection and allows retry', async () => {
    const { hiveRpcCall } = await import('./hiveApi');
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('Offline'));
    vi.stubGlobal('fetch', fetchMock);
    const node = 'https://unavailable.example';
    const results = await Promise.allSettled([
      hiveRpcCall('condenser_api.get_version', [], node),
      hiveRpcCall('condenser_api.get_version', [], node),
    ]);
    expect(results.map(result => result.status)).toEqual(['rejected', 'rejected']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // An ignored .finally() would emit an unhandled rejection on this tick.
    await vi.advanceTimersByTimeAsync(0);
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ result: 'recovered' }) });
    await expect(hiveRpcCall('condenser_api.get_version', [], node)).resolves.toBe('recovered');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shares concurrent pings, aborts after five seconds and permits another ping', async () => {
    const { pingNode, NODE_PING_TIMEOUT_MS } = await import('./hiveApi');
    let signal!: AbortSignal;
    const fetchMock = vi.fn((_url, init) => {
      signal = init.signal;
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const url = 'https://slow.example';
    const first = pingNode(url);
    const second = pingNode(url);
    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(NODE_PING_TIMEOUT_MS);
    expect(await first).toBe(-1);
    expect(await second).toBe(-1);
    expect(signal.aborted).toBe(true);
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ result: { blockchain_version: '1.0' } }) });
    expect(await pingNode(url)).toBeGreaterThanOrEqual(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not report a JSON-RPC error response as a healthy node', async () => {
    const { pingNode } = await import('./hiveApi');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: { message: 'Unavailable' } }) }));
    expect(await pingNode('https://failed.example')).toBe(-1);
  });
});

describe('RPC URL protocol validation', () => {
  it('rejects HTTP before a connectivity test or save in HTTPS pages', async () => {
    const { addCustomHiveNode, getHiveNodeUrlError, pingNode } = await import('./hiveApi');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(getHiveNodeUrlError('http://rpc.example')).toMatch(/HTTPS/);
    expect(addCustomHiveNode('http://rpc.example')).toMatchObject({ success: false, error: expect.stringMatching(/HTTPS/) });
    expect(await pingNode('http://rpc.example')).toBe(-1);
    expect(localStorage.getItem('nebulosa_custom_rpc_nodes')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('excludes previously saved HTTP nodes and falls back from a saved HTTP selection', async () => {
    localStorage.setItem('nebulosa_custom_rpc_nodes', JSON.stringify(['http://old.example', 'https://custom.example']));
    localStorage.setItem('nebulosa_active_rpc_node', 'http://old.example');
    const { getCustomHiveNodes, getActiveNode, DEFAULT_HIVE_NODES } = await import('./hiveApi');
    expect(getCustomHiveNodes()).toEqual(['https://custom.example']);
    expect(getActiveNode()).toBe(DEFAULT_HIVE_NODES[0]);
  });

  it('keeps HTTP usable for a locally served HTTP app and rejects unsupported protocols', async () => {
    vi.stubGlobal('window', { location: { protocol: 'http:' }, dispatchEvent: vi.fn(), addEventListener: vi.fn() });
    const { getHiveNodeUrlError, addCustomHiveNode, getActiveNode } = await import('./hiveApi');
    expect(addCustomHiveNode('http://localhost:8090')).toEqual({ success: true });
    expect(getActiveNode()).toBe('http://localhost:8090');
    expect(getHiveNodeUrlError('javascript:alert(1)')).toBeTruthy();
    expect(getHiveNodeUrlError('not a url')).toBeTruthy();
  });
});

describe('page data caching', () => {
  it('invalidates changed account data only after Keychain confirms a successful operation', async () => {
    const { apiCache } = await import('./hiveApi');
    const { setProfileCache, getProfileCache } = await import('./profileCache');
    const { KeychainService } = await import('./keychain');
    let success = false;
    window.hive_keychain = {
      requestCustomJson: (...args: any[]) => args.at(-1)({ success }),
      requestBroadcast: (...args: any[]) => args.at(-1)({ success })
    };
    apiCache.set('following_details:alice:1000', ['bob']);
    apiCache.set('following_details:carol:1000', ['bob']);
    await KeychainService.followUser('alice', 'bob', false);
    expect(apiCache.has('following_details:alice:1000')).toBe(true);
    success = true;
    await KeychainService.followUser('alice', 'bob', false);
    expect(apiCache.has('following_details:alice:1000')).toBe(false);
    expect(apiCache.has('following_details:carol:1000')).toBe(true);
    apiCache.set('subscriptions:alice', [['hive-123']]);
    await KeychainService.subscribeCommunity('alice', 'hive-123', false);
    expect(apiCache.has('subscriptions:alice')).toBe(false);
    setProfileCache('alice', { profile: { name: 'Old' } });
    apiCache.set('profile:alice', { name: 'Old' });
    apiCache.set('account:alice', { name: 'alice' });
    await KeychainService.updateProfile('alice', { name: 'New' });
    expect(apiCache.has('profile:alice')).toBe(false);
    expect(apiCache.has('account:alice')).toBe(false);
    expect(getProfileCache('alice')).toBeNull();
  });

  it('shares notification data between badge and inbox, expires it and honors manual refresh', async () => {
    const { getAccountNotifications } = await import('./hiveApi');
    const rows = Array.from({ length: 50 }, (_, id) => ({ id: String(id), msg: 'Activity' }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: rows }) });
    vi.stubGlobal('fetch', fetchMock);
    const [badge, inbox] = await Promise.all([getAccountNotifications('alice', 15), getAccountNotifications('alice', 50)]);
    expect(badge).toHaveLength(15); expect(inbox).toHaveLength(50);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await getAccountNotifications('alice', 50);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await getAccountNotifications('alice', 50, undefined, true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    await getAccountNotifications('alice', 15);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await getAccountNotifications('bob', 15);
    await getAccountNotifications('alice', 50, 'cursor');
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('caches complete following lists, shares simultaneous loads and invalidates derived feeds after changes', async () => {
    const { getAllFollowingWithDetails, invalidateFollowingCache, apiCache } = await import('./hiveApi');
    const fetchMock = vi.fn(async (_url, init) => {
      const { method } = JSON.parse(init.body);
      const result = method === 'condenser_api.get_following'
        ? [{ following: 'bob' }, { following: 'carol' }]
        : [{ name: 'bob', last_post: '2026-11-09T10:00:00' }, { name: 'carol' }];
      return { ok: true, json: async () => ({ result }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const [first, same] = await Promise.all([getAllFollowingWithDetails('alice'), getAllFollowingWithDetails('alice')]);
    expect(first).toEqual(same); expect(first.map(row => row.username)).toEqual(['bob', 'carol']);
    await getAllFollowingWithDetails('alice');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await getAllFollowingWithDetails('alice', 1000, true);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    apiCache.set('followed_root_feed:alice:20::', ['old']);
    apiCache.set('followed_root_feed:alice.other:20::', ['other']);
    invalidateFollowingCache('alice');
    expect(apiCache.has('followed_root_feed:alice:20::')).toBe(false);
    expect(apiCache.has('followed_root_feed:alice.other:20::')).toBe(true);
    await getAllFollowingWithDetails('alice');
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('keeps valid account posts on an RPC failure rather than caching a fake empty feed', async () => {
    const { getAccountPosts, apiCache, CACHE_TTL } = await import('./hiveApi');
    const posts = [{ author: 'alice', permlink: 'post', body: 'Full article' }];
    apiCache.set('account_posts:blog:alice:20', posts, CACHE_TTL.FEED);
    await vi.advanceTimersByTimeAsync(CACHE_TTL.FEED);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: { message: 'not found' } }) }));
    await expect(getAccountPosts('blog', 'alice')).resolves.toEqual(posts);
    expect(apiCache.has('account_posts:blog:alice:20')).toBe(false);
  });

  it('caches legitimate empty ranked feeds but always reads Created live', async () => {
    const { getRankedPosts } = await import('./hiveApi');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    await getRankedPosts('hot'); await getRankedPosts('hot');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await getRankedPosts('created'); await getRankedPosts('created');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

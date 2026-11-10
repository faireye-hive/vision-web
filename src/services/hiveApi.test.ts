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

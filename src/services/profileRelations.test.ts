import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hiveRpcCall } from './hiveApi';
import { getProfileRelations, isProfileRelation } from './profileRelations';
vi.mock('./hiveApi', () => ({ hiveRpcCall: vi.fn() }));
const rpc = vi.mocked(hiveRpcCall);
beforeEach(() => { rpc.mockReset(); });

describe('profile relation lists', () => {
  it('maps followers and removes the inclusive pagination cursor', async () => {
    rpc.mockResolvedValue([{ follower: 'alice' }, { follower: 'bob' }]);
    expect(await getProfileRelations('owner', 'followers', 'alice')).toEqual({ rows: [{ name: 'bob' }], hasMore: false });
    expect(rpc).toHaveBeenCalledWith('condenser_api.get_followers', ['owner', 'alice', 'blog', 101]);
  });
  it('keeps pagination available after a full following page', async () => {
    rpc.mockResolvedValue(Array.from({ length: 100 }, (_, i) => ({ following: `user-${i}` })));
    const result = await getProfileRelations('owner', 'following');
    expect(result.rows).toHaveLength(100);
    expect(result.hasMore).toBe(true);
  });
  it('requests moderation lists without unsupported pagination parameters and preserves descriptions', async () => {
    rpc.mockResolvedValue([{ name: 'alice', blacklist_description: 'Community list' }, 'bob']);
    expect(await getProfileRelations('owner', 'follow_blacklist')).toEqual({ rows: [{ name: 'alice', blacklist_description: 'Community list' }, { name: 'bob' }], hasMore: false });
    expect(rpc).toHaveBeenCalledWith('bridge.get_follow_list', { observer: 'owner', follow_type: 'follow_blacklist' });
  });
  it('propagates RPC failures so the UI can offer retry', async () => {
    rpc.mockImplementation(async () => { throw new Error('offline'); });
    let failure: unknown;
    try { await getProfileRelations('owner', 'muted'); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe('offline');
  });
  it('rejects unknown query parameters', () => {
    expect(isProfileRelation('followers')).toBe(true);
    expect(isProfileRelation('toString')).toBe(false);
    expect(isProfileRelation(null)).toBe(false);
  });
});

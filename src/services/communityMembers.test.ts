import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hiveRpcCall, HiveCommunity } from './hiveApi';
import { apiCache } from './apiCache';
import { getCommunityMembers, getCommunityTeam, COMMUNITY_MEMBERS_PAGE_SIZE } from './communityMembers';

vi.mock('./hiveApi', () => ({ hiveRpcCall: vi.fn() }));
beforeEach(() => { apiCache.clear(); vi.clearAllMocks(); });

describe('community membership data', () => {
  it('shares cached member reads and keeps different pagination cursors separate', async () => {
    vi.mocked(hiveRpcCall).mockResolvedValue([['alice', 'guest', null, '2026-11-10 10:00:00']]);
    const [first, concurrent] = await Promise.all([getCommunityMembers('hive-163772'), getCommunityMembers('hive-163772')]);
    expect(first).toEqual([{ name: 'alice', role: 'guest', title: '', joined: '2026-11-10 10:00:00' }]);
    expect(concurrent).toEqual(first);
    expect(hiveRpcCall).toHaveBeenCalledWith('bridge.list_subscribers', { community: 'hive-163772', limit: COMMUNITY_MEMBERS_PAGE_SIZE });
    await getCommunityMembers('hive-163772');
    expect(hiveRpcCall).toHaveBeenCalledTimes(1);
    await getCommunityMembers('hive-163772', 'alice');
    expect(hiveRpcCall).toHaveBeenLastCalledWith('bridge.list_subscribers', { community: 'hive-163772', last: 'alice', limit: COMMUNITY_MEMBERS_PAGE_SIZE });
    expect(hiveRpcCall).toHaveBeenCalledTimes(2);
  });
  it('rejects invalid communities before making a request and retries a failed response', async () => {
    await expect(getCommunityMembers('../other')).rejects.toThrow('Invalid community');
    expect(hiveRpcCall).not.toHaveBeenCalled();
    vi.mocked(hiveRpcCall).mockResolvedValueOnce({ error: 'bad response' }).mockResolvedValueOnce([]);
    await expect(getCommunityMembers('hive-163772')).rejects.toThrow('Invalid community members response');
    await expect(getCommunityMembers('hive-163772')).resolves.toEqual([]);
    expect(hiveRpcCall).toHaveBeenCalledTimes(2);
  });
  it('discards malformed rows and unsafe account names without losing valid members', async () => {
    vi.mocked(hiveRpcCall).mockResolvedValue([null, {}, [], ['<img src=x>', 'admin'], ['alice', 'mod', 'Moderator', ''], ['bob']]);
    expect(await getCommunityMembers('hive-163772')).toEqual([{ name: 'alice', role: 'mod', title: 'Moderator', joined: '' }, { name: 'bob', role: 'guest', title: '', joined: '' }]);
  });
  it('shows only published leadership roles and tolerates malformed team entries', () => {
    const community = { team: [null, ['alice', 'admin', 'Curator'], ['bob', 'guest', ''], ['<a>', 'owner'], ['carol', 'mod', null]] } as unknown as HiveCommunity;
    expect(getCommunityTeam(community)).toEqual([['alice', 'admin', 'Curator'], ['carol', 'mod', '']]);
    expect(getCommunityTeam({} as HiveCommunity)).toEqual([]);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProfileRelations } from './profileRelations';
import { loadBlacklistSources } from './blacklistSources';
vi.mock('./profileRelations', () => ({ getProfileRelations: vi.fn() }));
const relations = vi.mocked(getProfileRelations);
beforeEach(() => { relations.mockReset(); });
describe('blacklist flair sources', () => {
  it('merges own and followed blacklist entries and preserves attribution', async () => {
    relations.mockImplementation(async (account, type) => ({ hasMore: false, rows:
      type === 'follow_blacklist' ? [{ name: 'list-a' }, { name: 'list-b' }] :
      account === 'owner' ? [{ name: '@Alice' }] : account === 'list-a' ? [{ name: 'alice' }, { name: 'bob' }] : [{ name: 'bob' }]
    }));
    const result = await loadBlacklistSources('owner');
    expect(result.accounts.alice).toEqual({ own: true, lists: ['list-a'] });
    expect(result.accounts.bob).toEqual({ own: false, lists: ['list-a', 'list-b'] });
    expect(result.incomplete).toBe(false);
  });
  it('reports partial failures without discarding successfully loaded lists', async () => {
    relations.mockImplementation(async (account, type) => {
      if (account === 'offline') throw new Error('offline');
      return { hasMore: false, rows: type === 'follow_blacklist' ? [{ name: 'offline' }] : [{ name: 'alice' }] };
    });
    const result = await loadBlacklistSources('owner');
    expect(result.incomplete).toBe(true);
    expect(result.accounts.alice.own).toBe(true);
  });
  it('does not include accounts that are absent from every list', async () => {
    relations.mockResolvedValue({ rows: [], hasMore: false });
    expect((await loadBlacklistSources('owner')).accounts.alice).toBeUndefined();
  });
});

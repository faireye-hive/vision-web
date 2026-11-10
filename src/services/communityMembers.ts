import { CACHE_TTL, fetchWithCache } from './apiCache';
import { HiveCommunity, hiveRpcCall } from './hiveApi';
import { COMMUNITY_NAME } from '../utils/communityRoutes';

export interface CommunityMember {
  name: string;
  role: string;
  title: string;
  joined: string;
}

export const COMMUNITY_MEMBERS_PAGE_SIZE = 40;

export function getCommunityTeam(community: HiveCommunity): [string, string, string][] {
  if (!Array.isArray(community.team)) return [];
  return community.team.filter(row => Array.isArray(row) && typeof row[0] === 'string' && /^[a-z0-9.-]+$/.test(row[0]) && ['owner', 'admin', 'mod'].includes(row[1]))
    .map(([name, role, title]) => [name, role, typeof title === 'string' ? title : '']);
}

/** https://developers.hive.io/apidefinitions/bridge.html#bridge.list_subscribers */
export async function getCommunityMembers(community: string, last = '', refresh = false): Promise<CommunityMember[]> {
  if (!COMMUNITY_NAME.test(community)) throw new Error('Invalid community.');
  return fetchWithCache(`community-members:${community}:${last}`, async () => {
    // Current Hivemind rejects an empty `last` as a nonexistent subscriber.
    const rows = await hiveRpcCall<unknown>('bridge.list_subscribers', { community, ...(last ? { last } : {}), limit: COMMUNITY_MEMBERS_PAGE_SIZE });
    if (!Array.isArray(rows)) throw new Error('Invalid community members response.');
    return rows.filter(row => Array.isArray(row) && typeof row[0] === 'string' && /^[a-z0-9.-]+$/.test(row[0])).slice(0, COMMUNITY_MEMBERS_PAGE_SIZE)
      .map(row => ({ name: row[0], role: typeof row[1] === 'string' ? row[1] : 'guest', title: typeof row[2] === 'string' ? row[2] : '', joined: typeof row[3] === 'string' ? row[3] : '' }));
  }, { ttl: CACHE_TTL.COMMUNITY, forceRefresh: refresh });
}

import { hiveRpcCall } from './hiveApi';

export const RELATION_LABELS = {
  followers: 'Followers', following: 'Following', muted: 'Muted accounts',
  blacklisted: 'Blacklisted accounts', follow_blacklist: 'Followed blacklists', follow_muted: 'Followed mute lists'
} as const;
export type ProfileRelation = keyof typeof RELATION_LABELS;
export interface RelationAccount { name: string; blacklist_description?: string; muted_list_description?: string }
export const isProfileRelation = (value: string | null): value is ProfileRelation =>
  !!value && Object.prototype.hasOwnProperty.call(RELATION_LABELS, value);

export async function getProfileRelations(account: string, type: ProfileRelation, start = ''): Promise<{ rows: RelationAccount[]; hasMore: boolean }> {
  if (type === 'followers' || type === 'following') {
    // Condenser cursors are inclusive. Request one extra row when continuing.
    const limit = start ? 101 : 100;
    const result = await hiveRpcCall<Array<{ follower: string; following: string }>>(
      `condenser_api.get_${type}`, [account, start, 'blog', limit]
    );
    return {
      rows: (result || []).map(row => ({ name: type === 'followers' ? row.follower : row.following })).filter(row => row.name !== start),
      hasMore: result?.length === limit
    };
  }
  const result = await hiveRpcCall<Array<RelationAccount | string>>('bridge.get_follow_list', { observer: account, follow_type: type });
  return { rows: (result || []).map(row => typeof row === 'string' ? { name: row } : row).filter(row => !!row.name), hasMore: false };
}

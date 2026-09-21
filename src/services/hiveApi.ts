/**
 * Pure client-side Hive Blockchain API client using native fetch and public JSON-RPC 2.0.
 * Zero heavy backend, zero database, zero ENV secrets.
 */

export interface HivePost {
  post_id: number;
  author: string;
  permlink: string;
  category: string;
  title: string;
  body: string;
  json_metadata: string | Record<string, any>;
  created: string;
  updated?: string;
  depth: number;
  children: number;
  net_rshares: number;
  is_paidout: boolean;
  payout: number;
  pending_payout_value: string;
  author_payout_value?: string;
  curator_payout_value?: string;
  promoted?: string;
  replies?: string[];
  author_reputation: number;
  stats?: {
    hide?: boolean;
    gray?: boolean;
    total_votes?: number;
    flag_weight?: number;
  };
  community?: string;
  community_title?: string;
  active_votes?: Array<{
    voter: string;
    rshares: number | string;
    percent: number;
    reputation?: number;
  }>;
  url?: string;
  beneficiaries?: Array<{
    account: string;
    weight: number;
  }>;
}

export interface HiveAccountProfile {
  name?: string;
  about?: string;
  location?: string;
  website?: string;
  profile_image?: string;
  cover_image?: string;
  pinned?: string;
}

export interface HiveAccount {
  id: number;
  name: string;
  created: string;
  reputation: number | string;
  balance: string; // e.g. "120.450 HIVE"
  hbd_balance: string; // e.g. "45.120 HBD"
  savings_balance: string;
  savings_hbd_balance: string;
  vesting_shares: string; // e.g. "123456.789000 VESTS"
  delegated_vesting_shares: string;
  received_vesting_shares: string;
  post_count: number;
  voting_power: number;
  last_vote_time: string;
  posting?: any;
  active?: any;
  owner?: any;
  memo_key?: string;
  json_metadata?: string;
  posting_json_metadata?: string;
  proxy?: string;
  witness_votes?: string[];
  reward_hive_balance?: string;
  reward_hbd_balance?: string;
  reward_vesting_balance?: string;
}

export interface HiveGlobalProps {
  head_block_number: number;
  time: string;
  current_witness: string;
  total_vesting_fund_hive: string;
  total_vesting_shares: string;
  current_supply: string;
  current_hbd_supply: string;
  hbd_interest_rate: number;
  hbd_print_rate: number;
}

export interface HiveCommunity {
  id: number;
  name: string;
  title: string;
  about: string;
  subscribers: number;
  num_pending: number;
  num_authors: number;
  is_nsfw: boolean;
  avatar_url?: string;
}

export const PUBLIC_HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://rpc.ecency.com',
  'https://api.openhive.network',
  'https://techcoderx.com'
];

let activeNode = PUBLIC_HIVE_NODES[0];

export function getActiveNode(): string {
  return activeNode;
}

export function setActiveNode(node: string) {
  if (PUBLIC_HIVE_NODES.includes(node)) {
    activeNode = node;
  }
}

/**
 * Make a direct JSON-RPC call to Hive blockchain node with automatic node failover.
 */
export async function hiveRpcCall<T = any>(
  method: string,
  params: any = {},
  nodeUrl: string = activeNode
): Promise<T> {
  const payload = {
    jsonrpc: '2.0',
    id: Math.floor(Math.random() * 1000000),
    method,
    params
  };

  try {
    const res = await fetch(nodeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    if (json.error) {
      throw new Error(json.error.message || 'Hive RPC returned error');
    }

    return json.result as T;
  } catch (err: any) {
    // Attempt fallback to secondary node if primary failed and wasn't manually specified
    if (nodeUrl === activeNode && PUBLIC_HIVE_NODES.length > 1) {
      const nextNode = PUBLIC_HIVE_NODES.find(n => n !== activeNode) || PUBLIC_HIVE_NODES[0];
      try {
        const fallbackRes = await fetch(nextNode, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (fallbackRes.ok) {
          const fallbackJson = await fallbackRes.json();
          if (!fallbackJson.error) {
            return fallbackJson.result as T;
          }
        }
      } catch {
        // Continue to rethrow original error
      }
    }
    throw err;
  }
}

/**
 * Measure latency of a given node in milliseconds
 */
export async function pingNode(url: string): Promise<number> {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'condenser_api.get_version',
        params: []
      })
    });
    if (res.ok) {
      return Math.round(performance.now() - start);
    }
    return -1;
  } catch {
    return -1;
  }
}

/**
 * Fetch ranked posts (trending, hot, created, payout, muted, promoted)
 */
export async function getRankedPosts(
  sort: 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted' = 'trending',
  tag: string = '',
  limit: number = 20,
  startAuthor?: string,
  startPermlink?: string,
  observer: string = ''
): Promise<HivePost[]> {
  const cleanTag = tag.trim().toLowerCase();
  const cleanObserver = observer.trim();

  // Constrói o objeto de parâmetros garantindo que 'observer' sempre esteja presente se fornecido
  const params: Record<string, any> = {
    sort,
    tag: cleanTag,
    limit
  };

  // Se houver observer (ex: "sm-silva"), ele DEVE ser incluído no payload
  if (cleanObserver) {
    params.observer = cleanObserver;
  }

  if (startAuthor && startPermlink) {
    params.start_author = startAuthor;
    params.start_permlink = startPermlink;
  }

  const result = await hiveRpcCall<HivePost[]>('bridge.get_ranked_posts', params);
  return result || [];
}

/**
 * Fetch full discussion (main post + comment tree)
 */
export async function getDiscussion(author: string, permlink: string): Promise<Record<string, HivePost>> {
  const result = await hiveRpcCall<Record<string, HivePost>>('bridge.get_discussion', {
    author,
    permlink
  });
  return result || {};
}

/**
 * Fetch detailed account info
 */
export async function getAccount(username: string): Promise<HiveAccount | null> {
  const cleaned = username.replace(/^@/, '').trim().toLowerCase();
  const result = await hiveRpcCall<HiveAccount[]>('condenser_api.get_accounts', [[cleaned]]);
  return result && result.length > 0 ? result[0] : null;
}

/**
 * Fetch bridge profile info (reputation, stats, bio, metadata)
 */
export async function getProfile(username: string): Promise<any> {
  const cleaned = username.replace(/^@/, '').trim().toLowerCase();
  try {
    return await hiveRpcCall('bridge.get_profile', { account: cleaned });
  } catch {
    return null;
  }
}

/**
 * Fetch posts created by a specific user
 */
export async function getAccountPosts(
  sort: 'posts' | 'blog' | 'comments' | 'replies' = 'posts',
  account: string,
  limit: number = 20
): Promise<HivePost[]> {
  const cleaned = account.replace(/^@/, '').trim().toLowerCase();
  try {
    const result = await hiveRpcCall<HivePost[]>('bridge.get_account_posts', {
      sort,
      account: cleaned,
      limit
    });
    return result || [];
  } catch {
    return [];
  }
}

/**
 * Fetch Dynamic Global Properties (for block stats, Hive Power calculation, supply)
 */
export async function getDynamicGlobalProperties(): Promise<HiveGlobalProps> {
  return await hiveRpcCall<HiveGlobalProps>('condenser_api.get_dynamic_global_properties', []);
}

/**
 * Fetch popular communities
 */
export async function listCommunities(
  sort: 'rank' | 'subs' | 'new' = 'rank',
  limit: number = 25
): Promise<HiveCommunity[]> {
  try {
    const result = await hiveRpcCall<HiveCommunity[]>('bridge.list_communities', {
      sort,
      limit,
      observer: ''
    });
    return result || [];
  } catch {
    return [];
  }
}

/**
 * Fetch recent account history
 */
export async function getAccountHistory(username: string, limit: number = 20): Promise<any[]> {
  const cleaned = username.replace(/^@/, '').trim().toLowerCase();
  try {
    const result = await hiveRpcCall<any[]>('condenser_api.get_account_history', [cleaned, -1, limit]);
    return result || [];
  } catch {
    return [];
  }
}

/**
 * Fetch accounts followed by a user
 */
export async function getFollowing(account: string, start: string = '', limit: number = 50): Promise<string[]> {
  const cleaned = account.replace(/^@/, '').trim().toLowerCase();
  try {
    const result = await hiveRpcCall<Array<{ following: string }>>(
      'condenser_api.get_following',
      [cleaned, start, 'blog', limit]
    );
    return (result || []).map(r => r.following);
  } catch {
    return [];
  }
}

/**
 * Fetch follow counts (followers and following)
 */
export async function getFollowCount(account: string): Promise<{ follower_count: number; following_count: number }> {
  const cleaned = account.replace(/^@/, '').trim().toLowerCase();
  try {
    const result = await hiveRpcCall('condenser_api.get_follow_count', [cleaned]);
    return result || { follower_count: 0, following_count: 0 };
  } catch {
    return { follower_count: 0, following_count: 0 };
  }
}

/**
 * Fetch list of trending topics/tags on Hive
 */
export async function getTrendingTags(limit: number = 30): Promise<Array<{ name: string; tag: string; total_payouts?: string }>> {
  try {
    const result = await hiveRpcCall<Array<{ name: string; total_payouts?: string }>>(
      'condenser_api.get_trending_tags',
      ['', limit]
    );
    return (result || [])
      .filter(t => t.name && !t.name.startsWith('hive-'))
      .map(t => ({ name: t.name, tag: t.name, total_payouts: t.total_payouts }));
  } catch {
    return [
      { name: 'photography', tag: 'photography' },
      { name: 'finance', tag: 'finance' },
      { name: 'crypto', tag: 'crypto' },
      { name: 'travel', tag: 'travel' },
      { name: 'art', tag: 'art' },
      { name: 'food', tag: 'food' },
      { name: 'hive', tag: 'hive' },
      { name: 'nature', tag: 'nature' },
      { name: 'gaming', tag: 'gaming' }
    ];
  }
}

/**
 * Fetch subscribed communities for a user
 */
export async function getSubscriptions(account: string): Promise<Array<[string, string, string, string]>> {
  const cleaned = account.replace(/^@/, '').trim().toLowerCase();
  try {
    const result = await hiveRpcCall<Array<[string, string, string, string]>>(
      'bridge.list_all_subscriptions',
      { account: cleaned }
    );
    return result || [];
  } catch {
    return [];
  }
}


/**
 * Calculate human-friendly Hive reputation score
 */
export function calculateReputation(rawRep: number | string | undefined): number {
  if (rawRep === undefined || rawRep === null) return 25;
  const rep = Number(rawRep);
  if (isNaN(rep) || rep === 0) return 25;
  const isNegative = rep < 0;
  let repLog = Math.log10(Math.abs(rep));
  if (isNaN(repLog)) return 25;
  repLog = Math.max(repLog - 9, 0);
  let finalRep = repLog * 9 + 25;
  if (isNegative) finalRep = 50 - finalRep;
  return Math.max(Math.floor(finalRep), 0);
}

/**
 * Convert VESTS to Hive Power (HP) using global dynamic properties
 */
export function vestsToHivePower(
  vestingSharesStr: string,
  totalVestsStr: string,
  totalFundHiveStr: string
): number {
  const vests = parseFloat(vestingSharesStr) || 0;
  const totalVests = parseFloat(totalVestsStr) || 1;
  const totalFundHive = parseFloat(totalFundHiveStr) || 1;
  return (vests / totalVests) * totalFundHive;
}

/**
 * Calculate actual real-time voting power percentage accounting for recharge time
 */
export function calculateVotingPower(vp: number, lastVoteTime: string): number {
  if (!lastVoteTime) return Math.round((vp || 0) / 100);
  const lastVoteSeconds = new Date(lastVoteTime + 'Z').getTime() / 1000;
  const nowSeconds = Date.now() / 1000;
  const elapsed = Math.max(0, nowSeconds - lastVoteSeconds);
  // Recharges 20% (2000 points) every 24 hours (86400 seconds)
  const regenerated = (elapsed * 2000) / 86400;
  const currentVP = Math.min(10000, vp + regenerated);
  return Math.round(currentVP / 100);
}

/**
 * Helper to get clean avatar URL via public Hive image proxy
 */
export function getHiveAvatarUrl(username: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
  const clean = (username || '').replace(/^@/, '').trim().toLowerCase();
  if (!clean) return 'https://images.ecency.com/u/hive/avatar/medium';
  return `https://images.ecency.com/u/${clean}/avatar/${size}`;
}

/**
 * Extract image URL from markdown or JSON metadata
 */
export function getPostThumbnail(post: HivePost): string | null {
  try {
    if (typeof post.json_metadata === 'string') {
      const meta = JSON.parse(post.json_metadata);
      if (meta.image && Array.isArray(meta.image) && meta.image[0]) {
        return meta.image[0];
      }
    } else if (post.json_metadata && typeof post.json_metadata === 'object') {
      if (post.json_metadata.image && Array.isArray(post.json_metadata.image) && post.json_metadata.image[0]) {
        return post.json_metadata.image[0];
      }
    }
  } catch {
    // Ignore JSON parsing errors
  }

  // Fallback: search regex for first markdown or html image in body
  const imgRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)|<img[^>]+src=["'](https?:\/\/[^"']+)["']/i;
  const match = post.body?.match(imgRegex);
  if (match) {
    return match[1] || match[2] || null;
  }

  return null;
}

/**
 * Strip markdown syntax to generate a clean preview excerpt
 */
export function getPostSnippet(body: string, maxLength: number = 180): string {
  if (!body) return '';
  const clean = body
    .replace(/!\[.*?\]\(.*?\)/g, '') // remove images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // link to text
    .replace(/<[^>]*>/g, '') // remove HTML tags
    .replace(/[#*`_~>-]/g, ' ') // remove markdown symbols
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength) + '...';
}

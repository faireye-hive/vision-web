/**
 * Pure client-side Hive Blockchain API client using native fetch and public JSON-RPC 2.0.
 * Zero heavy backend, zero database, zero ENV secrets.
 */
import { apiCache, CACHE_TTL, fetchWithCache } from './apiCache';

export { apiCache, CACHE_TTL };

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
  parent_author?: string;
  parent_permlink?: string;
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
  reblogged_by?: string[];
  first_reblogged_by?: string;
  reblog_entries?: Array<{ account: string; timestamp?: string }>;
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
 * Fetch ranked posts (trending, hot, created, payout, muted, promoted).
 * Automatically caches results except for 'created' (the "new" tab),
 * ensuring newly minted blockchain posts are always fetched live as requested.
 */
export async function getRankedPosts(
  sort: 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted' = 'trending',
  tag: string = '',
  limit: number = 20,
  startAuthor?: string,
  startPermlink?: string,
  observer: string = '',
  forceRefresh: boolean = false
): Promise<HivePost[]> {
  const cleanTag = tag.trim().toLowerCase();
  const cleanObserver = observer.trim();

  // Specifically respect user rule: "new" tab ('created' sort) bypasses cache to show live posts!
  const isNewTab = sort === 'created';
  const cacheKey = `ranked_posts:${sort}:${cleanTag}:${cleanObserver}:${limit}:${startAuthor || ''}:${startPermlink || ''}`;

  if (!isNewTab && !forceRefresh) {
    const cached = apiCache.get<HivePost[]>(cacheKey);
    if (cached) return cached;
  }

  const params: Record<string, any> = {
    sort,
    tag: cleanTag,
    limit
  };

  if (cleanObserver) {
    params.observer = cleanObserver;
  }

  if (startAuthor && startPermlink) {
    params.start_author = startAuthor;
    params.start_permlink = startPermlink;
  }

  const result = await hiveRpcCall<HivePost[]>('bridge.get_ranked_posts', params);
  const posts = result || [];

  // Cache only non-new feeds
  if (!isNewTab && posts.length > 0) {
    apiCache.set(cacheKey, posts, startAuthor ? CACHE_TTL.FEED_PAGE : CACHE_TTL.FEED);
  }

  return posts;
}

/**
 * Check if ranked posts exist in cache synchronously (for instant UI transitions)
 */
export function getCachedRankedPosts(
  sort: 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted' = 'trending',
  tag: string = '',
  limit: number = 20,
  startAuthor?: string,
  startPermlink?: string,
  observer: string = ''
): HivePost[] | null {
  if (sort === 'created') return null; // Never return cached for 'created' (new tab)
  const cleanTag = tag.trim().toLowerCase();
  const cleanObserver = observer.trim();
  const cacheKey = `ranked_posts:${sort}:${cleanTag}:${cleanObserver}:${limit}:${startAuthor || ''}:${startPermlink || ''}`;
  return apiCache.get<HivePost[]>(cacheKey);
}

/**
 * Fetch full discussion (main post + comment tree)
 */
export async function getDiscussion(
  author: string,
  permlink: string,
  forceRefresh: boolean = false
): Promise<Record<string, HivePost>> {
  const cleanAuthor = author.replace(/^@/, '').trim().toLowerCase();
  const cleanPermlink = permlink.trim();
  const cacheKey = `discussion:${cleanAuthor}:${cleanPermlink}`;

  return fetchWithCache(
    cacheKey,
    async () => {
      const result = await hiveRpcCall<Record<string, HivePost>>('bridge.get_discussion', {
        author: cleanAuthor,
        permlink: cleanPermlink
      });
      return result || {};
    },
    { ttl: CACHE_TTL.DISCUSSION, forceRefresh }
  );
}

/**
 * Invalidate a post's discussion cache (e.g. after commenting or voting)
 */
export function invalidateDiscussionCache(author: string, permlink: string): void {
  const cleanAuthor = author.replace(/^@/, '').trim().toLowerCase();
  const cleanPermlink = permlink.trim();
  apiCache.invalidate(`discussion:${cleanAuthor}:${cleanPermlink}`);
}

/**
 * Fetch a single post or comment by author and permlink
 */
export async function getPost(
  author: string,
  permlink: string,
  observer: string = '',
  forceRefresh: boolean = false
): Promise<HivePost | null> {
  const cleanAuthor = author.replace(/^@/, '').trim().toLowerCase();
  const cleanPermlink = permlink.trim();
  if (!cleanAuthor || !cleanPermlink) return null;
  const cacheKey = `post:${cleanAuthor}:${cleanPermlink}:${observer}`;

  return fetchWithCache(
    cacheKey,
    async () => {
      try {
        const result = await hiveRpcCall<HivePost>('bridge.get_post', {
          author: cleanAuthor,
          permlink: cleanPermlink,
          observer
        });
        if (result && result.author) return result;
        const fallback = await hiveRpcCall<HivePost>('condenser_api.get_content', [cleanAuthor, cleanPermlink]);
        return fallback && fallback.author ? fallback : null;
      } catch {
        return null;
      }
    },
    { ttl: CACHE_TTL.FEED, forceRefresh }
  );
}

/**
 * Fetch detailed account info
 */
export async function getAccount(username: string, forceRefresh: boolean = false): Promise<HiveAccount | null> {
  const cleaned = username.replace(/^@/, '').trim().toLowerCase();
  const cacheKey = `account:${cleaned}`;

  return fetchWithCache(
    cacheKey,
    async () => {
      const result = await hiveRpcCall<HiveAccount[]>('condenser_api.get_accounts', [[cleaned]]);
      return result && result.length > 0 ? result[0] : null;
    },
    { ttl: CACHE_TTL.ACCOUNT, forceRefresh }
  );
}

/**
 * Fetch bridge profile info (reputation, stats, bio, metadata)
 */
export async function getProfile(username: string, forceRefresh: boolean = false): Promise<any> {
  const cleaned = username.replace(/^@/, '').trim().toLowerCase();
  const cacheKey = `profile:${cleaned}`;

  return fetchWithCache(
    cacheKey,
    async () => {
      try {
        return await hiveRpcCall('bridge.get_profile', { account: cleaned });
      } catch {
        return null;
      }
    },
    { ttl: CACHE_TTL.ACCOUNT, forceRefresh }
  );
}

/**
 * Fetch posts created by a specific user
 */
export async function getAccountPosts(
  sort: 'posts' | 'blog' | 'comments' | 'replies' = 'posts',
  account: string,
  limit: number = 20,
  forceRefresh: boolean = false
): Promise<HivePost[]> {
  const cleaned = account.replace(/^@/, '').trim().toLowerCase();
  const cacheKey = `account_posts:${sort}:${cleaned}:${limit}`;

  return fetchWithCache(
    cacheKey,
    async () => {
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
    },
    { ttl: CACHE_TTL.FEED, forceRefresh }
  );
}

/**
 * Fetch Dynamic Global Properties (for block stats, Hive Power calculation, supply)
 */
export async function getDynamicGlobalProperties(forceRefresh: boolean = false): Promise<HiveGlobalProps> {
  return fetchWithCache(
    'dynamic_global_props',
    async () => {
      return await hiveRpcCall<HiveGlobalProps>('condenser_api.get_dynamic_global_properties', []);
    },
    { ttl: CACHE_TTL.FAST, forceRefresh }
  );
}

/**
 * Fetch popular communities
 */
export async function listCommunities(
  sort: 'rank' | 'subs' | 'new' = 'rank',
  limit: number = 25,
  forceRefresh: boolean = false
): Promise<HiveCommunity[]> {
  const cacheKey = `communities:${sort}:${limit}`;

  return fetchWithCache(
    cacheKey,
    async () => {
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
    },
    { ttl: CACHE_TTL.COMMUNITY, forceRefresh }
  );
}

/**
 * Fetch recent account history
 */
export async function getAccountHistory(username: string, limit: number = 20, forceRefresh: boolean = false): Promise<any[]> {
  const cleaned = username.replace(/^@/, '').trim().toLowerCase();
  const cacheKey = `account_history:${cleaned}:${limit}`;

  return fetchWithCache(
    cacheKey,
    async () => {
      try {
        const result = await hiveRpcCall<any[]>('condenser_api.get_account_history', [cleaned, -1, limit]);
        return result || [];
      } catch {
        return [];
      }
    },
    { ttl: CACHE_TTL.ACCOUNT, forceRefresh }
  );
}

/**
 * Fetch accounts followed by a user
 */
export async function getFollowing(account: string, start: string = '', limit: number = 50, forceRefresh: boolean = false): Promise<string[]> {
  const cleaned = account.replace(/^@/, '').trim().toLowerCase();
  const cacheKey = `following:${cleaned}:${start}:${limit}`;

  return fetchWithCache(
    cacheKey,
    async () => {
      try {
        const result = await hiveRpcCall<Array<{ following: string }>>(
          'condenser_api.get_following',
          [cleaned, start, 'blog', limit]
        );
        return (result || []).map(r => r.following);
      } catch {
        return [];
      }
    },
    { ttl: CACHE_TTL.ACCOUNT, forceRefresh }
  );
}

/**
 * Fetch follow counts (followers and following)
 */
export async function getFollowCount(account: string, forceRefresh: boolean = false): Promise<{ follower_count: number; following_count: number }> {
  const cleaned = account.replace(/^@/, '').trim().toLowerCase();
  const cacheKey = `follow_count:${cleaned}`;

  return fetchWithCache(
    cacheKey,
    async () => {
      try {
        const result = await hiveRpcCall('condenser_api.get_follow_count', [cleaned]);
        return result || { follower_count: 0, following_count: 0 };
      } catch {
        return { follower_count: 0, following_count: 0 };
      }
    },
    { ttl: CACHE_TTL.ACCOUNT, forceRefresh }
  );
}

/**
 * Fetch list of trending topics/tags on Hive
 */
export async function getTrendingTags(limit: number = 30, forceRefresh: boolean = false): Promise<Array<{ name: string; tag: string; total_payouts?: string }>> {
  const cacheKey = `trending_tags:${limit}`;

  return fetchWithCache(
    cacheKey,
    async () => {
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
    },
    { ttl: CACHE_TTL.TRENDING_TAGS, forceRefresh }
  );
}

/**
 * Fetch subscribed communities for a user
 */
export async function getSubscriptions(account: string, forceRefresh: boolean = false): Promise<Array<[string, string, string, string]>> {
  const cleaned = account.replace(/^@/, '').trim().toLowerCase();
  const cacheKey = `subscriptions:${cleaned}`;

  return fetchWithCache(
    cacheKey,
    async () => {
      try {
        const result = await hiveRpcCall<Array<[string, string, string, string]>>(
          'bridge.list_all_subscriptions',
          { account: cleaned }
        );
        return result || [];
      } catch {
        return [];
      }
    },
    { ttl: CACHE_TTL.ACCOUNT, forceRefresh }
  );
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

/**
 * Discovers accounts followed by the user that were active (posted or commented) within the last 7 days.
 * Efficiently batches account lookups in chunks of 15 using condenser_api.get_accounts as requested,
 * avoiding unnecessary RPC load and caching the active set.
 */
export async function getFollowedActiveAccounts(
  observer: string,
  forceRefresh: boolean = false
): Promise<string[]> {
  const cleanObserver = observer.replace(/^@/, '').trim().toLowerCase();
  if (!cleanObserver) return [];

  const cacheKey = `followed_active_accounts:${cleanObserver}`;
  if (!forceRefresh) {
    const cached = apiCache.get<string[]>(cacheKey);
    if (cached) return cached;
  }

  try {
    // 1. Fetch up to 100 accounts followed by user
    const following = await getFollowing(cleanObserver, '', 100, forceRefresh);
    if (!following || following.length === 0) return [];

    // 2. Batch in chunks of 15 accounts as specified by user
    const chunkSize = 15;
    const chunks: string[][] = [];
    for (let i = 0; i < following.length; i += chunkSize) {
      chunks.push(following.slice(i, i + chunkSize));
    }

    const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const activeWithTimestamp: { name: string; lastPostTime: number }[] = [];

    // Process chunks concurrently (up to 3 in flight)
    for (let i = 0; i < chunks.length; i += 3) {
      const slice = chunks.slice(i, i + 3);
      const results = await Promise.all(
        slice.map(async (chunk) => {
          try {
            return await hiveRpcCall<Array<{ name: string; last_post?: string }>>(
              'condenser_api.get_accounts',
              [chunk]
            );
          } catch {
            return [];
          }
        })
      );

      for (const accounts of results) {
        for (const acc of accounts || []) {
          if (acc.last_post && acc.last_post !== '1970-01-01T00:00:00') {
            const time = new Date(acc.last_post.endsWith('Z') ? acc.last_post : acc.last_post + 'Z').getTime();
            if (!isNaN(time) && time > sevenDaysAgoMs) {
              activeWithTimestamp.push({ name: acc.name, lastPostTime: time });
            }
          }
        }
      }
    }

    // Sort by recent activity descending
    activeWithTimestamp.sort((a, b) => b.lastPostTime - a.lastPostTime);
    const activeUsernames = activeWithTimestamp.map(u => u.name);

    // Cache active accounts list for 10 minutes
    apiCache.set(cacheKey, activeUsernames, CACHE_TTL.FEED);
    return activeUsernames;
  } catch (err) {
    console.error('Error fetching followed active accounts:', err);
    return [];
  }
}

/**
 * Fetches recent comments and replies made by accounts followed by the user.
 * Merges and sorts chronologically, capping at 45 items to prevent DOM/memory bloat.
 */
export async function getFollowedCommentsFeed(
  observer: string,
  forceRefresh: boolean = false,
  limit: number = 45,
  maxAgeDays: number = 7
): Promise<HivePost[]> {
  const cleanObserver = observer.replace(/^@/, '').trim().toLowerCase();
  if (!cleanObserver) return [];

  const cacheKey = `followed_comments_feed:${cleanObserver}:${limit}:${maxAgeDays}`;
  if (!forceRefresh) {
    const cached = apiCache.get<HivePost[]>(cacheKey);
    if (cached) return cached;
  }

  const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  try {
    const activeUsers = await getFollowedActiveAccounts(cleanObserver, false);
    if (!activeUsers || activeUsers.length === 0) return [];

    const targetUsers = activeUsers.slice(0, Math.min(activeUsers.length, Math.ceil(limit / 3) + 5));
    const perUserLimit = Math.min(20, Math.max(5, Math.ceil(limit / targetUsers.length) + 2));

    const commentsList: HivePost[] = [];
    const batchSize = 4;
    for (let i = 0; i < targetUsers.length; i += batchSize) {
      const batch = targetUsers.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(user =>
          getAccountPosts('comments', user, perUserLimit, forceRefresh).catch(() => [] as HivePost[])
        )
      );

      for (const userComments of batchResults) {
        for (const item of userComments || []) {
          if (!item || !item.body || !item.body.trim()) continue;

          // 🔑 filtro real de idade — não confiar só no "conta ativa"
          const t = new Date(item.created.endsWith('Z') ? item.created : item.created + 'Z').getTime();
          if (isNaN(t) || t < cutoffMs) continue;

          commentsList.push(item);
        }
      }
    }

    const seen = new Set<string>();
    const uniqueComments: HivePost[] = [];
    for (const c of commentsList) {
      const key = `${c.author}/${c.permlink}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueComments.push(c);
      }
    }

    uniqueComments.sort((a, b) => {
      const timeA = new Date(a.created.endsWith('Z') ? a.created : a.created + 'Z').getTime();
      const timeB = new Date(b.created.endsWith('Z') ? b.created : b.created + 'Z').getTime();
      return timeB - timeA;
    });

    const finalComments = uniqueComments.slice(0, limit);
    apiCache.set(cacheKey, finalComments, CACHE_TTL.FEED);
    return finalComments;
  } catch (err) {
    console.error('Error fetching followed comments feed:', err);
    return [];
  }
}

/**
 * Checks if a post is a reblog (resteem)
 */
export function isReblogPost(post: HivePost): boolean {
  if (post.reblogged_by && post.reblogged_by.length > 0) return true;
  if (post.first_reblogged_by && post.first_reblogged_by.trim().length > 0) return true;
  if (post.reblog_entries && post.reblog_entries.length > 0) return true;
  return false;
}

/**
 * Extracts the username who reblogged the post
 */
export function getRebloggedBy(post: HivePost): string | null {
  if (post.reblogged_by && post.reblogged_by.length > 0) {
    return post.reblogged_by[0];
  }
  if (post.first_reblogged_by && post.first_reblogged_by.trim().length > 0) {
    return post.first_reblogged_by.trim();
  }
  if (post.reblog_entries && post.reblog_entries.length > 0) {
    return post.reblog_entries[0].account;
  }
  return null;
}

/**
 * Fetches root publications and reblogs from accounts followed by the user.
 * Uses native condenser_api.get_discussions_by_feed with graceful fallback to active accounts' posts.
 */
export async function getFollowedRootFeed(
  observer: string,
  limit: number = 20,
  forceRefresh: boolean = false,
  startAuthor?: string,
  startPermlink?: string
): Promise<HivePost[]> {
  const cleanObserver = observer.replace(/^@/, '').trim().toLowerCase();
  if (!cleanObserver) return [];

  const safeLimit = Math.min(Math.max(limit, 1), 20); // Hivemind hard-caps em 20
  const cacheKey = `followed_root_feed:${cleanObserver}:${safeLimit}:${startAuthor || ''}:${startPermlink || ''}`;
  if (!forceRefresh) {
    const cached = apiCache.get<HivePost[]>(cacheKey);
    if (cached) return cached;
  }

  try {
    const params: Record<string, any> = {
      sort: 'feed',
      account: cleanObserver,
      limit: safeLimit
    };
    if (startAuthor && startPermlink) {
      params.start_author = startAuthor;
      params.start_permlink = startPermlink;
    }

    const rawFeed = await hiveRpcCall<any[]>('bridge.get_account_posts', params);

    if (Array.isArray(rawFeed) && rawFeed.length > 0) {
      const normalized: HivePost[] = rawFeed.map((p) => {
        const rebloggedBy: string[] = Array.isArray(p.reblogged_by) && p.reblogged_by.length > 0
          ? p.reblogged_by
          : (p.first_reblogged_by ? [p.first_reblogged_by] : []);

        const pendingPayout = parseFloat(p.pending_payout_value || '0');
        const totalPayout = parseFloat(p.total_payout_value || '0');
        const curatorPayout = parseFloat(p.curator_payout_value || '0');

        return {
          post_id: Number(p.post_id || p.id || 0),
          author: p.author,
          permlink: p.permlink,
          category: p.category || '',
          title: p.title || '',
          body: p.body || '',
          json_metadata: p.json_metadata || '{}',
          created: p.created || '',
          updated: p.last_update || p.updated,
          parent_author: p.parent_author || '',
          parent_permlink: p.parent_permlink || '',
          depth: Number(p.depth || 0),
          children: Number(p.children || 0),
          net_rshares: Number(p.net_rshares || 0),
          is_paidout: Boolean(p.is_paidout),
          payout: pendingPayout + totalPayout + curatorPayout,
          pending_payout_value: p.pending_payout_value || '0.000 HBD',
          author_reputation: typeof p.author_reputation === 'string' ? parseInt(p.author_reputation, 10) : (p.author_reputation || 0),
          community: p.community || p.category,
          community_title: p.community_title,
          active_votes: p.active_votes || [],
          reblogged_by: rebloggedBy,
          first_reblogged_by: p.first_reblogged_by || (rebloggedBy.length > 0 ? rebloggedBy[0] : undefined),
          reblog_entries: p.reblog_entries
        };
      });

      // Não cacheia páginas com cursor por muito tempo; a primeira página (sem cursor) pode ter TTL maior
      apiCache.set(cacheKey, normalized, startAuthor ? CACHE_TTL.FEED_PAGE : CACHE_TTL.FEED);
      return normalized;
    }
    return [];
  } catch (err) {
    console.warn('bridge.get_account_posts (feed) failed, trying fallback:', err);
  }

  // Fallback continua igual (usa getFollowedActiveAccounts)
  try {
    const activeUsers = await getFollowedActiveAccounts(cleanObserver, false);
    if (!activeUsers || activeUsers.length === 0) return [];

    const targetUsers = activeUsers.slice(0, 10);
    const postArrays = await Promise.all(
      targetUsers.map(user =>
        getAccountPosts('posts', user, 4, forceRefresh).catch(() => [] as HivePost[])
      )
    );

    const merged = postArrays.flat();
    const seen = new Set<string>();
    const uniquePosts: HivePost[] = [];
    for (const p of merged) {
      const key = `${p.author}/${p.permlink}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniquePosts.push(p);
      }
    }

    uniquePosts.sort((a, b) => {
      const timeA = new Date(a.created.endsWith('Z') ? a.created : a.created + 'Z').getTime();
      const timeB = new Date(b.created.endsWith('Z') ? b.created : b.created + 'Z').getTime();
      return timeB - timeA;
    });

    const finalPosts = uniquePosts.slice(0, safeLimit);
    apiCache.set(cacheKey, finalPosts, CACHE_TTL.FEED);
    return finalPosts;
  } catch (fallbackErr) {
    console.error('Error fetching fallback followed root feed:', fallbackErr);
    return [];
  }
}

/**
 * Fetches a merged feed combining both root stories and comments/replies from followed accounts.
 * Interleaved and sorted chronologically with strict memory capping.
 */
export async function getFollowedMixedFeed(
  observer: string,
  forceRefresh: boolean = false,
  limit: number = 45,
  maxAgeDays: number = 7
): Promise<HivePost[]> {
  const cleanObserver = observer.replace(/^@/, '').trim().toLowerCase();
  if (!cleanObserver) return [];

  const cacheKey = `followed_mixed_feed:${cleanObserver}:${limit}:${maxAgeDays}`;
  if (!forceRefresh) {
    const cached = apiCache.get<HivePost[]>(cacheKey);
    if (cached) return cached;
  }

  const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  try {
    // Concurrently fetch root posts (feed sort / fallback active-creator posts) and followed comments
    const [rootPosts, comments] = await Promise.all([
      getFollowedRootFeed(cleanObserver, Math.min(20, limit), forceRefresh).catch(() => [] as HivePost[]),
      getFollowedCommentsFeed(cleanObserver, forceRefresh, limit, maxAgeDays).catch(() => [] as HivePost[])
    ]);

    // Merge, dedupe, and enforce the real age cutoff on BOTH sources
    // (comments already respect maxAgeDays internally, but root posts — especially
    // from getFollowedRootFeed's fallback path — are not date-limited, so we filter here too)
    const seen = new Set<string>();
    const merged: HivePost[] = [];
    for (const item of [...rootPosts, ...comments]) {
      const key = `${item.author}/${item.permlink}`;
      if (seen.has(key)) continue;

      const t = new Date(item.created.endsWith('Z') ? item.created : item.created + 'Z').getTime();
      if (isNaN(t) || t < cutoffMs) continue;

      seen.add(key);
      merged.push(item);
    }

    // Sort chronologically descending
    merged.sort((a, b) => {
      const timeA = new Date(a.created.endsWith('Z') ? a.created : a.created + 'Z').getTime();
      const timeB = new Date(b.created.endsWith('Z') ? b.created : b.created + 'Z').getTime();
      return timeB - timeA;
    });

    // Memory guard: limit final result size
    const finalMixed = merged.slice(0, limit);
    apiCache.set(cacheKey, finalMixed, CACHE_TTL.FEED);
    return finalMixed;
  } catch (err) {
    console.error('Error fetching followed mixed feed:', err);
    return [];
  }
}

/**
 * Fetches similar posts recommendations from HiveSense AI API
 * https://api.hive.blog/hivesense-api/posts/{author}/{permlink}/similar?truncate=200&result_limit=1&full_posts=5&observer=hive.blog
 * Lightweight, non-blocking with AbortSignal and memory-capped.
 */
export async function getSimilarPosts(
  author: string,
  permlink: string,
  signal?: AbortSignal
): Promise<HivePost[]> {
  const cleanAuthor = (author || '').replace(/^@/, '').trim();
  const cleanPermlink = (permlink || '').trim();
  if (!cleanAuthor || !cleanPermlink) return [];

  const cacheKey = `similar_posts:${cleanAuthor}/${cleanPermlink}`;
  const cached = apiCache.get<HivePost[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://api.hive.blog/hivesense-api/posts/${encodeURIComponent(cleanAuthor)}/${encodeURIComponent(cleanPermlink)}/similar?truncate=200&result_limit=5&full_posts=5&observer=hive.blog`;
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    // Memory guard: map only required properties and take max 4 posts to preserve browser resources
    const similar: HivePost[] = data.slice(0, 4).map((item: any) => ({
      post_id: item.post_id || item.id || 0,
      author: item.author || '',
      permlink: item.permlink || '',
      category: item.category || '',
      title: item.title || '',
      body: item.body ? item.body.slice(0, 200) : '',
      json_metadata: item.json_metadata || '',
      created: item.created || '',
      payout: typeof item.payout === 'number' ? item.payout : 0,
      pending_payout_value: item.pending_payout_value || '$0.000',
      active_votes: item.active_votes || [],
      author_reputation: item.author_reputation,
      community: item.community,
      community_title: item.community_title,
      depth: 0,
      children: item.children || 0,
      net_rshares: item.net_rshares || 0,
      is_paidout: Boolean(item.is_paidout)
    }));

    apiCache.set(cacheKey, similar, 10 * 60 * 1000); // 10 min cache
    return similar;
  } catch (err: any) {
    if (err?.name === 'AbortError') return [];
    return [];
  }
}


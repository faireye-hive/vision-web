/**
 * Pure client-side Hive Blockchain API client using native fetch and public JSON-RPC 2.0.
 * Zero heavy backend, zero database, zero ENV secrets.
 */
import { apiCache, CACHE_TTL, fetchWithCache } from './apiCache';
import { getSafeImageUrl } from '../utils/sanitize';
import { getSmartAccountsActivity, noteAccountActivity } from './accountsCache';

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
  root_author?: string;
  root_permlink?: string;
  root_title?: string;
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
  is_truncated?: boolean;
  from_recommendation?: boolean;
  recommendation_score?: number;
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
  last_post?: string;
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

export interface HiveNotification {
  id: string;
  msg: string;
  url: string;
  date: string;
  type: string;
  score?: number;
}

export interface FollowedCreatorInfo {
  username: string;
  lastPostDate?: string;
  lastPostTimestamp?: number;
  isInactive6Months: boolean;
  reputation?: number;
  postCount?: number;
  createdDate?: string;
  name?: string;
  about?: string;
  avatarUrl?: string;
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
  lang?: string;
  subscribers: number;
  num_pending: number;
  num_authors: number;
  is_nsfw: boolean;
  avatar_url?: string;
  created_at?: string;
  description?: string;
  flag_text?: string;
  team?: [string, string, string][];
  sum_pending?: number;
  context?: {
    role?: string;
    subscribed?: boolean;
  };
}

export const DEFAULT_HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://rpc.ecency.com',
  'https://api.openhive.network',
  'https://techcoderx.com',
  'https://hive-api.arcange.eu',
  'https://rpc.ausbit.dev'
];

export const STORAGE_KEY_CUSTOM_NODES = 'nebulosa_custom_rpc_nodes';
export const STORAGE_KEY_ACTIVE_NODE = 'nebulosa_active_rpc_node';

export function getCustomHiveNodes(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_NODES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((n): n is string => typeof n === 'string' && (n.startsWith('https://') || n.startsWith('http://')))
      : [];
  } catch {
    return [];
  }
}

export function getAllHiveNodes(): string[] {
  const custom = getCustomHiveNodes();
  const all = [...DEFAULT_HIVE_NODES];
  for (const c of custom) {
    if (!all.includes(c)) {
      all.push(c);
    }
  }
  return all;
}

// Kept for backward compatibility with existing code
export const PUBLIC_HIVE_NODES = DEFAULT_HIVE_NODES;

// Initialize activeNode from cache if valid
let activeNode = (() => {
  if (typeof window === 'undefined') return DEFAULT_HIVE_NODES[0];
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_NODE);
    if (saved && typeof saved === 'string') {
      const all = getAllHiveNodes();
      if (all.includes(saved)) return saved;
    }
  } catch {}
  return DEFAULT_HIVE_NODES[0];
})();

export function getActiveNode(): string {
  return activeNode;
}

export function setActiveNode(node: string) {
  const all = getAllHiveNodes();
  if (all.includes(node)) {
    activeNode = node;
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_NODE, node);
    } catch {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nebulosa:node_changed', { detail: { activeNode: node } }));
    }
  }
}

export function addCustomHiveNode(nodeUrl: string): { success: boolean; error?: string } {
  const trimmed = nodeUrl.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return { success: false, error: 'RPC node URL cannot be empty.' };
  }
  if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) {
    return { success: false, error: 'RPC node URL must start with https:// or http://' };
  }
  try {
    new URL(trimmed);
  } catch {
    return { success: false, error: 'Invalid URL format.' };
  }

  const all = getAllHiveNodes();
  if (all.includes(trimmed)) {
    return { success: false, error: 'This RPC node is already in your node list.' };
  }

  const currentCustom = getCustomHiveNodes();
  const updatedCustom = [...currentCustom, trimmed];
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_NODES, JSON.stringify(updatedCustom));
    // Auto-select the newly added node
    setActiveNode(trimmed);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to save node to storage.' };
  }
}

export function removeCustomHiveNode(nodeUrl: string): void {
  const currentCustom = getCustomHiveNodes();
  const updatedCustom = currentCustom.filter((n) => n !== nodeUrl);
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_NODES, JSON.stringify(updatedCustom));
  } catch {}

  // If the active node was removed, fallback to the default node
  if (activeNode === nodeUrl) {
    setActiveNode(DEFAULT_HIVE_NODES[0]);
  } else if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nebulosa:node_changed', { detail: { activeNode } }));
  }
}

export function resetHiveNodesToDefault(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_CUSTOM_NODES);
    localStorage.removeItem(STORAGE_KEY_ACTIVE_NODE);
  } catch {}
  activeNode = DEFAULT_HIVE_NODES[0];
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nebulosa:node_changed', { detail: { activeNode } }));
  }
}

/**
 * Make a direct JSON-RPC call to Hive blockchain node with automatic multi-node failover and request timeout.
 */
async function performHiveRpcCall<T = any>(
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

  const allNodes = getAllHiveNodes();
  // Candidate sequence: preferred node first, then other available nodes in order
  const candidateNodes = [
    nodeUrl,
    ...allNodes.filter(n => n !== nodeUrl)
  ];

  let lastError: any = null;

  // Try up to 4 distinct nodes before giving up
  const maxAttempts = Math.min(candidateNodes.length, 4);

  for (let i = 0; i < maxAttempts; i++) {
    const currentNode = candidateNodes[i];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(currentNode, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      if (json.error) {
        throw new Error(json.error.message || 'Hive RPC returned error');
      }

      // If we recovered using a different node and this was using default activeNode,
      // update activeNode so the app auto-heals and future calls stay fast
      if (currentNode !== activeNode && nodeUrl === activeNode) {
        console.warn(`[HiveRPC] Auto-healed: switched active node from ${activeNode} to ${currentNode}`);
        setActiveNode(currentNode);
      }

      return json.result as T;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      // If caller explicitly targeted a specific non-active nodeUrl and not activeNode, don't failover
      if (nodeUrl !== activeNode && i === 0) {
        throw err;
      }
      // Otherwise log and fail over to the next node
      console.warn(`[HiveRPC] Node ${currentNode} failed for ${method} (${err?.message || err}). Trying fallback...`);
    }
  }

  throw lastError || new Error(`All Hive RPC nodes failed to respond for ${method}`);
}

const pendingRpcCalls = new Map<string, Promise<unknown>>();

/**
 * JSON-RPC with in-flight dedup. React StrictMode and several cards asking for
 * the same account/post otherwise fire the same request twice.
 */
export async function hiveRpcCall<T = any>(
  method: string,
  params: any = {},
  nodeUrl: string = activeNode
): Promise<T> {
  const key = `${nodeUrl}\n${method}\n${JSON.stringify(params ?? {})}`;
  const existing = pendingRpcCalls.get(key);
  if (existing) return existing as Promise<T>;

  const promise = performHiveRpcCall<T>(method, params, nodeUrl);
  pendingRpcCalls.set(key, promise);
  promise.finally(() => {
    if (pendingRpcCalls.get(key) === promise) {
      pendingRpcCalls.delete(key);
    }
  });
  return promise;
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
 * Fetch the full discussion (root post + flattened comment tree).
 *
 * The `observer` argument is kept so existing call sites compile, but it is
 * not sent. Hivemind's `bridge.get_discussion` joins the observer's mute and
 * blacklist lists inside the recursive query. For some accounts that join
 * returns an empty thread or errors, even though the same post loads with
 * no observer. The in-app mute list (`contentFilter`) is separate and still
 * applies on the client.
 */
export async function getDiscussion(
  author: string,
  permlink: string,
  forceRefresh: boolean = false,
  _observer: string = ''
): Promise<Record<string, HivePost>> {
  const cleanAuthor = author.replace(/^@/, '').trim().toLowerCase();
  const cleanPermlink = permlink.trim();
  const cacheKey = `discussion:${cleanAuthor}:${cleanPermlink}`;

  return fetchWithCache(
    cacheKey,
    async () => {
      try {
        const result = await hiveRpcCall<Record<string, HivePost>>('bridge.get_discussion', {
          author: cleanAuthor,
          permlink: cleanPermlink
        });
        return result || {};
      } catch (err) {
        console.warn(`[getDiscussion] Error fetching discussion for ${cleanAuthor}/${cleanPermlink}:`, err);
        return {};
      }
    },
    { ttl: CACHE_TTL.DISCUSSION, forceRefresh }
  );
}

/**
 * Invalidate a post's discussion cache (e.g. after commenting or voting).
 * Also drops legacy keys that used to include the observer name.
 */
export function invalidateDiscussionCache(author: string, permlink: string, _observer: string = ''): void {
  const cleanAuthor = author.replace(/^@/, '').trim().toLowerCase();
  const cleanPermlink = permlink.trim();
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  apiCache.invalidatePattern(
    new RegExp(`^discussion:${escapeRegExp(cleanAuthor)}:${escapeRegExp(cleanPermlink)}(?::|$)`)
  );
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
// Objeto em memória para evitar chamadas duplicadas simultâneas (In-Flight Requests)
const pendingAccountRequests = new Map<string, Promise<HiveAccount | null>>();

export async function getAccount(username: string, forceRefresh: boolean = false): Promise<HiveAccount | null> {
  const cleaned = username.replace(/^@/, '').trim().toLowerCase();
  if (!cleaned) return null;
  
  const cacheKey = `account:${cleaned}`;

  // 1. Verifica cache local primeiro
  if (!forceRefresh) {
    const cached = apiCache.get<HiveAccount>(cacheKey);
    if (cached) return cached;
  }

  // 2. Se já existe uma requisição em andamento para essa mesma conta, reaproveita a Promise
  if (pendingAccountRequests.has(cleaned)) {
    return pendingAccountRequests.get(cleaned)!;
  }

  // 3. Cria a nova requisição
  const requestPromise = fetchWithCache(
    cacheKey,
    async () => {
      const result = await hiveRpcCall<HiveAccount[]>('condenser_api.get_accounts', [[cleaned]]);
      return result && result.length > 0 ? result[0] : null;
    },
    { ttl: CACHE_TTL.ACCOUNT, forceRefresh }
  ).finally(() => {
    // Limpa a fila quando for resolvida
    pendingAccountRequests.delete(cleaned);
  });

  pendingAccountRequests.set(cleaned, requestPromise);
  return requestPromise;
}

/**
 * Busca detalhes de múltiplos usuários em lote, ignorando os que já estão no cache.
 */
export async function getAccountsBatch(usernames: string[]): Promise<HiveAccount[]> {
  // Limpa e remove duplicados da lista
  const uniqueNames = Array.from(new Set(usernames.map(u => u.replace(/^@/, '').trim().toLowerCase()))).filter(Boolean);
  
  const results: HiveAccount[] = [];
  const missingFromCache: string[] = [];

  // 1. Resgata do cache o que já existir
  for (const name of uniqueNames) {
    const cached = apiCache.get<HiveAccount>(`account:${name}`);
    if (cached) {
      results.push(cached);
    } else {
      missingFromCache.push(name);
    }
  }

  if (missingFromCache.length === 0) {
    return results;
  }

  // 2. Para as contas que realmente faltam, dispara em blocos
  const chunkSize = 15;
  for (let i = 0; i < missingFromCache.length; i += chunkSize) {
    const chunk = missingFromCache.slice(i, i + chunkSize);
    try {
      const fetched = await hiveRpcCall<HiveAccount[]>('condenser_api.get_accounts', [chunk]);
      if (Array.isArray(fetched)) {
        for (const acc of fetched) {
          apiCache.set(`account:${acc.name}`, acc, CACHE_TTL.ACCOUNT);
          results.push(acc);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar bloco de contas:', err);
    }
  }

  return results;
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
  forceRefresh: boolean = false,
  startAuthor?: string,
  startPermlink?: string
): Promise<HivePost[]> {
  const cleaned = account.replace(/^@/, '').trim().toLowerCase();

  const fetchPage = async () => {
    try {
      const payload: Record<string, unknown> = {
        sort,
        account: cleaned,
        limit
      };
      if (startAuthor && startPermlink) {
        payload.start_author = startAuthor;
        payload.start_permlink = startPermlink;
      }
      const result = await hiveRpcCall<HivePost[]>('bridge.get_account_posts', payload);
      return result || [];
    } catch {
      return [];
    }
  };

  if (startPermlink) {
    return fetchPage();
  }

  const cacheKey = `account_posts:${sort}:${cleaned}:${limit}`;
  return fetchWithCache(cacheKey, fetchPage, { ttl: CACHE_TTL.FEED, forceRefresh });
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
  forceRefresh: boolean = false,
  last: string = '',
  query: string = ''
): Promise<HiveCommunity[]> {
  const cacheKey = `communities:${sort}:${limit}:${last}:${query}`;

  return fetchWithCache(
    cacheKey,
    async () => {
      try {
        const result = await hiveRpcCall<HiveCommunity[]>('bridge.list_communities', {
          sort,
          limit,
          last,
          query: query || undefined,
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
 * Fetch one community by account name (hive-xxxxx).
 */
export async function getCommunity(name: string, forceRefresh: boolean = false): Promise<HiveCommunity | null> {
  const cleaned = name.trim().toLowerCase();
  if (!cleaned) return null;

  return fetchWithCache(
    `community:${cleaned}`,
    async () => {
      try {
        const result = await hiveRpcCall<HiveCommunity | null>('bridge.get_community', {
          name: cleaned,
          observer: ''
        });
        return result && result.name ? result : null;
      } catch {
        return null;
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
 * Accounts this user muted on chain.
 * bridge.get_follow_list with follow_type "muted".
 * The public nodes reject extra keys such as limit, and return the full list.
 */
export async function getMutedAccounts(observer: string, forceRefresh: boolean = false): Promise<string[]> {
  const cleaned = observer.replace(/^@/, '').trim().toLowerCase();
  if (!cleaned) return [];
  const cacheKey = `muted_list:${cleaned}`;

  return fetchWithCache(
    cacheKey,
    async () => {
      try {
        const result = await hiveRpcCall<Array<{ name?: string } | string>>('bridge.get_follow_list', {
          observer: cleaned,
          follow_type: 'muted'
        });
        return (result || [])
          .map((row) => (typeof row === 'string' ? row : row?.name || ''))
          .map((name) => name.replace(/^@/, '').trim().toLowerCase())
          .filter(Boolean);
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
 * Fetch account notifications with pagination via last_id
 */
export async function getAccountNotifications(
  account: string,
  limit: number = 50,
  lastId?: string
): Promise<HiveNotification[]> {
  const cleaned = account.replace(/^@/, '').trim().toLowerCase();
  if (!cleaned) return [];

  try {
    const params: { account: string; limit: number; last_id?: string } = {
      account: cleaned,
      limit
    };
    if (lastId) {
      params.last_id = lastId;
    }
    const result = await hiveRpcCall<HiveNotification[]>('bridge.account_notifications', params);
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

/**
 * Fetch account mentions notifications from Hivemind
 */
export async function getAccountMentions(
  account: string,
  limit: number = 50
): Promise<HiveNotification[]> {
  const cleaned = account.replace(/^@/, '').trim().toLowerCase();
  if (!cleaned) return [];

  try {
    const notifications = await getAccountNotifications(cleaned, limit);
    return (notifications || []).filter((item) => {
      if (!item) return false;
      if (item.type === 'mention' || item.type?.toLowerCase().includes('mention')) return true;
      if (item.msg && (item.msg.toLowerCase().includes('mentioned you') || item.msg.includes(`@${cleaned}`))) {
        return true;
      }
      return false;
    });
  } catch {
    return [];
  }
}

/**
 * Fetch all accounts followed by a user along with their activity / last post status
 */
export async function getAllFollowingWithDetails(
  account: string,
  maxAccounts: number = 1000
): Promise<FollowedCreatorInfo[]> {
  const cleaned = account.replace(/^@/, '').trim().toLowerCase();
  if (!cleaned) return [];

  const allUsernames: string[] = [];
  let currentStart = '';
  let hasMore = true;

  while (hasMore && allUsernames.length < maxAccounts) {
    const batchLimit = 100;
    try {
      const result = await hiveRpcCall<Array<{ following: string }>>(
        'condenser_api.get_following',
        [cleaned, currentStart, 'blog', batchLimit]
      );
      if (!result || result.length === 0) {
        break;
      }

      const users = result.map(r => r.following);
      // If we provided currentStart, the first element is currentStart itself
      const newUsers = currentStart ? users.slice(1) : users;

      if (newUsers.length === 0) {
        break;
      }

      for (const u of newUsers) {
        if (!allUsernames.includes(u)) {
          allUsernames.push(u);
        }
      }

      if (users.length < batchLimit) {
        hasMore = false;
      } else {
        currentStart = users[users.length - 1];
      }
    } catch {
      break;
    }
  }

  // Now fetch account data in chunks of 50 to get last_post, reputation, profile
  const detailsMap: Record<string, FollowedCreatorInfo> = {};
  const chunkSize = 50;
  const now = Date.now();
  const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;

  for (let i = 0; i < allUsernames.length; i += chunkSize) {
    const chunk = allUsernames.slice(i, i + chunkSize);
    try {
      const accounts = await hiveRpcCall<Array<HiveAccount & { last_post?: string }>>(
        'condenser_api.get_accounts',
        [chunk]
      );
      for (const acc of accounts || []) {
        let lastPostTimestamp: number | undefined;
        let lastPostDate: string | undefined;
        let isInactive6Months = true;

        if (acc.last_post && acc.last_post !== '1970-01-01T00:00:00') {
          const safeStr = acc.last_post.endsWith('Z') ? acc.last_post : `${acc.last_post}Z`;
          const t = new Date(safeStr).getTime();
          if (!isNaN(t)) {
            lastPostTimestamp = t;
            lastPostDate = acc.last_post;
            isInactive6Months = (now - t) > SIX_MONTHS_MS;
          }
        }

        let profileData: any = {};
        try {
          const metaStr = acc.posting_json_metadata || acc.json_metadata;
          if (metaStr) {
            const parsed = JSON.parse(metaStr);
            profileData = parsed?.profile || {};
          }
        } catch {}

        detailsMap[acc.name] = {
          username: acc.name,
          lastPostDate,
          lastPostTimestamp,
          isInactive6Months,
          reputation: typeof acc.reputation === 'number' ? acc.reputation : parseInt(String(acc.reputation || '0'), 10),
          postCount: acc.post_count,
          createdDate: acc.created,
          name: profileData.name,
          about: profileData.about,
          avatarUrl: profileData.profile_image || getHiveAvatarUrl(acc.name, 'small')
        };
      }
    } catch {
      // Chunk failed, continue
    }
  }

  // Assemble full list preserving order
  return allUsernames.map(username => {
    return detailsMap[username] || {
      username,
      isInactive6Months: true,
      avatarUrl: getHiveAvatarUrl(username, 'small')
    };
  });
}

export interface TrendingTagInfo {
  name: string;
  tag: string;
  comments?: number;
  top_posts?: number;
  total_payouts?: string;
}

/**
 * Fetch list of trending topics/tags on Hive directly from the blockchain
 */
export async function getTrendingTags(
  limit: number = 250,
  forceRefresh: boolean = false
): Promise<TrendingTagInfo[]> {
  const cacheKey = `trending_tags:${limit}`;

  return fetchWithCache(
    cacheKey,
    async () => {
      const result = await hiveRpcCall<Array<{ name: string; comments?: number; top_posts?: number; total_payouts?: string }>>(
        'condenser_api.get_trending_tags',
        ['', limit]
      );

      if (!result || !Array.isArray(result) || result.length === 0) {
        throw new Error('Empty trending tags response');
      }

      return result
        .filter((t) => t && t.name && t.name.length >= 2)
        .map((t) => ({
          name: t.name,
          tag: t.name,
          comments: t.comments,
          top_posts: t.top_posts,
          total_payouts: t.total_payouts
        }));
    },
    {
      ttl: CACHE_TTL.TRENDING_TAGS, // 7 Dias
      persistent: true,             // Grava no localStorage para sobreviver ao fechar o navegador
      forceRefresh
    }
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
  const direct = `https://images.ecency.com/u/${clean}/avatar/${size}`;
  return getSafeImageUrl(direct, { width: size === 'small' ? 80 : size === 'medium' ? 200 : 400 }) || direct;
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
  if (!body || typeof body !== 'string') return '';
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
 * Chame isso logo depois de confirmar um follow/unfollow (custom_json de sucesso).
 * Limpa as listas cacheadas de "quem eu sigo" e "quem está ativo" desse observer,
 * e também os caches dos 3 modos de feed com os parâmetros default usados na
 * FeedPage, para que a próxima renderização já reflita o novo estado de following.
 *
 * OBS: mesmo limpando o cache local, o Hivemind pode levar alguns segundos pra
 * indexar o follow — se o get_following logo em seguida ainda não trouxer o novo
 * usuário, não é bug daqui, é atraso de indexação do backend público.
 */
export function notifyFollowingChanged(observer: string): void {
  const cleanObserver = observer.replace(/^@/, '').trim().toLowerCase();
  if (!cleanObserver) return;

  // Lista de following usada internamente por getFollowedActiveAccounts
  apiCache.invalidate(`following:${cleanObserver}::100`);
  // Lista de following default (start vazio, limit 50) usada por outras telas
  apiCache.invalidate(`following:${cleanObserver}::50`);

  apiCache.invalidate(`followed_active_accounts:${cleanObserver}`);

  // Caches dos 3 modos de feed com os parâmetros default da FeedPage
  apiCache.invalidate(`followed_root_feed:${cleanObserver}:20::`);
  apiCache.invalidate(`followed_comments_feed:${cleanObserver}:45:7`);
  apiCache.invalidate(`followed_mixed_feed:${cleanObserver}:45:7`);
}

/**
 * Discovers accounts followed by the user that were active (posted or commented) within the last 7 days.
 * Efficiently batches account lookups in chunks of 15 using condenser_api.get_accounts as requested,
 * avoiding unnecessary RPC load and caching the active set.
 */
// Trava de requisições em andamento por observer: se o feed disparar fetchPosts
// duas vezes quase ao mesmo tempo (StrictMode, troca rápida de modo, etc.),
// a segunda chamada reaproveita a Promise da primeira em vez de refazer o
// get_following + a checagem de atividade do zero.
const pendingActiveAccountsRequests = new Map<string, Promise<string[]>>();

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

  if (!forceRefresh && pendingActiveAccountsRequests.has(cacheKey)) {
    return pendingActiveAccountsRequests.get(cacheKey)!;
  }

  const requestPromise = (async () => {
    try {
      const following = await getFollowing(cleanObserver, '', 100, forceRefresh);
      if (!following || following.length === 0) return [];

      const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;

      // Cache inteligente em camadas (mesma lógica do accountsCache do app):
      // contas ativas há < 7 dias são sempre re-checadas na abertura; contas
      // inativas há semanas/meses só voltam a ser buscadas de tempos em tempos.
      // Isso evita bater get_accounts toda hora em gente que não posta há muito tempo.
      const activity = await getSmartAccountsActivity(following, forceRefresh);

      const activeWithTimestamp = Object.entries(activity)
        .filter(([, info]) => info.timestamp > sevenDaysAgoMs)
        .map(([name, info]) => ({ name, lastPostTime: info.timestamp }));

      activeWithTimestamp.sort((a, b) => b.lastPostTime - a.lastPostTime);
      const activeUsernames = activeWithTimestamp.map(u => u.name);

      apiCache.set(cacheKey, activeUsernames, CACHE_TTL.FEED);
      return activeUsernames;
    } catch (err) {
      console.error('Error fetching followed active accounts:', err);
      return [];
    } finally {
      pendingActiveAccountsRequests.delete(cacheKey);
    }
  })();

  pendingActiveAccountsRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

/**
 * Fetches recent comments and replies made by accounts followed by the user.
 * Merges and sorts chronologically, capping at 45 items to prevent DOM/memory bloat.
 */
const pendingCommentsFeedRequests = new Map<string, Promise<HivePost[]>>();

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

    if (pendingCommentsFeedRequests.has(cacheKey)) {
      return pendingCommentsFeedRequests.get(cacheKey)!;
    }
  }

  const requestPromise = fetchFollowedCommentsFeedInternal(cleanObserver, cacheKey, forceRefresh, limit, maxAgeDays)
    .finally(() => {
      pendingCommentsFeedRequests.delete(cacheKey);
    });

  if (!forceRefresh) {
    pendingCommentsFeedRequests.set(cacheKey, requestPromise);
  }
  return requestPromise;
}

async function fetchFollowedCommentsFeedInternal(
  cleanObserver: string,
  cacheKey: string,
  forceRefresh: boolean,
  limit: number,
  maxAgeDays: number
): Promise<HivePost[]> {
  const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  try {
    await getFollowedRootFeed(cleanObserver, 20, forceRefresh).catch(() => [] as HivePost[]);
    const activeUsers = await getFollowedActiveAccounts(cleanObserver, forceRefresh);
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
  if (Array.isArray(post.reblogged_by) && post.reblogged_by.length > 0) return true;
  if (post.first_reblogged_by && post.first_reblogged_by.trim().length > 0) return true;
  if (Array.isArray(post.reblog_entries) && post.reblog_entries.length > 0) return true;
  const anyPost = post as any;
  if (typeof anyPost.reblogged_by === 'string' && anyPost.reblogged_by.trim().length > 0) return true;
  if (anyPost.reblogged_by_account && String(anyPost.reblogged_by_account).trim().length > 0) return true;
  return false;
}

/**
 * Extracts the username who reblogged the post
 */
export function getRebloggedBy(post: HivePost): string | null {
  if (Array.isArray(post.reblogged_by) && post.reblogged_by.length > 0) {
    const val = post.reblogged_by[0];
    if (typeof val === 'string' && val.trim().length > 0) return val.trim();
  }
  if (post.first_reblogged_by && post.first_reblogged_by.trim().length > 0) {
    return post.first_reblogged_by.trim();
  }
  if (Array.isArray(post.reblog_entries) && post.reblog_entries.length > 0) {
    const entry: any = post.reblog_entries[0];
    if (typeof entry === 'string' && entry.trim().length > 0) return entry.trim();
    if (entry && typeof entry === 'object') {
      const acc = entry.account || entry.author || entry.name;
      if (typeof acc === 'string' && acc.trim().length > 0) return acc.trim();
    }
  }
  const anyPost = post as any;
  if (typeof anyPost.reblogged_by === 'string' && anyPost.reblogged_by.trim().length > 0) {
    return anyPost.reblogged_by.trim();
  }
  if (anyPost.reblogged_by_account && String(anyPost.reblogged_by_account).trim().length > 0) {
    return String(anyPost.reblogged_by_account).trim();
  }
  return null;
}

/**
 * Fetches root publications and reblogs from accounts followed by the user.
 * Uses native condenser_api.get_discussions_by_feed with graceful fallback to active accounts' posts.
 */
const pendingRootFeedRequests = new Map<string, Promise<HivePost[]>>();

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

    if (pendingRootFeedRequests.has(cacheKey)) {
      return pendingRootFeedRequests.get(cacheKey)!;
    }
  }

  const requestPromise = fetchFollowedRootFeedInternal(
    cleanObserver,
    cacheKey,
    safeLimit,
    forceRefresh,
    startAuthor,
    startPermlink
  ).finally(() => {
    pendingRootFeedRequests.delete(cacheKey);
  });

  if (!forceRefresh) {
    pendingRootFeedRequests.set(cacheKey, requestPromise);
  }
  return requestPromise;
}

async function fetchFollowedRootFeedInternal(
  cleanObserver: string,
  cacheKey: string,
  safeLimit: number,
  forceRefresh: boolean,
  startAuthor?: string,
  startPermlink?: string
): Promise<HivePost[]> {
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
          : (p.first_reblogged_by
              ? [p.first_reblogged_by]
              : (Array.isArray(p.reblog_entries) && p.reblog_entries.length > 0
                  ? p.reblog_entries.map((r: any) => typeof r === 'string' ? r : r.account).filter(Boolean)
                  : []));

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
      // Se alguém "inativo" apareceu postando no feed, corrige o cache de atividade
      // e derruba as listas derivadas para que o feed de comentários já o inclua.
      const reactivated = noteAccountActivity(
        normalized.filter((p) => !(p.reblogged_by && p.reblogged_by.length > 0)) // ignora reblogs
      );
      if (reactivated.length > 0) {
        const safeObserver = cleanObserver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        apiCache.invalidate(`followed_active_accounts:${cleanObserver}`);
        apiCache.invalidatePattern(new RegExp(`^followed_(comments|mixed)_feed:${safeObserver}:`));
      }

      // Não cacheia páginas com cursor por muito tempo; ...
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
      targetUsers.map(async (user) => {
        try {
          const list = await getAccountPosts('blog', user, 4, forceRefresh);
          return list.map((p) => {
            if (p.author && p.author.toLowerCase() !== user.toLowerCase()) {
              const existingReblog = Array.isArray(p.reblogged_by) ? p.reblogged_by : [];
              return {
                ...p,
                reblogged_by: existingReblog.includes(user) ? existingReblog : [user, ...existingReblog],
                first_reblogged_by: p.first_reblogged_by || user
              };
            }
            return p;
          });
        } catch {
          return [] as HivePost[];
        }
      })
    );

    const merged = postArrays.flat();
    const seen = new Set<string>();
    const uniquePosts: HivePost[] = [];
    for (const p of merged) {
      const reblogUser = getRebloggedBy(p);
      const key = `${reblogUser ? reblogUser + ':' : ''}${p.author}/${p.permlink}`;
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
const pendingMixedFeedRequests = new Map<string, Promise<HivePost[]>>();

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

    if (pendingMixedFeedRequests.has(cacheKey)) {
      return pendingMixedFeedRequests.get(cacheKey)!;
    }
  }

  const requestPromise = fetchFollowedMixedFeedInternal(cleanObserver, cacheKey, forceRefresh, limit, maxAgeDays)
    .finally(() => {
      pendingMixedFeedRequests.delete(cacheKey);
    });

  if (!forceRefresh) {
    pendingMixedFeedRequests.set(cacheKey, requestPromise);
  }
  return requestPromise;
}

async function fetchFollowedMixedFeedInternal(
  cleanObserver: string,
  cacheKey: string,
  forceRefresh: boolean,
  limit: number,
  maxAgeDays: number
): Promise<HivePost[]> {
  const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  try {
    // Concurrently fetch root posts (feed sort / fallback active-creator posts) and followed comments
    const [rootPosts, comments] = await Promise.all([
      getFollowedRootFeed(cleanObserver, Math.min(20, limit), forceRefresh).catch(() => [] as HivePost[]),
      getFollowedCommentsFeed(cleanObserver, forceRefresh, limit, maxAgeDays).catch(() => [] as HivePost[])
    ]);

    // Merge, dedupe, and enforce age cutoff
    // Root posts (including reblogs) coming from getFollowedRootFeed are already actively in the user's feed.
    // For reblogs, the reblog event happened recently on the feed even if the original post was written earlier.
    const seen = new Set<string>();
    const merged: HivePost[] = [];
    const nowMs = Date.now();

    for (let i = 0; i < rootPosts.length; i++) {
      const item = rootPosts[i];
      const reblogUser = getRebloggedBy(item);
      const isReblog = isReblogPost(item);
      const key = `${reblogUser ? reblogUser + ':' : ''}${item.author}/${item.permlink}`;
      if (seen.has(key)) continue;

      let effectiveTime = new Date(item.created.endsWith('Z') ? item.created : item.created + 'Z').getTime();
      if (isReblog) {
        if (item.reblog_entries && item.reblog_entries[0]?.timestamp) {
          const rt = new Date(
            item.reblog_entries[0].timestamp.endsWith('Z')
              ? item.reblog_entries[0].timestamp
              : item.reblog_entries[0].timestamp + 'Z'
          ).getTime();
          if (!isNaN(rt)) effectiveTime = rt;
        } else {
          // If no explicit reblog timestamp, since it appeared high in the user's feed, keep it fresh
          effectiveTime = Math.max(effectiveTime, nowMs - (i + 1) * 3600000);
        }
      } else {
        if (isNaN(effectiveTime) || effectiveTime < cutoffMs) continue;
      }

      seen.add(key);
      (item as any)._effectiveFeedTime = effectiveTime;
      merged.push(item);
    }

    for (const item of comments) {
      const key = `${item.author}/${item.permlink}`;
      if (seen.has(key)) continue;

      const t = new Date(item.created.endsWith('Z') ? item.created : item.created + 'Z').getTime();
      if (isNaN(t) || t < cutoffMs) continue;

      seen.add(key);
      (item as any)._effectiveFeedTime = t;
      merged.push(item);
    }

    // Sort chronologically descending by effective activity time
    merged.sort((a, b) => {
      const timeA = (a as any)._effectiveFeedTime || new Date(a.created.endsWith('Z') ? a.created : a.created + 'Z').getTime();
      const timeB = (b as any)._effectiveFeedTime || new Date(b.created.endsWith('Z') ? b.created : b.created + 'Z').getTime();
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
      is_paidout: Boolean(item.is_paidout),
      is_truncated: true
    }));

    apiCache.set(cacheKey, similar, 10 * 60 * 1000); // 10 min cache
    return similar;
  } catch (err: any) {
    if (err?.name === 'AbortError') return [];
    return [];
  }
}

/**
 * Retrieves the latest custom_json broadcasted by an account matching a specific ID.
 * Scans recent account history up to the specified limit.
 */
export async function getLatestAccountCustomJson<T = any>(
  account: string,
  customJsonId: string,
  limit: number = 100
): Promise<T | null> {
  const clean = account.replace(/^@/, '').trim().toLowerCase();
  if (!clean || !customJsonId) return null;

  try {
    const rawHistory = await hiveRpcCall<Array<[number, any]>>(
      'condenser_api.get_account_history',
      [clean, -1, Math.min(limit, 200)]
    );

    if (!Array.isArray(rawHistory) || rawHistory.length === 0) return null;

    for (let i = rawHistory.length - 1; i >= 0; i--) {
      const item = rawHistory[i];
      if (!item || !item[1] || !item[1].op) continue;
      const [opName, opData] = item[1].op;

      if (opName === 'custom_json' && opData && opData.id === customJsonId) {
        const postingAuths: string[] = opData.required_posting_auths || [];
        const activeAuths: string[] = opData.required_auths || [];
        if (!postingAuths.includes(clean) && !activeAuths.includes(clean)) {
          continue;
        }

        try {
          const parsed = typeof opData.json === 'string' ? JSON.parse(opData.json) : opData.json;
          return parsed as T;
        } catch {
          return null;
        }
      }
    }

    return null;
  } catch (err) {
    console.warn(`Failed to fetch custom_json '${customJsonId}' for @${clean}:`, err);
    return null;
  }
}
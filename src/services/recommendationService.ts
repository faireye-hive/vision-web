import { HivePost } from './hiveApi';
import {
  getRecommendationCache,
  saveRecommendationCache,
  CachedRecommendationRecord
} from './recommendationDb';

const HIVE_RPC_NODE = 'https://api.hive.blog';
const HIVESENSE_BASE_URL = 'https://api.hive.blog/hivesense-api';

// Configurable constants adhering to user specifications
export const RECOMMENDATION_DELAY_MS = 6000; // 6 seconds delay between HiveSense calls (within 5-10s requirement)
export const TARGET_SEED_POSTS = 30;         // 30 upvoted root posts
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (once per day)
export const MAX_CACHED_POSTS = 500;         // Target pool size (~200+ posts)
export const POSTS_PER_PAGE = 20;            // Sliced 20 by 20
export const REC_CACHE_VERSION = 3;          // Incremented to invalidate previous cache and apply relevance-based assortment and blockchain hydration

// Spam & noise filter patterns
// Filter out actifit, daily reports, mixes, automated containers, bot rings
const NOISE_TAGS = new Set([
  'actifit',
  'daily',
  'mix',
  'burnpost',
]);

const NOISE_AUTHORS = new Set([
  'actifit',
  'peak.snaps',
  'ecency.waves',
  'buildawhale'
]);

const NOISE_TITLE_REGEX = /\b(actifit|daily|diario|diário|mix|resumen|reporte|report|relatorio|relatório|curacion|curación|vyhodnocení|container|evaluation)\b/i;

/**
 * Checks if a post matches spam or noise criteria (actifit, daily, mix, report bots, etc.)
 */
export function isSpamOrNoisePost(post: {
  author?: string;
  category?: string;
  title?: string;
  permlink?: string;
  json_metadata?: any;
}): boolean {
  const author = (post.author || '').toLowerCase();
  if (NOISE_AUTHORS.has(author)) {
    return true;
  }

  const category = (post.category || '').toLowerCase();
  if (NOISE_TAGS.has(category)) {
    return true;
  }

  const permlink = (post.permlink || '').toLowerCase();
  if (permlink.startsWith('re-')) {
    return true; // Comments are not root posts
  }

  const title = (post.title || '').trim();
  if (NOISE_TITLE_REGEX.test(title)) {
    return true;
  }

  // Check tags in json_metadata if present
  let tags: string[] = [];
  try {
    const meta = typeof post.json_metadata === 'string'
      ? JSON.parse(post.json_metadata)
      : post.json_metadata;
    if (meta && Array.isArray(meta.tags)) {
      tags = meta.tags.map((t: any) => String(t).toLowerCase());
    }
  } catch {
    // ignore parse error
  }

  for (const tag of tags) {
    if (NOISE_TAGS.has(tag)) {
      return true;
    }
  }

  return false;
}

/**
 * Diversifies and sorts posts so that no single author dominates consecutively,
 * prioritizing HiveSense AI similarity relevance over strict timestamps:
 * 1. Groups posts by author and sorts each author's queue by recommendation relevance score
 *    (earlier HiveSense results have higher scores; cross-seed matches get boosted).
 * 2. Orders author queues by the relevance score of their top post.
 * 3. Round-robin dequeues 1 post per author per round, ensuring the feed is assorted across creators
 *    while the most relevant recommendations lead the discovery.
 */
export function interleaveAndSortPostsByRelevance(posts: HivePost[]): HivePost[] {
  if (posts.length <= 1) return posts;

  const byAuthor = new Map<string, HivePost[]>();
  for (const p of posts) {
    const list = byAuthor.get(p.author) || [];
    list.push(p);
    byAuthor.set(p.author, list);
  }

  // Helper to compute effective post weight based primarily on HiveSense relevance
  const getPostWeight = (p: HivePost): number => {
    const base = typeof p.recommendation_score === 'number' ? p.recommendation_score : 10;
    // Mild recency bonus for posts within the last 30-90 days as subtle tiebreaker
    let recencyBonus = 0;
    if (p.created) {
      const ageDays = (Date.now() - new Date(p.created).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays <= 7) recencyBonus = 3;
      else if (ageDays <= 30) recencyBonus = 2;
      else if (ageDays <= 90) recencyBonus = 1;
    }
    return base + recencyBonus;
  };

  // Sort each author's personal queue by relevance weight descending
  for (const list of byAuthor.values()) {
    list.sort((a, b) => {
      const weightDiff = getPostWeight(b) - getPostWeight(a);
      if (Math.abs(weightDiff) >= 0.01) return weightDiff;
      // Tie-breaker: newest first
      const timeA = new Date(a.created || 0).getTime();
      const timeB = new Date(b.created || 0).getTime();
      return timeB - timeA;
    });
  }

  // Order author queues by their top post's relevance weight descending
  const authorQueues = Array.from(byAuthor.values()).sort((a, b) => {
    const topA = a[0] ? getPostWeight(a[0]) : 0;
    const topB = b[0] ? getPostWeight(b[0]) : 0;
    if (Math.abs(topB - topA) >= 0.01) return topB - topA;
    const timeA = new Date(a[0]?.created || 0).getTime();
    const timeB = new Date(b[0]?.created || 0).getTime();
    return timeB - timeA;
  });

  const result: HivePost[] = [];
  let hasMore = true;

  while (hasMore) {
    hasMore = false;
    for (const q of authorQueues) {
      if (q.length > 0) {
        result.push(q.shift()!);
        if (q.length > 0) {
          hasMore = true;
        }
      }
    }
  }

  return result;
}

// Backward-compatibility alias
export const interleaveAndSortPostsByRecency = interleaveAndSortPostsByRelevance;

export interface RecommendationSyncStatus {
  account: string;
  isSyncing: boolean;
  phase: 'idle' | 'history' | 'hivesense' | 'complete' | 'error';
  currentSeedIndex: number;
  totalSeeds: number;
  totalPostsFound: number;
  error?: string;
  lastUpdated?: number;
}

// In-memory sync trackers to prevent duplicate concurrent runs
const activeSyncControllers = new Map<string, AbortController>();
const statusListeners = new Set<(status: RecommendationSyncStatus) => void>();
let latestStatusMap = new Map<string, RecommendationSyncStatus>();

export function subscribeRecommendationStatus(
  listener: (status: RecommendationSyncStatus) => void
): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

function notifyStatus(status: RecommendationSyncStatus) {
  latestStatusMap.set(status.account, status);
  statusListeners.forEach((listener) => {
    try {
      listener(status);
    } catch (err) {
      console.error('[recommendationService] Error in status listener:', err);
    }
  });
}

export function getRecommendationStatus(account: string): RecommendationSyncStatus {
  return (
    latestStatusMap.get(account) || {
      account,
      isSyncing: false,
      phase: 'idle',
      currentSeedIndex: 0,
      totalSeeds: 0,
      totalPostsFound: 0,
    }
  );
}

/**
 * Normalizes raw post from HiveSense into a full HivePost structure compatible with Nebulosa.
 */
function normalizeHiveSensePost(raw: any, rankIndex = 0): HivePost {
  const author = String(raw.author || '');
  const permlink = String(raw.permlink || '');
  const keyStr = `${author}/${permlink}`;

  let numericId = 0;
  if (typeof raw.post_id === 'number') {
    numericId = raw.post_id;
  } else {
    // Generate deterministic positive integer ID from author/permlink
    let hash = 0;
    for (let i = 0; i < keyStr.length; i++) {
      hash = (hash << 5) - hash + keyStr.charCodeAt(i);
      hash |= 0;
    }
    numericId = Math.abs(hash) || Math.floor(Math.random() * 1000000);
  }

  // Base score: rank 0 is highest relevance (25 pts), down to 6 pts for rank 19
  const baseRelevance = Math.max(1, 25 - (typeof rankIndex === 'number' ? rankIndex : 0));

  return {
    post_id: numericId,
    author,
    permlink,
    category: String(raw.category || ''),
    title: String(raw.title || ''),
    body: String(raw.body || ''),
    json_metadata: raw.json_metadata || {},
    created: String(raw.created || new Date().toISOString()),
    updated: raw.updated,
    parent_author: raw.parent_author,
    parent_permlink: raw.parent_permlink,
    depth: typeof raw.depth === 'number' ? raw.depth : 0,
    children: typeof raw.children === 'number' ? raw.children : 0,
    net_rshares: typeof raw.net_rshares === 'number' ? raw.net_rshares : 0,
    is_paidout: Boolean(raw.is_paidout),
    payout: typeof raw.payout === 'number' ? raw.payout : parseFloat(raw.payout || '0') || 0,
    pending_payout_value: String(raw.pending_payout_value || '0.000 HBD'),
    author_payout_value: raw.author_payout_value ? String(raw.author_payout_value) : undefined,
    curator_payout_value: raw.curator_payout_value ? String(raw.curator_payout_value) : undefined,
    promoted: raw.promoted,
    replies: Array.isArray(raw.replies) ? raw.replies : undefined,
    author_reputation: typeof raw.author_reputation === 'number' ? raw.author_reputation : 25,
    stats: raw.stats || {},
    community: raw.community,
    community_title: raw.community_title,
    active_votes: Array.isArray(raw.active_votes) ? raw.active_votes : [],
    beneficiaries: Array.isArray(raw.beneficiaries) ? raw.beneficiaries : [],
    is_truncated: true,
    from_recommendation: true,
    recommendation_score: baseRelevance,
  };
}

/**
 * Fetches recent positive upvoted root posts (weight > 0, not comments, not self-upvotes)
 * using account_history_api.get_account_history with pagination if fewer than 30 are found.
 */
export async function fetchUpvotedRootPosts(
  account: string,
  targetCount = TARGET_SEED_POSTS,
  signal?: AbortSignal
): Promise<{ author: string; permlink: string }[]> {
  const found: { author: string; permlink: string }[] = [];
  const seenKeys = new Set<string>();

  let start = -1;
  const maxPages = 10; // Safety guard: up to 10,000 history entries
  let pageCount = 0;

  while (found.length < targetCount && pageCount < maxPages && !signal?.aborted) {
    pageCount++;
    try {
      const response = await fetch(HIVE_RPC_NODE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'account_history_api.get_account_history',
          params: {
            account,
            start: start === -1 ? -1 : start,
            limit: 1000,
            include_reversible: true,
            operation_filter_low: 1, // Filter for vote operations
          },
          id: 1,
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`Hive RPC error ${response.status}`);
      }

      const data = await response.json();
      const history: Array<[number, any]> = data.result?.history || [];
      if (!Array.isArray(history) || history.length === 0) {
        break; // No more history records
      }

      // History is ordered ascending by sequence number. Iterate descending so we get newest votes first.
      for (let i = history.length - 1; i >= 0; i--) {
        const [, item] = history[i];
        const op = item?.op;
        if (!op) continue;

        const opType = op.type || op[0];
        const opVal = op.value || op[1];

        if (opType === 'vote_operation' || opType === 'vote') {
          if (
            opVal &&
            opVal.voter === account &&
            typeof opVal.weight === 'number' &&
            opVal.weight > 0 && // Positive upvotes only
            typeof opVal.permlink === 'string' &&
            !opVal.permlink.startsWith('re-') && // Root posts only (not comments)
            opVal.author &&
            opVal.author !== account // Posts by other authors (curation signal)
          ) {
            const key = `${opVal.author}/${opVal.permlink}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              found.push({
                author: opVal.author,
                permlink: opVal.permlink,
              });

              if (found.length >= targetCount) {
                break;
              }
            }
          }
        }
      }

      const lowestSeq = history[0][0];
      if (lowestSeq <= 0 || found.length >= targetCount) {
        break;
      }
      start = lowestSeq - 1;
    } catch (err: any) {
      if (signal?.aborted) return found;
      console.warn('[recommendationService] Error during history pagination:', err);
      break;
    }
  }

  return found;
}

/**
 * Calls HiveSense similar endpoint for a single seed post.
 */
async function fetchSimilarPostsForSeed(
  author: string,
  permlink: string,
  observer = 'hive.blog',
  signal?: AbortSignal
): Promise<HivePost[]> {
  const url = `${HIVESENSE_BASE_URL}/posts/${encodeURIComponent(author)}/${encodeURIComponent(
    permlink
  )}/similar?truncate=200&result_limit=20&full_posts=20&observer=${encodeURIComponent(observer)}`;

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`HiveSense returned HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data.map((raw, idx) => normalizeHiveSensePost(raw, idx));
}

/**
 * Starts a background recommendation synchronization process.
 * Runs at a deliberate pace (6 seconds between API calls) to respect rate limits.
 */
export async function syncRecommendationsInBackground(
  account: string,
  force = false
): Promise<CachedRecommendationRecord | null> {
  if (!account) return null;

  // 1. Check existing cache
  const existing = await getRecommendationCache(account);
  const now = Date.now();

  if (
    !force &&
    existing &&
    existing.version === REC_CACHE_VERSION &&
    existing.posts.length >= 20 &&
    now - existing.lastUpdated < CACHE_TTL_MS
  ) {
    // Cache is fresh (less than 24 hours old) - do not query the API!
    notifyStatus({
      account,
      isSyncing: false,
      phase: 'complete',
      currentSeedIndex: existing.seedKeys.length,
      totalSeeds: existing.seedKeys.length,
      totalPostsFound: existing.posts.length,
      lastUpdated: existing.lastUpdated,
    });
    return existing;
  }

  // 2. Prevent concurrent syncing for the same account
  if (activeSyncControllers.has(account)) {
    console.log(`[recommendationService] Sync already in progress for ${account}`);
    return existing;
  }

  const abortController = new AbortController();
  activeSyncControllers.set(account, abortController);

  notifyStatus({
    account,
    isSyncing: true,
    phase: 'history',
    currentSeedIndex: 0,
    totalSeeds: 0,
    totalPostsFound: existing?.posts.length || 0,
    lastUpdated: existing?.lastUpdated,
  });

  try {
    // 3. Fetch up to 30 positive upvoted root posts
    const seeds = await fetchUpvotedRootPosts(
      account,
      TARGET_SEED_POSTS,
      abortController.signal
    );

    if (abortController.signal.aborted) {
      return existing;
    }

    if (seeds.length === 0) {
      notifyStatus({
        account,
        isSyncing: false,
        phase: 'complete',
        currentSeedIndex: 0,
        totalSeeds: 0,
        totalPostsFound: existing?.posts.length || 0,
        lastUpdated: now,
      });
      return existing;
    }

    notifyStatus({
      account,
      isSyncing: true,
      phase: 'hivesense',
      currentSeedIndex: 0,
      totalSeeds: seeds.length,
      totalPostsFound: existing?.posts.length || 0,
      lastUpdated: existing?.lastUpdated,
    });

    // 4. Initialize working post pool from existing cache (or empty)
    const seedKeysSet = new Set<string>(seeds.map((s) => `${s.author}/${s.permlink}`));
    const existingPostKeys = new Set<string>();
    const accumulatedPosts: HivePost[] = [];

    // Keep non-stale unique posts if available, filtering out spam/noise
    if (existing?.posts && existing.version === REC_CACHE_VERSION) {
      for (const p of existing.posts) {
        const k = `${p.author}/${p.permlink}`;
        if (!existingPostKeys.has(k) && p.author !== account && !isSpamOrNoisePost(p)) {
          existingPostKeys.add(k);
          accumulatedPosts.push(p);
        }
      }
    }

    // 5. Query HiveSense in sequence with 6-second delay between calls
    for (let i = 0; i < seeds.length; i++) {
      if (abortController.signal.aborted) break;

      const seed = seeds[i];

      try {
        const similarPosts = await fetchSimilarPostsForSeed(
          seed.author,
          seed.permlink,
          'hive.blog',
          abortController.signal
        );

        let newItemsAdded = 0;
        for (const post of similarPosts) {
          const key = `${post.author}/${post.permlink}`;

          // If already present, cross-seed synergy boosts recommendation score!
          if (existingPostKeys.has(key)) {
            const existing = accumulatedPosts.find((p) => `${p.author}/${p.permlink}` === key);
            if (existing) {
              existing.recommendation_score =
                (existing.recommendation_score || 20) + (post.recommendation_score || 15);
            }
            continue;
          }

          // Filter out:
          // - user's own posts
          // - root seed posts that the user already upvoted
          // - comments
          // - spam and noise (actifit, daily, mix, report bots, etc.)
          if (
            post.author !== account &&
            !seedKeysSet.has(key) &&
            post.depth === 0 &&
            !post.permlink.startsWith('re-') &&
            !isSpamOrNoisePost(post)
          ) {
            existingPostKeys.add(key);
            accumulatedPosts.push(post);
            newItemsAdded++;
          }
        }

        // Apply author interleaving and relevance sorting (earlier HiveSense results prioritized)
        const assortedPosts = interleaveAndSortPostsByRelevance(accumulatedPosts);

        // Progressively save to IndexedDB so partial results are immediately available!
        const updatedRecord: CachedRecommendationRecord = {
          account,
          posts: assortedPosts.slice(0, MAX_CACHED_POSTS),
          lastUpdated: Date.now(),
          seedKeys: Array.from(seedKeysSet),
          version: REC_CACHE_VERSION,
        };

        await saveRecommendationCache(updatedRecord);

        notifyStatus({
          account,
          isSyncing: true,
          phase: 'hivesense',
          currentSeedIndex: i + 1,
          totalSeeds: seeds.length,
          totalPostsFound: assortedPosts.length,
          lastUpdated: updatedRecord.lastUpdated,
        });

        // If we reached our goal pool size, we can gracefully finish
        if (accumulatedPosts.length >= MAX_CACHED_POSTS) {
          break;
        }
      } catch (seedErr: any) {
        if (abortController.signal.aborted) break;
        console.warn(`[recommendationService] HiveSense error for seed ${seed.author}/${seed.permlink}:`, seedErr);
      }

      // Wait 6 seconds between requests (5-10s requirement) if there are more seeds
      if (i < seeds.length - 1 && !abortController.signal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, RECOMMENDATION_DELAY_MS));
      }
    }

    const finalAssorted = interleaveAndSortPostsByRelevance(accumulatedPosts);

    const finalRecord: CachedRecommendationRecord = {
      account,
      posts: finalAssorted.slice(0, MAX_CACHED_POSTS),
      lastUpdated: Date.now(),
      seedKeys: Array.from(seedKeysSet),
      version: REC_CACHE_VERSION,
    };
    await saveRecommendationCache(finalRecord);

    notifyStatus({
      account,
      isSyncing: false,
      phase: 'complete',
      currentSeedIndex: seeds.length,
      totalSeeds: seeds.length,
      totalPostsFound: finalRecord.posts.length,
      lastUpdated: finalRecord.lastUpdated,
    });

    return finalRecord;
  } catch (err: any) {
    console.error('[recommendationService] Sync error:', err);
    notifyStatus({
      account,
      isSyncing: false,
      phase: 'error',
      currentSeedIndex: 0,
      totalSeeds: 0,
      totalPostsFound: existing?.posts.length || 0,
      error: err.message || 'Error syncing recommendations',
      lastUpdated: existing?.lastUpdated,
    });
    return existing;
  } finally {
    activeSyncControllers.delete(account);
  }
}

/**
 * Returns the recommended posts for an account, with pagination support (20 per page).
 * Automatically initiates daily background refresh if cache is empty or expired.
 */
export async function getRecommendationsForUser(
  account: string,
  page = 1,
  pageSize = POSTS_PER_PAGE
): Promise<{
  posts: HivePost[];
  total: number;
  hasMore: boolean;
  isStale: boolean;
  isSyncing: boolean;
}> {
  if (!account) {
    return { posts: [], total: 0, hasMore: false, isStale: true, isSyncing: false };
  }

  // Read from IndexedDB
  const cached = await getRecommendationCache(account);
  const now = Date.now();
  const isStale =
    !cached ||
    cached.version !== REC_CACHE_VERSION ||
    now - cached.lastUpdated >= CACHE_TTL_MS;
  const isSyncing = activeSyncControllers.has(account);

  // If stale or missing, trigger background sync without blocking
  if (isStale && !isSyncing) {
    // Fire and forget in background
    syncRecommendationsInBackground(account, false).catch((e) =>
      console.warn('[recommendationService] Background sync failed:', e)
    );
  }

  // Ensure returned posts are assorted and noise-filtered
  const rawPosts = cached?.posts || [];
  const cleanPosts = isStale && cached?.version !== REC_CACHE_VERSION
    ? interleaveAndSortPostsByRelevance(rawPosts.filter((p) => !isSpamOrNoisePost(p)))
    : rawPosts;

  const startIndex = (page - 1) * pageSize;
  const pagePosts = cleanPosts.slice(startIndex, startIndex + pageSize);
  const hasMore = startIndex + pageSize < cleanPosts.length;

  return {
    posts: pagePosts,
    total: cleanPosts.length,
    hasMore,
    isStale,
    isSyncing: isSyncing || isStale,
  };
}

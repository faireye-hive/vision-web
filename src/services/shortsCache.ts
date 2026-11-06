import { HivePost } from './hiveApi';
import { PeakSnapsContainer } from './shortsApi';

interface FeedCacheData {
  snaps: HivePost[];
  containers: PeakSnapsContainer[];
  discussionMap: Record<string, HivePost>;
  timestamp: number;
  tag: string;
}

interface RepliesCacheData {
  replies: HivePost[];
  timestamp: number;
}

const FEED_CACHE_KEY = 'nebulosa_shorts_feed_cache';
const REPLIES_CACHE_PREFIX = 'nebulosa_shorts_replies_';
const FEED_CACHE_DURATION = 1000 * 60 * 10; // 10 minutes
const REPLIES_CACHE_DURATION = 1000 * 60 * 5; // 5 minutes
const MAX_MEMORY_FEEDS = 5;
const MAX_CACHED_REPLY_ACCOUNTS = 5;

// In-memory cache for fastest synchronous access
let memoryFeedCache: Record<string, FeedCacheData> = {};
let memoryRepliesCache: Record<string, RepliesCacheData> = {};

function safeSessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // SessionStorage may fail on quota or incognito mode
  }
}

function safeSessionRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

function trimOldest<T extends { timestamp: number }>(cache: Record<string, T>, limit: number): void {
  const now = Date.now();
  for (const [key, value] of Object.entries(cache)) {
    if (now - value.timestamp > FEED_CACHE_DURATION) delete cache[key];
  }
  while (Object.keys(cache).length > limit) {
    const oldestKey = Object.keys(cache)[0];
    if (!oldestKey) break;
    delete cache[oldestKey];
  }
}

// ================= SHORTS FEED CACHE =================

export const getCachedShortsFeed = (tag: string = ''): FeedCacheData | null => {
  const normTag = tag.trim().toLowerCase();

  // 1. Check memory cache first
  const mem = memoryFeedCache[normTag];
  if (mem && Date.now() - mem.timestamp < FEED_CACHE_DURATION) {
    delete memoryFeedCache[normTag];
    memoryFeedCache[normTag] = mem;
    return mem;
  }
  if (mem) delete memoryFeedCache[normTag];

  // 2. Fallback to sessionStorage
  if (!normTag) {
    const raw = safeSessionGet(FEED_CACHE_KEY);
    if (raw) {
      try {
        const parsed: FeedCacheData = JSON.parse(raw);
        if (Date.now() - parsed.timestamp < FEED_CACHE_DURATION && parsed.snaps?.length > 0) {
          // Older sessions persisted the full container discussion (potentially
          // thousands of comments). Keep only the feed needed for instant paint.
          parsed.discussionMap = {};
          memoryFeedCache[normTag] = parsed;
          safeSessionSet(FEED_CACHE_KEY, JSON.stringify({ ...parsed, snaps: parsed.snaps.slice(0, 100) }));
          trimOldest(memoryFeedCache, MAX_MEMORY_FEEDS);
          return parsed;
        }
      } catch {
        safeSessionRemove(FEED_CACHE_KEY);
      }
    }
  }

  return null;
};

export const setCachedShortsFeed = (
  snaps: HivePost[],
  containers: PeakSnapsContainer[],
  discussionMap: Record<string, HivePost> = {},
  tag: string = ''
): void => {
  const normTag = tag.trim().toLowerCase();
  const data: FeedCacheData = {
    snaps,
    containers,
    discussionMap,
    timestamp: Date.now(),
    tag: normTag
  };

  memoryFeedCache[normTag] = data;
  trimOldest(memoryFeedCache, MAX_MEMORY_FEEDS);

  // Persist default feed (no tag) in sessionStorage
  if (!normTag && snaps.length > 0) {
    try {
      // Limit snaps saved to session storage to avoid storage quota errors
      const trimmedSnaps = snaps.slice(0, 100);
      safeSessionSet(
        FEED_CACHE_KEY,
        JSON.stringify({
          ...data,
          snaps: trimmedSnaps,
          // Discussions are fetched only when opened; don't serialize the whole
          // container tree into sessionStorage.
          discussionMap: {}
        })
      );
    } catch {
      // Ignore serialization or quota issues
    }
  }
};

// Backwards compatibility for existing imports
export const getCachedShorts = (tag: string = ''): HivePost[] | null => {
  const feed = getCachedShortsFeed(tag);
  return feed ? feed.snaps : null;
};

export const setCachedShorts = (snaps: HivePost[], tag: string = ''): void => {
  setCachedShortsFeed(snaps, [], {}, tag);
};

// ================= SHORTS REPLIES CACHE =================

export const getCachedReplies = (account: string): HivePost[] | null => {
  const clean = account.replace(/^@/, '').trim().toLowerCase();
  if (!clean) return null;

  // 1. Memory check
  const mem = memoryRepliesCache[clean];
  if (mem && Date.now() - mem.timestamp < REPLIES_CACHE_DURATION) {
    delete memoryRepliesCache[clean];
    memoryRepliesCache[clean] = mem;
    return mem.replies;
  }
  if (mem) delete memoryRepliesCache[clean];

  // 2. SessionStorage check
  const raw = safeSessionGet(`${REPLIES_CACHE_PREFIX}${clean}`);
  if (raw) {
    try {
      const parsed: RepliesCacheData = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < REPLIES_CACHE_DURATION && Array.isArray(parsed.replies)) {
        memoryRepliesCache[clean] = parsed;
        trimOldest(memoryRepliesCache, MAX_CACHED_REPLY_ACCOUNTS);
        return parsed.replies;
      }
    } catch {
      safeSessionRemove(`${REPLIES_CACHE_PREFIX}${clean}`);
    }
  }

  return null;
};

export const setCachedReplies = (account: string, replies: HivePost[]): void => {
  const clean = account.replace(/^@/, '').trim().toLowerCase();
  if (!clean) return;

  const data: RepliesCacheData = {
    replies,
    timestamp: Date.now()
  };

  memoryRepliesCache[clean] = data;
  trimOldest(memoryRepliesCache, MAX_CACHED_REPLY_ACCOUNTS);

  try {
    safeSessionSet(`${REPLIES_CACHE_PREFIX}${clean}`, JSON.stringify(data));
    const cachedKeys: Array<{ key: string; timestamp: number }> = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith(REPLIES_CACHE_PREFIX)) continue;
      try {
        const entry = JSON.parse(sessionStorage.getItem(key) || 'null') as RepliesCacheData | null;
        if (!entry || !Array.isArray(entry.replies) || Date.now() - entry.timestamp >= REPLIES_CACHE_DURATION) {
          safeSessionRemove(key);
        } else {
          cachedKeys.push({ key, timestamp: entry.timestamp });
        }
      } catch {
        safeSessionRemove(key);
      }
    }
    cachedKeys.sort((a, b) => b.timestamp - a.timestamp);
    cachedKeys.slice(MAX_CACHED_REPLY_ACCOUNTS).forEach(({ key }) => safeSessionRemove(key));
  } catch {
    // Ignore quota issues
  }
};

// ================= CLEAR CACHE =================

export const clearShortsCache = (): void => {
  memoryFeedCache = {};
  memoryRepliesCache = {};
  safeSessionRemove(FEED_CACHE_KEY);
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(REPLIES_CACHE_PREFIX)) keys.push(key);
    }
    keys.forEach(safeSessionRemove);
  } catch {
    // SessionStorage may be disabled.
  }
};

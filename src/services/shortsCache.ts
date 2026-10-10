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

// ================= SHORTS FEED CACHE =================

export const getCachedShortsFeed = (tag: string = ''): FeedCacheData | null => {
  const normTag = tag.trim().toLowerCase();

  // 1. Check memory cache first
  const mem = memoryFeedCache[normTag];
  if (mem && Date.now() - mem.timestamp < FEED_CACHE_DURATION) {
    return mem;
  }

  // 2. Fallback to sessionStorage
  if (!normTag) {
    const raw = safeSessionGet(FEED_CACHE_KEY);
    if (raw) {
      try {
        const parsed: FeedCacheData = JSON.parse(raw);
        if (Date.now() - parsed.timestamp < FEED_CACHE_DURATION && parsed.snaps?.length > 0) {
          memoryFeedCache[normTag] = parsed;
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

  // Persist default feed (no tag) in sessionStorage
  if (!normTag && snaps.length > 0) {
    try {
      // Limit snaps saved to session storage to avoid storage quota errors
      const trimmedSnaps = snaps.slice(0, 100);
      safeSessionSet(
        FEED_CACHE_KEY,
        JSON.stringify({
          ...data,
          snaps: trimmedSnaps
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
    return mem.replies;
  }

  // 2. SessionStorage check
  const raw = safeSessionGet(`${REPLIES_CACHE_PREFIX}${clean}`);
  if (raw) {
    try {
      const parsed: RepliesCacheData = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < REPLIES_CACHE_DURATION && Array.isArray(parsed.replies)) {
        memoryRepliesCache[clean] = parsed;
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

  try {
    safeSessionSet(`${REPLIES_CACHE_PREFIX}${clean}`, JSON.stringify(data));
  } catch {
    // Ignore quota issues
  }
};

// ================= CLEAR CACHE =================

export const clearShortsCache = (): void => {
  memoryFeedCache = {};
  memoryRepliesCache = {};
  safeSessionRemove(FEED_CACHE_KEY);
};

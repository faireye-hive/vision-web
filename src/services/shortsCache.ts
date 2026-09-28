import { HivePost } from './hiveApi';

interface ShortsCache {
  snaps: HivePost[];
  timestamp: number;
  lastTag: string;
}

let shortsCache: ShortsCache | null = null;
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

export const getCachedShorts = (tag: string) => {
  if (!shortsCache) return null;
  
  const isExpired = Date.now() - shortsCache.timestamp > CACHE_DURATION;
  const tagChanged = shortsCache.lastTag !== tag;
  
  if (isExpired || tagChanged) {
    return null;
  }
  
  return shortsCache.snaps;
};

export const setCachedShorts = (snaps: HivePost[], tag: string) => {
  shortsCache = {
    snaps,
    timestamp: Date.now(),
    lastTag: tag
  };
};

export const clearShortsCache = () => {
  shortsCache = null;
};

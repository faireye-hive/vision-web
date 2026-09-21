/**
 * High-performance client-side cache manager for Hive RPC queries.
 * Prevents redundant network calls when switching tabs, routes, communities, or user profiles.
 * Respects the 'new' (created) feed by bypassing cache to ensure fresh block data.
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // in milliseconds
}

export interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  savedRequests: number;
  hitRatio: number;
}

class ApiCacheManager {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private stats: { hits: number; misses: number; entries: number; savedRequests: number } = {
    hits: 0,
    misses: 0,
    entries: 0,
    savedRequests: 0
  };
  private subscribers: Set<(stats: CacheStats) => void> = new Set();
  private storagePrefix = 'hive_cache_v1:';

  constructor() {
    this.hydrateFromSessionStorage();
  }

  /**
   * Subscribe to cache changes (useful for stats UI)
   */
  public subscribe(callback: (stats: CacheStats) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify() {
    this.stats.entries = this.memoryCache.size;
    const currentStats = this.getStats();
    this.subscribers.forEach((cb) => {
      try {
        cb(currentStats);
      } catch {
        // Ignore subscriber errors
      }
    });
  }

  /**
   * Hydrate in-memory cache from sessionStorage on startup
   */
  private hydrateFromSessionStorage() {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      const now = Date.now();
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(this.storagePrefix)) {
          const raw = sessionStorage.getItem(key);
          if (raw) {
            const entry: CacheEntry<any> = JSON.parse(raw);
            // Check if still unexpired
            if (now - entry.timestamp < entry.ttl) {
              const actualKey = key.replace(this.storagePrefix, '');
              this.memoryCache.set(actualKey, entry);
            } else {
              sessionStorage.removeItem(key);
            }
          }
        }
      }
      this.stats.entries = this.memoryCache.size;
    } catch {
      // Graceful fallback if storage is restricted
    }
  }

  /**
   * Get cached item if present and not expired
   */
  public get<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) {
      this.stats.misses++;
      this.notify();
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Expired entry
      this.memoryCache.delete(key);
      this.removeSessionStorage(key);
      this.stats.misses++;
      this.notify();
      return null;
    }

    this.stats.hits++;
    this.stats.savedRequests++;
    this.notify();
    return entry.data as T;
  }

  /**
   * Check if a valid, unexpired item exists in cache
   */
  public has(key: string): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) return false;
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key);
      this.removeSessionStorage(key);
      return false;
    }
    return true;
  }

  /**
   * Store item in memory and sessionStorage
   */
  public set<T>(key: string, data: T, ttlMs: number = 180000): void {
    if (ttlMs <= 0) return; // Do not cache zero-ttl items

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    };

    this.memoryCache.set(key, entry);
    this.setSessionStorage(key, entry);
    this.notify();
  }

  /**
   * Invalidate a specific cache key
   */
  public invalidate(key: string): void {
    this.memoryCache.delete(key);
    this.removeSessionStorage(key);
    this.notify();
  }

  /**
   * Invalidate keys matching a pattern (string or RegExp)
   */
  public invalidatePattern(pattern: RegExp | string): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        this.removeSessionStorage(key);
      }
    }
    this.notify();
  }

  /**
   * Purge all cached data
   */
  public clear(): void {
    this.memoryCache.clear();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith(this.storagePrefix)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => sessionStorage.removeItem(k));
      } catch {
        // Ignore
      }
    }
    this.stats.entries = 0;
    this.notify();
  }

  public getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRatio = total > 0 ? Math.round((this.stats.hits / total) * 100) : 0;
    return {
      ...this.stats,
      entries: this.memoryCache.size,
      hitRatio
    };
  }

  private setSessionStorage(key: string, entry: CacheEntry<any>) {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      sessionStorage.setItem(this.storagePrefix + key, JSON.stringify(entry));
    } catch {
      // Storage quota exceeded or disabled; memory cache continues working
    }
  }

  private removeSessionStorage(key: string) {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      sessionStorage.removeItem(this.storagePrefix + key);
    } catch {
      // Ignore
    }
  }
}

export const apiCache = new ApiCacheManager();

/**
 * Standard TTL Presets (in milliseconds)
 */
export const CACHE_TTL = {
  NONE: 0,
  FAST: 15 * 1000,           // 15s (Blockchain dynamic global props)
  FEED: 3 * 60 * 1000,       // 3 minutes (Hot, Trending, Payout, Muted)
  FEED_PAGE: 5 * 60 * 1000,  // 5 minutes (Paginated historical feeds)
  DISCUSSION: 2 * 60 * 1000, // 2 minutes (Post reading & comments)
  ACCOUNT: 5 * 60 * 1000,    // 5 minutes (User profile, wallet stats)
  COMMUNITY: 10 * 60 * 1000, // 10 minutes (Community listing)
  TRENDING_TAGS: 10 * 60 * 1000 // 10 minutes (Trending topics)
};

/**
 * Wrapper to fetch with automatic caching, TTL expiration, and manual refresh bypass.
 */
export async function fetchWithCache<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options?: {
    ttl?: number;
    bypassCache?: boolean;
    forceRefresh?: boolean;
  }
): Promise<T> {
  const bypass = options?.bypassCache || options?.forceRefresh;
  const ttl = options?.ttl ?? CACHE_TTL.FEED;

  if (!bypass) {
    const cached = apiCache.get<T>(cacheKey);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
  }

  const fresh = await fetchFn();

  // If not bypassing or if forceRefresh was used to update, store in cache if TTL > 0
  if (ttl > 0 && fresh !== null && fresh !== undefined) {
    apiCache.set<T>(cacheKey, fresh, ttl);
  }

  return fresh;
}

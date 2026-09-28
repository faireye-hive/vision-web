/**
 * High-performance client-side cache manager for Hive RPC queries.
 * Prevents redundant network calls when switching tabs, routes, communities, or user profiles.
 * Respects the 'new' (created) feed by bypassing cache to ensure fresh block data.
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // in milliseconds
  persistent?: boolean; // Se true, salva no localStorage em vez do sessionStorage
}

export interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  savedRequests: number;
  hitRatio: number;
}

const MAX_PERSISTED_CHARS = 100_000;

function isPostLike(value: unknown): boolean {
  return !!value && typeof value === 'object' && 'permlink' in value && 'body' in value;
}

/** Feed lists and discussion maps are too large to stringify into storage on the main thread. */
function isBulkPostPayload(data: unknown): boolean {
  if (Array.isArray(data)) {
    return data.length > 0 && isPostLike(data[0]);
  }
  if (data && typeof data === 'object') {
    const values = Object.values(data as Record<string, unknown>);
    return values.length > 1 && isPostLike(values[0]);
  }
  return false;
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
  private notifyScheduled = false;

  constructor() {
    this.hydrateFromStorage();
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
    if (this.subscribers.size === 0 || this.notifyScheduled) return;

    this.notifyScheduled = true;
    const flush = () => {
      this.notifyScheduled = false;
      this.stats.entries = this.memoryCache.size;
      const currentStats = this.getStats();
      this.subscribers.forEach((cb) => {
        try {
          cb(currentStats);
        } catch {
          // Ignore subscriber errors
        }
      });
    };

    if (typeof window === 'undefined') {
      flush();
      return;
    }
    window.setTimeout(flush, 300);
  }

  /**
   * Hydrate in-memory cache from sessionStorage and localStorage on startup
   */
  private hydrateFromStorage() {
    if (typeof window === 'undefined') return;
    const now = Date.now();

    const loadStorage = (storage: Storage) => {
      try {
        const keys: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && key.startsWith(this.storagePrefix)) keys.push(key);
        }

        for (const key of keys) {
          const raw = storage.getItem(key);
          if (!raw || raw.length > MAX_PERSISTED_CHARS) {
            storage.removeItem(key);
            continue;
          }
          try {
            const entry: CacheEntry<any> = JSON.parse(raw);
            if (now - entry.timestamp < entry.ttl && !isBulkPostPayload(entry.data)) {
              this.memoryCache.set(key.replace(this.storagePrefix, ''), entry);
            } else {
              storage.removeItem(key);
            }
          } catch {
            storage.removeItem(key);
          }
        }
      } catch {
        // Fallback em caso de restrição de storage
      }
    };

    if (window.sessionStorage) loadStorage(window.sessionStorage);
    if (window.localStorage) loadStorage(window.localStorage);

    this.stats.entries = this.memoryCache.size;
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
      this.removeStorage(key, entry.persistent);
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
      this.removeStorage(key, entry.persistent);
      return false;
    }
    return true;
  }

  /**
   * Store item in memory and storage (localStorage if persistent, else sessionStorage)
   */
  public set<T>(key: string, data: T, ttlMs: number = 180000, persistent: boolean = false): void {
    if (ttlMs <= 0) return;

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
      persistent
    };

    this.memoryCache.set(key, entry);
    this.setStorage(key, entry);
    this.notify();
  }

  /**
   * Invalidate a specific cache key
   */
  public invalidate(key: string): void {
    const entry = this.memoryCache.get(key);
    this.memoryCache.delete(key);
    this.removeStorage(key, entry?.persistent);
    this.notify();
  }

  /**
   * Invalidate keys matching a pattern (string or RegExp)
   */
  public invalidatePattern(pattern: RegExp | string): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    for (const [key, entry] of this.memoryCache.entries()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        this.removeStorage(key, entry.persistent);
      }
    }
    this.notify();
  }

  /**
   * Purge all cached data
   */
  public clear(): void {
    this.memoryCache.clear();
    if (typeof window !== 'undefined') {
      const purge = (storage: Storage) => {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key && key.startsWith(this.storagePrefix)) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((k) => storage.removeItem(k));
        } catch {}
      };

      if (window.sessionStorage) purge(window.sessionStorage);
      if (window.localStorage) purge(window.localStorage);
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

  private setStorage(key: string, entry: CacheEntry<any>) {
    if (typeof window === 'undefined') return;
    if (isBulkPostPayload(entry.data)) return;
    try {
      const storage = entry.persistent ? window.localStorage : window.sessionStorage;
      if (!storage) return;
      const json = JSON.stringify(entry);
      if (json.length > MAX_PERSISTED_CHARS) return;
      storage.setItem(this.storagePrefix + key, json);
    } catch {
      // Storage cheio/desativado; o cache em memória continua operando
    }
  }

  private removeStorage(key: string, persistent?: boolean) {
    if (typeof window === 'undefined') return;
    try {
      if (persistent !== undefined) {
        const storage = persistent ? window.localStorage : window.sessionStorage;
        storage?.removeItem(this.storagePrefix + key);
      } else {
        window.sessionStorage?.removeItem(this.storagePrefix + key);
        window.localStorage?.removeItem(this.storagePrefix + key);
      }
    } catch {}
  }
}

export const apiCache = new ApiCacheManager();

/**
 * Standard TTL Presets (in milliseconds)
 */
export const CACHE_TTL = {
  NONE: 0,
  FAST: 15 * 1000,               // 15s (Blockchain dynamic global props)
  FEED: 5 * 60 * 1000,           // 5 minutos
  FEED_PAGE: 5 * 60 * 1000,      // 5 minutos
  DISCUSSION: 5 * 60 * 1000,     // 5 minutos
  ACCOUNT: 5 * 60 * 1000,        // 5 minutos
  COMMUNITY: 10 * 60 * 1000,     // 10 minutos
  TRENDING_TAGS: 7 * 24 * 60 * 60 * 1000 // 7 DIAS (1 semana)
};

const inflightFetches = new Map<string, Promise<unknown>>();

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
    persistent?: boolean;
  }
): Promise<T> {
  const bypass = options?.bypassCache || options?.forceRefresh;
  const ttl = options?.ttl ?? CACHE_TTL.FEED;
  const persistent = options?.persistent ?? false;

  if (!bypass) {
    const cached = apiCache.get<T>(cacheKey);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
    const pending = inflightFetches.get(cacheKey);
    if (pending) return pending as Promise<T>;
  }

  const promise = (async () => {
    const fresh = await fetchFn();
    if (ttl > 0 && fresh !== null && fresh !== undefined) {
      apiCache.set<T>(cacheKey, fresh, ttl, persistent);
    }
    return fresh;
  })();

  inflightFetches.set(cacheKey, promise);
  promise.finally(() => {
    if (inflightFetches.get(cacheKey) === promise) {
      inflightFetches.delete(cacheKey);
    }
  });

  return promise;
}
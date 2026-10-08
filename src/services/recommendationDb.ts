import { HivePost } from './hiveApi';

export interface CachedRecommendationRecord {
  account: string;
  posts: HivePost[];
  lastUpdated: number; // timestamp in ms
  seedKeys: string[];  // 'author/permlink' strings
  version: number;
}

const DB_NAME = 'nebulosa_recommendations_db';
const DB_VERSION = 1;
const STORE_NAME = 'user_recommendations';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'account' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open recommendations IndexedDB.'));
    };
  });
}

/**
 * Retrieve cached recommendations for a specific Hive account.
 */
export async function getRecommendationCache(account: string): Promise<CachedRecommendationRecord | null> {
  if (!account) return null;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(account);

      request.onsuccess = () => {
        resolve((request.result as CachedRecommendationRecord) || null);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to get recommendation cache.'));
      };
    });
  } catch (err) {
    console.warn('[recommendationDb] Error reading cache:', err);
    return null;
  }
}

/**
 * Save or update recommendations cache in IndexedDB.
 */
export async function saveRecommendationCache(record: CachedRecommendationRecord): Promise<void> {
  if (!record?.account) return;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(record);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to save recommendation cache.'));
      };
    });
  } catch (err) {
    console.warn('[recommendationDb] Error saving cache:', err);
  }
}

/**
 * Clear cached recommendations for an account.
 */
export async function clearRecommendationCache(account: string): Promise<void> {
  if (!account) return;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(account);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to clear recommendation cache.'));
      };
    });
  } catch (err) {
    console.warn('[recommendationDb] Error clearing cache:', err);
  }
}

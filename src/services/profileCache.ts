import type { HiveAccount, HivePost, HiveNotification } from './hiveApi';
import { apiCache } from './apiCache';

export interface CachedProfileData {
  account: HiveAccount | null;
  profile: any;
  blogPosts: HivePost[];
  posts: HivePost[];
  comments: HivePost[];
  replies: HivePost[];
  mentions: HiveNotification[];
  timestamp: number;
}

const MEMORY_PROFILE_CACHE = new Map<string, CachedProfileData>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache lifetime
const MAX_PROFILES = 10;

export function invalidateProfileCache(username: string): void {
  const clean = username.replace(/^@/, '').trim().toLowerCase();
  MEMORY_PROFILE_CACHE.delete(clean);
  try { window.sessionStorage.removeItem(`hive_prof_${clean}`); } catch { /* Storage unavailable. */ }
}

/** Publishing or reblogging must be visible on the next visit to the profile/feed. */
export function invalidateAccountContentCache(username: string): void {
  const clean = username.replace(/^@/, '').trim().toLowerCase();
  if (!clean) return;
  invalidateProfileCache(clean);
  apiCache.invalidate(`account:${clean}`);
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  apiCache.invalidatePattern(new RegExp(`^account_posts:[^:]+:${escaped}(?::|$)`));
  apiCache.invalidatePattern(/^(ranked_posts|followed_root_feed|followed_comments_feed|followed_mixed_feed):/);
}

function isFresh(entry: CachedProfileData): boolean {
  const age = Date.now() - entry?.timestamp;
  return Number.isFinite(age) && age >= 0 && age < CACHE_TTL_MS;
}

function remember(username: string, entry: CachedProfileData): void {
  MEMORY_PROFILE_CACHE.delete(username);
  MEMORY_PROFILE_CACHE.set(username, entry);
  while (MEMORY_PROFILE_CACHE.size > MAX_PROFILES) {
    MEMORY_PROFILE_CACHE.delete(MEMORY_PROFILE_CACHE.keys().next().value!);
  }
}

/**
 * Retrieves the cached profile snapshot for a username (instant SWR display)
 */
export function getProfileCache(username: string): CachedProfileData | null {
  const clean = (username || '').replace(/^@/, '').trim().toLowerCase();
  if (!clean) return null;

  // 1. In-memory check (fastest)
  const inMem = MEMORY_PROFILE_CACHE.get(clean);
  if (inMem && isFresh(inMem)) {
    remember(clean, inMem);
    return inMem;
  }
  MEMORY_PROFILE_CACHE.delete(clean);

  // 2. SessionStorage fallback
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(`hive_prof_${clean}`);
      if (raw) {
        const parsed: CachedProfileData = JSON.parse(raw);
        if (isFresh(parsed)) {
          remember(clean, parsed);
          return parsed;
        }
        window.sessionStorage.removeItem(`hive_prof_${clean}`);
      }
    }
  } catch {
    // Ignore storage issues
  }

  return null;
}

/**
 * Stores or updates cached profile data in memory and sessionStorage
 */
export function setProfileCache(
  username: string,
  data: Partial<CachedProfileData>
): void {
  const clean = (username || '').replace(/^@/, '').trim().toLowerCase();
  if (!clean) return;

  const existing = getProfileCache(clean) || {
    account: null,
    profile: null,
    blogPosts: [],
    posts: [],
    comments: [],
    replies: [],
    mentions: [],
    timestamp: Date.now()
  };

  const updated: CachedProfileData = {
    ...existing,
    ...data,
    // Updating any section must not renew the other sections in the snapshot.
    timestamp: existing.timestamp
  };

  remember(clean, updated);

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(
        `hive_prof_${clean}`,
        JSON.stringify({
          account: updated.account,
          profile: updated.profile,
          blogPosts: updated.blogPosts.slice(0, 20),
          posts: updated.posts.slice(0, 20),
          comments: updated.comments.slice(0, 20),
          replies: updated.replies.slice(0, 20),
          mentions: updated.mentions.slice(0, 20),
          timestamp: updated.timestamp
        })
      );
    }
  } catch {
    // Storage quota or private window protection
  }
}

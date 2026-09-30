import { HiveAccount, HivePost, HiveNotification } from './hiveApi';

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

/**
 * Retrieves the cached profile snapshot for a username (instant SWR display)
 */
export function getProfileCache(username: string): CachedProfileData | null {
  const clean = (username || '').replace(/^@/, '').trim().toLowerCase();
  if (!clean) return null;

  // 1. In-memory check (fastest)
  const inMem = MEMORY_PROFILE_CACHE.get(clean);
  if (inMem) {
    return inMem;
  }

  // 2. SessionStorage fallback
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(`hive_prof_${clean}`);
      if (raw) {
        const parsed: CachedProfileData = JSON.parse(raw);
        if (Date.now() - (parsed.timestamp || 0) < CACHE_TTL_MS * 4) {
          MEMORY_PROFILE_CACHE.set(clean, parsed);
          return parsed;
        }
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

  const existing = MEMORY_PROFILE_CACHE.get(clean) || {
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
    timestamp: Date.now()
  };

  MEMORY_PROFILE_CACHE.set(clean, updated);

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

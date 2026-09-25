import { HivePost } from '../services/hiveApi';

export interface ContentFilterConfig {
  words: string[];
  authors: string[];
  enabled: boolean;
}

export const STORAGE_KEY_WORDS = 'nebulosa_filter_words';
export const STORAGE_KEY_AUTHORS = 'nebulosa_filter_authors';
export const STORAGE_KEY_ENABLED = 'nebulosa_filter_enabled';

// Common spam / bot presets user can optionally add with one click
export const RECOMMENDED_WORD_PRESETS = [
  'airdrop',
  'giveaway',
  'free spin',
  'casino',
  't.me/',
  'scrobblelife',
  'dashboard/games',
  'token presale'
];

/**
 * Load filter configuration from localStorage with safe fallback defaults
 */
export function loadFilterConfig(): ContentFilterConfig {
  try {
    const savedWords = localStorage.getItem(STORAGE_KEY_WORDS);
    const savedAuthors = localStorage.getItem(STORAGE_KEY_AUTHORS);
    const savedEnabled = localStorage.getItem(STORAGE_KEY_ENABLED);

    const words: string[] = savedWords ? JSON.parse(savedWords) : [];
    const authors: string[] = savedAuthors ? JSON.parse(savedAuthors) : [];
    const enabled = savedEnabled !== null ? savedEnabled === 'true' : true;

    return {
      words: Array.isArray(words) ? words.map(w => w.trim().toLowerCase()).filter(Boolean) : [],
      authors: Array.isArray(authors) ? authors.map(a => a.trim().toLowerCase().replace(/^@/, '')).filter(Boolean) : [],
      enabled
    };
  } catch (err) {
    console.error('Failed to load content filter config from localStorage:', err);
    return { words: [], authors: [], enabled: true };
  }
}

/**
 * Persist words list to localStorage
 */
export function saveFilterWords(words: string[]): void {
  try {
    const clean = Array.from(new Set(words.map(w => w.trim().toLowerCase()).filter(Boolean)));
    localStorage.setItem(STORAGE_KEY_WORDS, JSON.stringify(clean));
  } catch (err) {
    console.error('Failed to save filter words to localStorage:', err);
  }
}

/**
 * Persist authors list to localStorage
 */
export function saveFilterAuthors(authors: string[]): void {
  try {
    const clean = Array.from(new Set(authors.map(a => a.trim().toLowerCase().replace(/^@/, '')).filter(Boolean)));
    localStorage.setItem(STORAGE_KEY_AUTHORS, JSON.stringify(clean));
  } catch (err) {
    console.error('Failed to save filter authors to localStorage:', err);
  }
}

/**
 * Persist filter enabled toggle to localStorage
 */
export function saveFilterEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
  } catch (err) {
    console.error('Failed to save filter enabled to localStorage:', err);
  }
}

export interface FilterResult {
  filtered: boolean;
  reason?: 'author' | 'word';
  matchedWord?: string;
  matchedAuthor?: string;
}

/**
 * Check if a single Hive post matches any blocked author or word/tag
 */
export function checkPostFiltered(post: HivePost, config: ContentFilterConfig): FilterResult {
  if (!config.enabled) {
    return { filtered: false };
  }

  // 1. Author Filter
  const postAuthor = (post.author || '').toLowerCase().trim().replace(/^@/, '');
  if (postAuthor && config.authors.includes(postAuthor)) {
    return {
      filtered: true,
      reason: 'author',
      matchedAuthor: postAuthor
    };
  }

  // 2. Word / Tag / Keyword Filter
  if (config.words.length > 0) {
    const titleLower = (post.title || '').toLowerCase();
    const bodyLower = (post.body || '').toLowerCase();
    const catLower = (post.category || '').toLowerCase();

    // Extract tags safely from json_metadata
    const postTags: string[] = [];
    if (post.json_metadata) {
      if (typeof post.json_metadata === 'object' && Array.isArray(post.json_metadata?.tags)) {
        postTags.push(...post.json_metadata.tags.map((t: any) => String(t).toLowerCase()));
      } else if (typeof post.json_metadata === 'string') {
        try {
          const parsed = JSON.parse(post.json_metadata);
          if (Array.isArray(parsed?.tags)) {
            postTags.push(...parsed.tags.map((t: any) => String(t).toLowerCase()));
          }
        } catch {}
      }
    }

    for (const rawWord of config.words) {
      const word = rawWord.trim().toLowerCase();
      if (!word) continue;

      // Check title
      if (titleLower.includes(word)) {
        return { filtered: true, reason: 'word', matchedWord: word };
      }

      // Check category
      if (catLower === word || catLower.includes(word)) {
        return { filtered: true, reason: 'word', matchedWord: word };
      }

      // Check tags
      if (postTags.some(t => t === word || (word.length >= 3 && t.includes(word)))) {
        return { filtered: true, reason: 'word', matchedWord: word };
      }

      // Check body
      if (bodyLower.includes(word)) {
        return { filtered: true, reason: 'word', matchedWord: word };
      }
    }
  }

  return { filtered: false };
}

/**
 * Filters an array of posts, returning visible posts and detailed count of hidden items
 */
export function applyContentFilter(
  posts: HivePost[],
  config: ContentFilterConfig
): {
  visiblePosts: HivePost[];
  hiddenPosts: HivePost[];
  hiddenByAuthorCount: number;
  hiddenByWordCount: number;
  totalHiddenCount: number;
} {
  if (!config.enabled || (config.words.length === 0 && config.authors.length === 0)) {
    return {
      visiblePosts: posts,
      hiddenPosts: [],
      hiddenByAuthorCount: 0,
      hiddenByWordCount: 0,
      totalHiddenCount: 0
    };
  }

  const visiblePosts: HivePost[] = [];
  const hiddenPosts: HivePost[] = [];
  let hiddenByAuthorCount = 0;
  let hiddenByWordCount = 0;

  for (const post of posts) {
    const res = checkPostFiltered(post, config);
    if (res.filtered) {
      hiddenPosts.push(post);
      if (res.reason === 'author') {
        hiddenByAuthorCount++;
      } else if (res.reason === 'word') {
        hiddenByWordCount++;
      }
    } else {
      visiblePosts.push(post);
    }
  }

  return {
    visiblePosts,
    hiddenPosts,
    hiddenByAuthorCount,
    hiddenByWordCount,
    totalHiddenCount: hiddenPosts.length
  };
}

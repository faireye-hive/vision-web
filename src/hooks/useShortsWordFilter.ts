import { useCallback, useState } from 'react';

const WORDS_KEY = 'hive_shorts_blocked_words';
const ENABLED_KEY = 'hive_shorts_filter_enabled';

export type ShortsSource = 'all' | 'following' | 'replies';

function readBlockedWords(): string[] {
  try {
    const saved = localStorage.getItem(WORDS_KEY);
    return saved ? JSON.parse(saved) : ['giveaway', 'airdrop'];
  } catch {
    return ['giveaway', 'airdrop'];
  }
}

function readFilterEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

/**
 * Word filter for the Shorts column. Kept out of App so the preference
 * logic can change without touching layout or routing.
 */
export function useShortsWordFilter() {
  const [blockedWords, setBlockedWords] = useState<string[]>(readBlockedWords);
  const [filterEnabled, setFilterEnabled] = useState<boolean>(readFilterEnabled);
  const [hashtags, setHashtags] = useState<{ tag: string; count: number }[]>([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [hiddenCount, setHiddenCount] = useState(0);
  const [source, setSource] = useState<ShortsSource>('all');

  const addWord = useCallback((word: string) => {
    const clean = word.trim().toLowerCase();
    if (!clean) return;
    setBlockedWords((prev) => {
      if (prev.includes(clean)) return prev;
      const next = [...prev, clean];
      try {
        localStorage.setItem(WORDS_KEY, JSON.stringify(next));
      } catch {
        // Storage can be unavailable in private mode.
      }
      return next;
    });
  }, []);

  const removeWord = useCallback((word: string) => {
    setBlockedWords((prev) => {
      const next = prev.filter((item) => item !== word);
      try {
        localStorage.setItem(WORDS_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage failures.
      }
      return next;
    });
  }, []);

  const clearWords = useCallback(() => {
    setBlockedWords([]);
    try {
      localStorage.setItem(WORDS_KEY, JSON.stringify([]));
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const toggleEnabled = useCallback(() => {
    setFilterEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(ENABLED_KEY, String(next));
      } catch {
        // Ignore storage failures.
      }
      return next;
    });
  }, []);

  return {
    blockedWords,
    filterEnabled,
    hashtags,
    setHashtags,
    selectedTag,
    setSelectedTag,
    source,
    setSource,
    hiddenCount,
    setHiddenCount,
    addWord,
    removeWord,
    clearWords,
    toggleEnabled,
  };
}

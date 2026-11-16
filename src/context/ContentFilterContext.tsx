import { useAuth } from './AuthContext';
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import {
  ContentFilterConfig,
  loadFilterConfig,
  saveFilterWords,
  saveFilterAuthors,
  saveFilterEnabled,
  applyContentFilter,
  checkPostFiltered,
  FilterResult
} from '../utils/contentFilter';
import { HivePost } from '../services/hiveApi';
import { loadCommunityCatalog } from '../services/communityCatalog';
import { isNsfwContent } from '../utils/nsfw';

export interface ContentFilterContextType {
  config: ContentFilterConfig;
  showNsfw: boolean;
  setShowNsfw: (show: boolean) => void;
  nsfwCommunities: ReadonlySet<string> | null;
  isAuthorHidden: (author: string) => boolean;
  addFilterWord: (word: string) => void;
  removeFilterWord: (word: string) => void;
  clearFilterWords: () => void;
  addFilterAuthor: (author: string) => void;
  removeFilterAuthor: (author: string) => void;
  clearFilterAuthors: () => void;
  toggleFilterEnabled: () => void;
  isPostFiltered: (post: HivePost) => FilterResult;
  filterPostsList: (posts: HivePost[]) => {
    visiblePosts: HivePost[];
    totalHiddenCount: number;
    hiddenByWordCount: number;
    hiddenByAuthorCount: number;
  };
}

const ContentFilterContext = createContext<ContentFilterContextType | undefined>(undefined);
const NSFW_STORAGE_KEY = 'nebulosa_show_nsfw';

export function ContentFilterProvider({ children }: { children: React.ReactNode }) {
  const { mutedUsersList, mutedUsersLoading } = useAuth();
  const mutedAuthors = useMemo(() => new Set(mutedUsersList.map(name => name.trim().replace(/^@/, '').toLowerCase())), [mutedUsersList]);
  const [config, setConfig] = useState<ContentFilterConfig>(() => loadFilterConfig());
  const [showNsfw, setShowNsfwState] = useState(() => {
    try { return localStorage.getItem(NSFW_STORAGE_KEY) === 'true'; }
    catch { return false; }
  });
  const [nsfwCommunities, setNsfwCommunities] = useState<ReadonlySet<string> | null>(null);

  useEffect(() => {
    if (showNsfw || nsfwCommunities !== null) return;
    let active = true;
    loadCommunityCatalog()
      .then(communities => communities.filter(isNsfwContent).map(community => community.name))
      .catch(() => [] as string[])
      .then(names => { if (active) setNsfwCommunities(new Set(names)); });
    return () => { active = false; };
  }, [showNsfw, nsfwCommunities]);

  const setShowNsfw = useCallback((show: boolean) => {
    setShowNsfwState(show);
    try { localStorage.setItem(NSFW_STORAGE_KEY, String(show)); }
    catch { /* Keep the preference in memory if storage is unavailable. */ }
  }, []);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === NSFW_STORAGE_KEY || event.key === null) setShowNsfwState(event.newValue === 'true');
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const addFilterWord = useCallback((word: string) => {
    const clean = word.trim().toLowerCase();
    if (!clean) return;
    setConfig((prev) => {
      if (prev.words.includes(clean)) return prev;
      const nextWords = [...prev.words, clean];
      saveFilterWords(nextWords);
      return { ...prev, words: nextWords };
    });
  }, []);

  const removeFilterWord = useCallback((word: string) => {
    setConfig((prev) => {
      const nextWords = prev.words.filter((w) => w !== word);
      saveFilterWords(nextWords);
      return { ...prev, words: nextWords };
    });
  }, []);

  const clearFilterWords = useCallback(() => {
    saveFilterWords([]);
    setConfig((prev) => ({ ...prev, words: [] }));
  }, []);

  const addFilterAuthor = useCallback((author: string) => {
    const clean = author.trim().toLowerCase().replace(/^@/, '');
    if (!clean) return;
    setConfig((prev) => {
      if (prev.authors.includes(clean)) return prev;
      const nextAuthors = [...prev.authors, clean];
      saveFilterAuthors(nextAuthors);
      return { ...prev, authors: nextAuthors };
    });
  }, []);

  const removeFilterAuthor = useCallback((author: string) => {
    setConfig((prev) => {
      const nextAuthors = prev.authors.filter((a) => a !== author);
      saveFilterAuthors(nextAuthors);
      return { ...prev, authors: nextAuthors };
    });
  }, []);

  const clearFilterAuthors = useCallback(() => {
    saveFilterAuthors([]);
    setConfig((prev) => ({ ...prev, authors: [] }));
  }, []);

  const toggleFilterEnabled = useCallback(() => {
    setConfig((prev) => {
      const nextEnabled = !prev.enabled;
      saveFilterEnabled(nextEnabled);
      return { ...prev, enabled: nextEnabled };
    });
  }, []);

  const isPostFiltered = useCallback(
    (post: HivePost) => {
      return mutedUsersLoading ? { filtered: true, reason: 'author' as const } : checkPostFiltered(post, config, mutedAuthors);
    },
    [config, mutedAuthors, mutedUsersLoading]
  );

  const filterPostsList = useCallback(
    (posts: HivePost[]) => {
      return applyContentFilter(mutedUsersLoading ? [] : posts, config, mutedAuthors);
    },
    [config, mutedAuthors, mutedUsersLoading]
  );

  const isAuthorHidden = useCallback((author: string) => {
    const clean = author.trim().replace(/^@/, '').toLowerCase();
    return mutedUsersLoading || mutedAuthors.has(clean) || (config.enabled && config.authors.includes(clean));
  }, [mutedAuthors, config, mutedUsersLoading]);

  const value = useMemo(
    () => ({
      config,
      showNsfw,
      setShowNsfw,
      nsfwCommunities,
      isAuthorHidden,
      addFilterWord,
      removeFilterWord,
      clearFilterWords,
      addFilterAuthor,
      removeFilterAuthor,
      clearFilterAuthors,
      toggleFilterEnabled,
      isPostFiltered,
      filterPostsList,
    }),
    [
      config,
      showNsfw,
      setShowNsfw,
      nsfwCommunities,
      isAuthorHidden,
      addFilterWord,
      removeFilterWord,
      clearFilterWords,
      addFilterAuthor,
      removeFilterAuthor,
      clearFilterAuthors,
      toggleFilterEnabled,
      isPostFiltered,
      filterPostsList,
    ]
  );

  return (
    <ContentFilterContext.Provider value={value}>
      {children}
    </ContentFilterContext.Provider>
  );
}

export function useContentFilter() {
  const context = useContext(ContentFilterContext);
  if (!context) {
    throw new Error('useContentFilter must be used within a ContentFilterProvider');
  }
  return context;
}

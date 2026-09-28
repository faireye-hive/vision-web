import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
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

export interface ContentFilterContextType {
  config: ContentFilterConfig;
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

export function ContentFilterProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ContentFilterConfig>(() => loadFilterConfig());

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
      return checkPostFiltered(post, config);
    },
    [config]
  );

  const filterPostsList = useCallback(
    (posts: HivePost[]) => {
      return applyContentFilter(posts, config);
    },
    [config]
  );

  const value = useMemo(
    () => ({
      config,
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

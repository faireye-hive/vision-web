import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { HivePost } from '../services/hiveApi';

export interface BookmarksContextType {
  bookmarks: HivePost[];
  isBookmarked: (author: string, permlink: string) => boolean;
  toggleBookmark: (post: HivePost) => boolean;
  removeBookmark: (author: string, permlink: string) => void;
  clearBookmarks: () => void;
  bookmarksCount: number;
}

const STORAGE_KEY = 'nebulosa_bookmarked_posts';

const BookmarksContext = createContext<BookmarksContextType | undefined>(undefined);

export function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const [bookmarks, setBookmarks] = useState<HivePost[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load bookmarks from storage:', e);
      return [];
    }
  });

  const bookmarkedKeys = useMemo(() => {
    return new Set(bookmarks.map((p) => `${p.author}/${p.permlink}`));
  }, [bookmarks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    } catch (e) {
      console.error('Failed to save bookmarks to storage:', e);
    }
  }, [bookmarks]);

  const isBookmarked = useCallback(
    (author: string, permlink: string) => {
      const cleanAuthor = author.replace(/^@/, '').trim().toLowerCase();
      const cleanPermlink = permlink.trim();
      return bookmarkedKeys.has(`${cleanAuthor}/${cleanPermlink}`);
    },
    [bookmarkedKeys]
  );

  const toggleBookmark = useCallback((post: HivePost) => {
    const key = `${post.author}/${post.permlink}`;
    let added = false;
    setBookmarks((prev) => {
      const exists = prev.some((p) => `${p.author}/${p.permlink}` === key);
      if (exists) {
        added = false;
        return prev.filter((p) => `${p.author}/${p.permlink}` !== key);
      } else {
        added = true;
        return [post, ...prev];
      }
    });
    return added;
  }, []);

  const removeBookmark = useCallback((author: string, permlink: string) => {
    const cleanAuthor = author.replace(/^@/, '').trim().toLowerCase();
    const cleanPermlink = permlink.trim();
    setBookmarks((prev) =>
      prev.filter(
        (p) => !(p.author.toLowerCase() === cleanAuthor && p.permlink === cleanPermlink)
      )
    );
  }, []);

  const clearBookmarks = useCallback(() => {
    setBookmarks([]);
  }, []);

  return (
    <BookmarksContext.Provider
      value={{
        bookmarks,
        isBookmarked,
        toggleBookmark,
        removeBookmark,
        clearBookmarks,
        bookmarksCount: bookmarks.length,
      }}
    >
      {children}
    </BookmarksContext.Provider>
  );
}

export function useBookmarks() {
  const context = useContext(BookmarksContext);
  if (!context) {
    throw new Error('useBookmarks must be used within a BookmarksProvider');
  }
  return context;
}

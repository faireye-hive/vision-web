import React, { useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { HivePost } from '../services/hiveApi';
import { ShortsFeed } from '../components/ShortsFeed';
import { ShortDetailView } from '../components/ShortDetailView';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { ShortsSource } from '../hooks/useShortsWordFilter';

const SCROLL_KEY = 'nebulosa_shorts_scroll';

function currentScroll(): number {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

function writeScroll(y: number) {
  try {
    sessionStorage.setItem(SCROLL_KEY, String(Math.max(0, Math.round(y))));
  } catch {
    // sessionStorage can be blocked.
  }
}

function applyScroll(y: number) {
  window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
  document.documentElement.scrollTop = y;
  document.body.scrollTop = y;
}

function readScroll(): number {
  try {
    const value = Number(sessionStorage.getItem(SCROLL_KEY) || '');
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

interface ShortsPageProps {
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  blockedWords: string[];
  blockedAuthors?: string[];
  onAddWord?: (word: string) => void;
  onRemoveWord?: (word: string) => void;
  onClearWords?: () => void;
  onAddAuthor?: (author: string) => void;
  onRemoveAuthor?: (author: string) => void;
  onClearAuthors?: () => void;
  filterEnabled: boolean;
  onHashtagsExtracted: (tags: { tag: string; count: number }[]) => void;
  onHiddenCountChange: (count: number) => void;
  onToggleFilter?: () => void;
  source?: ShortsSource;
  onSourceChange?: (source: ShortsSource) => void;
}

export const ShortsPage: React.FC<ShortsPageProps> = ({
  selectedTag,
  onSelectTag,
  blockedWords,
  blockedAuthors = [],
  onAddWord,
  onRemoveWord,
  onClearWords,
  onAddAuthor,
  onRemoveAuthor,
  onClearAuthors,
  filterEnabled,
  onHashtagsExtracted,
  onHiddenCountChange,
  onToggleFilter,
  source = 'all',
  onSourceChange
}) => {
  const { currentUser } = useAuth();
  const { handleSelectAuthor, selectedPost, handleClosePost } = useNavigation();
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const holdScrollRef = useRef(false);
  const [discussionMap, setDiscussionMap] = React.useState<Record<string, HivePost>>({});
  const snapKey = selectedPost ? `${selectedPost.author}/${selectedPost.permlink}` : '';

  const rememberScroll = useCallback(() => {
    holdScrollRef.current = true;
    writeScroll(currentScroll());
  }, []);

  useEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    return () => {
      history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (holdScrollRef.current) {
        const saved = readScroll();
        if (!snapKey && saved > 80 && currentScroll() < 20) applyScroll(saved);
        return;
      }
      writeScroll(currentScroll());
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [snapKey]);

  useLayoutEffect(() => {
    if (snapKey) return;
    const y = readScroll();
    if (!holdScrollRef.current) return;

    let stopped = false;
    const apply = () => {
      if (stopped || y <= 0) return;
      if (Math.abs(currentScroll() - y) > 4) applyScroll(y);
    };
    apply();
    const frame = requestAnimationFrame(apply);
    const timers = [0, 40, 120, 280, 450].map((ms) => window.setTimeout(apply, ms));
    const release = window.setTimeout(() => {
      holdScrollRef.current = false;
    }, 520);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(release);
    };
  }, [snapKey]);

  return (
    <div className="relative">
      {/* Detail View Overlay Page */}
      {selectedPost && (
        <div className="fixed inset-0 z-35 overflow-y-auto overscroll-contain bg-white dark:bg-slate-900 sm:bg-[var(--ambient-bg,#f7f8fa)]">
          <div className="max-w-[1440px] mx-auto px-0 sm:px-6 pt-0 sm:pt-20 pb-36 sm:pb-12 min-h-screen">
            <ShortDetailView
              snap={selectedPost}
              initialDiscussionMap={discussionMap}
              onUpdateDiscussionMap={(newMap) => setDiscussionMap((prev) => ({ ...prev, ...newMap }))}
              currentUser={currentUser}
              onBack={handleClosePost}
              onSelectAuthor={handleSelectAuthor}
              onSelectTag={onSelectTag}
              onRequireLogin={() => {
                window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
              }}
            />
          </div>
        </div>
      )}

      <div
        ref={feedContainerRef}
        inert={selectedPost ? true : undefined}
        aria-hidden={selectedPost ? true : undefined}
        className="space-y-4"
      >
        <ShortsFeed
          currentUser={currentUser}
          onSelectAuthor={handleSelectAuthor}
          onRequireLogin={() => {
            window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
          }}
          selectedTag={selectedTag}
          onSelectTag={onSelectTag}
          blockedWords={blockedWords}
          blockedAuthors={blockedAuthors}
          onAddWord={onAddWord}
          onRemoveWord={onRemoveWord}
          onClearWords={onClearWords}
          onAddAuthor={onAddAuthor}
          onRemoveAuthor={onRemoveAuthor}
          onClearAuthors={onClearAuthors}
          filterEnabled={filterEnabled}
          onHashtagsExtracted={onHashtagsExtracted}
          onHiddenCountChange={onHiddenCountChange}
          onToggleFilter={onToggleFilter}
          onDiscussionMapLoaded={setDiscussionMap}
          onBeforeOpenDetail={rememberScroll}
          source={source}
          onSourceChange={onSourceChange}
          isDetailOpen={Boolean(selectedPost)}
        />
      </div>
    </div>
  );
};

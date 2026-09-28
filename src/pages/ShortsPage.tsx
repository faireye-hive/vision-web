import React, { useEffect, useRef } from 'react';
import { HivePost } from '../services/hiveApi';
import { ShortsFeed } from '../components/ShortsFeed';
import { ShortDetailView } from '../components/ShortDetailView';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';

interface ShortsPageProps {
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  blockedWords: string[];
  filterEnabled: boolean;
  onHashtagsExtracted: (tags: { tag: string; count: number }[]) => void;
  onHiddenCountChange: (count: number) => void;
  onToggleFilter?: () => void;
}

export const ShortsPage: React.FC<ShortsPageProps> = ({
  selectedTag,
  onSelectTag,
  blockedWords,
  filterEnabled,
  onHashtagsExtracted,
  onHiddenCountChange,
  onToggleFilter
}) => {
  const { currentUser } = useAuth();
  const { handleSelectAuthor, selectedPost, handleClosePost } = useNavigation();
  const scrollPosRef = useRef<number>(0);
  const [discussionMap, setDiscussionMap] = React.useState<Record<string, HivePost>>({});

  // Improved scroll restoration
  useEffect(() => {
    if (selectedPost) {
      scrollPosRef.current = window.scrollY;
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      // We are coming back to the feed
      // Using a slightly longer timeout + double RAF to ensure DOM is ready
      const timer = setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo({ top: scrollPosRef.current, behavior: 'instant' });
          });
        });
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [selectedPost]);

  return (
    <div className="relative" style={{ minHeight: selectedPost ? `${scrollPosRef.current + 1000}px` : 'auto' }}>
      {/* Detail View Overlay Page */}
      {selectedPost && (
        <div className="mb-6">
          <ShortDetailView
            snap={selectedPost}
            initialDiscussionMap={discussionMap}
            currentUser={currentUser}
            onBack={handleClosePost}
            onSelectAuthor={handleSelectAuthor}
            onSelectTag={onSelectTag}
            onRequireLogin={() => {
              window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
            }}
          />
        </div>
      )}

      {/* Main Feed Container - Kept mounted but hidden to preserve state & scroll */}
      <div className={selectedPost ? 'hidden' : 'block space-y-4'}>
        <ShortsFeed
          currentUser={currentUser}
          onSelectAuthor={handleSelectAuthor}
          onRequireLogin={() => {
            window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
          }}
          selectedTag={selectedTag}
          onSelectTag={onSelectTag}
          blockedWords={blockedWords}
          filterEnabled={filterEnabled}
          onHashtagsExtracted={onHashtagsExtracted}
          onHiddenCountChange={onHiddenCountChange}
          onToggleFilter={onToggleFilter}
          onDiscussionMapLoaded={setDiscussionMap}
        />
      </div>
    </div>
  );
};

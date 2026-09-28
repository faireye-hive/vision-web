import React from 'react';
import { ShortsFeed } from '../components/ShortsFeed';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';

interface ShortsPageProps {
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  blockedWords: string[];
  filterEnabled: boolean;
  onHashtagsExtracted: (tags: { tag: string; count: number }[]) => void;
  onHiddenCountChange: (count: number) => void;
}

export const ShortsPage: React.FC<ShortsPageProps> = ({
  selectedTag,
  onSelectTag,
  blockedWords,
  filterEnabled,
  onHashtagsExtracted,
  onHiddenCountChange
}) => {
  const { currentUser } = useAuth();
  const { handleSelectAuthor } = useNavigation();

  return (
    <div className="space-y-4">
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
      />
    </div>
  );
};

import { Sparkles } from 'lucide-react';
import { HivePost } from '../services/hiveApi';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { CommunityInfoCard } from './CommunityInfoCard';
import { CommunityTopicsCard } from './CommunityTopicsCard';
import { SubscribedCommunitiesCard } from './SubscribedCommunitiesCard';
import { TrendingTopicsCard } from './TrendingTopicsCard';
import { RecommendedUsersCard } from './RecommendedUsersCard';
import { ShortsWordFilterCard } from './ShortsWordFilterCard';
import { ReadingStyleCard } from './ReadingStyleCard';

interface RightRailProps {
  discoverPosts: HivePost[];
  communityPosts: HivePost[];
  blockedWords: string[];
  shortsFilterEnabled: boolean;
  shortsHiddenCount: number;
  onAddBlockedWord: (word: string) => void;
  onRemoveBlockedWord: (word: string) => void;
  onClearBlockedWords: () => void;
  onToggleShortsFilter: () => void;
}

export function RightRail({
  discoverPosts,
  communityPosts,
  blockedWords,
  shortsFilterEnabled,
  shortsHiddenCount,
  onAddBlockedWord,
  onRemoveBlockedWord,
  onClearBlockedWords,
  onToggleShortsFilter,
}: RightRailProps) {
  const {
    activeNav,
    tag,
    sort,
    setTag,
    setFeedAuthor,
    handleSelectAuthor,
    feedAuthor,
    openCommunity,
    setCommunitySubTopic,
  } = useNavigation();
  const { currentUser, followingUsersList, setFollowingUsersList } = useAuth();

  if (activeNav === 'shorts') {
    return (
      <>
        <ReadingStyleCard />
        <ShortsWordFilterCard
          blockedWords={blockedWords}
          onAddWord={onAddBlockedWord}
          onRemoveWord={onRemoveBlockedWord}
          onClearAll={onClearBlockedWords}
          filterEnabled={shortsFilterEnabled}
          onToggleFilter={onToggleShortsFilter}
          hiddenCount={shortsHiddenCount}
        />

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/60 dark:border-slate-800 space-y-3 text-gray-900 dark:text-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">About Shorts</h3>
          </div>
          <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed">
            Shorts brings decentralized microblogging to Hive. Snaps are published by community members directly as comments under container posts by <span className="font-semibold text-gray-800 dark:text-slate-200">@peak.snaps</span>.
          </p>
          <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-2 text-xs text-gray-500 dark:text-slate-400">
            <div className="flex items-center justify-between">
              <span>Protocol</span>
              <span className="font-semibold text-gray-800 dark:text-slate-200">PeakD Snaps</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Source</span>
              <span className="font-semibold text-gray-800 dark:text-slate-200">@peak.snaps</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Feed Type</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">Twitter-like Stream</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (activeNav === 'communities') {
    if (tag && tag.startsWith('hive-')) {
      return (
        <>
          <ReadingStyleCard />
          <CommunityInfoCard communityName={tag} onSelectAuthor={handleSelectAuthor} />
          <CommunityTopicsCard communityPosts={communityPosts} currentTag={tag} />
        </>
      );
    }
    return (
      <>
        <ReadingStyleCard />
        <SubscribedCommunitiesCard
          onSelectCommunity={(commName) => {
            openCommunity(commName);
            setCommunitySubTopic('');
          }}
        />
      </>
    );
  }

  if (activeNav === 'discover') {
    return (
      <>
        <ReadingStyleCard />
        <TrendingTopicsCard
          currentTag={tag}
          currentSort={sort}
          feedPosts={discoverPosts}
          onSelectTag={(newTag) => {
            setTag(newTag);
            setFeedAuthor(null);
          }}
        />
      </>
    );
  }

  return (
    <>
    <ReadingStyleCard />
    <RecommendedUsersCard
      currentUser={currentUser}
      feedPosts={[]}
      onSelectAuthor={handleSelectAuthor}
      activeAuthor={feedAuthor}
      followingUsers={followingUsersList}
      onFollowChange={(targetUser, isNowFollowing) => {
        setFollowingUsersList((prev) => {
          const targetLower = targetUser.toLowerCase();
          if (isNowFollowing) {
            return prev.some((user) => user.toLowerCase() === targetLower) ? prev : [...prev, targetUser];
          }
          return prev.filter((user) => user.toLowerCase() !== targetLower);
        });
      }}
    />
    </>
  );
}

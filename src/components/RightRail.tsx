import { Compass, Layers, Sparkles } from 'lucide-react';
import { HivePost } from '../services/hiveApi';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { CommunityInfoCard } from './CommunityInfoCard';
import { CommunityTopicsCard } from './CommunityTopicsCard';
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
    standalonePage,
  } = useNavigation();
  const { currentUser, followingUsersList, setFollowingUsersList } = useAuth();

  if (activeNav === 'shorts') {
    return (
      <div className="w-full space-y-3">
        <ReadingStyleCard neutralAccent />
        <ShortsWordFilterCard
          blockedWords={blockedWords}
          onAddWord={onAddBlockedWord}
          onRemoveWord={onRemoveBlockedWord}
          onClearAll={onClearBlockedWords}
          filterEnabled={shortsFilterEnabled}
          onToggleFilter={onToggleShortsFilter}
          hiddenCount={shortsHiddenCount}
        />

        <div className="space-y-2.5 rounded-2xl border border-slate-200/70 bg-white p-3 text-gray-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">About Shorts</h3>
          </div>
          <p className="text-xs leading-relaxed text-gray-600 dark:text-slate-400">
            Short posts published on Hive through <span className="font-semibold text-gray-800 dark:text-slate-200">@peak.snaps</span>.
          </p>
          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>Hive microblog</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">PeakD Snaps</span>
          </div>
        </div>
      </div>
    );
  }

  if (activeNav === 'communities') {
    if (standalonePage === 'explore' || standalonePage === 'manage') {
      const exploring = standalonePage === 'explore';
      return (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {exploring ? <Compass className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {exploring ? 'Community directory' : 'Your communities'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {exploring ? 'Find a space that fits your interests.' : 'Manage the communities you follow.'}
              </p>
            </div>
          </div>
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-400">
            {exploring
              ? 'Browse the cached directory by topic or language. Search Hive when you need communities beyond the local list.'
              : 'Your followed communities stay available in the left sidebar for quick access.'}
          </p>
        </section>
      );
    }
    if (tag && tag.startsWith('hive-')) {
      return (
        <>
          <CommunityInfoCard communityName={tag} onSelectAuthor={handleSelectAuthor} />
          <CommunityTopicsCard communityPosts={communityPosts} currentTag={tag} />
        </>
      );
    }
    return <CommunityTopicsCard communityPosts={communityPosts} currentTag={tag} />;
  }

  if (activeNav === 'discover') {
    return (
      <>
        <ReadingStyleCard neutralAccent />
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

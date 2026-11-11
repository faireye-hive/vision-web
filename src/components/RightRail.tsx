import { Compass, Highlighter, Layers, Sparkles, Trash2, X } from 'lucide-react';
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
  isPostReading?: boolean;
  highlightedTexts: Array<{ id: string; text: string }>;
  onSelectHighlightedText: (id: string) => void;
  onRemoveHighlightedText: (id: string) => void;
  onClearHighlightedTexts: () => void;
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
  isPostReading = false,
  highlightedTexts,
  onSelectHighlightedText,
  onRemoveHighlightedText,
  onClearHighlightedTexts,
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

  const highlightedTextsCard = isPostReading && highlightedTexts.length > 0 ? (
    <section className="space-y-2 rounded-2xl border border-amber-200/70 bg-white p-3 shadow-sm dark:border-amber-900/50 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Highlighter className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">Marked passages</h3>
        </div>
        <div className="flex items-center gap-1">
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            {highlightedTexts.length}
          </span>
          <button
            type="button"
            onClick={onClearHighlightedTexts}
            aria-label="Clear all marked passages"
            title="Clear all marked passages"
            className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="post-sidebar-scroll-list space-y-1">
        {highlightedTexts.map((highlight) => (
          <div key={highlight.id} className="group flex items-start gap-1 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/30">
            <button
              type="button"
              onClick={() => onSelectHighlightedText(highlight.id)}
              title="Jump to marked passage"
              className="min-w-0 flex-1 rounded-xl px-2 py-2 text-left text-xs leading-relaxed text-slate-600 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 dark:text-slate-300 dark:hover:text-white"
            >
              <span className="line-clamp-3 break-words">{highlight.text}</span>
            </button>
            <button
              type="button"
              onClick={() => onRemoveHighlightedText(highlight.id)}
              aria-label="Remove marked passage"
              title="Remove marked passage"
              className="mr-1 mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-60 transition hover:bg-rose-100 hover:text-rose-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 group-hover:opacity-100 dark:hover:bg-rose-950/50 dark:hover:text-rose-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  ) : null;

  if (activeNav === 'shorts') {
    return (
      <div className="w-full space-y-3">
        <ReadingStyleCard neutralAccent />
        {highlightedTextsCard}
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
          {highlightedTextsCard}
          <CommunityInfoCard communityName={tag} onSelectAuthor={handleSelectAuthor} />
          <CommunityTopicsCard communityPosts={communityPosts} currentTag={tag} />
        </>
      );
    }
    return (
      <>
        {highlightedTextsCard}
        <CommunityTopicsCard communityPosts={communityPosts} currentTag={tag} />
      </>
    );
  }

  if (activeNav === 'discover') {
    return (
      <>
        <ReadingStyleCard neutralAccent />
        {highlightedTextsCard}
        {!isPostReading && (
          <TrendingTopicsCard
            currentTag={tag}
            currentSort={sort}
            feedPosts={discoverPosts}
            onSelectTag={(newTag) => {
              setTag(newTag);
              setFeedAuthor(null);
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
    <ReadingStyleCard />
    {highlightedTextsCard}
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

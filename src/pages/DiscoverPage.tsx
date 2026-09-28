import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  RefreshCw,
  X,
  Zap,
  SlidersHorizontal,
  ShieldAlert,
  EyeOff,
  Compass
} from 'lucide-react';
import {
  HivePost,
  getRankedPosts,
  getCachedRankedPosts
} from '../services/hiveApi';
import { getLanguageDiscoveryFeed } from '../services/combflowApi';
import { findCategoryByTag } from '../data/categorySubtopics';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useContentFilter } from '../context/ContentFilterContext';
import { PostCard } from '../components/PostCard';
import { SortDropdown } from '../components/SortDropdown';
import { LanguageDropdown } from '../components/LanguageDropdown';
import { CategoryDropdown } from '../components/CategoryDropdown';
import { CategorySubtopicsBar } from '../components/CategorySubtopicsBar';
import { rankPostsByCustomAlgorithm, qualifiesForTrending } from '../utils/contentScoring';
import { appendUniquePosts } from '../utils/posts';
import { requestLogin } from '../utils/authEvents';

interface DiscoverPageProps {
  isCommunitiesFeed?: boolean;
  onPostsLoaded?: (posts: HivePost[]) => void;
  selectedSubTopic?: string;
  onSelectSubTopic?: (tag: string) => void;
  onClearSubTopic?: () => void;
}

export const DiscoverPage: React.FC<DiscoverPageProps> = ({
  isCommunitiesFeed = false,
  onPostsLoaded
}) => {
  const { currentUser } = useAuth();
  const {
    sort,
    setSort,
    tag,
    setTag,
    selectedLanguage,
    setSelectedLanguage,
    communitySubTopic,
    setCommunitySubTopic,
    setFeedAuthor,
    handleSelectAuthor,
    handleSelectPost,
    openContentFilterModal,
    setActiveNav
  } = useNavigation();

  const {
    config: contentFilterConfig,
    addFilterWord,
    addFilterAuthor,
    toggleFilterEnabled,
    filterPostsList
  } = useContentFilter();

  const activeCategory = useMemo(() => {
    if (isCommunitiesFeed || !tag) return undefined;
    return findCategoryByTag(tag);
  }, [isCommunitiesFeed, tag]);

  const [posts, setPosts] = useState<HivePost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const queryGen = useRef(0);
  const loadedPages = useRef(1);
  const apiCursorRef = useRef<{ author: string; permlink: string } | null>(null);
  const username = currentUser?.username || '';

  const rememberCursor = (page: HivePost[]) => {
    const tail = page[page.length - 1];
    if (tail) apiCursorRef.current = { author: tail.author, permlink: tail.permlink };
  };

  const openPost = useCallback((post: HivePost, jump?: boolean) => {
    handleSelectPost(post, true, Boolean(jump));
  }, [handleSelectPost]);

  const openTag = useCallback((nextTag: string) => {
    setTag(nextTag);
    setFeedAuthor(null);
  }, [setTag, setFeedAuthor]);

  const fetchPosts = useCallback(
    async (isRefresh = false) => {
      const gen = ++queryGen.current;
      loadedPages.current = 1;
      apiCursorRef.current = null;
      const observer = isCommunitiesFeed ? username : '';
      let queryTag = tag;
      if (isCommunitiesFeed && !queryTag) {
        queryTag = observer ? 'my' : 'hive-125125';
      }

      let hasCached = false;
      if (!isRefresh && sort !== 'created' && (isCommunitiesFeed || selectedLanguage === 'global')) {
        const cached = getCachedRankedPosts(
          sort,
          isCommunitiesFeed ? queryTag : tag,
          20,
          undefined,
          undefined,
          observer
        );
        if (cached && cached.length > 0) {
          rememberCursor(cached);
          setPosts(rankPostsByCustomAlgorithm(cached, sort, sort === 'trending' && !isCommunitiesFeed));
          hasCached = true;
        }
      }

      if (!isRefresh && !hasCached) {
        setLoading(true);
      }
      setError(null);

      try {
        let fetched: HivePost[] = [];

        if (isCommunitiesFeed) {
          fetched = await getRankedPosts(sort, queryTag, 20, undefined, undefined, observer, isRefresh);
        } else if (selectedLanguage !== 'global') {
          fetched = await getLanguageDiscoveryFeed({
            language: selectedLanguage,
            limit: 20,
            offset: 0,
            observer: username,
            category: tag || undefined,
          });
        } else {
          fetched = await getRankedPosts(sort, tag, 20, undefined, undefined, '', isRefresh);

          // Trending keeps walking Hive pages until 20 posts have 10+ comments.
          // The cursor stays on API order, not the re-ranked list.
          if (sort === 'trending') {
            let qualifying = (fetched || []).filter(qualifiesForTrending);
            let attempts = 0;
            while (qualifying.length < 20 && fetched.length > 0 && attempts < 4) {
              attempts++;
              const last = fetched[fetched.length - 1];
              const nextBatch = await getRankedPosts(
                'trending',
                tag,
                20,
                last.author,
                last.permlink,
                '',
                isRefresh
              );
              if (!nextBatch || nextBatch.length <= 1) break;
              const nextItems = nextBatch.slice(1);
              if (nextItems.length === 0) break;
              fetched = [...fetched, ...nextItems];
              qualifying = fetched.filter(qualifiesForTrending);
            }
          }
        }

        if (gen !== queryGen.current || loadedPages.current !== 1) return;
        rememberCursor(fetched || []);
        setPosts(rankPostsByCustomAlgorithm(
          fetched || [],
          sort,
          sort === 'trending' && !isCommunitiesFeed
        ));
      } catch (err: any) {
        if (gen !== queryGen.current) return;
        console.error('Discover RPC fetch error:', err);
        setError(err.message || 'Unable to connect to Hive RPC node. Please try again.');
      } finally {
        if (gen === queryGen.current) setLoading(false);
      }
    },
    [sort, tag, isCommunitiesFeed, selectedLanguage, username]
  );

  useEffect(() => {
    if (onPostsLoaded) {
      onPostsLoaded(posts);
    }
  }, [posts, onPostsLoaded]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleLoadMore = async () => {
    if (loadingMore || posts.length === 0) return;
    const rankedFeed = isCommunitiesFeed || selectedLanguage === 'global';
    if (rankedFeed && !apiCursorRef.current) return;
    const gen = queryGen.current;
    loadedPages.current += 1;
    setLoadingMore(true);

    try {
      if (!rankedFeed) {
        const more = await getLanguageDiscoveryFeed({
          language: selectedLanguage,
          limit: 20,
          offset: posts.length,
          observer: username,
          category: tag || undefined,
        });
        if (gen !== queryGen.current) return;
        const rankedMore = rankPostsByCustomAlgorithm(more, sort, false);
        setPosts((prev) => appendUniquePosts(prev, rankedMore));
        return;
      }

      const cursor = apiCursorRef.current;
      if (!cursor) return;
      const observer = isCommunitiesFeed ? username : '';
      let queryTag = tag;
      if (isCommunitiesFeed && !queryTag) {
        queryTag = observer ? 'my' : 'hive-125125';
      }

      let more = await getRankedPosts(
        sort,
        isCommunitiesFeed ? queryTag : tag,
        20,
        cursor.author,
        cursor.permlink,
        observer
      );

      if (sort === 'trending' && !isCommunitiesFeed) {
        let qualifying = more.filter(qualifiesForTrending);
        let attempts = 0;
        while (qualifying.length < 10 && more.length > 0 && attempts < 3) {
          attempts++;
          const last = more[more.length - 1];
          const nextBatch = await getRankedPosts('trending', tag, 20, last.author, last.permlink);
          if (!nextBatch || nextBatch.length <= 1) break;
          const nextItems = nextBatch.slice(1);
          if (nextItems.length === 0) break;
          more = [...more, ...nextItems];
          qualifying = more.filter(qualifiesForTrending);
        }
      }

      if (gen !== queryGen.current) return;
      rememberCursor(more);
      const rankedMore = rankPostsByCustomAlgorithm(more, sort, sort === 'trending' && !isCommunitiesFeed);
      setPosts((prev) => appendUniquePosts(prev, rankedMore));
    } catch (err: any) {
      console.error('Failed to load more discover posts:', err);
    } finally {
      if (gen === queryGen.current) setLoadingMore(false);
    }
  };

  const { displayedPosts, filteredOutStats } = useMemo(() => {
    let candidatePosts = posts;

    if (communitySubTopic) {
      const cleanSub = communitySubTopic.toLowerCase().trim();
      candidatePosts = posts.filter((p) => {
        let tags: string[] = [];
        if (typeof p.json_metadata === 'object' && p.json_metadata && Array.isArray((p.json_metadata as any).tags)) {
          tags = (p.json_metadata as any).tags;
        } else if (typeof p.json_metadata === 'string') {
          try {
            const parsed = JSON.parse(p.json_metadata);
            if (parsed && Array.isArray(parsed.tags)) tags = parsed.tags;
          } catch {}
        }
        const hasTag = tags.some((t) => typeof t === 'string' && t.toLowerCase().trim() === cleanSub);
        const inText = p.title?.toLowerCase().includes(cleanSub) || p.body?.toLowerCase().includes(cleanSub);
        return hasTag || inText;
      });
    }

    const filterRes = filterPostsList(candidatePosts);
    const seen = new Set<string>();
    const uniquePosts: HivePost[] = [];

    for (const post of filterRes.visiblePosts) {
      const key = `${post.first_reblogged_by ? post.first_reblogged_by + ':' : ''}${post.author}/${post.permlink}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniquePosts.push(post);
      }
    }

    return {
      displayedPosts: uniquePosts,
      filteredOutStats: {
        total: filterRes.totalHiddenCount,
        byWord: filterRes.hiddenByWordCount,
        byAuthor: filterRes.hiddenByAuthorCount
      }
    };
  }, [posts, communitySubTopic, filterPostsList]);

  return (
    <div className="space-y-4">
      {/* Header controls bar */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-4 sm:px-6 sm:py-3.5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none text-gray-900 dark:text-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center flex-wrap gap-2.5">
            <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base capitalize">
              {isCommunitiesFeed ? 'Communities Feed' : 'Discover'}
            </span>

            {/* Sort Selector */}
            <SortDropdown
              id="discover-header-sort-dropdown"
              currentSort={sort}
              onSortChange={(newSort) => setSort(newSort)}
            />

            {/* Language Selector */}
            {!isCommunitiesFeed && (
              <LanguageDropdown
                id="discover-header-language-dropdown"
                selectedLanguage={selectedLanguage}
                onSelectLanguage={(langCode) => {
                  setSelectedLanguage(langCode);
                  setFeedAuthor(null);
                }}
              />
            )}

            {/* Category Dropdown */}
            {!isCommunitiesFeed && (
              <CategoryDropdown
                id="discover-header-category-dropdown"
                currentCategory={activeCategory}
                onSelectCategory={(categoryTag) => {
                  setTag(categoryTag);
                  setFeedAuthor(null);
                }}
              />
            )}

            {/* Active Tag Filter Chip */}
            {tag && (
              <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                <span>{activeCategory?.icon ? `${activeCategory.icon} ` : ''}#{tag}</span>
                <button
                  onClick={() => {
                    // If current tag is a subtopic, go back to parent category tag.
                    // Otherwise reset tag entirely.
                    if (activeCategory && tag.toLowerCase() !== activeCategory.tag.toLowerCase()) {
                      setTag(activeCategory.tag);
                    } else {
                      setTag('');
                    }
                  }}
                  className="hover:text-blue-900 dark:hover:text-blue-100 font-bold ml-1 cursor-pointer"
                  title="Clear topic filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Active Community Subtopic Filter Chip */}
            {communitySubTopic && (
              <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full text-xs font-semibold animate-in fade-in">
                <span>Topic: #{communitySubTopic}</span>
                <button
                  onClick={() => setCommunitySubTopic('')}
                  className="hover:text-indigo-900 dark:hover:text-indigo-100 font-bold ml-1 cursor-pointer"
                  title="Clear subtopic filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0 flex-wrap">
            {/* Content Filters */}
            <button
              onClick={openContentFilterModal}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer border ${
                contentFilterConfig.enabled && (contentFilterConfig.words.length > 0 || contentFilterConfig.authors.length > 0)
                  ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
                  : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
              title="Manage muted words and authors filter"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Filters</span>
              {(contentFilterConfig.words.length > 0 || contentFilterConfig.authors.length > 0) && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    contentFilterConfig.enabled ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                  }`}
                >
                  {contentFilterConfig.words.length + contentFilterConfig.authors.length}
                </span>
              )}
            </button>

            {/* Cache Status Badge */}
            {sort === 'created' ? (
              <span
                className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 cursor-default"
                title="Real-time newly created blockchain posts"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live</span>
              </span>
            ) : (
              <span
                className="text-[11px] font-medium text-slate-500 bg-slate-100/90 dark:bg-slate-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1 cursor-default"
                title="Fast instant navigation powered by client cache"
              >
                <Zap className="w-3 h-3 text-amber-500" />
                <span>Cached</span>
              </span>
            )}

            <button
              onClick={() => fetchPosts(true)}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Force refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Subtopics Bar */}
        {!isCommunitiesFeed && activeCategory && (
          <CategorySubtopicsBar
            id="discover-category-subtopics-bar"
            category={activeCategory}
            currentTag={tag}
            onSelectTag={(newSubTag) => {
              setTag(newSubTag);
              setFeedAuthor(null);
            }}
            onClearCategory={() => {
              // If we are in a subtopic, the "X" on the bar should go back to the main category
              if (activeCategory && tag.toLowerCase() !== activeCategory.tag.toLowerCase()) {
                setTag(activeCategory.tag);
              } else {
                setTag('');
              }
              setFeedAuthor(null);
            }}
          />
        )}

        {/* Mobile sort tabs */}
        <div className="flex lg:hidden items-center gap-2 pt-3 mt-3 border-t border-gray-100 dark:border-slate-800 overflow-x-auto no-scrollbar">
          {(['hot', 'trending', 'created', 'payout', 'muted'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              title={`Sort by ${s === 'created' ? 'New' : s}`}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                sort === s
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {s === 'created' ? 'New' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 rounded-3xl bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300 flex items-start justify-between">
          <div>
            <p className="font-semibold">Unable to fetch feed from Hive RPC</p>
            <p className="text-gray-600 dark:text-slate-400 mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => fetchPosts(true)}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 transition ml-3 flex-shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters notice */}
      {!loading && contentFilterConfig.enabled && filteredOutStats.total > 0 && (
        <div className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-50/80 to-indigo-50/60 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-150/70 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span className="truncate">
              <strong className="font-bold">{filteredOutStats.total}</strong> {filteredOutStats.total === 1 ? 'post' : 'posts'} hidden by your content filters
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 text-xs font-semibold">
            <button
              onClick={openContentFilterModal}
              className="text-blue-700 dark:text-blue-300 hover:underline transition cursor-pointer"
            >
              Manage Filters
            </button>
            <span className="text-blue-300 dark:text-blue-700">•</span>
            <button
              onClick={toggleFilterEnabled}
              className="text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition cursor-pointer font-normal text-[11px]"
            >
              Pause Filter
            </button>
          </div>
        </div>
      )}

      {/* Posts stream */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none animate-pulse space-y-4 border border-gray-100 dark:border-slate-800"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-800" />
                <div className="space-y-1.5">
                  <div className="w-24 h-3 rounded bg-gray-200 dark:bg-slate-800" />
                  <div className="w-16 h-2 rounded bg-gray-200 dark:bg-slate-800" />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-36 h-24 rounded-2xl bg-gray-200 dark:bg-slate-800 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-3/4 h-4 rounded bg-gray-200 dark:bg-slate-800" />
                  <div className="w-full h-3 rounded bg-gray-200 dark:bg-slate-800" />
                  <div className="w-2/3 h-3 rounded bg-gray-200 dark:bg-slate-800" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : displayedPosts.length > 0 ? (
        <div className="space-y-4">
          {displayedPosts.map((post, index) => (
            <PostCard
              key={`${post.first_reblogged_by || ''}:${post.author}/${post.permlink}`}
              post={post}
              onSelectPost={openPost}
              onSelectAuthor={handleSelectAuthor}
              onSelectTag={openTag}
              currentUser={currentUser}
              onRequireLogin={requestLogin}
              onMuteAuthor={addFilterAuthor}
              onBlockWord={addFilterWord}
            />
          ))}

          {/* Load More Button */}
          <div className="text-center pt-2 pb-8">
            <button
              id="load-more-posts-btn"
              onClick={handleLoadMore}
              disabled={loadingMore}
              title="Fetch older posts from the blockchain"
              className="px-6 py-2.5 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 text-xs font-bold shadow-xs hover:shadow-sm disabled:opacity-50 transition cursor-pointer"
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                  Loading more stories...
                </span>
              ) : (
                'Load More'
              )}
            </button>
          </div>
        </div>
      ) : filteredOutStats.total > 0 ? (
        <div className="p-12 text-center space-y-4 bg-white dark:bg-slate-900 rounded-3xl shadow-[0_1px_6px_rgba(0,0,0,0.03)] border border-gray-100 dark:border-slate-800 text-gray-900 dark:text-slate-100">
          <EyeOff className="w-12 h-12 text-blue-400 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-gray-800 dark:text-white">All loaded posts are hidden by your filters</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
              {filteredOutStats.total} {filteredOutStats.total === 1 ? 'post' : 'posts'} matched your muted words or authors.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap pt-1">
            <button
              onClick={openContentFilterModal}
              className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold transition shadow-xs cursor-pointer"
            >
              Adjust Content Filters
            </button>
            <button
              onClick={toggleFilterEnabled}
              className="px-4 py-2 text-xs bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-full font-semibold transition cursor-pointer"
            >
              Temporarily Pause Filters
            </button>
          </div>
        </div>
      ) : (
        <div className="p-16 text-center space-y-3 bg-white dark:bg-slate-900 rounded-3xl shadow-[0_1px_6px_rgba(0,0,0,0.03)] border border-gray-100 dark:border-slate-800 text-gray-900 dark:text-slate-100">
          <Compass className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto" />
          <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">
            {selectedLanguage !== 'global'
              ? 'No recent posts found for this language filter.'
              : 'No posts found in this feed.'}
          </p>
          <button
            onClick={() => {
              setTag('');
              setSelectedLanguage('global');
              setFeedAuthor(null);
              setActiveNav('discover');
            }}
            className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold transition shadow-xs cursor-pointer"
          >
            {selectedLanguage !== 'global' ? 'Reset to Global Feed' : 'Refresh Feed'}
          </button>
        </div>
      )}
    </div>
  );
};

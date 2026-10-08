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
import {
  getRecommendationsForUser,
  subscribeRecommendationStatus,
  RecommendationSyncStatus
} from '../services/recommendationService';
import { getLanguageDiscoveryFeed } from '../services/combflowApi';
import { findCategoryByTag } from '../data/categorySubtopics';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useContentFilter } from '../context/ContentFilterContext';
import { PostCard } from '../components/PostCard';
import { GalleryPostCard } from '../components/GalleryPostCard';
import { SortDropdown } from '../components/SortDropdown';
import { LanguageDropdown } from '../components/LanguageDropdown';
import { CategoryDropdown } from '../components/CategoryDropdown';
import { SubcategoryDropdown } from '../components/SubcategoryDropdown';
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

// Unique key for a post in the feed (reblogs of the same post stay distinct)
const postKey = (post: HivePost) =>
  `${post.first_reblogged_by || ''}:${post.author}/${post.permlink}`;

// Unique, DOM-safe id for a post wrapper (used for debugging & stable element identification)
const postDomId = (post: HivePost, index?: number) =>
  typeof index === 'number'
    ? `discover-post-wrapper-${index}`
    : `discover-post-${post.author}-${post.permlink}${
        post.first_reblogged_by ? `-reblog-${post.first_reblogged_by}` : ''
      }`.replace(/[^a-zA-Z0-9_-]/g, '_');

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
    setActiveNav,
    feedLayoutMode
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

  // Responsive mobile detection (mobile defaults to gallery mode)
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 640 : false;
  });

  // Recommendation engine state & refs
  const recPageRef = useRef(1);
  const hasMoreRecsRef = useRef(true);
  const [recStatus, setRecStatus] = useState<RecommendationSyncStatus | null>(null);

  useEffect(() => {
    if (!username) return;
    const unsub = subscribeRecommendationStatus((status) => {
      if (status.account === username) {
        setRecStatus(status);
        if (sort === 'recommend') {
          setPosts((currentPosts) => {
            if (currentPosts.length === 0 && status.totalPostsFound > 0) {
              getRecommendationsForUser(username, 1, 20).then((res) => {
                if (res.posts.length > 0) {
                  setPosts(res.posts);
                  hasMoreRecsRef.current = res.hasMore;
                  setLoading(false);
                }
              });
            }
            return currentPosts;
          });
        }
      }
    });
    return unsub;
  }, [username, sort]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mobile Pull-to-Refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartYRef = useRef<number | null>(null);

  // Smart auto-hiding header on mobile (hides on scroll down, reappears on scroll up)
  const [headerVisible, setHeaderVisible] = useState<boolean>(true);
  const lastScrollYRef = useRef<number>(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const diff = currentScrollY - lastScrollYRef.current;

          // Always visible near the top
          if (currentScrollY < 40) {
            setHeaderVisible(true);
          } else if (diff > 8) {
            // User scrolling down -> hide header
            setHeaderVisible(false);
          } else if (diff < -8) {
            // User scrolling up -> show header
            setHeaderVisible(true);
          }

          lastScrollYRef.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 10) {
      touchStartYRef.current = e.touches[0].clientY;
    } else {
      touchStartYRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    if (window.scrollY <= 10) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartYRef.current;
      if (diff > 0) {
        setPullDistance(Math.min(diff * 0.45, 65));
      } else {
        setPullDistance(0);
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance >= 45) {
      if (sort === 'recommend') {
        fetchPosts(false);
      } else {
        fetchPosts(true);
      }
    }
    setPullDistance(0);
    touchStartYRef.current = null;
  };

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

      // Personalized Recommendation Feed branch
      if (sort === 'recommend') {
        if (!username) {
          setPosts([]);
          setLoading(false);
          setError(null);
          return;
        }

        setLoading(true);
        setError(null);
        recPageRef.current = 1;
        try {
          const recs = await getRecommendationsForUser(username, 1, 20);
          if (gen !== queryGen.current) return;
          setPosts(recs.posts);
          hasMoreRecsRef.current = recs.hasMore;
        } catch (err: any) {
          if (gen !== queryGen.current) return;
          console.error('Error fetching recommendations:', err);
          setError(err.message || 'Failed to load recommendations.');
        } finally {
          if (gen === queryGen.current) setLoading(false);
        }
        return;
      }

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

    // Recommendation pagination (20 by 20 from IndexedDB pool)
    if (sort === 'recommend') {
      if (!username || !hasMoreRecsRef.current) return;
      const gen = queryGen.current;
      setLoadingMore(true);
      const nextPage = recPageRef.current + 1;
      try {
        const moreRecs = await getRecommendationsForUser(username, nextPage, 20);
        if (gen !== queryGen.current) return;
        if (moreRecs.posts.length > 0) {
          recPageRef.current = nextPage;
          setPosts((prev) => appendUniquePosts(prev, moreRecs.posts));
          hasMoreRecsRef.current = moreRecs.hasMore;
        } else {
          hasMoreRecsRef.current = false;
        }
      } catch (err: any) {
        console.error('Failed to load more recommendations:', err);
      } finally {
        if (gen === queryGen.current) setLoadingMore(false);
      }
      return;
    }

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
      const key = postKey(post);
      if (!seen.has(key)) {
        seen.add(key);
        uniquePosts.push(post);
      }
    }

    const useGalleryLayout = isMobile || feedLayoutMode === 'gallery';

    return {
      displayedPosts: uniquePosts,
      useGalleryLayout,
      filteredOutStats: {
        total: filterRes.totalHiddenCount,
        byWord: filterRes.hiddenByWordCount,
        byAuthor: filterRes.hiddenByAuthorCount
      }
    };
  }, [posts, communitySubTopic, filterPostsList, isMobile, feedLayoutMode]);

  const useGalleryLayout = isMobile || feedLayoutMode === 'gallery';

  return (
    <div
      id="discover-page"
      className="space-y-3 sm:space-y-4 w-full min-w-0 max-w-[824px] px-0"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Mobile Pull-to-Refresh Indicator */}
      {pullDistance > 0 && (
        <div
          id="discover-pull-refresh"
          className="flex items-center justify-center transition-all overflow-hidden sm:hidden"
          style={{ height: `${pullDistance}px` }}
        >
          <div
            id="discover-pull-refresh-pill"
            className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold bg-white dark:bg-slate-900 px-3 py-1 rounded-full shadow-sm border border-blue-100 dark:border-blue-900/50"
          >
            <RefreshCw
              id="discover-pull-refresh-icon"
              className={`w-3.5 h-3.5 ${pullDistance >= 45 ? 'animate-spin' : ''}`}
            />
            <span id="discover-pull-refresh-label">
              {pullDistance >= 45 ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        </div>
      )}

      {/* Header controls bar - Auto-hide on scroll down, show on scroll up on mobile */}
      <div
        id="discover-header"
        className={`bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none text-gray-900 dark:text-slate-100 z-30 flex items-center justify-between transition-all duration-300 ease-out sticky top-0 sm:relative ${
          headerVisible
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : '-translate-y-16 opacity-0 pointer-events-none sm:translate-y-0 sm:opacity-100 sm:pointer-events-auto'
        }`}
        style={{
          height: '45px',
          minHeight: '45px',
          marginBottom: '5px',
          paddingTop: '10px',
          paddingBottom: '10px',
          paddingLeft: '10px',
          paddingRight: '10px',
          borderRadius: '15px'
        }}
      >
        <div
          id="discover-header-left"
          className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap min-w-0"
        >
          <span
            id="discover-header-title"
            className="font-bold text-gray-900 dark:text-white text-sm sm:text-base capitalize flex-shrink-0 hidden sm:inline-block"
          >
            {isCommunitiesFeed ? 'Communities' : 'Discover'}
          </span>

          {/* Sort Selector */}
          <SortDropdown
            id="discover-header-sort-dropdown"
            currentSort={sort}
            onSortChange={(newSort) => setSort(newSort)}
          />

          {/* Language Selector (Hidden on mobile, since it is in the top navbar as the Globe symbol without 'Global'; present on desktop) */}
          {!isCommunitiesFeed && (
            <div id="discover-header-language-wrapper" className="hidden sm:inline-block">
              <LanguageDropdown
                id="discover-header-language-dropdown"
                selectedLanguage={selectedLanguage}
                onSelectLanguage={(langCode) => {
                  setSelectedLanguage(langCode);
                  setFeedAuthor(null);
                }}
              />
            </div>
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

          {/* Subcategory Dropdown (if a category is active) */}
          {!isCommunitiesFeed && activeCategory && activeCategory.subtopics.length > 0 && (
            <SubcategoryDropdown
              id="discover-header-subcategory-dropdown"
              category={activeCategory}
              currentTag={tag}
              onSelectTag={(newSubTag) => {
                setTag(newSubTag);
                setFeedAuthor(null);
              }}
            />
          )}

          {/* Active Tag Filter Chip (when tag is custom and not from activeCategory) */}
          {tag && !activeCategory && (
            <div
              id="discover-tag-chip"
              className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-semibold"
            >
              <span id="discover-tag-chip-label">#{tag}</span>
              <button
                id="discover-tag-chip-clear-btn"
                onClick={() => {
                  setTag('');
                  setFeedAuthor(null);
                }}
                className="hover:text-blue-900 dark:hover:text-blue-100 font-bold ml-0.5 cursor-pointer"
                title="Clear topic filter"
              >
                <X id="discover-tag-chip-clear-icon" className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Active Community Subtopic Filter Chip */}
          {communitySubTopic && (
            <div
              id="discover-subtopic-chip"
              className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full text-xs font-semibold animate-in fade-in"
            >
              <span id="discover-subtopic-chip-label">Topic: #{communitySubTopic}</span>
              <button
                id="discover-subtopic-chip-clear-btn"
                onClick={() => setCommunitySubTopic('')}
                className="hover:text-indigo-900 dark:hover:text-indigo-100 font-bold ml-0.5 cursor-pointer"
                title="Clear subtopic filter"
              >
                <X id="discover-subtopic-chip-clear-icon" className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div id="discover-header-right" className="flex items-center gap-2 flex-shrink-0">
          {/* Content Filters (Symbol + count only on mobile, full text on desktop) */}
          <button
            id="discover-filters-btn"
            onClick={openContentFilterModal}
            className={`px-2 sm:px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition shadow-2xs cursor-pointer border ${
              contentFilterConfig.enabled && filteredOutStats.total > 0
                ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
                : contentFilterConfig.enabled && (contentFilterConfig.words.length > 0 || contentFilterConfig.authors.length > 0)
                ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200/60 dark:border-blue-900/40 text-blue-600 dark:text-blue-400'
                : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
            title={
              filteredOutStats.total > 0
                ? `${filteredOutStats.total} ${filteredOutStats.total === 1 ? 'post' : 'posts'} hidden by filters`
                : 'Manage muted words and authors filter'
            }
          >
            <SlidersHorizontal
              id="discover-filters-icon"
              className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"
            />
            <span id="discover-filters-label" className="hidden sm:inline">Filters</span>
            {contentFilterConfig.enabled && (contentFilterConfig.words.length > 0 || contentFilterConfig.authors.length > 0) && (
              <span
                id="discover-filters-count"
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  filteredOutStats.total > 0
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                }`}
                title={`${filteredOutStats.total} ${filteredOutStats.total === 1 ? 'post' : 'posts'} hidden`}
              >
                {filteredOutStats.total}
              </span>
            )}
          </button>

          {/* Cache Status Badge */}
          {/*sort === 'created' ? (
            <span
              id="discover-cache-badge-live"
              className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 cursor-default"
              title="Real-time newly created blockchain posts"
            >
              <span id="discover-cache-badge-live-dot" className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span id="discover-cache-badge-live-label">Live</span>
            </span>
          ) : (
            <span
              id="discover-cache-badge-cached"
              className="text-[11px] font-medium text-slate-500 bg-slate-100/90 dark:bg-slate-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1 cursor-default"
              title="Fast instant navigation powered by client cache"
            >
              <Zap id="discover-cache-badge-cached-icon" className="w-3 h-3 text-amber-500" />
              <span id="discover-cache-badge-cached-label">Cached</span>
            </span>
          )*/}

          {/* Desktop-only manual refresh button; hidden on Recommend tab to protect API limits */}
          {sort !== 'recommend' && (
            <button
              id="discover-refresh-btn"
              onClick={() => fetchPosts(true)}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer hidden sm:flex items-center justify-center"
              title="Force refresh"
            >
              <RefreshCw
                id="discover-refresh-icon"
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          id="discover-error-banner"
          className="p-4 rounded-3xl bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300 flex items-start justify-between"
          style={{ height: '30px', marginBottom: '5px', paddingTop: '10px', borderRadius: '15px', overflow: 'hidden' }}
        >
          <div id="discover-error-content">
            <p id="discover-error-title" className="font-semibold">Unable to fetch feed from Hive RPC</p>
            <p id="discover-error-message" className="text-gray-600 dark:text-slate-400 mt-0.5">{error}</p>
          </div>
          <button
            id="discover-error-retry-btn"
            onClick={() => fetchPosts(true)}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 transition ml-3 flex-shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}


      {/* Posts stream */}
      {sort === 'recommend' && !username ? (
        <div
          id="discover-recommend-login-prompt"
          className="p-8 sm:p-12 text-center max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-[0_1px_6px_rgba(0,0,0,0.03)] my-6 animate-in fade-in"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-violet-500/20">
            <Compass className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Personalized Recommendations
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-6 leading-relaxed">
            Sign in with your Hive account to unlock a feed curated specifically for you, powered by your recent upvoted posts and HiveSense AI.
          </p>
          <button
            onClick={requestLogin}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-semibold text-sm shadow-md shadow-violet-600/30 transition-all cursor-pointer"
          >
            Sign In with Hive
          </button>
        </div>
      ) : loading ? (
        <div id="discover-skeleton-list" className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              id={`discover-skeleton-card-${i}`}
              className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none animate-pulse space-y-4 border border-gray-100 dark:border-slate-800"
            >
              <div id={`discover-skeleton-header-${i}`} className="flex items-center gap-3">
                <div id={`discover-skeleton-avatar-${i}`} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-800" />
                <div id={`discover-skeleton-author-${i}`} className="space-y-1.5">
                  <div id={`discover-skeleton-author-name-${i}`} className="w-24 h-3 rounded bg-gray-200 dark:bg-slate-800" />
                  <div id={`discover-skeleton-author-meta-${i}`} className="w-16 h-2 rounded bg-gray-200 dark:bg-slate-800" />
                </div>
              </div>
              <div id={`discover-skeleton-body-${i}`} className="flex gap-4">
                <div id={`discover-skeleton-thumb-${i}`} className="w-36 h-24 rounded-2xl bg-gray-200 dark:bg-slate-800 flex-shrink-0" />
                <div id={`discover-skeleton-text-${i}`} className="flex-1 space-y-2">
                  <div id={`discover-skeleton-title-${i}`} className="w-3/4 h-4 rounded bg-gray-200 dark:bg-slate-800" />
                  <div id={`discover-skeleton-line-1-${i}`} className="w-full h-3 rounded bg-gray-200 dark:bg-slate-800" />
                  <div id={`discover-skeleton-line-2-${i}`} className="w-2/3 h-3 rounded bg-gray-200 dark:bg-slate-800" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : displayedPosts.length > 0 ? (
        <div
          id="discover-posts-list"
          className={useGalleryLayout ? 'space-y-3 sm:space-y-6' : 'space-y-3 sm:space-y-4'}
        >
          {sort === 'recommend' && (
            <div
              id="discover-recommend-header-banner"
              className="px-4 py-3 rounded-2xl bg-violet-50/80 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/40 flex items-center justify-between text-xs text-violet-900 dark:text-violet-200 shadow-2xs mb-2 animate-in fade-in"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-xl bg-violet-100 dark:bg-violet-900/60 text-violet-600 dark:text-violet-300">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold flex items-center gap-1.5">
                    Curated for @{username}
                    {recStatus?.isSyncing && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-violet-200/80 dark:bg-violet-800/80 text-violet-800 dark:text-violet-200 animate-pulse">
                        Syncing
                      </span>
                    )}
                  </div>
                  {recStatus?.isSyncing && (
                    <div className="text-[11px] text-violet-700/80 dark:text-violet-300/80">
                      Analyzing seed upvotes in background ({recStatus.currentSeedIndex}/{recStatus.totalSeeds || 30} seeds, {recStatus.totalPostsFound} stories found)...
                    </div>
                  )}
                </div>
              </div>
              {recStatus?.isSyncing && (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                </div>
              )}
            </div>
          )}
          {useGalleryLayout
            ? displayedPosts.map((post, postIndex) => {
                const isComment = Boolean(post.parent_author) || (typeof post.depth === 'number' && post.depth > 0);
                return isComment ? (
                  <div
                    key={postKey(post)}
                    id={postDomId(post, postIndex)}
                    className="discover_post_item_wrapper relative"
                  >
                    <PostCard
                      post={post}
                      postIndex={postIndex}
                      onSelectPost={openPost}
                      onSelectAuthor={handleSelectAuthor}
                      onSelectTag={openTag}
                      currentUser={currentUser}
                      onRequireLogin={requestLogin}
                      onMuteAuthor={addFilterAuthor}
                      onBlockWord={addFilterWord}
                    />
                  </div>
                ) : (
                  <div
                    key={postKey(post)}
                    id={postDomId(post, postIndex)}
                    className="discover_post_item_wrapper relative"
                  >
                    <GalleryPostCard
                      post={post}
                      postIndex={postIndex}
                      onSelectPost={openPost}
                      onSelectAuthor={handleSelectAuthor}
                      onSelectTag={openTag}
                      currentUser={currentUser}
                      onRequireLogin={requestLogin}
                      onMuteAuthor={addFilterAuthor}
                      onBlockWord={addFilterWord}
                    />
                  </div>
                );
              })
            : displayedPosts.map((post, postIndex) => (
                <div
                  key={postKey(post)}
                  id={postDomId(post, postIndex)}
                  className="discover_post_item_wrapper relative"
                >
                  <PostCard
                    post={post}
                    postIndex={postIndex}
                    onSelectPost={openPost}
                    onSelectAuthor={handleSelectAuthor}
                    onSelectTag={openTag}
                    currentUser={currentUser}
                    onRequireLogin={requestLogin}
                    onMuteAuthor={addFilterAuthor}
                    onBlockWord={addFilterWord}
                  />
                </div>
              ))}

          {/* Load More Button */}
          {sort === 'recommend' && !hasMoreRecsRef.current ? null : (
            <div id="discover-load-more-wrapper" className="text-center pt-2 pb-8">
              <button
                id="load-more-posts-btn"
                onClick={handleLoadMore}
                disabled={loadingMore}
                title="Fetch older posts from the blockchain"
                className="px-6 py-2.5 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 text-xs font-bold shadow-xs hover:shadow-sm disabled:opacity-50 transition cursor-pointer"
              >
                {loadingMore ? (
                  <span id="discover-load-more-loading" className="flex items-center gap-2">
                    <RefreshCw
                      id="discover-load-more-spinner"
                      className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400"
                    />
                    Loading more stories...
                  </span>
                ) : (
                  'Load More'
                )}
              </button>
            </div>
          )}
        </div>
      ) : filteredOutStats.total > 0 ? (
        <div
          id="discover-filtered-empty"
          className="p-12 text-center space-y-4 bg-white dark:bg-slate-900 rounded-3xl shadow-[0_1px_6px_rgba(0,0,0,0.03)] border border-gray-100 dark:border-slate-800 text-gray-900 dark:text-slate-100"
        >
          <EyeOff id="discover-filtered-empty-icon" className="w-12 h-12 text-blue-400 mx-auto" />
          <div id="discover-filtered-empty-content">
            <h3 id="discover-filtered-empty-title" className="text-base font-bold text-gray-800 dark:text-white">
              All loaded posts are hidden by your filters
            </h3>
            <p
              id="discover-filtered-empty-text"
              className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed"
            >
              {filteredOutStats.total} {filteredOutStats.total === 1 ? 'post' : 'posts'} matched your muted words or authors.
            </p>
          </div>
          <div
            id="discover-filtered-empty-actions"
            className="flex items-center justify-center gap-3 flex-wrap pt-1"
          >
            <button
              id="discover-filtered-empty-adjust-btn"
              onClick={openContentFilterModal}
              className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold transition shadow-xs cursor-pointer"
            >
              Adjust Content Filters
            </button>
            <button
              id="discover-filtered-empty-pause-btn"
              onClick={toggleFilterEnabled}
              className="px-4 py-2 text-xs bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-full font-semibold transition cursor-pointer"
            >
              Temporarily Pause Filters
            </button>
          </div>
        </div>
      ) : (
        <div
          id="discover-empty"
          className="p-16 text-center space-y-3 bg-white dark:bg-slate-900 rounded-3xl shadow-[0_1px_6px_rgba(0,0,0,0.03)] border border-gray-100 dark:border-slate-800 text-gray-900 dark:text-slate-100"
        >
          <Compass id="discover-empty-icon" className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto" />
          <p id="discover-empty-text" className="text-sm text-gray-500 dark:text-slate-400 font-medium max-w-md mx-auto">
            {sort === 'recommend'
              ? recStatus?.isSyncing
                ? `Analyzing your recent upvotes in the background to curate stories (${recStatus.currentSeedIndex}/${recStatus.totalSeeds || 30})...`
                : 'No recommendations found yet. Upvote positive root posts on Hive to receive personalized recommendations.'
              : selectedLanguage !== 'global'
              ? 'No recent posts found for this language filter.'
              : 'No posts found in this feed.'}
          </p>
          {sort === 'recommend' ? (
            recStatus?.isSyncing && (
              <div className="flex items-center justify-center gap-2 text-xs text-violet-600 dark:text-violet-400 font-medium pt-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Syncing recommendation queue quietly...</span>
              </div>
            )
          ) : (
            <button
              id="discover-empty-reset-btn"
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
          )}
        </div>
      )}
    </div>
  );
};
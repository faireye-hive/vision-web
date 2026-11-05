import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  RefreshCw,
  X,
  Zap,
  SlidersHorizontal,
  ShieldAlert,
  EyeOff,
  Compass,
  Layers,
  LayoutGrid,
  LayoutList,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import {
  HivePost,
  getRankedPosts,
  getCachedRankedPosts,
  getSubscriptions
} from '../services/hiveApi';
import { DEFAULT_COMMUNITIES } from '../components/LeftSidebar';
import { CommunitiesSwipeBar } from '../components/communities/CommunitiesSwipeBar';
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
  const { currentUser, joinedCommunities } = useAuth();
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
    feedLayoutMode,
    setFeedLayoutMode,
    openCommunitiesModal,
    openManageCommunitiesModal
  } = useNavigation();

  const joinedCount = useMemo(
    () => Object.values(joinedCommunities || {}).filter(Boolean).length,
    [joinedCommunities]
  );

  // Subscribed communities for Communities Feed swipe carousel
  const [followedCommunities, setFollowedCommunities] = useState<Array<{ name: string; title: string }>>([]);
  const [isSubsLoading, setIsSubsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isCommunitiesFeed) return;
    if (currentUser?.username) {
      let mounted = true;
      setIsSubsLoading(true);
      getSubscriptions(currentUser.username)
        .then((subs) => {
          if (!mounted) return;
          if (subs && subs.length > 0) {
            setFollowedCommunities(subs.map(([name, title]) => ({ name, title: title || name })));
          } else {
            setFollowedCommunities(DEFAULT_COMMUNITIES);
          }
          setIsSubsLoading(false);
        })
        .catch(() => {
          if (mounted) {
            setFollowedCommunities(DEFAULT_COMMUNITIES);
            setIsSubsLoading(false);
          }
        });
      return () => {
        mounted = false;
      };
    } else {
      setFollowedCommunities(DEFAULT_COMMUNITIES);
    }
  }, [currentUser?.username, isCommunitiesFeed]);

  const displayCommunities = useMemo(() => {
    const base = followedCommunities.length > 0 ? [...followedCommunities] : [...DEFAULT_COMMUNITIES];
    Object.keys(joinedCommunities || {}).forEach((name) => {
      if (joinedCommunities[name] && !base.some((c) => c.name === name)) {
        base.push({ name, title: name });
      }
    });
    return base.filter((c) => joinedCommunities[c.name] !== false);
  }, [followedCommunities, joinedCommunities]);

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

  const effectiveSort = isCommunitiesFeed && sort === 'recommend' ? 'trending' : sort;

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

  // Ensure communities feed never uses recommend sort
  useEffect(() => {
    if (isCommunitiesFeed && sort === 'recommend') {
      setSort('trending');
    }
  }, [isCommunitiesFeed, sort, setSort]);

  const fetchPosts = useCallback(
    async (isRefresh = false) => {
      const gen = ++queryGen.current;
      loadedPages.current = 1;
      apiCursorRef.current = null;
      const actualSort = isCommunitiesFeed && sort === 'recommend' ? 'trending' : sort;

      // Personalized Recommendation Feed branch (only for discover feed, never communities)
      if (!isCommunitiesFeed && actualSort === 'recommend') {
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

      const rpcSort = (actualSort === 'recommend' ? 'trending' : actualSort) as
        | 'trending'
        | 'hot'
        | 'created'
        | 'payout'
        | 'muted'
        | 'promoted';

      let hasCached = false;
      if (!isRefresh && rpcSort !== 'created' && (isCommunitiesFeed || selectedLanguage === 'global')) {
        const cached = getCachedRankedPosts(
          rpcSort,
          isCommunitiesFeed ? queryTag : tag,
          20,
          undefined,
          undefined,
          observer
        );
        if (cached && cached.length > 0) {
          rememberCursor(cached);
          setPosts(rankPostsByCustomAlgorithm(cached, actualSort, actualSort === 'trending' && !isCommunitiesFeed));
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
          fetched = await getRankedPosts(rpcSort, queryTag, 20, undefined, undefined, observer, isRefresh);
        } else if (selectedLanguage !== 'global') {
          fetched = await getLanguageDiscoveryFeed({
            language: selectedLanguage,
            limit: 20,
            offset: 0,
            observer: username,
            category: tag || undefined,
          });
        } else {
          fetched = await getRankedPosts(rpcSort, tag, 20, undefined, undefined, '', isRefresh);

          // Trending keeps walking Hive pages until 20 posts have 10+ comments.
          // The cursor stays on API order, not the re-ranked list.
          if (actualSort === 'trending') {
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
          actualSort,
          actualSort === 'trending' && !isCommunitiesFeed
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
    const actualSort = isCommunitiesFeed && sort === 'recommend' ? 'trending' : sort;

    // Recommendation pagination (20 by 20 from IndexedDB pool)
    if (!isCommunitiesFeed && actualSort === 'recommend') {
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
        const rankedMore = rankPostsByCustomAlgorithm(more, actualSort, false);
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

      const rpcSort = (actualSort === 'recommend' ? 'trending' : actualSort) as
        | 'trending'
        | 'hot'
        | 'created'
        | 'payout'
        | 'muted'
        | 'promoted';

      let more = await getRankedPosts(
        rpcSort,
        isCommunitiesFeed ? queryTag : tag,
        20,
        cursor.author,
        cursor.permlink,
        observer
      );

      if (actualSort === 'trending' && !isCommunitiesFeed) {
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
      const rankedMore = rankPostsByCustomAlgorithm(more, actualSort, actualSort === 'trending' && !isCommunitiesFeed);
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
      className="space-y-4 sm:space-y-5 w-full min-w-0 max-w-[860px] mx-auto px-0"
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
            className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold bg-white dark:bg-slate-900 px-3.5 py-1.5 rounded-full shadow-md border border-blue-100 dark:border-blue-900/50"
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
        className={`bg-white/90 dark:bg-[#0c1222]/95 backdrop-blur-xl border border-gray-200/70 dark:border-slate-800/80 rounded-2xl sm:rounded-3xl shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_30px_-4px_rgba(0,0,0,0.5)] z-40 flex flex-nowrap items-center justify-between gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 transition-all duration-300 ease-out sticky top-0 sm:relative max-w-full overflow-visible ${
          headerVisible
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : '-translate-y-16 opacity-0 pointer-events-none sm:translate-y-0 sm:opacity-100 sm:pointer-events-auto'
        }`}
      >
        {/* Top ambient hairline glow */}
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent pointer-events-none rounded-t-2xl sm:rounded-t-3xl" />

        <div
          id="discover-header-left"
          className="flex items-center flex-nowrap gap-1 sm:gap-1.5 min-w-0 flex-1 overflow-visible py-0.5"
        >
          {isCommunitiesFeed ? (
            <div className="flex items-center gap-0.5 p-0.5 bg-gray-100/90 dark:bg-slate-800/90 rounded-xl sm:rounded-2xl border border-gray-200/50 dark:border-slate-700/50 shrink-0 shadow-inner">
              <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs whitespace-nowrap">
                <span>Feed</span>
              </span>
              <button
                type="button"
                onClick={openCommunitiesModal}
                className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer shrink-0 whitespace-nowrap active:scale-95"
                title="Explore and discover Hive communities"
              >
                <Compass className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Explore</span>
              </button>
              <button
                type="button"
                onClick={openManageCommunitiesModal}
                className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold text-gray-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer shrink-0 whitespace-nowrap active:scale-95"
                title="Manage your subscribed communities"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Manage</span>
                {joinedCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300">
                    {joinedCount}
                  </span>
                )}
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center p-1.5 rounded-full bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0 shadow-2xs">
              <Sparkles className="w-3 h-3" />
            </div>
          )}

          {/* Sort Selector */}
          <SortDropdown
            id="discover-header-sort-dropdown"
            currentSort={effectiveSort}
            onSortChange={(newSort) => setSort(newSort)}
            hideRecommend={isCommunitiesFeed}
            iconOnly={true}
          />

          {/* Language Selector (Hidden on mobile, present on desktop) */}
          {!isCommunitiesFeed && (
            <div id="discover-header-language-wrapper" className="hidden sm:inline-block shrink-0 overflow-visible">
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

          {/* Active Tag Filter Chip */}
          {tag && !activeCategory && !isCommunitiesFeed && (
            <div
              id="discover-tag-chip"
              className="flex items-center gap-1 bg-blue-50/90 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-xs font-bold shrink-0 max-w-[95px] sm:max-w-[130px] shadow-2xs animate-in fade-in"
            >
              <span id="discover-tag-chip-label" className="truncate">#{tag}</span>
              <button
                id="discover-tag-chip-clear-btn"
                onClick={() => {
                  setTag('');
                  setFeedAuthor(null);
                }}
                className="hover:text-blue-900 dark:hover:text-blue-100 font-bold ml-0.5 cursor-pointer p-0.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/60 transition shrink-0"
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
              className="flex items-center gap-1 bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-xs font-bold shrink-0 max-w-[95px] sm:max-w-[130px] shadow-2xs animate-in fade-in"
            >
              <span id="discover-subtopic-chip-label" className="truncate">#{communitySubTopic}</span>
              <button
                id="discover-subtopic-chip-clear-btn"
                onClick={() => setCommunitySubTopic('')}
                className="hover:text-indigo-900 dark:hover:text-indigo-100 font-bold ml-0.5 cursor-pointer p-0.5 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition shrink-0"
                title="Clear subtopic filter"
              >
                <X id="discover-subtopic-chip-clear-icon" className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div id="discover-header-right" className="flex items-center gap-1 sm:gap-1.5 shrink-0 overflow-visible ml-1 sm:ml-2">
          {/* Feed Layout Toggle (Gallery Cards vs Compact List) */}
          <button
            type="button"
            onClick={() => setFeedLayoutMode(feedLayoutMode === 'gallery' ? 'list' : 'gallery')}
            className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100/80 dark:bg-slate-800/80 hover:bg-gray-200/70 dark:hover:bg-slate-700/70 border border-gray-200/60 dark:border-slate-700/60 text-gray-700 dark:text-slate-300 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
            title={feedLayoutMode === 'gallery' ? 'Switch to Compact List view' : 'Switch to Gallery view'}
          >
            {feedLayoutMode === 'gallery' ? (
              <LayoutList className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            ) : (
              <LayoutGrid className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            )}
            <span className="hidden lg:inline">{feedLayoutMode === 'gallery' ? 'Gallery' : 'List'}</span>
          </button>

          {/* Content Filters */}
          <button
            id="discover-filters-btn"
            onClick={openContentFilterModal}
            className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition shadow-2xs cursor-pointer border shrink-0 ${
              contentFilterConfig.enabled && filteredOutStats.total > 0
                ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
                : contentFilterConfig.enabled && (contentFilterConfig.words.length > 0 || contentFilterConfig.authors.length > 0)
                ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200/60 dark:border-blue-900/40 text-blue-600 dark:text-blue-400'
                : 'bg-white dark:bg-slate-800 border-gray-200/80 dark:border-slate-700/80 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
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
            <span id="discover-filters-label" className="hidden md:inline">Filters</span>
            {contentFilterConfig.enabled && (contentFilterConfig.words.length > 0 || contentFilterConfig.authors.length > 0) && (
              <span
                id="discover-filters-count"
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
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

          {/* Desktop-only manual refresh button */}
          {sort !== 'recommend' && (
            <button
              id="discover-refresh-btn"
              onClick={() => fetchPosts(true)}
              className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer hidden sm:flex items-center justify-center active:scale-95 shrink-0"
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

      {/* Active Category Spotlight Sub-banner */}
      {activeCategory && !isCommunitiesFeed && (
        <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-purple-50/80 dark:from-[#0c1222]/90 dark:via-blue-950/30 dark:to-[#0c1222]/90 border border-blue-200/60 dark:border-blue-900/50 flex items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-base shrink-0 border border-blue-500/20">
              {activeCategory.icon || `#`}
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white truncate">
                {activeCategory.label} Discovery
              </h4>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">
                Filtered by #{tag} • {activeCategory.subtopics.length} related topics
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setTag(''); setFeedAuthor(null); }}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline px-2.5 py-1 rounded-xl hover:bg-blue-100/60 dark:hover:bg-blue-900/40 transition shrink-0 cursor-pointer"
          >
            Show All
          </button>
        </div>
      )}

      {/* ================= FOLLOWED COMMUNITIES SWIPE CAROUSEL ================= */}
      {isCommunitiesFeed && (
        <CommunitiesSwipeBar
          communities={displayCommunities}
          currentTag={tag}
          onSelectCommunity={(commName) => {
            setTag(commName);
            setFeedAuthor(null);
          }}
          onOpenExplore={openCommunitiesModal}
          loading={isSubsLoading}
        />
      )}

      {/* Error banner */}
      {error && (
        <div
          id="discover-error-banner"
          className="p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3 shadow-xs animate-in fade-in"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p id="discover-error-title" className="font-bold text-rose-900 dark:text-rose-100">Unable to fetch feed from Hive RPC</p>
              <p id="discover-error-message" className="text-[11px] text-rose-700/80 dark:text-rose-300/80 truncate mt-0.5">{error}</p>
            </div>
          </div>
          <button
            id="discover-error-retry-btn"
            onClick={() => fetchPosts(true)}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs transition shrink-0 cursor-pointer active:scale-95"
          >
            Retry
          </button>
        </div>
      )}


      {/* Posts stream */}
      {sort === 'recommend' && !username ? (
        <div
          id="discover-recommend-login-prompt"
          className="relative overflow-hidden p-8 sm:p-12 text-center max-w-lg mx-auto bg-white/85 dark:bg-[#0c1222]/90 backdrop-blur-xl rounded-3xl border border-violet-200/60 dark:border-violet-900/40 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] my-6 animate-in fade-in"
        >
          {/* Subtle ambient blur orb */}
          <div className="absolute -top-12 -right-12 w-44 h-44 bg-violet-500/10 dark:bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/25 ring-4 ring-violet-50 dark:ring-violet-950/40">
              <Sparkles className="w-8 h-8 animate-pulse" />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
              Personalized Recommendations
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 mb-6 leading-relaxed max-w-sm mx-auto">
              Sign in with your Hive account to unlock a feed curated specifically for you, powered by your recent upvoted posts and HiveSense AI.
            </p>
            <button
              onClick={requestLogin}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-violet-600/30 hover:shadow-lg hover:shadow-violet-600/40 transition-all cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              Sign In with Hive
            </button>
          </div>
        </div>
      ) : loading ? (
        <div id="discover-skeleton-list" className={useGalleryLayout ? 'space-y-4 sm:space-y-6' : 'space-y-3 sm:space-y-4'}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              id={`discover-skeleton-card-${i}`}
              className="bg-white/80 dark:bg-[#0c1222]/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none animate-pulse space-y-4 border border-gray-200/70 dark:border-slate-800/80"
            >
              <div id={`discover-skeleton-header-${i}`} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div id={`discover-skeleton-avatar-${i}`} className="w-9 h-9 rounded-full bg-gray-200 dark:bg-slate-800 ring-2 ring-gray-100 dark:ring-slate-750" />
                  <div id={`discover-skeleton-author-${i}`} className="space-y-1.5">
                    <div id={`discover-skeleton-author-name-${i}`} className="w-28 h-3.5 rounded-full bg-gray-200 dark:bg-slate-800" />
                    <div id={`discover-skeleton-author-meta-${i}`} className="w-16 h-2.5 rounded-full bg-gray-100 dark:bg-slate-850" />
                  </div>
                </div>
                <div className="w-16 h-5 rounded-full bg-gray-100 dark:bg-slate-800 hidden sm:block" />
              </div>
              <div id={`discover-skeleton-body-${i}`} className={useGalleryLayout ? 'space-y-3' : 'flex flex-col sm:flex-row gap-4'}>
                <div
                  id={`discover-skeleton-thumb-${i}`}
                  className={
                    useGalleryLayout
                      ? 'w-full h-48 sm:h-64 rounded-2xl bg-gradient-to-tr from-gray-200 via-gray-100 to-gray-200 dark:from-slate-800 dark:via-slate-850 dark:to-slate-800'
                      : 'w-full sm:w-44 h-28 rounded-2xl bg-gradient-to-tr from-gray-200 via-gray-100 to-gray-200 dark:from-slate-800 dark:via-slate-850 dark:to-slate-800 shrink-0'
                  }
                />
                <div id={`discover-skeleton-text-${i}`} className="flex-1 space-y-2.5 py-1">
                  <div id={`discover-skeleton-title-${i}`} className="w-4/5 h-4 rounded-md bg-gray-200 dark:bg-slate-800" />
                  <div id={`discover-skeleton-line-1-${i}`} className="w-full h-3 rounded-md bg-gray-100 dark:bg-slate-850" />
                  <div id={`discover-skeleton-line-2-${i}`} className="w-2/3 h-3 rounded-md bg-gray-100 dark:bg-slate-850" />
                  <div className="pt-2 flex items-center gap-3">
                    <div className="w-14 h-6 rounded-full bg-gray-100 dark:bg-slate-850" />
                    <div className="w-12 h-6 rounded-full bg-gray-100 dark:bg-slate-850" />
                  </div>
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
              className="px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-violet-50/90 via-indigo-50/70 to-purple-50/90 dark:from-[#110d29]/90 dark:via-[#131131]/80 dark:to-[#170e2f]/90 border border-violet-200/70 dark:border-violet-900/50 flex items-center justify-between text-xs text-violet-900 dark:text-violet-200 shadow-sm mb-3 animate-in fade-in"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-violet-600/10 dark:bg-violet-400/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 border border-violet-500/20">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-extrabold flex items-center gap-2">
                    <span>HiveSense Tailored for @{username}</span>
                    {recStatus?.isSyncing && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-200/80 dark:bg-violet-850 text-violet-900 dark:text-violet-200 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-600 dark:bg-violet-400 animate-ping" />
                        Syncing
                      </span>
                    )}
                  </div>
                  {recStatus?.isSyncing ? (
                    <div className="text-[11px] text-violet-700/80 dark:text-violet-300/80 mt-0.5">
                      Analyzing seed upvotes in background ({recStatus.currentSeedIndex}/{recStatus.totalSeeds || 30} seeds, {recStatus.totalPostsFound} stories found)...
                    </div>
                  ) : (
                    <div className="text-[11px] text-violet-700/70 dark:text-violet-300/70 mt-0.5">
                      Curated from your active blockchain interactions & communities
                    </div>
                  )}
                </div>
              </div>
              {recStatus?.isSyncing && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 dark:text-violet-400 shrink-0">
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
                    className="discover_post_item_wrapper relative transition duration-200 hover:-translate-y-0.5"
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
                    className="discover_post_item_wrapper relative transition duration-200 hover:-translate-y-0.5"
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
                  className="discover_post_item_wrapper relative transition duration-200 hover:-translate-y-0.5"
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
            <div id="discover-load-more-wrapper" className="text-center pt-4 pb-10">
              <button
                id="load-more-posts-btn"
                onClick={handleLoadMore}
                disabled={loadingMore}
                title="Fetch older posts from the blockchain"
                className="group relative inline-flex items-center gap-2.5 px-7 py-3 rounded-full bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 hover:border-blue-500/40 dark:hover:border-blue-500/40 hover:bg-gray-50/90 dark:hover:bg-slate-850 text-gray-800 dark:text-slate-100 text-xs sm:text-sm font-extrabold shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(59,130,246,0.12)] disabled:opacity-50 transition-all duration-200 cursor-pointer active:scale-95"
              >
                {loadingMore ? (
                  <span id="discover-load-more-loading" className="flex items-center gap-2">
                    <RefreshCw
                      id="discover-load-more-spinner"
                      className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400"
                    />
                    Loading more stories...
                  </span>
                ) : (
                  <>
                    <span>Load More Stories</span>
                    <Sparkles className="w-3.5 h-3.5 text-blue-500 group-hover:rotate-12 transition-transform duration-300" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      ) : filteredOutStats.total > 0 ? (
        <div
          id="discover-filtered-empty"
          className="p-10 sm:p-14 text-center space-y-4 bg-white/85 dark:bg-[#0c1222]/90 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-200/70 dark:border-slate-800/80 text-gray-900 dark:text-slate-100"
        >
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
            <EyeOff id="discover-filtered-empty-icon" className="w-7 h-7" />
          </div>
          <div id="discover-filtered-empty-content" className="space-y-1">
            <h3 id="discover-filtered-empty-title" className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
              All loaded posts are hidden by your filters
            </h3>
            <p
              id="discover-filtered-empty-text"
              className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed"
            >
              {filteredOutStats.total} {filteredOutStats.total === 1 ? 'post' : 'posts'} matched your muted words or authors.
            </p>
          </div>
          <div
            id="discover-filtered-empty-actions"
            className="flex items-center justify-center gap-3 flex-wrap pt-2"
          >
            <button
              id="discover-filtered-empty-adjust-btn"
              onClick={openContentFilterModal}
              className="px-5 py-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold transition shadow-sm hover:shadow-md cursor-pointer active:scale-95"
            >
              Adjust Content Filters
            </button>
            <button
              id="discover-filtered-empty-pause-btn"
              onClick={toggleFilterEnabled}
              className="px-5 py-2.5 text-xs bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-full font-bold transition cursor-pointer active:scale-95"
            >
              Temporarily Pause Filters
            </button>
          </div>
        </div>
      ) : (
        <div
          id="discover-empty"
          className="p-12 sm:p-16 text-center space-y-4 bg-white/85 dark:bg-[#0c1222]/90 backdrop-blur-xl rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-200/70 dark:border-slate-800/80 text-gray-900 dark:text-slate-100"
        >
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto border border-blue-500/20">
            <Compass id="discover-empty-icon" className="w-7 h-7" />
          </div>
          <p id="discover-empty-text" className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 font-medium max-w-md mx-auto leading-relaxed">
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
              <div className="flex items-center justify-center gap-2 text-xs text-violet-600 dark:text-violet-400 font-semibold pt-1">
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
              className="px-5 py-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold transition shadow-sm hover:shadow-md cursor-pointer active:scale-95"
            >
              {selectedLanguage !== 'global' ? 'Reset to Global Feed' : 'Refresh Feed'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  RefreshCw,
  X,
  UserPlus,
  MessageSquare,
  FileText,
  Zap,
  Shuffle,
  Repeat,
  ChevronDown,
  SlidersHorizontal,
  ShieldAlert,
  EyeOff,
  Users
} from 'lucide-react';
import {
  HivePost,
  getAccountPosts,
  getFollowedCommentsFeed,
  getFollowedMixedFeed,
  getFollowedRootFeed,
  isReblogPost,
  getRebloggedBy,
  getHiveAvatarUrl
} from '../services/hiveApi';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useContentFilter } from '../context/ContentFilterContext';
import { PostCard } from '../components/PostCard';
import { GalleryPostCard } from '../components/GalleryPostCard';
import { appendUniquePosts } from '../utils/posts';
import { requestLogin } from '../utils/authEvents';

export const FeedPage: React.FC = () => {
  const { currentUser } = useAuth();
  const {
    feedAuthor,
    setFeedAuthor,
    authorFeedMode,
    setAuthorFeedMode,
    handleSelectAuthor,
    handleSelectPost,
    openAuthorProfile,
    openContentFilterModal,
    openFollowingManager,
    setActiveNav,
    setTag
  } = useNavigation();

  const {
    config: contentFilterConfig,
    addFilterWord,
    addFilterAuthor,
    toggleFilterEnabled,
    filterPostsList
  } = useContentFilter();

  // Following feed mode: root, comments, mixed
  const [followingMode, setFollowingMode] = useState<'root' | 'comments' | 'mixed'>(() => {
    try {
      const saved = localStorage.getItem('hive_following_mode');
      if (saved === 'root' || saved === 'comments' || saved === 'mixed') {
        return saved;
      }
    } catch {}
    return 'root';
  });

  // Reblog hiding preference
  const [hideReblogs, setHideReblogs] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hive_hide_reblogs') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleHideReblogs = () => {
    setHideReblogs((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('hive_hide_reblogs', String(next));
      } catch {}
      return next;
    });
  };

  const [posts, setPosts] = useState<HivePost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const queryGen = useRef(0);
  const username = currentUser?.username || '';

  // Responsive mobile detection (mobile defaults to gallery mode)
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 640 : false;
  });

  // Mobile Pull-to-Refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 5) {
      touchStartYRef.current = e.touches[0].clientY;
    } else {
      touchStartYRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartYRef.current !== null && window.scrollY <= 5) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartYRef.current;
      if (diff > 0) {
        setPullDistance(Math.min(Math.floor(diff * 0.4), 60));
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance >= 45) {
      fetchPosts(true);
    }
    setPullDistance(0);
    touchStartYRef.current = null;
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const openPost = useCallback((post: HivePost, jump?: boolean) => {
    handleSelectPost(post, true, Boolean(jump));
  }, [handleSelectPost]);

  const openTag = useCallback((nextTag: string) => {
    setTag(nextTag);
    setActiveNav('discover');
    setFeedAuthor(null);
  }, [setTag, setActiveNav, setFeedAuthor]);

  // Fetch feed posts
  const fetchPosts = useCallback(
    async (isRefresh = false) => {
      const gen = ++queryGen.current;
      if (!username && !feedAuthor) {
        setPosts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let fetched: HivePost[] = [];
        if (feedAuthor) {
          fetched = await getAccountPosts(authorFeedMode, feedAuthor, 20, isRefresh);
        } else if (username) {
          if (followingMode === 'comments') {
            fetched = await getFollowedCommentsFeed(username, isRefresh);
          } else if (followingMode === 'mixed') {
            fetched = await getFollowedMixedFeed(username, isRefresh);
          } else {
            fetched = await getFollowedRootFeed(username, 20, isRefresh);
          }
        }
        if (gen !== queryGen.current) return;
        setPosts(fetched || []);
      } catch (err: any) {
        if (gen !== queryGen.current) return;
        console.error('Failed to load feed:', err);
        setError(err.message || 'Unable to fetch your feed from Hive RPC.');
      } finally {
        if (gen === queryGen.current) setLoading(false);
      }
    },
    [username, feedAuthor, authorFeedMode, followingMode]
  );

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Load more posts (pagination)
  const handleLoadMore = async () => {
    if (loadingMore || posts.length === 0) return;
    const gen = queryGen.current;
    setLoadingMore(true);

    try {
      const lastPost = posts[posts.length - 1];
      let more: HivePost[] = [];
      if (feedAuthor) {
        more = await getAccountPosts(authorFeedMode, feedAuthor, 20, false, lastPost.author, lastPost.permlink);
      } else if (username) {
        if (followingMode === 'root') {
          more = await getFollowedRootFeed(username, 20, false, lastPost.author, lastPost.permlink);
        } else if (followingMode === 'comments') {
          more = await getFollowedCommentsFeed(username, false, Math.min(posts.length + 20, 100));
        } else {
          more = await getFollowedMixedFeed(username, false, Math.min(posts.length + 20, 100));
        }
      }
      if (gen !== queryGen.current) return;
      setPosts((prev) => appendUniquePosts(prev, more));
    } catch (err: any) {
      console.error('Failed to load more feed posts:', err);
    } finally {
      if (gen === queryGen.current) setLoadingMore(false);
    }
  };

  // Reblog filter & Content filter
  const { displayedPosts, filteredOutStats } = useMemo(() => {
    let candidatePosts = posts;
    if (hideReblogs && (followingMode === 'root' || followingMode === 'mixed')) {
      candidatePosts = posts.filter((p) => !isReblogPost(p));
    }

    const filterRes = filterPostsList(candidatePosts);

    const seen = new Set<string>();
    const uniquePosts: HivePost[] = [];
    for (const post of filterRes.visiblePosts) {
      const reblogUser = getRebloggedBy(post);
      const key = `${reblogUser ? reblogUser + ':' : ''}${post.author}/${post.permlink}`;
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
  }, [posts, hideReblogs, followingMode, filterPostsList]);

  return (
    <div
      className="space-y-4 w-full min-w-0 max-w-[824px]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Mobile Pull-to-Refresh Indicator */}
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center transition-all overflow-hidden sm:hidden"
          style={{ height: `${pullDistance}px` }}
        >
          <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold bg-white dark:bg-slate-900 px-3 py-1 rounded-full shadow-sm border border-blue-100 dark:border-blue-900/50">
            <RefreshCw className={`w-3.5 h-3.5 ${pullDistance >= 45 ? 'animate-spin' : ''}`} />
            <span>{pullDistance >= 45 ? 'Release to refresh' : 'Pull to refresh'}</span>
          </div>
        </div>
      )}

      {/* Author Feed Filter Banner (When author filter is active) */}
      {feedAuthor && (
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none flex items-center justify-between gap-3 animate-in fade-in text-gray-900 dark:text-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={getHiveAvatarUrl(feedAuthor, 'medium')}
              alt={feedAuthor}
              className="w-11 h-11 rounded-full object-cover shadow-xs border border-gray-100 dark:border-slate-800"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/medium';
              }}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">@{feedAuthor}</span>
                <span className="text-xs text-gray-400 dark:text-slate-500">on feed</span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setAuthorFeedMode('posts')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                    authorFeedMode === 'posts'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  <span>Posts</span>
                </button>

                <button
                  onClick={() => setAuthorFeedMode('comments')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                    authorFeedMode === 'comments'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Comments & Replies</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => feedAuthor && openAuthorProfile(feedAuthor)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline hidden sm:inline"
            >
              Wallet & Profile
            </button>
            <button
              onClick={() => setFeedAuthor(null)}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 transition cursor-pointer"
              title="Clear author filter"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Feed Controls Header */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-3 sm:px-6 sm:py-3.5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none text-gray-900 dark:text-slate-100 relative z-20" style={{ marginBottom: '5px', borderRadius: '15px', minHeight: '45px' }}>
        <div className="flex flex-row items-center justify-between gap-1.5 sm:gap-3">
          <div className="flex items-center flex-wrap sm:flex-nowrap gap-1 sm:gap-2.5 min-w-0">
            {/* "Your Feed" title (hidden on mobile to save space) */}
            <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base hidden sm:inline">
              Your Feed
            </span>

            {/* Feed Mode Selector Dropdown: compact icon-only on mobile, full on desktop */}
            <div className="relative inline-flex items-center">
              {/* Mobile compact select (icon + label + chevron) */}
              <div className="sm:hidden relative inline-flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200/80 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 text-sm font-semibold px-3 py-1.5 rounded-xl border border-gray-200/70 dark:border-slate-700 shadow-2xs">
                <span className="text-blue-600 dark:text-blue-400">
                  {followingMode === 'root' ? (
                    <FileText className="w-4 h-4" />
                  ) : followingMode === 'comments' ? (
                    <MessageSquare className="w-4 h-4" />
                  ) : (
                    <Shuffle className="w-4 h-4" />
                  )}
                </span>
                <span className="capitalize text-sm font-semibold">
                  {followingMode === 'root' ? 'Root' : followingMode === 'comments' ? 'Comments' : 'Mixed'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                <select
                  id="following-feed-mode-select-mobile"
                  value={followingMode}
                  onChange={(e) => {
                    const mode = e.target.value as 'root' | 'comments' | 'mixed';
                    setFollowingMode(mode);
                    try {
                      localStorage.setItem('hive_following_mode', mode);
                    } catch {}
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Filter following feed mode"
                >
                  <option value="root">Root Posts</option>
                  <option value="comments">Comments</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>

              {/* Desktop full select */}
              <div className="hidden sm:inline-flex relative items-center">
                <select
                  id="following-feed-mode-select"
                  value={followingMode}
                  onChange={(e) => {
                    const mode = e.target.value as 'root' | 'comments' | 'mixed';
                    setFollowingMode(mode);
                    try {
                      localStorage.setItem('hive_following_mode', mode);
                    } catch {}
                  }}
                  className="appearance-none bg-gray-100 dark:bg-slate-800 hover:bg-gray-200/80 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 text-xs font-semibold pl-8 pr-7 py-1.5 rounded-xl border border-gray-200/70 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition shadow-2xs"
                  title="Filter following feed mode"
                >
                  <option value="root">Root Posts</option>
                  <option value="comments">Comments</option>
                  <option value="mixed">Mixed</option>
                </select>
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-blue-600 dark:text-blue-400">
                  {followingMode === 'root' ? (
                    <FileText className="w-3.5 h-3.5" />
                  ) : followingMode === 'comments' ? (
                    <MessageSquare className="w-3.5 h-3.5" />
                  ) : (
                    <Shuffle className="w-3.5 h-3.5" />
                  )}
                </div>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-slate-400" />
              </div>
            </div>

            {/* Reblogs Checkmark Toggle: icon-only on mobile, full text on desktop */}
            {followingMode !== 'comments' && (
              <label
                className={`inline-flex items-center gap-1.5 sm:gap-1.5 px-2.5 sm:px-2.5 py-1.5 sm:py-1.5 rounded-xl text-sm sm:text-xs font-semibold border transition cursor-pointer select-none ${
                  !hideReblogs
                    ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 hover:bg-purple-100/70'
                    : 'bg-white dark:bg-slate-800 border-gray-200/80 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
                title={!hideReblogs ? 'Reblogs are visible. Uncheck to hide.' : 'Reblogs are hidden. Check to show.'}
              >
                <input
                  type="checkbox"
                  checked={!hideReblogs}
                  onChange={handleToggleHideReblogs}
                  className="w-4 h-4 sm:w-3.5 sm:h-3.5 rounded text-purple-600 focus:ring-purple-500 border-gray-300 dark:border-slate-600 cursor-pointer accent-purple-600"
                />
                <Repeat className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-purple-600 dark:text-purple-400" />
                <span className="hidden sm:inline">Reblogs</span>
              </label>
            )}

            {/* Manage Followed Link: compact icon button on mobile, text on desktop */}
            {currentUser && (
              <button
                onClick={openFollowingManager}
                className="inline-flex items-center gap-1 px-2 py-1.5 sm:px-0 sm:py-0 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 sm:bg-transparent border border-blue-150 dark:border-blue-900/40 sm:border-0 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold ml-0.5 sm:ml-1 cursor-pointer transition shadow-2xs sm:shadow-none"
                title="Manage Followed authors"
              >
                <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span className="hidden sm:inline">Manage Followed</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Content Filters Button: icon and badge only on mobile, text on desktop */}
            <button
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
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Filters</span>
              {contentFilterConfig.enabled && (contentFilterConfig.words.length > 0 || contentFilterConfig.authors.length > 0) && (
                <span
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

            {/* Force refresh button (desktop only; mobile uses pull-to-refresh) */}
            <button
              onClick={() => fetchPosts(true)}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer hidden sm:flex"
              title="Force refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-3xl bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300 flex items-start justify-between" style={{ height: '30px', marginBottom: '5px', paddingTop: '10px', borderRadius: '15px', overflow: 'hidden' }}>
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


      {/* Loading Skeleton */}
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
      ) : !currentUser && !feedAuthor ? (
        /* Guest user in feed */
        <div className="p-12 text-center space-y-4 bg-white dark:bg-slate-900 rounded-3xl shadow-[0_1px_6px_rgba(0,0,0,0.03)] border border-gray-100 dark:border-slate-800">
          <UserPlus className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-gray-800 dark:text-white">Connect your Hive account</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
              Log in with Hive Keychain in the top navigation bar to see posts from the authors and curators you follow, or explore the global Discover feed.
            </p>
          </div>
          <button
            onClick={() => setActiveNav('discover')}
            className="px-5 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold transition shadow-xs cursor-pointer"
          >
            Explore Discover Feed
          </button>
        </div>
      ) : posts.length === 0 ? (
        /* Empty following feed */
        <div className="p-12 text-center space-y-4 bg-white dark:bg-slate-900 rounded-3xl shadow-[0_1px_6px_rgba(0,0,0,0.03)] border border-gray-100 dark:border-slate-800">
          <UserPlus className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-gray-800 dark:text-white">
              {followingMode === 'comments'
                ? 'No recent comments found'
                : followingMode === 'mixed'
                ? 'No recent activity found'
                : "You aren't following anyone yet or they haven't posted recently"}
            </h3>
            <p className="text-sm sm:text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
              {followingMode === 'comments'
                ? 'None of the accounts you follow commented in the last 7 days, or your following list is empty.'
                : followingMode === 'mixed'
                ? 'No root stories or comments were detected from followed accounts in the last 7 days.'
                : 'Follow creators across Hive to see their latest stories here, or explore Discover.'}
            </p>
          </div>
          <button
            onClick={() => setActiveNav('discover')}
            className="px-5 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold transition shadow-xs cursor-pointer"
          >
            Explore Discover Feed
          </button>
        </div>
      ) : displayedPosts.length > 0 ? (
        <div className={isMobile ? "space-y-3 sm:space-y-6" : "space-y-4"}>
          {displayedPosts.map((post, index) => {
            const isComment = Boolean(post.parent_author) || (typeof post.depth === 'number' && post.depth > 0);
            const useGallery = isMobile && !isComment;
            const reblogUser = getRebloggedBy(post);
            const postKey = `${reblogUser ? reblogUser + ':' : ''}${post.author}/${post.permlink}`;
            return useGallery ? (
              <GalleryPostCard
                key={postKey}
                post={post}
                postIndex={index}
                onSelectPost={openPost}
                onSelectAuthor={handleSelectAuthor}
                onSelectTag={openTag}
                currentUser={currentUser}
                onRequireLogin={requestLogin}
                onMuteAuthor={addFilterAuthor}
                onBlockWord={addFilterWord}
              />
            ) : (
              <PostCard
                key={postKey}
                post={post}
                postIndex={index}
                inFeed={true}
                onSelectPost={openPost}
                onSelectAuthor={handleSelectAuthor}
                onSelectTag={openTag}
                currentUser={currentUser}
                onRequireLogin={requestLogin}
                onMuteAuthor={addFilterAuthor}
                onBlockWord={addFilterWord}
              />
            );
          })}

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
        /* Filters empty state */
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
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-4 py-2 text-xs bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-full font-semibold transition cursor-pointer"
            >
              {loadingMore ? 'Loading...' : 'Load More Posts'}
            </button>
          </div>
        </div>
      ) : (
        /* All reblogs empty state */
        <div className="p-12 text-center space-y-4 bg-white dark:bg-slate-900 rounded-3xl shadow-[0_1px_6px_rgba(0,0,0,0.03)] border border-gray-100 dark:border-slate-800 text-gray-900 dark:text-slate-100">
          <Repeat className="w-10 h-10 text-purple-400 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-gray-800 dark:text-white">All loaded posts are reblogs</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
              You unchecked "Reblogs". Check the box or load more posts to view them.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleToggleHideReblogs}
              className="px-4 py-2 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-full font-semibold transition cursor-pointer shadow-xs"
            >
              Enable Reblogs
            </button>
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-4 py-2 text-xs bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-full font-semibold transition cursor-pointer"
            >
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

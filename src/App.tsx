import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  RefreshCw,
  Compass,
  X,
  Layers,
  Users,
  Hash,
  UserPlus,
  MessageSquare,
  FileText,
  Zap,
  Sparkles,
  Shuffle,
  Repeat,
  ChevronDown,
  SlidersHorizontal,
  Filter,
  ShieldAlert,
  EyeOff,
  UserX
} from 'lucide-react';
import {
  HivePost,
  getRankedPosts,
  getCachedRankedPosts,
  getAccountPosts,
  getHiveAvatarUrl,
  getDiscussion,
  apiCache,
  getFollowedCommentsFeed,
  getFollowedMixedFeed,
  getFollowedRootFeed,
  getFollowing,
  isReblogPost
} from './services/hiveApi';
import { KeychainService, CurrentUser } from './services/keychain';
import { Navbar } from './components/Navbar';
import { LeftSidebar } from './components/LeftSidebar';
import { PostCard } from './components/PostCard';
import { RecommendedUsersCard } from './components/RecommendedUsersCard';
import { PostReader } from './components/PostReader';
import { PostSidebar } from './components/PostSidebar';
import { PostHeading } from './utils/sanitize';
import { AccountModal } from './components/AccountModal';
import { BlockchainStatsModal } from './components/BlockchainStatsModal';
import { CommunitiesModal } from './components/CommunitiesModal';
import { ManageCommunitiesModal } from './components/ManageCommunitiesModal';
import { ContentFilterModal } from './components/ContentFilterModal';
import { SortDropdown } from './components/SortDropdown';
import { LanguageDropdown } from './components/LanguageDropdown';
import { CategoryDropdown } from './components/CategoryDropdown';
import { CategorySubtopicsBar } from './components/CategorySubtopicsBar';
import { TrendingTopicsCard } from './components/TrendingTopicsCard';
import { ShortsFeed } from './components/ShortsFeed';
import { ShortsWordFilterCard } from './components/ShortsWordFilterCard';
import { getLanguageDiscoveryFeed } from './services/combflowApi';
import { findCategoryByTag } from './data/categorySubtopics';
import {
  loadFilterConfig,
  saveFilterWords,
  saveFilterAuthors,
  saveFilterEnabled,
  applyContentFilter,
  ContentFilterConfig
} from './utils/contentFilter';
import { ThemeMode, getInitialTheme, applyTheme } from './utils/theme';

function getInitialUrlParams() {
  if (typeof window === 'undefined') return {};
  try {
    const params = new URLSearchParams(window.location.search);
    let tab = params.get('tab') as 'feed' | 'discover' | 'shorts' | 'communities' | null;
    if ((tab as string) === 'following') tab = 'feed';
    if ((tab as string) === 'decks' || (tab as string) === 'explorer') tab = 'discover';
    if ((tab as string) === 'waves') tab = 'shorts';

    return {
      tab,
      sort: params.get('sort') as 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted' | null,
      tag: params.get('tag') || '',
      source: params.get('source') as 'following' | 'communities' | 'global' | null,
      post: params.get('post') || null,
      author: params.get('author') || null,
      lang: params.get('lang') || 'global'
    };
  } catch {
    return {};
  }
}

const DEFAULT_TOP_COMMUNITIES = [
  {
    name: 'hive-125125',
    title: 'Town Square',
    about: 'The general community for Hive. Share ideas, stories, projects, and meet fellow Hivers.',
    subscribers: 11911,
    avatar: 'https://images.ecency.com/u/hive-125125/avatar/small'
  },
  {
    name: 'hive-193816',
    title: 'Music',
    about: 'Music on the Blockchain. Share original music, reviews, acoustic sets, and production.',
    subscribers: 11351,
    avatar: 'https://images.ecency.com/u/hive-193816/avatar/small'
  },
  {
    name: 'hive-163772',
    title: 'Worldmappin',
    about: 'The Hive travel community. Share travel blogs, pin your photos on the world map!',
    subscribers: 18491,
    avatar: 'https://images.ecency.com/u/hive-163772/avatar/small'
  }
];

/**
 * Ranks incoming posts by comment count (children descending) for Discover and Categories
 * when sort is Hot, Trending, etc., but preserves exact order for 'created' (New tab).
 */
function sortPostsByCommentsIfApplicable(
  items: HivePost[],
  currentSort: string,
  isDiscoverOrCategory: boolean
): HivePost[] {
  if (!isDiscoverOrCategory || currentSort === 'created') {
    return items;
  }
  return [...items].sort((a, b) => ((b.children ?? 0) - (a.children ?? 0)));
}

export function App() {
  const initialParams = useRef(getInitialUrlParams()).current;

  // Hive Keychain Current User state
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    return KeychainService.getCurrentUser();
  });

  // Sort order: initialize from URL if valid, otherwise 'hot'
  const [sort, setSort] = useState<'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted'>(() => {
    if (initialParams.sort && ['trending', 'hot', 'created', 'payout', 'muted', 'promoted'].includes(initialParams.sort)) {
      return initialParams.sort;
    }
    return 'hot';
  });

  const [tag, setTag] = useState<string>(() => initialParams.tag || '');
  const [activeNav, setActiveNav] = useState<'feed' | 'discover' | 'shorts' | 'communities'>(() => {
    if (initialParams.tab && ['feed', 'discover', 'shorts', 'communities'].includes(initialParams.tab)) {
      return initialParams.tab;
    }
    if ((initialParams.tab as any) === 'waves') return 'shorts';
    if (initialParams.source === 'following') return 'feed';
    if (initialParams.source === 'communities') return 'communities';
    return 'discover';
  });

  // Derived sourceTab for backwards compatibility
  const sourceTab: 'following' | 'communities' | 'global' =
    activeNav === 'feed' ? 'following' : activeNav === 'communities' ? 'communities' : 'global';

  // Author feed filter (showing user posts or comments directly in the feed)
  const [feedAuthor, setFeedAuthor] = useState<string | null>(() => initialParams.author || null);
  const [authorFeedMode, setAuthorFeedMode] = useState<'posts' | 'comments'>('posts');

  // Following feed filter mode: root posts, comments, or mixed (chronological)
  const [followingMode, setFollowingMode] = useState<'root' | 'comments' | 'mixed'>(() => {
    try {
      const saved = localStorage.getItem('hive_following_mode');
      if (saved === 'root' || saved === 'comments' || saved === 'mixed') {
        return saved;
      }
    } catch {}
    return 'root';
  });

  // Reblog hiding preference in Following feed (with persistence)
  const [hideReblogs, setHideReblogs] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hive_hide_reblogs') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleHideReblogs = () => {
    setHideReblogs(prev => {
      const next = !prev;
      try {
        localStorage.setItem('hive_hide_reblogs', String(next));
      } catch {}
      return next;
    });
  };

  // Followed creators list for the current user
  const [followingUsersList, setFollowingUsersList] = useState<string[]>([]);

  useEffect(() => {
    if (currentUser?.username) {
      getFollowing(currentUser.username, '', 80)
        .then(users => setFollowingUsersList(users || []))
        .catch(() => setFollowingUsersList([]));
    } else {
      setFollowingUsersList([]);
    }
  }, [currentUser?.username]);

  // Discover Language filter ('global' or specific language code like 'de', 'es', 'pt', etc.)
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => initialParams.lang || 'global');

  // Discover Category definition (art, photography, gaming, crypto, etc.) if current tag matches or is a subtopic
  const activeCategory = useMemo(() => {
    if (activeNav !== 'discover' || !tag) return undefined;
    return findCategoryByTag(tag);
  }, [activeNav, tag]);

  const [posts, setPosts] = useState<HivePost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Communities joined by user
  const [joinedCommunities, setJoinedCommunities] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('hive_joined_communities');
      return saved ? JSON.parse(saved) : { 'hive-125125': true, 'hive-193816': true, 'hive-163772': true };
    } catch {
      return { 'hive-125125': true, 'hive-193816': true, 'hive-163772': true };
    }
  });

  // Modals & Inspection states
  const [selectedPost, setSelectedPost] = useState<HivePost | null>(null);
  const [postHeadings, setPostHeadings] = useState<PostHeading[]>([]);
  const [selectedAuthorProfile, setSelectedAuthorProfile] = useState<string | null>(null);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showCommunitiesModal, setShowCommunitiesModal] = useState<boolean>(false);
  const [showManageCommunitiesModal, setShowManageCommunitiesModal] = useState<boolean>(false);
  const [showContentFilterModal, setShowContentFilterModal] = useState<boolean>(false);

  // Dark Mode (Night Mode) state with localStorage caching
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // Persistent Content Filters for Feed & Discover (Words & Authors saved in cache)
  const [contentFilterConfig, setContentFilterConfig] = useState<ContentFilterConfig>(() => loadFilterConfig());

  const handleAddFilterWord = useCallback((word: string) => {
    const clean = word.trim().toLowerCase();
    if (!clean) return;
    setContentFilterConfig((prev) => {
      if (prev.words.includes(clean)) return prev;
      const nextWords = [...prev.words, clean];
      saveFilterWords(nextWords);
      return { ...prev, words: nextWords };
    });
  }, []);

  const handleRemoveFilterWord = useCallback((word: string) => {
    setContentFilterConfig((prev) => {
      const nextWords = prev.words.filter((w) => w !== word);
      saveFilterWords(nextWords);
      return { ...prev, words: nextWords };
    });
  }, []);

  const handleClearFilterWords = useCallback(() => {
    saveFilterWords([]);
    setContentFilterConfig((prev) => ({ ...prev, words: [] }));
  }, []);

  const handleAddFilterAuthor = useCallback((author: string) => {
    const clean = author.trim().toLowerCase().replace(/^@/, '');
    if (!clean) return;
    setContentFilterConfig((prev) => {
      if (prev.authors.includes(clean)) return prev;
      const nextAuthors = [...prev.authors, clean];
      saveFilterAuthors(nextAuthors);
      return { ...prev, authors: nextAuthors };
    });
  }, []);

  const handleRemoveFilterAuthor = useCallback((author: string) => {
    setContentFilterConfig((prev) => {
      const nextAuthors = prev.authors.filter((a) => a !== author);
      saveFilterAuthors(nextAuthors);
      return { ...prev, authors: nextAuthors };
    });
  }, []);

  const handleClearFilterAuthors = useCallback(() => {
    saveFilterAuthors([]);
    setContentFilterConfig((prev) => ({ ...prev, authors: [] }));
  }, []);

  const handleToggleContentFilterEnabled = useCallback(() => {
    setContentFilterConfig((prev) => {
      const nextEnabled = !prev.enabled;
      saveFilterEnabled(nextEnabled);
      return { ...prev, enabled: nextEnabled };
    });
  }, []);

  // Shorts hashtags & filtering state
  const [shortsHashtags, setShortsHashtags] = useState<{ tag: string; count: number }[]>([]);
  const [selectedShortTag, setSelectedShortTag] = useState<string>('');
  const [shortsHiddenCount, setShortsHiddenCount] = useState<number>(0);

  // Blocked words list (with localStorage persistence)
  const [blockedWords, setBlockedWords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hive_shorts_blocked_words');
      return saved ? JSON.parse(saved) : ['giveaway', 'airdrop'];
    } catch {
      return ['giveaway', 'airdrop'];
    }
  });

  const [filterEnabled, setFilterEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hive_shorts_filter_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  const handleAddBlockedWord = (word: string) => {
    const clean = word.trim().toLowerCase();
    if (!clean || blockedWords.includes(clean)) return;
    const next = [...blockedWords, clean];
    setBlockedWords(next);
    localStorage.setItem('hive_shorts_blocked_words', JSON.stringify(next));
  };

  const handleRemoveBlockedWord = (word: string) => {
    const next = blockedWords.filter((w) => w !== word);
    setBlockedWords(next);
    localStorage.setItem('hive_shorts_blocked_words', JSON.stringify(next));
  };

  const handleClearAllBlockedWords = () => {
    setBlockedWords([]);
    localStorage.setItem('hive_shorts_blocked_words', JSON.stringify([]));
  };

  const handleToggleFilterEnabled = () => {
    setFilterEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('hive_shorts_filter_enabled', String(next));
      return next;
    });
  };

  // Stable callbacks for Shorts feed to prevent unnecessary re-renders
  const handleShortsHashtagsExtracted = useCallback((tags: { tag: string; count: number }[]) => {
    setShortsHashtags(tags);
  }, []);

  const handleShortsHiddenCountChange = useCallback((cnt: number) => {
    setShortsHiddenCount(cnt);
  }, []);

  const handleSelectShortTag = useCallback((st: string) => {
    setSelectedShortTag(st);
  }, []);

  // Preserve scroll position when opening and closing posts
  const feedScrollPositionRef = useRef<number>(0);
  const isPopStateRef = useRef<boolean>(false);

  // Toggle join community
  const toggleJoinCommunity = (communityName: string) => {
    setJoinedCommunities(prev => {
      const updated = {
        ...prev,
        [communityName]: !prev[communityName]
      };
      localStorage.setItem('hive_joined_communities', JSON.stringify(updated));
      return updated;
    });
  };

  // Check if user has joined at least one community
  const hasJoinedCommunities = Object.values(joinedCommunities).some(Boolean);

  // Filtered posts taking "Hide Reblogs" setting and Content Filters (words & authors) into account,
  // strictly deduplicated so children keys are always unique
  const { displayedPosts, filteredOutStats } = useMemo(() => {
    // 1. Reblogs filter for Following Feed
    let candidatePosts = posts;
    if (activeNav === 'feed' && hideReblogs && (followingMode === 'root' || followingMode === 'mixed')) {
      candidatePosts = posts.filter(p => !isReblogPost(p));
    }

    // 2. Content Filters (Words and Authors) across Feed, Discover, and Communities
    const filterRes = applyContentFilter(candidatePosts, contentFilterConfig);

    // 3. Strictly deduplicate visible posts to prevent React duplicate key warnings and UI duplicates
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
  }, [posts, activeNav, hideReblogs, followingMode, contentFilterConfig]);

  // Fetch posts based on feedAuthor OR active sourceTab, sort, tag
  const fetchPosts = useCallback(async (isRefresh = false) => {
    // If activeNav is shorts, ShortsFeed handles its own microblogging lifecycle
    if (activeNav === 'shorts' || (activeNav as string) === 'waves') {
      setLoading(false);
      return;
    }

    // Check if we already have cached posts to render immediately without blank screen
    let hasCached = false;
    if (!isRefresh && !feedAuthor && sort !== 'created' && (activeNav !== 'discover' || selectedLanguage === 'global')) {
      let queryTag = tag;
      const observer = currentUser?.username || '';
      if (sourceTab === 'communities' && !queryTag) {
        queryTag = 'my';
      }
      const cached = getCachedRankedPosts(sort, queryTag, 20, undefined, undefined, observer);
      if (cached && cached.length > 0) {
        const isDiscoverOrCategory = (activeNav === 'discover' || activeNav === 'communities' || Boolean(tag));
        setPosts(sortPostsByCommentsIfApplicable(cached, sort, isDiscoverOrCategory));
        hasCached = true;
      }
    }

    if (!isRefresh && !hasCached) {
      setLoading(true);
    }
    setError(null);

    try {
      let fetched: HivePost[] = [];

      // If user filtered by a specific author to see their posts or comments in the feed
      if (feedAuthor) {
        fetched = await getAccountPosts(authorFeedMode, feedAuthor, 20, isRefresh);
      } else if (activeNav === 'feed') {
        if (currentUser) {
          try {
            if (followingMode === 'comments') {
              fetched = await getFollowedCommentsFeed(currentUser.username, isRefresh);
            } else if (followingMode === 'mixed') {
              fetched = await getFollowedMixedFeed(currentUser.username, isRefresh);
            } else {
              fetched = await getFollowedRootFeed(currentUser.username, 20, isRefresh);
            }
          } catch {
            fetched = [];
          }
        } else {
          fetched = [];
        }
      } else if (activeNav === 'communities') {
        const observer = currentUser?.username || '';
        let queryTag = tag;
        if (!queryTag) {
          queryTag = observer ? 'my' : 'hive-125125';
        }

        fetched = await getRankedPosts(sort, queryTag, 20, undefined, undefined, observer, isRefresh);
      } else {
        // 'discover'
        if (selectedLanguage !== 'global') {
          fetched = await getLanguageDiscoveryFeed({
            language: selectedLanguage,
            limit: 20,
            offset: 0,
            observer: currentUser?.username || '',
            category: tag || undefined,
          });
        } else {
          // Global
          fetched = await getRankedPosts(sort, tag, 20, undefined, undefined, '', isRefresh);
        }
      }

      // Rank by comment count for Discover and Categories when not New
      const isDiscoverOrCategory = (activeNav === 'discover' || activeNav === 'communities' || Boolean(tag));
      const rankedBatch = sortPostsByCommentsIfApplicable(fetched || [], sort, isDiscoverOrCategory);
      setPosts(rankedBatch);
    } catch (err: any) {
      console.error('Hive RPC Fetch Error:', err);
      setError(
        err.message || 'Unable to connect to Hive RPC node. Please check your network or switch nodes.'
      );
    } finally {
      setLoading(false);
    }
  }, [sort, tag, activeNav, currentUser, joinedCommunities, feedAuthor, authorFeedMode, selectedLanguage, followingMode]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Load more posts (pagination)
  const handleLoadMore = async () => {
    if (loadingMore || posts.length === 0) return;
    setLoadingMore(true);

    const lastPost = posts[posts.length - 1];
    try {
      if (feedAuthor) {
        const more = await getAccountPosts(authorFeedMode, feedAuthor, 20);
        setPosts(prev => [...prev, ...more.slice(prev.length)]);
      } else if (activeNav === 'feed') {
        if (currentUser) {
          if (followingMode === 'root') {
            const lastPost = posts[posts.length - 1];
            const more = await getFollowedRootFeed(
              currentUser.username,
              20,
              true,
              lastPost.author,
              lastPost.permlink
            );
            const currentKeys = new Set(posts.map(p => `${p.author}/${p.permlink}`));
            const newOnes = more.filter(p => !currentKeys.has(`${p.author}/${p.permlink}`));
            if (newOnes.length > 0) {
              setPosts(prev => [...prev, ...newOnes]);
            }
          } else if (followingMode === 'comments') {
            const more = await getFollowedCommentsFeed(currentUser.username, true, Math.min(posts.length + 20, 100));
            const currentKeys = new Set(posts.map(p => `${p.author}/${p.permlink}`));
            const newOnes = more.filter(p => !currentKeys.has(`${p.author}/${p.permlink}`));
            if (newOnes.length > 0) {
              setPosts(prev => [...prev, ...newOnes]);
            } else {
              //setNoMoreComments(true); // ou algum estado que desabilite o botão / mostre "sem mais posts recentes"
              }
            } else {
              const more = await getFollowedMixedFeed(currentUser.username, true, Math.min(posts.length + 20, 100));
              const currentKeys = new Set(posts.map(p => `${p.author}/${p.permlink}`));
              const newOnes = more.filter(p => !currentKeys.has(`${p.author}/${p.permlink}`));
              if (newOnes.length > 0) {
                setPosts(prev => [...prev, ...newOnes]);
              } else {
                //setNoMoreComments(true);
              }
            }
        }
      } else if (activeNav === 'communities') {
          let queryTag = tag;
          const observer = currentUser?.username || '';
          if (!queryTag) {
            queryTag = observer ? 'my' : 'hive-125125';
          }

          const more = await getRankedPosts(
            sort,
            queryTag,
            20,
            lastPost.author,
            lastPost.permlink,
            observer
          );
          const currentKeys = new Set(posts.map(p => `${p.author}/${p.permlink}`));
          const uniqueMore = more.filter(p => !currentKeys.has(`${p.author}/${p.permlink}`));
          const isDiscoverOrCategory = Boolean(tag);
          const rankedMore = sortPostsByCommentsIfApplicable(uniqueMore, sort, isDiscoverOrCategory);
          setPosts((prev) => [...prev, ...rankedMore]);
        } else {
        // discover
        if (selectedLanguage !== 'global') {
          const currentOffset = posts.length;
          const more = await getLanguageDiscoveryFeed({
            language: selectedLanguage,
            limit: 20,
            offset: currentOffset,
            observer: currentUser?.username || '',
            category: tag || undefined,
          });
          const existingKeys = new Set(posts.map((p) => `${p.author}/${p.permlink}`));
          const uniqueMore = more.filter((p) => !existingKeys.has(`${p.author}/${p.permlink}`));
          const rankedMore = sortPostsByCommentsIfApplicable(uniqueMore, sort, true);
          setPosts((prev) => [...prev, ...rankedMore]);
        } else {
          // Global
          const more = await getRankedPosts(
            sort,
            tag,
            20,
            lastPost.author,
            lastPost.permlink
          );
          const currentKeys = new Set(posts.map(p => `${p.author}/${p.permlink}`));
          const uniqueMore = more.filter(p => !currentKeys.has(`${p.author}/${p.permlink}`));
          const rankedMore = sortPostsByCommentsIfApplicable(uniqueMore, sort, true);
          setPosts((prev) => [...prev, ...rankedMore]);
        }
      }
    } catch (err: any) {
      console.error('Failed to load more posts:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Open post and push to browser history, while saving feed scroll position
  const handleSelectPost = useCallback((post: HivePost, pushHistory = true, jumpToComments = false) => {
    feedScrollPositionRef.current = window.scrollY;
    setSelectedPost(post);
    setPostHeadings([]);
    if (!jumpToComments) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    if (pushHistory) {
      const params = new URLSearchParams(window.location.search);
      params.set('post', `@${post.author}/${post.permlink}`);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState(
        {
          type: 'post',
          author: post.author,
          permlink: post.permlink,
          scrollY: feedScrollPositionRef.current
        },
        '',
        newUrl
      );
    }

    if (jumpToComments) {
      setTimeout(() => {
        const el = document.getElementById('comments-section');
        if (el) {
          const yOffset = -75;
          const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 150);
    }
  }, []);

  // Close post and restore the exact feed scroll position
  const handleClosePost = useCallback(() => {
    // If the post was opened through handleSelectPost which pushed a history state,
    // popping history with back() cleanly restores the browser stack and previous page
    if (window.history.state?.type === 'post') {
      window.history.back();
      return;
    }

    setSelectedPost(null);
    setPostHeadings([]);

    const targetY = feedScrollPositionRef.current;
    requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, behavior: 'instant' });
      setTimeout(() => {
        window.scrollTo({ top: targetY, behavior: 'instant' });
      }, 30);
    });

    const params = new URLSearchParams(window.location.search);
    if (params.has('post')) {
      params.delete('post');
      const query = params.toString();
      const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
      window.history.replaceState(
        {
          tab: activeNav,
          sort,
          tag,
          source: sourceTab,
          author: feedAuthor,
          scrollY: targetY
        },
        '',
        newUrl
      );
    }
  }, [activeNav, sort, tag, sourceTab, feedAuthor]);

  // Main navbar tab change handler that cleanly clears any open post and prevents navigation loops
  const handleNavChange = useCallback((newNav: 'feed' | 'discover' | 'shorts' | 'communities') => {
    setActiveNav(newNav);
    setFeedAuthor(null);
    setTag('');
    setSelectedPost(null);
    setPostHeadings([]);

    const params = new URLSearchParams();
    if (newNav !== 'discover') {
      params.set('tab', newNav);
    }
    const query = params.toString();
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;

    if (selectedPost) {
      window.history.replaceState(
        {
          tab: newNav,
          sort,
          tag: '',
          source: newNav === 'feed' ? 'following' : newNav === 'communities' ? 'communities' : 'global',
          author: null,
          scrollY: 0
        },
        '',
        newUrl
      );
    } else {
      window.history.pushState(
        {
          tab: newNav,
          sort,
          tag: '',
          source: newNav === 'feed' ? 'following' : newNav === 'communities' ? 'communities' : 'global',
          author: null,
          scrollY: 0
        },
        '',
        newUrl
      );
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [selectedPost, sort]);

  // Smooth bookmark heading navigation
  const handleSelectHeading = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -90; // offset for sticky navigation header
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, []);

  // Modal openers that push to history so browser back closes the modal instead of leaving the app
  const openStatsModal = useCallback(() => {
    window.history.pushState({ type: 'modal', modal: 'stats' }, '', window.location.href);
    setShowStatsModal(true);
  }, []);

  const openCommunitiesModal = useCallback(() => {
    window.history.pushState({ type: 'modal', modal: 'communities' }, '', window.location.href);
    setShowCommunitiesModal(true);
  }, []);

  const openManageCommunitiesModal = useCallback(() => {
    window.history.pushState({ type: 'modal', modal: 'manageCommunities' }, '', window.location.href);
    setShowManageCommunitiesModal(true);
  }, []);

  const openAuthorProfile = useCallback((username: string) => {
    window.history.pushState({ type: 'modal', modal: 'account', username }, '', window.location.href);
    setSelectedAuthorProfile(username);
  }, []);

  const openContentFilterModal = useCallback(() => {
    window.history.pushState({ type: 'modal', modal: 'contentFilter' }, '', window.location.href);
    setShowContentFilterModal(true);
  }, []);

  const handleSourceTabChange = (newTab: 'following' | 'communities' | 'global') => {
    if (newTab === 'following') {
      setActiveNav('feed');
    } else if (newTab === 'communities') {
      setActiveNav('communities');
    } else {
      setActiveNav('discover');
    }
    setFeedAuthor(null);
    setTag('');
    if (selectedPost) {
      handleClosePost();
    }
  };

  // Clicking an author filters their posts directly in the feed!
  const handleSelectAuthor = useCallback((author: string) => {
    setFeedAuthor(author);
    setAuthorFeedMode('posts');
    if (selectedPost) {
      handleClosePost();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedPost, handleClosePost]);

  // If initial URL had a direct post link, load that discussion
  useEffect(() => {
    if (initialParams.post) {
      const match = initialParams.post.match(/^@?([^/]+)\/(.+)$/);
      if (match) {
        const [, author, permlink] = match;
        getDiscussion(author, permlink).then((disc) => {
          const root = disc[`${author}/${permlink}`] || Object.values(disc)[0];
          if (root) {
            setSelectedPost(root);
          }
        }).catch((err) => {
          console.error('Failed to load initial post from URL:', err);
        });
      }
    }
  }, [initialParams.post]);

  // Listen for browser Back and Forward button events
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      isPopStateRef.current = true;

      // 1. If any modal was open, close it on back button
      if (showStatsModal || showCommunitiesModal || showManageCommunitiesModal || selectedAuthorProfile || showContentFilterModal) {
        setShowStatsModal(false);
        setShowCommunitiesModal(false);
        setShowManageCommunitiesModal(false);
        setSelectedAuthorProfile(null);
        setShowContentFilterModal(false);
        setTimeout(() => { isPopStateRef.current = false; }, 50);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const postParam = params.get('post');

      // 2. If a post was open and now there's no post in URL -> user hit back to return to feed
      if (selectedPost && !postParam) {
        setSelectedPost(null);
        setPostHeadings([]);
        const targetY = event.state?.scrollY ?? feedScrollPositionRef.current;
        requestAnimationFrame(() => {
          window.scrollTo({ top: targetY, behavior: 'instant' });
          setTimeout(() => {
            window.scrollTo({ top: targetY, behavior: 'instant' });
          }, 30);
        });
      }

      // 3. If navigating forward/back into a post
      if (postParam) {
        const currentPostStr = selectedPost ? `@${selectedPost.author}/${selectedPost.permlink}` : '';
        if (currentPostStr !== postParam) {
          const match = postParam.match(/^@?([^/]+)\/(.+)$/);
          if (match) {
            const [, author, permlink] = match;
            const found = posts.find((p) => p.author === author && p.permlink === permlink);
            if (found) {
              feedScrollPositionRef.current = event.state?.scrollY ?? window.scrollY;
              setSelectedPost(found);
              window.scrollTo({ top: 0, behavior: 'instant' });
            } else {
              getDiscussion(author, permlink).then((disc) => {
                const root = disc[`${author}/${permlink}`] || Object.values(disc)[0];
                if (root) {
                  feedScrollPositionRef.current = event.state?.scrollY ?? window.scrollY;
                  setSelectedPost(root);
                  window.scrollTo({ top: 0, behavior: 'instant' });
                }
              });
            }
          }
        }
        setTimeout(() => { isPopStateRef.current = false; }, 50);
        return;
      }

      // 4. Tab / Sort / Tag / Author navigation via browser Back/Forward
      const tabParam = params.get('tab');
      if (tabParam === 'feed' || tabParam === 'discover' || tabParam === 'shorts' || tabParam === 'communities') {
        setActiveNav(tabParam);
      } else if (tabParam === 'waves') {
        setActiveNav('shorts');
      } else if (tabParam === 'following') {
        setActiveNav('feed');
      } else {
        setActiveNav('discover');
      }

      const sortParam = params.get('sort');
      if (sortParam && ['trending', 'hot', 'created', 'payout', 'muted', 'promoted'].includes(sortParam)) {
        setSort(sortParam as any);
      } else {
        setSort('hot');
      }

      const tagParam = params.get('tag');
      setTag(tagParam || '');

      const authorParam = params.get('author');
      setFeedAuthor(authorParam || null);

      const langParam = params.get('lang');
      setSelectedLanguage(langParam || 'global');

      setTimeout(() => {
        isPopStateRef.current = false;
      }, 50);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedPost, posts, showStatsModal, showCommunitiesModal, showManageCommunitiesModal, selectedAuthorProfile, showContentFilterModal]);

  // Synchronize state changes to URL and browser history so the Back button remembers navigation history
  useEffect(() => {
    if (isPopStateRef.current) return;
    if (selectedPost) return; // Never sync feed URL while viewing a post

    const params = new URLSearchParams(window.location.search);
    params.delete('post'); // Guarantee no post query parameter in feed history state
    let changed = false;

    // tab
    if (activeNav !== 'discover') {
      if (params.get('tab') !== activeNav) {
        params.set('tab', activeNav);
        changed = true;
      }
    } else if (params.has('tab')) {
      params.delete('tab');
      changed = true;
    }

    // sort
    if (sort !== 'hot') {
      if (params.get('sort') !== sort) {
        params.set('sort', sort);
        changed = true;
      }
    } else if (params.has('sort')) {
      params.delete('sort');
      changed = true;
    }

    // tag
    if (tag) {
      if (params.get('tag') !== tag) {
        params.set('tag', tag);
        changed = true;
      }
    } else if (params.has('tag')) {
      params.delete('tag');
      changed = true;
    }

    // source
    if (sourceTab !== 'global') {
      if (params.get('source') !== sourceTab) {
        params.set('source', sourceTab);
        changed = true;
      }
    } else if (params.has('source')) {
      params.delete('source');
      changed = true;
    }

    // author
    if (feedAuthor) {
      if (params.get('author') !== feedAuthor) {
        params.set('author', feedAuthor);
        changed = true;
      }
    } else if (params.has('author')) {
      params.delete('author');
      changed = true;
    }

    // language
    if (activeNav === 'discover' && selectedLanguage !== 'global') {
      if (params.get('lang') !== selectedLanguage) {
        params.set('lang', selectedLanguage);
        changed = true;
      }
    } else if (params.has('lang')) {
      params.delete('lang');
      changed = true;
    }

    if (changed) {
      const query = params.toString();
      const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
      window.history.pushState(
        {
          tab: activeNav,
          sort,
          tag,
          source: sourceTab,
          author: feedAuthor,
          lang: selectedLanguage,
          scrollY: window.scrollY
        },
        '',
        newUrl
      );
    }
  }, [activeNav, sort, tag, sourceTab, feedAuthor, selectedLanguage]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f8fa] dark:bg-[#0b0f17] text-gray-900 dark:text-slate-100 font-sans transition-colors duration-200">

      {/* Top Navbar */}
      <Navbar
        currentSort={sort}
        onSortChange={(s) => setSort(s)}
        currentTag={tag}
        onTagChange={(t) => { setTag(t); setFeedAuthor(null); if (selectedPost) handleClosePost(); }}
        onOpenAccount={(user) => openAuthorProfile(user)}
        onOpenStats={openStatsModal}
        onOpenCommunities={openCommunitiesModal}
        onOpenManageCommunities={openManageCommunitiesModal}
        activeNav={activeNav}
        onNavChange={handleNavChange}
        currentUser={currentUser}
        onLogin={(user) => {
          setCurrentUser(user);
        }}
        onLogout={() => {
          KeychainService.logout();
          setCurrentUser(null);
          setActiveNav('discover');
          setSort('hot');
          setFeedAuthor(null);
          if (selectedPost) handleClosePost();
        }}
        isDark={theme === 'dark'}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">

        {/* ================= IN-PLACE POST READER (BOOKMARKS OUTLINE & SIMILAR STORIES SIDEBAR) ================= */}
        {selectedPost && (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start animate-in fade-in duration-150">
            <aside className="hidden lg:block sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
              <PostSidebar
                post={selectedPost}
                headings={postHeadings}
                onSelectHeading={handleSelectHeading}
                onSelectPost={handleSelectPost}
                onClose={handleClosePost}
              />
            </aside>

            <section className="min-w-0 flex-1">
              <PostReader
                post={selectedPost}
                onClose={handleClosePost}
                onSelectAuthor={handleSelectAuthor}
                onSelectTag={(t) => { setTag(t); handleClosePost(); }}
                currentUser={currentUser}
                onRequireLogin={() => {
                  alert('Please connect Hive Keychain in the top menu to perform this action.');
                }}
                onHeadingsExtracted={setPostHeadings}
                onSelectPost={(p) => handleSelectPost(p, true, false)}
              />
            </section>
          </div>
        )}

        {/* ================= FEED LAYOUT (KEPT IN DOM TO PRESERVE SCROLL POSITION) ================= */}
        <div
          className={`grid grid-cols-1 lg:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_300px] gap-6 items-start ${
            selectedPost ? 'hidden' : 'grid'
          }`}
        >

        {/* Left Sidebar */}
        <aside className="hidden lg:block">
          <LeftSidebar
            activeNav={activeNav}
            onNavChange={handleNavChange}
            currentSort={sort}
            onSortChange={(s) => setSort(s)}
            currentTag={tag}
            onSelectTag={(t) => { setTag(t); setFeedAuthor(null); }}
            onSelectAuthor={handleSelectAuthor}
            feedPosts={posts}
            currentUser={currentUser}
            onOpenManageCommunities={() => setShowManageCommunitiesModal(true)}
            joinedCommunities={joinedCommunities}
            shortsHashtags={shortsHashtags}
            selectedShortTag={selectedShortTag}
            onSelectShortTag={handleSelectShortTag}
          />
        </aside>

            {/* Center Feed Section */}
            <section className="min-w-0 flex-1">
              {activeNav === 'shorts' || (activeNav as string) === 'waves' ? (
                <ShortsFeed
                  currentUser={currentUser}
                  onSelectAuthor={handleSelectAuthor}
                  onRequireLogin={() => {
                    alert('Please log in using the Login button with Hive Keychain in the top navigation bar to vote or reply.');
                  }}
                  selectedTag={selectedShortTag}
                  onSelectTag={handleSelectShortTag}
                  blockedWords={blockedWords}
                  filterEnabled={filterEnabled}
                  onHashtagsExtracted={handleShortsHashtagsExtracted}
                  onHiddenCountChange={handleShortsHiddenCountChange}
                />
              ) : (
                <>
                  {/* Author Feed Filter Banner (When an author is clicked) */}
                  {feedAuthor && (
                <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none mb-4 flex items-center justify-between gap-3 animate-in fade-in text-gray-900 dark:text-slate-100">
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

                      {/* Author Feed Mode Switcher: Posts vs Comments */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => setAuthorFeedMode('posts')}
                          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${authorFeedMode === 'posts'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                            }`}
                        >
                          <FileText className="w-3 h-3" />
                          <span>Posts</span>
                        </button>

                        <button
                          onClick={() => setAuthorFeedMode('comments')}
                          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${authorFeedMode === 'comments'
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
                      onClick={() => setSelectedAuthorProfile(feedAuthor)}
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
              <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-3xl p-4 sm:px-6 sm:py-3.5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none mb-4 text-gray-900 dark:text-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Feed Title & Active Filters */}
                  <div className="flex items-center flex-wrap gap-2.5">
                    <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base capitalize">
                      {activeNav === 'feed' ? 'Your Feed' : activeNav === 'discover' ? 'Discover' : activeNav === 'communities' ? 'Communities' : 'Waves'}
                    </span>

                    {/* Sort Selector Dropdown for Discover and Communities */}
                    {(activeNav === 'discover' || activeNav === 'communities') && (
                      <SortDropdown
                        id="discover-header-sort-dropdown"
                        currentSort={sort}
                        onSortChange={(newSort) => setSort(newSort)}
                      />
                    )}

                    {/* Language Selector Dropdown (combflow.net Top 20 Languages) for Discover */}
                    {activeNav === 'discover' && (
                      <LanguageDropdown
                        id="discover-header-language-dropdown"
                        selectedLanguage={selectedLanguage}
                        onSelectLanguage={(langCode) => {
                          setSelectedLanguage(langCode);
                          setFeedAuthor(null);
                        }}
                      />
                    )}

                    {/* Category Dropdown (Browse Topics) for Discover */}
                    {activeNav === 'discover' && (
                      <CategoryDropdown
                        id="discover-header-category-dropdown"
                        currentCategory={activeCategory}
                        onSelectCategory={(categoryTag) => {
                          setTag(categoryTag);
                          setFeedAuthor(null);
                        }}
                      />
                    )}

                    {activeNav === 'feed' && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Feed Mode Selector Dropdown */}
                        <div className="relative inline-flex items-center">
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

                        {/* Reblogs Checkmark Toggle */}
                        {followingMode !== 'comments' && (
                          <label
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer select-none ${
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
                              className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 border-gray-300 dark:border-slate-600 cursor-pointer accent-purple-600"
                            />
                            <Repeat className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            <span>Reblogs</span>
                          </label>
                        )}
                      </div>
                    )}

                    {/* Tag filter chip (if any) */}
                    {tag && (
                      <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                        <span>{activeCategory?.icon ? `${activeCategory.icon} ` : ''}#{tag}</span>
                        <button
                          onClick={() => setTag('')}
                          className="hover:text-blue-900 dark:hover:text-blue-100 font-bold ml-1 cursor-pointer"
                          title="Clear topic filter"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right: Content Filter Button, Cache Status Badge & Refresh Action */}
                  <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0 flex-wrap">
                    {/* Content Filters (Words & Authors) Button */}
                    <button
                      onClick={openContentFilterModal}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer border ${
                        contentFilterConfig.enabled && (contentFilterConfig.words.length > 0 || contentFilterConfig.authors.length > 0)
                          ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
                          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                      title="Manage muted words and authors filter (saved in cache)"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Filters</span>
                      {(contentFilterConfig.words.length > 0 || contentFilterConfig.authors.length > 0) && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          contentFilterConfig.enabled ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                        }`}>
                          {contentFilterConfig.words.length + contentFilterConfig.authors.length}
                        </span>
                      )}
                    </button>

                    {/* Cache Status Badge: shows Live for 'New' tab, Cached for others */}
                    {sort === 'created' && activeNav !== 'feed' ? (
                      <span
                        className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 cursor-default"
                        title="Real-time newly created blockchain posts (cache bypassed)"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Live</span>
                      </span>
                    ) : (
                      <span
                        className="text-[11px] font-medium text-slate-500 bg-slate-100/90 px-2 py-0.5 rounded-full inline-flex items-center gap-1 cursor-default"
                        title="Fast instant navigation powered by client cache"
                      >
                        <Zap className="w-3 h-3 text-amber-500" />
                        <span>Cached</span>
                      </span>
                    )}

                    <button
                      onClick={() => fetchPosts(true)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition cursor-pointer"
                      title="Force refresh (bypasses cache)"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Subcategory Navigation Bar for Discover (when a category tag or subtopic is selected) */}
                {activeNav === 'discover' && activeCategory && (
                  <CategorySubtopicsBar
                    id="discover-category-subtopics-bar"
                    category={activeCategory}
                    currentTag={tag}
                    onSelectTag={(newSubTag) => {
                      setTag(newSubTag);
                      setFeedAuthor(null);
                    }}
                    onClearCategory={() => {
                      setTag('');
                      setFeedAuthor(null);
                    }}
                  />
                )}

                {/* Mobile Sort Navigation (Visible only on mobile screens where the left sidebar is hidden and only for Discover & Communities) */}
                {(activeNav === 'discover' || activeNav === 'communities') && (
                  <div className="flex lg:hidden items-center gap-2 pt-3 mt-3 border-t border-gray-100 overflow-x-auto no-scrollbar">
                    {(['hot', 'trending', 'created', 'payout', 'muted'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSort(s)}
                        title={`Sort by ${s === 'created' ? 'New' : s}`}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                          sort === s
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {s === 'created' ? 'New' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Error Banner */}
              {error && (
                <div className="mb-4 p-4 rounded-3xl bg-rose-50 text-xs text-rose-700 flex items-start justify-between">
                  <div>
                    <p className="font-semibold">Unable to fetch feed from Hive RPC</p>
                    <p className="text-gray-600 mt-0.5">{error}</p>
                  </div>
                  <button
                    onClick={() => setShowStatsModal(true)}
                    className="px-3 py-1 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 transition ml-3 flex-shrink-0"
                  >
                    Change Node
                  </button>
                </div>
              )}

              {/* Posts Stream */}
              {!loading && contentFilterConfig.enabled && filteredOutStats.total > 0 && (
                <div className="mb-4 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-50/80 to-indigo-50/60 border border-blue-150/70 text-xs text-blue-900 flex items-center justify-between gap-3 shadow-2xs animate-in fade-in">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldAlert className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="truncate">
                      <strong className="font-bold">{filteredOutStats.total}</strong> {filteredOutStats.total === 1 ? 'post' : 'posts'} hidden by your content filters
                      {filteredOutStats.byWord > 0 && filteredOutStats.byAuthor > 0 ? (
                        <span className="text-blue-700/80 ml-1 hidden sm:inline">
                          ({filteredOutStats.byWord} by word, {filteredOutStats.byAuthor} by author)
                        </span>
                      ) : null}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 text-xs font-semibold">
                    <button
                      onClick={openContentFilterModal}
                      className="text-blue-700 hover:text-blue-900 hover:underline transition cursor-pointer"
                    >
                      Manage Filters
                    </button>
                    <span className="text-blue-300">•</span>
                    <button
                      onClick={handleToggleContentFilterEnabled}
                      className="text-gray-500 hover:text-gray-800 transition cursor-pointer font-normal text-[11px]"
                      title="Temporarily pause filters to show all posts"
                    >
                      Pause Filter
                    </button>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] animate-pulse space-y-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200" />
                        <div className="space-y-1.5">
                          <div className="w-24 h-3 rounded bg-gray-200" />
                          <div className="w-16 h-2 rounded bg-gray-200" />
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-36 h-24 rounded-2xl bg-gray-200 flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="w-3/4 h-4 rounded bg-gray-200" />
                          <div className="w-full h-3 rounded bg-gray-200" />
                          <div className="w-2/3 h-3 rounded bg-gray-200" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : activeNav === 'feed' && !currentUser ? (
                /* GUEST USER IN FEED */
                <div className="p-12 text-center space-y-4 bg-white rounded-3xl shadow-[0_1px_6px_rgba(0,0,0,0.03)]">
                  <UserPlus className="w-12 h-12 text-gray-300 mx-auto" />
                  <div>
                    <h3 className="text-base font-bold text-gray-800">Connect your Hive account</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto leading-relaxed">
                      Log in with Hive Keychain above to see posts from the authors and curators you follow, or explore the global Discover feed.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveNav('discover')}
                    title="Switch to global Discover feed"
                    className="px-5 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold transition shadow-xs cursor-pointer"
                  >
                    Explore Discover Feed
                  </button>
                </div>
              ) : activeNav === 'feed' && posts.length === 0 ? (
                /* EMPTY FOLLOWING FEED */
                <div className="p-12 text-center space-y-4 bg-white rounded-3xl shadow-[0_1px_6px_rgba(0,0,0,0.03)]">
                  <UserPlus className="w-12 h-12 text-gray-300 mx-auto" />
                  <div>
                    <h3 className="text-base font-bold text-gray-800">
                      {followingMode === 'comments'
                        ? 'No recent comments found'
                        : followingMode === 'mixed'
                        ? 'No recent activity found'
                        : "You aren't following anyone yet or they haven't posted recently"}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto leading-relaxed">
                      {followingMode === 'comments'
                        ? 'None of the accounts you follow commented in the last 7 days, or your following list is empty.'
                        : followingMode === 'mixed'
                        ? 'No root stories or comments were detected from followed accounts in the last 7 days.'
                        : 'Follow creators across Hive to see their latest stories here, or explore Discover.'}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveNav('discover')}
                    title="Switch to global Discover feed"
                    className="px-5 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold transition shadow-xs cursor-pointer"
                  >
                    Explore Discover Feed
                  </button>
                </div>
              ) : activeNav === 'communities' && posts.length === 0 ? (
                /* EMPTY COMMUNITIES FEED */
                <div className="p-12 text-center space-y-4 bg-white rounded-3xl shadow-[0_1px_6px_rgba(0,0,0,0.03)]">
                  <Layers className="w-12 h-12 text-gray-300 mx-auto" />
                  <div>
                    <h3 className="text-base font-bold text-gray-800">You haven't joined any community yet</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto leading-relaxed">
                      Join communities to follow specialized topics, discussions, and local groups.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowManageCommunitiesModal(true)}
                    title="Open community manager to discover and join communities"
                    className="px-5 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold transition shadow-xs cursor-pointer"
                  >
                    Explore Communities
                  </button>
                </div>
              ) : posts.length > 0 ? (
                displayedPosts.length > 0 ? (
                  <div className="space-y-4">
                    {displayedPosts.map((post, index) => (
                      <PostCard
                        key={`${post.first_reblogged_by ? post.first_reblogged_by + ':' : ''}${post.author}/${post.permlink}-${post.post_id || index}`}
                        post={post}
                        onSelectPost={(p, jump) => handleSelectPost(p, true, jump)}
                        onSelectAuthor={handleSelectAuthor}
                        onSelectTag={(t) => { setTag(t); setFeedAuthor(null); }}
                        currentUser={currentUser}
                        onRequireLogin={() => {
                          alert('Please connect Hive Keychain in the top menu to vote, comment, or reblog.');
                        }}
                        onMuteAuthor={handleAddFilterAuthor}
                        onBlockWord={handleAddFilterWord}
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
                  /* CONTENT FILTERS EMPTY STATE */
                  <div className="p-12 text-center space-y-4 bg-white dark:bg-slate-900 rounded-3xl shadow-[0_1px_6px_rgba(0,0,0,0.03)] border border-gray-150 dark:border-slate-800 text-gray-900 dark:text-slate-100">
                    <EyeOff className="w-12 h-12 text-blue-400 mx-auto" />
                    <div>
                      <h3 className="text-base font-bold text-gray-800 dark:text-white">All loaded posts are hidden by your filters</h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                        {filteredOutStats.total} {filteredOutStats.total === 1 ? 'post' : 'posts'} matched your muted words or authors. You can adjust your filters or temporarily pause them.
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
                        onClick={handleToggleContentFilterEnabled}
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
                  /* ALL REBLOGS EMPTY STATE */
                  <div className="p-12 text-center space-y-4 bg-white dark:bg-slate-900 rounded-3xl shadow-[0_1px_6px_rgba(0,0,0,0.03)] border border-gray-150 dark:border-slate-800 text-gray-900 dark:text-slate-100">
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
                )
              ) : (
                <div className="p-16 text-center space-y-3 bg-white dark:bg-slate-900 rounded-3xl shadow-[0_1px_6px_rgba(0,0,0,0.03)] border border-gray-150 dark:border-slate-800 text-gray-900 dark:text-slate-100">
                  <Compass className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto" />
                  <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">
                    {selectedLanguage !== 'global' && activeNav === 'discover'
                      ? `No recent posts found for this language filter.`
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
                    {selectedLanguage !== 'global' && activeNav === 'discover' ? 'Reset to Global Feed' : 'Explore Discover Feed'}
                  </button>
                </div>
              )}
                </>
              )}

            </section>

            {/* Right Column */}
            <aside className="hidden xl:block space-y-6">
              {activeNav === 'shorts' ? (
                <>
                  <ShortsWordFilterCard
                    blockedWords={blockedWords}
                    onAddWord={handleAddBlockedWord}
                    onRemoveWord={handleRemoveBlockedWord}
                    onClearAll={handleClearAllBlockedWords}
                    filterEnabled={filterEnabled}
                    onToggleFilter={handleToggleFilterEnabled}
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
              ) : activeNav === 'communities' ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/60 dark:border-slate-800 text-gray-900 dark:text-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white">Discover communities</h3>
                    <button
                      onClick={() => setShowManageCommunitiesModal(true)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                    >
                      Manage
                    </button>
                  </div>

                  <div className="space-y-4">
                    {DEFAULT_TOP_COMMUNITIES.map((comm) => {
                      const isJoined = !!joinedCommunities[comm.name];
                      return (
                        <div key={comm.name} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={() => {
                                setTag(comm.name);
                                setActiveNav('communities');
                                setFeedAuthor(null);
                              }}
                              className="flex items-center gap-2.5 text-left focus:outline-none min-w-0 cursor-pointer"
                            >
                              <img
                                src={comm.avatar}
                                alt={comm.title}
                                className="w-7 h-7 rounded-full object-cover bg-gray-100 dark:bg-slate-800 flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive-125125/avatar/small';
                                }}
                              />
                              <span className="font-bold text-xs sm:text-sm text-gray-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 truncate">
                                {comm.title}
                              </span>
                            </button>

                            <button
                              onClick={() => toggleJoinCommunity(comm.name)}
                              className={`text-xs px-3 py-1 rounded-full font-semibold transition flex-shrink-0 cursor-pointer ${
                                isJoined
                                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400'
                              }`}
                            >
                              {isJoined ? 'Joined' : 'Join'}
                            </button>
                          </div>

                          <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {comm.about}
                          </p>

                          <p className="text-[11px] text-gray-400 dark:text-slate-500">
                            {comm.subscribers.toLocaleString()} members
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setShowManageCommunitiesModal(true)}
                    className="text-xs font-semibold text-blue-600 hover:underline mt-4 block cursor-pointer"
                  >
                    Manage all communities
                  </button>

                  <hr className="border-gray-100 my-3" />

                  <button
                    onClick={() => setShowCommunitiesModal(true)}
                    className="text-xs font-semibold text-blue-600 hover:underline block cursor-pointer"
                  >
                    Create your community
                  </button>
                </div>
              ) : activeNav === 'discover' ? (
                <TrendingTopicsCard
                  currentTag={tag}
                  onSelectTag={(newTag) => {
                    setTag(newTag);
                    setFeedAuthor(null);
                  }}
                  feedPosts={posts}
                />
              ) : (
                /* Feed and other views: Show Recommended Users */
                <RecommendedUsersCard
                  currentUser={currentUser}
                  feedPosts={posts}
                  onSelectAuthor={handleSelectAuthor}
                  followingUsers={followingUsersList}
                  onFollowChange={(targetUser, isNowFollowing) => {
                    setFollowingUsersList(prev => {
                      const targetLower = targetUser.toLowerCase();
                      if (isNowFollowing) {
                        return prev.some(u => u.toLowerCase() === targetLower) ? prev : [...prev, targetUser];
                      } else {
                        return prev.filter(u => u.toLowerCase() !== targetLower);
                      }
                    });
                  }}
                />
              )}
            </aside>

          </div>

      </main>

      {/* Account Profile Modal */}
      {selectedAuthorProfile && (
        <AccountModal
          username={selectedAuthorProfile}
          onClose={() => {
            if (window.history.state?.type === 'modal') {
              window.history.back();
            } else {
              setSelectedAuthorProfile(null);
            }
          }}
          onSelectPost={(p) => handleSelectPost(p)}
          onSelectAuthor={handleSelectAuthor}
        />
      )}

      {/* Blockchain Stats Modal */}
      {showStatsModal && (
        <BlockchainStatsModal
          onClose={() => {
            if (window.history.state?.type === 'modal') {
              window.history.back();
            } else {
              setShowStatsModal(false);
            }
          }}
        />
      )}

      {/* Communities Directory Modal */}
      {showCommunitiesModal && (
        <CommunitiesModal
          onClose={() => {
            if (window.history.state?.type === 'modal') {
              window.history.back();
            } else {
              setShowCommunitiesModal(false);
            }
          }}
          onSelectCommunity={(comm) => {
            setTag(comm);
            setActiveNav('communities');
            if (window.history.state?.type === 'modal') {
              window.history.back();
            } else {
              setShowCommunitiesModal(false);
            }
          }}
          activeCommunity={tag}
        />
      )}

      {/* Manage Communities Dedicated Modal */}
      {showManageCommunitiesModal && (
        <ManageCommunitiesModal
          onClose={() => {
            if (window.history.state?.type === 'modal') {
              window.history.back();
            } else {
              setShowManageCommunitiesModal(false);
            }
          }}
          onSelectCommunity={(comm) => {
            setTag(comm);
            setActiveNav('communities');
            if (window.history.state?.type === 'modal') {
              window.history.back();
            } else {
              setShowManageCommunitiesModal(false);
            }
          }}
          joinedCommunities={joinedCommunities}
          onToggleJoinCommunity={toggleJoinCommunity}
        />
      )}

      {/* Content & Mute Filters Modal (Saved in local cache) */}
      <ContentFilterModal
        isOpen={showContentFilterModal}
        onClose={() => {
          if (window.history.state?.type === 'modal') {
            window.history.back();
          } else {
            setShowContentFilterModal(false);
          }
        }}
        words={contentFilterConfig.words}
        authors={contentFilterConfig.authors}
        enabled={contentFilterConfig.enabled}
        onAddWord={handleAddFilterWord}
        onRemoveWord={handleRemoveFilterWord}
        onClearWords={handleClearFilterWords}
        onAddAuthor={handleAddFilterAuthor}
        onRemoveAuthor={handleRemoveFilterAuthor}
        onClearAuthors={handleClearFilterAuthors}
        onToggleEnabled={handleToggleContentFilterEnabled}
        currentHiddenCount={filteredOutStats.total}
      />

      {/* Clean borderless Nebulosa Footer */}
      <footer className="py-6 text-center text-xs text-gray-400 dark:text-slate-500 bg-white dark:bg-slate-900 border-t border-gray-150 dark:border-slate-800 mt-12 shadow-[0_-1px_4px_rgba(0,0,0,0.02)] transition-colors">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/assets/logo-circle.svg" alt="Nebulosa" className="w-5 h-5" />
            <span className="font-semibold text-gray-700 dark:text-slate-200">Nebulosa Vision</span>
            <span>• Direct Hive Blockchain Client with Keychain Support</span>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500">
            Zero Server Backend • No Secrets • 100% Client-Side JSON-RPC & DOMPurify XSS Protection
          </p>
        </div>
      </footer>

    </div>
  );
}

export default App;
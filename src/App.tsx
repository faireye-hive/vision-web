import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Zap
} from 'lucide-react';
import {
  HivePost,
  getRankedPosts,
  getCachedRankedPosts,
  getAccountPosts,
  getHiveAvatarUrl,
  getDiscussion,
  apiCache
} from './services/hiveApi';
import { KeychainService, CurrentUser } from './services/keychain';
import { Navbar } from './components/Navbar';
import { LeftSidebar } from './components/LeftSidebar';
import { PostCard } from './components/PostCard';
import { PostReader } from './components/PostReader';
import { AccountModal } from './components/AccountModal';
import { BlockchainStatsModal } from './components/BlockchainStatsModal';
import { CommunitiesModal } from './components/CommunitiesModal';
import { ManageCommunitiesModal } from './components/ManageCommunitiesModal';
import { SortDropdown } from './components/SortDropdown';
import { TrendingTopicsCard } from './components/TrendingTopicsCard';

function getInitialUrlParams() {
  if (typeof window === 'undefined') return {};
  try {
    const params = new URLSearchParams(window.location.search);
    let tab = params.get('tab') as 'feed' | 'discover' | 'waves' | 'communities' | null;
    if ((tab as string) === 'following') tab = 'feed';
    if ((tab as string) === 'decks' || (tab as string) === 'explorer') tab = 'discover';

    return {
      tab,
      sort: params.get('sort') as 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted' | null,
      tag: params.get('tag') || '',
      source: params.get('source') as 'following' | 'communities' | 'global' | null,
      post: params.get('post') || null,
      author: params.get('author') || null
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
  const [activeNav, setActiveNav] = useState<'feed' | 'discover' | 'waves' | 'communities'>(() => {
    if (initialParams.tab && ['feed', 'discover', 'waves', 'communities'].includes(initialParams.tab)) {
      return initialParams.tab;
    }
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
  const [selectedAuthorProfile, setSelectedAuthorProfile] = useState<string | null>(null);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showCommunitiesModal, setShowCommunitiesModal] = useState<boolean>(false);
  const [showManageCommunitiesModal, setShowManageCommunitiesModal] = useState<boolean>(false);

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

  // Fetch posts based on feedAuthor OR active sourceTab, sort, tag
  const fetchPosts = useCallback(async (isRefresh = false) => {
    // Check if we already have cached posts to render immediately without blank screen
    let hasCached = false;
    if (!isRefresh && !feedAuthor && sort !== 'created') {
      let queryTag = tag;
      const observer = currentUser?.username || '';
      if (sourceTab === 'communities' && !queryTag) {
        queryTag = 'my';
      }
      const cached = getCachedRankedPosts(sort, queryTag, 20, undefined, undefined, observer);
      if (cached && cached.length > 0) {
        setPosts(cached);
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
            fetched = await getAccountPosts('feed' as any, currentUser.username, 20, isRefresh);
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
      } else if (activeNav === 'waves') {
        fetched = await getRankedPosts(sort, 'waves', 20, undefined, undefined, '', isRefresh);
      } else {
        // 'discover' (Global)
        fetched = await getRankedPosts(sort, tag, 20, undefined, undefined, '', isRefresh);
      }

      setPosts(fetched || []);
    } catch (err: any) {
      console.error('Hive RPC Fetch Error:', err);
      setError(
        err.message || 'Unable to connect to Hive RPC node. Please check your network or switch nodes.'
      );
    } finally {
      setLoading(false);
    }
  }, [sort, tag, activeNav, currentUser, joinedCommunities, feedAuthor, authorFeedMode]);

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
          const more = await getAccountPosts('feed' as any, currentUser.username, 20);
          setPosts(prev => [...prev, ...more.slice(prev.length)]);
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
        const uniqueMore = more.slice(1);
        setPosts((prev) => [...prev, ...uniqueMore]);
      } else if (activeNav === 'waves') {
        const more = await getRankedPosts(
          sort,
          'waves',
          20,
          lastPost.author,
          lastPost.permlink
        );
        const uniqueMore = more.slice(1);
        setPosts((prev) => [...prev, ...uniqueMore]);
      } else {
        // discover (Global)
        const more = await getRankedPosts(
          sort,
          tag,
          20,
          lastPost.author,
          lastPost.permlink
        );
        const uniqueMore = more.slice(1);
        setPosts((prev) => [...prev, ...uniqueMore]);
      }
    } catch (err: any) {
      console.error('Failed to load more posts:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Open post and push to browser history, while saving feed scroll position
  const handleSelectPost = useCallback((post: HivePost, pushHistory = true) => {
    feedScrollPositionRef.current = window.scrollY;
    setSelectedPost(post);
    window.scrollTo({ top: 0, behavior: 'instant' });

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
  }, []);

  // Close post and restore the exact feed scroll position
  const handleClosePost = useCallback((popHistory = true) => {
    setSelectedPost(null);

    const targetY = feedScrollPositionRef.current;
    requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, behavior: 'instant' });
      setTimeout(() => {
        window.scrollTo({ top: targetY, behavior: 'instant' });
      }, 30);
    });

    if (popHistory) {
      if (window.history.state?.type === 'post') {
        window.history.back();
      } else {
        const params = new URLSearchParams(window.location.search);
        if (params.has('post')) {
          params.delete('post');
          const query = params.toString();
          const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
          window.history.pushState({ type: 'feed', scrollY: targetY }, '', newUrl);
        }
      }
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
      handleClosePost(false);
    }
  };

  // Clicking an author filters their posts directly in the feed!
  const handleSelectAuthor = useCallback((author: string) => {
    setFeedAuthor(author);
    setAuthorFeedMode('posts');
    if (selectedPost) {
      handleClosePost(false);
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
      if (showStatsModal || showCommunitiesModal || showManageCommunitiesModal || selectedAuthorProfile) {
        setShowStatsModal(false);
        setShowCommunitiesModal(false);
        setShowManageCommunitiesModal(false);
        setSelectedAuthorProfile(null);
        setTimeout(() => { isPopStateRef.current = false; }, 50);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const postParam = params.get('post');

      // 2. If a post was open and now there's no post in URL -> user hit back to return to feed
      if (selectedPost && !postParam) {
        setSelectedPost(null);
        const targetY = event.state?.scrollY ?? feedScrollPositionRef.current;
        requestAnimationFrame(() => {
          window.scrollTo({ top: targetY, behavior: 'instant' });
          setTimeout(() => {
            window.scrollTo({ top: targetY, behavior: 'instant' });
          }, 30);
        });
        setTimeout(() => { isPopStateRef.current = false; }, 50);
        return;
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
      if (tabParam === 'feed' || tabParam === 'discover' || tabParam === 'waves' || tabParam === 'communities') {
        setActiveNav(tabParam);
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

      setTimeout(() => {
        isPopStateRef.current = false;
      }, 50);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedPost, posts, showStatsModal, showCommunitiesModal, showManageCommunitiesModal, selectedAuthorProfile]);

  // Synchronize state changes to URL and browser history so the Back button remembers navigation history
  useEffect(() => {
    if (isPopStateRef.current) return;

    const params = new URLSearchParams(window.location.search);
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
          scrollY: window.scrollY
        },
        '',
        newUrl
      );
    }
  }, [activeNav, sort, tag, sourceTab, feedAuthor]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f8fa] text-gray-900 font-sans">

      {/* Top Navbar */}
      <Navbar
        currentSort={sort}
        onSortChange={(s) => setSort(s)}
        currentTag={tag}
        onTagChange={(t) => { setTag(t); setFeedAuthor(null); if (selectedPost) handleClosePost(false); }}
        onOpenAccount={(user) => openAuthorProfile(user)}
        onOpenStats={openStatsModal}
        onOpenCommunities={openCommunitiesModal}
        onOpenManageCommunities={openManageCommunitiesModal}
        activeNav={activeNav}
        onNavChange={(nav) => {
          setActiveNav(nav);
          if (selectedPost) handleClosePost(false);
        }}
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
        }}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">

        {/* ================= IN-PLACE POST READER (NAVBAR & SIDEBAR INTACT) ================= */}
        {selectedPost && (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start animate-in fade-in duration-150">
            <aside className="hidden lg:block">
              <LeftSidebar
                activeNav={activeNav}
                onNavChange={(n) => { setActiveNav(n); handleClosePost(false); }}
                currentSort={sort}
                onSortChange={(s) => { setSort(s); handleClosePost(false); }}
                currentTag={tag}
                onSelectTag={(t) => { setTag(t); handleClosePost(false); }}
                onSelectAuthor={(a) => { handleSelectAuthor(a); handleClosePost(false); }}
                feedPosts={posts}
                currentUser={currentUser}
                onOpenManageCommunities={openManageCommunitiesModal}
                joinedCommunities={joinedCommunities}
              />
            </aside>

            <section className="min-w-0 flex-1">
              <PostReader
                post={selectedPost}
                onClose={() => handleClosePost()}
                onSelectAuthor={handleSelectAuthor}
                onSelectTag={(t) => { setTag(t); handleClosePost(); }}
                currentUser={currentUser}
                onRequireLogin={() => {
                  alert('Please connect Hive Keychain in the top menu to perform this action.');
                }}
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
            onNavChange={(n) => { setActiveNav(n); setFeedAuthor(null); setTag(''); }}
            currentSort={sort}
            onSortChange={(s) => setSort(s)}
            currentTag={tag}
            onSelectTag={(t) => { setTag(t); setFeedAuthor(null); }}
            onSelectAuthor={handleSelectAuthor}
            feedPosts={posts}
            currentUser={currentUser}
            onOpenManageCommunities={() => setShowManageCommunitiesModal(true)}
            joinedCommunities={joinedCommunities}
          />
        </aside>

            {/* Center Feed Section */}
            <section className="min-w-0 flex-1">

              {/* Author Feed Filter Banner (When an author is clicked) */}
              {feedAuthor && (
                <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] mb-4 flex items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={getHiveAvatarUrl(feedAuthor, 'medium')}
                      alt={feedAuthor}
                      className="w-11 h-11 rounded-full object-cover shadow-xs"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/medium';
                      }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm sm:text-base">@{feedAuthor}</span>
                        <span className="text-xs text-gray-400">on feed</span>
                      </div>

                      {/* Author Feed Mode Switcher: Posts vs Comments */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => setAuthorFeedMode('posts')}
                          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition ${authorFeedMode === 'posts'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                          <FileText className="w-3 h-3" />
                          <span>Posts</span>
                        </button>

                        <button
                          onClick={() => setAuthorFeedMode('comments')}
                          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition ${authorFeedMode === 'comments'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                      className="text-xs text-blue-600 hover:underline hidden sm:inline"
                    >
                      Wallet & Profile
                    </button>
                    <button
                      onClick={() => setFeedAuthor(null)}
                      className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
                      title="Clear author filter"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Feed Controls Header */}
              <div className="bg-white rounded-3xl p-4 sm:px-6 sm:py-3.5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Feed Title & Active Filters */}
                  <div className="flex items-center flex-wrap gap-2.5">
                    <span className="font-bold text-gray-900 text-sm sm:text-base capitalize">
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

                    {activeNav === 'feed' && (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hidden sm:inline-block cursor-default"
                        title="Displaying chronologically ordered stories from your followed accounts"
                      >
                        Following
                      </span>
                    )}

                    {/* Tag filter chip (if any) */}
                    {tag && (
                      <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                        <span>#{tag}</span>
                        <button
                          onClick={() => setTag('')}
                          className="hover:text-blue-900 font-bold ml-1 cursor-pointer"
                          title="Clear topic filter"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right: Cache Status Badge & Refresh Action */}
                  <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
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
                    <h3 className="text-base font-bold text-gray-800">You aren't following anyone yet</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto leading-relaxed">
                      Follow creators across Hive to see their latest stories here, or explore Discover.
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
                <div className="space-y-4">
                  {posts.map((post) => (
                    <PostCard
                      key={post.post_id || `${post.author}/${post.permlink}`}
                      post={post}
                      onSelectPost={(p) => handleSelectPost(p)}
                      onSelectAuthor={handleSelectAuthor}
                      onSelectTag={(t) => { setTag(t); setFeedAuthor(null); }}
                    />
                  ))}

                  {/* Load More Button */}
                  <div className="text-center pt-2 pb-8">
                    <button
                      id="load-more-posts-btn"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      title="Fetch older posts from the blockchain"
                      className="px-6 py-2.5 rounded-full bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold shadow-xs hover:shadow-sm disabled:opacity-50 transition cursor-pointer"
                    >
                      {loadingMore ? (
                        <span className="flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          Loading more stories...
                        </span>
                      ) : (
                        'Load More'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-16 text-center space-y-3 bg-white rounded-3xl shadow-[0_1px_6px_rgba(0,0,0,0.03)]">
                  <Compass className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-sm text-gray-500 font-medium">
                    No posts found in this feed.
                  </p>
                  <button
                    onClick={() => {
                      setTag('');
                      setFeedAuthor(null);
                      setActiveNav('discover');
                    }}
                    className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold transition shadow-xs"
                  >
                    Explore Discover Feed
                  </button>
                </div>
              )}

            </section>

            {/* Right Column */}
            <aside className="hidden xl:block space-y-6">
              {activeNav === 'discover' ? (
                <TrendingTopicsCard
                  currentTag={tag}
                  onSelectTag={(newTag) => {
                    setTag(newTag);
                    setFeedAuthor(null);
                  }}
                  feedPosts={posts}
                />
              ) : (
                <div className="bg-white rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)]">

                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm text-gray-900">Discover communities</h3>
                  <button
                    onClick={() => setShowManageCommunitiesModal(true)}
                    className="text-xs text-blue-600 hover:underline font-semibold"
                  >
                    Manage
                  </button>
                </div>

                <div className="space-y-5">
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
                            className="flex items-center gap-2.5 text-left focus:outline-none min-w-0"
                          >
                            <img
                              src={comm.avatar}
                              alt={comm.title}
                              className="w-7 h-7 rounded-full object-cover bg-gray-100 flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive-125125/avatar/small';
                              }}
                            />
                            <span className="font-bold text-xs sm:text-sm text-gray-900 hover:text-blue-600 truncate">
                              {comm.title}
                            </span>
                          </button>

                          <button
                            onClick={() => toggleJoinCommunity(comm.name)}
                            className={`text-xs px-3 py-0.5 rounded-full font-semibold transition flex-shrink-0 ${isJoined
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                              }`}
                          >
                            {isJoined ? 'Joined' : 'Join'}
                          </button>
                        </div>

                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                          {comm.about}
                        </p>

                        <p className="text-[11px] text-gray-400">
                          {comm.subscribers.toLocaleString()} members
                        </p>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => setShowManageCommunitiesModal(true)}
                  className="text-xs font-semibold text-blue-600 hover:underline mt-5 block"
                >
                  Manage all communities
                </button>

                <hr className="border-gray-50 my-4" />

                <button
                  onClick={() => setShowCommunitiesModal(true)}
                  className="text-xs font-semibold text-blue-600 hover:underline block"
                >
                  Create your community
                </button>

              </div>
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

      {/* Clean borderless Nebulosa Footer */}
      <footer className="py-6 text-center text-xs text-gray-400 bg-white mt-12 shadow-[0_-1px_4px_rgba(0,0,0,0.02)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/assets/logo-circle.svg" alt="Nebulosa" className="w-5 h-5" />
            <span className="font-semibold text-gray-700">Nebulosa Vision</span>
            <span>• Direct Hive Blockchain Client with Keychain Support</span>
          </div>
          <p className="text-[11px] text-gray-400">
            Zero Server Backend • No Secrets • 100% Client-Side JSON-RPC & DOMPurify XSS Protection
          </p>
        </div>
      </footer>

    </div>
  );
}

export default App;
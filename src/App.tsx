import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Compass,
  X,
  Layers,
  Users,
  Hash,
  UserPlus,
  MessageSquare,
  FileText
} from 'lucide-react';
import {
  HivePost,
  getRankedPosts,
  getAccountPosts,
  getHiveAvatarUrl
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
import { ExplorerView } from './components/ExplorerView';

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
  // Hive Keychain Current User state
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    return KeychainService.getCurrentUser();
  });

  // Source tab: when logged out, default strictly to 'global'
  const [sourceTab, setSourceTab] = useState<'following' | 'communities' | 'global'>(() => {
    return KeychainService.getCurrentUser() ? 'global' : 'global';
  });

  // Sort order: default strictly to 'hot'
  const [sort, setSort] = useState<'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted'>('hot');
  const [tag, setTag] = useState<string>('');
  const [activeNav, setActiveNav] = useState<'discover' | 'waves' | 'decks' | 'explorer'>('discover');

  // Author feed filter (showing user posts or comments directly in the feed)
  const [feedAuthor, setFeedAuthor] = useState<string | null>(null);
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
    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      let fetched: HivePost[] = [];

      // If user filtered by a specific author to see their posts or comments in the feed
      if (feedAuthor) {
        fetched = await getAccountPosts(authorFeedMode, feedAuthor, 20);
      } else if (sourceTab === 'following' && currentUser) {
        try {
          fetched = await getAccountPosts('feed' as any, currentUser.username, 20);
        } catch {
          fetched = [];
        }
      } else if (sourceTab === 'communities') {

        const observer = currentUser?.username || '';
        let queryTag = tag;
        if (!queryTag) {
          queryTag = 'my';
        }

        fetched = await getRankedPosts(sort, queryTag, 20, undefined, undefined, observer);
      } else {
        fetched = await getRankedPosts(sort, tag, 20);
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
  }, [sort, tag, sourceTab, currentUser, joinedCommunities, feedAuthor, authorFeedMode]);

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
      } else {
        let queryTag = tag;
        const observer = currentUser?.username || '';

        if (sourceTab === 'communities' && !tag) {
          queryTag = observer ? 'my' : 'hive-125125';
        }

        // Repasse o 'observer' como 6º parâmetro no getRankedPosts
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
      }
    } catch (err: any) {
      console.error('Failed to load more posts:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSourceTabChange = (newTab: 'following' | 'communities' | 'global') => {
    setSourceTab(newTab);
    setFeedAuthor(null);
    setTag('');
    if (activeNav === 'explorer') {
      setActiveNav('discover');
    }
  };

  // Clicking an author filters their posts directly in the feed!
  const handleSelectAuthor = (author: string) => {
    setFeedAuthor(author);
    setAuthorFeedMode('posts');
    setSelectedPost(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f8fa] text-gray-900 font-sans">

      {/* Top Navbar */}
      <Navbar
        currentSort={sort}
        onSortChange={(s) => setSort(s)}
        currentTag={tag}
        onTagChange={(t) => { setTag(t); setFeedAuthor(null); setSelectedPost(null); }}
        onOpenAccount={(user) => setSelectedAuthorProfile(user)}
        onOpenStats={() => setShowStatsModal(true)}
        onOpenCommunities={() => setShowCommunitiesModal(true)}
        onOpenManageCommunities={() => setShowManageCommunitiesModal(true)}
        activeNav={activeNav}
        onNavChange={(nav) => {
          setActiveNav(nav);
          setSelectedPost(null);
        }}
        currentUser={currentUser}
        onLogin={(user) => {
          setCurrentUser(user);
        }}
        onLogout={() => {
          KeychainService.logout();
          setCurrentUser(null);
          setSourceTab('global');
          setSort('hot');
          setFeedAuthor(null);
        }}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">

        {/* If Explorer tab is selected */}
        {activeNav === 'explorer' ? (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
            <aside className="hidden lg:block">
              <LeftSidebar
                sourceTab={sourceTab}
                onSourceTabChange={handleSourceTabChange}
                currentTag={tag}
                onSelectTag={(t) => { setTag(t); setActiveNav('discover'); }}
                onSelectAuthor={handleSelectAuthor}
                feedPosts={posts}
                currentUser={currentUser}
                onOpenManageCommunities={() => setShowManageCommunitiesModal(true)}
                joinedCommunities={joinedCommunities}
              />
            </aside>
            <section className="min-w-0 flex-1">
              <ExplorerView
                onBackToFeed={() => setActiveNav('discover')}
                onSelectTag={(t) => { setTag(t); setActiveNav('discover'); }}
                onSelectAuthor={handleSelectAuthor}
                onSelectCommunity={(c) => { setTag(c); setSourceTab('communities'); setActiveNav('discover'); }}
              />
            </section>
          </div>
        ) : selectedPost ? (
          /* ================= IN-PLACE POST READER (NAVBAR & SIDEBAR INTACT) ================= */
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start animate-in fade-in duration-150">

            <aside className="hidden lg:block">
              <LeftSidebar
                sourceTab={sourceTab}
                onSourceTabChange={handleSourceTabChange}
                currentTag={tag}
                onSelectTag={(t) => { setTag(t); setSelectedPost(null); }}
                onSelectAuthor={handleSelectAuthor}
                feedPosts={posts}
                currentUser={currentUser}
                onOpenManageCommunities={() => setShowManageCommunitiesModal(true)}
                joinedCommunities={joinedCommunities}
              />
            </aside>

            <section className="min-w-0 flex-1">
              <PostReader
                post={selectedPost}
                onClose={() => setSelectedPost(null)}
                onSelectAuthor={handleSelectAuthor}
                onSelectTag={(t) => { setTag(t); setSelectedPost(null); }}
                currentUser={currentUser}
                onRequireLogin={() => {
                  alert('Please connect Hive Keychain in the top menu to perform this action.');
                }}
              />
            </section>
          </div>
        ) : (
          /* ================= FEED LAYOUT ================= */
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_300px] gap-6 items-start">

            {/* Left Sidebar */}
            <aside className="hidden lg:block">
              <LeftSidebar
                sourceTab={sourceTab}
                onSourceTabChange={handleSourceTabChange}
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

                {/* Source Tabs: When logged out, ONLY Global appears! When logged in, Following & Communities appear */}
                <div className="flex items-center gap-6 border-b border-gray-50 pb-2.5">

                  {currentUser && (
                    <>
                      <button
                        id="tab-following-btn"
                        onClick={() => handleSourceTabChange('following')}
                        className={`text-sm font-semibold transition pb-1 relative flex items-center gap-1.5 ${sourceTab === 'following' && !feedAuthor
                          ? 'text-blue-600 font-bold'
                          : 'text-gray-500 hover:text-gray-900'
                          }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Following</span>
                        {sourceTab === 'following' && !feedAuthor && (
                          <span className="absolute bottom-[-11px] left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                        )}
                      </button>

                      <button
                        id="tab-communities-btn"
                        onClick={() => handleSourceTabChange('communities')}
                        className={`text-sm font-semibold transition pb-1 relative flex items-center gap-1.5 ${sourceTab === 'communities' && !feedAuthor
                          ? 'text-blue-600 font-bold'
                          : 'text-gray-500 hover:text-gray-900'
                          }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Communities</span>
                        {sourceTab === 'communities' && !feedAuthor && (
                          <span className="absolute bottom-[-11px] left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                        )}
                      </button>
                    </>
                  )}

                  {/* Global Tab (Always available, sole tab when logged out) */}
                  <button
                    id="tab-global-btn"
                    onClick={() => handleSourceTabChange('global')}
                    className={`text-sm font-semibold transition pb-1 relative flex items-center gap-1.5 ${sourceTab === 'global' && !feedAuthor
                      ? 'text-blue-600 font-bold'
                      : 'text-gray-500 hover:text-gray-900'
                      }`}
                  >
                    <Hash className="w-3.5 h-3.5" />
                    <span>Global</span>
                    {sourceTab === 'global' && !feedAuthor && (
                      <span className="absolute bottom-[-11px] left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                    )}
                  </button>

                  {!currentUser && (
                    <span className="text-[11px] text-gray-400 ml-auto">
                      Connect Keychain to unlock Following feed & communities
                    </span>
                  )}
                </div>

                {/* Sort Filters: ONLY shown in Communities & Global */}
                {sourceTab !== 'following' && !feedAuthor && (
                  <div className="flex items-center justify-between pt-3 overflow-x-auto gap-4">
                    <div className="flex items-center gap-5 sm:gap-6 text-xs sm:text-sm font-medium">

                      <button
                        onClick={() => setSort('trending')}
                        className={`transition pb-0.5 whitespace-nowrap ${sort === 'trending'
                          ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                          : 'text-gray-500 hover:text-gray-900'
                          }`}
                      >
                        Trending
                      </button>

                      <button
                        onClick={() => setSort('hot')}
                        className={`transition pb-0.5 whitespace-nowrap ${sort === 'hot'
                          ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                          : 'text-gray-500 hover:text-gray-900'
                          }`}
                      >
                        Hot
                      </button>

                      <button
                        onClick={() => setSort('created')}
                        className={`transition pb-0.5 whitespace-nowrap ${sort === 'created'
                          ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                          : 'text-gray-500 hover:text-gray-900'
                          }`}
                      >
                        New
                      </button>

                      <button
                        onClick={() => setSort('payout')}
                        className={`transition pb-0.5 whitespace-nowrap ${sort === 'payout'
                          ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                          : 'text-gray-500 hover:text-gray-900'
                          }`}
                      >
                        Payout
                      </button>

                      <button
                        onClick={() => setSort('muted')}
                        className={`transition pb-0.5 whitespace-nowrap ${sort === 'muted'
                          ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                          : 'text-gray-500 hover:text-gray-900'
                          }`}
                      >
                        Muted
                      </button>

                      <button
                        onClick={() => setSort('promoted')}
                        className={`transition pb-0.5 whitespace-nowrap ${sort === 'promoted'
                          ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                          : 'text-gray-500 hover:text-gray-900'
                          }`}
                      >
                        Promoted
                      </button>
                    </div>

                    {/* Tag filter chip (if any) or Refresh */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {tag && (
                        <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                          <span>#{tag}</span>
                          <button
                            onClick={() => setTag('')}
                            className="hover:text-blue-900 font-bold ml-1"
                            title="Clear topic"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => fetchPosts(true)}
                        className="p-1 text-gray-400 hover:text-gray-700 transition"
                        title="Refresh feed"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
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
              ) : sourceTab === 'following' && posts.length === 0 ? (
                /* EMPTY FOLLOWING FEED */
                <div className="p-12 text-center space-y-4 bg-white rounded-3xl shadow-[0_1px_6px_rgba(0,0,0,0.03)]">
                  <UserPlus className="w-12 h-12 text-gray-300 mx-auto" />
                  <div>
                    <h3 className="text-base font-bold text-gray-800">You aren't following anyone yet</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto leading-relaxed">
                      Follow creators to see their posts here or discover trending content in the global feed.
                    </p>
                  </div>
                  <button
                    onClick={() => handleSourceTabChange('global')}
                    className="px-5 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold transition shadow-xs"
                  >
                    Explore Global Feed
                  </button>
                </div>
              ) : sourceTab === 'communities' && posts.length === 0 ? (
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
                    className="px-5 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold transition shadow-xs"
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
                      onSelectPost={(p) => setSelectedPost(p)}
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
                      className="px-6 py-2.5 rounded-full bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold shadow-xs hover:shadow-sm disabled:opacity-50 transition"
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
                      setSourceTab('global');
                    }}
                    className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold transition shadow-xs"
                  >
                    Explore Global Feed
                  </button>
                </div>
              )}

            </section>

            {/* Right Column */}
            <aside className="hidden xl:block space-y-6">
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
                              setSourceTab('communities');
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
            </aside>

          </div>
        )}

      </main>

      {/* Account Profile Modal */}
      {selectedAuthorProfile && (
        <AccountModal
          username={selectedAuthorProfile}
          onClose={() => setSelectedAuthorProfile(null)}
          onSelectPost={(p) => setSelectedPost(p)}
          onSelectAuthor={handleSelectAuthor}
        />
      )}

      {/* Blockchain Stats Modal */}
      {showStatsModal && (
        <BlockchainStatsModal onClose={() => setShowStatsModal(false)} />
      )}

      {/* Communities Directory Modal */}
      {showCommunitiesModal && (
        <CommunitiesModal
          onClose={() => setShowCommunitiesModal(false)}
          onSelectCommunity={(comm) => {
            setTag(comm);
            setSourceTab('communities');
            setShowCommunitiesModal(false);
          }}
          activeCommunity={tag}
        />
      )}

      {/* Manage Communities Dedicated Modal */}
      {showManageCommunitiesModal && (
        <ManageCommunitiesModal
          onClose={() => setShowManageCommunitiesModal(false)}
          onSelectCommunity={(comm) => {
            setTag(comm);
            setSourceTab('communities');
            setShowManageCommunitiesModal(false);
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
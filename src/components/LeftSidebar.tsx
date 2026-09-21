import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Layers,
  Hash,
  Search,
  Star,
  Clock,
  Settings,
  ChevronRight,
  Sparkles,
  Flame,
  TrendingUp,
  DollarSign,
  VolumeX,
  Compass,
  Check,
  Radio,
  SlidersHorizontal,
  FolderOpen
} from 'lucide-react';
import { HivePost, getFollowing, getTrendingTags, getHiveAvatarUrl, listCommunities, getSubscriptions } from '../services/hiveApi';
import { CurrentUser } from '../services/keychain';

export interface LeftSidebarProps {
  activeNav: 'feed' | 'discover' | 'waves' | 'communities';
  onNavChange?: (nav: 'feed' | 'discover' | 'waves' | 'communities') => void;
  currentSort: 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted';
  onSortChange: (sort: 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted') => void;
  currentTag: string;
  onSelectTag: (tag: string) => void;
  onSelectAuthor: (author: string) => void;
  feedPosts: HivePost[];
  currentUser: CurrentUser | null;
  onOpenManageCommunities: () => void;
  joinedCommunities: Record<string, boolean>;
}

const DEFAULT_FOLLOWING_LIST = [
  'ecency',
  'good-karma',
  'qurator',
  'arcange',
  'blocktrades',
  'gtg',
  'roelandp',
  'yabapmatt',
  'peakd',
  'liketu',
  'taskmaster4450',
  'tarazkp'
];

const DEFAULT_COMMUNITIES = [
  { name: 'hive-125125', title: 'Town Square', subscribers: 11911 },
  { name: 'hive-193816', title: 'Music Community', subscribers: 11351 },
  { name: 'hive-163772', title: 'Worldmappin (Travel)', subscribers: 18491 },
  { name: 'hive-167922', title: 'LeoFinance', subscribers: 14200 },
  { name: 'hive-174578', title: 'Photography Lovers', subscribers: 19800 },
  { name: 'hive-148441', title: 'Gems Community', subscribers: 28500 }
];

const DEFAULT_TOPICS = [
  'photography',
  'finance',
  'crypto',
  'travel',
  'art',
  'food',
  'hive',
  'gaming',
  'music',
  'nature',
  'technology',
  'lifestyle'
];

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeNav,
  onNavChange,
  currentSort,
  onSortChange,
  currentTag,
  onSelectTag,
  onSelectAuthor,
  feedPosts,
  currentUser,
  onOpenManageCommunities,
  joinedCommunities
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [followingUsers, setFollowingUsers] = useState<string[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<string[]>(DEFAULT_TOPICS);
  const [allCommunities, setAllCommunities] = useState<{ name: string; title: string; subscribers: number }[]>(DEFAULT_COMMUNITIES);

  // Persistent Favorites
  const [favAuthors, setFavAuthors] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('hive_fav_authors') || '["ecency", "good-karma"]');
    } catch {
      return ['ecency', 'good-karma'];
    }
  });

  const [favCommunities, setFavCommunities] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('hive_fav_communities') || '["hive-125125"]');
    } catch {
      return ['hive-125125'];
    }
  });

  const [favTopics, setFavTopics] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('hive_fav_topics') || '["photography", "crypto"]');
    } catch {
      return ['photography', 'crypto'];
    }
  });

  const toggleFavAuthor = (author: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavAuthors(prev => {
      const updated = prev.includes(author) ? prev.filter(a => a !== author) : [...prev, author];
      localStorage.setItem('hive_fav_authors', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleFavCommunity = (commName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavCommunities(prev => {
      const updated = prev.includes(commName) ? prev.filter(c => c !== commName) : [...prev, commName];
      localStorage.setItem('hive_fav_communities', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleFavTopic = (topic: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavTopics(prev => {
      const updated = prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic];
      localStorage.setItem('hive_fav_topics', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    if (currentUser?.username) {
      // 1. Fetch followed creators
      getFollowing(currentUser.username, '', 60)
        .then((users) => {
          setFollowingUsers(users || []);
        })
        .catch(() => setFollowingUsers([]));

      // 2. Fetch subscribed communities
      getSubscriptions(currentUser.username)
        .then((subs) => {
          if (subs && subs.length > 0) {
            const userComms = subs.map(([name, title]) => ({
              name,
              title: title || name,
              subscribers: 0
            }));
            setAllCommunities(userComms);
          } else {
            setAllCommunities(DEFAULT_COMMUNITIES);
          }
        })
        .catch(() => setAllCommunities(DEFAULT_COMMUNITIES));
    } else {
      setFollowingUsers([]);
      setAllCommunities(DEFAULT_COMMUNITIES);
    }

    // Fetch trending topics
    getTrendingTags(25)
      .then((tags) => {
        if (tags && tags.length > 0) {
          setTrendingTopics(tags.map((t) => t.name));
        }
      })
      .catch(() => { });
  }, [currentUser?.username]);

  // Contextual view mode
  const activeTab: 'following' | 'communities' | 'global' =
    activeNav === 'feed' ? 'following' : activeNav === 'communities' ? 'communities' : 'global';

  // Map author -> latest post timestamp from currently loaded feed
  const authorLastPostMap = useMemo(() => {
    const map: Record<string, { timestamp: number; dateStr: string }> = {};
    for (const post of feedPosts) {
      const postTime = new Date(post.created + 'Z').getTime();
      if (!map[post.author] || postTime > map[post.author].timestamp) {
        map[post.author] = {
          timestamp: postTime,
          dateStr: post.created
        };
      }
    }
    return map;
  }, [feedPosts]);

  // Ranked following users
  const rankedFollowing = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = followingUsers.filter(u => u.toLowerCase().includes(query));

    return [...filtered].sort((a, b) => {
      const isFavA = favAuthors.includes(a);
      const isFavB = favAuthors.includes(b);
      if (isFavA && !isFavB) return -1;
      if (!isFavA && isFavB) return 1;

      const timeA = authorLastPostMap[a]?.timestamp || 0;
      const timeB = authorLastPostMap[b]?.timestamp || 0;
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      return a.localeCompare(b);
    });
  }, [followingUsers, searchQuery, favAuthors, authorLastPostMap]);

  // Ranked Communities
  const rankedCommunities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = allCommunities.filter(c =>
      c.title.toLowerCase().includes(query) || c.name.toLowerCase().includes(query)
    );

    return [...filtered].sort((a, b) => {
      const isFavA = favCommunities.includes(a.name);
      const isFavB = favCommunities.includes(b.name);
      if (isFavA && !isFavB) return -1;
      if (!isFavA && isFavB) return 1;

      const isJoinedA = !!joinedCommunities[a.name];
      const isJoinedB = !!joinedCommunities[b.name];
      if (isJoinedA && !isJoinedB) return -1;
      if (!isJoinedA && isJoinedB) return 1;

      return (b.subscribers || 0) - (a.subscribers || 0);
    });
  }, [allCommunities, searchQuery, favCommunities, joinedCommunities]);

  // Ranked Topics
  const rankedTopics = useMemo(() => {
    const query = searchQuery.trim().toLowerCase().replace(/^#/, '');
    const filtered = trendingTopics.filter(t => t.toLowerCase().includes(query));

    return [...filtered].sort((a, b) => {
      const isFavA = favTopics.includes(a);
      const isFavB = favTopics.includes(b);
      if (isFavA && !isFavB) return -1;
      if (!isFavA && isFavB) return 1;
      return a.localeCompare(b);
    });
  }, [trendingTopics, searchQuery, favTopics]);

  const getRelativeTime = (timeStr?: string) => {
    if (!timeStr) return null;
    const diff = Math.floor((Date.now() - new Date(timeStr + 'Z').getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const sortItems = [
    { id: 'hot' as const, label: 'Hot', icon: Flame, color: 'text-amber-500', description: 'Hot: Posts with rapid momentum and recent engagement' },
    { id: 'trending' as const, label: 'Trending', icon: TrendingUp, color: 'text-blue-600', description: 'Trending: Posts with highest payout and top votes' },
    { id: 'created' as const, label: 'New', icon: Sparkles, color: 'text-emerald-600', isLive: true, description: 'New: Real-time latest posts published on Hive' },
    { id: 'payout' as const, label: 'Payout', icon: DollarSign, color: 'text-emerald-500', description: 'Payout: Posts with highest pending rewards' },
    { id: 'muted' as const, label: 'Muted', icon: VolumeX, color: 'text-rose-500', description: 'Muted: Posts with downvotes or filtered' },
  ];

  return (
    <aside id="left-sidebar" className="space-y-4">

      {/* ================= CARD 1: LEFT SORT & FILTER NAVBAR (DISCOVER & COMMUNITIES ONLY) ================= */}
      {(activeNav === 'discover' || activeNav === 'communities') && (
        <div className="bg-white rounded-3xl p-4 shadow-[0_1px_6px_rgba(0,0,0,0.03)] border border-gray-100/60">

          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 px-1 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <h3 className="font-bold text-xs text-gray-700 tracking-wide uppercase">
                Sort Feed
              </h3>
            </div>

            {currentSort === 'created' ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-gray-500 capitalize bg-gray-50 px-2 py-0.5 rounded-full">
                {currentSort}
              </span>
            )}
          </div>

          {/* Vertical Sort Nav Buttons */}
          <nav className="mt-2.5 space-y-1">
            {sortItems.map((item) => {
              const Icon = item.icon;
              const isSelected = currentSort === item.id;

              return (
                <button
                  key={item.id}
                  id={`sidebar-sort-${item.id}`}
                  onClick={() => onSortChange(item.id)}
                  title={item.description}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-semibold transition cursor-pointer group ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 shadow-xs'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${
                      isSelected ? 'text-blue-600' : `${item.color} group-hover:scale-110`
                    }`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {item.isLive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* ================= CARD 2: CONTEXTUAL DISCOVERY (TOPICS / COMMUNITIES / AUTHORS) ================= */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] border border-gray-100/60">

        {/* Dynamic Header */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            {activeTab === 'following' && <Users className="w-4 h-4 text-blue-600" />}
            {activeTab === 'communities' && <Layers className="w-4 h-4 text-emerald-600" />}
            {activeTab === 'global' && <Hash className="w-4 h-4 text-indigo-600" />}

            <h3 className="font-bold text-sm text-gray-900 capitalize">
              {activeTab === 'following' && 'Followed Creators'}
              {activeTab === 'communities' && 'Communities'}
              {activeTab === 'global' && 'Trending Topics'}
            </h3>
          </div>

          <span className="text-[11px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
            {activeTab === 'following' && `${rankedFollowing.length} users`}
            {activeTab === 'communities' && `${rankedCommunities.length}`}
            {activeTab === 'global' && `${rankedTopics.length} tags`}
          </span>
        </div>

        {/* Search Bar */}
        <div className="my-2.5 relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="sidebar-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'following'
                ? 'Search following creators...'
                : activeTab === 'communities'
                  ? 'Filter communities...'
                  : 'Search topics...'
            }
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white transition"
          />
        </div>

        {/* SECTION A: Following Authors */}
        {activeTab === 'following' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 px-1 py-1">
              <span>Creators</span>
              <span className="flex items-center gap-1 text-[10px] text-amber-500 font-normal">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Favorites
              </span>
            </div>

            <div className="max-h-[360px] overflow-y-auto space-y-1 pr-1">
              {rankedFollowing.length > 0 ? (
                rankedFollowing.map((author) => {
                  const isFav = favAuthors.includes(author);
                  const lastPostInfo = authorLastPostMap[author];
                  const timeBadge = lastPostInfo ? getRelativeTime(lastPostInfo.dateStr) : null;

                  return (
                    <div
                      key={author}
                      onClick={() => onSelectAuthor(author)}
                      title={`Filter feed by @${author}`}
                      className={`group flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer ${
                        isFav ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative flex-shrink-0">
                          <img
                            src={getHiveAvatarUrl(author, 'small')}
                            alt={author}
                            className="w-6 h-6 rounded-full object-cover bg-gray-100"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                            }}
                          />
                          {timeBadge && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 group-hover:text-blue-600 truncate text-xs">
                            @{author}
                          </p>
                          {timeBadge && (
                            <p className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              <span>posted {timeBadge} ago</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={(e) => toggleFavAuthor(author, e)}
                        className={`p-1 rounded-lg transition cursor-pointer ${
                          isFav ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500 opacity-0 group-hover:opacity-100'
                        }`}
                        title={isFav ? 'Remove favorite' : 'Pin to top'}
                      >
                        <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-gray-400">
                  {currentUser
                    ? 'No followed creators matching search.'
                    : 'Connect Keychain to see your followed creators.'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION B: Communities */}
        {activeTab === 'communities' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 px-1 py-1">
              <span>Communities</span>
              <span className="flex items-center gap-1 text-[10px] text-amber-500 font-normal">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Favorites
              </span>
            </div>

            {/* "All Communities" quick reset button */}
            <button
              onClick={() => onSelectTag('')}
              title="Show posts from all communities"
              className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition mb-1 text-left cursor-pointer ${
                !currentTag ? 'bg-emerald-50 text-emerald-800 font-bold' : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded-lg ${!currentTag ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <FolderOpen className="w-3 h-3" />
                </div>
                <span>All Communities</span>
              </div>
              {!currentTag && <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full">active</span>}
            </button>

            <div className="max-h-[340px] overflow-y-auto space-y-1 pr-1">
              {rankedCommunities.length > 0 ? (
                rankedCommunities.map((comm) => {
                  const isFav = favCommunities.includes(comm.name);
                  const isSelected = currentTag.toLowerCase() === comm.name.toLowerCase();

                  return (
                    <div
                      key={comm.name}
                      onClick={() => onSelectTag(isSelected ? '' : comm.name)}
                      title={`Filter posts by ${comm.title || comm.name}`}
                      className={`group flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-800 font-bold'
                          : isFav
                            ? 'bg-amber-50/50 hover:bg-amber-50'
                            : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={`https://images.ecency.com/u/${comm.name}/avatar/small`}
                          alt={comm.title}
                          className="w-5 h-5 rounded-lg object-cover bg-gray-100 flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                          }}
                        />
                        <span className="truncate">{comm.title || comm.name}</span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isSelected && (
                          <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full">
                            active
                          </span>
                        )}
                        <button
                          onClick={(e) => toggleFavCommunity(comm.name, e)}
                          className={`p-1 rounded-lg transition cursor-pointer ${
                            isFav ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500 opacity-0 group-hover:opacity-100'
                          }`}
                          title={isFav ? 'Remove favorite' : 'Pin to top'}
                        >
                          <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-gray-400">
                  No communities found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION C: Trending Topics (In Discover mode) */}
        {activeTab === 'global' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 px-1 py-1">
              <span>Topics</span>
              <span className="flex items-center gap-1 text-[10px] text-amber-500 font-normal">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Favorites
              </span>
            </div>

            {/* "All Topics" quick button */}
            <button
              onClick={() => onSelectTag('')}
              title="Show posts from all topics"
              className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition mb-1 text-left cursor-pointer ${
                !currentTag ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded-lg ${!currentTag ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <Compass className="w-3 h-3" />
                </div>
                <span>All Topics</span>
              </div>
              {!currentTag && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-full">active</span>}
            </button>

            <div className="max-h-[340px] overflow-y-auto space-y-1 pr-1">
              {rankedTopics.length > 0 ? (
                rankedTopics.map((topic) => {
                  const isFav = favTopics.includes(topic);
                  const isSelected = currentTag.toLowerCase() === topic.toLowerCase();

                  return (
                    <div
                      key={topic}
                      onClick={() => onSelectTag(isSelected ? '' : topic)}
                      title={`Filter posts tagged #${topic}`}
                      className={`group flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : isFav
                            ? 'bg-amber-50/50 hover:bg-amber-50'
                            : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`font-bold ${isSelected ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'}`}>
                          #
                        </span>
                        <span className="truncate">{topic}</span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isSelected && (
                          <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-full">
                            active
                          </span>
                        )}
                        <button
                          onClick={(e) => toggleFavTopic(topic, e)}
                          className={`p-1 rounded-lg transition cursor-pointer ${
                            isFav ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500 opacity-0 group-hover:opacity-100'
                          }`}
                          title={isFav ? 'Remove favorite' : 'Pin to top'}
                        >
                          <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-gray-400">
                  No topics found.
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Manage Communities Button */}
      {activeNav === 'communities' && (
        <div className="bg-white rounded-3xl p-3 shadow-[0_1px_6px_rgba(0,0,0,0.03)] border border-gray-100/60">
          <button
            id="manage-communities-sidebar-btn"
            onClick={onOpenManageCommunities}
            title="Open community manager to discover and join communities"
            className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 hover:bg-emerald-50/60 text-emerald-900 transition cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 text-left">
              <div className="p-1.5 rounded-xl bg-emerald-600 text-white shadow-xs">
                <Settings className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900 group-hover:text-emerald-700">Manage Communities</p>
                <p className="text-[10px] text-gray-400">Discover, join & organize</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-500 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      )}

    </aside>
  );
};

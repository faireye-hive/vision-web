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
  FolderOpen,
  MessageSquare
} from 'lucide-react';
import { HivePost, getFollowing, getTrendingTags, getHiveAvatarUrl, listCommunities, getSubscriptions, hiveRpcCall } from '../services/hiveApi';
import { CurrentUser } from '../services/keychain';
import { PredefinedCategoriesCard } from './PredefinedCategoriesCard';
import { getSmartAccountsActivity } from '../services/accountsCache';

export interface LeftSidebarProps {
  activeNav: 'feed' | 'discover' | 'shorts' | 'communities' | 'waves';
  onNavChange?: (nav: 'feed' | 'discover' | 'shorts' | 'communities') => void;
  currentSort: 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted';
  onSortChange: (sort: 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted') => void;
  currentTag: string;
  onSelectTag: (tag: string) => void;
  onSelectAuthor: (author: string) => void;
  activeAuthor?: string | null;
  feedPosts?: HivePost[];
  currentUser: CurrentUser | null;
  onOpenManageCommunities: () => void;
  onOpenManageFollowing?: () => void;
  joinedCommunities: Record<string, boolean>;
  shortsHashtags?: { tag: string; count: number }[];
  selectedShortTag?: string;
  onSelectShortTag?: (tag: string) => void;
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
  activeAuthor,
  feedPosts = [],
  currentUser,
  onOpenManageCommunities,
  onOpenManageFollowing,
  joinedCommunities,
  shortsHashtags = [],
  selectedShortTag = '',
  onSelectShortTag
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

  // Map author -> latest activity timestamp from currently loaded feed
  const authorLastPostMap = useMemo(() => {
    const map: Record<string, { timestamp: number; dateStr: string }> = {};
    for (const post of feedPosts) {
      if (!post || !post.created) continue;
      const safeDateStr = post.created.endsWith('Z') ? post.created : `${post.created}Z`;
      const postTime = new Date(safeDateStr).getTime();
      if (isNaN(postTime)) continue;

      if (!map[post.author] || postTime > map[post.author].timestamp) {
        map[post.author] = {
          timestamp: postTime,
          dateStr: post.created
        };
      }
    }
    return map;
  }, [feedPosts]);

  // Store blockchain last_post timestamp for followed accounts com Cache Inteligente
  const [accountLastPostMap, setAccountLastPostMap] = useState<Record<string, { timestamp: number; dateStr: string }>>({});

  useEffect(() => {
    if (!followingUsers || followingUsers.length === 0) {
      setAccountLastPostMap({});
      return;
    }

    let isMounted = true;

    // Utiliza o serviço de Cache Inteligente (evita sobrecarregar a API Hive)
    getSmartAccountsActivity(followingUsers).then((map) => {
      if (isMounted) {
        setAccountLastPostMap(map);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [followingUsers]);

  // Combined activity map: feed items + blockchain account last_post
  const authorActivityMap = useMemo(() => {
    const combined: Record<string, { timestamp: number; dateStr: string }> = { ...authorLastPostMap };

    for (const [author, info] of Object.entries(accountLastPostMap)) {
      if (!combined[author] || info.timestamp > combined[author].timestamp) {
        combined[author] = {
          timestamp: info.timestamp,
          dateStr: info.dateStr
        };
      }
    }
    return combined;
  }, [authorLastPostMap, accountLastPostMap]);

  // Ranked following users
  const rankedFollowing = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = followingUsers.filter(u => u.toLowerCase().includes(query));

    return [...filtered].sort((a, b) => {
      const isFavA = favAuthors.includes(a);
      const isFavB = favAuthors.includes(b);
      if (isFavA && !isFavB) return -1;
      if (!isFavA && isFavB) return 1;

      const timeA = authorActivityMap[a]?.timestamp || 0;
      const timeB = authorActivityMap[b]?.timestamp || 0;
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      return a.localeCompare(b);
    });
  }, [followingUsers, searchQuery, favAuthors, authorActivityMap]);

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

  // Ranked Shorts Hashtags from comments
  const rankedShortsTags = useMemo(() => {
    if (!shortsHashtags || shortsHashtags.length === 0) return [];
    const query = searchQuery.trim().toLowerCase().replace(/^#/, '');
    if (!query) return shortsHashtags;
    return shortsHashtags.filter(item => item.tag.toLowerCase().includes(query));
  }, [shortsHashtags, searchQuery]);

  const getRelativeTime = (timeStr?: string) => {
    if (!timeStr) return null;
    const safeStr = timeStr.endsWith('Z') ? timeStr : `${timeStr}Z`;
    const past = new Date(safeStr).getTime();
    if (isNaN(past)) return null;
    const diff = Math.max(0, Math.floor((Date.now() - past) / 1000));
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  return (
    <aside id="left-sidebar" className="space-y-4">


      {/* ================= CARD 2: CONTEXTUAL DISCOVERY ================= */}
      {activeNav === 'shorts' ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/60 dark:border-slate-800 text-gray-900 dark:text-slate-100">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Hash className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white leading-tight">Shorts Hashtags</h3>
                <p className="text-[10px] text-gray-400 dark:text-slate-500">Popular in snaps</p>
              </div>
            </div>
            <span className="text-[11px] font-medium text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {rankedShortsTags.length} {rankedShortsTags.length === 1 ? 'tag' : 'tags'}
            </span>
          </div>

          {/* Search Bar */}
          <div className="my-2.5 relative">
            <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="sidebar-shorts-tag-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search #hashtags..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 rounded-xl text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800 transition"
            />
          </div>

          {/* All Shorts / Reset Filter Button */}
          <button
            type="button"
            onClick={() => onSelectShortTag && onSelectShortTag('')}
            title="Show all shorts without hashtag filter"
            className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition mb-1.5 text-left cursor-pointer ${
              !selectedShortTag
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`p-1 rounded-lg ${!selectedShortTag ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
                <Compass className="w-3 h-3" />
              </div>
              <span>All Shorts</span>
            </div>
            {!selectedShortTag && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-full">active</span>}
          </button>

          {/* Hashtag List */}
          <div className="max-h-[380px] overflow-y-auto space-y-1 pr-1">
            {rankedShortsTags.length > 0 ? (
              rankedShortsTags.map((item) => {
                const isSelected = selectedShortTag?.toLowerCase() === item.tag.toLowerCase();
                return (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => onSelectShortTag && onSelectShortTag(isSelected ? '' : item.tag)}
                    title={`Filter snaps with #${item.tag}`}
                    className={`w-full group flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer text-left ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className={`font-bold ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 group-hover:text-blue-500'}`}>
                        #
                      </span>
                      <span className="truncate">{item.tag}</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 group-hover:bg-gray-200 dark:group-hover:bg-slate-700'
                      }`}>
                        {item.count}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                          ✓
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-gray-400 dark:text-slate-500">
                {searchQuery ? 'No matching hashtags.' : 'Scanning snaps for #hashtags...'}
              </div>
            )}
          </div>
        </div>
      ) : activeNav === 'discover' ? (
        <PredefinedCategoriesCard
          currentTag={currentTag}
          onSelectTag={onSelectTag}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/60 dark:border-slate-800 text-gray-900 dark:text-slate-100">

        {/* Dynamic Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {activeTab === 'following' && <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
            {activeTab === 'communities' && <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            {activeTab === 'global' && <Hash className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}

            <h3 className="font-bold text-sm text-gray-900 dark:text-white capitalize">
              {activeTab === 'following' && 'Followed Creators'}
              {activeTab === 'communities' && 'Communities'}
              {activeTab === 'global' && 'Trending Topics'}
            </h3>
          </div>

          <span className="text-[11px] font-medium text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {activeTab === 'following' && `${rankedFollowing.length} users`}
            {activeTab === 'communities' && `${rankedCommunities.length}`}
            {activeTab === 'global' && `${rankedTopics.length} tags`}
          </span>
        </div>

        {/* Search Bar */}
        <div className="my-2.5 relative">
          <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
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
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 rounded-xl text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800 transition"
          />
        </div>

        {/* SECTION A: Following Authors */}
        {activeTab === 'following' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 dark:text-slate-500 px-1 py-1">
              <span>Creators</span>
              <span className="flex items-center gap-1 text-[10px] text-amber-500 font-normal">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Favorites
              </span>
            </div>

            <div className="max-h-[360px] overflow-y-auto space-y-1 pr-1">
              {rankedFollowing.length > 0 ? (
                rankedFollowing.map((author) => {
                  const isFav = favAuthors.includes(author);
                  const lastActivityInfo = authorActivityMap[author];
                  const timeBadge = lastActivityInfo ? getRelativeTime(lastActivityInfo.dateStr) : null;

                  // 1. Verifica se este autor é o ativo selecionado no feed
                  const isActive = Boolean(
                    activeAuthor && activeAuthor.trim().toLowerCase() === author.trim().toLowerCase()
                  );

                  return (
                    <div
                      key={author}
                      onClick={() => onSelectAuthor(author)}
                      title={`Filter feed by @${author}`}
                      /* 2. Aplica destaque com borda azul e fundo visível quando estiver ativo */
                      className={`group flex items-center justify-between p-2 rounded-2xl text-xs transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-100 dark:bg-blue-900/80 border-2 border-blue-500 shadow-md scale-[1.02]'
                          : isFav
                            ? 'bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-50 dark:hover:bg-amber-950/50 border-2 border-transparent text-gray-900 dark:text-slate-100'
                            : 'hover:bg-gray-50 dark:hover:bg-slate-800 border-2 border-transparent text-gray-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative flex-shrink-0">
                          <img
                            src={getHiveAvatarUrl(author, 'small')}
                            alt={author}
                            /* 3. Anel azul no avatar quando ativo */
                            className={`w-6 h-6 rounded-full object-cover bg-gray-100 dark:bg-slate-800 transition-all ${
                              isActive ? 'ring-2 ring-blue-600 scale-105' : ''
                            }`}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                            }}
                          />
                          {timeBadge && !isActive && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className={`truncate text-xs ${
                            isActive 
                              ? 'font-extrabold text-blue-700 dark:text-blue-300' 
                              : 'font-semibold text-gray-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                          }`}>
                            @{author}
                          </p>
                          {timeBadge && (
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                              <span>Active {timeBadge} ago</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* 4. Badge visual "Ativo" ao lado do botão de favorito */}
                        {isActive && (
                          <span className="text-[9px] font-black text-white bg-blue-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                            Active
                          </span>
                        )}

                        <button
                          onClick={(e) => toggleFavAuthor(author, e)}
                          className={`p-1 rounded-lg transition cursor-pointer ${
                            isFav ? 'text-amber-500' : 'text-gray-300 dark:text-slate-600 hover:text-amber-500 opacity-0 group-hover:opacity-100'
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
                <div className="p-4 text-center text-xs text-gray-400 dark:text-slate-500">
                  {currentUser
                    ? 'No followed creators matching search.'
                    : 'Connect Keychain to see your followed creators.'}
                </div>
              )}
            </div>

            {/* Link to Manage Followed Creators */}
            {onOpenManageFollowing && (
              <button
                onClick={onOpenManageFollowing}
                title="Open followed creators manager to review activity and clean up feed"
                className="w-full mt-2 pt-2.5 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition group cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Manage Followed Creators</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
        )}

        {/* SECTION B: Communities */}
        {activeTab === 'communities' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 dark:text-slate-500 px-1 py-1">
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
                !currentTag
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold'
                  : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded-lg ${!currentTag ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
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
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold'
                          : isFav
                            ? 'bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-gray-800 dark:text-slate-200'
                            : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={`https://images.ecency.com/u/${comm.name}/avatar/small`}
                          alt={comm.title}
                          className="w-5 h-5 rounded-lg object-cover bg-gray-100 dark:bg-slate-800 flex-shrink-0"
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
                            isFav ? 'text-amber-500' : 'text-gray-300 dark:text-slate-600 hover:text-amber-500 opacity-0 group-hover:opacity-100'
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
                <div className="p-4 text-center text-xs text-gray-400 dark:text-slate-500">
                  No communities found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION C: Trending Topics (In Discover mode) */}
        {activeTab === 'global' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 dark:text-slate-500 px-1 py-1">
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
                !currentTag
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                  : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded-lg ${!currentTag ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
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
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                          : isFav
                            ? 'bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-gray-800 dark:text-slate-200'
                            : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`font-bold ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 group-hover:text-blue-500'}`}>
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
                            isFav ? 'text-amber-500' : 'text-gray-300 dark:text-slate-600 hover:text-amber-500 opacity-0 group-hover:opacity-100'
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
                <div className="p-4 text-center text-xs text-gray-400 dark:text-slate-500">
                  No topics found.
                </div>
              )}
            </div>
          </div>
        )}

      </div>
      )}

      {/* Manage Communities Button */}
      {activeNav === 'communities' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/60 dark:border-slate-800">
          <button
            id="manage-communities-sidebar-btn"
            onClick={onOpenManageCommunities}
            title="Open community manager to discover and join communities"
            className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-slate-800/80 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 transition cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 text-left">
              <div className="p-1.5 rounded-xl bg-emerald-600 text-white shadow-xs">
                <Settings className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300">Manage Communities</p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500">Discover, join & organize</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-500 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      )}

    </aside>
  );
};

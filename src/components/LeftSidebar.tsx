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
  Sparkles
} from 'lucide-react';
import { HivePost, getFollowing, getTrendingTags, getHiveAvatarUrl, listCommunities, getSubscriptions } from '../services/hiveApi';
import { CurrentUser } from '../services/keychain';

interface LeftSidebarProps {
  sourceTab: 'following' | 'communities' | 'global';
  onSourceTabChange: (tab: 'following' | 'communities' | 'global') => void;
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
  sourceTab,
  onSourceTabChange,
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
  const [allCommunities, setAllCommunities] = useState<{ name: string; title: string; subscribers: number }[]>([]);

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
      // 1. Busca os autores que o usuário segue
      getFollowing(currentUser.username, '', 60)
        .then((users) => {
          setFollowingUsers(users || []);
        })
        .catch(() => setFollowingUsers([]));

      // 2. Busca as comunidades inscritas do usuário
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
            setAllCommunities([]);
          }
        })
        .catch(() => setAllCommunities([]));
    } else {
      // Limpa as listas quando não houver usuário logado
      setFollowingUsers([]);
      setAllCommunities([]);
    }

    // Busca tópicos globais normalmente (se desejar manter os assuntos em alta)
    getTrendingTags(25)
      .then((tags) => {
        if (tags && tags.length > 0) {
          setTrendingTopics(tags.map((t) => t.name));
        }
      })
      .catch(() => { });
  }, [currentUser?.username]);

  // When logged out, enforce Global view
  const activeTab = !currentUser ? 'global' : sourceTab;

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

  // Ranked following users (Starred on top, then ranked by last post timestamp)
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

      return b.subscribers - a.subscribers;
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

  return (
    <aside id="left-sidebar" className="space-y-4">

      {/* Primary Card - Clean borderless with soft shadow */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)]">

        {/* Dynamic Header */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            {activeTab === 'following' && <Users className="w-4 h-4 text-blue-600" />}
            {activeTab === 'communities' && <Layers className="w-4 h-4 text-emerald-600" />}
            {activeTab === 'global' && <Hash className="w-4 h-4 text-indigo-600" />}

            <h3 className="font-bold text-sm text-gray-900 capitalize">
              {activeTab === 'following' && 'Following Feed'}
              {activeTab === 'communities' && 'My Communities'}
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
        <div className="my-3 relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="sidebar-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'following'
                ? 'Search following authors...'
                : activeTab === 'communities'
                  ? 'Filter communities...'
                  : 'Search topics...'
            }
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white transition"
          />
        </div>

        {/* Following Authors */}
        {activeTab === 'following' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 px-1 py-1">
              <span>Authors (Ranked by latest post)</span>
              <span className="flex items-center gap-1 text-[10px] text-amber-500 font-normal">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Favorites
              </span>
            </div>

            <div className="max-h-[380px] overflow-y-auto space-y-1 pr-1">
              {rankedFollowing.length > 0 ? (
                rankedFollowing.map((author) => {
                  const isFav = favAuthors.includes(author);
                  const lastPostInfo = authorLastPostMap[author];
                  const timeBadge = lastPostInfo ? getRelativeTime(lastPostInfo.dateStr) : null;

                  return (
                    <div
                      key={author}
                      onClick={() => onSelectAuthor(author)}
                      className={`group flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer ${isFav ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-gray-50'
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
                        className={`p-1 rounded-lg transition ${isFav ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500 opacity-0 group-hover:opacity-100'
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
                  No authors found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Communities */}
        {activeTab === 'communities' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 px-1 py-1">
              <span>Communities</span>
              <span className="text-[10px] text-emerald-600">Click to filter</span>
            </div>

            <div className="max-h-[380px] overflow-y-auto space-y-1 pr-1">
              {rankedCommunities.length > 0 ? (
                rankedCommunities.map((comm) => {
                  const isFav = favCommunities.includes(comm.name);
                  const isSelected = currentTag === comm.name;
                  const isJoined = !!joinedCommunities[comm.name];

                  return (
                    <div
                      key={comm.name}
                      onClick={() => onSelectTag(isSelected ? '' : comm.name)}
                      className={`group flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer ${isSelected
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : isFav
                          ? 'bg-amber-50/50 hover:bg-amber-50'
                          : 'hover:bg-gray-50'
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={`https://images.ecency.com/u/${comm.name}/avatar/small`}
                          alt={comm.title}
                          className="w-6 h-6 rounded-full object-cover bg-gray-100 flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive-125125/avatar/small';
                          }}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold truncate text-xs">
                            {comm.title}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {comm.subscribers ? `${comm.subscribers.toLocaleString()} members` : comm.name}
                            {isJoined && <span className="ml-1 text-blue-500">• Joined</span>}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => toggleFavCommunity(comm.name, e)}
                        className={`p-1 rounded-lg transition ${isFav ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500 opacity-0 group-hover:opacity-100'
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
                  No communities found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Global Topics */}
        {activeTab === 'global' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 px-1 py-1">
              <span>Trending Hive Topics</span>
              <span className="text-[10px] text-indigo-600">Click # to filter</span>
            </div>

            <div className="max-h-[380px] overflow-y-auto space-y-1 pr-1">
              {rankedTopics.length > 0 ? (
                rankedTopics.map((topic) => {
                  const isFav = favTopics.includes(topic);
                  const isSelected = currentTag.toLowerCase() === topic.toLowerCase();

                  return (
                    <div
                      key={topic}
                      onClick={() => onSelectTag(isSelected ? '' : topic)}
                      className={`group flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer ${isSelected
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

                      <div className="flex items-center gap-1">
                        {isSelected && (
                          <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-full">
                            active
                          </span>
                        )}
                        <button
                          onClick={(e) => toggleFavTopic(topic, e)}
                          className={`p-1 rounded-lg transition ${isFav ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500 opacity-0 group-hover:opacity-100'
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
      <div className="bg-white rounded-3xl p-3 shadow-[0_1px_6px_rgba(0,0,0,0.03)]">
        <button
          id="manage-communities-sidebar-btn"
          onClick={onOpenManageCommunities}
          className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 hover:bg-blue-50/60 text-blue-900 transition group"
        >
          <div className="flex items-center gap-2.5 text-left">
            <div className="p-1.5 rounded-xl bg-blue-600 text-white shadow-xs">
              <Settings className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 group-hover:text-blue-700">Manage Communities</p>
              <p className="text-[10px] text-gray-400">Discover, join & organize</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

    </aside>
  );
};

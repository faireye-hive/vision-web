import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Hash,
  Users,
  Layers,
  X,
  Search,
  Star,
  ChevronRight,
  SlidersHorizontal,
  Compass,
  UserPlus,
  FolderOpen
} from 'lucide-react';
import { TrendingTopicsCard } from './TrendingTopicsCard';
import { HivePost, getHiveAvatarUrl, getSubscriptions } from '../services/hiveApi';
import { CurrentUser } from '../services/keychain';
import { DEFAULT_COMMUNITIES } from './LeftSidebar';

interface MobileSideDrawerProps {
  activeNav: string;
  tag: string;
  setTag: (tag: string) => void;
  sort: string;
  feedAuthor: string | null;
  setFeedAuthor: (author: string | null) => void;
  currentUser: CurrentUser | null;
  followingUsersList: string[];
  openFollowingManager: () => void;
  discoverPosts: HivePost[];
  disabled?: boolean;
  joinedCommunities?: Record<string, boolean>;
  onOpenCommunities?: () => void;
  onOpenManageCommunities?: () => void;
  onOpenCommunity?: (communityName: string) => void;
}

const CURATED_GUEST_CREATORS = [
  'good-karma',
  'ecency',
  'blocktrades',
  'arcange',
  'acidyo',
  'leofinance',
  'taskmaster4450',
  'tarazkp'
];

export const MobileSideDrawer: React.FC<MobileSideDrawerProps> = ({
  activeNav,
  tag,
  setTag,
  sort,
  feedAuthor,
  setFeedAuthor,
  currentUser,
  followingUsersList,
  openFollowingManager,
  discoverPosts,
  disabled = false,
  joinedCommunities,
  onOpenCommunities,
  onOpenManageCommunities,
  onOpenCommunity
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchCreators, setSearchCreators] = useState('');
  const [searchCommunities, setSearchCommunities] = useState('');
  const [userCommunities, setUserCommunities] = useState<{ name: string; title: string; subscribers?: number }[]>([]);

  // Favorite communities
  const [favCommunities, setFavCommunities] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('hive_fav_communities') || '[]');
    } catch {
      return [];
    }
  });

  const toggleFavCommunity = (commName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavCommunities((prev) => {
      const updated = prev.includes(commName) ? prev.filter((c) => c !== commName) : [...prev, commName];
      try {
        localStorage.setItem('hive_fav_communities', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  useEffect(() => {
    if (activeNav === 'communities') {
      if (currentUser?.username) {
        getSubscriptions(currentUser.username)
          .then((subs) => {
            if (subs && subs.length > 0) {
              setUserCommunities(
                subs.map(([name, title]) => ({
                  name,
                  title: title || name,
                }))
              );
            } else {
              setUserCommunities(DEFAULT_COMMUNITIES);
            }
          })
          .catch(() => setUserCommunities(DEFAULT_COMMUNITIES));
      } else {
        setUserCommunities(DEFAULT_COMMUNITIES);
      }
    }
  }, [activeNav, currentUser?.username]);

  const displayedCommunities = useMemo(() => {
    const list = userCommunities.length > 0 ? userCommunities : DEFAULT_COMMUNITIES;
    const q = searchCommunities.trim().toLowerCase();
    const filtered = q
      ? list.filter((c) => c.title.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      : list;

    return [...filtered].sort((a, b) => {
      const aFav = favCommunities.includes(a.name);
      const bFav = favCommunities.includes(b.name);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [userCommunities, searchCommunities, favCommunities]);

  const handleSelectCommunity = (commName: string) => {
    if (onOpenCommunity) {
      onOpenCommunity(commName);
    } else {
      setTag(commName);
      setFeedAuthor(null);
    }
    setIsOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Favorites stored in localStorage (synced with LeftSidebar)
  const [favAuthors, setFavAuthors] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nebulosa_fav_authors');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleFavAuthor = (author: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavAuthors((prev) => {
      const updated = prev.includes(author) ? prev.filter((a) => a !== author) : [...prev, author];
      try {
        localStorage.setItem('nebulosa_fav_authors', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Close when Escape key is pressed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Swipe from left edge area (0 to 95px) to OPEN the drawer without triggering Android system back gesture
  useEffect(() => {
    if (disabled || isOpen) return;

    let startX = 0;
    let startY = 0;
    let isTracking = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      // Generous zone (within 95px) so user doesn't need to touch right at the device bezel
      if (touch.clientX <= 95) {
        startX = touch.clientX;
        startY = touch.clientY;
        isTracking = true;
      } else {
        isTracking = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTracking || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      // Swiped right with horizontal dominance
      if (deltaX > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
        isTracking = false;
        setIsOpen(true);
      }
    };

    const handleTouchEnd = () => {
      isTracking = false;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [disabled, isOpen]);

  // Swipe left anywhere on screen (inside drawer or anywhere outside/backdrop) to CLOSE
  useEffect(() => {
    if (disabled || !isOpen) return;

    let closeStartX = 0;
    let closeStartY = 0;
    let isCloseTracking = false;

    const handleCloseTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      closeStartX = e.touches[0].clientX;
      closeStartY = e.touches[0].clientY;
      isCloseTracking = true;
    };

    const handleCloseTouchMove = (e: TouchEvent) => {
      if (!isCloseTracking || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - closeStartX;
      const deltaY = e.touches[0].clientY - closeStartY;

      // Swiped left anywhere on screen
      if (deltaX < -35 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
        isCloseTracking = false;
        setIsOpen(false);
      }
    };

    const handleCloseTouchEnd = () => {
      isCloseTracking = false;
    };

    window.addEventListener('touchstart', handleCloseTouchStart, { passive: true });
    window.addEventListener('touchmove', handleCloseTouchMove, { passive: true });
    window.addEventListener('touchend', handleCloseTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleCloseTouchStart);
      window.removeEventListener('touchmove', handleCloseTouchMove);
      window.removeEventListener('touchend', handleCloseTouchEnd);
    };
  }, [disabled, isOpen]);

  // Swipe left inside drawer to CLOSE
  const drawerTouchStartX = useRef<number | null>(null);
  const drawerTouchStartY = useRef<number | null>(null);

  const handleDrawerTouchStart = (e: React.TouchEvent) => {
    drawerTouchStartX.current = e.touches[0].clientX;
    drawerTouchStartY.current = e.touches[0].clientY;
  };

  const handleDrawerTouchMove = (e: React.TouchEvent) => {
    if (drawerTouchStartX.current === null) return;
    const deltaX = e.touches[0].clientX - drawerTouchStartX.current;
    const deltaY = e.touches[0].clientY - (drawerTouchStartY.current || 0);

    // Swiped left
    if (deltaX < -35 && Math.abs(deltaX) > Math.abs(deltaY)) {
      drawerTouchStartX.current = null;
      setIsOpen(false);
    }
  };

  const handleDrawerTouchEnd = () => {
    drawerTouchStartX.current = null;
    drawerTouchStartY.current = null;
  };

  // Filtered and sorted followed creators for Feed mode
  const displayedCreators = useMemo(() => {
    const list = currentUser ? followingUsersList : CURATED_GUEST_CREATORS;
    const q = searchCreators.trim().toLowerCase();
    const filtered = q ? list.filter((u) => u.toLowerCase().includes(q)) : list;

    // Put favorites at top
    return [...filtered].sort((a, b) => {
      const aFav = favAuthors.includes(a);
      const bFav = favAuthors.includes(b);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.localeCompare(b);
    });
  }, [currentUser, followingUsersList, searchCreators, favAuthors]);

  // Only render on mobile and when active nav is discover, feed, or communities
  if (disabled || (activeNav !== 'discover' && activeNav !== 'feed' && activeNav !== 'communities')) {
    return null;
  }

  return (
    <>
      {/* ================= MINIMAL MOBILE LATERAL EDGE INDICATOR WITH GENEROUS INVISIBLE TOUCH TARGET ================= */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed left-0 top-[42%] -translate-y-1/2 z-30 sm:hidden flex items-center justify-start pl-0 pr-10 py-10 group cursor-pointer focus:outline-none select-none touch-manipulation"
          style={{ width: '60px', height: '90px' }}
          title={
            activeNav === 'discover'
              ? 'Swipe right to open Trending Topics'
              : activeNav === 'communities'
              ? 'Swipe right to open Subscribed Communities'
              : 'Swipe right to open Followed Creators'
          }
          aria-label={
            activeNav === 'discover'
              ? 'Open Trending Topics'
              : activeNav === 'communities'
              ? 'Open Subscribed Communities'
              : 'Open Followed Creators'
          }
        >
          {/* Subtle lateral edge line that doesn't clutter the UI, with generous invisible padding around it */}
          <div
            className={`w-1.5 group-hover:w-2 h-11 rounded-r-full transition-all shadow-[0_0_8px_rgba(59,130,246,0.35)] ${
              activeNav === 'communities'
                ? 'bg-emerald-500/70 dark:bg-emerald-400/50 group-hover:bg-emerald-600'
                : activeNav === 'discover'
                ? 'bg-indigo-500/70 dark:bg-indigo-400/50 group-hover:bg-indigo-600'
                : 'bg-blue-500/70 dark:bg-blue-400/50 group-hover:bg-blue-600'
            }`}
          />
        </button>
      )}

      {/* ================= BACKDROP OVERLAY (CLOSE ON TAP OR SWIPE OUTSIDE) ================= */}
      <div
        onClick={() => setIsOpen(false)}
        onTouchEnd={() => setIsOpen(false)}
        className={`fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity duration-200 sm:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* ================= SLIDE-OVER DRAWER PANEL ================= */}
      <aside
        onTouchStart={handleDrawerTouchStart}
        onTouchMove={handleDrawerTouchMove}
        onTouchEnd={handleDrawerTouchEnd}
        className={`fixed inset-y-0 left-0 w-[86%] max-w-[340px] bg-white dark:bg-slate-900 z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-out sm:hidden border-r border-gray-100 dark:border-slate-800 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5 min-w-0">
            {activeNav === 'discover' ? (
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                <Hash className="w-4 h-4" />
              </div>
            ) : activeNav === 'communities' ? (
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                <Layers className="w-4 h-4" />
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex-shrink-0">
                <Users className="w-4 h-4" />
              </div>
            )}

            <div className="min-w-0">
              <h2 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                {activeNav === 'discover'
                  ? 'Trending Topics'
                  : activeNav === 'communities'
                  ? 'Subscribed Communities'
                  : 'Followed Creators'}
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">
                {activeNav === 'discover'
                  ? 'Popular on Hive network'
                  : activeNav === 'communities'
                  ? currentUser
                    ? `${displayedCommunities.length} communities`
                    : 'Popular Hive communities'
                  : currentUser
                  ? `${followingUsersList.length} creators followed`
                  : 'Curated Hive creators'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-full hover:bg-gray-200/80 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 transition cursor-pointer flex-shrink-0"
            title="Close drawer (Swipe left)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {/* ================= 1. DISCOVER: TRENDING TOPICS ================= */}
          {activeNav === 'discover' && (
            <div className="space-y-3">
              <TrendingTopicsCard
                currentTag={tag}
                currentSort={sort}
                feedPosts={discoverPosts}
                onSelectTag={(newTag) => {
                  setTag(newTag);
                  setFeedAuthor(null);
                  setIsOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </div>
          )}

          {/* ================= 2. FEED: FOLLOWED CREATORS ================= */}
          {activeNav === 'feed' && (
            <div className="space-y-3">
              {/* Creator Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchCreators}
                  onChange={(e) => setSearchCreators(e.target.value)}
                  placeholder="Search creators..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 rounded-xl text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800 border border-gray-200/70 dark:border-slate-700 transition"
                />
                {searchCreators && (
                  <button
                    onClick={() => setSearchCreators('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Button: All Following Feed (Clear author filter) */}
              <button
                onClick={() => {
                  setFeedAuthor(null);
                  setIsOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer border ${
                  !feedAuthor
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold'
                    : 'bg-white dark:bg-slate-800 border-gray-200/70 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Compass className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>All Followed Feed</span>
                </div>
                {!feedAuthor && (
                  <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-full font-bold">
                    Active
                  </span>
                )}
              </button>

              {/* Creators List */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 dark:text-slate-500 px-1">
                  <span>Creators ({displayedCreators.length})</span>
                  <span className="flex items-center gap-1 text-[10px] text-amber-500 font-normal">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Favorites
                  </span>
                </div>

                <div className="space-y-1">
                  {displayedCreators.length > 0 ? (
                    displayedCreators.map((author) => {
                      const isFav = favAuthors.includes(author);
                      const isActive = Boolean(
                        feedAuthor && feedAuthor.toLowerCase() === author.toLowerCase()
                      );

                      return (
                        <div
                          key={author}
                          onClick={() => {
                            setFeedAuthor(isActive ? null : author);
                            setIsOpen(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer border ${
                            isActive
                              ? 'bg-blue-100 dark:bg-blue-900/70 border-blue-500 text-blue-900 dark:text-blue-100 font-bold shadow-2xs'
                              : isFav
                              ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-900/40 text-gray-900 dark:text-slate-100'
                              : 'bg-white dark:bg-slate-800/80 border-gray-150 dark:border-slate-700/80 text-gray-700 dark:text-slate-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={getHiveAvatarUrl(author, 'small')}
                              alt={author}
                              className={`w-6 h-6 rounded-full object-cover bg-gray-100 dark:bg-slate-800 ${
                                isActive ? 'ring-2 ring-blue-600' : ''
                              }`}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                              }}
                            />
                            <span className="truncate">@{author}</span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isActive && (
                              <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider">
                                Active
                              </span>
                            )}
                            <button
                              onClick={(e) => toggleFavAuthor(author, e)}
                              className="p-1 text-gray-300 dark:text-slate-600 hover:text-amber-500"
                              title={isFav ? 'Remove favorite' : 'Add favorite'}
                            >
                              <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-gray-400 dark:text-slate-500">
                      No creators found.
                    </div>
                  )}
                </div>
              </div>

              {/* Manage Followed Link (if logged in) */}
              {currentUser && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    openFollowingManager();
                  }}
                  className="w-full mt-2 pt-2.5 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Manage Followed Creators</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* ================= 3. COMMUNITIES ================= */}
          {activeNav === 'communities' && (
            <div className="space-y-3">
              {/* Quick Navigation Buttons: Explore & Manage */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (onOpenCommunities) onOpenCommunities();
                  }}
                  className="flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40 transition cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Explore</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (onOpenManageCommunities) onOpenManageCommunities();
                  }}
                  className="flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40 transition cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Manage</span>
                  {userCommunities.length > 0 && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100">
                      {userCommunities.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Community Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchCommunities}
                  onChange={(e) => setSearchCommunities(e.target.value)}
                  placeholder="Filter communities..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 rounded-xl text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800 border border-gray-200/70 dark:border-slate-700 transition"
                />
                {searchCommunities && (
                  <button
                    onClick={() => setSearchCommunities('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* "All Subscribed Communities Feed" quick button */}
              <button
                type="button"
                onClick={() => {
                  setTag('');
                  setFeedAuthor(null);
                  setIsOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer border ${
                  !tag
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold'
                    : 'bg-white dark:bg-slate-800/80 border-gray-200/70 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className={`w-3.5 h-3.5 ${!tag ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`} />
                  <span>All Subscribed Feed</span>
                </div>
                {!tag && (
                  <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full font-bold">
                    Active
                  </span>
                )}
              </button>

              {/* Subscribed Communities List */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 dark:text-slate-500 px-1">
                  <span>Communities ({displayedCommunities.length})</span>
                  <span className="flex items-center gap-1 text-[10px] text-amber-500 font-normal">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Favorites
                  </span>
                </div>

                <div className="space-y-1 max-h-[380px] overflow-y-auto pr-1">
                  {displayedCommunities.length > 0 ? (
                    displayedCommunities.map((comm) => {
                      const isFav = favCommunities.includes(comm.name);
                      const isSelected = tag.toLowerCase() === comm.name.toLowerCase();

                      return (
                        <div
                          key={comm.name}
                          onClick={() => handleSelectCommunity(comm.name)}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer border ${
                            isSelected
                              ? 'bg-emerald-100 dark:bg-emerald-950/70 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold shadow-2xs'
                              : isFav
                              ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-900/40 text-gray-900 dark:text-slate-100'
                              : 'bg-white dark:bg-slate-800/80 border-gray-150 dark:border-slate-700/80 text-gray-700 dark:text-slate-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={getHiveAvatarUrl(comm.name, 'small')}
                              alt={comm.title}
                              className={`w-6 h-6 rounded-lg object-cover bg-gray-100 dark:bg-slate-800 flex-shrink-0 ${
                                isSelected ? 'ring-2 ring-emerald-500' : ''
                              }`}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                              }}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold leading-tight text-gray-900 dark:text-white">
                                {comm.title}
                              </p>
                              <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate">
                                {comm.name}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                            {isSelected && (
                              <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider">
                                Active
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => toggleFavCommunity(comm.name, e)}
                              className="p-1 text-gray-300 dark:text-slate-600 hover:text-amber-500"
                              title={isFav ? 'Remove favorite' : 'Add favorite'}
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
            </div>
          )}
        </div>

        {/* Drawer Footer hint */}
        <div className="p-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 text-[11px] text-gray-400 dark:text-slate-500 text-center flex items-center justify-center gap-1">
          <span>← Swipe left or tap outside to close</span>
        </div>
      </aside>
    </>
  );
};

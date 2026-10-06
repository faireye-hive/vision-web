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
  UserPlus
} from 'lucide-react';
import { TrendingTopicsCard } from './TrendingTopicsCard';
import { HivePost, getHiveAvatarUrl } from '../services/hiveApi';
import { CurrentUser } from '../services/keychain';

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
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchCreators, setSearchCreators] = useState('');

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

  // Swipe from left edge (0 to 45px) to OPEN the drawer
  useEffect(() => {
    if (disabled || isOpen) return;

    let startX = 0;
    let startY = 0;
    let isTracking = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      // Edge zone (within 45px of screen left edge)
      if (touch.clientX <= 45) {
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
      if (deltaX > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
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
    if (deltaX < -50 && Math.abs(deltaX) > Math.abs(deltaY)) {
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
      {/* ================= MINIMAL MOBILE LATERAL EDGE INDICATOR ================= */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed left-0 top-[42%] -translate-y-1/2 z-30 sm:hidden flex items-center justify-start pl-0 pr-2.5 py-4 group cursor-pointer focus:outline-none select-none"
          title={
            activeNav === 'discover'
              ? 'Swipe right to open Trending Topics'
              : 'Swipe right to open Followed Creators'
          }
          aria-label={activeNav === 'discover' ? 'Open Trending Topics' : 'Open Followed Creators'}
        >
          {/* Subtle, discreet lateral edge line that doesn't clutter the UI */}
          <div className="w-1 group-hover:w-1.5 h-10 rounded-r-full bg-blue-500/50 dark:bg-blue-400/40 group-hover:bg-blue-600 transition-all shadow-[0_0_6px_rgba(59,130,246,0.3)]" />
        </button>
      )}

      {/* ================= BACKDROP OVERLAY ================= */}
      <div
        onClick={() => setIsOpen(false)}
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
            ) : (
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex-shrink-0">
                <Users className="w-4 h-4" />
              </div>
            )}

            <div className="min-w-0">
              <h2 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                {activeNav === 'discover' ? 'Trending Topics' : 'Followed Creators'}
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">
                {activeNav === 'discover'
                  ? 'Popular on Hive network'
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
        </div>

        {/* Drawer Footer hint */}
        <div className="p-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 text-[11px] text-gray-400 dark:text-slate-500 text-center flex items-center justify-center gap-1">
          <span>← Swipe left or tap outside to close</span>
        </div>
      </aside>
    </>
  );
};

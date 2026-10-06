import React, { useState } from 'react';
import {
  Rss,
  Compass,
  Zap,
  Users,
  Menu,
  SlidersHorizontal,
  X,
  Edit3,
  Bell,
  User as UserIcon,
  Activity,
  Sun,
  Moon,
  Layers,
  Key,
  Flame,
  TrendingUp,
  Clock,
  DollarSign,
  Hash,
  LogOut,
  FolderOpen,
  Filter
} from 'lucide-react';
import { HivePost } from '../services/hiveApi';
import { CurrentUser } from '../services/keychain';

export interface MobileBottomNavProps {
  activeNav: 'feed' | 'discover' | 'shorts' | 'communities' | 'waves';
  onNavChange: (nav: 'feed' | 'discover' | 'shorts' | 'communities') => void;
  currentUser: CurrentUser | null;
  onOpenWrite?: () => void;
  onOpenNotifications?: () => void;
  onOpenStats?: () => void;
  onOpenCommunities?: () => void;
  onOpenManageCommunities?: () => void;
  onOpenManageFollowing?: () => void;
  onOpenAccount?: (username: string) => void;
  onToggleTheme?: () => void;
  isDark?: boolean;
  unreadNotificationsCount?: number;
  selectedPost?: HivePost | null;
  onClosePost?: () => void;
  onOpenLogin?: () => void;
  onLogout?: () => void;
  currentSort?: 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted';
  onSortChange?: (sort: 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted') => void;
  currentTag?: string;
  onSelectTag?: (tag: string) => void;
  onOpenFilters?: () => void;
  hasStandalonePage?: boolean;
}

const POPULAR_MOBILE_TAGS = [
  'all',
  'hive',
  'photography',
  'crypto',
  'gaming',
  'travel',
  'art',
  'food',
  'music',
  'technology',
  'nature',
  'finance'
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeNav,
  onNavChange,
  currentUser,
  onOpenWrite,
  onOpenNotifications,
  onOpenStats,
  onOpenCommunities,
  onOpenManageCommunities,
  onOpenManageFollowing,
  onOpenAccount,
  onToggleTheme,
  isDark = false,
  unreadNotificationsCount = 0,
  selectedPost,
  onClosePost,
  onOpenLogin,
  onLogout,
  currentSort = 'hot',
  onSortChange,
  currentTag = '',
  onSelectTag,
  onOpenFilters,
  hasStandalonePage = false,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showDiscoverSortPopover, setShowDiscoverSortPopover] = useState(false);

  const handleTabClick = (tab: 'feed' | 'discover' | 'shorts' | 'communities') => {
    if (selectedPost && onClosePost) {
      onClosePost();
    }

    // When tapping Discover while ALREADY on Discover: toggle Sort / Tags popover!
  if (tab === 'discover' && activeNav === 'discover' && !selectedPost && !hasStandalonePage) {
    setShowDiscoverSortPopover((prev) => !prev);
    return;
  }

    setShowDiscoverSortPopover(false);
    onNavChange(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectSort = (sortOption: 'trending' | 'hot' | 'created' | 'payout') => {
    if (onSortChange) {
      onSortChange(sortOption);
    }
    setShowDiscoverSortPopover(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectTopicTag = (tagOption: string) => {
    if (onSelectTag) {
      onSelectTag(tagOption === 'all' ? '' : tagOption);
    }
    setShowDiscoverSortPopover(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isFeedActive = activeNav === 'feed' && !selectedPost  && !hasStandalonePage;
  const isDiscoverActive = activeNav === 'discover' && !selectedPost && !hasStandalonePage;
  const isShortsActive = (activeNav === 'shorts' || activeNav === 'waves') && !selectedPost && !hasStandalonePage;
  const isCommunitiesActive = activeNav === 'communities' && !selectedPost && !hasStandalonePage;

  return (
    <>
      {/* ================= DISCOVER SORT & TOPICS POPOVER ================= */}
      {showDiscoverSortPopover && (
        <div
          className="fixed inset-0 z-45 bg-black/40 backdrop-blur-2xs flex flex-col justify-end md:hidden animate-in fade-in duration-150"
          onClick={() => setShowDiscoverSortPopover(false)}
        >
          <div
            className="w-full max-w-md mx-auto bg-white dark:bg-slate-900 rounded-t-3xl border-t border-gray-200 dark:border-slate-800 p-4 pb-6 shadow-2xl animate-in slide-in-from-bottom duration-200"
            style={{ marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-gray-900 dark:text-white uppercase tracking-wider">
                    Discover Feed Sort
                  </h4>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500">
                    Select feed ranking & sort
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDiscoverSortPopover(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sort Options Buttons (Hot, Trending, Created, Payout) */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {/* Hot */}
              <button
                type="button"
                onClick={() => handleSelectSort('hot')}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  currentSort === 'hot'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-700 hover:border-blue-300'
                }`}
              >
                <Flame className={`w-4 h-4 mb-1 ${currentSort === 'hot' ? 'text-amber-300' : 'text-amber-500'}`} />
                <span className="text-[11px]">Hot</span>
              </button>

              {/* Trending */}
              <button
                type="button"
                onClick={() => handleSelectSort('trending')}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  currentSort === 'trending'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-700 hover:border-blue-300'
                }`}
              >
                <TrendingUp className={`w-4 h-4 mb-1 ${currentSort === 'trending' ? 'text-emerald-300' : 'text-emerald-500'}`} />
                <span className="text-[11px]">Trending</span>
              </button>

              {/* Created */}
              <button
                type="button"
                onClick={() => handleSelectSort('created')}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  currentSort === 'created'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-700 hover:border-blue-300'
                }`}
              >
                <Clock className={`w-4 h-4 mb-1 ${currentSort === 'created' ? 'text-purple-300' : 'text-purple-500'}`} />
                <span className="text-[11px]">New</span>
              </button>

              {/* Payout */}
              <button
                type="button"
                onClick={() => handleSelectSort('payout')}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  currentSort === 'payout'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-700 hover:border-blue-300'
                }`}
              >
                <DollarSign className={`w-4 h-4 mb-1 ${currentSort === 'payout' ? 'text-emerald-300' : 'text-emerald-500'}`} />
                <span className="text-[11px]">Payout</span>
              </button>
            </div>

            {/* Tags & Topics Quick Filter Row */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Hash className="w-3 h-3 text-blue-500" />
                  <span>Popular Topics & Tags</span>
                </span>
                {currentTag && (
                  <button
                    type="button"
                    onClick={() => handleSelectTopicTag('all')}
                    className="text-[10px] font-semibold text-rose-500 hover:underline cursor-pointer"
                  >
                    Clear Filter
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {POPULAR_MOBILE_TAGS.map((t) => {
                  const isSelected = (t === 'all' && !currentTag) || currentTag.toLowerCase() === t.toLowerCase();
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleSelectTopicTag(t)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer border flex-shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-blue-300'
                      }`}
                    >
                      {t === 'all' ? 'All Topics' : `#${t}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MOBILE BOTTOM NAVIGATION BAR ================= */}
      <nav
        id="mobile-bottom-bar"
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-200/80 dark:border-slate-800 md:hidden shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2px)' }}
        aria-label="Mobile Navigation"
      >
        <div className="grid grid-cols-5 items-center justify-around h-14 max-w-md mx-auto px-1">
          {/* Tab 1: Feed */}
          <button
            type="button"
            onClick={() => handleTabClick('feed')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition cursor-pointer active:scale-95 ${
              isFeedActive
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
            }`}
            title="Feed - Following posts"
          >
            <div
              className={`p-1 rounded-xl transition ${
                isFeedActive ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400' : ''
              }`}
            >
              <Rss className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold tracking-tight leading-none mt-0.5 truncate">
              Feed
            </span>
          </button>

          {/* Tab 2: Discover (Tap again to change sort & tags!) */}
          <button
            type="button"
            onClick={() => handleTabClick('discover')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition cursor-pointer active:scale-95 relative ${
              isDiscoverActive
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
            }`}
            title="Discover - Tap again to filter by Hot, Trending, or Tags"
          >
            <div
              className={`p-1 rounded-xl transition relative ${
                isDiscoverActive ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400' : ''
              }`}
            >
              <Compass className="w-5 h-5" />
              {isDiscoverActive && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900" />
              )}
            </div>
            <span className="text-[10px] font-semibold tracking-tight leading-none mt-0.5 truncate flex items-center gap-0.5">
              <span>Discover</span>
              {isDiscoverActive && (
                <span className="text-[8px] opacity-75 capitalize">
                  ({currentSort === 'trending' ? 'Trend' : currentSort === 'created' ? 'New' : currentSort})
                </span>
              )}
            </span>
          </button>

          {/* Tab 3: Shorts */}
          <button
            type="button"
            onClick={() => handleTabClick('shorts')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition cursor-pointer active:scale-95 ${
              isShortsActive
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
            }`}
            title="Shorts - Microblogging snaps"
          >
            <div
              className={`p-1 rounded-xl transition ${
                isShortsActive ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400' : ''
              }`}
            >
              <Zap className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold tracking-tight leading-none mt-0.5 truncate">
              Shorts
            </span>
          </button>

          {/* Tab 4: Communities */}
          <button
            type="button"
            onClick={() => handleTabClick('communities')}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition cursor-pointer active:scale-95 ${
              isCommunitiesActive
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
            }`}
            title="Communities - Groups & Topics"
          >
            <div
              className={`p-1 rounded-xl transition ${
                isCommunitiesActive ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400' : ''
              }`}
            >
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold tracking-tight leading-none mt-0.5 truncate">
              Groups
            </span>
          </button>

          {/* Tab 5: Menu (Actions, Shortcuts, Profile & Settings) */}
          <button
            type="button"
            onClick={() => {
              setShowDiscoverSortPopover(false);
              setShowMenu(true);
            }}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition cursor-pointer active:scale-95 relative ${
              showMenu
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
            }`}
            title="Menu - Shortcuts & options"
          >
            <div
              className={`p-1 rounded-xl transition relative ${
                showMenu ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400' : ''
              }`}
            >
              <Menu className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
              )}
            </div>
            <span className="text-[10px] font-semibold tracking-tight leading-none mt-0.5 truncate">
              Menu
            </span>
          </button>
        </div>
      </nav>

      {/* ================= FULL MENU BOTTOM SHEET (MODAL) ================= */}
      {showMenu && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end md:hidden animate-in fade-in duration-200"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-3xl border-t border-gray-200/90 dark:border-slate-800 p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Visual Drag Handle Bar */}
            <div className="w-10 h-1 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />

            {/* Header with User Info or Title */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                {currentUser ? (
                  <>
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.username}
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500/20 flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                      }}
                    />
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                        @{currentUser.username}
                      </h3>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Hive Keychain Connected
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                      <Menu className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900 dark:text-white leading-tight">
                        Menu & Shortcuts
                      </h3>
                      <p className="text-[11px] text-gray-400 dark:text-slate-500">
                        App actions & settings
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {currentUser && onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onLogout();
                    }}
                    className="p-1.5 rounded-full text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title="Disconnect account"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowMenu(false)}
                  className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Menu Grid: 3 columns of action cards */}
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {/* 1. Write / Publish Post */}
              {onOpenWrite && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onOpenWrite();
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 hover:scale-[1.02] active:scale-95 transition cursor-pointer text-center"
                >
                  <div className="p-2.5 rounded-full bg-emerald-600 text-white shadow-xs mb-1.5">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs">Publish</span>
                  <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                    New Post
                  </span>
                </button>
              )}

              {/* 2. Notifications */}
              {onOpenNotifications && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onOpenNotifications();
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border border-rose-200/60 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 hover:scale-[1.02] active:scale-95 transition cursor-pointer text-center relative"
                >
                  <div className="p-2.5 rounded-full bg-rose-600 text-white shadow-xs mb-1.5 relative">
                    <Bell className="w-4 h-4" />
                    {unreadNotificationsCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-amber-400 text-gray-900 font-black text-[9px] px-1.5 rounded-full border border-white dark:border-slate-900">
                        {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-xs">Notifications</span>
                  <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80">
                    {unreadNotificationsCount > 0 ? `${unreadNotificationsCount} new` : 'Alerts'}
                  </span>
                </button>
              )}

              {/* 3. My Profile or Login */}
              {currentUser ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    if (onOpenAccount) onOpenAccount(currentUser.username);
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/60 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 hover:scale-[1.02] active:scale-95 transition cursor-pointer text-center"
                >
                  <div className="p-2.5 rounded-full bg-blue-600 text-white shadow-xs mb-1.5">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs truncate max-w-full">
                    My Profile
                  </span>
                  <span className="text-[10px] text-blue-600/80 dark:text-blue-400/80">
                    View account
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    if (onOpenLogin) onOpenLogin();
                    else window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border border-rose-200/60 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 hover:scale-[1.02] active:scale-95 transition cursor-pointer text-center"
                >
                  <div className="p-2.5 rounded-full bg-rose-600 text-white shadow-xs mb-1.5">
                    <Key className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs">Keychain Login</span>
                  <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80">
                    Sign in with Hive
                  </span>
                </button>
              )}

              {/* 4. Theme Mode (Dark / Light) */}
              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/70 border border-gray-200/70 dark:border-slate-700/80 text-gray-800 dark:text-slate-200 hover:scale-[1.02] active:scale-95 transition cursor-pointer text-center"
                >
                  <div
                    className={`p-2.5 rounded-full text-white shadow-xs mb-1.5 ${
                      isDark ? 'bg-amber-400 text-gray-900' : 'bg-slate-800 text-amber-300'
                    }`}
                  >
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </div>
                  <span className="font-bold text-xs">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                  <span className="text-[10px] text-gray-500 dark:text-slate-400">
                    {isDark ? 'Switch to Light' : 'Switch to Dark'}
                  </span>
                </button>
              )}

              {/* 5. Explore Communities */}
              {onOpenCommunities && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onOpenCommunities();
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/70 border border-gray-200/70 dark:border-slate-700/80 text-gray-800 dark:text-slate-200 hover:scale-[1.02] active:scale-95 transition cursor-pointer text-center"
                >
                  <div className="p-2.5 rounded-full bg-purple-600 text-white shadow-xs mb-1.5">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs">Communities</span>
                  <span className="text-[10px] text-gray-500 dark:text-slate-400">
                    Explore Groups
                  </span>
                </button>
              )}

              {/* 6. Blockchain Stats & Nodes */}
              {onOpenStats && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onOpenStats();
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/70 border border-gray-200/70 dark:border-slate-700/80 text-gray-800 dark:text-slate-200 hover:scale-[1.02] active:scale-95 transition cursor-pointer text-center"
                >
                  <div className="p-2.5 rounded-full bg-amber-500 text-white shadow-xs mb-1.5">
                    <Activity className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs">Nodes & Stats</span>
                  <span className="text-[10px] text-gray-500 dark:text-slate-400">
                    Blockchain RPC
                  </span>
                </button>
              )}

              {/* 7. Manage Following */}
              {onOpenManageFollowing && currentUser && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onOpenManageFollowing();
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/70 border border-gray-200/70 dark:border-slate-700/80 text-gray-800 dark:text-slate-200 hover:scale-[1.02] active:scale-95 transition cursor-pointer text-center"
                >
                  <div className="p-2.5 rounded-full bg-sky-600 text-white shadow-xs mb-1.5">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs">Following</span>
                  <span className="text-[10px] text-gray-500 dark:text-slate-400">
                    Manage Accounts
                  </span>
                </button>
              )}

              {/* 8. Manage Communities */}
              {onOpenManageCommunities && currentUser && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onOpenManageCommunities();
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/70 border border-gray-200/70 dark:border-slate-700/80 text-gray-800 dark:text-slate-200 hover:scale-[1.02] active:scale-95 transition cursor-pointer text-center"
                >
                  <div className="p-2.5 rounded-full bg-indigo-600 text-white shadow-xs mb-1.5">
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs">Subscriptions</span>
                  <span className="text-[10px] text-gray-500 dark:text-slate-400">
                    My Communities
                  </span>
                </button>
              )}

              {/* 9. Content Filters */}
              {onOpenFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onOpenFilters();
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/70 border border-gray-200/70 dark:border-slate-700/80 text-gray-800 dark:text-slate-200 hover:scale-[1.02] active:scale-95 transition cursor-pointer text-center"
                >
                  <div className="p-2.5 rounded-full bg-slate-700 text-white shadow-xs mb-1.5">
                    <Filter className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs">Filters</span>
                  <span className="text-[10px] text-gray-500 dark:text-slate-400">
                    Words & Authors
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

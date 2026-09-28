import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Search,
  Users,
  Clock,
  AlertTriangle,
  UserX,
  Star,
  RefreshCw,
  ExternalLink,
  CheckSquare,
  Square,
  ShieldAlert,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import {
  FollowedCreatorInfo,
  getAllFollowingWithDetails,
  calculateReputation,
  getHiveAvatarUrl
} from '../services/hiveApi';
import { KeychainService, CurrentUser } from '../services/keychain';

interface FollowingManagerPageProps {
  currentUser: CurrentUser | null;
  onClose: () => void;
  onOpenProfile: (username: string) => void;
  onRequireLogin: () => void;
}

type FilterTab = 'all' | 'active' | 'inactive6mo' | 'dormant' | 'favorites';
type SortOption = 'recent_active' | 'oldest_active' | 'reputation' | 'name_asc' | 'name_desc';

export const FollowingManagerPage: React.FC<FollowingManagerPageProps> = ({
  currentUser,
  onClose,
  onOpenProfile,
  onRequireLogin
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [creators, setCreators] = useState<FollowedCreatorInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [sortOption, setSortOption] = useState<SortOption>('recent_active');
  const [unfollowingUsers, setUnfollowingUsers] = useState<Record<string, boolean>>({});
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Favorites stored in localStorage (synced with LeftSidebar)
  const [favAuthors, setFavAuthors] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('hive_fav_authors') || '["ecency", "good-karma"]');
    } catch {
      return ['ecency', 'good-karma'];
    }
  });

  const toggleFavAuthor = (author: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFavAuthors(prev => {
      const updated = prev.includes(author) ? prev.filter(a => a !== author) : [...prev, author];
      localStorage.setItem('hive_fav_authors', JSON.stringify(updated));
      return updated;
    });
  };

  const loadFollowing = useCallback(async (forceRefresh = false) => {
    if (!currentUser?.username) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    try {
      const data = await getAllFollowingWithDetails(currentUser.username, 800);
      setCreators(data);
    } catch (err: any) {
      setStatusMessage({
        text: 'Failed to load followed accounts. Please retry.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [currentUser?.username]);

  useEffect(() => {
    loadFollowing();
  }, [loadFollowing]);

  const handleUnfollowSingle = async (targetUser: string) => {
    if (!currentUser?.username) {
      onRequireLogin();
      return;
    }

    if (!confirm(`Are you sure you want to unfollow @${targetUser}?`)) {
      return;
    }

    setUnfollowingUsers(prev => ({ ...prev, [targetUser]: true }));
    setStatusMessage(null);

    try {
      const res = await KeychainService.followUser(currentUser.username, targetUser, false);
      if (res.success) {
        setCreators(prev => prev.filter(c => c.username !== targetUser));
        setSelectedUsers(prev => {
          const next = new Set(prev);
          next.delete(targetUser);
          return next;
        });
        setStatusMessage({
          text: `Successfully unfollowed @${targetUser}`,
          type: 'success'
        });
        // Dispatch event for sidebar to sync if needed
        window.dispatchEvent(new CustomEvent('nebulosa:following_updated', { detail: { targetUser, followed: false } }));
      } else {
        setStatusMessage({
          text: res.message || `Failed to unfollow @${targetUser}`,
          type: 'error'
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || `Error unfollowing @${targetUser}`,
        type: 'error'
      });
    } finally {
      setUnfollowingUsers(prev => {
        const next = { ...prev };
        delete next[targetUser];
        return next;
      });
    }
  };

  const handleBulkUnfollow = async () => {
    if (!currentUser?.username) {
      onRequireLogin();
      return;
    }

    const targets = Array.from(selectedUsers);
    if (targets.length === 0) return;

    if (!confirm(`Are you sure you want to unfollow ${targets.length} selected accounts? This will request Keychain approval.`)) {
      return;
    }

    setStatusMessage({
      text: `Processing unfollow for ${targets.length} accounts...`,
      type: 'info'
    });

    let successCount = 0;
    for (const target of targets) {
      setUnfollowingUsers(prev => ({ ...prev, [target]: true }));
      try {
        const res = await KeychainService.followUser(currentUser.username, target, false);
        if (res.success) {
          successCount++;
          setCreators(prev => prev.filter(c => c.username !== target));
        }
      } catch {}
      setUnfollowingUsers(prev => {
        const next = { ...prev };
        delete next[target];
        return next;
      });
    }

    setSelectedUsers(new Set());
    setStatusMessage({
      text: `Unfollowed ${successCount} of ${targets.length} accounts successfully.`,
      type: 'success'
    });
  };

  const now = Date.now();
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
  const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

  // Compute summary stats
  const stats = useMemo(() => {
    let activeRecent = 0;
    let inactive6mo = 0;
    let dormant = 0;

    for (const c of creators) {
      const ts = c.lastPostTimestamp;
      if (!ts) {
        dormant++;
        inactive6mo++;
      } else {
        const age = now - ts;
        if (age <= ONE_MONTH_MS) {
          activeRecent++;
        } else if (age > ONE_YEAR_MS) {
          dormant++;
          inactive6mo++;
        } else if (age > SIX_MONTHS_MS) {
          inactive6mo++;
        }
      }
    }

    return {
      total: creators.length,
      activeRecent,
      inactive6mo,
      dormant
    };
  }, [creators, now]);

  // Filter and sort creators
  const filteredAndSortedCreators = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = creators.filter(c => {
      // Text search
      if (q) {
        const matchesUser = c.username.toLowerCase().includes(q);
        const matchesName = c.name ? c.name.toLowerCase().includes(q) : false;
        if (!matchesUser && !matchesName) return false;
      }

      // Tab filter
      const ts = c.lastPostTimestamp;
      const age = ts ? now - ts : Infinity;

      if (activeTab === 'active') {
        return age <= ONE_MONTH_MS;
      }
      if (activeTab === 'inactive6mo') {
        return age > SIX_MONTHS_MS;
      }
      if (activeTab === 'dormant') {
        return age > ONE_YEAR_MS || !ts;
      }
      if (activeTab === 'favorites') {
        return favAuthors.includes(c.username);
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortOption === 'recent_active') {
        const timeA = a.lastPostTimestamp || 0;
        const timeB = b.lastPostTimestamp || 0;
        return timeB - timeA;
      }
      if (sortOption === 'oldest_active') {
        const timeA = a.lastPostTimestamp || 0;
        const timeB = b.lastPostTimestamp || 0;
        return timeA - timeB;
      }
      if (sortOption === 'reputation') {
        const repA = typeof a.reputation === 'number' ? a.reputation : 0;
        const repB = typeof b.reputation === 'number' ? b.reputation : 0;
        return repB - repA;
      }
      if (sortOption === 'name_asc') {
        return a.username.localeCompare(b.username);
      }
      if (sortOption === 'name_desc') {
        return b.username.localeCompare(a.username);
      }
      return 0;
    });
  }, [creators, searchQuery, activeTab, sortOption, favAuthors, now]);

  const selectAllCurrent = () => {
    if (selectedUsers.size === filteredAndSortedCreators.length && filteredAndSortedCreators.length > 0) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredAndSortedCreators.map(c => c.username)));
    }
  };

  const selectAllInactive = () => {
    const inactive = creators
      .filter(c => !c.lastPostTimestamp || (now - c.lastPostTimestamp) > SIX_MONTHS_MS)
      .map(c => c.username);
    setSelectedUsers(new Set(inactive));
  };

  const formatLastActive = (timestamp?: number, dateStr?: string) => {
    if (!timestamp || !dateStr) {
      return { label: 'No posts recorded', badge: 'Dormant', color: 'text-gray-400 dark:text-slate-500' };
    }
    const diff = now - timestamp;
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (days <= 0) return { label: 'Active today', badge: 'Active', color: 'text-emerald-600 dark:text-emerald-400' };
    if (days === 1) return { label: 'Active yesterday', badge: 'Active', color: 'text-emerald-600 dark:text-emerald-400' };
    if (days < 30) return { label: `Active ${days}d ago`, badge: 'Active', color: 'text-emerald-600 dark:text-emerald-400' };
    if (days < 180) {
      const months = Math.floor(days / 30);
      return { label: `Active ${months}mo ago`, badge: 'Recent', color: 'text-blue-600 dark:text-blue-400' };
    }
    if (days < 365) {
      const months = Math.floor(days / 30);
      return { label: `Inactive (${months}mo)`, badge: 'Inactive > 6 mo', color: 'text-amber-600 dark:text-amber-400' };
    }
    const years = (days / 365).toFixed(1);
    return { label: `Inactive (${years}y)`, badge: 'Dormant > 1 yr', color: 'text-rose-600 dark:text-rose-400' };
  };

  return (
    <div className="max-w-6xl mx-auto pb-16 animate-in fade-in duration-200">
      {/* Top Breadcrumb & Return to feed */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-blue-400 transition shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Feed</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadFollowing(true)}
            disabled={loading}
            title="Refresh followed creators list"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg mb-6 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold mb-3 uppercase tracking-wider">
            <Users className="w-3.5 h-3.5" />
            <span>Feed Subscriptions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Followed Creators Manager
          </h1>
          <p className="mt-2 text-sm text-blue-50/90 leading-relaxed">
            Monitor activity of creators you follow, identify inactive accounts with no posts in over 6 months, and unfollow directly via Hive Keychain to curate your feed.
          </p>
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div className={`mb-6 p-4 rounded-2xl flex items-center justify-between text-xs font-semibold ${
          statusMessage.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
            : statusMessage.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
              : 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            {statusMessage.type === 'error' && <ShieldAlert className="w-4 h-4 text-rose-600" />}
            {statusMessage.type === 'info' && <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-[11px] underline opacity-75 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div
          onClick={() => setActiveTab('all')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeTab === 'all'
              ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 text-xs">
            <span>Total Followed</span>
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">
            {loading ? '...' : stats.total}
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">All creators in your feed</p>
        </div>

        <div
          onClick={() => setActiveTab('active')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeTab === 'active'
              ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 text-xs">
            <span>Active &lt; 30d</span>
            <Flame className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {loading ? '...' : stats.activeRecent}
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">Posted in the last month</p>
        </div>

        <div
          onClick={() => setActiveTab('inactive6mo')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeTab === 'inactive6mo'
              ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 text-xs">
            <span>Inactive &gt; 6 mo</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {loading ? '...' : stats.inactive6mo}
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">No posts in over 180 days</p>
        </div>

        <div
          onClick={() => setActiveTab('dormant')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeTab === 'dormant'
              ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-400 dark:border-rose-700 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 text-xs">
            <span>Dormant &gt; 1 yr</span>
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {loading ? '...' : stats.dormant}
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">Completely silent accounts</p>
        </div>
      </div>

      {/* Main Filter & Action Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-gray-100 dark:border-slate-800 shadow-xs mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by @username or display name..."
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-slate-800 border border-transparent rounded-2xl text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-semibold rounded-2xl px-3 py-2 text-gray-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="recent_active">Sort: Most Recently Active</option>
              <option value="oldest_active">Sort: Most Inactive (Oldest)</option>
              <option value="reputation">Sort: Highest Reputation</option>
              <option value="name_asc">Sort: Username (A-Z)</option>
              <option value="name_desc">Sort: Username (Z-A)</option>
            </select>
          </div>
        </div>

        {/* Filter Tabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-4 mt-4 border-t border-gray-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            <span>All Following</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === 'all' ? 'bg-blue-700 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
            }`}>
              {creators.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
              activeTab === 'active'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            <span>Active (&lt; 30d)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === 'active' ? 'bg-emerald-700 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
            }`}>
              {stats.activeRecent}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('inactive6mo')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
              activeTab === 'inactive6mo'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-300" />
            <span>Inactive (&gt; 6 mo)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === 'inactive6mo' ? 'bg-amber-700 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
            }`}>
              {stats.inactive6mo}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('dormant')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
              activeTab === 'dormant'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            <span>Dormant (&gt; 1 yr)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === 'dormant' ? 'bg-rose-700 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
            }`}>
              {stats.dormant}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('favorites')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
              activeTab === 'favorites'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span>Favorites</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === 'favorites' ? 'bg-purple-700 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
            }`}>
              {creators.filter(c => favAuthors.includes(c.username)).length}
            </span>
          </button>
        </div>

        {/* Bulk Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t border-gray-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={selectAllCurrent}
              className="flex items-center gap-1.5 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 font-semibold cursor-pointer"
            >
              {selectedUsers.size > 0 && selectedUsers.size === filteredAndSortedCreators.length ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>Select all in view ({filteredAndSortedCreators.length})</span>
            </button>

            {stats.inactive6mo > 0 && (
              <button
                onClick={selectAllInactive}
                className="text-amber-600 dark:text-amber-400 hover:underline font-semibold cursor-pointer hidden sm:inline"
              >
                Select all inactive &gt; 6 mo ({stats.inactive6mo})
              </button>
            )}
          </div>

          {selectedUsers.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium">
                {selectedUsers.size} selected
              </span>
              <button
                onClick={handleBulkUnfollow}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-xs cursor-pointer"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Unfollow Selected</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Creators List */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-800 dark:text-slate-200">
            Analyzing your followed creators...
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            Fetching blockchain activity timestamps and post history
          </p>
        </div>
      ) : filteredAndSortedCreators.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800">
          <Users className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800 dark:text-slate-200">
            No followed creators found
          </h3>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No creators matched "${searchQuery}". Try a different keyword.`
              : activeTab === 'inactive6mo'
                ? 'Great news! None of your followed creators have been inactive for over 6 months.'
                : 'You are not currently following any creators, or they could not be loaded.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {filteredAndSortedCreators.map((creator) => {
            const isFav = favAuthors.includes(creator.username);
            const isSelected = selectedUsers.has(creator.username);
            const isUnfollowing = Boolean(unfollowingUsers[creator.username]);
            const rep = creator.reputation ? calculateReputation(creator.reputation) : null;
            const activity = formatLastActive(creator.lastPostTimestamp, creator.lastPostDate);
            const isInactiveWarning = creator.isInactive6Months || (creator.lastPostTimestamp && (now - creator.lastPostTimestamp) > SIX_MONTHS_MS);

            return (
              <div
                key={creator.username}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                    : isInactiveWarning
                      ? 'border-amber-200/80 dark:border-amber-900/40 hover:border-amber-300 shadow-xs'
                      : 'border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: Checkbox & Avatar */}
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUsers(prev => {
                          const next = new Set(prev);
                          if (next.has(creator.username)) next.delete(creator.username);
                          else next.add(creator.username);
                          return next;
                        });
                      }}
                      className="mt-1 text-gray-400 hover:text-blue-600 transition cursor-pointer flex-shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <div className="relative flex-shrink-0">
                      <img
                        src={creator.avatarUrl || getHiveAvatarUrl(creator.username, 'small')}
                        alt={creator.username}
                        className="w-11 h-11 rounded-full object-cover bg-gray-100 dark:bg-slate-800 border border-gray-100 dark:border-slate-700"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                        }}
                      />
                      {isInactiveWarning && (
                        <span
                          title="Inactive creator (> 6 months)"
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] text-white font-bold"
                        >
                          !
                        </span>
                      )}
                    </div>

                    {/* Middle: User details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => onOpenProfile(creator.username)}
                          className="font-bold text-sm text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition truncate text-left cursor-pointer"
                        >
                          @{creator.username}
                        </button>

                        {rep !== null && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
                            {rep}
                          </span>
                        )}
                      </div>

                      {creator.name && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                          {creator.name}
                        </p>
                      )}

                      {/* Last active info */}
                      <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
                        <Clock className="w-3 h-3 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                        <span className={`font-medium ${activity.color}`}>
                          {activity.label}
                        </span>
                        {isInactiveWarning && (
                          <span className="px-1.5 py-0.2 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                            &gt; 6 mo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Favorite Pin */}
                  <button
                    onClick={(e) => toggleFavAuthor(creator.username, e)}
                    className={`p-1.5 rounded-xl transition cursor-pointer ${
                      isFav
                        ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40'
                        : 'text-gray-300 dark:text-slate-600 hover:text-amber-500 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                    title={isFav ? 'Remove from favorites' : 'Pin to favorites'}
                  >
                    <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
                  </button>
                </div>

                {/* Footer action buttons */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100 dark:border-slate-800 text-xs">
                  <button
                    onClick={() => onOpenProfile(creator.username)}
                    className="flex items-center gap-1 text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-semibold cursor-pointer"
                  >
                    <span>View Profile</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>

                  <button
                    onClick={() => handleUnfollowSingle(creator.username)}
                    disabled={isUnfollowing}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                      isInactiveWarning
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-rose-50 hover:text-rose-600 border border-amber-200 dark:border-amber-800'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400'
                    }`}
                  >
                    {isUnfollowing ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Unfollowing...</span>
                      </>
                    ) : (
                      <>
                        <UserX className="w-3 h-3" />
                        <span>Unfollow</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

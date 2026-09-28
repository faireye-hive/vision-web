import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  RefreshCw,
  Heart,
  MessageSquare,
  Repeat,
  UserPlus,
  AtSign,
  Shield,
  Layers,
  Flag,
  Pin,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { HiveNotification, getAccountNotifications, getHiveAvatarUrl } from '../services/hiveApi';
import { CurrentUser } from '../services/keychain';

interface NotificationsPageProps {
  currentUser: CurrentUser | null;
  onClose: () => void;
  onOpenPost: (author: string, permlink: string) => void;
  onOpenUser: (username: string) => void;
  onRequireLogin: () => void;
  onNotificationsRead?: () => void;
}

type NotificationCategory = 'all' | 'replies' | 'votes' | 'mentions' | 'follows' | 'reblogs' | 'community';

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  currentUser,
  onClose,
  onOpenPost,
  onOpenUser,
  onRequireLogin,
  onNotificationsRead
}) => {
  const [notifications, setNotifications] = useState<HiveNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory>('all');
  const [lastReadId, setLastReadId] = useState<string>(() => {
    try {
      return localStorage.getItem('hive_last_read_notif_id') || '';
    } catch {
      return '';
    }
  });

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (!currentUser?.username) {
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setLoading(true);
    }

    try {
      const items = await getAccountNotifications(currentUser.username, 50);
      setNotifications(items);
      setHasMore(items.length >= 50);

      // If user opened page, auto-mark top notification as read after viewing
      if (items.length > 0) {
        const topId = items[0].id;
        localStorage.setItem('hive_last_read_notif_id', topId);
        setLastReadId(topId);
        window.dispatchEvent(new CustomEvent('nebulosa:notifications_cleared', { detail: { topId } }));
        onNotificationsRead?.();
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.username, onNotificationsRead]);

  useEffect(() => {
    loadNotifications(true);
  }, [loadNotifications]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || notifications.length === 0 || !currentUser?.username) return;

    setLoadingMore(true);
    const lastItem = notifications[notifications.length - 1];
    try {
      const nextBatch = await getAccountNotifications(currentUser.username, 50, lastItem.id);
      // Remove possible duplicate top item if RPC returns last_id again
      const filtered = nextBatch.filter(item => !notifications.some(existing => existing.id === item.id));

      if (filtered.length === 0) {
        setHasMore(false);
      } else {
        setNotifications(prev => [...prev, ...filtered]);
        if (nextBatch.length < 50) {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error('Failed to load more notifications:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMarkAllRead = () => {
    if (notifications.length > 0) {
      const topId = notifications[0].id;
      localStorage.setItem('hive_last_read_notif_id', topId);
      setLastReadId(topId);
      window.dispatchEvent(new CustomEvent('nebulosa:notifications_cleared', { detail: { topId } }));
      onNotificationsRead?.();
    }
  };

  // Helper to extract actor username from notification msg e.g. "@alice replied to your comment"
  const extractActor = (msg: string): string => {
    const match = msg.match(/@([a-z0-9\-\.]+)/i);
    return match ? match[1].toLowerCase() : '';
  };

  // Format date relative time
  const formatTime = (dateStr: string) => {
    try {
      const safe = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
      const date = new Date(safe);
      const diff = Date.now() - date.getTime();
      const minutes = Math.floor(diff / (1000 * 60));
      if (minutes < 1) return 'just now';
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days}d ago`;
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  // Categorize helper
  const getCategoryForType = (type: string): NotificationCategory => {
    switch (type) {
      case 'reply':
      case 'reply_comment':
        return 'replies';
      case 'vote':
        return 'votes';
      case 'mention':
        return 'mentions';
      case 'follow':
        return 'follows';
      case 'reblog':
        return 'reblogs';
      case 'subscribe':
      case 'new_community':
      case 'set_role':
      case 'set_props':
      case 'set_label':
      case 'mute_post':
      case 'unmute_post':
      case 'pin_post':
      case 'unpin_post':
      case 'flag_post':
        return 'community';
      default:
        return 'all';
    }
  };

  // Get icon and color badge for notification type
  const getTypeMeta = (type: string) => {
    switch (type) {
      case 'reply':
      case 'reply_comment':
        return {
          icon: MessageSquare,
          color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
          label: 'Reply'
        };
      case 'vote':
        return {
          icon: Heart,
          color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
          label: 'Vote'
        };
      case 'mention':
        return {
          icon: AtSign,
          color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
          label: 'Mention'
        };
      case 'follow':
        return {
          icon: UserPlus,
          color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
          label: 'Follow'
        };
      case 'reblog':
        return {
          icon: Repeat,
          color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800',
          label: 'Reblog'
        };
      case 'subscribe':
      case 'new_community':
        return {
          icon: Layers,
          color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
          label: 'Community'
        };
      case 'set_role':
      case 'set_label':
      case 'set_props':
        return {
          icon: Shield,
          color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
          label: 'Role'
        };
      case 'pin_post':
      case 'unpin_post':
        return {
          icon: Pin,
          color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800',
          label: 'Pinned'
        };
      case 'flag_post':
      case 'mute_post':
      case 'unmute_post':
        return {
          icon: Flag,
          color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800',
          label: 'Moderation'
        };
      default:
        return {
          icon: Bell,
          color: 'text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700',
          label: 'Notice'
        };
    }
  };

  // Filter notifications by selected category
  const filteredNotifications = useMemo(() => {
    if (selectedCategory === 'all') return notifications;
    return notifications.filter(n => getCategoryForType(n.type) === selectedCategory);
  }, [notifications, selectedCategory]);

  // Counts by category
  const categoryCounts = useMemo(() => {
    const counts: Record<NotificationCategory, number> = {
      all: notifications.length,
      replies: 0,
      votes: 0,
      mentions: 0,
      follows: 0,
      reblogs: 0,
      community: 0
    };

    for (const n of notifications) {
      const cat = getCategoryForType(n.type);
      if (counts[cat] !== undefined) {
        counts[cat]++;
      }
    }

    return counts;
  }, [notifications]);

  // Action on item click
  const handleItemClick = (notification: HiveNotification) => {
    if (notification.url) {
      const clean = notification.url.replace(/^@/, '');
      const parts = clean.split('/');
      if (parts.length >= 2) {
        const author = parts[0];
        const permlink = parts.slice(1).join('/');
        onOpenPost(author, permlink);
        return;
      }
      if (parts.length === 1 && parts[0]) {
        onOpenUser(parts[0]);
        return;
      }
    }

    const actor = extractActor(notification.msg);
    if (actor) {
      onOpenUser(actor);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-16 animate-in fade-in duration-200">
      {/* Top Navigation & Actions */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-blue-400 transition shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Feed</span>
        </button>

        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer shadow-xs"
            >
              <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Mark all read</span>
            </button>
          )}

          <button
            onClick={() => loadNotifications(true)}
            disabled={loading}
            title="Refresh notifications"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-500 via-pink-600 to-indigo-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg mb-6 relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-44 h-44 bg-white/10 rounded-full blur-xl pointer-events-none" />
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold mb-3 uppercase tracking-wider">
            <Bell className="w-3.5 h-3.5" />
            <span>Activity Feed</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Account Notifications
          </h1>
          <p className="mt-2 text-sm text-pink-50/90 leading-relaxed">
            Live updates on votes, replies, mentions, and community operations on the Hive blockchain.
          </p>
        </div>
      </div>

      {/* Category Tabs Separator */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-3 sm:p-4 border border-gray-100 dark:border-slate-800 shadow-xs mb-6">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            <span>All</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              selectedCategory === 'all' ? 'bg-rose-700 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
            }`}>
              {categoryCounts.all}
            </span>
          </button>

          <button
            onClick={() => setSelectedCategory('replies')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
              selectedCategory === 'replies'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            <MessageSquare className="w-3 h-3" />
            <span>Replies</span>
            {categoryCounts.replies > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedCategory === 'replies' ? 'bg-blue-700 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
              }`}>
                {categoryCounts.replies}
              </span>
            )}
          </button>

          <button
            onClick={() => setSelectedCategory('votes')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
              selectedCategory === 'votes'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            <Heart className="w-3 h-3" />
            <span>Votes</span>
            {categoryCounts.votes > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedCategory === 'votes' ? 'bg-rose-700 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
              }`}>
                {categoryCounts.votes}
              </span>
            )}
          </button>

          <button
            onClick={() => setSelectedCategory('mentions')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
              selectedCategory === 'mentions'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            <AtSign className="w-3 h-3" />
            <span>Mentions</span>
            {categoryCounts.mentions > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedCategory === 'mentions' ? 'bg-amber-700 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
              }`}>
                {categoryCounts.mentions}
              </span>
            )}
          </button>

          <button
            onClick={() => setSelectedCategory('follows')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
              selectedCategory === 'follows'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            <UserPlus className="w-3 h-3" />
            <span>Follows</span>
            {categoryCounts.follows > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedCategory === 'follows' ? 'bg-emerald-700 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
              }`}>
                {categoryCounts.follows}
              </span>
            )}
          </button>

          <button
            onClick={() => setSelectedCategory('reblogs')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
              selectedCategory === 'reblogs'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            <Repeat className="w-3 h-3" />
            <span>Reblogs</span>
            {categoryCounts.reblogs > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedCategory === 'reblogs' ? 'bg-purple-700 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
              }`}>
                {categoryCounts.reblogs}
              </span>
            )}
          </button>

          <button
            onClick={() => setSelectedCategory('community')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
              selectedCategory === 'community'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Community</span>
            {categoryCounts.community > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedCategory === 'community' ? 'bg-indigo-700 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
              }`}>
                {categoryCounts.community}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Notifications Feed */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 text-rose-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-800 dark:text-slate-200">
            Fetching latest notifications...
          </p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800">
          <Bell className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800 dark:text-slate-200">
            No notifications in this category
          </h3>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
            {selectedCategory === 'all'
              ? 'You do not have any notifications yet.'
              : `No activity found under "${selectedCategory}". Check other categories or refresh.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredNotifications.map((notif) => {
            const meta = getTypeMeta(notif.type);
            const Icon = meta.icon;
            const actor = extractActor(notif.msg);
            const timeAgo = formatTime(notif.date);

            return (
              <div
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                className="group p-4 bg-white dark:bg-slate-900 hover:bg-gray-50/80 dark:hover:bg-slate-800/80 rounded-2xl border border-gray-100 dark:border-slate-800 transition-all shadow-xs cursor-pointer flex items-start gap-3.5"
              >
                {/* User avatar or Type icon badge */}
                <div className="relative flex-shrink-0">
                  {actor ? (
                    <img
                      src={getHiveAvatarUrl(actor, 'small')}
                      alt={actor}
                      className="w-10 h-10 rounded-full object-cover bg-gray-100 dark:bg-slate-800 border border-gray-100 dark:border-slate-700"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center font-bold">
                      <Bell className="w-5 h-5" />
                    </div>
                  )}

                  {/* Tiny icon badge in corner */}
                  <span className={`absolute -bottom-1 -right-1 p-1 rounded-full border border-white dark:border-slate-900 ${meta.color}`}>
                    <Icon className="w-2.5 h-2.5" />
                  </span>
                </div>

                {/* Message body */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500">
                      {timeAgo}
                    </span>

                    {notif.score !== undefined && notif.score > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400">
                        Score {notif.score}
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-slate-100 mt-0.5 leading-relaxed group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                    {notif.msg}
                  </p>

                  {notif.url && (
                    <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-slate-500 mt-1 font-mono truncate">
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{notif.url}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Load More Button */}
          {hasMore && (
            <div className="pt-4 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 rounded-full text-xs font-bold text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer inline-flex items-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>Loading more notifications...</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Load More</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

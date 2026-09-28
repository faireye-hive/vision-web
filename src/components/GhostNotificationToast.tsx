import React, { useEffect, useState } from 'react';
import { Bell, Heart, MessageSquare, Repeat, UserPlus, AtSign, X, ExternalLink } from 'lucide-react';
import { HiveNotification, getHiveAvatarUrl } from '../services/hiveApi';

interface GhostNotificationToastProps {
  notification: HiveNotification | null;
  onClose: () => void;
  onClick: (notification: HiveNotification) => void;
}

export const GhostNotificationToast: React.FC<GhostNotificationToastProps> = ({
  notification,
  onClose,
  onClick
}) => {
  const [visible, setVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      if (!isHovered) {
        const timer = setTimeout(() => {
          setVisible(false);
          setTimeout(onClose, 300);
        }, 6000);
        return () => clearTimeout(timer);
      }
    } else {
      setVisible(false);
    }
  }, [notification, isHovered, onClose]);

  if (!notification || !visible) return null;

  const extractActor = (msg: string): string => {
    const match = msg.match(/@([a-z0-9\-\.]+)/i);
    return match ? match[1].toLowerCase() : '';
  };

  const actor = extractActor(notification.msg);

  const getIcon = (type: string) => {
    switch (type) {
      case 'vote':
        return <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />;
      case 'reply':
      case 'reply_comment':
        return <MessageSquare className="w-3.5 h-3.5 text-blue-500" />;
      case 'follow':
        return <UserPlus className="w-3.5 h-3.5 text-emerald-500" />;
      case 'reblog':
        return <Repeat className="w-3.5 h-3.5 text-purple-500" />;
      case 'mention':
        return <AtSign className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-indigo-500" />;
    }
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed bottom-6 right-6 z-50 max-w-sm w-full mx-4 sm:mx-0 animate-in slide-in-from-bottom-4 fade-in duration-300 pointer-events-auto"
    >
      <div
        onClick={() => {
          onClick(notification);
          setVisible(false);
          setTimeout(onClose, 200);
        }}
        className="group relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-gray-200/80 dark:border-slate-700/80 rounded-2xl p-3.5 shadow-2xl hover:shadow-blue-500/10 hover:border-blue-300 dark:hover:border-blue-600 transition cursor-pointer flex items-center gap-3"
      >
        {/* Glowing aura */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />

        {/* Actor Avatar with tiny type icon */}
        <div className="relative flex-shrink-0">
          {actor ? (
            <img
              src={getHiveAvatarUrl(actor, 'small')}
              alt={actor}
              className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-slate-700"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center">
              <Bell className="w-4 h-4 text-rose-500" />
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 p-0.5 bg-white dark:bg-slate-900 rounded-full shadow-xs">
            {getIcon(notification.type)}
          </span>
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-black tracking-wider text-rose-500 dark:text-rose-400">
              New Activity
            </span>
          </div>
          <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 line-clamp-2 mt-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition leading-snug">
            {notification.msg}
          </p>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setVisible(false);
            setTimeout(onClose, 200);
          }}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer flex-shrink-0"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

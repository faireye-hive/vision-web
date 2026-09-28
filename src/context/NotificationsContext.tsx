import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { HiveNotification, getAccountNotifications } from '../services/hiveApi';
import { useAuth } from './AuthContext';

export const LAST_READ_NOTIF_KEY = 'hive_last_read_notif_id';

function notificationId(id: string | number): number {
  const value = Number(id);
  return Number.isFinite(value) ? value : 0;
}

/** Count notifications newer than the id stored when the inbox was opened. */
export function countUnreadNotifications(notifs: Array<{ id: string | number }>): number {
  let lastRead = '';
  try {
    lastRead = localStorage.getItem(LAST_READ_NOTIF_KEY) || '';
  } catch {
    lastRead = '';
  }
  if (!lastRead) return notifs.length;

  const lastNum = notificationId(lastRead);
  if (lastNum <= 0) {
    return notifs.filter((item) => String(item.id) !== lastRead).length;
  }
  return notifs.reduce((count, item) => (notificationId(item.id) > lastNum ? count + 1 : count), 0);
}

interface NotificationsContextType {
  unreadCount: number;
  ghostNotification: HiveNotification | null;
  dismissGhost: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [ghostNotification, setGhostNotification] = useState<HiveNotification | null>(null);
  const prevTopIdRef = useRef('');

  const checkNotifications = useCallback(async () => {
    if (!currentUser?.username) {
      setUnreadCount(0);
      prevTopIdRef.current = '';
      return;
    }

    try {
      const notifs = await getAccountNotifications(currentUser.username, 15);
      if (!notifs || notifs.length === 0) {
        setUnreadCount(0);
        return;
      }

      setUnreadCount(countUnreadNotifications(notifs));
      const top = notifs[0];
      const topId = String(top.id);
      const topIsUnread = countUnreadNotifications([top]) > 0;
      if (prevTopIdRef.current && topId !== prevTopIdRef.current && topIsUnread) {
        setGhostNotification(top);
      }
      prevTopIdRef.current = topId;
    } catch {
      // Non-critical network check.
    }
  }, [currentUser?.username]);

  useEffect(() => {
    checkNotifications();
    const interval = window.setInterval(checkNotifications, 45000);
    return () => window.clearInterval(interval);
  }, [checkNotifications]);

  useEffect(() => {
    const onCleared = () => {
      setUnreadCount(0);
      setGhostNotification(null);
    };
    window.addEventListener('nebulosa:notifications_cleared', onCleared);
    return () => window.removeEventListener('nebulosa:notifications_cleared', onCleared);
  }, []);

  const dismissGhost = useCallback(() => setGhostNotification(null), []);

  const value = useMemo(
    () => ({ unreadCount, ghostNotification, dismissGhost }),
    [unreadCount, ghostNotification, dismissGhost]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextType {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}

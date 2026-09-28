import { useCallback } from 'react';
import { HiveNotification } from '../services/hiveApi';
import { useNavigation } from '../context/NavigationContext';
import { useNotifications } from '../context/NotificationsContext';
import { GhostNotificationToast } from './GhostNotificationToast';

/**
 * Owns the toast subscription so a new notification does not re-render the feed.
 * onClose stays stable, which lets the toast actually dismiss itself.
 */
export function NotificationToastHost() {
  const { ghostNotification, dismissGhost } = useNotifications();
  const { handleOpenNotificationPost, openNotificationsPage } = useNavigation();

  const handleClick = useCallback((notif: HiveNotification) => {
    dismissGhost();
    if (notif.url) {
      const clean = notif.url.replace(/^@/, '');
      const parts = clean.split('/');
      if (parts.length >= 2) {
        handleOpenNotificationPost(parts[0], parts.slice(1).join('/'));
        return;
      }
    }
    openNotificationsPage();
  }, [dismissGhost, handleOpenNotificationPost, openNotificationsPage]);

  return (
    <GhostNotificationToast
      notification={ghostNotification}
      onClose={dismissGhost}
      onClick={handleClick}
    />
  );
}

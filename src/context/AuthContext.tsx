import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { CurrentUser, KeychainService } from '../services/keychain';
import { getFollowing, getMutedAccounts, getSubscriptions } from '../services/hiveApi';

export interface AuthContextType {
  currentUser: CurrentUser | null;
  setCurrentUser: (user: CurrentUser | null) => void;
  login: (user: CurrentUser) => void;
  logout: () => void;
  followingUsersList: string[];
  setFollowingUsersList: React.Dispatch<React.SetStateAction<string[]>>;
  refreshFollowing: () => Promise<void>;
  isFollowing: (username: string) => boolean;
  mutedUsersList: string[];
  setMutedUsersList: React.Dispatch<React.SetStateAction<string[]>>;
  refreshMuted: () => Promise<void>;
  isMuted: (username: string) => boolean;
  toggleMuteUser: (username: string) => Promise<string | null>;
  joinedCommunities: Record<string, boolean>;
  setCommunitySubscription: (communityName: string, subscribed: boolean) => void;
  toggleJoinCommunity: (communityName: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    return KeychainService.getCurrentUser();
  });

  const [followingUsersList, setFollowingUsersList] = useState<string[]>([]);
  const [mutedUsersList, setMutedUsersList] = useState<string[]>([]);
  const [joinedCommunities, setJoinedCommunities] = useState<Record<string, boolean>>({});

  const refreshFollowing = useCallback(async () => {
    if (!currentUser?.username) {
      setFollowingUsersList([]);
      return;
    }
    try {
      const users = await getFollowing(currentUser.username, '', 100);
      setFollowingUsersList(users || []);
    } catch {
      setFollowingUsersList([]);
    }
  }, [currentUser?.username]);

  const refreshMuted = useCallback(async () => {
    if (!currentUser?.username) {
      setMutedUsersList([]);
      return;
    }
    try {
      const list = await getMutedAccounts(currentUser.username, true);
      setMutedUsersList(list || []);
    } catch {
      setMutedUsersList([]);
    }
  }, [currentUser?.username]);

  useEffect(() => {
    refreshFollowing();
    refreshMuted();
  }, [refreshFollowing, refreshMuted]);

  useEffect(() => {
    if (!currentUser?.username) {
      setJoinedCommunities({});
      return;
    }
    let mounted = true;
    getSubscriptions(currentUser.username, true)
      .then((rows) => {
        if (!mounted) return;
        const next: Record<string, boolean> = {};
        rows.forEach(([name]) => {
          if (name) next[name] = true;
        });
        setJoinedCommunities(next);
      })
      .catch(() => {
        if (mounted) setJoinedCommunities({});
      });
    return () => {
      mounted = false;
    };
  }, [currentUser?.username]);

  const login = useCallback((user: CurrentUser) => {
    KeychainService.saveCurrentUser(user);
    setCurrentUser(user);
  }, []);

  const logout = useCallback(() => {
    KeychainService.logout();
    setCurrentUser(null);
    setFollowingUsersList([]);
    setMutedUsersList([]);
    setJoinedCommunities({});
  }, []);

  const isFollowing = useCallback(
    (username: string) => {
      const clean = username.trim().toLowerCase().replace(/^@/, '');
      return followingUsersList.some((u) => u.toLowerCase() === clean);
    },
    [followingUsersList]
  );

  const isMuted = useCallback(
    (username: string) => {
      const clean = username.trim().toLowerCase().replace(/^@/, '');
      return mutedUsersList.some((u) => u.toLowerCase() === clean);
    },
    [mutedUsersList]
  );

  const toggleMuteUser = useCallback(
    async (targetUsername: string) => {
      if (!currentUser) {
        window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
        return 'Connect Hive Keychain to mute on chain.';
      }
      const clean = targetUsername.trim().toLowerCase().replace(/^@/, '');
      const currentlyMuted = isMuted(clean);
      const nextMute = !currentlyMuted;
      const response = await KeychainService.muteUser(currentUser.username, clean, nextMute);
      if (!response.success) {
        return response.message || response.error || 'Hive did not accept mute operation.';
      }
      setMutedUsersList((prev) =>
        nextMute ? [...prev, clean] : prev.filter((u) => u.toLowerCase() !== clean)
      );
      return null;
    },
    [currentUser, isMuted]
  );

  const setCommunitySubscription = useCallback((communityName: string, subscribed: boolean) => {
    setJoinedCommunities((prev) => ({ ...prev, [communityName]: subscribed }));
  }, []);

  const toggleJoinCommunity = useCallback(
    async (communityName: string) => {
      if (!currentUser) {
        window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
        return 'Connect Hive Keychain to subscribe on chain.';
      }
      const next = !joinedCommunities[communityName];
      const response = await KeychainService.subscribeCommunity(currentUser.username, communityName, next);
      if (!response.success) {
        return response.message || response.error || 'Hive did not accept this subscription.';
      }
      setCommunitySubscription(communityName, next);
      return null;
    },
    [currentUser, joinedCommunities, setCommunitySubscription]
  );

  const value = useMemo(
    () => ({
      currentUser,
      setCurrentUser,
      login,
      logout,
      followingUsersList,
      setFollowingUsersList,
      refreshFollowing,
      isFollowing,
      mutedUsersList,
      setMutedUsersList,
      refreshMuted,
      isMuted,
      toggleMuteUser,
      joinedCommunities,
      setCommunitySubscription,
      toggleJoinCommunity,
    }),
    [
      currentUser,
      login,
      logout,
      followingUsersList,
      refreshFollowing,
      isFollowing,
      mutedUsersList,
      refreshMuted,
      isMuted,
      toggleMuteUser,
      joinedCommunities,
      setCommunitySubscription,
      toggleJoinCommunity,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

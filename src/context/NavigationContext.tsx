import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HivePost, HiveNotification, getDiscussion, getPost, getAccountNotifications } from '../services/hiveApi';
import { PostHeading } from '../utils/sanitize';
import { useAuth } from './AuthContext';

export type NavTab = 'feed' | 'discover' | 'shorts' | 'communities';
export type SortOption = 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted';
export type StandalonePage = 'write' | 'profile' | 'explore' | 'manage' | 'following' | 'notifications';

export interface NavigationContextType {
  activeNav: NavTab;
  setActiveNav: (tab: NavTab) => void;
  handleNavChange: (tab: NavTab) => void;
  sort: SortOption;
  setSort: (sort: SortOption) => void;
  tag: string;
  setTag: (tag: string) => void;
  communitySubTopic: string;
  setCommunitySubTopic: (topic: string) => void;
  feedAuthor: string | null;
  setFeedAuthor: React.Dispatch<React.SetStateAction<string | null>>;
  authorFeedMode: 'posts' | 'comments';
  setAuthorFeedMode: React.Dispatch<React.SetStateAction<'posts' | 'comments'>>;
  handleSelectAuthor: (author: string) => void;
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  standalonePage: StandalonePage | null;
  profileUser: string | null;
  openStandalonePage: (page: StandalonePage, user?: string) => void;
  closeStandalonePage: () => void;
  openAuthorProfile: (username: string) => void;
  openCommunity: (communityName: string) => void;
  openWritePage: () => void;
  openFollowingManager: () => void;
  openNotificationsPage: () => void;
  openCommunitiesModal: () => void;
  openManageCommunitiesModal: () => void;
  selectedPost: HivePost | null;
  setSelectedPost: (post: HivePost | null) => void;
  postHeadings: PostHeading[];
  setPostHeadings: React.Dispatch<React.SetStateAction<PostHeading[]>>;
  handleSelectPost: (post: HivePost, pushHistory?: boolean, jumpToComments?: boolean) => void;
  handleClosePost: () => void;
  handleSelectHeading: (id: string) => void;
  handleOpenNotificationPost: (author: string, permlink: string) => Promise<void>;
  showStatsModal: boolean;
  setShowStatsModal: (show: boolean) => void;
  openStatsModal: () => void;
  showContentFilterModal: boolean;
  setShowContentFilterModal: (show: boolean) => void;
  openContentFilterModal: () => void;
  unreadNotifsCount: number;
  setUnreadNotifsCount: React.Dispatch<React.SetStateAction<number>>;
  ghostNotification: HiveNotification | null;
  setGhostNotification: React.Dispatch<React.SetStateAction<HiveNotification | null>>;
  feedScrollPositionRef: React.MutableRefObject<number>;
  saveScrollPosition: () => void;
  restoreScrollPosition: () => void;
  goBack: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeNav, setActiveNav] = useState<NavTab>('discover');
  const [sort, setSort] = useState<SortOption>('hot');
  const [tag, setTag] = useState<string>('');
  const [feedAuthor, setFeedAuthor] = useState<string | null>(null);
  const [authorFeedMode, setAuthorFeedMode] = useState<'posts' | 'comments'>('posts');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('global');

  const [standalonePage, setStandalonePage] = useState<StandalonePage | null>(null);
  const [profileUser, setProfileUser] = useState<string | null>(null);

  const [selectedPost, setSelectedPost] = useState<HivePost | null>(null);
  const [postHeadings, setPostHeadings] = useState<PostHeading[]>([]);

  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showContentFilterModal, setShowContentFilterModal] = useState<boolean>(false);

  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);
  const [ghostNotification, setGhostNotification] = useState<HiveNotification | null>(null);
  const prevTopNotifIdRef = useRef<string>('');

  const [communitySubTopic, setCommunitySubTopic] = useState<string>('');
  const feedScrollPositionRef = useRef<number>(0);

  // Sync state with React Router location.pathname & search
  useEffect(() => {
    const pathname = location.pathname;
    const searchParams = new URLSearchParams(location.search);

    // Parse sort
    const querySort = searchParams.get('sort') as SortOption | null;
    if (querySort && ['trending', 'hot', 'created', 'payout', 'muted', 'promoted'].includes(querySort)) {
      setSort(querySort);
    }

    // Parse subtopic
    const queryTopic = searchParams.get('topic');
    if (queryTopic) {
      setCommunitySubTopic(queryTopic);
    }

    // Community path: /c/:community
    if (pathname.startsWith('/c/')) {
      const comm = pathname.replace('/c/', '').trim().toLowerCase();
      setActiveNav('communities');
      setTag(comm);
      setStandalonePage(null);
      setSelectedPost(null);
      return;
    }

    // Topic tag path: /tag/:tag
    if (pathname.startsWith('/tag/')) {
      const topicTag = pathname.replace('/tag/', '').trim().toLowerCase();
      setActiveNav('discover');
      setTag(topicTag);
      setStandalonePage(null);
      setSelectedPost(null);
      return;
    }

    // Snap/Short Detail path: /shorts/@author/permlink
    if (pathname.startsWith('/shorts/@')) {
      const parts = pathname.split('/');
      if (parts.length >= 3) {
        const author = parts[2].replace('@', '');
        const permlink = parts[3];
        setActiveNav('shorts');
        
        // Instant load from router state if available
        const stateSnap = (location.state as any)?.snap;
        if (stateSnap && (!selectedPost || selectedPost.permlink !== permlink)) {
          setSelectedPost(stateSnap);
        }

        if (!selectedPost || selectedPost.author !== author || selectedPost.permlink !== permlink) {
          getDiscussion(author, permlink, false, currentUser?.username || '')
            .then((disc) => {
              const root = disc[`${author}/${permlink}`] || Object.values(disc)[0];
              if (root) setSelectedPost(root);
            })
            .catch(() => {});
        }
        setStandalonePage(null);
        return;
      }
    }

    // Post path: /post/:author/:permlink
    if (pathname.startsWith('/post/')) {
      const segments = pathname.replace('/post/', '').split('/');
      if (segments.length >= 2) {
        const cleanAuthor = segments[0].replace(/^@/, '');
        const cleanPermlink = segments.slice(1).join('/');

        // Only fetch if not already selected
        if (!selectedPost || selectedPost.author !== cleanAuthor || selectedPost.permlink !== cleanPermlink) {
          getDiscussion(cleanAuthor, cleanPermlink, false, currentUser?.username || '')
            .then((disc) => {
              const root = disc[`${cleanAuthor}/${cleanPermlink}`] || Object.values(disc)[0];
              if (root) {
                setSelectedPost(root);
              }
            })
            .catch((err) => {
              console.error('Failed to load post from route:', err);
            });
        }
        setStandalonePage(null);
        return;
      }
    }

    // Profile path: /profile/:username
    if (pathname.startsWith('/profile/')) {
      const username = pathname.replace('/profile/', '').replace(/^@/, '').trim();
      setProfileUser(username);
      setStandalonePage('profile');
      setSelectedPost(null);
      return;
    }

    // Other standalone routes
    if (pathname === '/write') {
      setStandalonePage('write');
      setSelectedPost(null);
      return;
    }

    if (pathname === '/notifications') {
      setStandalonePage('notifications');
      setSelectedPost(null);
      return;
    }

    if (pathname === '/following') {
      setStandalonePage('following');
      setSelectedPost(null);
      return;
    }

    if (pathname === '/communities') {
      setActiveNav('communities');
      const tabParam = searchParams.get('tab');
      
      // If explicit tab is provided, show standalone page.
      // Otherwise, show the feed (standalonePage = null).
      if (tabParam === 'manage') {
        setStandalonePage('manage');
      } else if (tabParam === 'explore') {
        setStandalonePage('explore');
      } else {
        setStandalonePage(null);
      }
      
      setSelectedPost(null);
      return;
    }

    // Primary Feed / Discover / Shorts tabs
    if (pathname === '/shorts') {
      setActiveNav('shorts');
      setStandalonePage(null);
      setSelectedPost(null);
      return;
    }

    if (pathname === '/feed') {
      setActiveNav('feed');
      setTag('');
      setStandalonePage(null);
      setSelectedPost(null);
      return;
    }

    if (pathname === '/discover' || pathname === '/') {
      setActiveNav('discover');
      const qTag = searchParams.get('tag');
      setTag(qTag ? qTag.trim().toLowerCase() : '');
      setStandalonePage(null);
      setSelectedPost(null);
      return;
    }
  }, [location.pathname, location.search, currentUser?.username]);

  // Notifications checking interval
  const checkNotifications = useCallback(async () => {
    if (!currentUser?.username) {
      setUnreadNotifsCount(0);
      return;
    }
    try {
      const notifs = await getAccountNotifications(currentUser.username, 15);
      if (notifs && notifs.length > 0) {
        setUnreadNotifsCount(notifs.length);
        const topNotif = notifs[0];
        if (prevTopNotifIdRef.current && topNotif.id !== prevTopNotifIdRef.current) {
          setGhostNotification(topNotif);
        }
        prevTopNotifIdRef.current = topNotif.id;
      }
    } catch {
      // Non-critical network check
    }
  }, [currentUser?.username]);

  useEffect(() => {
    checkNotifications();
    const interval = setInterval(checkNotifications, 45000);
    return () => clearInterval(interval);
  }, [checkNotifications]);

  // Navigation handlers
  const handleNavChange = useCallback((tab: NavTab) => {
    setActiveNav(tab);
    setFeedAuthor(null);
    setSelectedPost(null);
    setStandalonePage(null);
    setCommunitySubTopic('');

    if (tab === 'feed') {
      setTag('');
      navigate('/feed');
    } else if (tab === 'discover') {
      setTag('');
      navigate('/discover');
    } else if (tab === 'shorts') {
      navigate('/shorts');
    } else if (tab === 'communities') {
      setTag('');
      setStandalonePage(null);
      navigate('/communities');
    }
  }, [navigate]);

  const openCommunity = useCallback((communityName: string) => {
    const clean = communityName.trim().toLowerCase();
    setTag(clean);
    setActiveNav('communities');
    setStandalonePage(null);
    setSelectedPost(null);
    setCommunitySubTopic('');
    navigate(`/c/${clean}`);
  }, [navigate]);

  const openStandalonePage = useCallback((page: StandalonePage, user?: string) => {
    setStandalonePage(page);
    setSelectedPost(null);
    if (page === 'profile') {
      const u = (user || currentUser?.username || '').replace(/^@/, '');
      setProfileUser(u);
      navigate(`/profile/@${u}`);
    } else if (page === 'write') {
      navigate('/write');
    } else if (page === 'notifications') {
      navigate('/notifications');
    } else if (page === 'following') {
      navigate('/following');
    } else if (page === 'explore') {
      navigate('/communities?tab=explore');
    } else if (page === 'manage') {
      navigate('/communities?tab=manage');
    }
  }, [currentUser?.username, navigate]);

  const closeStandalonePage = useCallback(() => {
    setStandalonePage(null);
    setProfileUser(null);
    if (activeNav === 'communities') {
      if (tag && tag.startsWith('hive-')) {
        navigate(`/c/${tag}`);
      } else {
        navigate('/discover');
      }
    } else {
      navigate(`/${activeNav}`);
    }
  }, [activeNav, tag, navigate]);

  const openAuthorProfile = useCallback((username: string) => {
    const clean = username.trim().replace(/^@/, '');
    openStandalonePage('profile', clean);
  }, [openStandalonePage]);

  const openWritePage = useCallback(() => {
    openStandalonePage('write');
  }, [openStandalonePage]);

  const openFollowingManager = useCallback(() => {
    openStandalonePage('following');
  }, [openStandalonePage]);

  const openNotificationsPage = useCallback(() => {
    openStandalonePage('notifications');
  }, [openStandalonePage]);

  const openCommunitiesModal = useCallback(() => {
    openStandalonePage('explore');
  }, [openStandalonePage]);

  const openManageCommunitiesModal = useCallback(() => {
    openStandalonePage('manage');
  }, [openStandalonePage]);

  const saveScrollPosition = useCallback(() => {
    feedScrollPositionRef.current = window.scrollY;
  }, []);

  const restoreScrollPosition = useCallback(() => {
    // Small delay to ensure the DOM has settled after closing post
    setTimeout(() => {
      window.scrollTo({ top: feedScrollPositionRef.current, behavior: 'auto' });
    }, 50);
  }, []);

  const handleSelectPost = useCallback((post: HivePost, pushHistory = true, jumpToComments = false) => {
    saveScrollPosition();
    setSelectedPost(post);
    setStandalonePage(null);
    navigate(`/post/@${post.author}/${post.permlink}${jumpToComments ? '#comments' : ''}`);
  }, [navigate, saveScrollPosition]);

  const handleClosePost = useCallback(() => {
    setSelectedPost(null);
    setPostHeadings([]);

    const queryParams = new URLSearchParams();
    if (sort !== 'hot') queryParams.set('sort', sort);
    if (communitySubTopic) queryParams.set('topic', communitySubTopic);
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    if (activeNav === 'communities' && tag) {
      navigate(`/c/${tag}${queryString}`);
    } else if (activeNav === 'discover' && tag) {
      navigate(`/tag/${tag}${queryString}`);
    } else {
      navigate(`/${activeNav}${queryString}`);
    }
  }, [activeNav, tag, sort, communitySubTopic, navigate]);

  const handleSelectHeading = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -80;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, []);

  const handleSelectAuthor = useCallback((author: string) => {
    const clean = author.trim().replace(/^@/, '').toLowerCase();
    
    if (activeNav === 'feed') {
      // Toggle filter on Feed page
      setFeedAuthor(prev => prev?.toLowerCase() === clean ? null : clean);
      setAuthorFeedMode('posts');
    } else {
      // Open profile on other pages
      openAuthorProfile(clean);
    }
  }, [activeNav, openAuthorProfile, setFeedAuthor, setAuthorFeedMode]);

  const handleOpenNotificationPost = useCallback(async (author: string, permlink: string) => {
    const cleanAuthor = author.replace(/^@/, '').trim();
    const cleanPermlink = permlink.trim();
    navigate(`/post/@${cleanAuthor}/${cleanPermlink}`);
  }, [navigate]);

  const openStatsModal = useCallback(() => setShowStatsModal(true), []);
  const openContentFilterModal = useCallback(() => setShowContentFilterModal(true), []);
  const goBack = useCallback(() => navigate(-1), [navigate]);

  return (
    <NavigationContext.Provider
      value={{
        activeNav,
        setActiveNav,
        handleNavChange,
        sort,
        setSort,
        tag,
        setTag,
        communitySubTopic,
        setCommunitySubTopic,
        feedAuthor,
        setFeedAuthor,
        authorFeedMode,
        setAuthorFeedMode,
        handleSelectAuthor,
        selectedLanguage,
        setSelectedLanguage,
        standalonePage,
        profileUser,
        openStandalonePage,
        closeStandalonePage,
        openAuthorProfile,
        openCommunity,
        openWritePage,
        openFollowingManager,
        openNotificationsPage,
        openCommunitiesModal,
        openManageCommunitiesModal,
        selectedPost,
        setSelectedPost,
        postHeadings,
        setPostHeadings,
        handleSelectPost,
        handleClosePost,
        handleSelectHeading,
        handleOpenNotificationPost,
        showStatsModal,
        setShowStatsModal,
        openStatsModal,
        showContentFilterModal,
        setShowContentFilterModal,
        openContentFilterModal,
        unreadNotifsCount,
        setUnreadNotifsCount,
        ghostNotification,
        setGhostNotification,
        feedScrollPositionRef,
        saveScrollPosition,
        restoreScrollPosition,
        goBack
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextType {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

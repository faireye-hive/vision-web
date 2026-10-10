import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HivePost, getPost } from '../services/hiveApi';
import { PostHeading } from '../utils/sanitize';
import { useAuth } from './AuthContext';

export type NavTab = 'feed' | 'discover' | 'shorts' | 'communities';
export type SortOption = 'recommend' | 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted';
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
  feedScrollPositionRef: React.MutableRefObject<number>;
  saveScrollPosition: () => void;
  restoreScrollPosition: () => void;
  goBack: () => void;
  feedLayoutMode: FeedLayoutMode;
  setFeedLayoutMode: (mode: FeedLayoutMode) => void;
}

export type FeedLayoutMode = 'list' | 'gallery';

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeNav, setActiveNav] = useState<NavTab>('discover');
  const [sort, setSort] = useState<SortOption>('hot');
  const [tag, setTagState] = useState<string>('');
  const [feedAuthor, setFeedAuthor] = useState<string | null>(null);
  const [authorFeedMode, setAuthorFeedMode] = useState<'posts' | 'comments'>('posts');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('global');

  const [standalonePage, setStandalonePage] = useState<StandalonePage | null>(null);
  const [profileUser, setProfileUser] = useState<string | null>(null);

  const [selectedPost, setSelectedPost] = useState<HivePost | null>(null);
  const [postHeadings, setPostHeadings] = useState<PostHeading[]>([]);

  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showContentFilterModal, setShowContentFilterModal] = useState<boolean>(false);

  const [feedLayoutMode, setFeedLayoutModeState] = useState<FeedLayoutMode>(() => {
    try {
      return (localStorage.getItem('nebulosa_feed_layout') as FeedLayoutMode) || 'list';
    } catch {
      return 'list';
    }
  });

  const setFeedLayoutMode = useCallback((mode: FeedLayoutMode) => {
    setFeedLayoutModeState(mode);
    try {
      localStorage.setItem('nebulosa_feed_layout', mode);
    } catch {}
  }, []);

  const [communitySubTopic, setCommunitySubTopic] = useState<string>('');
  const feedScrollPositionRef = useRef<number>(0);
  const selectedPostRef = useRef<HivePost | null>(null);
  const routeRequestRef = useRef(0);
  const activeNavRef = useRef<NavTab>(activeNav);
  activeNavRef.current = activeNav;
  const openedPostInAppRef = useRef<boolean>(false);
  selectedPostRef.current = selectedPost;
  const tagRef = useRef<string>(tag);
  tagRef.current = tag;

  // Custom setTag handler: updates tag state and reflects topic tags in the URL so browser back/forward and refresh maintain the selected category
  const setTag = useCallback(
    (newTag: string | ((prev: string) => string)) => {
      const resolved = typeof newTag === 'function' ? newTag(tagRef.current) : newTag;
      const clean = (resolved || '').trim().toLowerCase();

      tagRef.current = clean;
      setTagState(clean);

      // If a post is currently open and a tag is clicked, mark that we shouldn't simply go back in history
      if (selectedPostRef.current) {
        openedPostInAppRef.current = false;
        return;
      }

      const currentPath = location.pathname;
      const isDiscoverContext =
        activeNavRef.current === 'discover' ||
        (activeNavRef.current !== 'communities' &&
          activeNavRef.current !== 'feed' &&
          activeNavRef.current !== 'shorts' &&
          (currentPath === '/' || currentPath === '/discover' || currentPath.startsWith('/tag/')));

      if (isDiscoverContext) {
        const queryParams = new URLSearchParams(location.search);
        queryParams.delete('tag');
        const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
        const targetPath = clean ? `/tag/${clean}` : '/discover';
        const targetUrl = `${targetPath}${queryString}`;

        if (currentPath !== targetPath) {
          navigate(targetUrl, { replace: false });
        }
      }
    },
    [location.pathname, location.search, navigate]
  );

  // Sync state with React Router location.pathname & search
  useEffect(() => {
    let cancelled = false;
    const requestId = ++routeRequestRef.current;
    const pathname = location.pathname;
    const searchParams = new URLSearchParams(location.search);

    // Parse sort. Absent sort keeps the in-memory choice from the navbar.
    const querySort = searchParams.get('sort') as SortOption | null;
    if (querySort && ['recommend', 'trending', 'hot', 'created', 'payout', 'muted', 'promoted'].includes(querySort)) {
      setSort(querySort);
    }

    const syncTopic = () => {
      setCommunitySubTopic(searchParams.get('topic') || '');
    };

    const release = () => {
      cancelled = true;
    };

    const loadShell = (author: string, permlink: string) => {
      const current = selectedPostRef.current;
      const isCompletePost = Boolean(
        current &&
        typeof current.body === 'string' &&
        current.body.trim().length > 300 &&
        !current.is_truncated &&
        !current.from_recommendation &&
        !(current.body.length <= 250 && (current.body.endsWith('...') || current.body.endsWith('…')))
      );
      const alreadyOpen = Boolean(
        current &&
        current.author.replace(/^@/, '').toLowerCase() === author.toLowerCase() &&
        current.permlink === permlink &&
        isCompletePost
      );
      if (alreadyOpen) return;

      getPost(author, permlink, currentUser?.username || '')
        .then((post) => {
          if (cancelled || requestId !== routeRequestRef.current || !post) return;
          setSelectedPost(post);
        })
        .catch((err) => {
          if (!cancelled) console.error('Failed to load post from route:', err);
        });
    };

    // Community path: /c/:community
    if (pathname.startsWith('/c/')) {
      const comm = decodeURIComponent(pathname.replace(/^\/c\//, '').replace(/\/+$/, '').trim().toLowerCase());
      setActiveNav('communities');
      setTagState(comm);
      tagRef.current = comm;
      syncTopic();
      setStandalonePage(null);
      setSelectedPost(null);
      return release;
    }

    // Topic tag path: /tag/:tag
    if (pathname.startsWith('/tag/')) {
      const topicTag = decodeURIComponent(pathname.replace(/^\/tag\//, '').replace(/\/+$/, '').trim().toLowerCase());
      setActiveNav('discover');
      setTagState(topicTag);
      tagRef.current = topicTag;
      syncTopic();
      setStandalonePage(null);
      setSelectedPost(null);
      return release;
    }

    // Snap/Short Detail path: /shorts/@author/permlink
    if (pathname.startsWith('/shorts/@')) {
      const parts = pathname.split('/');
      if (parts.length >= 4 && parts[3]) {
        const author = parts[2].replace('@', '');
        const permlink = parts[3];
        setActiveNav('shorts');
        setStandalonePage(null);
        openedPostInAppRef.current = true;

        const stateSnap = (location.state as { snap?: HivePost } | null)?.snap;
        const snapMatches = Boolean(
          stateSnap &&
          stateSnap.permlink === permlink &&
          stateSnap.author.replace(/^@/, '') === author
        );
        if (snapMatches && stateSnap) {
          const current = selectedPostRef.current;
          if (!current || current.permlink !== permlink || current.author.replace(/^@/, '') !== author) {
            setSelectedPost(stateSnap);
          }
        } else {
          loadShell(author, permlink);
        }
        return release;
      }
    }

    // Post path: /post/:author/:permlink
    if (pathname.startsWith('/post/')) {
      const segments = pathname.replace('/post/', '').split('/');
      if (segments.length >= 2) {
        const cleanAuthor = segments[0].replace(/^@/, '');
        const cleanPermlink = segments.slice(1).join('/');
        setStandalonePage(null);
        loadShell(cleanAuthor, cleanPermlink);
        return release;
      }
    }

    // Profile path: /profile/:username
    if (pathname.startsWith('/profile/')) {
      const username = pathname.replace('/profile/', '').replace(/^@/, '').trim();
      setProfileUser(username);
      setStandalonePage('profile');
      setSelectedPost(null);
      return release;
    }

    // Other standalone routes
    if (pathname === '/write') {
      setStandalonePage('write');
      setSelectedPost(null);
      return release;
    }

    if (pathname === '/notifications') {
      setStandalonePage('notifications');
      setSelectedPost(null);
      return release;
    }

    if (pathname === '/following') {
      setStandalonePage('following');
      setSelectedPost(null);
      return release;
    }

    if (pathname === '/communities') {
      setActiveNav('communities');
      const tabParam = searchParams.get('tab');
      syncTopic();

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
      return release;
    }

    // Primary Feed / Discover / Shorts tabs
    if (pathname === '/shorts') {
      setActiveNav('shorts');
      setStandalonePage(null);
      // Closes the snap on browser back. A second null write does not
      // re-run the scroll unlock in ShortsPage.
      setSelectedPost(null);
      return release;
    }

    if (pathname === '/feed') {
      setActiveNav('feed');
      setTagState('');
      tagRef.current = '';
      setCommunitySubTopic('');
      setStandalonePage(null);
      setSelectedPost(null);
      return release;
    }

    if (pathname === '/discover' || pathname === '/') {
      setActiveNav('discover');
      const qTag = searchParams.get('tag');
      const tagVal = qTag ? qTag.trim().toLowerCase() : '';
      setTagState(tagVal);
      tagRef.current = tagVal;
      syncTopic();
      setStandalonePage(null);
      setSelectedPost(null);
      return release;
    }

    return release;
  }, [location.pathname, location.search, location.state, currentUser?.username]);

  // Navigation handlers
  const handleNavChange = useCallback((tab: NavTab) => {
    setActiveNav(tab);
    setFeedAuthor(null);
    setSelectedPost(null);
    setStandalonePage(null);
    setCommunitySubTopic('');

    if (tab === 'feed') {
      setTagState('');
      tagRef.current = '';
      navigate('/feed');
    } else if (tab === 'discover') {
      setTagState('');
      tagRef.current = '';
      navigate('/discover');
    } else if (tab === 'shorts') {
      navigate('/shorts');
    } else if (tab === 'communities') {
      setTagState('');
      tagRef.current = '';
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
    openedPostInAppRef.current = true;
    navigate(`/post/@${post.author}/${post.permlink}${jumpToComments ? '#comments' : ''}`);

    // If the post was passed with an incomplete or truncated body (e.g. HiveSense snippet or from recommendation),
    // fetch the complete authoritative full post from Hive RPC blockchain so the reader renders the entire article:
    if (
      !post.body ||
      post.is_truncated ||
      post.from_recommendation ||
      post.body.trim().length <= 300 ||
      (post.body.length <= 250 && (post.body.endsWith('...') || post.body.endsWith('…')))
    ) {
      getPost(post.author, post.permlink, currentUser?.username || '', true)
        .then((fullPost) => {
          if (fullPost && fullPost.body && fullPost.body.trim().length > 0) {
            setSelectedPost({ ...fullPost, is_truncated: false, from_recommendation: false });
          }
        })
        .catch((err) => console.error('Failed to fetch full post for selected post:', err));
    }
  }, [navigate, saveScrollPosition, currentUser?.username]);

  const handleClosePost = useCallback(() => {
    setSelectedPost(null);
    setPostHeadings([]);

    if (activeNav === 'shorts') {
      openedPostInAppRef.current = false;
      navigate('/shorts');
      return;
    }

    // If the post was opened from within this application session, popping history
    // returns to the exact prior view (preserving active category tag, query params, and scroll position):
    if (openedPostInAppRef.current && window.history.length > 1) {
      openedPostInAppRef.current = false;
      navigate(-1);
      restoreScrollPosition();
      return;
    }
    openedPostInAppRef.current = false;

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

    // Restore scroll position for non-shorts tabs
    restoreScrollPosition();
  }, [activeNav, tag, sort, communitySubTopic, navigate, restoreScrollPosition]);

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

  const value = useMemo<NavigationContextType>(() => ({
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
    feedScrollPositionRef,
    saveScrollPosition,
    restoreScrollPosition,
    goBack,
    feedLayoutMode,
    setFeedLayoutMode
  }), [
    activeNav,
    handleNavChange,
    sort,
    tag,
    communitySubTopic,
    feedAuthor,
    authorFeedMode,
    handleSelectAuthor,
    selectedLanguage,
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
    postHeadings,
    handleSelectPost,
    handleClosePost,
    handleSelectHeading,
    handleOpenNotificationPost,
    showStatsModal,
    openStatsModal,
    showContentFilterModal,
    openContentFilterModal,
    saveScrollPosition,
    restoreScrollPosition,
    goBack,
    feedLayoutMode,
    setFeedLayoutMode
  ]);

  return (
    <NavigationContext.Provider value={value}>
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

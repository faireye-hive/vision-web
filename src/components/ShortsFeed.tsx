import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sparkles,
  RefreshCw,
  Search,
  MessageCircle,
  Clock,
  ArrowDown,
  Layers,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Send,
  Image,
  Hash,
  AlertCircle,
  X,
  EyeOff,
  Check,
  Compass,
  Users,
  Reply,
  SlidersHorizontal
} from 'lucide-react';
import { HivePost, getHiveAvatarUrl } from '../services/hiveApi';
import { CurrentUser, KeychainService } from '../services/keychain';
import { ShortCard } from './ShortCard';
import { useNavigation } from '../context/NavigationContext';
import {
  getPeakSnapsContainers,
  getContainerSnaps,
  PeakSnapsContainer,
  loadFollowingSnaps,
  loadRepliesToAccount,
  MAX_CONTAINER_AGE_MS
} from '../services/shortsApi';
import {
  getCachedShortsFeed,
  setCachedShortsFeed,
  getCachedShorts,
  setCachedShorts
} from '../services/shortsCache';
import { ShortsSource } from '../hooks/useShortsWordFilter';
import { ShortsFilterDrawer } from './ShortsFilterDrawer';
import { ShieldAlert, Loader2, Camera } from 'lucide-react';

interface ShortsFeedProps {
  currentUser: CurrentUser | null;
  onSelectAuthor: (author: string) => void;
  onRequireLogin?: () => void;
  id?: string;
  selectedTag?: string;
  onSelectTag?: (tag: string) => void;
  blockedWords?: string[];
  blockedAuthors?: string[];
  onAddWord?: (word: string) => void;
  onRemoveWord?: (word: string) => void;
  onClearWords?: () => void;
  onAddAuthor?: (author: string) => void;
  onRemoveAuthor?: (author: string) => void;
  onClearAuthors?: () => void;
  filterEnabled?: boolean;
  onHashtagsExtracted?: (hashtags: { tag: string; count: number }[]) => void;
  onHiddenCountChange?: (count: number) => void;
  onToggleFilter?: () => void;
  onDiscussionMapLoaded?: (map: Record<string, HivePost>) => void;
  onBeforeOpenDetail?: () => void;
  source?: ShortsSource;
  onSourceChange?: (source: ShortsSource) => void;
  isDetailOpen?: boolean;
}

export const ShortsFeed: React.FC<ShortsFeedProps> = ({
  currentUser,
  onSelectAuthor,
  onRequireLogin,
  id = 'shorts-feed-container',
  selectedTag = '',
  onSelectTag,
  blockedWords = [],
  blockedAuthors = [],
  onAddWord,
  onRemoveWord,
  onClearWords,
  onAddAuthor,
  onRemoveAuthor,
  onClearAuthors,
  filterEnabled = true,
  onHashtagsExtracted,
  onHiddenCountChange,
  onToggleFilter,
  onDiscussionMapLoaded,
  onBeforeOpenDetail,
  source = 'all',
  onSourceChange,
  isDetailOpen = false
}) => {
  const [containers, setContainers] = useState<PeakSnapsContainer[]>([]);
  const [currentContainerIndex, setCurrentContainerIndex] = useState<number>(0);

  // Accumulated snaps & discussion tree across loaded containers
  const [snaps, setSnaps] = useState<HivePost[]>([]);
  const [discussionMap, setDiscussionMap] = useState<Record<string, HivePost>>({});

  // Loading states
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter query (search by text or author)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);

  // Detail Modal state for opened short
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedPost } = useNavigation();

  // Hide floating compose button and modal whenever a short is opened
  const isViewingDetail = Boolean(
    isDetailOpen ||
    selectedPost ||
    location.pathname.startsWith('/shorts/@')
  );

  // Progressive rendering window to prevent DOM lag/freezing ("travando")
  const [displayLimit, setDisplayLimit] = useState<number>(20);
  const [sourceSnaps, setSourceSnaps] = useState<HivePost[] | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  // Reset display window when active filters change
  useEffect(() => {
    setDisplayLimit(20);
  }, [selectedTag, searchQuery, source]);

  const loadSourceFeed = useCallback(async (forceRefresh = false) => {
    if (source === 'all') {
      setSourceSnaps(null);
      setSourceError(null);
      setSourceLoading(false);
      return;
    }

    setSourceLoading(true);
    setSourceError(null);

    try {
      const rows = source === 'following'
        ? await loadFollowingSnaps(currentUser?.username || '')
        : currentUser?.username
          ? await loadRepliesToAccount(currentUser.username, 20, forceRefresh)
          : [];
      setSourceSnaps(rows);
    } catch (err: any) {
      console.error('Failed to load source feed:', err);
      setSourceError('Could not load this list from Hive. Check your connection.');
    } finally {
      setSourceLoading(false);
    }
  }, [source, currentUser?.username]);

  useEffect(() => {
    loadSourceFeed();
  }, [loadSourceFeed]);

  // Composer states
  const [composerText, setComposerText] = useState<string>('');
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [postSuccessMessage, setPostSuccessMessage] = useState<string | null>(null);
  const [postErrorMessage, setPostErrorMessage] = useState<string | null>(null);
  const [showImageInput, setShowImageInput] = useState<boolean>(false);
  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const [showTagHelper, setShowTagHelper] = useState<boolean>(false);
  // Mobile scroll-aware navbar visibility
  const [isNavbarVisible, setIsNavbarVisible] = useState<boolean>(true);
  const lastScrollYRef = useRef<number>(0);
  const [showMobileComposerModal, setShowMobileComposerModal] = useState<boolean>(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);
  const [localHashtags, setLocalHashtags] = useState<{ tag: string; count: number }[]>([]);

  // Mobile swipe gesture to open filter drawer from the right edge
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleFeedTouchStart = (e: React.TouchEvent) => {
    touchStartPosRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleFeedTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const deltaX = e.changedTouches[0].clientX - touchStartPosRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartPosRef.current.y;
    // If swiped to the left by more than 50px starting near right edge
    if (
      (touchStartPosRef.current.x > window.innerWidth - 80 || deltaX < -70) &&
      deltaX < -45 &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.2
    ) {
      setIsFilterDrawerOpen(true);
    }
    touchStartPosRef.current = null;
  };

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY || document.documentElement.scrollTop || 0;
      const diff = currentY - lastScrollYRef.current;

      // Always show near the top
      if (currentY <= 30) {
        setIsNavbarVisible(true);
        lastScrollYRef.current = currentY;
        return;
      }

      // Hide when scrolling down
      if (diff > 6) {
        setIsNavbarVisible(false);
        lastScrollYRef.current = currentY;
      }
      // Show when scrolling up
      else if (diff < -6) {
        setIsNavbarVisible(true);
        lastScrollYRef.current = currentY;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intersection observer target for infinite scroll to next container
  const bottomObserverRef = useRef<HTMLDivElement>(null);

  // Initial Load: Fetch list of @peak.snaps containers (within 3-5 days) and load container #0
  const loadInitialFeed = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCachedShortsFeed(selectedTag);
      if (cached && cached.snaps && cached.snaps.length > 0) {
        setContainers(cached.containers || []);
        setSnaps(cached.snaps);
        setDiscussionMap(cached.discussionMap || {});
        if (onDiscussionMapLoaded) onDiscussionMapLoaded(cached.discussionMap || {});
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const containerList = await getPeakSnapsContainers(10, undefined, undefined, forceRefresh);
      setContainers(containerList);

      if (containerList.length > 0) {
        const firstContainer = containerList[0];
        setCurrentContainerIndex(0);

        const result = await getContainerSnaps(firstContainer.permlink, forceRefresh, currentUser?.username || '');
        setSnaps(result.snaps);
        setDiscussionMap(result.discussionMap);
        if (onDiscussionMapLoaded) onDiscussionMapLoaded(result.discussionMap);
        setCachedShortsFeed(result.snaps, containerList, result.discussionMap, selectedTag);
      } else {
        setSnaps([]);
      }
    } catch (err: any) {
      console.error('Failed to load shorts feed:', err);
      setError('Unable to fetch snaps from @peak.snaps. Please check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.username, selectedTag, onDiscussionMapLoaded]);

  useEffect(() => {
    loadInitialFeed();
  }, [loadInitialFeed]);

  useEffect(() => {
    const handleResnapEvent = (e: any) => {
      const { text } = e.detail;
      setComposerText((prev) => (prev ? `${prev}\n${text}` : text));
      const el = document.getElementById('shorts-composer-textarea');
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
    window.addEventListener('nebulosa:resnap' as any, handleResnapEvent);
    return () => window.removeEventListener('nebulosa:resnap' as any, handleResnapEvent);
  }, []);

  // Advance to next container post when reaching end of current snaps (up to 5 days horizon)
  const loadNextContainer = useCallback(async () => {
    if (loadingMore || loading || containers.length === 0) return;

    const nextIndex = currentContainerIndex + 1;
    if (nextIndex >= containers.length) {
      // Fetch older containers if needed, while respecting 5-day horizon
      setLoadingMore(true);
      try {
        const lastContainer = containers[containers.length - 1];
        const moreContainers = await getPeakSnapsContainers(
          10,
          lastContainer.author,
          lastContainer.permlink
        );

        if (moreContainers.length > 0) {
          // Exclude starting duplicate
          const newContainers = moreContainers.filter(
            (c) => !containers.some((existing) => existing.permlink === c.permlink)
          );
          if (newContainers.length > 0) {
            const updatedContainers = [...containers, ...newContainers];
            setContainers(updatedContainers);
            const targetContainer = newContainers[0];
            const result = await getContainerSnaps(targetContainer.permlink, false, currentUser?.username || '');
            const updatedSnaps = [...snaps, ...result.snaps];
            setSnaps(updatedSnaps);
            setDiscussionMap((prev) => {
              const newMap = { ...prev, ...result.discussionMap };
              if (onDiscussionMapLoaded) onDiscussionMapLoaded(newMap);
              setCachedShortsFeed(updatedSnaps, updatedContainers, newMap, selectedTag);
              return newMap;
            });
            setCurrentContainerIndex(nextIndex);
          }
        }
      } catch (err) {
        console.error('Error fetching more containers:', err);
      } finally {
        setLoadingMore(false);
      }
      return;
    }

    // Check if target container is beyond 5-day cutoff
    const targetContainer = containers[nextIndex];
    if (targetContainer && targetContainer.created) {
      const createdTime = new Date(
        targetContainer.created.endsWith('Z') ? targetContainer.created : `${targetContainer.created}Z`
      ).getTime();
      if (!Number.isNaN(createdTime) && Date.now() - createdTime > MAX_CONTAINER_AGE_MS) {
        // Beyond 5-day cutoff - avoid querying ancient containers
        return;
      }
    }

    setLoadingMore(true);
    try {
      const result = await getContainerSnaps(targetContainer.permlink, false, currentUser?.username || '');

      // Append next container's snaps to the feed
      const updatedSnaps = [...snaps, ...result.snaps];
      setSnaps(updatedSnaps);
      setDiscussionMap((prev) => {
        const newMap = { ...prev, ...result.discussionMap };
        if (onDiscussionMapLoaded) onDiscussionMapLoaded(newMap);
        setCachedShortsFeed(updatedSnaps, containers, newMap, selectedTag);
        return newMap;
      });
      setCurrentContainerIndex(nextIndex);
    } catch (err) {
      console.error('Failed to load next container snaps:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, containers, currentContainerIndex, currentUser?.username, snaps, selectedTag, onDiscussionMapLoaded]);

  // Extract hashtags from all snaps and report to parent (for LeftSidebar and Filter Drawer)
  const lastTagsRef = useRef<string>('');
  useEffect(() => {
    const map: Record<string, number> = {};
    const hashRegex = /(?:^|\s)#([a-zA-Z0-9_\u0080-\uFFFF]+)/g;

    for (const snap of snaps) {
      if (!snap.body) continue;
      const seen = new Set<string>();
      let m;
      while ((m = hashRegex.exec(snap.body)) !== null) {
        const tag = m[1].toLowerCase();
        if (tag.length >= 2 && !/^\d+$/.test(tag)) {
          seen.add(tag);
        }
      }

      if (snap.json_metadata) {
        try {
          const meta =
            typeof snap.json_metadata === 'string'
              ? JSON.parse(snap.json_metadata)
              : snap.json_metadata;
          if (Array.isArray(meta?.tags)) {
            meta.tags.forEach((t: any) => {
              if (typeof t === 'string') {
                const clean = t.toLowerCase().replace(/^#/, '');
                if (clean.length >= 2 && !/^\d+$/.test(clean)) {
                  seen.add(clean);
                }
              }
            });
          }
        } catch {}
      }

      seen.forEach((t) => {
        map[t] = (map[t] || 0) + 1;
      });
    }

    const tagList = Object.entries(map)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    setLocalHashtags(tagList);

    const serialized = JSON.stringify(tagList.slice(0, 30));
    if (serialized !== lastTagsRef.current) {
      lastTagsRef.current = serialized;
      if (onHashtagsExtracted) {
        onHashtagsExtracted(tagList);
      }
    }
  }, [snaps, onHashtagsExtracted]);

  // Check if snap contains any blocked word or is written by a muted author
  const isSnapBlocked = useCallback(
    (snap: HivePost): boolean => {
      if (!filterEnabled) return false;
      const authorLower = (snap.author || '').toLowerCase();

      // 1. Check blocked / muted authors
      if (blockedAuthors && blockedAuthors.length > 0) {
        if (blockedAuthors.some((a) => a.toLowerCase() === authorLower)) {
          return true;
        }
      }

      // 2. Check blocked / noise words
      if (!blockedWords || blockedWords.length === 0) return false;
      const bodyLower = (snap.body || '').toLowerCase();
      const categoryLower = (snap.category || '').toLowerCase();

      return blockedWords.some((word) => {
        const w = word.trim().toLowerCase();
        if (!w) return false;
        if (w.startsWith('#')) {
          return bodyLower.includes(w) || categoryLower === w.slice(1);
        }
        return bodyLower.includes(w) || authorLower === w;
      });
    },
    [filterEnabled, blockedWords, blockedAuthors]
  );

  // Filter snaps based on spam words, selected tag, and search query
  const { visibleSnaps, hiddenCount } = useMemo(() => {
    let hidden = 0;
    const list: HivePost[] = [];
    const sourceList = source === 'all' ? snaps : (sourceSnaps || []);

    for (const snap of sourceList) {
      // 1. Spam filter check
      if (isSnapBlocked(snap)) {
        hidden++;
        continue;
      }

      // 2. Selected hashtag check (from LeftSidebar or pill click)
      if (selectedTag) {
        const target = selectedTag.toLowerCase().replace(/^#/, '');
        const bodyLower = (snap.body || '').toLowerCase();
        const hasTagInBody = bodyLower.includes(`#${target}`);
        const hasTagInCat = (snap.category || '').toLowerCase() === target;

        let hasTagInMeta = false;
        if (snap.json_metadata) {
          try {
            const meta =
              typeof snap.json_metadata === 'string'
                ? JSON.parse(snap.json_metadata)
                : snap.json_metadata;
            if (Array.isArray(meta?.tags)) {
              hasTagInMeta = meta.tags.some(
                (t: any) =>
                  typeof t === 'string' && t.toLowerCase().replace(/^#/, '') === target
              );
            }
          } catch {}
        }

        if (!hasTagInBody && !hasTagInCat && !hasTagInMeta) {
          continue;
        }
      }

      // 3. Search query check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesAuthor = snap.author.toLowerCase().includes(q);
        const matchesBody = (snap.body || '').toLowerCase().includes(q);
        const matchesCat = (snap.category || '').toLowerCase().includes(q);
        if (!matchesAuthor && !matchesBody && !matchesCat) {
          continue;
        }
      }

      list.push(snap);
    }

    return { visibleSnaps: list, hiddenCount: hidden };
  }, [snaps, sourceSnaps, source, isSnapBlocked, selectedTag, searchQuery]);

  // Notify parent of hiddenCount for the Right Sidebar card badge
  const lastHiddenCountRef = useRef<number>(-1);
  useEffect(() => {
    if (lastHiddenCountRef.current !== hiddenCount) {
      lastHiddenCountRef.current = hiddenCount;
      if (onHiddenCountChange) {
        onHiddenCountChange(hiddenCount);
      }
    }
  }, [hiddenCount, onHiddenCountChange]);

  // Sliced snaps to display in DOM for lightweight rendering (prevents DOM thrashing and UI lag)
  const displayedSnaps = useMemo(() => {
    return visibleSnaps.slice(0, displayLimit);
  }, [visibleSnaps, displayLimit]);

  const hasMoreToDisplay = displayLimit < visibleSnaps.length;

  const handleShowMoreDisplay = useCallback(() => {
    setDisplayLimit((prev) => Math.min(prev + 20, visibleSnaps.length));
  }, [visibleSnaps.length]);

  // Infinite scroll observer: trigger progressive load or next container
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && snaps.length > 0) {
          if (hasMoreToDisplay) {
            handleShowMoreDisplay();
          } else {
            loadNextContainer();
          }
        }
      },
      { threshold: 0.1, rootMargin: '250px' }
    );

    const currentTarget = bottomObserverRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [loadNextContainer, loading, loadingMore, snaps.length, hasMoreToDisplay, handleShowMoreDisplay]);

  // Publish snap to Hive
  const handlePostSnap = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!composerText.trim() || isPosting) return;

    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      return;
    }

    if (containers.length === 0) {
      setPostErrorMessage('No active snaps container found on Hive. Please refresh and try again.');
      return;
    }

    const targetContainer = containers[0];
    setIsPosting(true);
    setPostErrorMessage(null);
    setPostSuccessMessage(null);

    try {
      const response = await KeychainService.postComment(
        currentUser.username,
        'peak.snaps',
        targetContainer.permlink,
        composerText.trim()
      );

      if (response.success) {
        const newSnapPermlink = `re-peaksnaps-${Date.now()}`;
        const newOptimisticSnap: HivePost = {
          post_id: Date.now(),
          author: currentUser.username,
          permlink: newSnapPermlink,
          category: 'snaps',
          title: `RE: ${targetContainer.permlink}`,
          body: composerText.trim(),
          json_metadata: {
            app: 'nebulosa-web/0.0.4',
            format: 'markdown',
            tags: ['snaps']
          },
          created: new Date().toISOString(),
          depth: 1,
          children: 0,
          net_rshares: 0,
          is_paidout: false,
          payout: 0,
          pending_payout_value: '0.000 HBD',
          author_reputation: 25,
          active_votes: [],
          parent_author: 'peak.snaps',
          parent_permlink: targetContainer.permlink
        };

        // Prepend optimistic snap to top of list
        setSnaps((prev) => [newOptimisticSnap, ...prev]);
        setComposerText('');
        setShowImageInput(false);
        setImageUrlInput('');
        setShowTagHelper(false);
        setPostSuccessMessage('Snap published successfully to Hive!');
        setTimeout(() => setPostSuccessMessage(null), 5000);
        return true;
      } else {
        setPostErrorMessage(response.message || 'Failed to broadcast snap via Keychain.');
        return false;
      }
    } catch (err: any) {
      console.error('Error posting snap:', err);
      setPostErrorMessage(err?.message || 'An error occurred while broadcasting snap.');
      return false;
    } finally {
      setIsPosting(false);
    }
  };

  // Image helper insertion
  const handleInsertImage = () => {
    if (!imageUrlInput.trim()) return;
    const markdownImg = `\n![image](${imageUrlInput.trim()})\n`;
    setComposerText((prev) => prev + markdownImg);
    setImageUrlInput('');
    setShowImageInput(false);
  };

  // Tag helper insertion
  const handleInsertTag = (tag: string) => {
    const formatted = tag.startsWith('#') ? tag : `#${tag}`;
    setComposerText((prev) => {
      const space = prev.endsWith(' ') || prev.length === 0 ? '' : ' ';
      return `${prev}${space}${formatted} `;
    });
  };

  const activeContainer = containers[currentContainerIndex];

  return (
    <div
      id={id}
      onTouchStart={handleFeedTouchStart}
      onTouchEnd={handleFeedTouchEnd}
      className="w-full max-w-[760px] mx-auto space-y-3 sm:space-y-4"
    >

      {/* ================= STICKY SCROLL-AWARE SUB-NAVBAR ================= */}
      <nav
        id="shorts-mobile-subnav"
        aria-label="Shorts Feed Categories"
        className={`sticky top-0 z-30 transition-all duration-300 ease-in-out ${
          isNavbarVisible ? 'translate-y-0 opacity-100 pointer-events-auto' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-1 sm:p-1.5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between gap-1 sm:gap-1.5">
          <button
            type="button"
            id="shorts-nav-all-btn"
            onClick={() => {
              if (onSelectTag) onSelectTag('');
              if (onSourceChange) onSourceChange('all');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
              source === 'all' && !selectedTag
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>All</span>
          </button>

          <button
            type="button"
            id="shorts-nav-feed-btn"
            onClick={() => {
              if (!currentUser && onRequireLogin) {
                onRequireLogin();
                return;
              }
              if (onSelectTag) onSelectTag('');
              if (onSourceChange) onSourceChange('following');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
              source === 'following'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Feed</span>
          </button>

          <button
            type="button"
            id="shorts-nav-replies-btn"
            onClick={() => {
              if (!currentUser && onRequireLogin) {
                onRequireLogin();
                return;
              }
              if (onSelectTag) onSelectTag('');
              if (onSourceChange) onSourceChange('replies');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
              source === 'replies'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
            }`}
          >
            <Reply className="w-3.5 h-3.5" />
            <span>Replies</span>
          </button>

          <button
            type="button"
            id="shorts-nav-filter-btn"
            onClick={() => setIsFilterDrawerOpen(true)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
              isFilterDrawerOpen
                ? 'bg-blue-600 text-white shadow-xs'
                : (blockedWords.length > 0 || blockedAuthors.length > 0 || (hiddenCount > 0 && filterEnabled))
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
            }`}
            title="Open filter menu (Noise, spam hashtags & hidden authors)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filter</span>
            {(blockedWords.length > 0 || blockedAuthors.length > 0 || (hiddenCount > 0 && filterEnabled)) && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            )}
          </button>
        </div>
      </nav>

      {/* ================= SHORTS COMPOSER (POST TO COMMUNITY - DESKTOP ONLY) ================= */}
      <div className="hidden sm:block bg-white dark:bg-slate-900 rounded-[24px] p-5 sm:p-6 border border-slate-200/70 dark:border-slate-800 shadow-[0_6px_24px_rgba(15,23,42,0.04)] space-y-4">
        {postSuccessMessage && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-850 text-emerald-800 dark:text-emerald-200 text-xs px-3.5 py-2.5 rounded-xl flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>{postSuccessMessage}</span>
            </div>
            <button
              onClick={() => setPostSuccessMessage(null)}
              className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {postErrorMessage && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-850 text-rose-800 dark:text-rose-200 text-xs px-3.5 py-2.5 rounded-xl flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
              <span>{postErrorMessage}</span>
            </div>
            <button
              onClick={() => setPostErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <img
            src={currentUser ? getHiveAvatarUrl(currentUser.username, 'small') : 'https://images.ecency.com/u/hive/avatar/small'}
            alt={currentUser?.username || 'Guest'}
            className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-900 shadow-sm flex-shrink-0 bg-slate-100 dark:bg-slate-800"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
            }}
          />
          <div className="flex-1 min-w-0">
            <textarea
              id="shorts-composer-textarea"
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              placeholder={
                currentUser
                  ? "What's happening? Share a snap with the Hive community..."
                  : "Connect Keychain to post snaps directly to the Hive community..."
              }
              rows={3}
              className="w-full text-[15px] text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 rounded-2xl p-4 border border-transparent dark:border-slate-700/60 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Image Attachment Helper */}
        {showImageInput && (
          <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-2.5 flex items-center gap-2 animate-in fade-in">
            <input
              type="text"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              placeholder="Paste direct image URL (https://...)"
              className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 rounded-lg border border-gray-200 dark:border-slate-700 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleInsertImage}
              disabled={!imageUrlInput.trim()}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-40 transition cursor-pointer"
            >
              Insert
            </button>
            <button
              type="button"
              onClick={() => setShowImageInput(false)}
              className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tag helper drawer */}
        {showTagHelper && (
          <div className="bg-gray-50/80 dark:bg-slate-800/80 rounded-xl p-2.5 space-y-1.5 animate-in fade-in">
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-slate-400">
              <span>Click to add hashtag to snap:</span>
              <button
                type="button"
                onClick={() => setShowTagHelper(false)}
                className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['hive', 'shorts', 'crypto', 'photography', 'leofinance', 'art', 'travel', 'nature'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleInsertTag(t)}
                  className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 text-xs text-gray-700 dark:text-slate-300 transition cursor-pointer"
                >
                  #{t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Composer Action Toolbar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowImageInput(!showImageInput)}
              className={`p-2 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                showImageInput ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
              title="Attach image via URL"
            >
              <Image className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Image</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTagHelper(!showTagHelper)}
              className={`p-2 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                showTagHelper ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
              title="Add #hashtag"
            >
              <Hash className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">Hashtags</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                showSearch || searchQuery ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
              title="Search snaps"
            >
              <Search className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`text-[11px] font-mono ${
                composerText.length > 500 ? 'text-rose-500 font-bold' : 'text-gray-400 dark:text-slate-500'
              }`}
            >
              {composerText.length}/500
            </span>

            <button
              type="button"
              onClick={handlePostSnap}
              disabled={!composerText.trim() || isPosting}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-500/15 cursor-pointer disabled:cursor-not-allowed"
            >
              {isPosting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Posting...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Post Snap</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Optional Collapsible Search Bar */}
        {(showSearch || searchQuery) && (
          <div className="pt-2 border-t border-gray-100 dark:border-slate-800 relative animate-in fade-in">
            <Search className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search snaps by text, author, or #hashtag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 border border-gray-200 dark:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-850 focus:outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 font-bold"
              >
                &times;
              </button>
            )}
          </div>
        )}
      </div>

      {source !== 'all' && (
        <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-2xl px-4 py-2.5 border border-slate-200/70 dark:border-slate-800 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 dark:text-slate-100">
              {source === 'following' ? 'Snaps from people you follow' : 'Replies to your snaps (last 3 days)'}
            </span>
            {source === 'replies' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-mono font-semibold">
                hive-124838
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadSourceFeed(true)}
              disabled={sourceLoading}
              className="text-xs text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer disabled:opacity-50 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${sourceLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => onSourceChange?.('all')}
              className="text-blue-600 dark:text-blue-400 font-semibold cursor-pointer hover:underline"
            >
              Show all
            </button>
          </div>
        </div>
      )}

      {sourceLoading && (
        <p className="text-xs text-gray-500 dark:text-slate-400 px-1">Loading from Hive…</p>
      )}
      {sourceError && (
        <p className="text-xs text-rose-600 dark:text-rose-400 px-1">{sourceError}</p>
      )}

      {/* ================= ACTIVE FILTER BANNER (Moved here) ================= */}
      {(selectedTag || (hiddenCount > 0 && filterEnabled)) && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-2xl px-4 py-2.5 border border-slate-200/70 dark:border-slate-800 shadow-sm text-xs animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {selectedTag && (
              <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium px-2.5 py-1 rounded-xl border border-blue-100 dark:border-blue-900/50">
                <Hash className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>#{selectedTag}</span>
                <button
                  onClick={() => onSelectTag && onSelectTag('')}
                  className="ml-1 hover:text-blue-900 dark:hover:text-blue-100 font-bold"
                  title="Clear hashtag filter"
                >
                  &times;
                </button>
              </div>
            )}
            {hiddenCount > 0 && filterEnabled && (
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 rounded-xl">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                <span>{hiddenCount} shorts hidden</span>
                <button
                  type="button"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline ml-1 cursor-pointer"
                >
                  Edit Filter
                </button>
              </div>
            )}
          </div>
        </div>
      )}


      {/* ================= ERROR STATE ================= */}
      {error && (
        <div className="bg-rose-50/80 border border-rose-200/80 rounded-2xl p-4 text-xs text-rose-800 flex items-start gap-3 shadow-sm">
          <RefreshCw className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{error}</p>
            <button
              onClick={() => loadInitialFeed(true)}
              className="mt-2 text-rose-700 font-bold underline hover:text-rose-900"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ================= LOADING SKELETON ================= */}
      {loading && snaps.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="p-5 sm:p-6 animate-pulse space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-800" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 bg-gray-200 dark:bg-slate-800 rounded-md w-28" />
                  <div className="h-2.5 bg-gray-100 dark:bg-slate-850 rounded-md w-16" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-slate-800 rounded-md w-full" />
                <div className="h-3 bg-gray-200 dark:bg-slate-800 rounded-md w-4/5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= EMPTY STATE ================= */}
      {!loading && !sourceLoading && visibleSnaps.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-[24px] p-10 border border-slate-200/70 dark:border-slate-800 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <MessageCircle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white text-base">No snaps found</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto">
            {source === 'following' && !currentUser
              ? 'Sign in with Keychain to see snaps from people you follow.'
              : source === 'following'
                ? 'No recent snap comments from people you follow are in the feed cache yet.'
                : source === 'replies' && !currentUser
                  ? 'Sign in with Keychain to see replies to your snaps.'
                  : source === 'replies'
                    ? 'No replies to your snaps yet.'
                    : selectedTag
              ? `No snaps found with hashtag #${selectedTag}. Try selecting another topic or clearing your filter.`
              : searchQuery
                ? `No snaps match "${searchQuery}". Try a different search term.`
                : hiddenCount > 0
                  ? 'All snaps in this container were hidden by your spam word filter.'
                  : 'No microblogging snaps found in the latest community container. Be the first to post a snap!'}
          </p>
          {(selectedTag || searchQuery) && (
            <button
              onClick={() => {
                if (onSelectTag) onSelectTag('');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* ================= SNAPS STREAM ================= */}
      <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200/70 dark:border-slate-800 shadow-[0_4px_20px_rgba(15,23,42,0.035)] overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {displayedSnaps.map((snap) => (
          <ShortCard
            key={`${snap.author}-${snap.permlink}`}
            snap={snap}
            discussionMap={discussionMap}
            currentUser={currentUser}
            onSelectAuthor={onSelectAuthor}
            onSelectTag={onSelectTag}
            onOpenDetail={(s) => {
              onBeforeOpenDetail?.();
              navigate(`/shorts/@${s.author}/${s.permlink}`, { state: { snap: s } });
            }}
            onRequireLogin={onRequireLogin}
          />
        ))}
      </div>

      {/* Progressive load more button (if more items available in loaded containers) */}
      {hasMoreToDisplay && (
        <div className="py-2 text-center">
          <button
            type="button"
            onClick={handleShowMoreDisplay}
            className="px-5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-full transition shadow-sm hover:shadow-md cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>Show more shorts</span>
            <span className="text-gray-400 dark:text-slate-500 font-normal">
              ({visibleSnaps.length - displayLimit} remaining)
            </span>
          </button>
        </div>
      )}

      {/* ================= BOTTOM INFINITE SCROLL OBSERVER & LOADER ================= */}
      <div ref={bottomObserverRef} className="py-4 text-center">
        {loadingMore && (
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 py-3">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            <span>Loading snaps from previous container...</span>
          </div>
        )}

        {!loading && !loadingMore && snaps.length > 0 && currentContainerIndex + 1 < containers.length && !hasMoreToDisplay && (
          <button
            type="button"
            onClick={loadNextContainer}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline px-4 py-2 cursor-pointer"
          >
            Load older snaps from previous container &darr;
          </button>
        )}

        {!loading && !loadingMore && snaps.length > 0 && currentContainerIndex + 1 >= containers.length && !hasMoreToDisplay && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 py-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>You have caught up with all available community snaps.</span>
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) for Quick Snap - hidden when viewing a short */}
      {!isViewingDetail && (
        <button
          type="button"
          id="shorts-fab-compose-btn"
          onClick={() => {
            if (!currentUser && onRequireLogin) {
              onRequireLogin();
              return;
            }
            if (window.innerWidth < 640) {
              setShowMobileComposerModal(true);
            } else {
              const el = document.getElementById('shorts-composer-textarea');
              if (el) {
                el.focus();
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }
          }}
          className="fixed bottom-20 sm:bottom-6 right-5 sm:right-6 w-13 h-13 sm:w-14 sm:h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-95 z-40 group cursor-pointer"
          title="Write a snap"
        >
          <Send className="w-5 h-5 sm:w-6 sm:h-6 group-hover:rotate-12 transition-transform" />
        </button>
      )}

      {/* ================= MOBILE QUICK SNAP MODAL ================= */}
      {!isViewingDetail && showMobileComposerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-3 animate-in slide-in-from-bottom-6 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <img
                  src={currentUser ? getHiveAvatarUrl(currentUser.username, 'small') : 'https://images.ecency.com/u/hive/avatar/small'}
                  alt={currentUser?.username || 'User'}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">New Snap</h4>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500">Post to Hive community</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileComposerModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              placeholder="What's happening? Share a snap..."
              rows={4}
              autoFocus
              className="w-full text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-transparent focus:border-blue-500 focus:outline-none resize-none leading-relaxed"
            />

            {/* Quick Hashtag Chips */}
            <div className="flex flex-wrap gap-1">
              {['hive', 'shorts', 'crypto', 'photography', 'art'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleInsertTag(t)}
                  className="px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-[11px] font-medium text-gray-600 dark:text-slate-300 hover:text-blue-600 transition cursor-pointer"
                >
                  #{t}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className={`text-[11px] font-mono ${composerText.length > 500 ? 'text-rose-500 font-bold' : 'text-gray-400'}`}>
                {composerText.length}/500
              </span>
              <button
                type="button"
                onClick={async () => {
                  const success = await handlePostSnap();
                  if (success) setShowMobileComposerModal(false);
                }}
                disabled={!composerText.trim() || isPosting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:cursor-not-allowed"
              >
                {isPosting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{isPosting ? 'Posting...' : 'Post Snap'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SHORTS FILTER & NOISE CONTROL DRAWER ================= */}
      <ShortsFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        blockedWords={blockedWords}
        onAddWord={onAddWord || (() => {})}
        onRemoveWord={onRemoveWord || (() => {})}
        onClearWords={onClearWords || (() => {})}
        blockedAuthors={blockedAuthors}
        onAddAuthor={onAddAuthor || (() => {})}
        onRemoveAuthor={onRemoveAuthor || (() => {})}
        onClearAuthors={onClearAuthors || (() => {})}
        filterEnabled={filterEnabled}
        onToggleFilter={onToggleFilter || (() => {})}
        hashtags={localHashtags}
        selectedTag={selectedTag}
        onSelectTag={onSelectTag}
        hiddenCount={hiddenCount}
      />

    </div>
  );
};

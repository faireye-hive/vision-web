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
  SlidersHorizontal,
  Plus,
  Flame
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
  getCleanSnapTextLength,
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
import { MobileShortsTagsModal } from './MobileShortsTagsModal';
import { processShortsTags, getFavoriteTags, saveFavoriteTags } from '../utils/shortsNoiseFilter';
import { ShieldAlert, Loader2, Camera, Star } from 'lucide-react';

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

function postCreatedTimestamp(created?: string): number {
  if (!created) return 0;
  const normalized = created.endsWith('Z') ? created : `${created}Z`;
  const timestamp = new Date(normalized).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
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
  const sourceSnapsRef = useRef<HivePost[] | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sourceHasMore, setSourceHasMore] = useState(false);
  const [sourceNeedsManualPage, setSourceNeedsManualPage] = useState(false);
  const sourceCursorRef = useRef<{ author: string; permlink: string } | null>(null);
  const followingLimitRef = useRef(45);

  // Reset display window when active filters change
  useEffect(() => {
    setDisplayLimit(20);
  }, [selectedTag, searchQuery, source]);

  const loadSourceFeed = useCallback(async (forceRefresh = false, append = false) => {
    if (source === 'all' || source === 'hot') {
      setSourceSnaps(null);
      sourceSnapsRef.current = null;
      setSourceError(null);
      setSourceLoading(false);
      setSourceHasMore(false);
      setSourceNeedsManualPage(false);
      sourceCursorRef.current = null;
      return;
    }

    setSourceLoading(true);
    setSourceError(null);

    try {
      if (!append) {
        sourceCursorRef.current = null;
        setSourceHasMore(false);
        setSourceNeedsManualPage(false);
        followingLimitRef.current = 45;
      }

      if (source === 'following') {
        const limit = append ? followingLimitRef.current : 45;
        const page = await loadFollowingSnaps(
            currentUser?.username || '',
            forceRefresh,
            limit
          );
        followingLimitRef.current = page.nextLimit;
        setSourceHasMore(page.hasMore);
        const existing = append ? (sourceSnapsRef.current || []) : [];
        const merged = [...existing];
        const seen = new Set(merged.map((post) => `${post.author}/${post.permlink}`));
        page.posts.forEach((post) => {
          const key = `${post.author}/${post.permlink}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(post);
          }
        });
        merged.sort((a, b) => postCreatedTimestamp(b.created) - postCreatedTimestamp(a.created));
        sourceSnapsRef.current = merged;
        setSourceSnaps(merged);
        setSourceNeedsManualPage(page.hasMore && merged.length === existing.length);
      } else if (currentUser?.username) {
        const page = await loadRepliesToAccount(
          currentUser.username,
          20,
          forceRefresh,
          append ? sourceCursorRef.current : null
        );
        sourceCursorRef.current = page.nextCursor;
        setSourceHasMore(page.hasMore);
        const existing = append ? (sourceSnapsRef.current || []) : [];
        const merged = [...existing];
        const seen = new Set(merged.map((post) => `${post.author}/${post.permlink}`));
        page.posts.forEach((post) => {
          const key = `${post.author}/${post.permlink}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(post);
          }
        });
        merged.sort((a, b) => postCreatedTimestamp(b.created) - postCreatedTimestamp(a.created));
        sourceSnapsRef.current = merged;
        setSourceSnaps(merged);
        setSourceNeedsManualPage(page.hasMore && merged.length === existing.length);
      } else {
        sourceSnapsRef.current = [];
        setSourceSnaps([]);
        setSourceHasMore(false);
      }
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

  useEffect(() => {
    const openFilters = () => setIsFilterDrawerOpen(true);
    const openComposer = () => setShowComposerModal(true);
    window.addEventListener('nebulosa:open-shorts-filters', openFilters);
    window.addEventListener('nebulosa:open-shorts-composer', openComposer);
    return () => {
      window.removeEventListener('nebulosa:open-shorts-filters', openFilters);
      window.removeEventListener('nebulosa:open-shorts-composer', openComposer);
    };
  }, []);

  // Composer states
  const [composerText, setComposerText] = useState<string>('');
  const cleanCharCount = useMemo(() => getCleanSnapTextLength(composerText), [composerText]);
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [postSuccessMessage, setPostSuccessMessage] = useState<string | null>(null);
  const [postErrorMessage, setPostErrorMessage] = useState<string | null>(null);
  const [showImageInput, setShowImageInput] = useState<boolean>(false);
  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const [showTagHelper, setShowTagHelper] = useState<boolean>(false);
  // Mobile scroll-aware navbar visibility
  const [isNavbarVisible, setIsNavbarVisible] = useState<boolean>(true);
  const lastScrollYRef = useRef<number>(0);
  const [showComposerModal, setShowComposerModal] = useState<boolean>(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);
  const [isTagsModalOpen, setIsTagsModalOpen] = useState<boolean>(false);
  const [localHashtags, setLocalHashtags] = useState<{ tag: string; count: number }[]>([]);
  const [favoriteTags, setFavoriteTags] = useState<string[]>(() => getFavoriteTags());

  const handleToggleFavoriteTag = useCallback((tagToToggle: string) => {
    const clean = tagToToggle.toLowerCase().replace(/^#/, '');
    setFavoriteTags((prev) => {
      const exists = prev.includes(clean);
      const next = exists ? prev.filter((t) => t !== clean) : [...prev, clean];
      saveFavoriteTags(next);
      return next;
    });
  }, []);

  // Mobile quick top tags (filtered by anti-noise heuristic with pinned tags prioritized)
  const cleanTopTags = useMemo(() => {
    const { cleanTags } = processShortsTags(localHashtags, {
      hideSpam: true,
      blockedWords,
      favoriteTags
    });
    return cleanTags.slice(0, 18);
  }, [localHashtags, blockedWords, favoriteTags]);

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
        if (onDiscussionMapLoaded) {
          setTimeout(() => onDiscussionMapLoaded(cached.discussionMap || {}), 0);
        }
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
        if (onDiscussionMapLoaded) {
          setTimeout(() => onDiscussionMapLoaded(result.discussionMap), 0);
        }
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
      setShowComposerModal(true);
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
              setCachedShortsFeed(updatedSnaps, updatedContainers, newMap, selectedTag);
              return newMap;
            });
            if (onDiscussionMapLoaded) {
              setTimeout(() => onDiscussionMapLoaded(result.discussionMap), 0);
            }
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
        setCachedShortsFeed(updatedSnaps, containers, newMap, selectedTag);
        return newMap;
      });
      if (onDiscussionMapLoaded) {
        setTimeout(() => onDiscussionMapLoaded(result.discussionMap), 0);
      }
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
        setTimeout(() => onHashtagsExtracted(tagList), 0);
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

  const directReplyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(discussionMap).forEach((post) => {
      if (!post?.parent_author || !post.parent_permlink) return;
      const key = `${post.parent_author.toLowerCase()}/${post.parent_permlink.toLowerCase()}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [discussionMap]);

  const getSnapReplyCount = useCallback((snap: HivePost) => {
    const key = `${snap.author.toLowerCase()}/${snap.permlink.toLowerCase()}`;
    return Math.max(
      Number(snap.children) || 0,
      Array.isArray(snap.replies) ? snap.replies.length : 0,
      directReplyCounts[key] || 0
    );
  }, [directReplyCounts]);

  // Filter snaps based on spam words, selected tag, and search query
  const { visibleSnaps, hiddenCount } = useMemo(() => {
    let hidden = 0;
    const list: HivePost[] = [];
    const sourceList = source === 'all' || source === 'hot' ? snaps : (sourceSnaps || []);

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

    if (source === 'hot') {
      list.sort((a, b) => getSnapReplyCount(b) - getSnapReplyCount(a) || postCreatedTimestamp(b.created) - postCreatedTimestamp(a.created));
    }

    return { visibleSnaps: list, hiddenCount: hidden };
  }, [snaps, sourceSnaps, source, isSnapBlocked, selectedTag, searchQuery, getSnapReplyCount]);

  // Notify parent of hiddenCount for the Right Sidebar card badge
  const lastHiddenCountRef = useRef<number>(-1);
  useEffect(() => {
    if (lastHiddenCountRef.current !== hiddenCount) {
      lastHiddenCountRef.current = hiddenCount;
      if (onHiddenCountChange) {
        setTimeout(() => onHiddenCountChange(hiddenCount), 0);
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
        if (entries[0].isIntersecting && !loading && !loadingMore && !sourceLoading && visibleSnaps.length > 0) {
          if (hasMoreToDisplay) {
            handleShowMoreDisplay();
          } else if (source === 'all' || source === 'hot') {
            loadNextContainer();
          } else if ((source === 'replies' || source === 'following') && sourceHasMore && !sourceNeedsManualPage) {
            loadSourceFeed(false, true);
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
  }, [loadNextContainer, loadSourceFeed, loading, loadingMore, sourceLoading, visibleSnaps.length, hasMoreToDisplay, handleShowMoreDisplay, source, sourceHasMore, sourceNeedsManualPage]);

  // Publish snap to Hive
  const handlePostSnap = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!composerText.trim() || isPosting) return;

    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      return;
    }

    const cleanChars = getCleanSnapTextLength(composerText);
    if (cleanChars > 300) {
      setPostErrorMessage(`Snap text exceeds 300 characters (${cleanChars}/300, links and images excluded). Please shorten your message.`);
      return false;
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
      className="shorts-page w-full max-w-none mx-auto space-y-3"
    >
      {postSuccessMessage && (
        <div role="status" className="fixed right-5 top-20 z-[60] flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-800 shadow-xl dark:border-emerald-900/70 dark:bg-slate-900 dark:text-emerald-300">
          <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          {postSuccessMessage}
        </div>
      )}

      {/* ================= STICKY SCROLL-AWARE SUB-NAVBAR ================= */}
      <nav
        id="shorts-mobile-subnav"
        aria-label="Shorts Feed Categories"
        className={`sticky top-0 z-30 transition-all duration-300 ease-in-out lg:hidden ${
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
            className={`flex-1 flex items-center justify-center gap-1.5 min-h-[42px] py-2 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              source === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Discover</span>
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
            className={`flex-1 flex items-center justify-center gap-1.5 min-h-[42px] py-2 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              source === 'following'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Following</span>
          </button>

          <button
            type="button"
            id="shorts-nav-hot-btn"
            onClick={() => {
              if (onSelectTag) onSelectTag('');
              if (onSourceChange) onSourceChange('hot');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 min-h-[42px] py-2 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              source === 'hot'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Hot</span>
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
            className={`flex-1 flex items-center justify-center gap-1.5 min-h-[42px] py-2 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
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
            className={`flex items-center justify-center gap-1.5 min-h-[42px] px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              isFilterDrawerOpen
                ? 'bg-blue-600 text-white shadow-xs'
                : (blockedWords.length > 0 || blockedAuthors.length > 0 || (hiddenCount > 0 && filterEnabled))
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
            }`}
            title="Open filter menu (Noise, spam hashtags & hidden authors)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {(blockedWords.length > 0 || blockedAuthors.length > 0 || (hiddenCount > 0 && filterEnabled)) && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* ================= MOBILE CLEAN TAGS CAROUSEL (WITH ANTI-NOISE FILTER) ================= */}
        {cleanTopTags.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200/70 bg-white/80 px-2 py-1.5 shadow-xs backdrop-blur-md scrollbar-none dark:border-slate-800 dark:bg-slate-900/80">
            {/* Open Full Tags Modal Button */}
            <button
              type="button"
              onClick={() => setIsTagsModalOpen(true)}
              className="flex-shrink-0 flex items-center gap-1.5 min-h-7 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50/90 dark:bg-blue-950/70 border border-blue-200/80 dark:border-blue-900/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 transition cursor-pointer"
              title="Browse all tags with anti-noise filter"
            >
              <Hash className="w-3 h-3 text-blue-500" />
              <span>Topics</span>
            </button>

            {/* Clean, Non-Spam Tags */}
            {cleanTopTags.map(({ tag, isFavorite }) => {
              const isSelected = selectedTag.toLowerCase().replace(/^#/, '') === tag.toLowerCase();
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    if (onSelectTag) onSelectTag(isSelected ? '' : tag);
                  }}
                  className={`flex-shrink-0 flex items-center gap-1.5 min-h-7 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-2xs font-bold'
                      : isFavorite
                      ? 'bg-amber-50/90 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-amber-200/80 dark:border-amber-900/60 hover:bg-amber-100'
                      : 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                  title={isFavorite ? `Pinned topic #${tag}` : `Filter by #${tag}`}
                >
                  {isFavorite ? (
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
                  ) : (
                    <span className="opacity-70">#</span>
                  )}
                  <span>{tag}</span>
                </button>
              );
            })}

          </div>
        )}
      </nav>

      {(source === 'following' || source === 'replies') && (
        <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-2xl px-4 py-2.5 border border-slate-200/70 dark:border-slate-800 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 dark:text-slate-100">
              {source === 'following' ? 'Snaps from people you follow' : 'Replies to your latest Snaps'}
            </span>
            {source === 'replies' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-mono font-semibold">
                20 Snaps / page
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 py-1 text-[11px] animate-in fade-in duration-150">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {selectedTag && (
              <div className="flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50/80 px-2 py-1 font-medium text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
                <Hash className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>#{selectedTag}</span>
                <button
                  onClick={() => onSelectTag && onSelectTag('')}
                  className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100 font-bold px-1"
                  title="Clear hashtag filter"
                >
                  &times;
                </button>
                <button
                  type="button"
                  onClick={() => setIsTagsModalOpen(true)}
                  className="ml-1 text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline pl-1 border-l border-blue-200 dark:border-blue-800"
                >
                  Change
                </button>
              </div>
            )}
            {hiddenCount > 0 && filterEnabled && (
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                <ShieldAlert className="h-3 w-3" />
                <span>{hiddenCount} hidden</span>
                <button
                  type="button"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className="font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 transition hover:text-blue-600 dark:text-slate-400 dark:decoration-slate-600 dark:hover:text-blue-400"
                >
                  Manage
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
              ? 'Connect a Hive account or use Demo mode to see Snaps from people you follow.'
              : source === 'following'
                ? 'No recent Snaps from people you follow were found.'
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
              : 'No recent snaps found here. Try another topic or share the first snap.'}
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
      <div className="space-y-3 sm:space-y-4">
        {displayedSnaps.map((snap) => (
          <ShortCard
            key={`${snap.author}-${snap.permlink}`}
            snap={snap}
            discussionMap={discussionMap}
            currentUser={currentUser}
            onSelectAuthor={onSelectAuthor}
            onSelectTag={onSelectTag}
            onMuteAuthor={onAddAuthor}
            isMuted={blockedAuthors.some((a) => a.toLowerCase() === snap.author.toLowerCase())}
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
          className="min-h-[44px] px-5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 rounded-xl transition shadow-sm hover:shadow-md cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>{source === 'replies' ? 'Show more replies' : source === 'following' ? 'Show more Snaps' : source === 'hot' ? 'Show more Snaps' : 'Show more shorts'}</span>
            <span className="text-gray-400 dark:text-slate-500 font-normal">
              ({visibleSnaps.length - displayLimit} remaining)
            </span>
          </button>
        </div>
      )}

      {/* ================= BOTTOM INFINITE SCROLL OBSERVER & LOADER ================= */}
      <div
        ref={bottomObserverRef}
        className={source === 'all' || source === 'hot' || sourceNeedsManualPage ? 'py-4 text-center' : 'h-1'}
      >
        {(source === 'following' || source === 'replies') && sourceNeedsManualPage && (
          <button
            type="button"
            onClick={() => loadSourceFeed(false, true)}
            disabled={sourceLoading}
            className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-blue-400"
          >
            {sourceLoading
              ? 'Loading more Snaps…'
              : source === 'following' ? 'Load more from followed accounts' : 'Check older Snaps for replies'}
          </button>
        )}

        {(source === 'all' || source === 'hot') && loadingMore && (
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 py-3">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            <span>{source === 'hot' ? 'Loading more Snaps for Hot…' : 'Loading snaps from previous container...'}</span>
          </div>
        )}

        {(source === 'all' || source === 'hot') && !loading && !loadingMore && snaps.length > 0 && currentContainerIndex + 1 < containers.length && !hasMoreToDisplay && (
          <button
            type="button"
            onClick={loadNextContainer}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline px-4 py-2 cursor-pointer"
          >
            {source === 'hot' ? 'Load more Snaps to update Hot ranking ↓' : 'Load older snaps from previous container ↓'}
          </button>
        )}

        {(source === 'all' || source === 'hot') && !loading && !loadingMore && snaps.length > 0 && currentContainerIndex + 1 >= containers.length && !hasMoreToDisplay && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 py-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>You’re up to date.</span>
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) for Quick Snap - hidden when viewing a short */}
      {!isViewingDetail && (
        <button
          type="button"
          id="shorts-fab-compose-btn"
          onClick={() => {
            setShowComposerModal(true);
          }}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-600/25 transition hover:scale-105 hover:bg-blue-700 active:scale-95 group cursor-pointer"
          title="Write a snap"
        >
          <Plus className="h-6 w-6 transition-transform group-hover:rotate-90" />
        </button>
      )}

      {/* ================= MOBILE FLOATING TAGS PILL ================= */}
      {!isViewingDetail && (
        <button
          type="button"
          id="shorts-mobile-floating-tags"
          onClick={() => setIsTagsModalOpen(true)}
          className="lg:hidden fixed bottom-6 left-5 z-40 flex h-10 items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/95 px-3 text-xs font-semibold text-slate-800 shadow-lg backdrop-blur-md transition active:scale-95 dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-100"
          title="Browse Shorts tags"
        >
          <Hash className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="max-w-[110px] truncate">{selectedTag ? `#${selectedTag}` : 'Tags'}</span>
          {selectedTag && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectTag) onSelectTag('');
              }}
              className="ml-0.5 text-slate-400 hover:text-rose-500 font-black p-0.5"
              title="Clear tag"
            >
              &times;
            </span>
          )}
        </button>
      )}

      {/* ================= MOBILE QUICK SNAP MODAL ================= */}
      {!isViewingDetail && showComposerModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm animate-in fade-in sm:items-center sm:p-5">
          <div role="dialog" aria-modal="true" aria-labelledby="shorts-compose-title" className="w-full space-y-4 rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl animate-in slide-in-from-bottom-6 duration-200 dark:border-slate-800 dark:bg-slate-900 sm:max-w-xl sm:rounded-3xl sm:animate-in sm:zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <img
                  src={currentUser ? getHiveAvatarUrl(currentUser.username, 'small') : 'https://images.ecency.com/u/hive/avatar/small'}
                  alt={currentUser?.username || 'User'}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div>
                  <h4 id="shorts-compose-title" className="text-sm font-bold text-gray-900 dark:text-white">Write a Short</h4>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500">Share a thought with Hive</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowComposerModal(false)}
                aria-label="Close composer"
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              id="shorts-composer-textarea"
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              placeholder="What would you like to share?"
              rows={5}
              autoFocus
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[15px] leading-relaxed text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:bg-slate-800"
            />

            {postErrorMessage && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                {postErrorMessage}
              </div>
            )}
            {postSuccessMessage && (
              <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                {postSuccessMessage}
              </div>
            )}

            {showImageInput && (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="Cole a URL direta da imagem"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
                />
                <button type="button" onClick={handleInsertImage} disabled={!imageUrlInput.trim()} className="rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-40">Inserir</button>
              </div>
            )}

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

            <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowImageInput((show) => !show)}
                className={`flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-medium transition ${showImageInput ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
              >
                <Image className="h-4 w-4" />
                Imagem
              </button>
              <div className="flex items-center gap-3">
              <span
                className={`text-[11px] font-mono ${cleanCharCount > 300 ? 'text-rose-500 font-bold' : 'text-gray-400'}`}
                title="300 visible characters limit (links and images excluded)"
              >
                {cleanCharCount}/300
              </span>
              <button
                type="button"
                onClick={async () => {
                  const success = await handlePostSnap();
                  if (success) setShowComposerModal(false);
                }}
                disabled={!composerText.trim() || cleanCharCount > 300 || isPosting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:cursor-not-allowed"
              >
                {isPosting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{isPosting ? 'Posting...' : 'Post Snap'}</span>
              </button>
              </div>
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

      {/* ================= MOBILE SHORTS TAGS SELECTION MODAL ================= */}
      <MobileShortsTagsModal
        isOpen={isTagsModalOpen}
        onClose={() => setIsTagsModalOpen(false)}
        hashtags={localHashtags}
        selectedTag={selectedTag}
        onSelectTag={onSelectTag || (() => {})}
        blockedWords={blockedWords}
        onAddWord={onAddWord || (() => {})}
        onRemoveWord={onRemoveWord || (() => {})}
        onOpenFilterDrawer={() => setIsFilterDrawerOpen(true)}
        favoriteTags={favoriteTags}
        onToggleFavorite={handleToggleFavoriteTag}
      />

    </div>
  );
};

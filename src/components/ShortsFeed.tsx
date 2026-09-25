import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Check
} from 'lucide-react';
import { HivePost, getHiveAvatarUrl } from '../services/hiveApi';
import { CurrentUser, KeychainService } from '../services/keychain';
import { ShortCard } from './ShortCard';
import { ShortDetailModal } from './ShortDetailModal';
import {
  getPeakSnapsContainers,
  getContainerSnaps,
  PeakSnapsContainer
} from '../services/shortsApi';

interface ShortsFeedProps {
  currentUser: CurrentUser | null;
  onSelectAuthor: (author: string) => void;
  onRequireLogin?: () => void;
  id?: string;
  selectedTag?: string;
  onSelectTag?: (tag: string) => void;
  blockedWords?: string[];
  filterEnabled?: boolean;
  onHashtagsExtracted?: (hashtags: { tag: string; count: number }[]) => void;
  onHiddenCountChange?: (count: number) => void;
}

export const ShortsFeed: React.FC<ShortsFeedProps> = ({
  currentUser,
  onSelectAuthor,
  onRequireLogin,
  id = 'shorts-feed-container',
  selectedTag = '',
  onSelectTag,
  blockedWords = [],
  filterEnabled = true,
  onHashtagsExtracted,
  onHiddenCountChange
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
  const [selectedSnapForDetail, setSelectedSnapForDetail] = useState<HivePost | null>(null);

  // Progressive rendering window to prevent DOM lag/freezing ("travando")
  const [displayLimit, setDisplayLimit] = useState<number>(20);

  // Reset display window when active filters change
  useEffect(() => {
    setDisplayLimit(20);
  }, [selectedTag, searchQuery]);

  // Composer states
  const [composerText, setComposerText] = useState<string>('');
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [postSuccessMessage, setPostSuccessMessage] = useState<string | null>(null);
  const [postErrorMessage, setPostErrorMessage] = useState<string | null>(null);
  const [showImageInput, setShowImageInput] = useState<boolean>(false);
  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const [showTagHelper, setShowTagHelper] = useState<boolean>(false);

  // Intersection observer target for infinite scroll to next container
  const bottomObserverRef = useRef<HTMLDivElement>(null);

  // Initial Load: Fetch list of @peak.snaps containers and load container #0
  const loadInitialFeed = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const containerList = await getPeakSnapsContainers(12, undefined, undefined, forceRefresh);
      setContainers(containerList);

      if (containerList.length > 0) {
        const firstContainer = containerList[0];
        setCurrentContainerIndex(0);

        const result = await getContainerSnaps(firstContainer.permlink, forceRefresh);
        setSnaps(result.snaps);
        setDiscussionMap(result.discussionMap);
      } else {
        setSnaps([]);
      }
    } catch (err: any) {
      console.error('Failed to load shorts feed:', err);
      setError('Unable to fetch snaps from @peak.snaps. Please check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialFeed();
  }, [loadInitialFeed]);

  // Advance to next container post when reaching end of current snaps
  const loadNextContainer = useCallback(async () => {
    if (loadingMore || loading || containers.length === 0) return;

    const nextIndex = currentContainerIndex + 1;
    if (nextIndex >= containers.length) {
      // Fetch older containers if needed
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
            setContainers((prev) => [...prev, ...newContainers]);
            const targetContainer = newContainers[0];
            const result = await getContainerSnaps(targetContainer.permlink);
            setSnaps((prev) => [...prev, ...result.snaps]);
            setDiscussionMap((prev) => ({ ...prev, ...result.discussionMap }));
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

    setLoadingMore(true);
    try {
      const targetContainer = containers[nextIndex];
      const result = await getContainerSnaps(targetContainer.permlink);

      // Append next container's snaps to the feed
      setSnaps((prev) => [...prev, ...result.snaps]);
      setDiscussionMap((prev) => ({ ...prev, ...result.discussionMap }));
      setCurrentContainerIndex(nextIndex);
    } catch (err) {
      console.error('Failed to load next container snaps:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, containers, currentContainerIndex]);

  // Extract hashtags from all snaps and report to parent (for LeftSidebar)
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

    const serialized = JSON.stringify(tagList.slice(0, 30));
    if (serialized !== lastTagsRef.current) {
      lastTagsRef.current = serialized;
      if (onHashtagsExtracted) {
        onHashtagsExtracted(tagList);
      }
    }
  }, [snaps, onHashtagsExtracted]);

  // Check if snap contains any blocked word
  const isSnapBlocked = useCallback(
    (snap: HivePost): boolean => {
      if (!filterEnabled || !blockedWords || blockedWords.length === 0) return false;
      const bodyLower = (snap.body || '').toLowerCase();
      const authorLower = (snap.author || '').toLowerCase();
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
    [filterEnabled, blockedWords]
  );

  // Filter snaps based on spam words, selected tag, and search query
  const { visibleSnaps, hiddenCount } = useMemo(() => {
    let hidden = 0;
    const list: HivePost[] = [];

    for (const snap of snaps) {
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
  }, [snaps, isSnapBlocked, selectedTag, searchQuery]);

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
            app: 'nebulosa-web/0.0.1',
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
      } else {
        setPostErrorMessage(response.message || 'Failed to broadcast snap via Keychain.');
      }
    } catch (err: any) {
      console.error('Error posting snap:', err);
      setPostErrorMessage(err?.message || 'An error occurred while broadcasting snap.');
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
    <div id={id} className="max-w-2xl mx-auto space-y-4">
      {/* ================= SHORTS HEADER ================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-slate-800 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Shorts
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                  Microblogging
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Community snaps from Hive blockchain via <span className="font-semibold text-gray-700 dark:text-slate-300">@peak.snaps</span>
              </p>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => loadInitialFeed(true)}
            disabled={loading}
            className="flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs font-semibold text-gray-700 dark:text-slate-300 transition cursor-pointer disabled:opacity-50"
            title="Refresh latest snaps"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Live Container Tracking Info */}
        {activeContainer && (
          <div className="pt-2 border-t border-gray-50 dark:border-slate-800 flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500">
            <span className="truncate">
              Container {currentContainerIndex + 1} of {containers.length || 1} &bull;{' '}
              {new Date(activeContainer.created + 'Z').toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
            <span className="font-medium text-gray-500 dark:text-slate-400 flex-shrink-0">
              {snaps.length} snaps loaded
            </span>
          </div>
        )}
      </div>

      {/* ================= SHORTS COMPOSER (POST TO COMMUNITY) ================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-slate-800 shadow-xs space-y-3">
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
            className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-slate-700 flex-shrink-0 bg-gray-100 dark:bg-slate-800"
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
              className="w-full text-sm text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 bg-gray-50/80 dark:bg-slate-800/80 hover:bg-gray-50 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-850 rounded-xl p-3 border border-transparent dark:border-slate-700/60 focus:border-blue-500 focus:outline-none transition resize-none leading-relaxed"
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
        <div className="flex items-center justify-between pt-1 border-t border-gray-50 dark:border-slate-800">
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:cursor-not-allowed"
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

      {/* ================= ACTIVE FILTER BANNER ================= */}
      {(selectedTag || (hiddenCount > 0 && filterEnabled)) && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-2xl px-4 py-2.5 border border-gray-100 dark:border-slate-800 shadow-2xs text-xs">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {selectedTag && (
              <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium px-2.5 py-1 rounded-xl">
                <Hash className="w-3.5 h-3.5" />
                <span>#{selectedTag}</span>
                <button
                  onClick={() => onSelectTag && onSelectTag('')}
                  className="ml-1 hover:text-blue-900 dark:hover:text-blue-100 font-bold text-sm leading-none"
                  title="Clear hashtag filter"
                >
                  &times;
                </button>
              </div>
            )}
            {hiddenCount > 0 && filterEnabled && (
              <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-xl font-medium">
                <EyeOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>
                  {hiddenCount} {hiddenCount === 1 ? 'short' : 'shorts'} hidden by spam filter
                </span>
              </div>
            )}
          </div>

          {selectedTag && (
            <button
              onClick={() => onSelectTag && onSelectTag('')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              Show all
            </button>
          )}
        </div>
      )}

      {/* ================= ERROR STATE ================= */}
      {error && (
        <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 text-xs text-rose-800 flex items-start gap-3">
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
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-slate-800 shadow-xs animate-pulse space-y-3"
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
      {!loading && visibleSnaps.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-100 dark:border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <MessageCircle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white text-base">No snaps found</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto">
            {selectedTag
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
      <div className="space-y-3">
        {displayedSnaps.map((snap) => (
          <ShortCard
            key={`${snap.author}-${snap.permlink}`}
            snap={snap}
            discussionMap={discussionMap}
            currentUser={currentUser}
            onSelectAuthor={onSelectAuthor}
            onSelectTag={onSelectTag}
            onOpenDetail={(s) => setSelectedSnapForDetail(s)}
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
            className="px-5 py-2 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-300 rounded-full transition shadow-2xs hover:shadow-xs cursor-pointer inline-flex items-center gap-1.5"
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

      {/* ================= SHORT DETAIL MODAL (COMMENTS & THREADING) ================= */}
      {selectedSnapForDetail && (
        <ShortDetailModal
          snap={selectedSnapForDetail}
          initialDiscussionMap={discussionMap}
          currentUser={currentUser}
          onClose={() => setSelectedSnapForDetail(null)}
          onSelectAuthor={onSelectAuthor}
          onSelectTag={onSelectTag}
          onRequireLogin={onRequireLogin}
        />
      )}
    </div>
  );
};

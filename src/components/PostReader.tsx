import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowUp,
  X,
  Heart,
  MessageSquare,
  Clock,
  Calendar,
  Share2,
  ExternalLink,
  Check,
  User,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  Send,
  Coins,
  Repeat,
  AlertCircle,
  Hash,
  Bookmark,
  Loader2,
  CornerDownRight,
  UserPlus,
  UserCheck,
  VolumeX,
  Quote,
  Plus,
  Languages,
  Highlighter,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon
} from 'lucide-react';
import {
  HivePost,
  getDiscussion,
  calculateReputation,
  getHiveAvatarUrl,
  getPost,
  getPostSnippet,
  getAccount,
  getAccountPosts,
  getSimilarPosts,
  getPostThumbnail
} from '../services/hiveApi';
import { KeychainService, CurrentUser } from '../services/keychain';
import { markdownToSafeHtmlWithHeadings, markdownToSafeHtml, PostHeading } from '../utils/sanitize';
import { useAuth } from '../context/AuthContext';
import { VoteWeightDialog } from './VoteWeightDialog';
import { useContentFilter } from '../context/ContentFilterContext';

interface PostReaderProps {
  post: HivePost;
  onClose: () => void;
  onSelectAuthor: (author: string) => void;
  onSelectTag: (tag: string) => void;
  currentUser: CurrentUser | null;
  onRequireLogin?: () => void;
  onHeadingsExtracted?: (headings: PostHeading[]) => void;
  onActiveHeadingChange?: (id: string) => void;
  onSelectPost?: (post: HivePost) => void;
}

/**
 * Format timestamp safely preventing Invalid Date errors
 */
function formatPostDate(dateStr?: string): { relative: string; full: string } {
  if (!dateStr) return { relative: 'Recently', full: '' };
  try {
    const safeStr = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
    const date = new Date(safeStr);
    if (isNaN(date.getTime())) return { relative: 'Recently', full: dateStr };

    const diffMs = Math.max(0, Date.now() - date.getTime());
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    let relative = '';
    if (diffDay > 30) {
      relative = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } else if (diffDay > 0) {
      relative = `${diffDay}d ago`;
    } else if (diffHour > 0) {
      relative = `${diffHour}h ago`;
    } else if (diffMin > 0) {
      relative = `${diffMin}m ago`;
    } else {
      relative = 'just now';
    }

    const full = date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    return { relative, full };
  } catch {
    return { relative: 'Recently', full: dateStr || '' };
  }
}

/**
 * Extract all tags assigned to the post from category and json_metadata
 */
function extractPostTags(post: HivePost): string[] {
  const set = new Set<string>();
  if (post.category && !post.category.startsWith('hive-')) {
    set.add(post.category.toLowerCase());
  }

  if (post.json_metadata) {
    try {
      const meta = typeof post.json_metadata === 'string'
        ? JSON.parse(post.json_metadata)
        : post.json_metadata;

      if (Array.isArray(meta?.tags)) {
        for (const t of meta.tags) {
          if (typeof t === 'string' && t.trim()) {
            const clean = t.trim().toLowerCase().replace(/^#/, '');
            if (clean && !clean.startsWith('hive-')) {
              set.add(clean);
            }
          }
        }
      }
    } catch {}
  }

  return Array.from(set).slice(0, 10);
}

export const PostReader: React.FC<PostReaderProps> = ({
  post,
  onClose,
  onSelectAuthor,
  onSelectTag,
  currentUser,
  onRequireLogin,
  onHeadingsExtracted,
  onActiveHeadingChange,
  onSelectPost
}) => {
  const [discussion, setDiscussion] = useState<Record<string, HivePost>>({});
  const [loadingDiscussion, setLoadingDiscussion] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showVoters, setShowVoters] = useState(false);

  // Floating back/top navigation & reading progress
  const [scrolledDown, setScrolledDown] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);

  // Interactive Keychain states
  const [hasVoted, setHasVoted] = useState(false);
  const [showVoteSlider, setShowVoteSlider] = useState(false);
  const [voteWeight, setVoteWeight] = useState(100);
  const [voteLoading, setVoteLoading] = useState(false);

  const [newCommentBody, setNewCommentBody] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentSuccess, setCommentSuccess] = useState(false);

  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState('1.000');
  const [tipCurrency, setTipCurrency] = useState<'HIVE' | 'HBD'>('HIVE');
  const [tipMemo, setTipMemo] = useState('Thank you for this great post!');
  const [tipLoading, setTipLoading] = useState(false);
  const [tipNotice, setTipNotice] = useState<string | null>(null);

  // Author cover background
  const [authorCoverImage, setAuthorCoverImage] = useState<string | null>(null);
  const [loadingCover, setLoadingCover] = useState(true);

  // Related Stories / Fallback to Author's Latest Posts
  const [relatedStories, setRelatedStories] = useState<HivePost[]>([]);
  const [isAuthorFallback, setIsAuthorFallback] = useState(false);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // Selection floating toolbar state (desktop only)
  const bodyContainerRef = useRef<HTMLDivElement>(null);
  const [selectionBubble, setSelectionBubble] = useState<{
    visible: boolean;
    x: number;
    y: number;
    text: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
    text: ''
  });

  // Post Image Lightbox Gallery
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  // Handle image clicks inside article body to open the gallery
  const handleBodyClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && target instanceof HTMLImageElement) {
      const container = bodyContainerRef.current;
      if (!container) return;
      const allImgs = Array.from(container.querySelectorAll('img'))
        .map((img) => img.src)
        .filter((src) => src && !src.includes('avatar') && !src.startsWith('data:image/svg'));

      const clickedSrc = target.src;
      const idx = allImgs.indexOf(clickedSrc);
      if (allImgs.length > 0) {
        setGalleryImages(allImgs);
        setGalleryIndex(idx !== -1 ? idx : 0);
      }
    }
  }, []);

  // Keyboard navigation for image gallery
  useEffect(() => {
    if (galleryIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setGalleryIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setGalleryIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : galleryImages.length - 1));
      } else if (e.key === 'ArrowRight') {
        setGalleryIndex((prev) => (prev !== null && prev < galleryImages.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [galleryIndex, galleryImages.length]);

  // Mouse wheel listener for the reader lightbox gallery
  const readerLightboxRef = useRef<HTMLDivElement>(null);
  const readerLastWheelTimeRef = useRef(0);

  useEffect(() => {
    if (galleryIndex === null) return;
    const el = readerLightboxRef.current;
    if (!el) return;

    const onWheelNative = (e: WheelEvent) => {
      if (galleryImages.length <= 1) return;
      if (Math.abs(e.deltaY) < 12 && Math.abs(e.deltaX) < 12) return;
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      if (now - readerLastWheelTimeRef.current < 260) return;
      readerLastWheelTimeRef.current = now;

      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (delta > 0) {
        setGalleryIndex((prev) => (prev !== null && prev < galleryImages.length - 1 ? prev + 1 : 0));
      } else {
        setGalleryIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : galleryImages.length - 1));
      }
    };

    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, [galleryIndex, galleryImages.length]);

  // Fetch author profile background cover image
  useEffect(() => {
    let active = true;
    setLoadingCover(true);
    getAccount(post.author)
      .then((acc) => {
        if (!active || !acc) {
          if (active) setLoadingCover(false);
          return;
        }
        let cover = '';
        if (acc.posting_json_metadata) {
          try {
            const parsed = JSON.parse(acc.posting_json_metadata);
            cover = parsed?.profile?.cover_image || '';
          } catch {}
        }
        if (!cover && acc.json_metadata) {
          try {
            const parsed = JSON.parse(acc.json_metadata);
            cover = parsed?.profile?.cover_image || '';
          } catch {}
        }
        if (active) {
          setAuthorCoverImage(cover || null);
          if (!cover) setLoadingCover(false);
        }
      })
      .catch(() => {
        if (active) setLoadingCover(false);
      });

    return () => {
      active = false;
    };
  }, [post.author]);

  // Fetch similar stories with fallback to author's recent posts (sort: 'posts', NOT 'blog'!)
  useEffect(() => {
    let active = true;
    setLoadingRelated(true);
    setIsAuthorFallback(false);

    getSimilarPosts(post.author, post.permlink)
      .then(async (data) => {
        if (!active) return;
        if (data && data.length > 0) {
          setRelatedStories(data);
          setIsAuthorFallback(false);
        } else {
          // Fallback: Author's latest created posts (sort: 'posts', NOT 'blog'!)
          const authorPosts = await getAccountPosts('posts', post.author, 6).catch(() => []);
          if (!active) return;
          const filtered = (authorPosts || [])
            .filter((p) => p.permlink !== post.permlink)
            .slice(0, 4);
          setRelatedStories(filtered);
          setIsAuthorFallback(true);
        }
      })
      .catch(async () => {
        if (!active) return;
        const authorPosts = await getAccountPosts('posts', post.author, 6).catch(() => []);
        if (!active) return;
        const filtered = (authorPosts || [])
          .filter((p) => p.permlink !== post.permlink)
          .slice(0, 4);
        setRelatedStories(filtered);
        setIsAuthorFallback(true);
      })
      .finally(() => {
        if (active) setLoadingRelated(false);
      });

    return () => {
      active = false;
    };
  }, [post.author, post.permlink]);

  // Floating text selection listener (Desktop only, avoids conflicts on mobile)
  useEffect(() => {
    const handleSelection = () => {
      // Disallow on touch/mobile devices to preserve native context menu
      if (window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches) {
        setSelectionBubble((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setSelectionBubble((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const text = sel.toString().trim();
      if (!text || text.length < 2) {
        setSelectionBubble((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const anchor = sel.anchorNode;
      if (!anchor || !bodyContainerRef.current?.contains(anchor)) {
        setSelectionBubble((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        setSelectionBubble({
          visible: true,
          x: Math.max(16, Math.min(window.innerWidth - 260, rect.left + rect.width / 2 - 120)),
          y: Math.max(72, rect.top - 46),
          text
        });
      } catch {
        setSelectionBubble((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      }
    };

    document.addEventListener('selectionchange', handleSelection);
    return () => {
      document.removeEventListener('selectionchange', handleSelection);
    };
  }, []);

  const handleQuoteSelection = () => {
    if (!selectionBubble.text) return;
    const quoteLines = selectionBubble.text
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
    const quoteFormatted = `${quoteLines}\n\n`;

    setNewCommentBody((prev) => {
      return prev ? `${prev.trim()}\n\n${quoteFormatted}` : quoteFormatted;
    });

    setSelectionBubble((prev) => ({ ...prev, visible: false }));
    window.getSelection()?.removeAllRanges();

    const commentSection = document.getElementById('comments-section');
    if (commentSection) {
      commentSection.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        const textarea = commentSection.querySelector('textarea');
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
      }, 400);
    }
  };

  const handleTranslateSelection = () => {
    if (!selectionBubble.text) return;
    const encoded = encodeURIComponent(selectionBubble.text.slice(0, 1500));
    window.open(`https://translate.google.com/?sl=auto&tl=pt&text=${encoded}`, '_blank', 'noopener,noreferrer');
    setSelectionBubble((prev) => ({ ...prev, visible: false }));
  };

  const handleHighlightSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    try {
      const range = sel.getRangeAt(0);
      const mark = document.createElement('mark');
      mark.className = 'bg-amber-200/90 dark:bg-amber-400/35 text-gray-900 dark:text-amber-100 rounded px-1 py-0.5 shadow-2xs transition-colors';
      mark.style.backgroundColor = 'rgba(254, 240, 138, 0.85)';

      try {
        range.surroundContents(mark);
      } catch {
        const contents = range.extractContents();
        mark.appendChild(contents);
        range.insertNode(mark);
      }
    } catch {
      try {
        document.execCommand('hiliteColor', false, '#fef08a');
      } catch {}
    }

    setSelectionBubble((prev) => ({ ...prev, visible: false }));
    sel.removeAllRanges();
  };

  const onCloseRef = React.useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
  window.scrollTo({ top: 0, behavior: 'auto' });
}, [post.author, post.permlink]);

  // Handle Escape key to close post reader
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Full post resolution (guarantees complete body if opened from truncated sources like Similar Stories)
  const [fullPost, setFullPost] = useState<HivePost | null>(null);
  const [loadingFullBody, setLoadingFullBody] = useState<boolean>(false);
  const [loadBodyError, setLoadBodyError] = useState<boolean>(false);

  useEffect(() => {
    setLoadBodyError(false);

    // Check if the post requires fetching the complete authoritative version directly from Hive blockchain
    const needsBlockchainFetch = Boolean(
      post.is_truncated ||
      post.from_recommendation ||
      !post.body ||
      post.body.trim().length <= 300 ||
      (post.body.length <= 250 && (post.body.endsWith('...') || post.body.endsWith('…')))
    );

    if (!needsBlockchainFetch) {
      setFullPost(post);
      setLoadingFullBody(false);
      return;
    }

    // Otherwise (truncated snippet, recommendation feed, or missing body), fetch full post from Hive RPC
    let active = true;
    setLoadingFullBody(true);
    getPost(post.author, post.permlink, currentUser?.username || '', true)
      .then((data) => {
        if (!active) return;
        if (data && typeof data.body === 'string' && data.body.trim().length > 0) {
          setFullPost({ ...data, is_truncated: false, from_recommendation: false });
        } else if (post.body) {
          setFullPost({ ...post, is_truncated: false, from_recommendation: false });
        } else {
          setLoadBodyError(true);
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error('Failed to load full post in reader:', err);
        if (post.body) {
          setFullPost({ ...post, is_truncated: false, from_recommendation: false });
        } else {
          setLoadBodyError(true);
        }
      })
      .finally(() => {
        if (active) setLoadingFullBody(false);
      });

    return () => {
      active = false;
    };
  }, [post.author, post.permlink, post.body, post.is_truncated, post.from_recommendation, currentUser?.username]);

  const currentPost =
    fullPost &&
    fullPost.author.replace(/^@/, '').toLowerCase() === post.author.replace(/^@/, '').toLowerCase() &&
    fullPost.permlink === post.permlink
      ? fullPost
      : post;

  // Only show skeleton loader if fetch is actively loading AND we don't have a full body yet
  const isBodyLoading =
    loadingFullBody &&
    (!currentPost.body || currentPost.body.trim().length <= 300 || Boolean(currentPost.is_truncated));

  // Parse HTML and headings safely with DOMPurify
  const { html: safeHtmlContent, headings } = useMemo(() => {
    return markdownToSafeHtmlWithHeadings(currentPost.body || '');
  }, [currentPost.body]);

  // Inform parent / sidebar about extracted headings
  useEffect(() => {
    if (onHeadingsExtracted) {
      onHeadingsExtracted(headings);
    }
  }, [headings, onHeadingsExtracted]);

  // Track window scroll for floating back/top bar and reading progress
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setScrolledDown(scrollY > 240);

      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const progress = Math.min(100, Math.max(0, Math.round((scrollY / docHeight) * 100)));
        setReadingProgress(progress);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Comment context state
  const isComment = Boolean(post.parent_author && post.parent_author.length > 0) || (post.depth !== undefined && post.depth > 0);
  const isPeakSnap = useMemo(() => {
    if (!isComment) return false;
    const pAuthor = post.parent_author?.toLowerCase() || '';
    const pPerm = post.parent_permlink?.toLowerCase() || '';
    const cat = post.category?.toLowerCase() || '';
    return (
      pAuthor === 'peak.snaps' ||
      cat === 'peak-snaps' ||
      pPerm.includes('peak-snaps') ||
      pPerm.startsWith('snap-')
    );
  }, [isComment, post.parent_author, post.parent_permlink, post.category]);

  const isEcencyWave = useMemo(() => {
    if (!isComment) return false;
    const pAuthor = post.parent_author?.toLowerCase() || '';
    const pPerm = post.parent_permlink?.toLowerCase() || '';
    const cat = post.category?.toLowerCase() || '';
    return (
      pAuthor === 'ecency.waves' ||
      pAuthor === 'ecency.stats' ||
      cat === 'ecency-waves' ||
      pPerm.includes('ecency-wave') ||
      pPerm.startsWith('wave-')
    );
  }, [isComment, post.parent_author, post.parent_permlink, post.category]);

  const isMicroblog = isPeakSnap || isEcencyWave;

  const [parentPost, setParentPost] = useState<HivePost | null>(null);
  const [loadingParent, setLoadingParent] = useState<boolean>(false);

  // Fetch parent post/comment context if this is a comment
  useEffect(() => {
    if (isComment && post.parent_author && post.parent_permlink) {
      let isMounted = true;
      setLoadingParent(true);
      getPost(post.parent_author, post.parent_permlink)
        .then((p) => {
          if (isMounted) {
            setParentPost(p);
            setLoadingParent(false);
          }
        })
        .catch(() => {
          if (isMounted) setLoadingParent(false);
        });
      return () => {
        isMounted = false;
      };
    } else {
      setParentPost(null);
      setLoadingParent(false);
    }
  }, [isComment, post.parent_author, post.parent_permlink]);

  const { isFollowing, setFollowingUsersList } = useAuth();
  const { config: contentFilterConfig, addFilterAuthor, removeFilterAuthor } = useContentFilter();
  const [followLoading, setFollowLoading] = useState<string | null>(null);

  const handleToggleFollowAuthor = async (targetAuthor: string) => {
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      else window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
      return;
    }
    const cleanTarget = targetAuthor.trim().toLowerCase().replace(/^@/, '');
    const currentlyFollowing = isFollowing(cleanTarget);
    setFollowLoading(cleanTarget);

    try {
      const res = currentlyFollowing
        ? await KeychainService.unfollowUser(currentUser.username, cleanTarget)
        : await KeychainService.followUser(currentUser.username, cleanTarget);

      if (res.success) {
        setFollowingUsersList((prev) => {
          if (currentlyFollowing) {
            return prev.filter((u) => u.toLowerCase() !== cleanTarget);
          } else {
            return [...prev, cleanTarget];
          }
        });
      } else {
        alert(res.message || res.error || 'Failed to update follow status.');
      }
    } catch (err: any) {
      alert(err?.message || 'Keychain error.');
    } finally {
      setFollowLoading(null);
    }
  };

  const handleToggleMuteAuthor = (targetAuthor: string) => {
    const cleanTarget = targetAuthor.trim().toLowerCase().replace(/^@/, '');
    const isMuted = contentFilterConfig.authors.includes(cleanTarget);
    if (isMuted) {
      removeFilterAuthor(cleanTarget);
    } else {
      addFilterAuthor(cleanTarget);
    }
  };

  // State for expanding long parent comments in quote container
  const [expandedParentComment, setExpandedParentComment] = useState(false);

  // Keychain Reblog state and handler
  const [isReblogging, setIsReblogging] = useState(false);
  const [hasReblogged, setHasReblogged] = useState(() => {
    if (currentUser?.username && post.reblogged_by) {
      return post.reblogged_by.some(
        (u: any) => (typeof u === 'string' ? u : u?.account || '').toLowerCase() === currentUser.username.toLowerCase()
      );
    }
    return false;
  });

  const handleReblog = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      else window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
      return;
    }
    if (isReblogging || hasReblogged) return;
    const confirmed = window.confirm(`Reblog "@${post.author}/${post.permlink}" to your followers?`);
    if (!confirmed) return;

    setIsReblogging(true);
    try {
      const res = await KeychainService.reblog(currentUser.username, post.author, post.permlink);
      if (res.success) {
        setHasReblogged(true);
      } else {
        alert(res.message || res.error || 'Reblog was not completed in Keychain.');
      }
    } catch (err: any) {
      alert(err?.message || 'Reblog request failed.');
    } finally {
      setIsReblogging(false);
    }
  };

  // Discussion is loaded without an observer. Hivemind drops the thread for
  // some accounts when that argument is set. A generation counter drops
  // responses from a post the reader has already left.
  const discussionGen = useRef(0);
  const fetchDiscussion = useCallback((forceRefresh = false) => {
    const gen = ++discussionGen.current;
    setLoadingDiscussion(true);
    getDiscussion(post.author, post.permlink, forceRefresh)
      .then((data) => {
        if (gen !== discussionGen.current) return;
        setDiscussion(data || {});
        setLoadingDiscussion(false);
      })
      .catch(() => {
        if (gen !== discussionGen.current) return;
        setLoadingDiscussion(false);
      });
  }, [post.author, post.permlink]);

  useEffect(() => {
    fetchDiscussion(false);
  }, [fetchDiscussion]);

  // Check if current user has already voted
  useEffect(() => {
    if (currentUser?.username && post.active_votes) {
      const alreadyVoted = post.active_votes.some(
        v => v.voter.toLowerCase() === currentUser.username.toLowerCase()
      );
      if (alreadyVoted) setHasVoted(true);
    }
  }, [currentUser?.username, post.active_votes]);

  const scrollToComments = () => {
    const el = document.getElementById('comments-section');
    if (el) {
      const yOffset = -75;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const rep = calculateReputation(post.author_reputation);
  const avatarUrl = getHiveAvatarUrl(post.author, 'medium');
  const postDate = formatPostDate(post.created);
  const postTags = extractPostTags(post);

  const handleCopyLink = () => {
    const url = `https://ecency.com/@${post.author}/${post.permlink}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVoteSubmit = async () => {
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      return;
    }

    setVoteLoading(true);
    try {
      const weightPoints = Math.round(voteWeight * 100); // 100% = 10000
      const res = await KeychainService.vote(currentUser.username, post.author, post.permlink, weightPoints);
      if (res.success) {
        setHasVoted(true);
        setShowVoteSlider(false);
      } else {
        alert(res.message || 'Unable to broadcast vote via Keychain');
      }
    } catch (err: any) {
      alert(err.message || 'Vote failed');
    } finally {
      setVoteLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentBody.trim()) return;
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      return;
    }

    setCommentLoading(true);
    try {
      const res = await KeychainService.postComment(
        currentUser.username,
        post.author,
        post.permlink,
        newCommentBody.trim()
      );

      if (res.success) {
        setCommentSuccess(true);
        setNewCommentBody('');
        setTimeout(() => setCommentSuccess(false), 4000);
        fetchDiscussion(true);
      } else {
        alert(res.message || 'Could not post comment via Keychain');
      }
    } catch (err: any) {
      alert(err.message || 'Comment broadcast failed');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleSendTip = async () => {
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      return;
    }

    setTipLoading(true);
    try {
      const res = await KeychainService.tip(
        currentUser.username,
        post.author,
        parseFloat(tipAmount).toFixed(3),
        tipMemo,
        tipCurrency
      );

      if (res.success) {
        setTipNotice(`Successfully sent ${tipAmount} ${tipCurrency} tip to @${post.author}!`);
        setTimeout(() => {
          setTipNotice(null);
          setShowTipModal(false);
        }, 3000);
      } else {
        alert(res.message || 'Tip transfer failed');
      }
    } catch (err: any) {
      alert(err.message || 'Tip failed');
    } finally {
      setTipLoading(false);
    }
  };

  const getComments = (): HivePost[] => {
    const key = `${post.author}/${post.permlink}`;
    const root = discussion[key] || post;
    let list: HivePost[] = [];
    if (root.replies && root.replies.length > 0) {
      list = root.replies
        .map((replyKey) => discussion[replyKey])
        .filter((p): p is HivePost => !!p);
    } else {
      list = Object.values(discussion).filter(
        item => item.parent_author === post.author && item.parent_permlink === post.permlink
      );
    }
    const mutedSet = new Set((contentFilterConfig.authors || []).map(a => a.toLowerCase().trim()));
    return list.filter(p => !mutedSet.has(p.author.toLowerCase().trim()));
  };

  const comments = getComments();
  const totalCommentsCount = useMemo(() => {
    const key = `${post.author}/${post.permlink}`;
    const discussionComments = Object.keys(discussion).filter(k => k !== key).length;
    return Math.max(post.children || 0, discussionComments);
  }, [post.children, post.author, post.permlink, discussion]);
  const totalVotesCount = (post.stats?.total_votes || post.active_votes?.length || 0) + (hasVoted ? 1 : 0);
  const payoutString = post.payout ? `$${post.payout.toFixed(3)}` : (post.pending_payout_value || '$0.000');

  return (
    <article
      id="in-place-post-reader"
      className="bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none border-0 sm:border border-gray-100/70 dark:border-slate-800 flex flex-col w-full animate-in fade-in duration-200 relative"
    >
      {/* Top Reading Progress Line */}
      <div
        className="h-1 bg-gradient-to-r from-blue-500 to-indigo-600 sticky top-0 md:top-16 z-30 transition-all duration-150"
        style={{ width: `${readingProgress}%` }}
      />

      {/* ================= FORUM QUOTE CONTAINER FOR REPLIED-TO COMMENT (MOBILE: PLACED ON TOP BEFORE USER PHOTO & COMMENT) ================= */}
      {isComment && !isMicroblog && (
        <div className="sm:hidden px-2.5 pt-2.5 pb-1 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800/80">
          <div
            onClick={() => {
              if (parentPost && onSelectPost) {
                onSelectPost(parentPost);
              }
            }}
            className="rounded-2xl bg-gradient-to-b from-blue-50/90 via-indigo-50/40 to-blue-50/30 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900 border border-blue-200/80 dark:border-blue-900/50 p-3 shadow-2xs hover:shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group active:scale-[0.99] space-y-2"
            title="Tap anywhere to open parent discussion"
          >
            {/* Reblog-style highlighted Reply banner with parent avatar */}
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-blue-100/80 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-950 dark:text-blue-200 w-full overflow-hidden shadow-2xs">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <img
                  src={getHiveAvatarUrl(post.parent_author || '', 'small')}
                  alt={post.parent_author || ''}
                  className="w-5 h-5 rounded-full object-cover ring-1 ring-blue-400/60 bg-gray-100 dark:bg-slate-700 flex-shrink-0 shadow-2xs"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                  }}
                />
                <div className="truncate flex items-center gap-1 min-w-0">
                  <span className="text-blue-700 dark:text-blue-400 font-medium">Replying to</span>
                  <span className="font-bold text-blue-950 dark:text-blue-100 truncate">@{post.parent_author}</span>
                  {parentPost?.created && (
                    <span className="text-blue-600/70 dark:text-blue-400/70 text-[11px] truncate">
                      • {formatPostDate(parentPost.created).relative}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-200/90 dark:bg-blue-900/80 text-blue-900 dark:text-blue-100 flex-shrink-0 shadow-2xs">
                Reply
              </span>
            </div>

            {/* Inner box with distinct border showing the replied-to comment text */}
            <div className="bg-white/95 dark:bg-slate-900/90 rounded-xl p-3 border border-blue-150/90 dark:border-slate-800 shadow-2xs space-y-1.5">
              {parentPost?.title && !parentPost.title.startsWith('Re: ') && (
                <div className="font-bold text-xs text-gray-900 dark:text-slate-100 line-clamp-1 pb-1 border-b border-gray-100 dark:border-slate-800/80">
                  {parentPost.title}
                </div>
              )}

              {parentPost ? (
                <div className="text-xs sm:text-sm text-gray-800 dark:text-slate-200 leading-relaxed">
                  <p className={expandedParentComment ? '' : 'line-clamp-4'}>
                    {getPostSnippet(parentPost.body, expandedParentComment ? 3000 : 320)}
                  </p>
                  {(parentPost.body?.length || 0) > 320 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedParentComment(!expandedParentComment);
                      }}
                      className="inline-flex items-center gap-1 mt-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition cursor-pointer"
                    >
                      <span>{expandedParentComment ? 'Show Less' : 'More...'}</span>
                    </button>
                  )}
                </div>
              ) : loadingParent ? (
                <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 animate-pulse py-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading replied comment from Hive...</span>
                </div>
              ) : post.parent_permlink ? (
                <p className="text-xs text-gray-500 dark:text-slate-400 italic">
                  Replying to discussion thread: "{String(post.parent_permlink).replace(/[-_]/g, ' ')}"
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ================= UNIFIED TOP BREADCRUMB & AUTHOR HEADER BAR ================= */}
      <div className="flex items-center justify-between px-2.5 sm:px-6 py-2 sm:py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 md:top-16 z-20 border-b border-gray-100 dark:border-slate-800 gap-2 sm:gap-3">

        {/* Left: Back button (desktop only) + Author details */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            id="back-to-feed-btn"
            onClick={onClose}
            className="hidden sm:flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-bold text-xs transition shadow-2xs cursor-pointer flex-shrink-0"
            title="Back to Feed (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Author avatar with mobile quick follow/following badge */}
          <div className="relative inline-block flex-shrink-0">
            <button
              onClick={() => onSelectAuthor(post.author)}
              className="focus:outline-none flex-shrink-0 group cursor-pointer block"
              title={`View @${post.author} profile`}
            >
              <img
                src={avatarUrl}
                alt={post.author}
                className="w-10 h-10 sm:w-9 sm:h-9 rounded-full object-cover ring-2 ring-blue-500/20 group-hover:ring-blue-500 transition shadow-2xs bg-gray-100 dark:bg-slate-800"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/medium';
                }}
              />
            </button>

            {/* Mobile quick follow/following badge inside author photo */}
            {(!currentUser || currentUser.username.toLowerCase() !== post.author.toLowerCase()) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFollowAuthor(post.author);
                }}
                disabled={followLoading === post.author.toLowerCase()}
                className={`sm:hidden absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full flex items-center justify-center text-white ring-2 ring-white dark:ring-slate-900 shadow-xs transition-transform active:scale-90 cursor-pointer ${
                  isFollowing(post.author)
                    ? 'bg-blue-600 dark:bg-blue-500'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                title={isFollowing(post.author) ? 'Following author (click to unfollow)' : 'Follow author'}
                aria-label={isFollowing(post.author) ? 'Following author' : 'Follow author'}
              >
                {isFollowing(post.author) ? (
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                ) : (
                  <Plus className="w-2.5 h-2.5 stroke-[3]" />
                )}
              </button>
            )}
          </div>

          {/* Author info & metadata */}
          <div className="min-w-0 flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
            <button
              onClick={() => onSelectAuthor(post.author)}
              className="font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition truncate cursor-pointer text-xs sm:text-sm max-w-[110px] xs:max-w-[140px] sm:max-w-none"
            >
              @{post.author}
            </button>
            <span className="hidden sm:inline-flex text-[10px] sm:text-[11px] font-semibold px-1.5 py-0.2 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
              {rep}
            </span>

            {/* Author Quick Follow (Desktop) & Mute (Desktop + Mobile) */}
            {(!currentUser || currentUser.username.toLowerCase() !== post.author.toLowerCase()) && (
              <div className="flex items-center gap-1 ml-0.5">
                {/* Desktop pill follow button */}
                <button
                  type="button"
                  onClick={() => handleToggleFollowAuthor(post.author)}
                  disabled={followLoading === post.author.toLowerCase()}
                  className={`hidden sm:inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold transition cursor-pointer disabled:opacity-50 ${
                    isFollowing(post.author)
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                  }`}
                  title={isFollowing(post.author) ? 'Click to unfollow' : 'Follow this author on Hive'}
                >
                  {isFollowing(post.author) ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3 h-3" />
                      <span>Follow</span>
                    </>
                  )}
                </button>

                {/* Mute button directly next to author info */}
                <button
                  type="button"
                  onClick={() => handleToggleMuteAuthor(post.author)}
                  className={`p-1 rounded-full text-xs transition cursor-pointer ${
                    contentFilterConfig.authors.includes(post.author.toLowerCase())
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                      : 'text-gray-400 hover:text-rose-600 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                  title={
                    contentFilterConfig.authors.includes(post.author.toLowerCase())
                      ? 'Author is muted (Click to unmute)'
                      : 'Mute this author (hide their posts & comments)'
                  }
                >
                  <VolumeX className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Date / relative time when comment/post was made (shown on mobile & desktop) */}
            <span className="text-gray-400 dark:text-slate-500 text-[11px] sm:text-xs flex items-center gap-1" title={postDate.full}>
              <span className="text-gray-300 dark:text-slate-600">•</span>
              <Clock className="w-3 h-3 text-gray-400 dark:text-slate-500 hidden sm:inline" />
              <span>{postDate.relative}</span>
            </span>

            {/* Desktop only: Comment badge; hidden on mobile to save space */}
            {isComment && (
              <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                Comment
              </span>
            )}

            {(post.community_title || post.community) && (
              <>
                <span className="text-gray-300 dark:text-slate-600 hidden md:inline">•</span>
                <button
                  onClick={() => {
                    onSelectTag(post.community || post.category);
                    onClose();
                  }}
                  className="hidden md:flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition truncate cursor-pointer text-xs"
                  title="View Community"
                >
                  <Layers className="w-3 h-3 text-blue-500 flex-shrink-0" />
                  <span className="truncate">{post.community_title || post.community}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right Actions: Shortcut to Comments, Share, Ecency, Close */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Header Shortcut to Comments (hidden on mobile comments as requested) */}
          <button
            onClick={scrollToComments}
            className={`${
              isComment ? 'hidden sm:flex' : 'flex'
            } items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 text-xs font-bold transition border border-blue-200/60 dark:border-blue-900/60 shadow-2xs cursor-pointer flex-shrink-0`}
            title={`Jump directly to ${totalCommentsCount} comments`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{totalCommentsCount}</span>
            <span className="hidden lg:inline text-[11px] font-medium text-blue-600/80 dark:text-blue-400/80">Comments</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="p-1.5 rounded-xl text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer hidden sm:flex"
            title="Copy Hive link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>

          <a
            href={`https://ecency.com/@${post.author}/${post.permlink}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-xl text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer hidden sm:flex"
            title="View on Ecency.com"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer flex-shrink-0"
            title="Close post (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ================= POST CONTENT AREA ================= */}
      <div className="py-4 sm:py-6 space-y-5 w-full max-w-full px-2 sm:px-10">

        {/* ================= COMMENT PARENT CONTEXT BANNER (DESKTOP ONLY) ================= */}
        {isComment && (
          <div className="hidden sm:block p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-blue-50/90 dark:from-blue-950/40 via-indigo-50/70 dark:via-indigo-950/30 to-blue-50/40 dark:to-slate-900 border border-blue-100/90 dark:border-blue-900/40 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="text-[11px] font-bold uppercase tracking-wider bg-blue-100/80 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full">
                      {parentPost?.depth && parentPost.depth > 0 ? 'Nested Comment Reply' : 'Comment on Root Post'}
                    </span>
                    <span className="text-gray-500 dark:text-slate-400">In response to</span>
                    {post.parent_author && (
                      <button
                        type="button"
                        onClick={() => onSelectAuthor(post.parent_author!)}
                        className="font-bold text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 hover:underline cursor-pointer"
                      >
                        @{post.parent_author}
                      </button>
                    )}
                  </div>
                  {parentPost && (
                    <span className="text-[11px] text-gray-400 dark:text-slate-500">
                      Original discussion published {formatPostDate(parentPost.created).relative}
                    </span>
                  )}
                </div>
              </div>

              {/* Button to navigate to parent post */}
              {parentPost && onSelectPost && (
                <button
                  type="button"
                  onClick={() => onSelectPost(parentPost)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800 hover:bg-blue-600 dark:hover:bg-blue-600 text-blue-700 dark:text-blue-300 hover:text-white dark:hover:text-white font-bold text-xs shadow-2xs border border-blue-200 dark:border-blue-800 hover:border-blue-600 transition cursor-pointer group/parent flex-shrink-0"
                  title="Open and read the parent post or comment"
                >
                  <span>Open Parent {parentPost.depth && parentPost.depth > 0 ? 'Comment' : 'Post'}</span>
                  <ArrowLeft className="w-3.5 h-3.5 rotate-180 group-hover/parent:translate-x-0.5 transition-transform" />
                </button>
              )}
            </div>

            {/* Parent Content Preview */}
            {parentPost ? (
              <div className="bg-white/95 dark:bg-slate-800/90 p-3.5 sm:p-4 rounded-2xl border border-blue-150/80 dark:border-blue-900/40 text-xs sm:text-sm text-gray-700 dark:text-slate-200 space-y-1.5">
                {parentPost.title && !parentPost.title.startsWith('Re: ') && (
                  <div className="font-bold text-gray-900 dark:text-white text-sm sm:text-base line-clamp-1">
                    {parentPost.title}
                  </div>
                )}
                <p className="line-clamp-3 text-gray-600 dark:text-slate-300 leading-relaxed italic text-xs sm:text-sm">
                  "{getPostSnippet(parentPost.body, 250)}"
                </p>
              </div>
            ) : loadingParent ? (
              <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 animate-pulse py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Fetching parent post context from Hive...</span>
              </div>
            ) : post.parent_permlink ? (
              <div className="text-xs text-gray-500 dark:text-slate-400 italic bg-white/70 dark:bg-slate-800/70 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40">
                Replying to discussion thread: "{String(post.parent_permlink).replace(/[-_]/g, ' ')}"
              </div>
            ) : null}
          </div>
        )}

        {/* Mobile Microblog Header (PeakD Snap / Ecency Wave) */}
        {isComment && isMicroblog && (
          <div className="sm:hidden flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 border border-cyan-200 dark:border-cyan-800">
              {isPeakSnap ? 'PeakD Snap • Microblog' : 'Ecency Wave • Microblog'}
            </span>
          </div>
        )}

        {/* ================= HERO TITLE BANNER (HIDDEN ON MOBILE FOR COMMENTS) ================= */}
        {(() => {
          const primaryTagOrCommunity =
            post.community_title || (post.community ? post.community : post.category) || 'blog';

          return (
            <div
              className={`relative rounded-xl sm:rounded-[22px] overflow-hidden ${
                isComment ? 'hidden sm:flex' : 'flex'
              } flex-col justify-start items-start gap-2.5 shadow-sm border border-blue-200/50 dark:border-blue-900/40 mb-6 bg-slate-900/10 dark:bg-slate-900/40 p-4 sm:p-6 min-h-[140px]`}
            >
              {/* Skeleton placeholder while cover image or data is loading to prevent layout shift */}
              {loadingCover && (
                <div className="absolute inset-0 bg-blue-100/60 dark:bg-blue-950/40 animate-pulse z-0" />
              )}

              {/* Cover Image Background (Luminous, Lightened & Softly Blurred) */}
              {authorCoverImage ? (
                <img
                  src={authorCoverImage}
                  alt=""
                  onLoad={() => setLoadingCover(false)}
                  className="absolute inset-0 w-full h-full object-cover filter brightness-[1.15] contrast-[1.02] blur-[3.5px] scale-110 transition-opacity duration-300"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                    setAuthorCoverImage(null);
                    setLoadingCover(false);
                  }}
                />
              ) : (
                /* Elegant scenic gradient fallback in light luminous blue tones */
                <div className="absolute inset-0 bg-gradient-to-r from-[#1e3a8a]/40 via-[#2563eb]/30 to-[#38bdf8]/40 filter blur-[4px] scale-110" />
              )}

              {/* Light luminous tint overlay: clear & bright, with a soft blue tone from the project */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-950/35 via-blue-900/15 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-blue-500/10 pointer-events-none" />

              {/* Single Main Tag/Community Pill Badge inside the banner (top-left, flex-shrink-0 so never hidden) */}
              <div className="relative z-10 flex-shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (post.community) onSelectTag(post.community);
                    else if (post.category) onSelectTag(post.category);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold backdrop-blur-md border border-blue-300/30 shadow-xs transition-colors cursor-pointer flex-shrink-0"
                  title={`View #${primaryTagOrCommunity}`}
                >
                  <span className="text-[11px] opacity-90">✦</span>
                  <span className="capitalize">{primaryTagOrCommunity}</span>
                </button>
              </div>

              {/* Big, Clear Post Title: uppercase, glued right below tag, expanding downwards, full title without truncation */}
              <h1
                className="relative z-10 font-black uppercase leading-tight sm:leading-snug tracking-tight text-white max-w-full break-words text-lg sm:text-2xl md:text-3xl"
                title={post.title}
                style={{
                  border: 'none',
                  outline: 'none',
                  textShadow:
                    '0 1px 2px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.85), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                  WebkitTextStroke: '0.5px #000000'
                }}
              >
                {isComment && (!post.title || post.title.startsWith('Re:'))
                  ? `Comment by @${post.author}`
                  : post.title}
              </h1>
            </div>
          );
        })()}

        {/* Main Article Body (DOMPurify protected) */}
        {isBodyLoading ? (
          <div className="space-y-4 py-8 animate-pulse">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
              <span>Loading full story content from Hive blockchain...</span>
            </div>
            <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-5/6" />
            <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-4/6" />
            <div className="h-48 bg-gray-100 dark:bg-slate-800/60 rounded-2xl w-full" />
            <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-3/4" />
          </div>
        ) : (
          <div
            id="sanitized-post-body"
            ref={bodyContainerRef}
            onClick={handleBodyClick}
            className="article-body max-w-none text-gray-800 dark:text-slate-100 leading-relaxed break-words pt-2 text-base sm:text-lg select-text"
          >
            {safeHtmlContent && safeHtmlContent.trim().length > 0 ? (
              <div dangerouslySetInnerHTML={{ __html: safeHtmlContent }} />
            ) : loadBodyError ? (
              <div className="py-8 text-center space-y-3">
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Unable to load content from the Hive blockchain at this moment.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setLoadingFullBody(true);
                    setLoadBodyError(false);
                    getPost(post.author, post.permlink, currentUser?.username || '', true)
                      .then((data) => {
                        if (data && typeof data.body === 'string') {
                          setFullPost({ ...data, is_truncated: false });
                        } else {
                          setLoadBodyError(true);
                        }
                      })
                      .catch(() => setLoadBodyError(true))
                      .finally(() => setLoadingFullBody(false));
                  }}
                  className="px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-xs font-semibold transition cursor-pointer"
                >
                  Retry Loading
                </button>
              </div>
            ) : (
              <p className="text-sm italic text-gray-400 dark:text-slate-500 py-4">
                No story content found.
              </p>
            )}
          </div>
        )}


        {/* Full Tags Section at bottom of post (HIDDEN ON COMMENTS) */}
        {!isComment && postTags.length > 0 && (
          <div className="pt-4 pb-2 border-t border-gray-100 dark:border-slate-800 space-y-2">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Topics & Tags
            </span>
            <div className="flex flex-wrap gap-2">
              {postTags.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    onSelectTag(t);
                    onClose();
                  }}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-gray-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium border border-gray-200 dark:border-slate-700 transition cursor-pointer"
                >
                  <Hash className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                  <span>{t}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Beneficiaries if present */}
        {post.beneficiaries && post.beneficiaries.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-gray-50/80 dark:bg-slate-800/60 text-xs text-gray-500 dark:text-slate-400 space-y-1">
            <span className="font-semibold text-gray-700 dark:text-slate-300">Beneficiaries:</span>
            <div className="flex flex-wrap gap-2 pt-1">
              {post.beneficiaries.map(b => (
                <span key={b.account} className="bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded-lg text-gray-600 dark:text-slate-300 border border-gray-100 dark:border-slate-700 shadow-xs">
                  @{b.account} ({(b.weight / 100).toFixed(1)}%)
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ================= BOTTOM ENGAGEMENT & VOTING BAR ================= */}
        <div className="pt-4 sm:pt-6 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2 sm:gap-4 flex-nowrap sm:flex-wrap">

          {/* 1. Upvote Button with Keychain Slider Popover (Mobile 1st, Desktop grouped right) */}
          <div className="relative flex-1 sm:flex-initial order-1 sm:order-2 sm:ml-auto">
            <button
              id="keychain-vote-btn"
              onClick={() => setShowVoteSlider(!showVoteSlider)}
              disabled={voteLoading}
              className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-2.5 py-2 sm:px-4 sm:py-2 rounded-xl sm:rounded-full text-xs font-semibold sm:font-bold transition shadow-xs cursor-pointer ${
                hasVoted
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60 sm:bg-rose-500 sm:text-white sm:border-transparent'
                  : 'bg-gray-100/90 dark:bg-slate-800/90 hover:bg-gray-200 dark:hover:bg-slate-750 text-gray-700 dark:text-slate-200 border border-gray-200/50 dark:border-slate-700/50 sm:bg-rose-50 sm:dark:bg-rose-950/40 sm:hover:bg-rose-100 sm:text-rose-600 sm:dark:text-rose-400'
              }`}
              style={typeof window !== 'undefined' && window.innerWidth >= 640 ? { borderRadius: '5px', fontSize: '20px', borderWidth: '0.1px' } : undefined}
              title={hasVoted ? 'Upvoted with Keychain' : 'Upvote with Keychain'}
            >
              <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${hasVoted ? 'fill-rose-600 dark:fill-rose-400 sm:fill-white' : 'text-rose-500 sm:text-inherit'}`} />
              <span className="truncate">{hasVoted ? 'Upvoted' : 'Upvote'}</span>
            </button>

            {/* Vote weight selector: mobile centered fixed inside screen, desktop anchored dropdown */}
            {showVoteSlider && (
              <>
                <div
                  className="fixed inset-0 z-40 sm:hidden bg-black/40 backdrop-blur-2xs animate-in fade-in"
                  onClick={() => setShowVoteSlider(false)}
                />
                <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 bottom-24 sm:bottom-full sm:mb-2 w-auto sm:w-72 max-w-[calc(100vw-1.5rem)] sm:max-w-none bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl sm:shadow-xl p-4 z-50 sm:z-30 animate-in fade-in zoom-in-95 border border-gray-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">Vote Weight</span>
                    <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">{voteWeight}%</span>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={voteWeight}
                    onChange={(e) => setVoteWeight(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-600 mb-3"
                  />

                  <div className="flex items-center justify-between gap-1 mb-3">
                    {[25, 50, 75, 100].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setVoteWeight(pct)}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 cursor-pointer"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleVoteSubmit}
                    disabled={voteLoading}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5 fill-white" />
                    <span>{voteLoading ? 'Signing with Keychain...' : 'Confirm Vote'}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 2. Tip Button (Mobile 2nd, Desktop left side) */}
          <div className="flex-1 sm:flex-initial order-2 sm:order-1 sm:ml-0">
            <button
              onClick={() => setShowTipModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-2.5 py-2 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl bg-gray-100/90 dark:bg-slate-800/90 hover:bg-gray-200 dark:hover:bg-slate-750 text-gray-700 dark:text-slate-200 border border-gray-200/50 dark:border-slate-700/50 sm:bg-amber-50 sm:dark:bg-amber-950/40 sm:hover:bg-amber-100 sm:dark:hover:bg-amber-900/50 sm:text-amber-700 sm:dark:text-amber-300 font-semibold sm:font-bold text-xs transition cursor-pointer"
              style={typeof window !== 'undefined' && window.innerWidth >= 640 ? { borderRadius: '5px', fontSize: '20px' } : undefined}
              title="Send tip to author"
            >
              <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 sm:text-amber-600 sm:dark:text-amber-400" />
              <span className="truncate"><span className="hidden sm:inline">Send </span>Tip</span>
            </button>
          </div>

          {/* 3. Reblog Button (Mobile 3rd, Desktop right side) */}
          <div className="flex-1 sm:flex-initial order-3 sm:order-3">
            <button
              id="keychain-reblog-btn"
              type="button"
              onClick={handleReblog}
              disabled={isReblogging || hasReblogged}
              className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-2.5 py-2 sm:px-4 sm:py-2 rounded-xl sm:rounded-full text-xs font-semibold sm:font-bold transition shadow-xs cursor-pointer ${
                hasReblogged
                  ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-900/60 sm:bg-purple-600 sm:text-white sm:border-transparent'
                  : 'bg-gray-100/90 dark:bg-slate-800/90 hover:bg-gray-200 dark:hover:bg-slate-750 text-gray-700 dark:text-slate-200 border border-gray-200/50 dark:border-slate-700/50 sm:bg-purple-50 sm:dark:bg-purple-950/40 sm:hover:bg-purple-100 sm:dark:hover:bg-purple-900/50 sm:text-purple-600 sm:dark:text-purple-400'
              } disabled:cursor-not-allowed`}
              style={typeof window !== 'undefined' && window.innerWidth >= 640 ? { borderRadius: '5px', fontSize: '20px', borderWidth: '0.1px' } : undefined}
              title={hasReblogged ? 'Already reblogged' : 'Reblog with Hive Keychain'}
            >
              {isReblogging ? (
                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 animate-spin" />
              ) : (
                <Repeat className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${hasReblogged ? 'text-purple-600 dark:text-purple-400 sm:text-white' : 'text-purple-500 sm:text-inherit'}`} />
              )}
              <span className="truncate">{hasReblogged ? 'Reblogged' : 'Reblog'}</span>
            </button>
          </div>

          {/* 4. Comments Counter Shortcut (Hidden on mobile per request, preserved on desktop) */}
          <button
            onClick={scrollToComments}
            className="hidden sm:flex order-4 items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 px-3 py-2 rounded-full transition cursor-pointer"
            style={typeof window !== 'undefined' && window.innerWidth >= 640 ? { fontSize: '20px', borderRadius: '5px', borderWidth: '0.1px' } : undefined}
            title="Jump to Comments"
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
            <span>{totalCommentsCount}</span>
          </button>

        </div>

        {/* ================= RELATED STORIES / MORE FROM AUTHOR (HIDDEN ON COMMENTS) ================= */}
        {!isComment && relatedStories.length > 0 && (
          <div className="pt-6 border-t border-gray-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isAuthorFallback ? (
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                )}
                <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white">
                  {isAuthorFallback ? `More Stories by @${post.author}` : 'Similar Stories'}
                </h3>
              </div>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  isAuthorFallback
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60'
                    : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-900/60'
                }`}
              >
                {isAuthorFallback ? 'Author Posts' : 'HiveSense AI'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {relatedStories.map((relPost) => {
                const thumb = getPostThumbnail(relPost);
                return (
                  <div
                    key={`${relPost.author}/${relPost.permlink}`}
                    onClick={() => {
                      window.scrollTo({ top: 0, behavior: 'instant' });
                      if (onSelectPost) {
                        onSelectPost(relPost);
                      }
                    }}
                    className="group flex gap-3 p-3 rounded-2xl bg-gray-50/70 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border border-gray-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 transition shadow-2xs hover:shadow-xs cursor-pointer items-start"
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={relPost.title}
                        loading="lazy"
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover flex-shrink-0 bg-gray-200 dark:bg-slate-700 group-hover:scale-102 transition-transform"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getHiveAvatarUrl(relPost.author, 'medium');
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-150 dark:border-blue-900/40 flex items-center justify-center flex-shrink-0">
                        <img
                          src={getHiveAvatarUrl(relPost.author, 'small')}
                          alt={relPost.author}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 flex flex-col justify-between h-full">
                      <h4 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-2 leading-snug transition-colors">
                        {relPost.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-500 dark:text-slate-400 flex-wrap">
                        <span className="font-semibold text-gray-700 dark:text-slate-300 truncate">
                          @{relPost.author}
                        </span>
                        {relPost.created && (
                          <>
                            <span>•</span>
                            <span>{formatPostDate(relPost.created).relative}</span>
                          </>
                        )}
                        {relPost.category && (
                          <>
                            <span>•</span>
                            <span className="text-blue-600 dark:text-blue-400 font-medium truncate">
                              #{relPost.category}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= DISCUSSION & COMMENTS ================= */}
        <section id="comments-section" className="pt-8 border-t border-gray-100 dark:border-slate-800 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Discussion ({totalCommentsCount})</span>
            </h3>
            {loadingDiscussion && (
              <span className="text-xs text-gray-400 dark:text-slate-500 animate-pulse">Loading discussion...</span>
            )}
          </div>

          {/* New Comment Box */}
          <form onSubmit={handleAddComment} className="bg-gray-50/80 dark:bg-slate-800/50 p-3 sm:p-5 rounded-xl sm:rounded-2xl space-y-3 border border-gray-100 dark:border-slate-800 -mx-1 sm:mx-0">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700 dark:text-slate-300">Leave a reply</span>
              {currentUser ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Replying as @{currentUser.username}</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-medium">Connect Keychain to reply</span>
              )}
            </div>

            <textarea
              rows={3}
              value={newCommentBody}
              onChange={(e) => setNewCommentBody(e.target.value)}
              placeholder={currentUser ? 'Write your response in Markdown...' : 'Connect Hive Keychain in the top menu to comment...'}
              className="w-full p-2.5 sm:p-3 bg-white dark:bg-slate-900 rounded-xl text-xs sm:text-sm text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none shadow-xs"
            />

            {commentSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Comment published successfully to the Hive blockchain!</span>
              </div>
            )}

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={commentLoading || !newCommentBody.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition shadow-xs cursor-pointer"
                style={{ borderRadius: '5px', borderWidth: '0.1px' }}
              >
                <Send className="w-3.5 h-3.5" />
                <span>{commentLoading ? 'Signing...' : 'Post Reply'}</span>
              </button>
            </div>
          </form>

          {/* Comment List */}
          {comments.length > 0 ? (
            <div className="space-y-3 sm:space-y-4 -mx-1 sm:mx-0">
              {comments.map((comment) => (
                <CommentThreadItem
                  key={comment.post_id || `${comment.author}/${comment.permlink}`}
                  comment={comment}
                  discussion={discussion}
                  depth={0}
                  onSelectAuthor={onSelectAuthor}
                  onSelectPost={onSelectPost}
                  currentUser={currentUser}
                  onRequireLogin={onRequireLogin}
                  onRefreshDiscussion={() => fetchDiscussion(true)}
                  onToggleFollowAuthor={handleToggleFollowAuthor}
                  onToggleMuteAuthor={handleToggleMuteAuthor}
                  isUserFollowing={isFollowing}
                  isAuthorMuted={(author: string) => contentFilterConfig.authors.includes(author.toLowerCase().trim())}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-gray-50/60 dark:bg-slate-800/40 text-center text-xs text-gray-400 dark:text-slate-500 border border-gray-100 dark:border-slate-800">
              {loadingDiscussion ? 'Syncing comments from Hive...' : 'No comments yet on this post.'}
            </div>
          )}
        </section>

      </div>

      {/* ================= TIP MODAL ================= */}
      {showTipModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95 border border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base text-gray-900 dark:text-white">Send Tip to @{post.author}</h3>
              </div>
              <button onClick={() => setShowTipModal(false)} className="p-1 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {tipNotice && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                {tipNotice}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 dark:text-slate-300 block mb-1">Amount & Currency</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-xl font-mono text-sm text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700 focus:outline-none focus:bg-white dark:focus:bg-slate-800"
                  />
                  <select
                    value={tipCurrency}
                    onChange={(e) => setTipCurrency(e.target.value as 'HIVE' | 'HBD')}
                    className="px-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-xl font-bold text-xs text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700 focus:outline-none focus:bg-white dark:focus:bg-slate-800 cursor-pointer"
                  >
                    <option value="HIVE">HIVE</option>
                    <option value="HBD">HBD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-gray-700 dark:text-slate-300 block mb-1">Memo</label>
                <input
                  type="text"
                  value={tipMemo}
                  onChange={(e) => setTipMemo(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-xs text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700 focus:outline-none focus:bg-white dark:focus:bg-slate-800"
                />
              </div>

              <p className="text-[11px] text-gray-500 dark:text-slate-400 bg-amber-50/70 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200/50 dark:border-amber-900/40">
                Signed safely through your Hive Keychain extension.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowTipModal(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTip}
                disabled={tipLoading}
                className="px-5 py-2 rounded-full text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-xs cursor-pointer"
              >
                {tipLoading ? 'Signing...' : `Send ${tipAmount} ${tipCurrency}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= FLOATING COMMENTS SHORTCUT (IN THE MARGIN/EMPTY SPACE) ================= */}
      <button
        id="floating-comments-shortcut-btn"
        onClick={scrollToComments}
        className="fixed right-4 sm:right-7 bottom-32 sm:bottom-24 z-40 flex items-center gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-full bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-lg border border-gray-200/90 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 text-gray-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 font-bold transition-all duration-200 hover:shadow-xl hover:scale-105 cursor-pointer group"
        title={`Jump directly to comments (${totalCommentsCount})`}
      >
        <div className="relative flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
          {totalCommentsCount > 0 && (
            <span className="absolute -top-2.5 -right-2.5 bg-blue-600 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full min-w-[16px] text-center leading-tight shadow-2xs">
              {totalCommentsCount}
            </span>
          )}
        </div>
        <span className="text-xs font-bold hidden sm:inline text-gray-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
          {totalCommentsCount} {totalCommentsCount === 1 ? 'Comment' : 'Comments'}
        </span>
      </button>

      {/* ================= FLOATING SCROLL NAVIGATION (FOLLOWS USER DOWN THE PAGE) ================= */}
      <div
        className={`fixed bottom-20 sm:bottom-6 right-4 sm:right-7 z-40 flex items-center gap-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-gray-200/90 dark:border-slate-700 transition-all duration-300 ${
          scrolledDown ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Back and Comments buttons: desktop only, since on mobile we have top X and floating comment button */}
        <button
          onClick={onClose}
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold transition cursor-pointer shadow-2xs"
          title="Back to Feed (Esc)"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="hidden sm:block h-4 w-px bg-gray-200 dark:bg-slate-700" />

        <button
          onClick={scrollToComments}
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/50 text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-bold transition cursor-pointer"
          title={`Jump to ${totalCommentsCount} Comments`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>{totalCommentsCount}</span>
        </button>

        <div className="hidden sm:block h-4 w-px bg-gray-200 dark:bg-slate-700" />

        {/* Scroll to Top button: visible on both mobile and desktop! On mobile it's the only one here */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
          title="Scroll to Top"
        >
          <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline">Top ({readingProgress}%)</span>
          <span className="sm:hidden font-mono text-[10px]">{readingProgress}%</span>
        </button>
      </div>

      {/* Floating Selection Action Toolbar (Desktop only) */}
      {selectionBubble.visible && (
        <div
          className="fixed z-50 flex items-center gap-1 bg-gray-900/95 dark:bg-slate-800/95 text-white backdrop-blur-md px-2 py-1.5 rounded-2xl shadow-xl border border-white/10 animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: `${selectionBubble.x}px`,
            top: `${selectionBubble.y}px`
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            onClick={handleQuoteSelection}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl hover:bg-white/15 text-xs font-semibold transition cursor-pointer text-slate-100 hover:text-white"
            title="Quote in discussion"
          >
            <Quote className="w-3.5 h-3.5 text-blue-400" />
            <span>Quote</span>
          </button>

          <div className="w-px h-4 bg-white/20" />

          <button
            onClick={handleTranslateSelection}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl hover:bg-white/15 text-xs font-semibold transition cursor-pointer text-slate-100 hover:text-white"
            title="Translate with Google Translate"
          >
            <Languages className="w-3.5 h-3.5 text-emerald-400" />
            <span>Translate</span>
          </button>

          <div className="w-px h-4 bg-white/20" />

          <button
            onClick={handleHighlightSelection}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl hover:bg-white/15 text-xs font-semibold transition cursor-pointer text-slate-100 hover:text-white"
            title="Highlight text"
          >
            <Highlighter className="w-3.5 h-3.5 text-amber-400" />
            <span>Marcar</span>
          </button>
        </div>
      )}

      {/* ================= POST IMAGE LIGHTBOX GALLERY (PORTAL) ================= */}
      {galleryIndex !== null && galleryImages.length > 0 && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-5 select-none animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              setGalleryIndex(null);
            }
          }}
        >
          {/* Top bar: Counter & Close button */}
          <div className="w-full flex items-center justify-between px-2 sm:px-4 py-2 z-30" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-white/90 text-xs sm:text-sm font-semibold bg-white/10 px-3.5 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
              <ImageIcon className="w-4 h-4 text-blue-400" />
              <span>{galleryIndex + 1} / {galleryImages.length}</span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setGalleryIndex(null);
              }}
              className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border border-white/15 shadow-lg group"
              title="Close gallery (Esc)"
            >
              <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>

          {/* Central Image View with Wide Left & Right Click Navigation Zones and Mouse Wheel Support */}
          <div
            ref={readerLightboxRef}
            className="relative flex-1 w-full flex items-center justify-center min-h-0 py-2 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            title="Mouse wheel to change image"
          >
            {/* Centered Image */}
            <img
              src={galleryImages[galleryIndex]}
              alt={`Post image ${galleryIndex + 1}`}
              className="max-h-[75vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl transition-all duration-200 pointer-events-none select-none z-10"
            />

            {/* Left Navigation Zone: click anywhere on the left half to go to previous image */}
            {galleryImages.length > 1 && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setGalleryIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : galleryImages.length - 1));
                }}
                className="absolute inset-y-0 left-0 w-1/2 z-20 cursor-pointer flex items-center justify-start pl-3 sm:pl-6 group/prev"
                title="Previous image (Click left side or left arrow)"
              >
                <div className="p-3 rounded-full bg-black/60 group-hover/prev:bg-black/90 text-white backdrop-blur-md border border-white/20 shadow-xl transition-all group-hover/prev:scale-110 flex items-center justify-center">
                  <ChevronLeft className="w-6 h-6" />
                </div>
              </div>
            )}

            {/* Right Navigation Zone: click anywhere on the right half to go to next image */}
            {galleryImages.length > 1 && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setGalleryIndex((prev) => (prev !== null && prev < galleryImages.length - 1 ? prev + 1 : 0));
                }}
                className="absolute inset-y-0 right-0 w-1/2 z-20 cursor-pointer flex items-center justify-end pr-3 sm:pr-6 group/next"
                title="Next image (Click right side or right arrow)"
              >
                <div className="p-3 rounded-full bg-black/60 group-hover/next:bg-black/90 text-white backdrop-blur-md border border-white/20 shadow-xl transition-all group-hover/next:scale-110 flex items-center justify-center">
                  <ChevronRight className="w-6 h-6" />
                </div>
              </div>
            )}
          </div>

          {/* Thumbnail preview strip */}
          {galleryImages.length > 1 && (
            <div
              className="w-full max-w-xl flex items-center justify-center gap-2 overflow-x-auto py-2 px-4 z-30 scrollbar-none"
              onClick={(e) => e.stopPropagation()}
            >
              {galleryImages.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setGalleryIndex(i);
                  }}
                  className={`relative rounded-xl overflow-hidden flex-shrink-0 transition-all cursor-pointer ${
                    i === galleryIndex
                      ? 'ring-2 ring-blue-500 scale-105 opacity-100'
                      : 'opacity-50 hover:opacity-80'
                  }`}
                  title={`Image ${i + 1}`}
                >
                  <img
                    src={src}
                    alt=""
                    className="w-14 h-14 object-cover rounded-lg bg-black/40"
                  />
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}

    </article>
  );
};

interface CommentThreadItemProps {
  comment: HivePost;
  discussion: Record<string, HivePost>;
  depth: number;
  onSelectAuthor: (author: string) => void;
  onSelectPost?: (post: HivePost) => void;
  currentUser: CurrentUser | null;
  onRequireLogin?: () => void;
  onRefreshDiscussion: () => void;
  onToggleFollowAuthor?: (author: string) => void;
  onToggleMuteAuthor?: (author: string) => void;
  isUserFollowing?: (author: string) => boolean;
  isAuthorMuted?: (author: string) => boolean;
}

const CommentThreadItem: React.FC<CommentThreadItemProps> = ({
  comment,
  discussion,
  depth,
  onSelectAuthor,
  onSelectPost,
  currentUser,
  onRequireLogin,
  onRefreshDiscussion,
  onToggleFollowAuthor,
  onToggleMuteAuthor,
  isUserFollowing,
  isAuthorMuted
}) => {
  // Check if current user has upvoted this comment
  const [upvoted, setUpvoted] = useState<boolean>(() => {
    if (currentUser?.username && comment.active_votes) {
      return comment.active_votes.some(
        v => v.voter.toLowerCase() === currentUser.username.toLowerCase()
      );
    }
    return false;
  });
  const [voteCountDelta, setVoteCountDelta] = useState(0);
  const [isVoting, setIsVoting] = useState(false);
  const [voteOpen, setVoteOpen] = useState(false);

  // In-line reply state
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);

  // Expand / collapse child replies (default expanded)
  const [isExpanded, setIsExpanded] = useState(true);

  const rep = calculateReputation(comment.author_reputation);
  const avatar = getHiveAvatarUrl(comment.author, 'small');
  const safeCommentHtml = markdownToSafeHtml(comment.body);
  const postDate = formatPostDate(comment.created);

  // Child replies from discussion map
  const childReplies = useMemo(() => {
    const keys = comment.replies || [];
    let directReplies = keys.map(k => discussion[k]).filter((c): c is HivePost => !!c);
    if (directReplies.length === 0) {
      directReplies = Object.values(discussion).filter(
        item => item.parent_author === comment.author && item.parent_permlink === comment.permlink
      );
    }
    if (isAuthorMuted) {
      return directReplies.filter(c => !isAuthorMuted(c.author));
    }
    return directReplies;
  }, [comment.author, comment.permlink, comment.replies, discussion, isAuthorMuted]);

  const totalVotes = Math.max(0, (comment.stats?.total_votes || comment.active_votes?.length || 0) + voteCountDelta);
  const payout = comment.payout !== undefined && comment.payout > 0
    ? comment.payout
    : parseFloat(comment.pending_payout_value || '0');

  // Handle vote on comment via Keychain
  const handleVote = async () => {
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      else alert('Please connect Hive Keychain in the top menu to vote.');
      return;
    }
    if (isVoting) return;
    if (upvoted) {
      setIsVoting(true);
      try {
        const res = await KeychainService.vote(currentUser.username, comment.author, comment.permlink, 0);
        if (res.success) {
          setUpvoted(false);
          setVoteCountDelta((prev) => prev - 1);
        }
      } finally {
        setIsVoting(false);
      }
      return;
    }
    setVoteOpen(true);
  };

  // Handle in-line reply to this comment via Keychain
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      else alert('Please connect Hive Keychain to reply.');
      return;
    }

    setIsReplying(true);
    try {
      const res = await KeychainService.postComment(
        currentUser.username,
        comment.author,
        comment.permlink,
        replyText.trim()
      );

      if (res.success) {
        setReplySuccess(true);
        setReplyText('');
        setTimeout(() => {
          setReplySuccess(false);
          setShowReplyBox(false);
        }, 1500);
        onRefreshDiscussion();
      } else {
        alert(res.message || res.error || 'Failed to post reply via Keychain.');
      }
    } catch (err: any) {
      alert(err.message || 'Reply broadcast failed');
    } finally {
      setIsReplying(false);
    }
  };

  // On mobile for subcomments with replies, tapping the comment body/card (outside buttons) opens the comment discussion
  const handleCardClick = (e: React.MouseEvent) => {
    if (window.innerWidth < 640 && depth >= 1 && childReplies.length > 0 && onSelectPost) {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('a') || target.closest('textarea') || target.closest('input')) {
        return;
      }
      onSelectPost(comment);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`px-2.5 py-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all ${
        depth === 0
          ? 'bg-gray-50/80 dark:bg-slate-800/60 border border-gray-100/70 dark:border-slate-700/60 shadow-2xs'
          : 'bg-white/90 dark:bg-slate-900/90 border border-blue-100 dark:border-blue-950/70 shadow-2xs'
      } ${depth >= 1 && childReplies.length > 0 ? 'sm:cursor-default cursor-pointer' : ''}`}
    >
      {/* Author Header */}
      <div className="flex items-center justify-between text-xs mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <img
            src={avatar}
            alt={comment.author}
            className="w-6 h-6 rounded-full object-cover bg-gray-200 dark:bg-slate-700 ring-1 ring-gray-200 dark:ring-slate-700"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
            }}
          />
          <button
            onClick={() => onSelectAuthor(comment.author)}
            className="font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
          >
            @{comment.author}
          </button>
          <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">({rep})</span>

          {onToggleFollowAuthor && onToggleMuteAuthor && (!currentUser || currentUser.username.toLowerCase() !== comment.author.toLowerCase()) && (
            <div className="flex items-center gap-1 ml-0.5">
              <button
                type="button"
                onClick={() => onToggleFollowAuthor(comment.author)}
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-semibold transition cursor-pointer ${
                  isUserFollowing && isUserFollowing(comment.author)
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900'
                    : 'bg-gray-100 dark:bg-slate-700 hover:bg-blue-600 hover:text-white text-gray-600 dark:text-slate-300'
                }`}
                title={isUserFollowing && isUserFollowing(comment.author) ? 'Following author (click to unfollow)' : 'Follow author'}
              >
                {isUserFollowing && isUserFollowing(comment.author) ? <Check className="w-2.5 h-2.5" /> : <UserPlus className="w-2.5 h-2.5" />}
                <span>{isUserFollowing && isUserFollowing(comment.author) ? 'Following' : 'Follow'}</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleMuteAuthor(comment.author)}
                className={`p-0.5 rounded-full text-xs transition cursor-pointer ${
                  isAuthorMuted && isAuthorMuted(comment.author)
                    ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/60'
                    : 'text-gray-400 hover:text-rose-600'
                }`}
                title={isAuthorMuted && isAuthorMuted(comment.author) ? 'Author is muted (click to unmute)' : 'Mute author'}
              >
                <VolumeX className="w-3 h-3" />
              </button>
            </div>
          )}

          {depth > 0 && (
            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded-full">
              Reply
            </span>
          )}
        </div>

        <span className="text-[11px] text-gray-400 dark:text-slate-500" title={postDate.full}>
          {postDate.relative}
        </span>
      </div>

      {/* Comment Body - On mobile, aligned closer to border (pl-1 sm:pl-8) */}
      <div
        className="article-body text-xs sm:text-sm text-gray-800 dark:text-slate-100 leading-relaxed pl-1 sm:pl-8 break-words max-w-none mb-2"
        dangerouslySetInnerHTML={{ __html: safeCommentHtml }}
      />

      {/* Actions: Heart Upvote Button, Reply Button, Toggle Replies */}
      <div className="flex items-center gap-2.5 sm:gap-4 text-[11px] text-gray-500 dark:text-slate-400 pl-1 sm:pl-8 pt-1 flex-wrap">
        {/* Upvote */}
        <button
          type="button"
          onClick={handleVote}
          disabled={isVoting}
          className={`flex items-center gap-1 transition cursor-pointer ${
            upvoted ? 'text-rose-600 dark:text-rose-400 font-bold' : 'hover:text-rose-600 dark:hover:text-rose-400'
          }`}
          title={upvoted ? 'Upvoted (Click to remove upvote)' : 'Upvote with Hive Keychain'}
        >
          {isVoting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
          ) : (
            <Heart className={`w-3.5 h-3.5 ${upvoted ? 'fill-rose-600 dark:fill-rose-400' : ''}`} />
          )}
          <span>{upvoted ? 'Upvoted' : 'Upvote'}</span>
        </button>

        {/* Reply toggle */}
        <button
          type="button"
          onClick={() => setShowReplyBox(!showReplyBox)}
          className="flex items-center gap-1 font-semibold text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
          title="Write a reply to this comment"
        >
          <CornerDownRight className="w-3.5 h-3.5" />
          <span>Reply</span>
        </button>

        {/* Child replies action */}
        {childReplies.length > 0 && (
          <>
            {/* On mobile for depth >= 1, button navigates to comment page to avoid squished nesting */}
            {depth >= 1 && (
              <button
                type="button"
                onClick={() => onSelectPost && onSelectPost(comment)}
                className="sm:hidden flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 bg-blue-50/90 dark:bg-blue-950/70 hover:bg-blue-100 dark:hover:bg-blue-900/80 px-2 py-0.5 rounded-full transition cursor-pointer"
                title="Open comment thread page"
              >
                <MessageSquare className="w-3 h-3 text-blue-500" />
                <span>{childReplies.length} {childReplies.length === 1 ? 'reply' : 'replies'}</span>
                <ArrowLeft className="w-3 h-3 rotate-180" />
              </button>
            )}

            {/* Depth 0 on mobile + All depths on desktop keep the accordion toggle */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`${depth >= 1 ? 'hidden sm:flex' : 'flex'} items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50/80 dark:bg-blue-950/60 hover:bg-blue-100/80 dark:hover:bg-blue-900/60 px-2 py-0.5 rounded-full transition cursor-pointer`}
              title={isExpanded ? 'Hide replies' : 'Show replies'}
            >
              <MessageSquare className="w-3 h-3 text-blue-500" />
              <span>{childReplies.length} {childReplies.length === 1 ? 'reply' : 'replies'}</span>
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </>
        )}
      </div>

      {/* Mobile only: for subcomments (depth >= 1) with replies, full-width banner to open comment page */}
      {depth >= 1 && childReplies.length > 0 && (
        <div className="sm:hidden mt-2.5 pt-2 border-t border-blue-100/70 dark:border-blue-950/70">
          <button
            type="button"
            onClick={() => onSelectPost && onSelectPost(comment)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-blue-50/90 dark:bg-blue-950/70 hover:bg-blue-100 dark:hover:bg-blue-900/80 active:bg-blue-200/80 text-blue-700 dark:text-blue-300 font-bold text-xs transition cursor-pointer border border-blue-200/80 dark:border-blue-900/60 shadow-2xs group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span className="truncate">
                {childReplies.length} {childReplies.length === 1 ? 'reply' : 'replies'} • Open thread
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">
              <span>View</span>
              <ArrowLeft className="w-3.5 h-3.5 rotate-180 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </div>
      )}

      {/* In-line Reply Box */}
      {showReplyBox && (
        <form onSubmit={handleSendReply} className="mt-3 pl-1 sm:pl-8 space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-slate-400">
            <span>Replying to @{comment.author}</span>
            <button
              type="button"
              onClick={() => setShowReplyBox(false)}
              className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 font-medium cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <textarea
            rows={2}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={`Write your reply to @${comment.author}...`}
            className="w-full p-2.5 bg-white dark:bg-slate-900 rounded-xl text-xs text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none shadow-2xs"
          />

          {replySuccess && (
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 font-medium">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Reply published to the Hive blockchain!</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isReplying || !replyText.trim()}
              className="flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition shadow-2xs cursor-pointer"
            >
              {isReplying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              <span>{isReplying ? 'Signing...' : 'Post Reply'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Recursive Child Replies Tree */}
      {childReplies.length > 0 && (
        <>
          {/* Depth === 0: Render direct subcomments on both mobile and desktop when expanded */}
          {depth === 0 && isExpanded && (
            <div className="mt-2.5 sm:mt-3 pl-1.5 sm:pl-5 border-l-2 border-blue-200/90 dark:border-blue-900/80 hover:border-blue-400 dark:hover:border-blue-600 space-y-2.5 sm:space-y-3 transition-colors">
              {childReplies.map((child) => (
                <CommentThreadItem
                  key={child.post_id || `${child.author}/${child.permlink}`}
                  comment={child}
                  discussion={discussion}
                  depth={depth + 1}
                  onSelectAuthor={onSelectAuthor}
                  onSelectPost={onSelectPost}
                  currentUser={currentUser}
                  onRequireLogin={onRequireLogin}
                  onRefreshDiscussion={onRefreshDiscussion}
                  onToggleFollowAuthor={onToggleFollowAuthor}
                  onToggleMuteAuthor={onToggleMuteAuthor}
                  isUserFollowing={isUserFollowing}
                  isAuthorMuted={isAuthorMuted}
                />
              ))}
            </div>
          )}

          {/* Depth >= 1: Render deeper nested sub-subcomments ONLY on desktop when expanded */}
          {depth >= 1 && isExpanded && (
            <div className="hidden sm:block mt-3 pl-5 border-l-2 border-blue-200/90 dark:border-blue-900/80 hover:border-blue-400 dark:hover:border-blue-600 space-y-3 transition-colors">
              {childReplies.map((child) => (
                <CommentThreadItem
                  key={child.post_id || `${child.author}/${child.permlink}`}
                  comment={child}
                  discussion={discussion}
                  depth={depth + 1}
                  onSelectAuthor={onSelectAuthor}
                  onSelectPost={onSelectPost}
                  currentUser={currentUser}
                  onRequireLogin={onRequireLogin}
                  onRefreshDiscussion={onRefreshDiscussion}
                  onToggleFollowAuthor={onToggleFollowAuthor}
                  onToggleMuteAuthor={onToggleMuteAuthor}
                  isUserFollowing={isUserFollowing}
                  isAuthorMuted={isAuthorMuted}
                />
              ))}
            </div>
          )}
        </>
      )}
      <VoteWeightDialog
        open={voteOpen}
        username={currentUser?.username || ''}
        author={comment.author}
        permlink={comment.permlink}
        onClose={() => setVoteOpen(false)}
        onVoted={() => {
          setUpvoted(true);
          setVoteCountDelta((prev) => prev + 1);
        }}
      />
    </div>
  );
};

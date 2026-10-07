import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronUp,
  Heart,
  Repeat,
  Gift,
  Share2,
  MoreHorizontal,
  Bookmark,
  MessageSquare,
  Loader2,
  Check,
  UserX,
  Hash,
  ExternalLink,
  ShieldAlert,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Send,
  Image as ImageIcon
} from 'lucide-react';
import {
  HivePost,
  calculateReputation,
  getHiveAvatarUrl,
  getPostThumbnail,
  getPostSnippet,
  getRebloggedBy
} from '../services/hiveApi';
import { KeychainService, CurrentUser } from '../services/keychain';
import { getSafeImageUrl } from '../utils/sanitize';
import { VoteWeightDialog } from './VoteWeightDialog';

export interface PostCardProps {
  post: HivePost;
  postIndex?: number;
  onSelectPost: (post: HivePost, jumpToComments?: boolean) => void;
  onSelectAuthor: (author: string) => void;
  onSelectTag: (tag: string) => void;
  currentUser?: CurrentUser | null;
  onRequireLogin?: () => void;
  onMuteAuthor?: (author: string) => void;
  onBlockWord?: (word: string) => void;
  inFeed?: boolean;
}

const PostCardComponent: React.FC<PostCardProps> = ({
  post,
  postIndex,
  onSelectPost,
  onSelectAuthor,
  onSelectTag,
  currentUser,
  onRequireLogin,
  onMuteAuthor,
  onBlockWord,
  inFeed = false
}) => {
  // Stable, DOM-safe identifier for all elements of this card:
  // If postIndex is provided, use discover-post-${postIndex} so elements are predictable
  // and identifiable regardless of changing blockchain post titles.
  const cleanSlug = `${post.author}-${post.permlink}${
    post.first_reblogged_by ? `-reblog-${post.first_reblogged_by}` : ''
  }`.replace(/[^a-zA-Z0-9_-]/g, '_');

  const uid = typeof postIndex === 'number'
    ? `discover-post-${postIndex}`
    : `discover-post-${cleanSlug}`;

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [openMenuUpwards, setOpenMenuUpwards] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const handleToggleMoreMenu = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (!showMoreMenu) {
      if (moreButtonRef.current) {
        const rect = moreButtonRef.current.getBoundingClientRect();
        const bottomNavOffset = window.innerWidth < 640 ? 65 : 10;
        const spaceBelow = window.innerHeight - rect.bottom - bottomNavOffset;
        // If cramped below (less than 230px space), open upwards; otherwise open downwards
        setOpenMenuUpwards(spaceBelow < 230);
      }
      setShowMoreMenu(true);
    } else {
      setShowMoreMenu(false);
    }
  };
  // Check if current user has already upvoted this post
  const [upvoted, setUpvoted] = useState<boolean>(() => {
    if (currentUser?.username && post.active_votes) {
      return post.active_votes.some(
        v => v.voter.toLowerCase() === currentUser.username.toLowerCase()
      );
    }
    return false;
  });
  const [voteCountDelta, setVoteCountDelta] = useState<number>(0);
  const [isVoting, setIsVoting] = useState<boolean>(false);
  const [voteOpen, setVoteOpen] = useState(false);

  // Check if current user has reblogged this post
  const [hasReblogged, setHasReblogged] = useState<boolean>(() => {
    if (currentUser?.username && post.reblogged_by) {
      return post.reblogged_by.some(u => u.toLowerCase() === currentUser.username.toLowerCase());
    }
    return false;
  });
  const [isReblogging, setIsReblogging] = useState<boolean>(false);
  const [reblogSuccessToast, setReblogSuccessToast] = useState<boolean>(false);

  const [isBookmarked, setIsBookmarked] = useState(() => {
    try {
      const saved = localStorage.getItem('hive_bookmarks') || '[]';
      const parsed = JSON.parse(saved);
      return parsed.includes(`${post.author}/${post.permlink}`);
    } catch {
      return false;
    }
  });

  // Lightbox Gallery state for image clicks on feed post
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [quickCommentText, setQuickCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [commentSuccessToast, setCommentSuccessToast] = useState(false);
  const [showCommentBox, setShowCommentBox] = useState(false);

  const rep = calculateReputation(post.author_reputation);
  const avatarUrl = getHiveAvatarUrl(post.author, 'small');
  const rawThumbnail = getPostThumbnail(post);
  const thumbnail = getSafeImageUrl(rawThumbnail, { width: 400 });
  const isComment = Boolean(post.parent_author && post.parent_author.length > 0) || (post.depth !== undefined && post.depth > 0);
  const rebloggedBy = getRebloggedBy(post);
  // Allow a richer snippet for comments on mobile so multiple lines are displayed cleanly
  const snippet = getPostSnippet(post.body, isComment ? 350 : 170);

  // Microblogging format detection (PeakD Snaps, Ecency Waves)
  const isPeakSnap = useMemo(() => {
    if (!isComment) return false;
    const pAuthor = post.parent_author?.toLowerCase() || '';
    const pPerm = post.parent_permlink?.toLowerCase() || '';
    const cat = post.category?.toLowerCase() || '';
    return (
      pAuthor === 'peak.snaps' ||
      cat === 'peakd-snaps' ||
      pPerm.includes('peakd-snap') ||
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

  const parentTopic = useMemo(() => {
    if (!post.parent_permlink) return '';
    const clean = String(post.parent_permlink)
      .replace(/[-_]/g, ' ')
      .replace(/^re\s+/i, '')
      .replace(/^[0-9a-f]{8,}\s+/i, '')
      .trim();
    return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : '';
  }, [post.parent_permlink]);

  // Extract all images in the post for gallery view
  const postImages = useMemo(() => {
    const list: string[] = [];
    if (rawThumbnail) list.push(rawThumbnail);

    if (post.json_metadata) {
      try {
        const meta = typeof post.json_metadata === 'string' ? JSON.parse(post.json_metadata) : post.json_metadata;
        if (Array.isArray(meta?.image)) {
          for (const img of meta.image) {
            if (typeof img === 'string' && img.startsWith('http') && !list.includes(img)) {
              list.push(img);
            }
          }
        }
      } catch {}
    }

    if (post.body) {
      const mdImgRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/g;
      let match;
      while ((match = mdImgRegex.exec(post.body)) !== null) {
        if (!list.includes(match[1])) list.push(match[1]);
      }
      const htmlImgRegex = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/g;
      while ((match = htmlImgRegex.exec(post.body)) !== null) {
        if (!list.includes(match[1])) list.push(match[1]);
      }
    }

    const filtered = Array.from(
      new Set(list.filter((u) => u && !u.includes('avatar') && !u.startsWith('data:')))
    );
    return filtered.length > 0 ? filtered : (rawThumbnail ? [rawThumbnail] : []);
  }, [post.json_metadata, post.body, rawThumbnail]);

  // Wheel listener for the lightbox gallery modal
  const lightboxImageContainerRef = React.useRef<HTMLDivElement>(null);
  const lastLightboxWheelTimeRef = React.useRef(0);

  useEffect(() => {
    if (!showGallery) return;
    const el = lightboxImageContainerRef.current;
    if (!el) return;

    const onLightboxWheel = (e: WheelEvent) => {
      if (postImages.length <= 1) return;
      if (Math.abs(e.deltaY) < 12 && Math.abs(e.deltaX) < 12) return;
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      if (now - lastLightboxWheelTimeRef.current < 260) return;
      lastLightboxWheelTimeRef.current = now;

      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (delta > 0) {
        setGalleryIndex((prev) => (prev < postImages.length - 1 ? prev + 1 : 0));
      } else {
        setGalleryIndex((prev) => (prev > 0 ? prev - 1 : postImages.length - 1));
      }
    };

    el.addEventListener('wheel', onLightboxWheel, { passive: false });
    return () => el.removeEventListener('wheel', onLightboxWheel);
  }, [showGallery, postImages.length]);

  // Keyboard navigation for image gallery
  useEffect(() => {
    if (!showGallery) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowGallery(false);
      } else if (e.key === 'ArrowLeft') {
        setGalleryIndex((prev) => (prev > 0 ? prev - 1 : postImages.length - 1));
      } else if (e.key === 'ArrowRight') {
        setGalleryIndex((prev) => (prev < postImages.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGallery, postImages.length]);

  const handleQuickComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCommentText.trim()) return;
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      return;
    }
    setSendingComment(true);
    try {
      const res = await KeychainService.postComment(
        currentUser.username,
        post.author,
        post.permlink,
        quickCommentText.trim()
      );
      if (res.success) {
        setCommentSuccessToast(true);
        setQuickCommentText('');
        setTimeout(() => setCommentSuccessToast(false), 3500);
      } else {
        alert(res.message || 'Comment could not be published via Keychain.');
      }
    } catch (err: any) {
      alert(err.message || 'Comment failed.');
    } finally {
      setSendingComment(false);
    }
  };

  // Formatted comment title or post title
  const displayTitle = isComment
    ? (post.title && !post.title.startsWith('Re: re-') && !post.title.startsWith('Re: @')
      ? post.title
      : `Comment on: "${String(post.parent_permlink || 'discussion').replace(/[-_]/g, ' ')}"`)
    : post.title;

  // Format relative time like Nebulosa: 19m, 44m, 1h, 2d
  const formatTime = (dateString: string) => {
    try {
      const safeStr = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
      const past = new Date(safeStr).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - past) / 1000));
      if (diffSec < 60) return `${diffSec}s`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h`;
      const diffDays = Math.floor(diffHr / 24);
      return `${diffDays}d`;
    } catch {
      return dateString;
    }
  };

  // Format payout
  const getPayoutDisplay = () => {
    if (post.payout !== undefined && post.payout > 0) {
      return `$ ${post.payout.toFixed(3)}`;
    }
    if (post.pending_payout_value) {
      const num = parseFloat(post.pending_payout_value);
      return `$ ${num.toFixed(3)}`;
    }
    return '$ 0.000';
  };

  const voteCount = Math.max(0, (post.stats?.total_votes || post.active_votes?.length || 0) + voteCountDelta);
  const childrenCount = post.children || 0;

  // Real Keychain voting handler
  const handleUpvote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      else alert('Please connect Hive Keychain in the top menu to vote.');
      return;
    }
    if (isVoting) return;
    if (upvoted) {
      setIsVoting(true);
      try {
        const res = await KeychainService.vote(currentUser.username, post.author, post.permlink, 0);
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

  // Real Keychain reblog handler
  const handleReblog = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isComment) return; // Reblog applies to posts
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      else alert('Please connect Hive Keychain in the top menu to reblog.');
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
        setReblogSuccessToast(true);
        setTimeout(() => setReblogSuccessToast(false), 3000);
      } else {
        alert(res.message || res.error || 'Reblog was not completed in Keychain.');
      }
    } catch (err: any) {
      alert(err.message || 'Reblog request failed.');
    } finally {
      setIsReblogging(false);
    }
  };

  const toggleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    const id = `${post.author}/${post.permlink}`;
    try {
      const saved = localStorage.getItem('hive_bookmarks') || '[]';
      let parsed: string[] = JSON.parse(saved);
      if (parsed.includes(id)) {
        parsed = parsed.filter(item => item !== id);
        setIsBookmarked(false);
      } else {
        parsed.push(id);
        setIsBookmarked(true);
      }
      localStorage.setItem('hive_bookmarks', JSON.stringify(parsed));
    } catch {
      setIsBookmarked(!isBookmarked);
    }
  };

  const handleShare = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`https://ecency.com/@${post.author}/${post.permlink}`);
      alert('Post link copied to clipboard!');
    }
  };

  const hasBanner = Boolean((!isComment && rebloggedBy) || isComment);

  return (
  <article
    id={`post-card-${uid}`}
    data-post-index={postIndex}
    data-author={post.author}
    data-permlink={post.permlink}
    onClick={() => onSelectPost(post)}
    className={`discover_post_card bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800/80 rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:hover:border-slate-700 transition-all duration-200 cursor-pointer mb-4 group ${
      showMoreMenu ? 'relative z-50 overflow-visible' : 'relative z-1'
    }`}
    style={
      inFeed
        ? {
            borderRadius: '15px',
            padding: '12px 14px',
            marginBottom: '12px',
            height: 'auto',
            minHeight: 'auto',
            overflow: showMoreMenu ? 'visible' : undefined
          }
        : {
            borderRadius: '15px',
            paddingLeft: '10px',
            paddingRight: '10px',
            paddingTop: '10px',
            paddingBottom: '10px',
            marginBottom: '8px',
            minHeight: hasBanner ? '185px' : '157px',
            height: window.innerWidth < 640 ? 'auto' : '157px'
          }
    }
  >
    {/* Reblog Activity Banner */}
    {!isComment && rebloggedBy && (
      <div
        id={`${uid}-reblog-banner`}
        className="flex items-center gap-2 mb-2.5 px-3 py-1.5 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 text-sm sm:text-xs text-purple-900 dark:text-purple-300 w-full overflow-hidden"
      >
        <Repeat
          id={`${uid}-reblog-banner-icon`}
          className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0"
        />
        <div id={`${uid}-reblog-banner-content`} className="truncate flex-1 min-w-0">
          <span id={`${uid}-reblog-banner-label`} className="text-purple-700 dark:text-purple-400">Reblogged by</span>
          <button
            id={`${uid}-reblog-banner-author-btn`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectAuthor(rebloggedBy);
            }}
            className="font-bold text-purple-950 dark:text-purple-200 hover:underline ml-1 cursor-pointer truncate"
          >
            @{rebloggedBy}
          </button>
        </div>
        <span
          id={`${uid}-reblog-banner-badge`}
          className="text-xs sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100/80 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 flex-shrink-0"
        >
          Reblog
        </span>
      </div>
    )}

    {/* Comment Activity Context Banner */}
    {isComment && (
      <div
        id={`${uid}-comment-banner`}
        className="discover_post_comment_banner flex items-center gap-2 mb-2 px-3 py-1.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-sm sm:text-xs text-blue-900 dark:text-blue-300 w-full overflow-hidden"
      >
        <MessageSquare
          id={`${uid}-comment-banner-icon`}
          className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0 self-start mt-0.5"
        />

        {/* MOBILE VIEW: Do not duplicate post author name. Show what is being commented on (up to 2 lines) or PeakD Snap / Ecency Wave info */}
        <div id={`${uid}-comment-banner-content-mobile`} className="discover_post_comment_banner_mobile flex-1 min-w-0 sm:hidden">
          {isPeakSnap ? (
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-sm text-amber-900 dark:text-amber-200 font-medium">
                {post.parent_author?.toLowerCase() === 'peak.snaps' ? (
                  <span className="font-bold text-amber-950 dark:text-amber-100">PeakD Snap (Microblog)</span>
                ) : (
                  <span>
                    Snap reply to{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (post.parent_author) onSelectAuthor(post.parent_author);
                      }}
                      className="font-bold underline cursor-pointer text-amber-950 dark:text-amber-100"
                    >
                      @{post.parent_author}
                    </button>
                  </span>
                )}
              </div>
              <span
                id={`${uid}-comment-banner-badge-snap`}
                className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 flex-shrink-0"
              >
                Snap
              </span>
            </div>
          ) : isEcencyWave ? (
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-sm text-cyan-900 dark:text-cyan-200 font-medium">
                {post.parent_author?.toLowerCase() === 'ecency.waves' || post.parent_author?.toLowerCase() === 'ecency.stats' ? (
                  <span className="font-bold text-cyan-950 dark:text-cyan-100">Ecency Wave (Microblog)</span>
                ) : (
                  <span>
                    Wave reply to{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (post.parent_author) onSelectAuthor(post.parent_author);
                      }}
                      className="font-bold underline cursor-pointer text-cyan-950 dark:text-cyan-100"
                    >
                      @{post.parent_author}
                    </button>
                  </span>
                )}
              </div>
              <span
                id={`${uid}-comment-banner-badge-wave`}
                className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300 flex-shrink-0"
              >
                Wave
              </span>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="line-clamp-2 text-sm sm:text-xs text-blue-900 dark:text-blue-200 leading-snug">
                <span className="text-blue-700 dark:text-blue-400 font-medium">Replying to </span>
                {post.parent_author && (
                  <button
                    id={`${uid}-comment-banner-parent-author-btn-mobile`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAuthor(post.parent_author!);
                    }}
                    className="font-bold text-blue-950 dark:text-blue-100 hover:underline cursor-pointer"
                  >
                    @{post.parent_author}
                  </button>
                )}
                {parentTopic && (
                  <span id={`${uid}-comment-banner-parent-topic-mobile`} className="text-blue-800 dark:text-blue-300 font-medium">
                    : <span className="italic">"{parentTopic}"</span>
                  </span>
                )}
              </div>
              <span
                id={`${uid}-comment-banner-badge-mobile`}
                className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100/80 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 flex-shrink-0 self-start mt-0.5"
              >
                Comment
              </span>
            </div>
          )}
        </div>

        {/* DESKTOP VIEW: Preserved exactly as before */}
        <div id={`${uid}-comment-banner-content`} className="discover_post_comment_banner_desktop truncate flex-1 min-w-0 hidden sm:block">
          <span id={`${uid}-comment-banner-author`} className="font-semibold text-blue-950 dark:text-blue-200">@{post.author}</span>
          <span id={`${uid}-comment-banner-label`} className="text-blue-700 dark:text-blue-400 ml-1">commented on</span>
          {post.parent_author && (
            <button
              id={`${uid}-comment-banner-parent-author-btn`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectAuthor(post.parent_author!);
              }}
              className="font-semibold text-blue-900 dark:text-blue-300 hover:text-blue-950 dark:hover:text-blue-200 hover:underline mx-1 cursor-pointer truncate"
            >
              @{post.parent_author}
            </button>
          )}
          {post.parent_permlink && (
            <span
              id={`${uid}-comment-banner-parent-permlink`}
              className="text-blue-700/80 dark:text-blue-400/80 text-[11px] truncate hidden sm:inline"
            >
              • <span id={`${uid}-comment-banner-parent-permlink-text`} className="italic font-normal">"{String(post.parent_permlink).replace(/[-_]/g, ' ')}"</span>
            </span>
          )}
        </div>
        <span
          id={`${uid}-comment-banner-badge`}
          className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100/80 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 flex-shrink-0 hidden sm:inline-block"
        >
          Comment
        </span>
      </div>
    )}

    {/* Layout Principal em 2 Colunas */}
    <div id={`${uid}-layout`} className={`discover_post_layout flex gap-4 ${inFeed ? 'items-start' : 'items-stretch'}`}>
      {/* Coluna da Esquerda: Thumbnail Expandida com clique exclusivo para abrir Galeria */}
      {thumbnail && (
        <div
          id={`${uid}-thumb`}
          onClick={(e) => {
            e.stopPropagation();
            setGalleryIndex(0);
            setShowGallery(true);
          }}
          className={`discover_post_thumb flex-shrink-0 rounded-2xl overflow-hidden bg-gray-100 dark:bg-slate-800 cursor-zoom-in relative group/thumb ${
            inFeed ? 'w-32 h-28 sm:w-44 sm:h-[135px] self-start' : 'w-32 h-32 sm:w-44 sm:h-40'
          }`}
          style={inFeed ? { borderRadius: '15px' } : { height: window.innerWidth < 640 ? 'auto' : '137px', borderRadius: '15px' }}
          title="Ver imagem na galeria"
        >
          <img
            id={`${uid}-thumb-img`}
            src={thumbnail}
            alt=""
            loading="lazy"
            className="discover_post_content_image discover_post_thumb_image w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
            style={inFeed ? undefined : { height: window.innerWidth < 640 ? '120px' : '135px' }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          {postImages.length > 1 && (
            <div
              id={`${uid}-thumb-counter`}
              className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm pointer-events-none flex items-center gap-1 shadow-sm"
            >
              <ImageIcon id={`${uid}-thumb-counter-icon`} className="w-2.5 h-2.5" />
              <span id={`${uid}-thumb-counter-text`}>{postImages.length}</span>
            </div>
          )}
        </div>
      )}

      {/* Coluna da Direita: Autor + Título + Descrição + Ações/Métricas */}
      <div
        id={`${uid}-content`}
        className={`discover_post_content flex-1 min-w-0 flex flex-col ${
          inFeed
            ? thumbnail
              ? 'min-h-[135px]'
              : 'gap-2.5 min-h-0'
            : ''
        }`}
        style={inFeed ? undefined : { minHeight: window.innerWidth < 640 ? '0' : (thumbnail ? '137px' : '110px') }}
      >

        {/* Header Superior: Autor, Comunidade, Tempo e Bookmark */}
        <div id={`${uid}-header`} className="discover_post_header flex items-center justify-between gap-2" style={{ marginBottom: '0px' }}>
          <div id={`${uid}-header-left`} className="flex items-center gap-2 min-w-0">
            <button
              id={`${uid}-avatar-btn`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectAuthor(post.author);
              }}
              className="discover_post_avatar_button flex-shrink-0 focus:outline-none"
            >
              <img
                id={`${uid}-avatar-img`}
                src={avatarUrl}
                alt={post.author}
                loading="lazy"
                className="discover_post_avatar_image w-6 h-6 rounded-full bg-gray-100 object-cover hover:opacity-90 transition"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.ecency.com/u/hive/avatar/small';
                }}
              />
            </button>

            <div id={`${uid}-meta`} className="flex items-center gap-1.5 truncate text-xs sm:text-xs">
              <button
                id={`${uid}-author-btn`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAuthor(post.author);
                }}
                className="discover_post_author_button font-bold text-[15px] sm:text-xs text-gray-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 truncate focus:outline-none transition-colors"
              >
                {post.author}
              </button>

              <span id={`${uid}-reputation`} className="discover_post_reputation text-xs sm:text-[10px] text-gray-400 dark:text-slate-500 font-medium">
                ({rep})
              </span>

              {(post.community_title || post.category) && (
                <>
                  <span id={`${uid}-community-separator`} className="text-gray-400 dark:text-slate-600">•</span>
                  <button
                    id={`${uid}-community-btn`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (post.community) onSelectTag(post.community);
                      else if (post.category) onSelectTag(post.category);
                    }}
                    className="discover_post_community_button font-medium text-xs sm:text-xs text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 truncate hidden sm:inline"
                  >
                    {post.community_title || post.category}
                  </button>
                </>
              )}

              <span id={`${uid}-time-separator`} className="text-gray-400 dark:text-slate-600">•</span>
              <span id={`${uid}-time`} className="discover_post_time text-xs sm:text-xs text-gray-400 dark:text-slate-500 font-normal">
                {formatTime(post.created)}
              </span>
            </div>
          </div>

          <button
            id={`${uid}-bookmark-btn`}
            onClick={toggleBookmark}
            className={`discover_post_button_bookmark p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition ${
              isBookmarked
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
            }`}
            title={isBookmarked ? 'Bookmarked' : 'Save post'}
          >
            <Bookmark id={`${uid}-bookmark-icon`} className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Título e Snippet: For comments on mobile, hide redundant title and show multiple lines for the comment/snap/wave */}
        <div id={`${uid}-body`} className="discover_post_body flex-1 pt-1.5 sm:pt-2">
          <h2
            id={`${uid}-title`}
            className={`discover_post_title text-base sm:text-lg font-bold text-gray-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug ${
              isComment ? 'hidden sm:block' : 'block'
            }`}
          >
            {displayTitle}
          </h2>
          <p
            id={`${uid}-snippet`}
            className={`discover_post_snippet leading-relaxed ${
              isComment
                ? 'line-clamp-3 sm:line-clamp-1 mt-0 sm:mt-1 text-gray-800 dark:text-slate-200 text-[14px] sm:text-sm font-normal'
                : 'line-clamp-1 mt-1 text-gray-600 dark:text-slate-400 text-sm sm:text-xs'
            }`}
          >
            {snippet}
          </p>
        </div>

        {/* Rodapé de Ações (Métricas + Botoes) na Direita */}
        <div id={`${uid}-footer`} className="discover_post_footer flex items-center justify-between text-sm sm:text-xs text-gray-500 dark:text-slate-400 mt-auto">
          <div id={`${uid}-footer-left`} className="flex items-center gap-3 sm:gap-4 flex-wrap">
            {/* Upvote Button */}
            <button
              id={`${uid}-upvote-btn`}
              onClick={handleUpvote}
              disabled={isVoting}
              className={`discover_post_button_upvote w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer ${
                upvoted
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
              } disabled:opacity-60`}
              title={upvoted ? 'Upvoted (Click to remove upvote)' : 'Upvote with Hive Keychain'}
            >
              {isVoting ? (
                <Loader2 id={`${uid}-upvote-spinner`} className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Heart id={`${uid}-upvote-icon`} className={`w-3.5 h-3.5 ${upvoted ? 'fill-white text-white' : ''}`} />
              )}
            </button>

            {/* Comments Counter */}
            <button
              id={`${uid}-comments-btn`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectPost(post, true);
              }}
              className="discover_post_button_comments flex items-center gap-1.5 text-gray-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition group/comm cursor-pointer"
              title={`${childrenCount} comments - click to view and discuss`}
            >
              <MessageSquare
                id={`${uid}-comments-icon`}
                className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-gray-400 dark:text-slate-500 group-hover/comm:text-blue-600 dark:group-hover/comm:text-blue-400 transition-colors"
              />
              <span id={`${uid}-comments-count`} className="font-semibold text-sm sm:text-xs">{childrenCount}</span>
            </button>

            {/* Reblog Button */}
            {!isComment && (
              <button
                id={`${uid}-reblog-btn`}
                type="button"
                onClick={handleReblog}
                disabled={isReblogging || hasReblogged}
                className={`discover_post_button_reblog flex items-center gap-1.5 transition cursor-pointer ${
                  hasReblogged
                    ? 'text-purple-600 dark:text-purple-400 font-bold'
                    : 'text-gray-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400'
                } disabled:cursor-not-allowed`}
                title={hasReblogged ? 'Already reblogged' : 'Reblog with Hive Keychain'}
              >
                {isReblogging ? (
                  <Loader2 id={`${uid}-reblog-spinner`} className="w-3.5 h-3.5 text-purple-600 animate-spin" />
                ) : (
                  <Repeat
                    id={`${uid}-reblog-icon`}
                    className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${hasReblogged ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-slate-500'}`}
                  />
                )}
                <span id={`${uid}-reblog-label`} className="text-sm sm:text-xs">{hasReblogged ? 'Reblogged' : 'Reblog'}</span>
              </button>
            )}

            {reblogSuccessToast && (
              <span
                id={`${uid}-reblog-toast`}
                className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-full animate-in fade-in"
              >
                Reblogged!
              </span>
            )}
          </div>

          {/* Right action icons: Share & More */}
          <div id={`${uid}-footer-right`} className="flex items-center gap-2 text-gray-400 dark:text-slate-500 relative">
            <button
              id={`${uid}-share-btn`}
              onClick={handleShare}
              className="discover_post_button_share p-1 hover:text-gray-600 dark:hover:text-slate-300 rounded transition cursor-pointer"
              title="Share post"
            >
              <Share2 id={`${uid}-share-icon`} className="w-3.5 h-3.5" />
            </button>

            <div id={`${uid}-more-wrapper`} className="discover_post_more_wrapper relative">
              <button
                ref={moreButtonRef}
                id={`${uid}-more-btn`}
                type="button"
                onClick={handleToggleMoreMenu}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                }}
                className={`discover_post_button_more p-1.5 rounded-lg transition cursor-pointer touch-manipulation ${
                  showMoreMenu ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-800' : 'hover:text-gray-600 dark:hover:text-slate-300'
                }`}
                title="More post options"
              >
                <MoreHorizontal id={`${uid}-more-icon`} className="w-4 h-4" />
              </button>

              {/* Dropdown Menu */}
              {showMoreMenu && (
                <>
                  <div
                    id={`${uid}-more-backdrop`}
                    className="discover_post_more_backdrop fixed inset-0 z-40 cursor-default"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMoreMenu(false);
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      setShowMoreMenu(false);
                    }}
                  />
                  <div
                    id={`${uid}-more-menu`}
                    className={`discover_post_more_menu absolute right-0 ${
                      openMenuUpwards ? 'bottom-full mb-2' : 'top-full mt-1.5'
                    } w-52 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 text-xs text-gray-700 dark:text-slate-200`}
                    onClick={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                  >
                    <button
                      id={`${uid}-more-open-reader-btn`}
                      onClick={() => {
                        setShowMoreMenu(false);
                        onSelectPost(post);
                      }}
                      className="discover_post_more_item discover_post_more_open_reader w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <ExternalLink id={`${uid}-more-open-reader-icon`} className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span id={`${uid}-more-open-reader-label`}>Open in Reader</span>
                    </button>

                    <button
                      id={`${uid}-more-copy-link-btn`}
                      onClick={() => {
                        setShowMoreMenu(false);
                        handleShare();
                      }}
                      className="discover_post_more_item discover_post_more_copy_link w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <Share2 id={`${uid}-more-copy-link-icon`} className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                      <span id={`${uid}-more-copy-link-label`}>Copy Hive Link</span>
                    </button>

                    {onMuteAuthor && (
                      <button
                        id={`${uid}-more-mute-btn`}
                        onClick={() => {
                          setShowMoreMenu(false);
                          onMuteAuthor(post.author);
                        }}
                        className="discover_post_more_item discover_post_more_mute w-full text-left px-3 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer font-semibold border-t border-gray-100 dark:border-slate-800"
                        title={`Mute @${post.author} across Feed & Discover`}
                      >
                        <UserX id={`${uid}-more-mute-icon`} className="w-3.5 h-3.5" />
                        <span id={`${uid}-more-mute-label`}>Mute @{post.author}</span>
                      </button>
                    )}

                    {onBlockWord && post.category && (
                      <button
                        id={`${uid}-more-filter-btn`}
                        onClick={() => {
                          setShowMoreMenu(false);
                          onBlockWord(post.category);
                        }}
                        className="discover_post_more_item discover_post_more_filter w-full text-left px-3 py-2 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center gap-2 cursor-pointer font-medium"
                        title={`Filter #${post.category} posts`}
                      >
                        <Hash id={`${uid}-more-filter-icon`} className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span id={`${uid}-more-filter-label`}>Filter #{post.category}</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    <VoteWeightDialog
      open={voteOpen}
      username={currentUser?.username || ''}
      author={post.author}
      permlink={post.permlink}
      onClose={() => setVoteOpen(false)}
      onVoted={() => {
        setUpvoted(true);
        setVoteCountDelta((prev) => prev + 1);
      }}
    />

    {/* ================= LIGHTBOX GALLERY MODAL (PORTAL) ================= */}
    {showGallery && postImages.length > 0 && typeof document !== 'undefined' && createPortal(
      <div
        id={`${uid}-lightbox`}
        className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-5 select-none animate-in fade-in duration-200"
        onClick={(e) => {
          e.stopPropagation();
          // If clicked in the top or bottom empty margin outside content, close gallery
          if (e.target === e.currentTarget) {
            setShowGallery(false);
          }
        }}
      >
        {/* Top Header Bar */}
        <div
          id={`${uid}-lightbox-header`}
          className="w-full flex items-center justify-between gap-3 px-2 sm:px-4 py-2 z-30 flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Author info & post title snippet */}
          <div id={`${uid}-lightbox-header-left`} className="flex items-center gap-2.5 min-w-0 max-w-[65%]">
            <img
              id={`${uid}-lightbox-avatar`}
              src={avatarUrl}
              alt={post.author}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500/30 flex-shrink-0"
            />
            <div id={`${uid}-lightbox-info`} className="min-w-0">
              <div id={`${uid}-lightbox-meta`} className="flex items-center gap-1.5 text-xs text-white">
                <span id={`${uid}-lightbox-author`} className="font-bold truncate">@{post.author}</span>
                <span id={`${uid}-lightbox-time`} className="text-[10px] text-white/50">• {formatTime(post.created)}</span>
                {postImages.length > 1 && (
                  <span
                    id={`${uid}-lightbox-counter`}
                    className="text-[10px] font-semibold bg-white/15 px-2 py-0.5 rounded-full text-white/80 ml-1"
                  >
                    {galleryIndex + 1} / {postImages.length}
                  </span>
                )}
              </div>
              <h3 id={`${uid}-lightbox-title`} className="text-white/80 text-xs font-medium truncate">
                {displayTitle}
              </h3>
            </div>
          </div>

          {/* Actions: View Full Post, Quick Comment Toggle, Close */}
          <div id={`${uid}-lightbox-actions`} className="flex items-center gap-2 flex-shrink-0">
            {/* Shortcut to view full post */}
            <button
              id={`${uid}-lightbox-view-post-btn`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowGallery(false);
                onSelectPost(post);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md cursor-pointer"
              title="Open full post for reading"
            >
              <BookOpen id={`${uid}-lightbox-view-post-icon`} className="w-3.5 h-3.5" />
              <span id={`${uid}-lightbox-view-post-label`}>View Full Post</span>
            </button>

            {/* Quick Comment Toggle */}
            <button
              id={`${uid}-lightbox-comment-toggle-btn`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowCommentBox((prev) => !prev);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer border ${
                showCommentBox
                  ? 'bg-white/20 text-white border-white/30'
                  : 'bg-white/10 hover:bg-white/15 text-white/90 border-white/15'
              }`}
              title="Quick comment on this post"
            >
              <MessageSquare id={`${uid}-lightbox-comment-toggle-icon`} className="w-3.5 h-3.5 text-blue-400" />
              <span id={`${uid}-lightbox-comment-toggle-label`} className="hidden sm:inline">Comment</span>
            </button>

            {/* Close Button */}
            <button
              id={`${uid}-lightbox-close-btn`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowGallery(false);
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border border-white/15 shadow-md group"
              title="Close gallery (Esc)"
            >
              <X id={`${uid}-lightbox-close-icon`} className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>

        {/* Central Image View with Wide Left & Right Click Navigation Zones and Mouse Wheel Support */}
        <div
          id={`${uid}-lightbox-stage`}
          ref={lightboxImageContainerRef}
          className="relative flex-1 w-full flex items-center justify-center min-h-0 py-2 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          title="Mouse wheel to change image"
        >
          {/* Centered Image */}
          <img
            id={`${uid}-lightbox-image`}
            src={postImages[galleryIndex]}
            alt={`Post image ${galleryIndex + 1}`}
            className="max-h-[70vh] sm:max-h-[74vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl transition-all duration-200 pointer-events-none select-none z-10"
          />

          {/* Left Navigation Zone: click anywhere on the left half to go to previous image */}
          {postImages.length > 1 && (
            <div
              id={`${uid}-lightbox-prev-zone`}
              onClick={(e) => {
                e.stopPropagation();
                setGalleryIndex((prev) => (prev > 0 ? prev - 1 : postImages.length - 1));
              }}
              className="absolute inset-y-0 left-0 w-1/2 z-20 cursor-pointer flex items-center justify-start pl-3 sm:pl-6 group/prev"
              title="Previous image (Click left side or left arrow)"
            >
              <div
                id={`${uid}-lightbox-prev-circle`}
                className="p-3 rounded-full bg-black/60 group-hover/prev:bg-black/90 text-white backdrop-blur-md border border-white/20 shadow-xl transition-all group-hover/prev:scale-110 flex items-center justify-center"
              >
                <ChevronLeft id={`${uid}-lightbox-prev-icon`} className="w-6 h-6" />
              </div>
            </div>
          )}

          {/* Right Navigation Zone: click anywhere on the right half to go to next image */}
          {postImages.length > 1 && (
            <div
              id={`${uid}-lightbox-next-zone`}
              onClick={(e) => {
                e.stopPropagation();
                setGalleryIndex((prev) => (prev < postImages.length - 1 ? prev + 1 : 0));
              }}
              className="absolute inset-y-0 right-0 w-1/2 z-20 cursor-pointer flex items-center justify-end pr-3 sm:pr-6 group/next"
              title="Next image (Click right side or right arrow)"
            >
              <div
                id={`${uid}-lightbox-next-circle`}
                className="p-3 rounded-full bg-black/60 group-hover/next:bg-black/90 text-white backdrop-blur-md border border-white/20 shadow-xl transition-all group-hover/next:scale-110 flex items-center justify-center"
              >
                <ChevronRight id={`${uid}-lightbox-next-icon`} className="w-6 h-6" />
              </div>
            </div>
          )}
        </div>

        {/* Quick Comment Drawer & Thumbnail Strip */}
        <div
          id={`${uid}-lightbox-bottom`}
          className="w-full flex flex-col items-center gap-2 z-30"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick Comment Drawer */}
          {showCommentBox && (
            <div
              id={`${uid}-lightbox-comment-drawer`}
              className="w-full max-w-xl bg-slate-900/95 backdrop-blur-md border border-white/15 rounded-2xl p-3 shadow-2xl animate-in slide-in-from-bottom-2 duration-150 space-y-2"
            >
              {commentSuccessToast ? (
                <div
                  id={`${uid}-lightbox-comment-success`}
                  className="p-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold text-center"
                >
                  Comment published successfully on Hive!
                </div>
              ) : (
                <form
                  id={`${uid}-lightbox-comment-form`}
                  onSubmit={handleQuickComment}
                  className="flex gap-2 items-center"
                >
                  {currentUser ? (
                    <img
                      id={`${uid}-lightbox-comment-avatar`}
                      src={getHiveAvatarUrl(currentUser.username, 'small')}
                      alt={currentUser.username}
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      id={`${uid}-lightbox-comment-avatar-placeholder`}
                      className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-white/50 text-xs font-bold"
                    >
                      ?
                    </div>
                  )}
                  <input
                    id={`${uid}-lightbox-comment-input`}
                    type="text"
                    value={quickCommentText}
                    onChange={(e) => setQuickCommentText(e.target.value)}
                    placeholder={
                      currentUser
                        ? `Write a quick comment as @${currentUser.username}...`
                        : 'Log in with Hive Keychain to comment...'
                    }
                    disabled={sendingComment}
                    className="flex-1 bg-white/10 hover:bg-white/15 focus:bg-white/15 text-white placeholder-white/40 text-xs px-3.5 py-2 rounded-xl border border-white/15 focus:outline-none focus:border-blue-400 transition"
                  />
                  <button
                    id={`${uid}-lightbox-comment-send-btn`}
                    type="submit"
                    disabled={sendingComment || !quickCommentText.trim()}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer flex-shrink-0 shadow-sm"
                  >
                    {sendingComment ? (
                      <Loader2 id={`${uid}-lightbox-comment-send-spinner`} className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send id={`${uid}-lightbox-comment-send-icon`} className="w-3.5 h-3.5" />
                    )}
                    <span id={`${uid}-lightbox-comment-send-label`} className="hidden sm:inline">Send</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Thumbnail Strip (if more than 1 image) */}
          {postImages.length > 1 && (
            <div
              id={`${uid}-lightbox-thumb-strip`}
              className="w-full max-w-xl flex items-center justify-center gap-2 overflow-x-auto py-1 px-4 scrollbar-none"
            >
              {postImages.map((src, i) => (
                <button
                  key={i}
                  id={`${uid}-lightbox-thumb-btn-${i}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setGalleryIndex(i);
                  }}
                  className={`relative rounded-xl overflow-hidden flex-shrink-0 transition-all cursor-pointer ${
                    i === galleryIndex
                      ? 'ring-2 ring-blue-500 scale-105 opacity-100'
                      : 'opacity-40 hover:opacity-80'
                  }`}
                  title={`Image ${i + 1}`}
                >
                  <img
                    id={`${uid}-lightbox-thumb-img-${i}`}
                    src={src}
                    alt=""
                    className="w-12 h-12 object-cover rounded-lg bg-black/40"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>,
      document.body
    )}
  </article>
);
};

export const PostCard = React.memo(PostCardComponent);
import React, { useState, useMemo, useEffect } from 'react';
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
  onSelectPost,
  onSelectAuthor,
  onSelectTag,
  currentUser,
  onRequireLogin,
  onMuteAuthor,
  onBlockWord,
  inFeed = false
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
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
  const snippet = getPostSnippet(post.body, isComment ? 240 : 170);

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
    id={`post-card-${post.post_id || post.permlink}`}
    onClick={() => onSelectPost(post)}
    className="bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800/80 rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:hover:border-slate-700 transition-all duration-200 cursor-pointer mb-4 group"
    style={
      inFeed
        ? {
            borderRadius: '15px',
            padding: '12px 14px',
            marginBottom: '12px',
            height: 'auto',
            minHeight: 'auto',
            overflow: 'hidden'
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
      <div className="flex items-center gap-2 mb-2.5 px-3 py-1 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 text-xs text-purple-900 dark:text-purple-300 w-full overflow-hidden">
        <Repeat className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
        <div className="truncate flex-1 min-w-0">
          <span className="text-purple-700 dark:text-purple-400">Reblogged by</span>
          <button
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
        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100/80 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 flex-shrink-0">
          Reblog
        </span>
      </div>
    )}

    {/* Comment Activity Context Banner */}
    {isComment && (
      <div className="flex items-center gap-2 mb-2.5 px-3 py-1 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-300 w-full overflow-hidden">
        <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <div className="truncate flex-1 min-w-0">
          <span className="font-semibold text-blue-950 dark:text-blue-200">@{post.author}</span>
          <span className="text-blue-700 dark:text-blue-400 ml-1">commented on</span>
          {post.parent_author && (
            <button
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
            <span className="text-blue-700/80 dark:text-blue-400/80 text-[11px] truncate hidden sm:inline">
              • <span className="italic font-normal">"{String(post.parent_permlink).replace(/[-_]/g, ' ')}"</span>
            </span>
          )}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100/80 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 flex-shrink-0">
          Comment
        </span>
      </div>
    )}

    {/* Layout Principal em 2 Colunas */}
    <div className={`flex gap-4 ${inFeed ? 'items-start' : 'items-stretch'}`}>
      {/* Coluna da Esquerda: Thumbnail Expandida com clique exclusivo para abrir Galeria */}
      {thumbnail && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setGalleryIndex(0);
            setShowGallery(true);
          }}
          className={`flex-shrink-0 rounded-2xl overflow-hidden bg-gray-100 dark:bg-slate-800 cursor-zoom-in relative group/thumb ${
            inFeed ? 'w-32 h-28 sm:w-44 sm:h-[135px] self-start' : 'w-32 h-32 sm:w-44 sm:h-40'
          }`}
          style={inFeed ? { borderRadius: '15px' } : { height: window.innerWidth < 640 ? 'auto' : '137px', borderRadius: '15px' }}
          title="Ver imagem na galeria"
        >
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
            style={inFeed ? undefined : { height: window.innerWidth < 640 ? '120px' : '135px' }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          {postImages.length > 1 && (
            <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm pointer-events-none flex items-center gap-1 shadow-sm">
              <ImageIcon className="w-2.5 h-2.5" />
              <span>{postImages.length}</span>
            </div>
          )}
        </div>
      )}

      {/* Coluna da Direita: Autor + Título + Descrição + Ações/Métricas */}
      <div
        className={`flex-1 min-w-0 flex flex-col ${
          inFeed
            ? thumbnail
              ? 'min-h-[135px]'
              : 'gap-2.5 min-h-0'
            : ''
        }`}
        style={inFeed ? undefined : { minHeight: window.innerWidth < 640 ? '0' : (thumbnail ? '137px' : '110px') }}
      >

        {/* Header Superior: Autor, Comunidade, Tempo e Bookmark */}
        <div className="flex items-center justify-between gap-2" style={{ marginBottom: '0px' }}>
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectAuthor(post.author);
              }}
              className="flex-shrink-0 focus:outline-none"
            >
              <img
                src={avatarUrl}
                alt={post.author}
                loading="lazy"
                className="w-6 h-6 rounded-full bg-gray-100 object-cover hover:opacity-90 transition"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.ecency.com/u/hive/avatar/small';
                }}
              />
            </button>

            <div className="flex items-center gap-1.5 truncate text-xs">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAuthor(post.author);
                }}
                className="font-bold text-gray-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 truncate focus:outline-none transition-colors"
              >
                {post.author}
              </button>

              <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">
                ({rep})
              </span>

              {(post.community_title || post.category) && (
                <>
                  <span className="text-gray-400 dark:text-slate-600">•</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (post.community) onSelectTag(post.community);
                      else if (post.category) onSelectTag(post.category);
                    }}
                    className="font-medium text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 truncate hidden sm:inline"
                  >
                    {post.community_title || post.category}
                  </button>
                </>
              )}

              <span className="text-gray-400 dark:text-slate-600">•</span>
              <span className="text-gray-400 dark:text-slate-500 font-normal">
                {formatTime(post.created)}
              </span>
            </div>
          </div>

          <button
            onClick={toggleBookmark}
            className={`p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition ${
              isBookmarked
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
            }`}
            title={isBookmarked ? 'Bookmarked' : 'Save post'}
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Título e Snippet reduzido para 1 linha */}
        <div className="flex-1 pt-2">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug">
            {displayTitle}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 line-clamp-1 leading-relaxed mt-1">
            {snippet}
          </p>
        </div>

        {/* Rodapé de Ações (Métricas + Botoes) na Direita */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 mt-auto">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            {/* Upvote Button */}
            <button
              onClick={handleUpvote}
              disabled={isVoting}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer ${
                upvoted
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
              } disabled:opacity-60`}
              title={upvoted ? 'Upvoted (Click to remove upvote)' : 'Upvote with Hive Keychain'}
            >
              {isVoting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Heart className={`w-3.5 h-3.5 ${upvoted ? 'fill-white text-white' : ''}`} />
              )}
            </button>

            {/* Comments Counter */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectPost(post, true);
              }}
              className="flex items-center gap-1.5 text-gray-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition group/comm cursor-pointer"
              title={`${childrenCount} comments - click to view and discuss`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 group-hover/comm:text-blue-600 dark:group-hover/comm:text-blue-400 transition-colors" />
              <span className="font-semibold text-xs">{childrenCount}</span>
            </button>

            {/* Reblog Button */}
            {!isComment && (
              <button
                type="button"
                onClick={handleReblog}
                disabled={isReblogging || hasReblogged}
                className={`flex items-center gap-1.5 transition cursor-pointer ${
                  hasReblogged
                    ? 'text-purple-600 dark:text-purple-400 font-bold'
                    : 'text-gray-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400'
                } disabled:cursor-not-allowed`}
                title={hasReblogged ? 'Already reblogged' : 'Reblog with Hive Keychain'}
              >
                {isReblogging ? (
                  <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />
                ) : (
                  <Repeat className={`w-3.5 h-3.5 ${hasReblogged ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-slate-500'}`} />
                )}
                <span className="text-xs">{hasReblogged ? 'Reblogged' : 'Reblog'}</span>
              </button>
            )}

            {reblogSuccessToast && (
              <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-full animate-in fade-in">
                Reblogged!
              </span>
            )}
          </div>

          {/* Right action icons: Share & More */}
          <div className="flex items-center gap-2 text-gray-400 dark:text-slate-500 relative">
            <button
              onClick={handleShare}
              className="p-1 hover:text-gray-600 dark:hover:text-slate-300 rounded transition cursor-pointer"
              title="Share post"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMoreMenu(!showMoreMenu);
                }}
                className={`p-1 rounded transition cursor-pointer ${
                  showMoreMenu ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-800' : 'hover:text-gray-600 dark:hover:text-slate-300'
                }`}
                title="More post options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {/* Dropdown Menu */}
              {showMoreMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20 cursor-default"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMoreMenu(false);
                    }}
                  />
                  <div
                    className="absolute right-0 bottom-full mb-2 w-52 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 py-1.5 z-30 animate-in fade-in zoom-in-95 text-xs text-gray-700 dark:text-slate-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        onSelectPost(post);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Open in Reader</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        handleShare();
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <Share2 className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                      <span>Copy Hive Link</span>
                    </button>

                    {onMuteAuthor && (
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          onMuteAuthor(post.author);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer font-semibold border-t border-gray-100 dark:border-slate-800"
                        title={`Mute @${post.author} across Feed & Discover`}
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Mute @{post.author}</span>
                      </button>
                    )}

                    {onBlockWord && post.category && (
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          onBlockWord(post.category);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center gap-2 cursor-pointer font-medium"
                        title={`Filter #${post.category} posts`}
                      >
                        <Hash className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Filter #{post.category}</span>
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
          className="w-full flex items-center justify-between gap-3 px-2 sm:px-4 py-2 z-30 flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Author info & post title snippet */}
          <div className="flex items-center gap-2.5 min-w-0 max-w-[65%]">
            <img
              src={avatarUrl}
              alt={post.author}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500/30 flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-white">
                <span className="font-bold truncate">@{post.author}</span>
                <span className="text-[10px] text-white/50">• {formatTime(post.created)}</span>
                {postImages.length > 1 && (
                  <span className="text-[10px] font-semibold bg-white/15 px-2 py-0.5 rounded-full text-white/80 ml-1">
                    {galleryIndex + 1} / {postImages.length}
                  </span>
                )}
              </div>
              <h3 className="text-white/80 text-xs font-medium truncate">
                {displayTitle}
              </h3>
            </div>
          </div>

          {/* Actions: View Full Post, Quick Comment Toggle, Close */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Shortcut to view full post */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowGallery(false);
                onSelectPost(post);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md cursor-pointer"
              title="Open full post for reading"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>View Full Post</span>
            </button>

            {/* Quick Comment Toggle */}
            <button
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
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Comment</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowGallery(false);
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border border-white/15 shadow-md group"
              title="Close gallery (Esc)"
            >
              <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>

        {/* Central Image View with Wide Left & Right Click Navigation Zones and Mouse Wheel Support */}
        <div
          ref={lightboxImageContainerRef}
          className="relative flex-1 w-full flex items-center justify-center min-h-0 py-2 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          title="Mouse wheel to change image"
        >
          {/* Centered Image */}
          <img
            src={postImages[galleryIndex]}
            alt={`Post image ${galleryIndex + 1}`}
            className="max-h-[70vh] sm:max-h-[74vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl transition-all duration-200 pointer-events-none select-none z-10"
          />

          {/* Left Navigation Zone: click anywhere on the left half to go to previous image */}
          {postImages.length > 1 && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                setGalleryIndex((prev) => (prev > 0 ? prev - 1 : postImages.length - 1));
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
          {postImages.length > 1 && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                setGalleryIndex((prev) => (prev < postImages.length - 1 ? prev + 1 : 0));
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

        {/* Quick Comment Drawer & Thumbnail Strip */}
        <div className="w-full flex flex-col items-center gap-2 z-30" onClick={(e) => e.stopPropagation()}>
          {/* Quick Comment Drawer */}
          {showCommentBox && (
            <div className="w-full max-w-xl bg-slate-900/95 backdrop-blur-md border border-white/15 rounded-2xl p-3 shadow-2xl animate-in slide-in-from-bottom-2 duration-150 space-y-2">
              {commentSuccessToast ? (
                <div className="p-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold text-center">
                  Comment published successfully on Hive!
                </div>
              ) : (
                <form onSubmit={handleQuickComment} className="flex gap-2 items-center">
                  {currentUser ? (
                    <img
                      src={getHiveAvatarUrl(currentUser.username, 'small')}
                      alt={currentUser.username}
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-white/50 text-xs font-bold">
                      ?
                    </div>
                  )}
                  <input
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
                    type="submit"
                    disabled={sendingComment || !quickCommentText.trim()}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer flex-shrink-0 shadow-sm"
                  >
                    {sendingComment ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Thumbnail Strip (if more than 1 image) */}
          {postImages.length > 1 && (
            <div className="w-full max-w-xl flex items-center justify-center gap-2 overflow-x-auto py-1 px-4 scrollbar-none">
              {postImages.map((src, i) => (
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
                      : 'opacity-40 hover:opacity-80'
                  }`}
                  title={`Image ${i + 1}`}
                >
                  <img
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


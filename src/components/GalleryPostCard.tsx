import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  BookOpen,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Image as ImageIcon
} from 'lucide-react';
import {
  HivePost,
  calculateReputation,
  getHiveAvatarUrl,
  getPostThumbnail,
  getPostSnippet
} from '../services/hiveApi';
import { KeychainService, CurrentUser } from '../services/keychain';
import { getSafeImageUrl } from '../utils/sanitize';
import { VoteWeightDialog } from './VoteWeightDialog';

export interface GalleryPostCardProps {
  post: HivePost;
  onSelectPost: (post: HivePost, jumpToComments?: boolean) => void;
  onSelectAuthor: (author: string) => void;
  onSelectTag: (tag: string) => void;
  currentUser?: CurrentUser | null;
  onRequireLogin?: () => void;
}

export const GalleryPostCard: React.FC<GalleryPostCardProps> = ({
  post,
  onSelectPost,
  onSelectAuthor,
  onSelectTag,
  currentUser,
  onRequireLogin
}) => {
  const [upvoted, setUpvoted] = useState<boolean>(() => {
    if (currentUser?.username && post.active_votes) {
      return post.active_votes.some(
        (v) => v.voter.toLowerCase() === currentUser.username.toLowerCase()
      );
    }
    return false;
  });
  const [isVoting, setIsVoting] = useState<boolean>(false);
  const [voteOpen, setVoteOpen] = useState(false);

  const [isBookmarked, setIsBookmarked] = useState(() => {
    try {
      const saved = localStorage.getItem('hive_bookmarks') || '[]';
      const parsed = JSON.parse(saved);
      return parsed.includes(`${post.author}/${post.permlink}`);
    } catch {
      return false;
    }
  });

  // Card Image Carousel state (flipper right on the feed card)
  const [cardImageIndex, setCardImageIndex] = useState(0);

  // Lightbox Gallery state
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Inline Quick Comment state
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [quickCommentText, setQuickCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [commentSuccessToast, setCommentSuccessToast] = useState(false);

  // Refs for mouse wheel image flipping in lightbox
  const lightboxImageContainerRef = useRef<HTMLDivElement>(null);
  const lastLightboxWheelTimeRef = useRef(0);

  const rep = calculateReputation(post.author_reputation);
  const avatarUrl = getHiveAvatarUrl(post.author, 'small');
  const rawThumbnail = getPostThumbnail(post);
  const thumbnail = getSafeImageUrl(rawThumbnail, { width: 900 });
  const snippet = getPostSnippet(post.body, 100);

  // Extract all images in the post for gallery view
  const postImages = useMemo(() => {
    const list: string[] = [];
    if (rawThumbnail) list.push(rawThumbnail);

    if (post.json_metadata) {
      try {
        const meta =
          typeof post.json_metadata === 'string'
            ? JSON.parse(post.json_metadata)
            : post.json_metadata;
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
    return filtered.length > 0 ? filtered : rawThumbnail ? [rawThumbnail] : [];
  }, [post.json_metadata, post.body, rawThumbnail]);



  // Mouse wheel listener for the Lightbox Gallery modal
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

  const toggleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    const id = `${post.author}/${post.permlink}`;
    try {
      const saved = localStorage.getItem('hive_bookmarks') || '[]';
      let parsed: string[] = JSON.parse(saved);
      if (parsed.includes(id)) {
        parsed = parsed.filter((item) => item !== id);
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

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      return;
    }
    setVoteOpen(true);
  };

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
        alert(res.message || 'Comment failed.');
      }
    } catch (err: any) {
      alert(err.message || 'Comment failed.');
    } finally {
      setSendingComment(false);
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const safeStr = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
      const past = new Date(safeStr).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - past) / 1000));
      if (diffSec < 60) return `${diffSec}s`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d`;
    } catch {
      return '';
    }
  };

  const currentImageSrc = postImages[cardImageIndex] || thumbnail;

  return (
    <article
      id={`gallery-card-${post.post_id || post.permlink}`}
      className="bg-white dark:bg-slate-900 border border-gray-100/90 dark:border-slate-800 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_1px_6px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 mb-3 sm:mb-6 group flex flex-col"
    >
      {/* Header: Author + Community + Timestamp + Bookmark */}
      <div className="flex items-center justify-between p-4 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => onSelectAuthor(post.author)}
            className="flex-shrink-0 cursor-pointer"
          >
            <img
              src={avatarUrl}
              alt={post.author}
              loading="lazy"
              className="w-8 h-8 rounded-full bg-gray-100 object-cover ring-1 ring-blue-500/20 hover:opacity-90 transition"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.ecency.com/u/hive/avatar/small';
              }}
            />
          </button>

          <div className="min-w-0 flex items-center gap-1.5 flex-wrap text-xs">
            <button
              type="button"
              onClick={() => onSelectAuthor(post.author)}
              className="font-bold text-gray-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 truncate cursor-pointer transition-colors"
            >
              @{post.author}
            </button>
            <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">
              ({rep})
            </span>

            {(post.community_title || post.category) && (
              <>
                <span className="text-gray-300 dark:text-slate-600">•</span>
                <button
                  type="button"
                  onClick={() => {
                    if (post.community) onSelectTag(post.community);
                    else if (post.category) onSelectTag(post.category);
                  }}
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate cursor-pointer"
                >
                  {post.community_title || post.category}
                </button>
              </>
            )}

            <span className="text-gray-300 dark:text-slate-600">•</span>
            <span className="text-gray-400 dark:text-slate-500">
              {formatTime(post.created)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleBookmark}
          className={`p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer ${
            isBookmarked
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
          }`}
          title={isBookmarked ? 'Bookmarked' : 'Save post'}
        >
          <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Featured Locked Space Container with Uncropped Resized Image & Title Overlay */}
      {currentImageSrc ? (
        <div
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 640) {
              onSelectPost(post);
            } else {
              setGalleryIndex(cardImageIndex);
              setShowGallery(true);
            }
          }}
          className="relative w-full h-[220px] xs:h-[250px] sm:h-[480px] md:h-[520px] bg-slate-950/5 dark:bg-black/60 overflow-hidden cursor-pointer sm:cursor-zoom-in group/img flex items-center justify-center select-none"
          title="Open post"
        >
          {/* Uncropped Image: Resized to fit perfectly within the reserved space */}
          <img
            src={currentImageSrc}
            alt={post.title}
            loading="lazy"
            className="max-h-full max-w-full h-auto w-auto object-contain mx-auto block transition-transform duration-300 group-hover/img:scale-[1.008]"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />

          {/* Previous Card Image Button (on card itself) */}
          {postImages.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCardImageIndex((prev) => (prev > 0 ? prev - 1 : postImages.length - 1));
              }}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/65 hover:bg-black/85 text-white backdrop-blur-md border border-white/20 shadow-lg transition opacity-80 hover:opacity-100 hover:scale-105 cursor-pointer z-20"
              title="Previous image"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Next Card Image Button (on card itself) */}
          {postImages.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCardImageIndex((prev) => (prev < postImages.length - 1 ? prev + 1 : 0));
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/65 hover:bg-black/85 text-white backdrop-blur-md border border-white/20 shadow-lg transition opacity-80 hover:opacity-100 hover:scale-105 cursor-pointer z-20"
              title="Next image"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* Image Counter Badge */}
          {postImages.length > 1 && (
            <div className="absolute top-3 right-3 bg-black/65 text-white text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1 shadow-md pointer-events-none z-10">
              <ImageIcon className="w-3 h-3 text-blue-300" />
              <span>{cardImageIndex + 1} / {postImages.length}</span>
            </div>
          )}

          {/* Title directly ON the image with text-stroke/outline */}
          <div className="absolute bottom-0 inset-x-0 p-3.5 sm:p-5 pt-16 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-10 pointer-events-none">
            <h2
              onClick={(e) => {
                e.stopPropagation();
                onSelectPost(post);
              }}
              className="font-black text-white text-sm sm:text-lg leading-tight sm:leading-snug line-clamp-3 sm:line-clamp-2 cursor-pointer hover:underline pointer-events-auto break-words"
              style={{
                textShadow:
                  '0 1px 2px #000, 0 2px 6px rgba(0,0,0,0.95), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                WebkitTextStroke: '0.45px #000000'
              }}
              title={post.title}
            >
              {post.title}
            </h2>
            <p className="text-white/90 text-[11px] sm:text-xs line-clamp-1 mt-0.5 font-medium pointer-events-none hidden xs:block"
               style={{
                 textShadow: '0 1px 2px rgba(0,0,0,0.8)'
               }}
            >
              {snippet}
            </p>
          </div>
        </div>
      ) : (
        <div
          onClick={() => onSelectPost(post)}
          className="w-full h-44 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 flex items-center justify-center p-6 text-center cursor-pointer"
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2">
            {post.title}
          </h2>
        </div>
      )}

      {/* Action Row: Upvote (no counts/payout), Comment (no count), Share, Read Full Post */}
      <div className="flex items-center justify-between p-3 sm:p-4">
        <div className="flex items-center gap-2.5">
          {/* Upvote Button (Simple Heart without count or money) */}
          <button
            type="button"
            onClick={handleHeartClick}
            disabled={isVoting}
            className={`p-2 rounded-full transition cursor-pointer border ${
              upvoted
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50'
                : 'bg-gray-50 dark:bg-slate-800/80 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-gray-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border-gray-200/60 dark:border-slate-700'
            }`}
            title={upvoted ? 'Upvoted' : 'Upvote post'}
          >
            <Heart className={`w-4 h-4 ${upvoted ? 'fill-current text-rose-600' : ''}`} />
          </button>

          {/* Quick Comment Toggle (Simple Icon without count) */}
          <button
            type="button"
            onClick={() => setShowCommentBox((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition cursor-pointer border ${
              showCommentBox
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                : 'bg-gray-50 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border-gray-200/60 dark:border-slate-700'
            }`}
            title="Comment"
          >
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-bold">{post.children || 0}</span>
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={handleShare}
            className="p-2 rounded-full text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Share link"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        {/* View Full Post shortcut */}
        <button
          type="button"
          onClick={() => onSelectPost(post)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Read Post</span>
        </button>
      </div>

      {/* Quick Comment Drawer */}
      {showCommentBox && (
        <div className="p-4 pt-1 pb-4 bg-gray-50/60 dark:bg-slate-800/40 border-t border-gray-100/70 dark:border-slate-800/70 space-y-2 animate-in fade-in duration-150">
          {commentSuccessToast ? (
            <div className="p-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-bold text-center">
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
                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 text-gray-500 text-xs font-bold">
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
                className="flex-1 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 text-xs px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 focus:outline-none focus:border-blue-500 transition"
              />
              <button
                type="submit"
                disabled={sendingComment || !quickCommentText.trim()}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer flex-shrink-0 shadow-xs"
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

      {/* Vote dialog */}
      <VoteWeightDialog
        open={voteOpen}
        username={currentUser?.username || ''}
        author={post.author}
        permlink={post.permlink}
        onClose={() => setVoteOpen(false)}
        onVoted={() => {
          setUpvoted(true);
        }}
      />

      {/* ================= LIGHTBOX GALLERY MODAL (PORTAL) ================= */}
      {showGallery && postImages.length > 0 && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-5 select-none animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation();
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
                  {post.title}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
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
            <img
              src={postImages[galleryIndex]}
              alt={`Post image ${galleryIndex + 1}`}
              className="max-h-[75vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl transition-all duration-200 pointer-events-none select-none z-10"
            />

            {/* Left Navigation Zone */}
            {postImages.length > 1 && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setGalleryIndex((prev) => (prev > 0 ? prev - 1 : postImages.length - 1));
                }}
                className="absolute inset-y-0 left-0 w-1/2 z-20 cursor-pointer flex items-center justify-start pl-3 sm:pl-6 group/prev"
                title="Previous image"
              >
                <div className="p-3 rounded-full bg-black/60 group-hover/prev:bg-black/90 text-white backdrop-blur-md border border-white/20 shadow-xl transition-all group-hover/prev:scale-110 flex items-center justify-center">
                  <ChevronLeft className="w-6 h-6" />
                </div>
              </div>
            )}

            {/* Right Navigation Zone */}
            {postImages.length > 1 && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setGalleryIndex((prev) => (prev < postImages.length - 1 ? prev + 1 : 0));
                }}
                className="absolute inset-y-0 right-0 w-1/2 z-20 cursor-pointer flex items-center justify-end pr-3 sm:pr-6 group/next"
                title="Next image"
              >
                <div className="p-3 rounded-full bg-black/60 group-hover/next:bg-black/90 text-white backdrop-blur-md border border-white/20 shadow-xl transition-all group-hover/next:scale-110 flex items-center justify-center">
                  <ChevronRight className="w-6 h-6" />
                </div>
              </div>
            )}
          </div>

          {/* Thumbnail preview strip */}
          {postImages.length > 1 && (
            <div
              className="w-full max-w-xl mx-auto flex items-center justify-center gap-2 overflow-x-auto py-1 px-4 z-30 scrollbar-none"
              onClick={(e) => e.stopPropagation()}
            >
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
        </div>,
        document.body
      )}
    </article>
  );
};

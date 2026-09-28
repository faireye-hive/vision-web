import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  VolumeX
} from 'lucide-react';
import {
  HivePost,
  getDiscussion,
  calculateReputation,
  getHiveAvatarUrl,
  getPost,
  getPostSnippet
} from '../services/hiveApi';
import { KeychainService, CurrentUser } from '../services/keychain';
import { markdownToSafeHtmlWithHeadings, markdownToSafeHtml, PostHeading } from '../utils/sanitize';
import { useAuth } from '../context/AuthContext';
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

  // Parse HTML and headings safely with DOMPurify
  const { html: safeHtmlContent, headings } = useMemo(() => {
    return markdownToSafeHtmlWithHeadings(post.body || '');
  }, [post.body]);

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
      className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/70 dark:border-slate-800 flex flex-col w-full animate-in fade-in duration-200 relative"
    >
      {/* Top Reading Progress Line */}
      <div
        className="h-1 bg-gradient-to-r from-blue-500 to-indigo-600 sticky top-16 z-30 transition-all duration-150"
        style={{ width: `${readingProgress}%` }}
      />

      {/* ================= UNIFIED TOP BREADCRUMB & AUTHOR HEADER BAR ================= */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-16 z-20 border-b border-gray-100 dark:border-slate-800 gap-3">

        {/* Left: Back button + Author details */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            id="back-to-feed-btn"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-bold text-xs transition shadow-2xs cursor-pointer flex-shrink-0"
            title="Back to Feed (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Author avatar */}
          <button
            onClick={() => onSelectAuthor(post.author)}
            className="focus:outline-none flex-shrink-0 group cursor-pointer"
            title={`View @${post.author} profile`}
          >
            <img
              src={avatarUrl}
              alt={post.author}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ring-2 ring-blue-500/20 group-hover:ring-blue-500 transition shadow-2xs bg-gray-100 dark:bg-slate-800"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/medium';
              }}
            />
          </button>

          {/* Author info & metadata */}
          <div className="min-w-0 flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
            <button
              onClick={() => onSelectAuthor(post.author)}
              className="font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition truncate cursor-pointer text-xs sm:text-sm"
            >
              @{post.author}
            </button>
            <span className="text-[10px] sm:text-[11px] font-semibold px-1.5 py-0.2 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
              {rep}
            </span>

            {/* Author Quick Follow & Mute Options */}
            {(!currentUser || currentUser.username.toLowerCase() !== post.author.toLowerCase()) && (
              <div className="flex items-center gap-1 ml-0.5">
                <button
                  type="button"
                  onClick={() => handleToggleFollowAuthor(post.author)}
                  disabled={followLoading === post.author.toLowerCase()}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition cursor-pointer disabled:opacity-50 ${
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

            {isComment && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                Comment
              </span>
            )}

            <span className="text-gray-300 dark:text-slate-600 hidden xs:inline">•</span>
            <span className="text-gray-500 dark:text-slate-400 hidden sm:flex items-center gap-1" title={postDate.full}>
              <Clock className="w-3 h-3 text-gray-400 dark:text-slate-500" />
              <span>{postDate.relative}</span>
            </span>

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
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Header Shortcut to Comments */}
          <button
            onClick={scrollToComments}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 text-xs font-bold transition border border-blue-200/60 dark:border-blue-900/60 shadow-2xs cursor-pointer"
            title={`Jump directly to ${totalCommentsCount} comments`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{totalCommentsCount}</span>
            <span className="hidden lg:inline text-[11px] font-medium text-blue-600/80 dark:text-blue-400/80">Comments</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="p-1.5 rounded-xl text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Copy Hive link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>

          <a
            href={`https://ecency.com/@${post.author}/${post.permlink}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-xl text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="View on Ecency.com"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Close post (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ================= POST CONTENT AREA ================= */}
      <div className="px-5 sm:px-10 md:px-12 py-6 space-y-5 max-w-4xl mx-auto w-full">

        {/* ================= COMMENT PARENT CONTEXT BANNER ================= */}
        {isComment && (
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-blue-50/90 dark:from-blue-950/40 via-indigo-50/70 dark:via-indigo-950/30 to-blue-50/40 dark:to-slate-900 border border-blue-100/90 dark:border-blue-900/40 shadow-2xs space-y-3">
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
                Replying to discussion thread: "{post.parent_permlink.replace(/[-_]/g, ' ')}"
              </div>
            ) : null}
          </div>
        )}

        {/* Big, Clear Post Title */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight">
          {isComment && (!post.title || post.title.startsWith('Re:'))
            ? `Comment by @${post.author}`
            : post.title}
        </h1>

        {/* Author details on mobile / tags row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 sm:hidden">
            <span className="flex items-center gap-1" title={postDate.full}>
              <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
              <span>{postDate.relative}</span>
            </span>
            {(post.community_title || post.community) && (
              <>
                <span>•</span>
                <button
                  onClick={() => {
                    onSelectTag(post.community || post.category);
                    onClose();
                  }}
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {post.community_title || post.community}
                </button>
              </>
            )}
          </div>

          {/* Tags list pills cleanly wrapped without clipping */}
          {postTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {postTags.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    onSelectTag(t);
                    onClose();
                  }}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium border border-gray-200/60 dark:border-slate-700 shadow-2xs transition cursor-pointer"
                >
                  <Hash className="w-2.5 h-2.5 text-gray-400 dark:text-slate-500" />
                  <span>{t}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Article Body (DOMPurify protected) */}
        <div
          id="sanitized-post-body"
          className="article-body max-w-none text-gray-800 dark:text-slate-100 leading-relaxed break-words pt-2 text-base sm:text-lg"
          dangerouslySetInnerHTML={{ __html: safeHtmlContent }}
        />

        {/* Full Tags Section at bottom of post */}
        {postTags.length > 0 && (
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
        <div className="pt-6 border-t border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">

          {/* Tip Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTipModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold text-xs transition cursor-pointer"
              title="Send tip to author"
            >
              <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Send Tip</span>
            </button>
          </div>

          {/* Voting & Comments Controls */}
          <div className="flex items-center gap-3">

            {/* Upvote Button with Keychain Slider Popover */}
            <div className="relative">
              <button
                id="keychain-vote-btn"
                onClick={() => setShowVoteSlider(!showVoteSlider)}
                disabled={voteLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition shadow-xs cursor-pointer ${hasVoted
                    ? 'bg-rose-500 text-white'
                    : 'bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400'
                  }`}
                title={hasVoted ? 'Upvoted with Keychain' : 'Upvote with Keychain'}
              >
                <Heart className={`w-4 h-4 ${hasVoted ? 'fill-white' : ''}`} />
                <span>{hasVoted ? 'Upvoted' : 'Upvote'}</span>
              </button>

              {/* Vote weight selector */}
              {showVoteSlider && (
                <div className="absolute right-0 bottom-full mb-2 w-72 bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-4 z-30 animate-in fade-in zoom-in-95 border border-gray-100 dark:border-slate-800">
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
                        onClick={() => setVoteWeight(pct)}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 cursor-pointer"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleVoteSubmit}
                    disabled={voteLoading}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5 fill-white" />
                    <span>{voteLoading ? 'Signing with Keychain...' : 'Confirm Vote'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Comments Counter Shortcut */}
            <button
              onClick={scrollToComments}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 px-3 py-2 rounded-full transition cursor-pointer"
              title="Jump to Comments"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
              <span>{totalCommentsCount}</span>
            </button>

          </div>

        </div>

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
          <form onSubmit={handleAddComment} className="bg-gray-50/80 dark:bg-slate-800/50 p-4 sm:p-5 rounded-2xl space-y-3 border border-gray-100 dark:border-slate-800">
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
              className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl text-xs sm:text-sm text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none shadow-xs"
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
              >
                <Send className="w-3.5 h-3.5" />
                <span>{commentLoading ? 'Signing...' : 'Post Reply'}</span>
              </button>
            </div>
          </form>

          {/* Comment List */}
          {comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment) => (
                <CommentThreadItem
                  key={comment.post_id || `${comment.author}/${comment.permlink}`}
                  comment={comment}
                  discussion={discussion}
                  depth={0}
                  onSelectAuthor={onSelectAuthor}
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
        className="fixed right-5 sm:right-7 bottom-24 z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-lg border border-gray-200/90 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 text-gray-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 font-bold transition-all duration-200 hover:shadow-xl hover:scale-105 cursor-pointer group"
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
        className={`fixed bottom-6 right-5 sm:right-7 z-40 flex items-center gap-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-gray-200/90 dark:border-slate-700 transition-all duration-300 ${
          scrolledDown ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold transition cursor-pointer shadow-2xs"
          title="Back to Feed (Esc)"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="h-4 w-px bg-gray-200 dark:bg-slate-700" />

        <button
          onClick={scrollToComments}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/50 text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-bold transition cursor-pointer"
          title={`Jump to ${totalCommentsCount} Comments`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>{totalCommentsCount}</span>
        </button>

        <div className="h-4 w-px bg-gray-200 dark:bg-slate-700" />

        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
          title="Scroll to Top"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          <span>Top ({readingProgress}%)</span>
        </button>
      </div>

    </article>
  );
};

interface CommentThreadItemProps {
  comment: HivePost;
  discussion: Record<string, HivePost>;
  depth: number;
  onSelectAuthor: (author: string) => void;
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

    setIsVoting(true);
    try {
      const weight = upvoted ? 0 : 10000;
      const res = await KeychainService.vote(currentUser.username, comment.author, comment.permlink, weight);
      if (res.success) {
        if (upvoted) {
          setUpvoted(false);
          setVoteCountDelta(prev => prev - 1);
        } else {
          setUpvoted(true);
          setVoteCountDelta(prev => prev + 1);
        }
      } else {
        alert(res.message || res.error || 'Vote could not be broadcast via Keychain.');
      }
    } catch (err: any) {
      alert(err.message || 'Vote failed');
    } finally {
      setIsVoting(false);
    }
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

  return (
    <div className={`p-3.5 sm:p-4 rounded-2xl transition-all ${
      depth === 0 ? 'bg-gray-50/80 dark:bg-slate-800/60 border border-gray-100/70 dark:border-slate-700/60 shadow-2xs' : 'bg-white/90 dark:bg-slate-900/90 border border-blue-100 dark:border-blue-950/70 shadow-2xs'
    }`}>
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

      {/* Comment Body */}
      <div
        className="article-body text-xs sm:text-sm text-gray-800 dark:text-slate-100 leading-relaxed pl-8 break-words max-w-none mb-2"
        dangerouslySetInnerHTML={{ __html: safeCommentHtml }}
      />

      {/* Actions: Heart Upvote Button, Reply Button, Toggle Replies */}
      <div className="flex items-center gap-3 sm:gap-4 text-[11px] text-gray-500 dark:text-slate-400 pl-8 pt-1 flex-wrap">
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

        {/* Toggle child replies */}
        {childReplies.length > 0 && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50/80 dark:bg-blue-950/60 hover:bg-blue-100/80 dark:hover:bg-blue-900/60 px-2 py-0.5 rounded-full transition cursor-pointer"
            title={isExpanded ? 'Hide replies' : 'Show replies'}
          >
            <MessageSquare className="w-3 h-3 text-blue-500" />
            <span>{childReplies.length} {childReplies.length === 1 ? 'reply' : 'replies'}</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* In-line Reply Box */}
      {showReplyBox && (
        <form onSubmit={handleSendReply} className="mt-3 pl-8 space-y-2 animate-in fade-in">
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
      {childReplies.length > 0 && isExpanded && (
        <div className="mt-3 pl-3 sm:pl-5 border-l-2 border-blue-200/90 dark:border-blue-900/80 hover:border-blue-400 dark:hover:border-blue-600 space-y-3 transition-colors">
          {childReplies.map((child) => (
            <CommentThreadItem
              key={child.post_id || `${child.author}/${child.permlink}`}
              comment={child}
              discussion={discussion}
              depth={depth + 1}
              onSelectAuthor={onSelectAuthor}
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
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
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
  Bookmark
} from 'lucide-react';
import {
  HivePost,
  getDiscussion,
  calculateReputation,
  getHiveAvatarUrl
} from '../services/hiveApi';
import { KeychainService, CurrentUser } from '../services/keychain';
import { markdownToSafeHtmlWithHeadings, markdownToSafeHtml, PostHeading } from '../utils/sanitize';

interface PostReaderProps {
  post: HivePost;
  onClose: () => void;
  onSelectAuthor: (author: string) => void;
  onSelectTag: (tag: string) => void;
  currentUser: CurrentUser | null;
  onRequireLogin?: () => void;
  onHeadingsExtracted?: (headings: PostHeading[]) => void;
  onActiveHeadingChange?: (id: string) => void;
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
  onActiveHeadingChange
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

  // Fetch comments & discussion without resetting scroll
  useEffect(() => {
    let isMounted = true;
    setLoadingDiscussion(true);

    getDiscussion(post.author, post.permlink)
      .then((data) => {
        if (isMounted) {
          setDiscussion(data);
          setLoadingDiscussion(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoadingDiscussion(false);
      });

    return () => {
      isMounted = false;
    };
  }, [post.author, post.permlink]);

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
        getDiscussion(post.author, post.permlink, true).then(setDiscussion);
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
    if (!root.replies || root.replies.length === 0) return [];

    return root.replies
      .map((replyKey) => discussion[replyKey])
      .filter((p): p is HivePost => !!p);
  };

  const comments = getComments();
  const totalCommentsCount = comments.length > 0 ? comments.length : (post.children || 0);
  const totalVotesCount = (post.stats?.total_votes || post.active_votes?.length || 0) + (hasVoted ? 1 : 0);
  const payoutString = post.payout ? `$${post.payout.toFixed(3)}` : (post.pending_payout_value || '$0.000');

  return (
    <article
      id="in-place-post-reader"
      className="bg-white rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col w-full animate-in fade-in duration-200 relative"
    >
      {/* Top Reading Progress Line */}
      <div
        className="h-1 bg-gradient-to-r from-blue-500 to-indigo-600 sticky top-16 z-30 transition-all duration-150"
        style={{ width: `${readingProgress}%` }}
      />

      {/* ================= UNIFIED TOP BREADCRUMB & AUTHOR HEADER BAR ================= */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-white/95 backdrop-blur-md sticky top-16 z-20 border-b border-gray-100 gap-3">

        {/* Left: Back button + Author details */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            id="back-to-feed-btn"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-xs transition shadow-2xs cursor-pointer flex-shrink-0"
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
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ring-2 ring-blue-500/20 group-hover:ring-blue-500 transition shadow-2xs"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/medium';
              }}
            />
          </button>

          {/* Author info & metadata */}
          <div className="min-w-0 flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
            <button
              onClick={() => onSelectAuthor(post.author)}
              className="font-bold text-gray-900 hover:text-blue-600 transition truncate cursor-pointer text-xs sm:text-sm"
            >
              @{post.author}
            </button>
            <span className="text-[10px] sm:text-[11px] font-semibold px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700">
              {rep}
            </span>
            <span className="text-gray-300 hidden xs:inline">•</span>
            <span className="text-gray-500 hidden sm:flex items-center gap-1" title={postDate.full}>
              <Clock className="w-3 h-3 text-gray-400" />
              <span>{postDate.relative}</span>
            </span>

            {(post.community_title || post.community) && (
              <>
                <span className="text-gray-300 hidden md:inline">•</span>
                <button
                  onClick={() => {
                    onSelectTag(post.community || post.category);
                    onClose();
                  }}
                  className="hidden md:flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 hover:underline transition truncate cursor-pointer text-xs"
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 text-xs font-bold transition border border-blue-200/60 shadow-2xs cursor-pointer"
            title={`Jump directly to ${totalCommentsCount} comments`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
            <span>{totalCommentsCount}</span>
            <span className="hidden lg:inline text-[11px] font-medium text-blue-600/80">Comments</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            title="Copy Hive link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
          </button>

          <a
            href={`https://ecency.com/@${post.author}/${post.permlink}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            title="View on Ecency.com"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            title="Close post (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ================= POST CONTENT AREA ================= */}
      <div className="px-5 sm:px-10 md:px-12 py-6 space-y-5 max-w-4xl mx-auto w-full">

        {/* Big, Clear Post Title */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">
          {post.title}
        </h1>

        {/* Author details on mobile / tags row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-500 sm:hidden">
            <span className="flex items-center gap-1" title={postDate.full}>
              <Clock className="w-3.5 h-3.5 text-gray-400" />
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
                  className="font-semibold text-blue-600 hover:underline"
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
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-100 hover:bg-blue-50 text-gray-700 hover:text-blue-600 font-medium border border-gray-200/60 shadow-2xs transition cursor-pointer"
                >
                  <Hash className="w-2.5 h-2.5 text-gray-400" />
                  <span>{t}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Article Body (DOMPurify protected) */}
        <div
          id="sanitized-post-body"
          className="article-body prose prose-slate max-w-none text-gray-800 leading-relaxed break-words pt-2"
          dangerouslySetInnerHTML={{ __html: safeHtmlContent }}
        />

        {/* Full Tags Section at bottom of post */}
        {postTags.length > 0 && (
          <div className="pt-4 pb-2 border-t border-gray-100 space-y-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
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
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-600 font-medium border border-gray-200 transition cursor-pointer"
                >
                  <Hash className="w-3 h-3 text-gray-400" />
                  <span>{t}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Beneficiaries if present */}
        {post.beneficiaries && post.beneficiaries.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-gray-50/80 text-xs text-gray-500 space-y-1">
            <span className="font-semibold text-gray-700">Beneficiaries:</span>
            <div className="flex flex-wrap gap-2 pt-1">
              {post.beneficiaries.map(b => (
                <span key={b.account} className="bg-white px-2.5 py-0.5 rounded-lg text-gray-600 shadow-xs">
                  @{b.account} ({(b.weight / 100).toFixed(1)}%)
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ================= BOTTOM ENGAGEMENT, PAYOUT & VOTING BAR ================= */}

        {/* User reads first, then votes, tips, sees payout, and comments down here */}
        <div className="pt-6 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">

          {/* Payout Display (Placed at the bottom) */}
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 px-4 py-2 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Payout</span>
              <span className="text-lg font-bold text-emerald-900 font-mono">{payoutString}</span>
            </div>

            {/* Tip Button */}
            <button
              onClick={() => setShowTipModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs transition"
              title="Send tip to author"
            >
              <Coins className="w-4 h-4 text-amber-600" />
              <span>Tip</span>
            </button>
          </div>

          {/* Voting, Comments & Share Controls */}
          <div className="flex items-center gap-3">

            {/* Upvote Button with Keychain Slider Popover */}
            <div className="relative">
              <button
                id="keychain-vote-btn"
                onClick={() => setShowVoteSlider(!showVoteSlider)}
                disabled={voteLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition shadow-xs ${hasVoted
                    ? 'bg-rose-500 text-white'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                  }`}
              >
                <Heart className={`w-4 h-4 ${hasVoted ? 'fill-white' : ''}`} />
                <span>{totalVotesCount} {totalVotesCount === 1 ? 'vote' : 'votes'}</span>
              </button>

              {/* Vote weight selector */}
              {showVoteSlider && (
                <div className="absolute right-0 bottom-full mb-2 w-72 bg-white rounded-3xl shadow-xl p-4 z-30 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-900">Vote Weight</span>
                    <span className="text-xs font-mono font-bold text-rose-600">{voteWeight}%</span>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={voteWeight}
                    onChange={(e) => setVoteWeight(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-rose-600 mb-3"
                  />

                  <div className="flex items-center justify-between gap-1 mb-3">
                    {[25, 50, 75, 100].map(pct => (
                      <button
                        key={pct}
                        onClick={() => setVoteWeight(pct)}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleVoteSubmit}
                    disabled={voteLoading}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Heart className="w-3.5 h-3.5 fill-white" />
                    <span>{voteLoading ? 'Signing with Keychain...' : 'Confirm Vote'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Toggle Curators List Button */}
            <button
              onClick={() => setShowVoters(!showVoters)}
              className="flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
              title="Toggle Curators List"
            >
              <span>Curators ({post.active_votes?.length || 0})</span>
              {showVoters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {/* Comments Counter Shortcut */}
            <button
              onClick={scrollToComments}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 px-3 py-2 rounded-full transition cursor-pointer"
              title="Jump to Comments"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
              <span>{totalCommentsCount}</span>
            </button>

          </div>

        </div>

        {/* Expandable Curators & Voters Section (Placed below post, not cluttering the top) */}
        {showVoters && (
          <div className="p-4 bg-gray-50/70 rounded-2xl space-y-2 animate-in fade-in">
            <p className="text-xs font-bold text-gray-700">Curators on this post:</p>
            {post.active_votes && post.active_votes.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {post.active_votes.map((v, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white text-xs shadow-xs">
                    <button
                      onClick={() => onSelectAuthor(v.voter)}
                      className="font-medium text-gray-800 hover:text-blue-600 truncate"
                    >
                      @{v.voter}
                    </button>
                    <span className="text-[11px] font-mono text-emerald-600 font-bold ml-1">
                      {v.percent / 100}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No voters recorded yet.</p>
            )}
          </div>
        )}

        {/* ================= DISCUSSION & COMMENTS ================= */}
        <section id="comments-section" className="pt-8 border-t border-gray-150 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <span>Discussion ({totalCommentsCount})</span>
            </h3>
            {loadingDiscussion && (
              <span className="text-xs text-gray-400 animate-pulse">Loading discussion...</span>
            )}
          </div>

          {/* New Comment Box */}
          <form onSubmit={handleAddComment} className="bg-gray-50/80 p-4 sm:p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">Leave a reply</span>
              {currentUser ? (
                <span className="text-emerald-600 font-medium">Replying as @{currentUser.username}</span>
              ) : (
                <span className="text-amber-600 font-medium">Connect Keychain to reply</span>
              )}
            </div>

            <textarea
              rows={3}
              value={newCommentBody}
              onChange={(e) => setNewCommentBody(e.target.value)}
              placeholder={currentUser ? 'Write your response in Markdown...' : 'Connect Hive Keychain in the top menu to comment...'}
              className="w-full p-3 bg-white rounded-xl text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none shadow-xs"
            />

            {commentSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-50 text-xs text-emerald-700 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Comment published successfully to the Hive blockchain!</span>
              </div>
            )}

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={commentLoading || !newCommentBody.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{commentLoading ? 'Signing...' : 'Post Reply'}</span>
              </button>
            </div>
          </form>

          {/* Comment List */}
          {comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <CommentCard
                  key={comment.post_id || comment.permlink}
                  comment={comment}
                  onSelectAuthor={onSelectAuthor}
                  currentUser={currentUser}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-gray-50/60 text-center text-xs text-gray-400">
              {loadingDiscussion ? 'Syncing comments from Hive...' : 'No comments yet on this post.'}
            </div>
          )}
        </section>

      </div>

      {/* ================= TIP MODAL ================= */}
      {showTipModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base text-gray-900">Send Tip to @{post.author}</h3>
              </div>
              <button onClick={() => setShowTipModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {tipNotice && (
              <div className="p-3 bg-emerald-50 rounded-xl text-xs text-emerald-700 font-semibold">
                {tipNotice}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Amount & Currency</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-50 rounded-xl font-mono text-sm focus:outline-none focus:bg-white"
                  />
                  <select
                    value={tipCurrency}
                    onChange={(e) => setTipCurrency(e.target.value as 'HIVE' | 'HBD')}
                    className="px-3 py-2 bg-gray-50 rounded-xl font-bold text-xs focus:outline-none focus:bg-white"
                  >
                    <option value="HIVE">HIVE</option>
                    <option value="HBD">HBD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Memo</label>
                <input
                  type="text"
                  value={tipMemo}
                  onChange={(e) => setTipMemo(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 rounded-xl text-xs focus:outline-none focus:bg-white"
                />
              </div>

              <p className="text-[11px] text-gray-500 bg-amber-50/70 p-2.5 rounded-xl">
                Signed safely through your Hive Keychain extension.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowTipModal(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTip}
                disabled={tipLoading}
                className="px-5 py-2 rounded-full text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-xs"
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
        className="fixed right-5 sm:right-7 bottom-24 z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-white/95 backdrop-blur-md shadow-lg border border-gray-200/90 hover:border-blue-400 text-gray-800 hover:text-blue-600 font-bold transition-all duration-200 hover:shadow-xl hover:scale-105 cursor-pointer group"
        title={`Jump directly to comments (${totalCommentsCount})`}
      >
        <div className="relative flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
          {totalCommentsCount > 0 && (
            <span className="absolute -top-2.5 -right-2.5 bg-blue-600 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full min-w-[16px] text-center leading-tight shadow-2xs">
              {totalCommentsCount}
            </span>
          )}
        </div>
        <span className="text-xs font-bold hidden sm:inline text-gray-700 group-hover:text-blue-600">
          {totalCommentsCount} {totalCommentsCount === 1 ? 'Comment' : 'Comments'}
        </span>
      </button>

      {/* ================= FLOATING SCROLL NAVIGATION (FOLLOWS USER DOWN THE PAGE) ================= */}
      <div
        className={`fixed bottom-6 right-5 sm:right-7 z-40 flex items-center gap-2 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-gray-200/90 transition-all duration-300 ${
          scrolledDown ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition cursor-pointer shadow-2xs"
          title="Back to Feed (Esc)"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="h-4 w-px bg-gray-200" />

        <button
          onClick={scrollToComments}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-blue-50 text-gray-700 hover:text-blue-600 text-xs font-bold transition cursor-pointer"
          title={`Jump to ${totalCommentsCount} Comments`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
          <span>{totalCommentsCount}</span>
        </button>

        <div className="h-4 w-px bg-gray-200" />

        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition cursor-pointer"
          title="Scroll to Top"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          <span>Top ({readingProgress}%)</span>
        </button>
      </div>

    </article>
  );
};

interface CommentCardProps {
  comment: HivePost;
  onSelectAuthor: (author: string) => void;
  currentUser: CurrentUser | null;
}

const CommentCard: React.FC<CommentCardProps> = ({ comment, onSelectAuthor, currentUser }) => {
  const [upvoted, setUpvoted] = useState(false);
  const rep = calculateReputation(comment.author_reputation);
  const avatar = getHiveAvatarUrl(comment.author, 'small');
  const safeCommentHtml = markdownToSafeHtml(comment.body);

  const handleVote = async () => {
    if (!currentUser) return;
    try {
      await KeychainService.vote(currentUser.username, comment.author, comment.permlink, 10000);
      setUpvoted(true);
    } catch { }
  };

  return (
    <div className="p-4 rounded-2xl bg-gray-50/70 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <img
            src={avatar}
            alt={comment.author}
            className="w-6 h-6 rounded-full object-cover bg-gray-200"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
            }}
          />
          <button
            onClick={() => onSelectAuthor(comment.author)}
            className="font-bold text-gray-900 hover:text-blue-600 transition"
          >
            @{comment.author}
          </button>
          <span className="text-[10px] text-gray-400 font-medium">({rep})</span>
        </div>

        <span className="text-[11px] text-gray-400">
          {new Date(comment.created + 'Z').toLocaleDateString()}
        </span>
      </div>

      <div
        className="text-xs sm:text-sm text-gray-800 leading-relaxed pl-8 break-words prose prose-slate max-w-none"
        dangerouslySetInnerHTML={{ __html: safeCommentHtml }}
      />

      <div className="flex items-center gap-4 text-[11px] text-gray-500 pl-8 pt-1">
        {comment.payout !== undefined && comment.payout > 0 && (
          <span className="text-gray-900 font-semibold">${comment.payout.toFixed(2)}</span>
        )}
        <button
          onClick={handleVote}
          className={`flex items-center gap-1 transition ${upvoted ? 'text-rose-600 font-bold' : 'hover:text-rose-600'}`}
        >
          <Heart className={`w-3.5 h-3.5 ${upvoted ? 'fill-rose-600' : ''}`} />
          <span>{(comment.stats?.total_votes || comment.active_votes?.length || 0) + (upvoted ? 1 : 0)}</span>
        </button>
        {comment.children > 0 && (
          <span className="flex items-center gap-1 text-blue-500">
            <MessageSquare className="w-3.5 h-3.5" />
            {comment.children} replies
          </span>
        )}
      </div>
    </div>
  );
};

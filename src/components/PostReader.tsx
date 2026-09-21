import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  X,
  Heart,
  MessageSquare,
  Clock,
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
  AlertCircle
} from 'lucide-react';
import {
  HivePost,
  getDiscussion,
  calculateReputation,
  getHiveAvatarUrl
} from '../services/hiveApi';
import { KeychainService, CurrentUser } from '../services/keychain';
import { markdownToSafeHtml } from '../utils/sanitize';

interface PostReaderProps {
  post: HivePost;
  onClose: () => void;
  onSelectAuthor: (author: string) => void;
  onSelectTag: (tag: string) => void;
  currentUser: CurrentUser | null;
  onRequireLogin?: () => void;
}

export const PostReader: React.FC<PostReaderProps> = ({
  post,
  onClose,
  onSelectAuthor,
  onSelectTag,
  currentUser,
  onRequireLogin
}) => {
  const [discussion, setDiscussion] = useState<Record<string, HivePost>>({});
  const [loadingDiscussion, setLoadingDiscussion] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showVoters, setShowVoters] = useState(false);

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

    // Check if current user already voted
    if (currentUser?.username && post.active_votes) {
      const alreadyVoted = post.active_votes.some(v => v.voter.toLowerCase() === currentUser.username.toLowerCase());
      if (alreadyVoted) setHasVoted(true);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    // Ensure page is scrolled to top on open
    window.scrollTo(0, 0);

    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [post.author, post.permlink, onClose, currentUser?.username]);

  const rep = calculateReputation(post.author_reputation);
  const avatarUrl = getHiveAvatarUrl(post.author, 'medium');

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
  const safeHtmlContent = markdownToSafeHtml(post.body);
  const totalVotesCount = (post.stats?.total_votes || post.active_votes?.length || 0) + (hasVoted ? 1 : 0);
  const payoutString = post.payout ? `$${post.payout.toFixed(3)}` : (post.pending_payout_value || '$0.000');

  return (
    <article
      id="in-place-post-reader"
      className="bg-white rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col w-full animate-in fade-in duration-200"
    >

      {/* ================= TOP RETURN & BREADCRUMB BAR ================= */}
      <div className="flex items-center justify-between px-6 sm:px-8 py-3.5 bg-white/95 backdrop-blur-md sticky top-16 z-20">

        {/* Back Button */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            id="back-to-feed-btn"
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-xs transition shadow-xs"
            title="Back to Feed (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Feed</span>
          </button>

          <div className="hidden md:flex items-center gap-2 text-xs text-gray-400 truncate">
            <span>/</span>
            {post.category && (
              <button
                onClick={() => {
                  onSelectTag(post.category);
                  onClose();
                }}
                className="font-medium text-gray-500 hover:text-blue-600 truncate"
              >
                #{post.category}
              </button>
            )}
            {post.community_title && (
              <>
                <span>/</span>
                <span className="truncate text-gray-400">{post.community_title}</span>
              </>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleCopyLink}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition"
            title="Copy Hive link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
          </button>

          <a
            href={`https://ecency.com/@${post.author}/${post.permlink}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition"
            title="View on Ecency.com"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* ================= POST CONTENT AREA ================= */}
      <div className="px-6 sm:px-12 py-6 space-y-6 max-w-4xl mx-auto w-full">

        {/* Compact Metadata Row (Avatar, @author, date, community/tag in one row) */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectAuthor(post.author)}
            className="focus:outline-none flex-shrink-0"
          >
            <img
              src={avatarUrl}
              alt={post.author}
              className="w-10 h-10 rounded-full object-cover shadow-xs"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/medium';
              }}
            />
          </button>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
            <button
              onClick={() => onSelectAuthor(post.author)}
              className="font-bold text-gray-900 hover:text-blue-600 transition text-sm"
            >
              @{post.author}
            </button>
            <span className="text-[11px] text-gray-400 font-medium">({rep})</span>
            <span className="text-gray-300">•</span>
            <span className="flex items-center gap-1 text-gray-400">
              <Clock className="w-3 h-3" />
              <span>{new Date(post.created + 'Z').toLocaleDateString()}</span>
            </span>

            {(post.community_title || post.category) && (
              <>
                <span className="text-gray-300">•</span>
                <span className="text-gray-400">in</span>
                <button
                  onClick={() => {
                    if (post.community) onSelectTag(post.community);
                    else onSelectTag(post.category);
                    onClose();
                  }}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  {post.community_title || `#${post.category}`}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Big, Clear Post Title (Completely visible, never hidden) */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight pt-1">
          {post.title}
        </h1>

        {/* Main Article Body (DOMPurify protected) */}
        <div
          id="sanitized-post-body"
          className="article-body prose prose-slate max-w-none text-gray-800 leading-relaxed break-words pt-2"
          dangerouslySetInnerHTML={{ __html: safeHtmlContent }}
        />

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

            {/* Comments Counter */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-2 rounded-full">
              <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
              <span>{post.children || 0}</span>
            </div>

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
        <section className="pt-8 border-t border-gray-150 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <span>Discussion ({post.children || 0})</span>
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

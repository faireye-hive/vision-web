import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Heart,
  MessageCircle,
  Share2,
  ExternalLink,
  Send,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  Maximize2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { HivePost, calculateReputation, getHiveAvatarUrl, getDiscussion } from '../services/hiveApi';
import { CurrentUser, KeychainService } from '../services/keychain';
import { markdownToSafeHtml } from '../utils/sanitize';
import {
  extractSnapImages,
  cleanSnapBody,
  buildCommentTree,
  ThreadCommentNode
} from '../services/shortsApi';
import { SafeSnapImage } from './SafeSnapImage';

interface ShortDetailModalProps {
  snap: HivePost;
  initialDiscussionMap: Record<string, HivePost>;
  currentUser: CurrentUser | null;
  onClose: () => void;
  onSelectAuthor: (author: string) => void;
  onSelectTag?: (tag: string) => void;
  onRequireLogin?: () => void;
}

export const ShortDetailModal: React.FC<ShortDetailModalProps> = ({
  snap,
  initialDiscussionMap,
  currentUser,
  onClose,
  onSelectAuthor,
  onSelectTag,
  onRequireLogin
}) => {
  const [discussionMap, setDiscussionMap] = useState<Record<string, HivePost>>(initialDiscussionMap);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Upvote state for main snap
  const [upvoted, setUpvoted] = useState(false);
  const [voteCountDelta, setVoteCountDelta] = useState(0);
  const [voteLoading, setVoteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Main reply composer state
  const [mainReplyText, setMainReplyText] = useState('');
  const [mainReplying, setMainReplying] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch full discussion specifically for this snap to ensure all nested comments are present
  const fetchFreshDiscussion = useCallback(async (forceRefresh = false) => {
    setIsRefreshing(true);
    try {
      // First try to get discussion of the parent container or direct snap
      const directDiscussion = await getDiscussion(snap.author, snap.permlink, forceRefresh);
      if (directDiscussion && Object.keys(directDiscussion).length > 0) {
        setDiscussionMap((prev) => ({ ...prev, ...directDiscussion }));
      }
    } catch (err) {
      console.warn('Could not fetch fresh direct discussion for snap:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [snap.author, snap.permlink]);

  useEffect(() => {
    fetchFreshDiscussion(false);
  }, [fetchFreshDiscussion]);

  // Format relative time
  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    try {
      const date = new Date(timeStr.endsWith('Z') ? timeStr : timeStr + 'Z');
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSec < 60) return 'just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  // Memoized body parsing for the main snap
  const images = useMemo(() => extractSnapImages(snap.body, snap.json_metadata), [snap.body, snap.json_metadata]);
  const cleanedBody = useMemo(() => cleanSnapBody(snap.body), [snap.body]);
  const safeHtml = useMemo(() => markdownToSafeHtml(cleanedBody || snap.body), [cleanedBody, snap.body]);

  // Extract hashtags from snap body
  const hashtags = useMemo(() => {
    const list: string[] = [];
    const hashRegex = /(?:^|\s)#([a-zA-Z0-9_\u0080-\uFFFF]+)/g;
    let m;
    while ((m = hashRegex.exec(snap.body || '')) !== null) {
      const t = m[1].toLowerCase();
      if (t.length >= 2 && !list.includes(t) && !/^\d+$/.test(t)) {
        list.push(t);
      }
    }
    return list;
  }, [snap.body]);

  // Build recursive comment tree for this snap
  const commentTree = useMemo(() => {
    return buildCommentTree(snap.author, snap.permlink, discussionMap);
  }, [snap.author, snap.permlink, discussionMap]);

  // Count total comments in the tree (direct and nested)
  const totalCommentsCount = useMemo(() => {
    const countNodes = (nodes: ThreadCommentNode[]): number => {
      let count = nodes.length;
      for (const node of nodes) {
        if (node.replies.length > 0) {
          count += countNodes(node.replies);
        }
      }
      return count;
    };
    return countNodes(commentTree);
  }, [commentTree]);

  // Upvote handler for main snap
  const handleVote = async () => {
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      return;
    }
    if (upvoted || voteLoading) return;

    setVoteLoading(true);
    try {
      await KeychainService.vote(currentUser.username, snap.author, snap.permlink, 10000);
      setUpvoted(true);
      setVoteCountDelta((prev) => prev + 1);
    } catch (err: any) {
      console.error('Vote failed:', err);
      alert(err.message || 'Failed to vote on snap');
    } finally {
      setVoteLoading(false);
    }
  };

  // Copy link
  const handleCopyLink = () => {
    const url = `https://peakd.com/@${snap.author}/${snap.permlink}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Submit main reply to this snap
  const handleSubmitMainReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainReplyText.trim() || mainReplying) return;

    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      return;
    }

    setMainReplying(true);
    setReplyError(null);

    const replyPermlink = `re-${snap.author.replace(/\./g, '')}-${Date.now().toString(36)}`;
    try {
      await KeychainService.postComment(
        currentUser.username,
        snap.author,
        snap.permlink,
        mainReplyText.trim()
      );

      // Optimistic post insertion into discussionMap
      const newPost: HivePost = {
        post_id: Date.now(),
        author: currentUser.username,
        permlink: replyPermlink,
        category: snap.category || 'shorts',
        parent_author: snap.author,
        parent_permlink: snap.permlink,
        title: '',
        body: mainReplyText.trim(),
        json_metadata: { app: 'nebulosa/1.0' },
        created: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
        depth: (snap.depth || 0) + 1,
        children: 0,
        net_rshares: 0,
        payout: 0,
        pending_payout_value: '0.000 HBD',
        is_paidout: false,
        author_reputation: 25,
        replies: []
      };

      const newKey = `${currentUser.username}/${replyPermlink}`;
      setDiscussionMap((prev) => ({
        ...prev,
        [newKey]: newPost
      }));

      setMainReplyText('');
    } catch (err: any) {
      console.error('Failed to post reply:', err);
      setReplyError(err.message || 'Failed to broadcast reply with Keychain');
    } finally {
      setMainReplying(false);
    }
  };

  // Callback to insert an optimistic child reply when a subcomment is replied to
  const handleAddChildReply = (parentAuthor: string, parentPermlink: string, newReply: HivePost) => {
    const newKey = `${newReply.author}/${newReply.permlink}`;
    setDiscussionMap((prev) => {
      const parentKey = `${parentAuthor}/${parentPermlink}`;
      const parentPost = prev[parentKey];
      const updatedParent = parentPost
        ? {
            ...parentPost,
            children: (parentPost.children || 0) + 1,
            replies: [...(parentPost.replies || []), newKey]
          }
        : undefined;

      return {
        ...prev,
        [newKey]: newReply,
        ...(updatedParent ? { [parentKey]: updatedParent } : {})
      };
    });
  };

  const rep = calculateReputation(snap.author_reputation);
  const avatarUrl = getHiveAvatarUrl(snap.author, 'small');
  const timeAgo = formatTime(snap.created);
  const snapVotes = (snap as any).net_votes ?? (snap.active_votes ? snap.active_votes.length : snap.stats?.total_votes ?? 0);
  const netVotes = snapVotes + voteCountDelta;
  const payout = Number(snap.payout) || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">Short Thread</h2>
            <span className="text-xs text-gray-400 dark:text-slate-500 font-medium ml-1">
              ({totalCommentsCount} {totalCommentsCount === 1 ? 'comment' : 'comments'})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchFreshDiscussion(true)}
              disabled={isRefreshing}
              className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title="Refresh discussion"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <a
              href={`https://peakd.com/@${snap.author}/${snap.permlink}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title="Open Snap on PeakD"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer ml-1"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5 divide-y divide-gray-100 dark:divide-slate-800 custom-scrollbar">
          {/* Main Snap Section */}
          <div className="space-y-4">
            {/* Author Profile Row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectAuthor(snap.author)}
                  className="relative group flex-shrink-0 cursor-pointer"
                >
                  <img
                    src={avatarUrl}
                    alt={snap.author}
                    className="w-11 h-11 rounded-full object-cover ring-2 ring-gray-100 dark:ring-slate-800 group-hover:ring-blue-400 transition"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive-125125/avatar/small';
                    }}
                  />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onSelectAuthor(snap.author)}
                      className="font-bold text-sm text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition truncate cursor-pointer"
                    >
                      @{snap.author}
                    </button>
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                      {rep}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{timeAgo}</p>
                </div>
              </div>
            </div>

            {/* Snap Text Content */}
            <div
              className="text-base text-gray-900 dark:text-slate-100 leading-relaxed break-words prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-a:text-blue-600 dark:prose-a:text-blue-400 hover:prose-a:underline select-text"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />

            {/* Hashtag Pills */}
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {hashtags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      if (onSelectTag) onSelectTag(t);
                      onClose();
                    }}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50/80 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-2.5 py-1 rounded-xl transition cursor-pointer"
                  >
                    #{t}
                  </button>
                ))}
              </div>
            )}

            {/* Attached Images */}
            {images.length > 0 && (
              <div className="space-y-2 pt-1">
                {images.map((img, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedImage(img)}
                    className="relative rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 cursor-pointer group max-h-96"
                  >
                    <SafeSnapImage
                      src={img}
                      alt="Snap attachment"
                      className="w-full h-auto max-h-96"
                      imgClassName="w-full h-auto max-h-96 object-contain mx-auto transition-transform duration-300 group-hover:scale-[1.01]"
                    />
                    <div className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition pointer-events-none">
                      <Maximize2 className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Stats & Actions Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleVote}
                  disabled={voteLoading || upvoted}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition cursor-pointer ${
                    upvoted
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400'
                  }`}
                  title={currentUser ? (upvoted ? 'Upvoted' : 'Upvote with Keychain') : 'Log in to vote'}
                >
                  <Heart className={`w-4 h-4 ${upvoted ? 'fill-rose-500 text-rose-500' : ''}`} />
                  <span>{upvoted ? 'Upvoted' : 'Upvote'}</span>
                </button>

                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 font-medium">
                  <MessageCircle className="w-4 h-4 text-blue-500" />
                  <span>{totalCommentsCount} comments</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Copy snap link"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
              </button>
            </div>
          </div>

          {/* Primary Reply Box */}
          <div className="pt-4 space-y-3">
            <h3 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Leave a comment</h3>
            <form onSubmit={handleSubmitMainReply} className="space-y-2">
              <div className="flex gap-2.5 items-start">
                <img
                  src={getHiveAvatarUrl(currentUser?.username || 'hive-125125', 'small')}
                  alt={currentUser?.username || 'guest'}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5 bg-gray-100 dark:bg-slate-800"
                />
                <div className="flex-1">
                  <textarea
                    value={mainReplyText}
                    onChange={(e) => setMainReplyText(e.target.value)}
                    placeholder={
                      currentUser
                        ? `Reply to @${snap.author}...`
                        : 'Log in with Hive Keychain above to reply...'
                    }
                    disabled={!currentUser || mainReplying}
                    rows={2}
                    className="w-full text-xs text-gray-800 dark:text-slate-100 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-2xl p-3 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition placeholder-gray-400 dark:placeholder-slate-500"
                  />
                  {replyError && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {replyError}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!currentUser || !mainReplyText.trim() || mainReplying}
                  className="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{mainReplying ? 'Posting...' : 'Comment'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Recursive Comments Stream */}
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                Comments ({totalCommentsCount})
              </h3>
              {commentTree.length === 0 && (
                <span className="text-xs text-gray-400 dark:text-slate-500">Be the first to reply!</span>
              )}
            </div>

            {commentTree.length > 0 ? (
              <div className="space-y-4">
                {commentTree.map((node) => (
                  <ThreadCommentItem
                    key={`${node.comment.author}-${node.comment.permlink}`}
                    node={node}
                    depth={0}
                    currentUser={currentUser}
                    onSelectAuthor={onSelectAuthor}
                    onRequireLogin={onRequireLogin}
                    onAddChildReply={handleAddChildReply}
                  />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-400 dark:text-slate-500 space-y-1 bg-gray-50/60 dark:bg-slate-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                <MessageCircle className="w-8 h-8 mx-auto text-gray-300 dark:text-slate-600" />
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400">No comments on this short yet</p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500">Share your thoughts above</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Lightbox View */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={selectedImage}
            alt="Expanded view"
            className="max-w-full max-h-[90vh] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

interface ThreadCommentItemProps {
  node: ThreadCommentNode;
  depth: number;
  currentUser: CurrentUser | null;
  onSelectAuthor: (author: string) => void;
  onRequireLogin?: () => void;
  onAddChildReply: (parentAuthor: string, parentPermlink: string, newReply: HivePost) => void;
}

/**
 * Recursive Comment Item component
 * Handles rendering of a comment and any nested replies ("comentário do comentário")
 */
const ThreadCommentItem: React.FC<ThreadCommentItemProps> = ({
  node,
  depth,
  currentUser,
  onSelectAuthor,
  onRequireLogin,
  onAddChildReply
}) => {
  const { comment, replies } = node;
  const [collapsed, setCollapsed] = useState(false);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Voting state
  const [upvoted, setUpvoted] = useState(false);
  const [voteCountDelta, setVoteCountDelta] = useState(0);
  const [voteLoading, setVoteLoading] = useState(false);

  const rep = calculateReputation(comment.author_reputation);
  const avatarUrl = getHiveAvatarUrl(comment.author, 'small');

  // Relative time
  const timeAgo = useMemo(() => {
    if (!comment.created) return '';
    try {
      const date = new Date(comment.created.endsWith('Z') ? comment.created : comment.created + 'Z');
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffSec < 60) return 'just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
      return `${Math.floor(diffSec / 86400)}d`;
    } catch {
      return '';
    }
  }, [comment.created]);

  // Clean body and sanitize HTML
  const cleanedBody = useMemo(() => cleanSnapBody(comment.body), [comment.body]);
  const safeHtml = useMemo(() => markdownToSafeHtml(cleanedBody || comment.body), [cleanedBody, comment.body]);
  const images = useMemo(() => extractSnapImages(comment.body, comment.json_metadata), [comment.body, comment.json_metadata]);

  const handleVote = async () => {
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      return;
    }
    if (upvoted || voteLoading) return;

    setVoteLoading(true);
    try {
      await KeychainService.vote(currentUser.username, comment.author, comment.permlink, 10000);
      setUpvoted(true);
      setVoteCountDelta((prev) => prev + 1);
    } catch (err: any) {
      console.error('Vote failed on comment:', err);
    } finally {
      setVoteLoading(false);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || submittingReply) return;

    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      return;
    }

    setSubmittingReply(true);
    setReplyError(null);

    const newPermlink = `re-${comment.author.replace(/\./g, '')}-${Date.now().toString(36)}`;
    try {
      await KeychainService.postComment(
        currentUser.username,
        comment.author,
        comment.permlink,
        replyText.trim()
      );

      const createdPost: HivePost = {
        post_id: Date.now(),
        author: currentUser.username,
        permlink: newPermlink,
        category: comment.category || 'shorts',
        parent_author: comment.author,
        parent_permlink: comment.permlink,
        title: '',
        body: replyText.trim(),
        json_metadata: { app: 'nebulosa/1.0' },
        created: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
        depth: (comment.depth || 0) + 1,
        children: 0,
        net_rshares: 0,
        payout: 0,
        pending_payout_value: '0.000 HBD',
        is_paidout: false,
        author_reputation: 25,
        replies: []
      };

      onAddChildReply(comment.author, comment.permlink, createdPost);
      setReplyText('');
      setShowReplyBox(false);
    } catch (err: any) {
      console.error('Subcomment reply error:', err);
      setReplyError(err.message || 'Failed to submit reply with Keychain');
    } finally {
      setSubmittingReply(false);
    }
  };

  const commentVotes = (comment as any).net_votes ?? (comment.active_votes ? comment.active_votes.length : comment.stats?.total_votes ?? 0);
  const netVotes = commentVotes + voteCountDelta;
  const hasReplies = replies && replies.length > 0;

  return (
    <div className={`group/item ${depth > 0 ? 'mt-2.5' : ''}`}>
      <div className="flex gap-2.5 items-start">
        {/* Author Avatar */}
        <button
          type="button"
          onClick={() => onSelectAuthor(comment.author)}
          className="flex-shrink-0 cursor-pointer"
        >
          <img
            src={avatarUrl}
            alt={comment.author}
            className="w-7 h-7 rounded-full object-cover ring-1 ring-gray-100 dark:ring-slate-800 hover:ring-blue-400 transition bg-gray-100 dark:bg-slate-800"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive-125125/avatar/small';
            }}
          />
        </button>

        <div className="flex-1 min-w-0 bg-gray-50/80 dark:bg-slate-800/60 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-2xl p-3 border border-gray-100 dark:border-slate-700/80 transition space-y-1.5">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <button
                type="button"
                onClick={() => onSelectAuthor(comment.author)}
                className="font-bold text-xs text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition truncate cursor-pointer"
              >
                @{comment.author}
              </button>
              <span className="text-[10px] text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-1.5 py-0.2 rounded-md font-semibold border border-gray-100 dark:border-slate-700">
                {rep}
              </span>
              <span className="text-[11px] text-gray-400 dark:text-slate-500">· {timeAgo}</span>
            </div>

            {hasReplies && (
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="text-[11px] text-gray-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-0.5 cursor-pointer font-medium"
              >
                {collapsed ? (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Show {replies.length}</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Hide</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Comment Body */}
          {!collapsed && (
            <>
              <div
                className="text-xs text-gray-800 dark:text-slate-200 leading-relaxed break-words prose prose-sm dark:prose-invert max-w-none prose-p:my-0.5 prose-a:text-blue-600 dark:prose-a:text-blue-400 select-text"
                dangerouslySetInnerHTML={{ __html: safeHtml }}
              />

              {/* Comment Images */}
              {images.length > 0 && (
                <div className="flex gap-2 flex-wrap pt-1">
                  {images.map((img, i) => (
                    <SafeSnapImage
                      key={i}
                      src={img}
                      alt="attachment"
                      className="h-20 w-24 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden"
                      imgClassName="h-20 w-24 object-cover"
                    />
                  ))}
                </div>
              )}

              {/* Actions: Vote, Reply */}
              <div className="flex items-center gap-3 pt-1 text-[11px]">
                <button
                  type="button"
                  onClick={handleVote}
                  disabled={voteLoading || upvoted}
                  className={`flex items-center gap-1 font-semibold transition cursor-pointer ${
                    upvoted ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${upvoted ? 'fill-rose-500 text-rose-500' : ''}`} />
                  <span>{netVotes}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowReplyBox(!showReplyBox)}
                  className="flex items-center gap-1 text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition cursor-pointer"
                >
                  <CornerDownRight className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </button>
              </div>

              {/* Inline Reply Form to this specific comment */}
              {showReplyBox && (
                <form onSubmit={handleReplySubmit} className="pt-2 space-y-1.5 animate-in fade-in duration-150">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={`Reply to @${comment.author}...`}
                      disabled={!currentUser || submittingReply}
                      className="flex-1 text-xs bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 border border-gray-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!currentUser || !replyText.trim() || submittingReply}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl disabled:opacity-40 transition cursor-pointer flex-shrink-0"
                    >
                      {submittingReply ? '...' : 'Send'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReplyBox(false)}
                      className="px-2 py-1 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 text-xs font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  {replyError && (
                    <p className="text-[10px] text-rose-600 dark:text-rose-400">{replyError}</p>
                  )}
                </form>
              )}
            </>
          )}
        </div>
      </div>

      {/* Recursive Subcomments ("comentário do comentário") */}
      {!collapsed && hasReplies && (
        <div className="border-l-2 border-gray-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-700 transition-colors ml-3.5 pl-3 sm:pl-4 space-y-2.5 mt-2">
          {replies.map((childNode) => (
            <ThreadCommentItem
              key={`${childNode.comment.author}-${childNode.comment.permlink}`}
              node={childNode}
              depth={depth + 1}
              currentUser={currentUser}
              onSelectAuthor={onSelectAuthor}
              onRequireLogin={onRequireLogin}
              onAddChildReply={onAddChildReply}
            />
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Share2,
  ExternalLink,
  Send,
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
import { markdownToSafeHtml, getSafeImageUrl } from '../utils/sanitize';
import {
  extractSnapImages,
  cleanSnapBody,
  buildCommentTree,
  ThreadCommentNode
} from '../services/shortsApi';
import { SafeSnapImage } from './SafeSnapImage';

interface ShortDetailViewProps {
  snap: HivePost;
  initialDiscussionMap?: Record<string, HivePost>;
  currentUser: CurrentUser | null;
  onBack: () => void;
  onSelectAuthor: (author: string) => void;
  onSelectTag?: (tag: string) => void;
  onRequireLogin?: () => void;
}

export const ShortDetailView: React.FC<ShortDetailViewProps> = ({
  snap,
  initialDiscussionMap = {},
  currentUser,
  onBack,
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

  // Fetch full discussion specifically for this snap
  const fetchFreshDiscussion = useCallback(async (forceRefresh = false) => {
    setIsRefreshing(true);
    try {
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
    // Only auto-fetch if we don't have this post in the map yet or if it's been a while
    const key = `${snap.author}/${snap.permlink}`;
    if (!discussionMap[key] || snap.children > 0) {
       fetchFreshDiscussion(false);
    }
  }, [fetchFreshDiscussion, snap.author, snap.permlink, snap.children]);

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

  const raw_images = useMemo(() => extractSnapImages(snap.body, snap.json_metadata), [snap.body, snap.json_metadata]);
  
  const images = useMemo(() => {
    return raw_images
      .map(url => getSafeImageUrl(url, { width: 1200 }))
      .filter((url): url is string => url !== null);
  }, [raw_images]);
  const cleanedBody = useMemo(() => cleanSnapBody(snap.body), [snap.body]);
  const safeHtml = useMemo(() => markdownToSafeHtml(cleanedBody || snap.body), [cleanedBody, snap.body]);

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

  const commentTree = useMemo(() => {
    return buildCommentTree(snap.author, snap.permlink, discussionMap);
  }, [snap.author, snap.permlink, discussionMap]);

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
    } finally {
      setVoteLoading(false);
    }
  };

  const handleCopyLink = () => {
    const url = `https://peakd.com/@${snap.author}/${snap.permlink}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  return (
    <div className="w-full max-w-[760px] mx-auto animate-in fade-in slide-in-from-right-4 duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200/70 dark:border-slate-800 shadow-[0_8px_30px_rgba(15,23,42,0.04)] flex flex-col">
        {/* Header Bar - Sticky to follow scroll */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 sticky top-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-40 rounded-t-[32px]">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 -ml-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-all cursor-pointer group"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5 group-active:-translate-x-1 transition-transform" />
            </button>
            <div>
              <h2 className="text-[17px] font-bold text-slate-900 dark:text-white tracking-tight">Snap Thread</h2>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {totalCommentsCount} {totalCommentsCount === 1 ? 'interação' : 'interações'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchFreshDiscussion(true)}
              disabled={isRefreshing}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <a
              href={`https://peakd.com/@${snap.author}/${snap.permlink}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-6">
          {/* Main Snap Card */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onSelectAuthor(snap.author)}
                className="relative group flex-shrink-0 cursor-pointer"
              >
                <img
                  src={avatarUrl}
                  alt={snap.author}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800 group-hover:ring-blue-400 transition"
                />
              </button>
              <div className="min-w-0">
                <button
                  onClick={() => onSelectAuthor(snap.author)}
                  className="font-bold text-[16px] text-slate-900 dark:text-white hover:text-blue-600 transition truncate cursor-pointer"
                >
                  @{snap.author}
                </button>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                  <span className="font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">{rep}</span>
                  <span>&bull;</span>
                  <span>{timeAgo}</span>
                </div>
              </div>
            </div>

            <div
              className="text-[17px] text-slate-800 dark:text-slate-100 leading-relaxed break-words prose prose-slate dark:prose-invert max-w-none prose-p:my-2 prose-a:text-blue-600 dark:prose-a:text-blue-400 select-text"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />

            {images.length > 0 && (
              <div className="space-y-3">
                {images.map((img, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedImage(img)}
                    className="relative rounded-[24px] overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 cursor-zoom-in group"
                  >
                    <SafeSnapImage
                      src={img}
                      alt="Snap attachment"
                      className="w-full h-auto max-h-[600px]"
                      imgClassName="w-full h-auto object-contain mx-auto group-hover:scale-[1.01] transition-transform duration-500"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-6">
                <button
                  onClick={handleVote}
                  disabled={voteLoading || upvoted}
                  className={`flex items-center gap-2 text-[13px] font-bold px-4 py-2 rounded-full transition-all cursor-pointer ${
                    upvoted
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-900/40 hover:text-rose-600'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${upvoted ? 'fill-current animate-bounce' : ''}`} />
                  <span>{upvoted ? 'Votado' : 'Votar'}</span>
                </button>
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 font-medium">
                  <MessageCircle className="w-5 h-5 text-blue-500" />
                  <span className="text-[13px]">{totalCommentsCount}</span>
                </div>
              </div>
              <button
                onClick={handleCopyLink}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition cursor-pointer"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Share2 className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Comment Box */}
          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-[28px] p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Comentar</h3>
            <form onSubmit={handleSubmitMainReply} className="space-y-3">
              <div className="flex gap-3">
                <img
                  src={getHiveAvatarUrl(currentUser?.username || 'hive', 'small')}
                  className="w-9 h-9 rounded-full object-cover mt-1"
                />
                <textarea
                  value={mainReplyText}
                  onChange={(e) => setMainReplyText(e.target.value)}
                  placeholder={currentUser ? "O que você acha?" : "Faça login para comentar"}
                  disabled={!currentUser || mainReplying}
                  rows={2}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-[15px] focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all resize-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!currentUser || !mainReplyText.trim() || mainReplying}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-2 rounded-full text-sm flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {mainReplying ? 'Enviando...' : 'Postar'}
                </button>
              </div>
            </form>
          </div>

          {/* Thread List */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[15px] font-bold text-slate-800 dark:text-slate-100">Discussão</h3>
            </div>

            {commentTree.length > 0 ? (
              <div className="space-y-6">
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
              <div className="py-12 text-center bg-slate-50/50 dark:bg-slate-900/50 rounded-[32px] border-2 border-dashed border-slate-100 dark:border-slate-800">
                <MessageCircle className="w-10 h-10 mx-auto text-slate-200 dark:text-slate-800 mb-3" />
                <p className="text-slate-400 font-medium">Ainda não há comentários.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};

// ... (Rest of ThreadCommentItem - identical logic but styled for the view)
interface ThreadCommentItemProps {
  node: ThreadCommentNode;
  depth: number;
  currentUser: CurrentUser | null;
  onSelectAuthor: (author: string) => void;
  onRequireLogin?: () => void;
  onAddChildReply: (parentAuthor: string, parentPermlink: string, newReply: HivePost) => void;
}

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
  
  const [upvoted, setUpvoted] = useState(false);
  const [voteCountDelta, setVoteCountDelta] = useState(0);
  const [voteLoading, setVoteLoading] = useState(false);

  const rep = calculateReputation(comment.author_reputation);
  const avatarUrl = getHiveAvatarUrl(comment.author, 'small');

  const timeAgo = useMemo(() => {
    if (!comment.created) return '';
    try {
      const date = new Date(comment.created.endsWith('Z') ? comment.created : comment.created + 'Z');
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffSec < 60) return 'agora';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
      return `${Math.floor(diffSec / 86400)}d`;
    } catch { return ''; }
  }, [comment.created]);

  const cleanedBody = useMemo(() => cleanSnapBody(comment.body), [comment.body]);
  const safeHtml = useMemo(() => markdownToSafeHtml(cleanedBody || comment.body), [cleanedBody, comment.body]);

  const handleVote = async () => {
    if (!currentUser) { onRequireLogin?.(); return; }
    if (upvoted || voteLoading) return;
    setVoteLoading(true);
    try {
      await KeychainService.vote(currentUser.username, comment.author, comment.permlink, 10000);
      setUpvoted(true);
      setVoteCountDelta(1);
    } catch { } finally { setVoteLoading(false); }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || submittingReply || !currentUser) return;
    setSubmittingReply(true);
    const newPermlink = `re-${comment.author.replace(/\./g, '')}-${Date.now().toString(36)}`;
    try {
      await KeychainService.postComment(currentUser.username, comment.author, comment.permlink, replyText.trim());
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
        created: new Date().toISOString(),
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
    } catch { } finally { setSubmittingReply(false); }
  };

  const netVotes = (comment.active_votes?.length || 0) + voteCountDelta;

  return (
    <div className={`flex gap-3 ${depth > 0 ? 'mt-4' : ''}`}>
      <button onClick={() => onSelectAuthor(comment.author)} className="flex-shrink-0 cursor-pointer h-fit">
        <img src={avatarUrl} className="w-10 h-10 rounded-full object-cover" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-[22px] p-4 border border-slate-100 dark:border-slate-700/50">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-[14px] text-slate-900 dark:text-white">@{comment.author}</span>
              <span className="text-[10px] text-slate-400 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded-full border border-slate-100 dark:border-slate-800">{rep}</span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-[11px] text-slate-400">{timeAgo}</span>
            </div>
            {replies.length > 0 && (
              <button onClick={() => setCollapsed(!collapsed)} className="text-slate-400 hover:text-blue-500 transition cursor-pointer">
                {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            )}
          </div>
          
          {!collapsed && (
            <>
              <div className="text-[14px] text-slate-700 dark:text-slate-200 leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-1" dangerouslySetInnerHTML={{ __html: safeHtml }} />
              <div className="flex items-center gap-5 mt-3">
                <button onClick={handleVote} className={`flex items-center gap-1.5 text-xs font-bold transition ${upvoted ? 'text-rose-600' : 'text-slate-400 hover:text-rose-600'}`}>
                  <Heart className={`w-4 h-4 ${upvoted ? 'fill-current' : ''}`} />
                  <span>{netVotes}</span>
                </button>
                <button onClick={() => setShowReplyBox(!showReplyBox)} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-blue-600 transition">
                  <CornerDownRight className="w-4 h-4" />
                  <span>Responder</span>
                </button>
              </div>
              
              {showReplyBox && (
                <form onSubmit={handleReplySubmit} className="mt-3 flex gap-2">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Sua resposta..."
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    autoFocus
                  />
                  <button type="submit" disabled={!replyText.trim() || submittingReply} className="bg-blue-600 text-white px-3 py-1.5 rounded-xl font-bold text-xs">Enviar</button>
                </form>
              )}
            </>
          )}
        </div>
        
        {!collapsed && replies.length > 0 && (
          <div className="border-l-2 border-slate-100 dark:border-slate-800 ml-5 pl-2">
            {replies.map(child => (
              <ThreadCommentItem key={`${child.comment.author}-${child.comment.permlink}`} node={child} depth={depth + 1} currentUser={currentUser} onSelectAuthor={onSelectAuthor} onRequireLogin={onRequireLogin} onAddChildReply={onAddChildReply} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

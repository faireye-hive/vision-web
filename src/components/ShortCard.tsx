import React, { useState, useMemo } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Send,
  Sparkles,
  Check,
  CornerDownRight,
  X
} from 'lucide-react';
import { HivePost, calculateReputation, getHiveAvatarUrl } from '../services/hiveApi';
import { CurrentUser, KeychainService } from '../services/keychain';
import { markdownToSafeHtml } from '../utils/sanitize';
import {
  cleanSnapBody,
  getSnapSubcomments
} from '../services/shortsApi';
import { SnapContent } from './SnapContent';
import { VoteWeightDialog } from './VoteWeightDialog';

interface ShortCardProps {
  snap: HivePost;
  discussionMap: Record<string, HivePost>;
  currentUser: CurrentUser | null;
  onSelectAuthor: (author: string) => void;
  onSelectTag?: (tag: string) => void;
  onOpenDetail?: (snap: HivePost) => void;
  onRequireLogin?: () => void;
  id?: string;
}

const formatRelativeTime = (timeStr?: string) => {
  if (!timeStr) return '';
  try {
    const date = new Date(timeStr.endsWith('Z') ? timeStr : timeStr + 'Z');
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

export const ShortCard: React.FC<ShortCardProps> = React.memo(({
  snap,
  discussionMap,
  currentUser,
  onSelectAuthor,
  onSelectTag,
  onOpenDetail,
  onRequireLogin,
  id
}) => {
  const [showSubcomments, setShowSubcomments] = useState(false);
  const [upvoted, setUpvoted] = useState(false);
  const [voteCountDelta, setVoteCountDelta] = useState(0);
  const [voteLoading, setVoteLoading] = useState(false);
  const [voteOpen, setVoteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // In-line reply state
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [localReplies, setLocalReplies] = useState<HivePost[]>([]);

  const rep = calculateReputation(snap.author_reputation);
  const avatarUrl = getHiveAvatarUrl(snap.author, 'small');

  // Format relative or concise time
  const timeAgo = useMemo(() => {
    if (!snap.created) return '';
    try {
      const date = new Date(snap.created.endsWith('Z') ? snap.created : snap.created + 'Z');
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSec < 60) return 'just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
      if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }, [snap.created]);



  // Subcomments from discussion map + any locally posted replies
  const subcomments = useMemo(() => [
    ...getSnapSubcomments(snap, discussionMap),
    ...localReplies
  ], [snap, discussionMap, localReplies]);
  const replyCount = Math.max(snap.children || 0, subcomments.length);

  // Upvote snap
  const handleVote = () => {
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      return;
    }
    if (upvoted || voteLoading) return;
    setVoteOpen(true);
  };

  // Copy share link
  const handleCopyLink = () => {
    const url = `https://peakd.com/@${snap.author}/${snap.permlink}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResnap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const resnapText = `\n\nResnap: https://peakd.com/@${snap.author}/${snap.permlink}`;
    window.dispatchEvent(new CustomEvent('nebulosa:resnap', { detail: { text: resnapText, author: snap.author } }));
  };

  // Submit in-line reply
  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || replying) return;
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      return;
    }

    setReplying(true);
    try {
      const res = await KeychainService.postComment(
        currentUser.username,
        snap.author,
        snap.permlink,
        replyText.trim()
      );

      if (res.success) {
        const optimisticReply: HivePost = {
          post_id: Date.now(),
          author: currentUser.username,
          permlink: `re-${snap.author}-${Date.now()}`,
          category: snap.category || 'shorts',
          title: `RE: ${snap.permlink}`,
          body: replyText.trim(),
          json_metadata: {},
          created: new Date().toISOString(),
          depth: (snap.depth || 1) + 1,
          children: 0,
          net_rshares: 0,
          is_paidout: false,
          payout: 0,
          pending_payout_value: '0.000 HBD',
          author_reputation: 25,
          active_votes: []
        };
        setLocalReplies((prev) => [...prev, optimisticReply]);
        setReplyText('');
        setShowSubcomments(true);
      }
    } catch (err) {
      console.error('Failed to post reply:', err);
    } finally {
      setReplying(false);
    }
  };

  const totalVotes = (snap.stats?.total_votes || snap.active_votes?.length || 0) + voteCountDelta;

  return (
    <article
      id={id || `snap-${snap.author}-${snap.permlink}`}
      className="group bg-white dark:bg-slate-900 transition-colors duration-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
    >
      <div className="p-4 sm:p-5 md:p-6 flex gap-3.5 sm:gap-4">
        {/* Left: Author Avatar */}
        <div className="flex-shrink-0">
          <button
            type="button"
            onClick={() => onSelectAuthor(snap.author)}
            className="group relative cursor-pointer block"
            title={`View @${snap.author}'s profile`}
          >
            <img
              src={avatarUrl}
              alt={snap.author}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 shadow-sm group-hover:ring-4 group-hover:ring-blue-500/10 transition"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
              }}
            />
          </button>
        </div>

        {/* Right: Snap Body & Metadata */}
        <div className="flex-1 min-w-0">
          {/* Header Row: Author Name, Handle, Rep, Time */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <button
                type="button"
                onClick={() => onSelectAuthor(snap.author)}
                className="font-bold text-[14px] text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition truncate cursor-pointer"
              >
                @{snap.author}
              </button>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                {rep}
              </span>
              <span className="text-slate-300 dark:text-slate-600 select-none">&bull;</span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                {timeAgo}
              </span>
              {snap.parent_author && snap.parent_author.toLowerCase() !== 'peak.snaps' && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                  in reply to @{snap.parent_author}
                </span>
              )}
            </div>

            {/* Quick External Link */}
            <a
              href={`https://peakd.com/@${snap.author}/${snap.permlink}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open Snap on PeakD"
              className="text-gray-300 dark:text-slate-600 hover:text-gray-600 dark:hover:text-slate-300 p-1 rounded-md transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <SnapContent
            body={snap.body}
            jsonMetadata={snap.json_metadata}
            author={snap.author}
            permlink={snap.permlink}
            onSelectTag={onSelectTag}
            onOpenImage={setSelectedImage}
            onOpenDetail={onOpenDetail ? () => onOpenDetail(snap) : undefined}
            textClassName="text-sm text-slate-800 dark:text-slate-200 leading-6 break-words prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-a:text-blue-600 dark:prose-a:text-blue-400 hover:prose-a:underline select-text"
          />

          {/* Action Bar (Twitter / Shorts Style) */}
          <div className="flex items-center justify-between pt-3.5 mt-3 border-t border-slate-100/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            {/* Upvote Button */}
            <button
              type="button"
              onClick={handleVote}
              disabled={voteLoading}
              title={upvoted ? 'Upvoted (Click to vote)' : 'Upvote Snap with Hive Keychain'}
              className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-full transition cursor-pointer ${
                upvoted
                  ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 font-bold'
                  : 'hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50/60 dark:hover:bg-rose-950/30'
              }`}
            >
              <Heart
                className={`w-4 h-4 transition-transform active:scale-125 ${
                  upvoted ? 'fill-rose-600 dark:fill-rose-400 stroke-rose-600 dark:stroke-rose-400' : ''
                }`}
              />
              <span>{upvoted ? 'Upvoted' : 'Upvote'}</span>
            </button>

            {/* Replies / Subcomments Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenDetail) {
                  onOpenDetail(snap);
                } else {
                  setShowSubcomments(!showSubcomments);
                }
              }}
              title={onOpenDetail ? 'Open Short and view comments' : showSubcomments ? 'Hide replies' : 'View subcomments'}
              className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-full transition cursor-pointer ${
                showSubcomments || replyCount > 0
                  ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50/80 dark:hover:bg-blue-950/40 font-medium'
                  : 'hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/30'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span>{replyCount}</span>
              {!onOpenDetail && replyCount > 0 && (
                showSubcomments ? (
                  <ChevronUp className="w-3 h-3 ml-0.5" />
                ) : (
                  <ChevronDown className="w-3 h-3 ml-0.5" />
                )
              )}
            </button>

            {/* Resnap / Quote Button */}
            <button
              type="button"
              onClick={handleResnap}
              title="Resnap with comment"
              className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-full hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition cursor-pointer"
            >
              <Share2 className="w-4 h-4 -scale-x-100" />
              <span>Quote</span>
            </button>

            {/* Share Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              title="Copy share link"
              className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-full hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
                </>
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ================= SUBCOMMENTS (REPLIES) SECTION ================= */}
      {showSubcomments && (
        <div className="bg-slate-50/80 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 p-4 sm:p-5 space-y-3.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Replies ({subcomments.length})
            </span>
            <button
              type="button"
              onClick={() => setShowSubcomments(false)}
              className="text-[11px] text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 cursor-pointer"
            >
              Collapse
            </button>
          </div>

          {/* Subcomments List */}
          {subcomments.length > 0 ? (
            <div className="space-y-3 pl-2 sm:pl-4 border-l-2 border-blue-200/60 dark:border-blue-900/60 ml-2 sm:ml-4">
              {subcomments.map((reply) => {
                const replyAvatar = getHiveAvatarUrl(reply.author, 'small');
                const replyRep = calculateReputation(reply.author_reputation);
                const replyHtml = markdownToSafeHtml(cleanSnapBody(reply.body) || reply.body);
                const replyTime = formatRelativeTime(reply.created);

                return (
                  <div
                    key={reply.post_id || reply.permlink}
                    className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200/70 dark:border-slate-800 shadow-sm space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <img
                          src={replyAvatar}
                          alt={reply.author}
                          className="w-7 h-7 rounded-full object-cover bg-slate-100 dark:bg-slate-800 cursor-pointer ring-2 ring-white dark:ring-slate-900"
                          onClick={() => onSelectAuthor(reply.author)}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => onSelectAuthor(reply.author)}
                          className="font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                        >
                          @{reply.author}
                        </button>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">({replyRep})</span>
                      </div>
                      <span className="text-[11px] text-gray-400 dark:text-slate-500">{replyTime}</span>
                    </div>

                    <div
                      className="text-xs text-gray-800 dark:text-slate-200 leading-relaxed break-words pl-8 prose prose-xs dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: replyHtml }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-gray-400 dark:text-slate-500">
              No replies yet. Be the first to reply!
            </div>
          )}

          {/* In-line Reply Input Form */}
          <form onSubmit={handleSubmitReply} className="pt-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={
                  currentUser
                    ? `Reply to @${snap.author}...`
                    : 'Log in to reply to this Snap'
                }
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={replying || !currentUser}
                className="flex-1 px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400"
              />
              <button
                type="submit"
                disabled={replying || !replyText.trim() || !currentUser}
                className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>{replying ? 'Sending...' : 'Reply'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Image Zoom Lightbox Modal */}
      <VoteWeightDialog
        open={voteOpen}
        username={currentUser?.username || ''}
        author={snap.author}
        permlink={snap.permlink}
        onClose={() => setVoteOpen(false)}
        onVoted={() => {
          setUpvoted(true);
          setVoteCountDelta((prev) => prev + 1);
        }}
      />

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/15 transition cursor-pointer"
              title="Close image"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={selectedImage}
              alt="Enlarged snap attachment"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/10"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </article>
  );
});

ShortCard.displayName = 'ShortCard';

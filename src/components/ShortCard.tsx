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
  Maximize2,
  X
} from 'lucide-react';
import { HivePost, calculateReputation, getHiveAvatarUrl } from '../services/hiveApi';
import { CurrentUser, KeychainService } from '../services/keychain';
import { markdownToSafeHtml } from '../utils/sanitize';
import {
  extractSnapImages,
  cleanSnapBody,
  getSnapSubcomments
} from '../services/shortsApi';

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

  // Extract images and memoize markdown parsing for high scrolling performance
  const images = useMemo(() => extractSnapImages(snap.body, snap.json_metadata), [snap.body, snap.json_metadata]);
  const cleanedBody = useMemo(() => cleanSnapBody(snap.body), [snap.body]);
  const safeHtml = useMemo(() => markdownToSafeHtml(cleanedBody || snap.body), [cleanedBody, snap.body]);

  // Subcomments from discussion map + any locally posted replies
  const subcomments = useMemo(() => [
    ...getSnapSubcomments(snap, discussionMap),
    ...localReplies
  ], [snap, discussionMap, localReplies]);
  const replyCount = Math.max(snap.children || 0, subcomments.length);

  // Upvote snap
  const handleVote = async () => {
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      return;
    }
    if (upvoted || voteLoading) return;

    setVoteLoading(true);
    try {
      const res = await KeychainService.vote(currentUser.username, snap.author, snap.permlink, 10000);
      if (res.success) {
        setUpvoted(true);
        setVoteCountDelta((prev) => prev + 1);
      }
    } catch {
      // Ignore
    } finally {
      setVoteLoading(false);
    }
  };

  // Copy share link
  const handleCopyLink = () => {
    const url = `https://peakd.com/@${snap.author}/${snap.permlink}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract hashtags from body
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
      className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200/90 transition shadow-xs hover:shadow-sm overflow-hidden"
    >
      <div className="p-4 sm:p-5 flex gap-3.5">
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
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover bg-gray-100 border border-gray-200/70 group-hover:ring-2 group-hover:ring-blue-500/30 transition"
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
                className="font-bold text-sm text-gray-900 hover:text-blue-600 transition truncate cursor-pointer"
              >
                @{snap.author}
              </button>
              <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
                {rep}
              </span>
              <span className="text-gray-300 select-none">&bull;</span>
              <span className="text-xs text-gray-400 font-normal">
                {timeAgo}
              </span>
            </div>

            {/* Quick External Link */}
            <a
              href={`https://peakd.com/@${snap.author}/${snap.permlink}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open Snap on PeakD"
              className="text-gray-300 hover:text-gray-600 p-1 rounded-md transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Snap Text Content */}
          <div
            onClick={() => onOpenDetail?.(snap)}
            className={`text-sm text-gray-800 leading-relaxed break-words prose prose-sm max-w-none prose-p:my-1 prose-a:text-blue-600 hover:prose-a:underline select-text ${
              onOpenDetail ? 'cursor-pointer hover:text-gray-900' : ''
            }`}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />

          {/* Hashtag Pills */}
          {hashtags.length > 0 && onSelectTag && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {hashtags.map((t: string) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onSelectTag(t)}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-800 bg-blue-50/70 hover:bg-blue-100/80 px-2 py-0.5 rounded-lg transition cursor-pointer"
                  title={`Filter shorts by #${t}`}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}

          {/* Attached Images Grid (Twitter Style) */}
          {images.length > 0 && (
            <div className="mt-3">
              {images.length === 1 ? (
                <div
                  onClick={() => setSelectedImage(images[0])}
                  className="relative rounded-xl overflow-hidden border border-gray-100 max-h-80 bg-gray-50 cursor-pointer group"
                >
                  <img
                    src={images[0]}
                    alt="Snap attachment"
                    loading="lazy"
                    className="w-full h-full object-cover max-h-80 transition group-hover:scale-[1.01]"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center">
                    <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 drop-shadow-md transition" />
                  </div>
                </div>
              ) : (
                <div
                  className={`grid gap-2 rounded-xl overflow-hidden border border-gray-100 ${
                    images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
                  }`}
                >
                  {images.slice(0, 4).map((imgUrl, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedImage(imgUrl)}
                      className="relative h-36 bg-gray-50 cursor-pointer group overflow-hidden"
                    >
                      <img
                        src={imgUrl}
                        alt={`Attachment ${idx + 1}`}
                        loading="lazy"
                        className="w-full h-full object-cover transition group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition" />
                      {idx === 3 && images.length > 4 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-base">
                          +{images.length - 4}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Bar (Twitter / Shorts Style) */}
          <div className="flex items-center justify-between pt-3 mt-2.5 border-t border-gray-50 text-xs text-gray-500">
            {/* Upvote Button */}
            <button
              type="button"
              onClick={handleVote}
              disabled={voteLoading}
              title={upvoted ? 'Upvoted' : 'Upvote Snap (100%)'}
              className={`flex items-center gap-1.5 py-1 px-2 rounded-full transition cursor-pointer ${
                upvoted
                  ? 'text-rose-600 bg-rose-50 font-bold'
                  : 'hover:text-rose-600 hover:bg-rose-50/60'
              }`}
            >
              <Heart
                className={`w-4 h-4 transition-transform active:scale-125 ${
                  upvoted ? 'fill-rose-600 stroke-rose-600' : ''
                }`}
              />
              <span>{totalVotes}</span>
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
              className={`flex items-center gap-1.5 py-1 px-2.5 rounded-full transition cursor-pointer ${
                showSubcomments || replyCount > 0
                  ? 'text-blue-600 hover:bg-blue-50/80 font-medium'
                  : 'hover:text-blue-600 hover:bg-blue-50/60'
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

            {/* Payout */}
            {snap.payout !== undefined && snap.payout > 0 ? (
              <span
                className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"
                title={`Payout: $${snap.payout.toFixed(3)}`}
              >
                ${snap.payout.toFixed(2)}
              </span>
            ) : (
              <span className="text-gray-300">&bull;</span>
            )}

            {/* Share Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              title="Copy share link"
              className="flex items-center gap-1 py-1 px-2 rounded-full hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-semibold">Copied</span>
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
        <div className="bg-gray-50/70 border-t border-gray-100 p-4 sm:p-5 space-y-3.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
              Replies ({subcomments.length})
            </span>
            <button
              type="button"
              onClick={() => setShowSubcomments(false)}
              className="text-[11px] text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              Collapse
            </button>
          </div>

          {/* Subcomments List */}
          {subcomments.length > 0 ? (
            <div className="space-y-3 pl-2 sm:pl-4 border-l-2 border-blue-200/60 ml-2 sm:ml-4">
              {subcomments.map((reply) => {
                const replyAvatar = getHiveAvatarUrl(reply.author, 'small');
                const replyRep = calculateReputation(reply.author_reputation);
                const replyHtml = markdownToSafeHtml(cleanSnapBody(reply.body) || reply.body);
                const replyTime = formatRelativeTime(reply.created);

                return (
                  <div
                    key={reply.post_id || reply.permlink}
                    className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <img
                          src={replyAvatar}
                          alt={reply.author}
                          className="w-6 h-6 rounded-full object-cover bg-gray-100 cursor-pointer"
                          onClick={() => onSelectAuthor(reply.author)}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => onSelectAuthor(reply.author)}
                          className="font-bold text-gray-900 hover:text-blue-600 cursor-pointer"
                        >
                          @{reply.author}
                        </button>
                        <span className="text-[10px] text-gray-400 font-medium">({replyRep})</span>
                      </div>
                      <span className="text-[11px] text-gray-400">{replyTime}</span>
                    </div>

                    <div
                      className="text-xs text-gray-800 leading-relaxed break-words pl-8 prose prose-xs max-w-none"
                      dangerouslySetInnerHTML={{ __html: replyHtml }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-gray-400">
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
                className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={replying || !replyText.trim() || !currentUser}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>{replying ? 'Sending...' : 'Reply'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Image Zoom Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 p-1.5 text-white/80 hover:text-white rounded-full bg-white/10 transition cursor-pointer"
              title="Close image"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={selectedImage}
              alt="Enlarged snap attachment"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </article>
  );
});

ShortCard.displayName = 'ShortCard';

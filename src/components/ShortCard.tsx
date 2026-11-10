import { useI18n } from '../i18n/I18nContext';
import { BlacklistFlair } from './BlacklistFlair';
import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  MoreHorizontal,
  UserX,
  Copy,
  Languages,
  Loader2
} from 'lucide-react';
import { HivePost, getHiveAvatarUrl } from '../services/hiveApi';
import { CurrentUser, KeychainService } from '../services/keychain';
import { markdownToSafeHtml } from '../utils/sanitize';
import {
  cleanSnapBody,
  getSnapSubcomments
} from '../services/shortsApi';
import { SnapContent } from './SnapContent';
import { VoteWeightDialog } from './VoteWeightDialog';
import { translateMarkdown, POPULAR_TRANSLATION_LANGUAGES } from '../services/translationService';
import { ShortTranslatorDropdown } from './ShortTranslatorDropdown';

interface ShortCardProps {
  snap: HivePost;
  discussionMap: Record<string, HivePost>;
  currentUser: CurrentUser | null;
  onSelectAuthor: (author: string) => void;
  onSelectTag?: (tag: string) => void;
  onOpenDetail?: (snap: HivePost) => void;
  onRequireLogin?: () => void;
  onMuteAuthor?: (author: string) => void;
  isMuted?: boolean;
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
  onMuteAuthor,
  isMuted = false,
  id
}) => {
  const [showSubcomments, setShowSubcomments] = useState(false);
  const [upvoted, setUpvoted] = useState(false);
  const [voteLoading, setVoteLoading] = useState(false);
  const [voteOpen, setVoteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // 3-dots options menu state
  const [showMenu, setShowMenu] = useState(false);
  const [menuFeedback, setMenuFeedback] = useState<string | null>(null);

  // Short translation state (free, markdown-preserved)
  const [activeTranslationLang, setActiveTranslationLang] = useState<string | null>(null);
  const [translatedBody, setTranslatedBody] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  const handleTranslateShort = async (langCode: string) => {
    if (!snap.body || isTranslating) return;
    setIsTranslating(true);
    try {
      const translated = await translateMarkdown(snap.body, langCode);
      setTranslatedBody(translated);
      setActiveTranslationLang(langCode);
    } catch (err) {
      console.error('Failed to translate short:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleResetOriginalShort = () => {
    setActiveTranslationLang(null);
    setTranslatedBody(null);
  };

  const { locale } = useI18n();
  const replyTranslationVersion = useRef(0);
  // Subcomment translation state (map of permlink -> translatedBody)
  const [translatedReplies, setTranslatedReplies] = useState<Record<string, string>>({});
  const [translatingReplyKey, setTranslatingReplyKey] = useState<string | null>(null);

  useEffect(() => {
    replyTranslationVersion.current++;
    setTranslatedReplies({});
    setTranslatingReplyKey(null);
    return () => { replyTranslationVersion.current++; };
  }, [locale, snap.author, snap.permlink]);

  const handleToggleTranslateReply = async (reply: HivePost) => {
    const key = `${reply.author}/${reply.permlink}`;
    if (translatedReplies[key]) {
      setTranslatedReplies((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    const cleanText = cleanSnapBody(reply.body) || reply.body;
    if (!cleanText || translatingReplyKey) return;
    const version = replyTranslationVersion.current;
    setTranslatingReplyKey(key);
    try {
      const translated = await translateMarkdown(cleanText, locale);
      if (version === replyTranslationVersion.current) setTranslatedReplies((prev) => ({ ...prev, [key]: translated }));
    } catch (err) {
      console.error('Failed to translate subcomment:', err);
    } finally {
      if (version === replyTranslationVersion.current) setTranslatingReplyKey(null);
    }
  };

  // In-line reply state
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [localReplies, setLocalReplies] = useState<HivePost[]>([]);

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
  const replyCount = useMemo(() => Math.max(
    Number(snap.children) || 0,
    Array.isArray(snap.replies) ? snap.replies.length : 0,
    subcomments.length
  ), [snap.children, snap.replies, subcomments.length]);
  const replyLabel = replyCount === 1 ? 'reply' : 'replies';

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

  const handleShare = async () => {
    const url = `https://peakd.com/@${snap.author}/${snap.permlink}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Snap by @${snap.author}`,
          text: snap.body ? snap.body.slice(0, 100) : '',
          url,
        });
        setShowMenu(false);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          setShowMenu(false);
          return;
        }
      }
    }

    navigator.clipboard.writeText(url);
    setMenuFeedback('Link copied!');
    setTimeout(() => {
      setMenuFeedback(null);
      setShowMenu(false);
    }, 1200);
  };

  const handleMute = () => {
    if (onMuteAuthor) {
      onMuteAuthor(snap.author);
      setMenuFeedback(`Muted @${snap.author}`);
      setTimeout(() => {
        setMenuFeedback(null);
        setShowMenu(false);
      }, 1200);
    }
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

  return (
    <article
      id={id || `snap-${snap.author}-${snap.permlink}`}
      className="group rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_2px_10px_rgba(15,23,42,0.025)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)] hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200"
    >
      <div className="p-3 sm:p-3.5">
        {/* Compact author row; the Snap body below starts at the card margin. */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => onSelectAuthor(snap.author)}
              className="group relative block flex-shrink-0 cursor-pointer"
              title={`View @${snap.author}'s profile`}
            >
              <img
                src={avatarUrl}
                alt={snap.author}
                className="h-8 w-8 rounded-full border border-white bg-slate-100 object-cover shadow-sm transition group-hover:ring-4 group-hover:ring-blue-500/10 dark:border-slate-900 dark:bg-slate-800"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                }}
              />
            </button>
            <div className="flex min-w-0 items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => onSelectAuthor(snap.author)}
                className="font-bold text-sm text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition truncate cursor-pointer"
              >
                @{snap.author}
              </button>
              <BlacklistFlair username={snap.author} />
              <span className="text-slate-300 dark:text-slate-600 select-none">&bull;</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {timeAgo}
              </span>
              {snap.parent_author && snap.parent_author.toLowerCase() !== 'peak.snaps' && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                  in reply to @{snap.parent_author}
                </span>
              )}
            </div>
          </div>

          {/* 3-dots Options Menu */}
          <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu((prev) => !prev);
                }}
                className="p-2 sm:p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Options"
                aria-label="Options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                    }}
                  />
                  <div
                    className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-150 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 text-xs text-slate-700 dark:text-slate-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {menuFeedback ? (
                      <div className="px-3.5 py-2.5 text-center font-medium text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        <span>{menuFeedback}</span>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleShare}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer font-medium"
                        >
                          <Share2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          <span>Share Snap</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const url = `https://peakd.com/@${snap.author}/${snap.permlink}`;
                            navigator.clipboard.writeText(url);
                            setMenuFeedback('Link copied!');
                            setTimeout(() => {
                              setMenuFeedback(null);
                              setShowMenu(false);
                            }, 1200);
                          }}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer font-medium"
                        >
                          <Copy className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          <span>Copy link</span>
                        </button>

                        <a
                          href={`https://peakd.com/@${snap.author}/${snap.permlink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowMenu(false)}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer font-medium"
                        >
                          <ExternalLink className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          <span>Open on PeakD</span>
                        </a>

                        {onMuteAuthor && (
                          <button
                            type="button"
                            onClick={handleMute}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2.5 cursor-pointer font-semibold border-t border-slate-100 dark:border-slate-800"
                            title={isMuted ? `Unmute @${snap.author}` : `Mute / filter out @${snap.author}`}
                          >
                            <UserX className="w-4 h-4" />
                            <span>{isMuted ? `Unmute @${snap.author}` : `Mute @${snap.author}`}</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
          </div>
        </div>

          <SnapContent
            body={translatedBody || snap.body}
            jsonMetadata={snap.json_metadata}
            author={snap.author}
            permlink={snap.permlink}
            onSelectTag={onSelectTag}
            onOpenDetail={onOpenDetail ? () => onOpenDetail(snap) : undefined}
            textClassName="text-sm text-slate-800 dark:text-slate-200 leading-6 break-words prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-a:text-blue-600 dark:prose-a:text-blue-400 hover:prose-a:underline select-text"
            charLimit={300}
            enableTruncation={true}
          />

          {/* Action Bar (Twitter / Shorts Style) */}
          <div className="shorts-action-row flex flex-wrap items-center justify-between gap-0.5 pt-2 mt-2 border-t border-slate-100/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            {/* Upvote Button */}
            <button
              type="button"
              onClick={handleVote}
              disabled={voteLoading}
              title={upvoted ? 'Voted' : 'Vote on this Snap with Hive Keychain'}
              aria-label={upvoted ? 'Voted' : 'Vote on this Snap'}
              className={`shorts-action-button flex items-center gap-1 min-h-9 py-1 px-1.5 rounded-xl transition cursor-pointer ${
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
              <span>{upvoted ? 'Voted' : 'Vote'}</span>
            </button>

            {/* Free Markdown-Preserving Translation Dropdown */}
            <ShortTranslatorDropdown
              currentLanguage={activeTranslationLang}
              isTranslating={isTranslating}
              onSelectLanguage={handleTranslateShort}
              onResetOriginal={handleResetOriginalShort}
            />

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
              title={onOpenDetail ? `Open Snap and view ${replyCount} ${replyLabel}` : showSubcomments ? 'Hide replies' : `View ${replyCount} ${replyLabel}`}
              aria-label={showSubcomments ? 'Hide replies' : `View ${replyCount} ${replyLabel}`}
              className={`shorts-action-button flex items-center gap-1 min-h-9 py-1 px-1.5 rounded-xl transition cursor-pointer ${
                showSubcomments
                  ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50/80 dark:hover:bg-blue-950/40 font-medium'
                  : 'hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/30'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span>Replies</span>
              <span className="min-w-4 text-center text-[11px] tabular-nums text-slate-400 dark:text-slate-500">{replyCount}</span>
              {!onOpenDetail && showSubcomments && (
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
              className="shorts-action-button flex items-center gap-1 min-h-9 py-1 px-1.5 rounded-xl hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition cursor-pointer"
            >
              <Share2 className="w-4 h-4 -scale-x-100" />
              <span>Resnap</span>
            </button>

            {/* Share Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              title="Copy share link"
              className="shorts-action-button flex items-center gap-1 min-h-9 py-1 px-1.5 rounded-xl hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
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

      {/* ================= SUBCOMMENTS (REPLIES) SECTION ================= */}
      {showSubcomments && (
        <div className="bg-slate-50/80 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 p-4 sm:p-5 space-y-3.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Replies
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
                const replyKey = `${reply.author}/${reply.permlink}`;
                const isReplyTranslating = translatingReplyKey === replyKey;
                const translatedReply = translatedReplies[replyKey];
                const activeReplyBody = translatedReply || cleanSnapBody(reply.body) || reply.body;
                const replyHtml = markdownToSafeHtml(activeReplyBody);
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
              <BlacklistFlair username={reply.author} />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleTranslateReply(reply)}
                          disabled={isReplyTranslating}
                          className={`flex items-center gap-1 text-[11px] font-semibold transition cursor-pointer ${
                            translatedReply
                              ? 'text-blue-600 dark:text-blue-400 font-bold'
                              : 'text-slate-400 hover:text-blue-600'
                          }`}
                          title={translatedReply ? 'Show original text' : 'Translate reply (Free, preserves markdown)'}
                        >
                          {isReplyTranslating ? (
                            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                          ) : (
                            <Languages className="w-3 h-3" />
                          )}
                          <span>{translatedReply ? 'Original' : 'Translate'}</span>
                        </button>
                        <span className="text-[11px] text-gray-400 dark:text-slate-500">{replyTime}</span>
                      </div>
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
        }}
      />

    </article>
  );
});

ShortCard.displayName = 'ShortCard';

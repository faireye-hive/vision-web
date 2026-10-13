import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ChevronRight,
  CornerDownRight,
  RefreshCw,
  AlertCircle,
  X,
  MoreHorizontal,
  UserX,
  Copy,
  Languages,
  Loader2
} from 'lucide-react';
import { HivePost, calculateReputation, getHiveAvatarUrl, getDiscussion } from '../services/hiveApi';
import { CurrentUser, KeychainService } from '../services/keychain';
import { markdownToSafeHtml } from '../utils/sanitize';
import {
  cleanSnapBody,
  buildCommentTree,
  ThreadCommentNode,
  truncateSnapText
} from '../services/shortsApi';
import { SnapContent } from './SnapContent';
import { VoteWeightDialog } from './VoteWeightDialog';
import { translateMarkdown, POPULAR_TRANSLATION_LANGUAGES } from '../services/translationService';
import { ShortTranslatorDropdown } from './ShortTranslatorDropdown';

interface ShortDetailViewProps {
  snap: HivePost;
  initialDiscussionMap?: Record<string, HivePost>;
  onUpdateDiscussionMap?: (map: Record<string, HivePost>) => void;
  currentUser: CurrentUser | null;
  onBack: () => void;
  onSelectAuthor: (author: string) => void;
  onSelectTag?: (tag: string) => void;
  onRequireLogin?: () => void;
  onMuteAuthor?: (author: string) => void;
  blockedAuthors?: string[];
}

export const ShortDetailView: React.FC<ShortDetailViewProps> = ({
  snap,
  initialDiscussionMap = {},
  onUpdateDiscussionMap,
  currentUser,
  onBack,
  onSelectAuthor,
  onSelectTag,
  onRequireLogin,
  onMuteAuthor,
  blockedAuthors = []
}) => {
  const [discussionMap, setDiscussionMap] = useState<Record<string, HivePost>>(initialDiscussionMap);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Upvote state for main snap
  const [upvoted, setUpvoted] = useState(false);
  const [voteCountDelta, setVoteCountDelta] = useState(0);
  const [voteLoading, setVoteLoading] = useState(false);
  const [voteOpen, setVoteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Main reply composer state (docked bottom bar)
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [mainReplyText, setMainReplyText] = useState('');
  const [mainReplying, setMainReplying] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // 3-dots menu state
  const [showMenu, setShowMenu] = useState(false);
  const [menuFeedback, setMenuFeedback] = useState<string | null>(null);

  // Short detail translation state (free, markdown-preserved)
  const [activeTranslationLang, setActiveTranslationLang] = useState<string | null>(null);
  const [translatedBody, setTranslatedBody] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  useEffect(() => {
    setActiveTranslationLang(null);
    setTranslatedBody(null);
    setIsTranslating(false);
  }, [snap.author, snap.permlink]);

  const handleTranslateShort = async (langCode: string) => {
    if (!snap.body || isTranslating) return;
    setIsTranslating(true);
    try {
      const translated = await translateMarkdown(snap.body, langCode);
      setTranslatedBody(translated);
      setActiveTranslationLang(langCode);
    } catch (err) {
      console.error('Failed to translate short in detail:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleResetOriginalShort = () => {
    setActiveTranslationLang(null);
    setTranslatedBody(null);
  };

  // Fetch full discussion specifically for this snap
  const fetchFreshDiscussion = useCallback(async (forceRefresh = false) => {
    setIsRefreshing(true);
    try {
      const directDiscussion = await getDiscussion(snap.author, snap.permlink, forceRefresh);
      if (directDiscussion && Object.keys(directDiscussion).length > 0) {
        setDiscussionMap((prev) => ({ ...prev, ...directDiscussion }));
        if (onUpdateDiscussionMap) {
          setTimeout(() => onUpdateDiscussionMap(directDiscussion), 0);
        }
      }
    } catch (err) {
      console.warn('Could not fetch fresh direct discussion for snap:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [snap.author, snap.permlink, onUpdateDiscussionMap]);

  const navigate = useNavigate();

  // Cache snap itself into discussionMap so it is preserved when returning from children
  useEffect(() => {
    if (snap && snap.author && snap.permlink) {
      const key = `${snap.author}/${snap.permlink}`;
      setDiscussionMap((prev) => {
        if (prev[key]) return prev;
        return { ...prev, [key]: snap };
      });
    }
  }, [snap]);

  // Reset local interactive state and scroll to top when changing snaps
  useEffect(() => {
    setUpvoted(false);
    setVoteCountDelta(0);
    setIsComposerExpanded(false);
    setMainReplyText('');
    setReplyError(null);
    setShowMenu(false);
    setMenuFeedback(null);

    window.scrollTo({ top: 0, behavior: 'instant' });
    const overlay = document.querySelector('.fixed.inset-0.z-35.overflow-y-auto');
    if (overlay) {
      overlay.scrollTop = 0;
    }
  }, [snap.author, snap.permlink]);

  // Is this snap a reply to another parent Snap?
  const isReplySnap = Boolean(
    snap.parent_author &&
    snap.parent_author !== 'peak.snaps' &&
    snap.parent_permlink
  );

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
        onBack();
      }, 1000);
    }
  };

  const handleOpenCommentAsSnap = useCallback((targetComment: HivePost) => {
    // Cache current snap and targetComment into discussionMap for instantaneous navigation
    const currentKey = `${snap.author}/${snap.permlink}`;
    const targetKey = `${targetComment.author}/${targetComment.permlink}`;
    setDiscussionMap((prev) => ({
      ...prev,
      [currentKey]: snap,
      [targetKey]: targetComment
    }));
    if (onUpdateDiscussionMap) {
      setTimeout(() => {
        onUpdateDiscussionMap({
          [currentKey]: snap,
          [targetKey]: targetComment
        });
      }, 0);
    }

    navigate(`/shorts/@${targetComment.author}/${targetComment.permlink}`, {
      state: { snap: targetComment }
    });
  }, [snap, onUpdateDiscussionMap, navigate]);

  const handleBackNavigation = useCallback(() => {
    // If this snap is a reply to another parent Snap, return directly to the parent Snap!
    if (isReplySnap && snap.parent_author && snap.parent_permlink) {
      const parentKey = `${snap.parent_author}/${snap.parent_permlink}`;
      const parentPost = discussionMap[parentKey];
      navigate(`/shorts/@${snap.parent_author}/${snap.parent_permlink}`, {
        state: parentPost ? { snap: parentPost } : undefined
      });
      return;
    }

    // Otherwise, this is a top-level Snap -> return directly to the Shorts feed
    onBack();
  }, [isReplySnap, snap.parent_author, snap.parent_permlink, discussionMap, navigate, onBack]);

  // Format relative time in English
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

  const handleVote = () => {
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      return;
    }
    if (upvoted || voteLoading) return;
    setVoteOpen(true);
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
      setIsComposerExpanded(false);
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
    <div className="w-full max-w-[760px] mx-auto animate-in fade-in slide-in-from-right-2 duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-none sm:rounded-[32px] border-0 sm:border border-slate-200/70 dark:border-slate-800 shadow-none sm:shadow-[0_8px_30px_rgba(15,23,42,0.04)] flex flex-col min-h-screen sm:min-h-0 relative">
        {/* Header Bar - Sticky to follow scroll */}
        <div className="flex items-center justify-between px-3.5 py-3 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-30 rounded-none sm:rounded-t-[32px]">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={handleBackNavigation}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center -ml-1 text-slate-700 dark:text-slate-200 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all cursor-pointer group"
              aria-label={isReplySnap ? `Back to parent snap (@${snap.parent_author})` : 'Back to Shorts feed'}
              title={isReplySnap ? `Back to parent snap (@${snap.parent_author})` : 'Back to Shorts feed'}
            >
              <ArrowLeft className="w-5 h-5 group-active:-translate-x-1 transition-transform" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] sm:text-[17px] font-bold text-slate-900 dark:text-white tracking-tight">
                  {isReplySnap ? 'Snap Reply' : 'Snap Thread'}
                </h2>
                {isReplySnap && (
                  <span className="text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/60">
                    Thread
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>{totalCommentsCount} {totalCommentsCount === 1 ? 'reply' : 'replies'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => fetchFreshDiscussion(true)}
              disabled={isRefreshing}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title="Refresh discussion"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* 3-dots Options Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu((prev) => !prev)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                title="Options"
                aria-label="Options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setShowMenu(false)}
                  />
                  <div
                    className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-150 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 text-xs text-slate-700 dark:text-slate-200"
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
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer font-medium"
                        >
                          <Share2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
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
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer font-medium"
                        >
                          <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          <span>Copy link</span>
                        </button>

                        <a
                          href={`https://peakd.com/@${snap.author}/${snap.permlink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowMenu(false)}
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer font-medium"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          <span>Open on PeakD</span>
                        </a>

                        {onMuteAuthor && (
                          <button
                            type="button"
                            onClick={handleMute}
                            className="w-full text-left px-3.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer font-semibold border-t border-slate-100 dark:border-slate-800"
                            title={`Mute @${snap.author}`}
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Mute @{snap.author}</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content Area - Edge to edge on mobile, padded on desktop */}
        <div className="px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-44 sm:pb-8 flex-1">
          {/* Main Snap Card */}
          <div className="space-y-4">
            {/* If this snap is a reply to another snap/post, show breadcrumb link with direct View Parent button */}
            {isReplySnap && snap.parent_author && snap.parent_permlink && (
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 bg-blue-50/60 dark:bg-blue-950/30 px-3.5 py-2.5 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                <div className="flex items-center gap-2 min-w-0">
                  <CornerDownRight className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span className="text-slate-500 dark:text-slate-400">Replying to</span>
                  <button
                    type="button"
                    onClick={() => {
                      const parentKey = `${snap.parent_author}/${snap.parent_permlink}`;
                      const parentPost = discussionMap[parentKey];
                      navigate(`/shorts/@${snap.parent_author}/${snap.parent_permlink}`, {
                        state: parentPost ? { snap: parentPost } : undefined
                      });
                    }}
                    className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer truncate"
                  >
                    @{snap.parent_author}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleBackNavigation}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 flex-shrink-0 ml-2 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>View parent</span>
                </button>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => onSelectAuthor(snap.author)}
                className="relative group flex-shrink-0 cursor-pointer"
              >
                <img
                  src={avatarUrl}
                  alt={snap.author}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800 group-hover:ring-blue-400 transition"
                />
              </button>
              <div className="min-w-0">
                <button
                  onClick={() => onSelectAuthor(snap.author)}
                  className="font-bold text-[15px] sm:text-[16px] text-slate-900 dark:text-white hover:text-blue-600 transition truncate cursor-pointer block"
                >
                  @{snap.author}
                </button>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  <span>{rep}</span>
                  <span aria-hidden="true">&middot;</span>
                  <span>{timeAgo}</span>
                </div>
              </div>
            </div>

            <SnapContent
              body={translatedBody || snap.body}
              jsonMetadata={snap.json_metadata}
              author={snap.author}
              permlink={snap.permlink}
              onSelectTag={onSelectTag}
              onOpenImage={setSelectedImage}
              textClassName="text-[16px] sm:text-[17px] text-slate-800 dark:text-slate-100 leading-relaxed break-words prose prose-slate dark:prose-invert max-w-none prose-p:my-2 prose-a:text-blue-600 dark:prose-a:text-blue-400 select-text"
            />

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
                <button
                  onClick={handleVote}
                  disabled={voteLoading || upvoted}
                  className={`flex items-center gap-2 text-[13px] font-bold px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full transition-all cursor-pointer ${
                    upvoted
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-900/40 hover:text-rose-600'
                  }`}
                >
                  <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${upvoted ? 'fill-current animate-bounce' : ''}`} />
                  <span>{upvoted ? 'Voted' : 'Vote'}</span>
                </button>

                <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 font-medium">
                  <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                  <span className="text-[13px]">{totalCommentsCount}</span>
                </div>

                {/* Free Markdown-Preserving Translation Dropdown */}
                <ShortTranslatorDropdown
                  currentLanguage={activeTranslationLang}
                  isTranslating={isTranslating}
                  onSelectLanguage={handleTranslateShort}
                  onResetOriginal={handleResetOriginalShort}
                  compact={false}
                />
              </div>
              <button
                onClick={handleCopyLink}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
                title="Share link"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Share2 className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Thread List */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[14px] sm:text-[15px] font-bold text-slate-800 dark:text-slate-100">
                Discussion
              </h3>
              <span className="text-xs text-slate-400">
                {totalCommentsCount} {totalCommentsCount === 1 ? 'comment' : 'comments'}
              </span>
            </div>

            {commentTree.length > 0 ? (
              <div className="space-y-3 sm:space-y-4">
                {commentTree
                  .filter((node) => !blockedAuthors.some((a) => a.toLowerCase() === node.comment.author.toLowerCase()))
                  .map((node) => (
                    <ThreadCommentItem
                      key={`${node.comment.author}-${node.comment.permlink}`}
                      node={node}
                      currentUser={currentUser}
                      onSelectAuthor={onSelectAuthor}
                      onRequireLogin={onRequireLogin}
                      onAddChildReply={handleAddChildReply}
                      onOpenAsSnap={handleOpenCommentAsSnap}
                      onMuteAuthor={onMuteAuthor}
                    />
                  ))}
              </div>
            ) : (
              <div className="py-10 text-center bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                <MessageCircle className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-slate-400 font-medium text-xs sm:text-sm">No comments yet. Be the first to reply!</p>
              </div>
            )}
          </div>
        </div>

        {/* Docked Bottom Comment Bar (Single line by default, docked above MobileBottomNav on mobile) */}
        <div className="fixed md:sticky inset-x-0 z-35 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 p-2.5 sm:p-3 md:rounded-b-[32px] shadow-[0_-4px_24px_rgba(0,0,0,0.06)] shorts-bottom-composer">
          {!isComposerExpanded ? (
            /* Single-line sleek bar */
            <div
              onClick={() => {
                if (!currentUser) {
                  if (onRequireLogin) onRequireLogin();
                  return;
                }
                setIsComposerExpanded(true);
              }}
              className="flex items-center gap-2.5 cursor-pointer max-w-[720px] mx-auto select-none"
            >
              <img
                src={getHiveAvatarUrl(currentUser?.username || 'hive', 'small')}
                alt={currentUser?.username || 'user'}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
              />
              <div className="flex-1 flex items-center justify-between bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-750 px-3.5 py-2 rounded-full transition text-slate-500 dark:text-slate-400 text-xs sm:text-sm min-h-[38px]">
                <span className="truncate">
                  {currentUser ? `Add a reply to @${snap.author}...` : 'Log in to add a reply...'}
                </span>
                <Send className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-1.5" />
              </div>
            </div>
          ) : (
            /* Expanded multi-line composer */
            <form onSubmit={handleSubmitMainReply} className="space-y-2.5 max-w-[720px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                <span className="font-medium">
                  Replying to <span className="font-semibold text-blue-600 dark:text-blue-400">@{snap.author}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsComposerExpanded(false);
                    setReplyError(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-2 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              </div>

              <div className="flex gap-2.5 items-start">
                <img
                  src={getHiveAvatarUrl(currentUser?.username || 'hive', 'small')}
                  alt={currentUser?.username || 'user'}
                  className="w-8 h-8 rounded-full object-cover mt-1 ring-1 ring-slate-200 dark:ring-slate-700"
                />
                <textarea
                  value={mainReplyText}
                  onChange={(e) => setMainReplyText(e.target.value)}
                  placeholder="Write your reply..."
                  disabled={!currentUser || mainReplying}
                  rows={3}
                  autoFocus
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition resize-none text-slate-900 dark:text-slate-100"
                />
              </div>

              {replyError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-500 px-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{replyError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsComposerExpanded(false);
                    setReplyError(null);
                  }}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-1 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={!currentUser || !mainReplyText.trim() || mainReplying}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 py-1.5 rounded-full text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{mainReplying ? 'Posting...' : 'Post Reply'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

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

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Snap attachment"
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};

interface ThreadCommentItemProps {
  node: ThreadCommentNode;
  currentUser: CurrentUser | null;
  onSelectAuthor: (author: string) => void;
  onRequireLogin?: () => void;
  onAddChildReply: (parentAuthor: string, parentPermlink: string, newReply: HivePost) => void;
  onOpenAsSnap: (comment: HivePost) => void;
  onMuteAuthor?: (author: string) => void;
}

const ThreadCommentItem: React.FC<ThreadCommentItemProps> = ({
  node,
  currentUser,
  onSelectAuthor,
  onRequireLogin,
  onAddChildReply,
  onOpenAsSnap,
  onMuteAuthor
}) => {
  const { comment, replies } = node;
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const [upvoted, setUpvoted] = useState(false);
  const [voteCountDelta, setVoteCountDelta] = useState(0);
  const [voteLoading, setVoteLoading] = useState(false);

  // Truncation & 3-dots menu state
  const [isCommentExpanded, setIsCommentExpanded] = useState(false);
  const [showCommentMenu, setShowCommentMenu] = useState(false);
  const [commentMenuFeedback, setCommentMenuFeedback] = useState<string | null>(null);

  const rep = calculateReputation(comment.author_reputation);
  const avatarUrl = getHiveAvatarUrl(comment.author, 'small');

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

  const cleanedBody = useMemo(() => cleanSnapBody(comment.body), [comment.body]);

  // Comment translation state (free, markdown-preserved)
  const [translatedCommentBody, setTranslatedCommentBody] = useState<string | null>(null);
  const [isTranslatingComment, setIsTranslatingComment] = useState(false);

  const handleToggleTranslateComment = async () => {
    if (translatedCommentBody) {
      setTranslatedCommentBody(null);
      return;
    }
    const textToTranslate = cleanedBody || comment.body;
    if (!textToTranslate || isTranslatingComment) return;
    setIsTranslatingComment(true);
    try {
      const res = await translateMarkdown(textToTranslate, 'pt');
      setTranslatedCommentBody(res);
    } catch (err) {
      console.error('Failed to translate thread comment:', err);
    } finally {
      setIsTranslatingComment(false);
    }
  };

  const effectiveBody = translatedCommentBody || cleanedBody || comment.body;

  const { isTruncated, truncatedText } = useMemo(() => {
    return truncateSnapText(effectiveBody, 300);
  }, [effectiveBody]);

  const activeBody = isTruncated && !isCommentExpanded ? truncatedText : effectiveBody;
  const safeHtml = useMemo(() => markdownToSafeHtml(activeBody), [activeBody]);

  const [voteOpen, setVoteOpen] = useState(false);
  const handleVote = () => {
    if (!currentUser) {
      onRequireLogin?.();
      return;
    }
    if (upvoted || voteLoading) return;
    setVoteOpen(true);
  };

  const handleCommentShare = async () => {
    const url = `https://peakd.com/@${comment.author}/${comment.permlink}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Reply by @${comment.author}`,
          text: comment.body ? comment.body.slice(0, 100) : '',
          url,
        });
        setShowCommentMenu(false);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          setShowCommentMenu(false);
          return;
        }
      }
    }

    navigator.clipboard.writeText(url);
    setCommentMenuFeedback('Link copied!');
    setTimeout(() => {
      setCommentMenuFeedback(null);
      setShowCommentMenu(false);
    }, 1200);
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
    } catch {
      // keychain handles error messaging
    } finally {
      setSubmittingReply(false);
    }
  };

  const netVotes = (comment.active_votes?.length || 0) + voteCountDelta;
  const repliesCount = Math.max(replies.length, comment.children || 0);

  return (
    <div className="flex gap-2 sm:gap-3 w-full">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelectAuthor(comment.author);
        }}
        className="flex-shrink-0 cursor-pointer h-fit pt-0.5"
      >
        <img
          src={avatarUrl}
          alt={comment.author}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ring-1 ring-slate-100 dark:ring-slate-800"
        />
      </button>

      <div className="flex-1 min-w-0">
        <div
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('button, a, input, textarea, [role="button"]')) return;
            onOpenAsSnap(comment);
          }}
          className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl sm:rounded-[22px] p-3 sm:p-4 border border-slate-100 dark:border-slate-700/50 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/90 transition-colors group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAuthor(comment.author);
                }}
                className="font-bold text-[13px] sm:text-[14px] text-slate-900 dark:text-white hover:text-blue-600 transition truncate cursor-pointer"
              >
                @{comment.author}
              </button>
              <span className="text-[10px] text-slate-400 font-medium">
                {rep}
              </span>
              <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">&middot;</span>
              <span className="text-[11px] text-slate-400">{timeAgo}</span>
            </div>

            <div className="flex items-center gap-1">
              {repliesCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAsSnap(comment);
                  }}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition cursor-pointer p-1 flex items-center gap-1"
                  title="Open thread"
                >
                  <span className="font-medium text-[11px]">
                    {repliesCount} {repliesCount === 1 ? 'reply' : 'replies'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Comment 3-dots Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCommentMenu((prev) => !prev);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition cursor-pointer"
                  title="Options"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>

                {showCommentMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCommentMenu(false);
                      }}
                    />
                    <div
                      className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-150 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 text-xs text-slate-700 dark:text-slate-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {commentMenuFeedback ? (
                        <div className="px-3 py-2 text-center font-medium text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>{commentMenuFeedback}</span>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={handleCommentShare}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <Share2 className="w-3 h-3 text-slate-400" />
                            <span>Share</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const url = `https://peakd.com/@${comment.author}/${comment.permlink}`;
                              navigator.clipboard.writeText(url);
                              setCommentMenuFeedback('Link copied!');
                              setTimeout(() => {
                                setCommentMenuFeedback(null);
                                setShowCommentMenu(false);
                              }, 1200);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <Copy className="w-3 h-3 text-slate-400" />
                            <span>Copy link</span>
                          </button>

                          <a
                            href={`https://peakd.com/@${comment.author}/${comment.permlink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setShowCommentMenu(false)}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                            <span>Open on PeakD</span>
                          </a>

                          {onMuteAuthor && (
                            <button
                              type="button"
                              onClick={() => {
                                onMuteAuthor(comment.author);
                                setCommentMenuFeedback(`Muted @${comment.author}`);
                                setTimeout(() => {
                                  setCommentMenuFeedback(null);
                                  setShowCommentMenu(false);
                                }, 1000);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer font-semibold border-t border-slate-100 dark:border-slate-800"
                            >
                              <UserX className="w-3 h-3" />
                              <span>Mute @{comment.author}</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div
            className="text-[13px] sm:text-[14px] text-slate-700 dark:text-slate-200 leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-1 break-words select-text"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />

          {isTruncated && (
            <div className="mt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCommentExpanded(!isCommentExpanded);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition cursor-pointer select-none py-0.5"
              >
                <span>{isCommentExpanded ? 'Show less' : 'Show more'}</span>
                {isCommentExpanded ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            </div>
          )}

          <div className="flex items-center gap-4 sm:gap-5 mt-2.5 pt-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleVote();
              }}
              className={`flex items-center gap-1 text-xs font-semibold transition cursor-pointer ${
                upvoted ? 'text-rose-600' : 'text-slate-400 hover:text-rose-600'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${upvoted ? 'fill-current' : ''}`} />
              <span>{netVotes}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowReplyBox(!showReplyBox);
              }}
              className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-blue-600 transition cursor-pointer"
            >
              <CornerDownRight className="w-3.5 h-3.5" />
              <span>Reply</span>
            </button>

            {/* Translate comment toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleTranslateComment();
              }}
              disabled={isTranslatingComment}
              className={`flex items-center gap-1 text-xs font-semibold transition cursor-pointer ${
                translatedCommentBody
                  ? 'text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-slate-400 hover:text-blue-600'
              }`}
              title={translatedCommentBody ? 'Show original comment text' : 'Translate comment (Free, preserves markdown)'}
            >
              {isTranslatingComment ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
              ) : (
                <Languages className="w-3.5 h-3.5" />
              )}
              <span>{translatedCommentBody ? 'Original' : 'Translate'}</span>
            </button>

            {repliesCount > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAsSnap(comment);
                }}
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 ml-auto transition cursor-pointer bg-blue-50/80 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-2.5 py-0.5 rounded-full"
              >
                <MessageCircle className="w-3 h-3" />
                <span>
                  {repliesCount} {repliesCount === 1 ? 'reply' : 'replies'}
                </span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {showReplyBox && (
            <form
              onSubmit={(e) => {
                e.stopPropagation();
                handleReplySubmit(e);
              }}
              className="mt-2.5 flex gap-2 animate-in fade-in duration-150"
            >
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100"
                autoFocus
              />
              <button
                type="submit"
                disabled={!replyText.trim() || submittingReply}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-xl font-semibold text-xs cursor-pointer shadow-sm"
              >
                Send
              </button>
            </form>
          )}

          <VoteWeightDialog
            open={voteOpen}
            username={currentUser?.username || ''}
            author={comment.author}
            permlink={comment.permlink}
            onClose={() => setVoteOpen(false)}
            onVoted={() => {
              setUpvoted(true);
              setVoteCountDelta(1);
            }}
          />
        </div>
      </div>
    </div>
  );
};

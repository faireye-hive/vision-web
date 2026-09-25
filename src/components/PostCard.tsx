import React, { useState } from 'react';
import {
  ChevronUp,
  Heart,
  Repeat,
  Gift,
  Share2,
  MoreHorizontal,
  Bookmark,
  MessageSquare,
  Loader2,
  Check,
  UserX,
  Hash,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import {
  HivePost,
  calculateReputation,
  getHiveAvatarUrl,
  getPostThumbnail,
  getPostSnippet,
  getRebloggedBy
} from '../services/hiveApi';
import { KeychainService, CurrentUser } from '../services/keychain';

export interface PostCardProps {
  post: HivePost;
  onSelectPost: (post: HivePost, jumpToComments?: boolean) => void;
  onSelectAuthor: (author: string) => void;
  onSelectTag: (tag: string) => void;
  currentUser?: CurrentUser | null;
  onRequireLogin?: () => void;
  onMuteAuthor?: (author: string) => void;
  onBlockWord?: (word: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onSelectPost,
  onSelectAuthor,
  onSelectTag,
  currentUser,
  onRequireLogin,
  onMuteAuthor,
  onBlockWord
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  // Check if current user has already upvoted this post
  const [upvoted, setUpvoted] = useState<boolean>(() => {
    if (currentUser?.username && post.active_votes) {
      return post.active_votes.some(
        v => v.voter.toLowerCase() === currentUser.username.toLowerCase()
      );
    }
    return false;
  });
  const [voteCountDelta, setVoteCountDelta] = useState<number>(0);
  const [isVoting, setIsVoting] = useState<boolean>(false);

  // Check if current user has reblogged this post
  const [hasReblogged, setHasReblogged] = useState<boolean>(() => {
    if (currentUser?.username && post.reblogged_by) {
      return post.reblogged_by.some(u => u.toLowerCase() === currentUser.username.toLowerCase());
    }
    return false;
  });
  const [isReblogging, setIsReblogging] = useState<boolean>(false);
  const [reblogSuccessToast, setReblogSuccessToast] = useState<boolean>(false);

  const [isBookmarked, setIsBookmarked] = useState(() => {
    try {
      const saved = localStorage.getItem('hive_bookmarks') || '[]';
      const parsed = JSON.parse(saved);
      return parsed.includes(`${post.author}/${post.permlink}`);
    } catch {
      return false;
    }
  });

  const rep = calculateReputation(post.author_reputation);
  const avatarUrl = getHiveAvatarUrl(post.author, 'small');
  const thumbnail = getPostThumbnail(post);
  const isComment = Boolean(post.parent_author && post.parent_author.length > 0) || (post.depth !== undefined && post.depth > 0);
  const rebloggedBy = getRebloggedBy(post);
  const snippet = getPostSnippet(post.body, isComment ? 240 : 170);

  // Formatted comment title or post title
  const displayTitle = isComment
    ? (post.title && !post.title.startsWith('Re: re-') && !post.title.startsWith('Re: @')
      ? post.title
      : `Comment on: "${(post.parent_permlink || 'discussion').replace(/[-_]/g, ' ')}"`)
    : post.title;

  // Format relative time like Nebulosa: 19m, 44m, 1h, 2d
  const formatTime = (dateString: string) => {
    try {
      const safeStr = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
      const past = new Date(safeStr).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - past) / 1000));
      if (diffSec < 60) return `${diffSec}s`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h`;
      const diffDays = Math.floor(diffHr / 24);
      return `${diffDays}d`;
    } catch {
      return dateString;
    }
  };

  // Format payout
  const getPayoutDisplay = () => {
    if (post.payout !== undefined && post.payout > 0) {
      return `$ ${post.payout.toFixed(3)}`;
    }
    if (post.pending_payout_value) {
      const num = parseFloat(post.pending_payout_value);
      return `$ ${num.toFixed(3)}`;
    }
    return '$ 0.000';
  };

  const voteCount = Math.max(0, (post.stats?.total_votes || post.active_votes?.length || 0) + voteCountDelta);
  const childrenCount = post.children || 0;

  // Real Keychain voting handler
  const handleUpvote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      else alert('Please connect Hive Keychain in the top menu to vote.');
      return;
    }
    if (isVoting) return;

    setIsVoting(true);
    try {
      // 100% weight = 10000; unvote = 0
      const weight = upvoted ? 0 : 10000;
      const res = await KeychainService.vote(currentUser.username, post.author, post.permlink, weight);
      if (res.success) {
        if (upvoted) {
          setUpvoted(false);
          setVoteCountDelta(prev => prev - 1);
        } else {
          setUpvoted(true);
          setVoteCountDelta(prev => prev + 1);
        }
      } else {
        alert(res.message || res.error || 'Keychain vote was rejected or failed.');
      }
    } catch (err: any) {
      alert(err.message || 'Error broadcasting vote.');
    } finally {
      setIsVoting(false);
    }
  };

  // Real Keychain reblog handler
  const handleReblog = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isComment) return; // Reblog applies to posts
    if (!currentUser) {
      if (onRequireLogin) onRequireLogin();
      else alert('Please connect Hive Keychain in the top menu to reblog.');
      return;
    }
    if (isReblogging || hasReblogged) return;

    const confirmed = window.confirm(`Reblog "@${post.author}/${post.permlink}" to your followers?`);
    if (!confirmed) return;

    setIsReblogging(true);
    try {
      const res = await KeychainService.reblog(currentUser.username, post.author, post.permlink);
      if (res.success) {
        setHasReblogged(true);
        setReblogSuccessToast(true);
        setTimeout(() => setReblogSuccessToast(false), 3000);
      } else {
        alert(res.message || res.error || 'Reblog was not completed in Keychain.');
      }
    } catch (err: any) {
      alert(err.message || 'Reblog request failed.');
    } finally {
      setIsReblogging(false);
    }
  };

  const toggleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    const id = `${post.author}/${post.permlink}`;
    try {
      const saved = localStorage.getItem('hive_bookmarks') || '[]';
      let parsed: string[] = JSON.parse(saved);
      if (parsed.includes(id)) {
        parsed = parsed.filter(item => item !== id);
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

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`https://ecency.com/@${post.author}/${post.permlink}`);
      alert('Post link copied to clipboard!');
    }
  };

  return (
    <article
      id={`post-card-${post.post_id || post.permlink}`}
      onClick={() => onSelectPost(post)}
      className="bg-white rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all duration-200 cursor-pointer mb-4 group"
    >
      {/* Reblog Activity Banner */}
      {!isComment && rebloggedBy && (
        <div className="flex items-center gap-2 mb-3 px-3 py-1.5 rounded-xl bg-purple-50/80 border border-purple-100 text-xs text-purple-900 overflow-hidden">
          <Repeat className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
          <div className="truncate flex-1">
            <span className="text-purple-700">Reblogged by</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectAuthor(rebloggedBy);
              }}
              className="font-bold text-purple-950 hover:underline ml-1 cursor-pointer"
            >
              @{rebloggedBy}
            </button>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100/80 text-purple-800 flex-shrink-0">
            Reblog
          </span>
        </div>
      )}

      {/* Comment Activity Context Banner */}
      {isComment && (
        <div className="flex items-center gap-2 mb-3 px-3 py-1.5 rounded-xl bg-blue-50/80 border border-blue-100 text-xs text-blue-900 overflow-hidden">
          <MessageSquare className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
          <div className="truncate flex-1">
            <span className="font-semibold text-blue-950">@{post.author}</span>
            <span className="text-blue-700 ml-1">commented on</span>
            {post.parent_author && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAuthor(post.parent_author!);
                }}
                className="font-semibold text-blue-900 hover:text-blue-950 hover:underline mx-1 cursor-pointer"
              >
                @{post.parent_author}
              </button>
            )}
            {post.parent_permlink && (
              <span className="text-blue-700/80 text-[11px] truncate hidden sm:inline">
                • <span className="italic font-normal">"{post.parent_permlink.replace(/[-_]/g, ' ')}"</span>
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100/80 text-blue-800 flex-shrink-0">
            Comment
          </span>
        </div>
      )}

      {/* Header: Author avatar, Name, Community, Time */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectAuthor(post.author);
            }}
            className="flex-shrink-0 focus:outline-none"
          >
            <img
              src={avatarUrl}
              alt={post.author}
              loading="lazy"
              className="w-8 h-8 rounded-full bg-gray-100 object-cover hover:opacity-90 transition"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
              }}
            />
          </button>

          <div className="flex items-center gap-1.5 truncate text-xs">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectAuthor(post.author);
              }}
              className="font-bold text-gray-900 hover:text-blue-600 truncate focus:outline-none transition-colors"
            >
              {post.author}
            </button>

            <span className="text-[10px] text-gray-400 font-medium">
              ({rep})
            </span>

            {(post.community_title || post.category) && (
              <>
                <span className="text-gray-400">•</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (post.community) onSelectTag(post.community);
                    else if (post.category) onSelectTag(post.category);
                  }}
                  className="font-medium text-gray-600 hover:text-gray-900 truncate hidden sm:inline"
                >
                  {post.community_title || post.category}
                </button>
              </>
            )}

            <span className="text-gray-400">•</span>
            <span className="text-gray-400 font-normal">
              {formatTime(post.created)}
            </span>
          </div>
        </div>

        <button
          onClick={toggleBookmark}
          className={`p-1.5 rounded-full hover:bg-gray-100 transition ${isBookmarked ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          title={isBookmarked ? 'Bookmarked' : 'Save post'}
        >
          <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Middle Row: Thumbnail on LEFT, Title + Snippet on RIGHT */}
      <div className="flex gap-4 items-start">
        {thumbnail && (
          <div className="flex-shrink-0 w-32 h-20 sm:w-40 sm:h-24 rounded-2xl overflow-hidden bg-gray-100">
            <img
              src={thumbnail}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
            {displayTitle}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 line-clamp-2 leading-relaxed mt-1.5">
            {snippet}
          </p>
        </div>
      </div>

      {/* Footer: Upvote Button, Comments, Reblog, Share, More (payout and like count hidden as requested) */}
      <div className="flex items-center justify-between pt-3.5 mt-3 border-t border-gray-50 text-xs text-gray-500">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">

          {/* Upvote Button (Ecency circle chevron with Keychain vote) */}
          <button
            onClick={handleUpvote}
            disabled={isVoting}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer ${upvoted
                ? 'bg-rose-500 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:text-rose-600 hover:bg-rose-50'
              } disabled:opacity-60`}
            title={upvoted ? 'Upvoted (Click to remove upvote)' : 'Upvote with Hive Keychain'}
          >
            {isVoting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Heart className={`w-3.5 h-3.5 ${upvoted ? 'fill-white text-white' : ''}`} />
            )}
          </button>

          {/* Comments Counter (children from Hive API) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectPost(post, true);
            }}
            className="flex items-center gap-1.5 text-gray-600 hover:text-blue-600 transition group/comm cursor-pointer"
            title={`${childrenCount} comments - click to view and discuss`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-gray-400 group-hover/comm:text-blue-600 transition-colors" />
            <span className="font-semibold text-xs">{childrenCount}</span>
          </button>

          {/* Reblog Button */}
          {!isComment && (
            <button
              type="button"
              onClick={handleReblog}
              disabled={isReblogging || hasReblogged}
              className={`flex items-center gap-1.5 transition cursor-pointer ${
                hasReblogged
                  ? 'text-purple-600 font-bold'
                  : 'text-gray-600 hover:text-purple-600'
              } disabled:cursor-not-allowed`}
              title={hasReblogged ? 'Already reblogged' : 'Reblog with Hive Keychain'}
            >
              {isReblogging ? (
                <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />
              ) : (
                <Repeat className={`w-3.5 h-3.5 ${hasReblogged ? 'text-purple-600' : 'text-gray-400'}`} />
              )}
              <span className="text-xs">{hasReblogged ? 'Reblogged' : 'Reblog'}</span>
            </button>
          )}

          {reblogSuccessToast && (
            <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full animate-in fade-in">
              Reblogged!
            </span>
          )}
        </div>

        {/* Right action icons: Share & More */}
        <div className="flex items-center gap-2 text-gray-400 relative">
          <button
            onClick={handleShare}
            className="p-1 hover:text-gray-600 rounded transition cursor-pointer"
            title="Share post"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMoreMenu(!showMoreMenu);
              }}
              className={`p-1 rounded transition cursor-pointer ${
                showMoreMenu ? 'text-gray-900 bg-gray-100' : 'hover:text-gray-600'
              }`}
              title="More post options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {showMoreMenu && (
              <>
                <div
                  className="fixed inset-0 z-20 cursor-default"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoreMenu(false);
                  }}
                />
                <div
                  className="absolute right-0 bottom-full mb-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-150 py-1.5 z-30 animate-in fade-in zoom-in-95 text-xs text-gray-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onSelectPost(post);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                    <span>Open in Reader</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      handleShare();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <Share2 className="w-3.5 h-3.5 text-gray-500" />
                    <span>Copy Hive Link</span>
                  </button>

                  {onMuteAuthor && (
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        onMuteAuthor(post.author);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer font-semibold border-t border-gray-100"
                      title={`Mute @${post.author} across Feed & Discover`}
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>Mute @{post.author}</span>
                    </button>
                  )}

                  {onBlockWord && post.category && (
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        onBlockWord(post.category);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-amber-50 text-amber-700 flex items-center gap-2 cursor-pointer font-medium"
                      title={`Filter #${post.category} posts`}
                    >
                      <Hash className="w-3.5 h-3.5 text-amber-600" />
                      <span>Filter #{post.category}</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};


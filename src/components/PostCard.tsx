import React, { useState } from 'react';
import {
  ChevronUp,
  Heart,
  Repeat,
  Gift,
  Share2,
  MoreHorizontal,
  Bookmark
} from 'lucide-react';
import {
  HivePost,
  calculateReputation,
  getHiveAvatarUrl,
  getPostThumbnail,
  getPostSnippet
} from '../services/hiveApi';

interface PostCardProps {
  post: HivePost;
  onSelectPost: (post: HivePost) => void;
  onSelectAuthor: (author: string) => void;
  onSelectTag: (tag: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onSelectPost,
  onSelectAuthor,
  onSelectTag
}) => {
  const [upvoted, setUpvoted] = useState(false);
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
  const snippet = getPostSnippet(post.body, 170);

  // Format relative time like Nebulosa: 19m, 44m, 1h, 2d
  const formatTime = (dateString: string) => {
    try {
      const past = new Date(dateString + 'Z').getTime();
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

  const voteCount = (post.stats?.total_votes || post.active_votes?.length || 0) + (upvoted ? 1 : 0);
  const childrenCount = post.children || 0;

  const handleUpvote = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUpvoted(!upvoted);
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
            {post.title}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 line-clamp-2 leading-relaxed mt-1.5">
            {snippet}
          </p>
        </div>
      </div>

      {/* Footer: Chevron Upvote, Payout, Heart/Votes, Reblog, Gift, Share, More */}
      <div className="flex items-center justify-between pt-3.5 mt-3 border-t border-gray-50 text-xs text-gray-500">
        <div className="flex items-center gap-3 sm:gap-4">

          {/* Upvote Button (Ecency circle chevron) */}
          <button
            onClick={handleUpvote}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition ${upvoted
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:text-blue-600 hover:bg-blue-50'
              }`}
            title="Upvote post"
          >
            <ChevronUp className="w-4 h-4" />
          </button>

          {/* Payout */}
          <span className="font-semibold text-gray-800">
            {getPayoutDisplay()}
          </span>

          {/* Heart / Votes */}
          <span className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900">
            <Heart className={`w-3.5 h-3.5 ${upvoted ? 'text-rose-500 fill-rose-500' : 'text-gray-400'}`} />
            <span>{voteCount}</span>
          </span>

          {/* Reblog */}
          <span className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900">
            <Repeat className="w-3.5 h-3.5 text-gray-400" />
            <span>{Math.max(1, Math.floor(childrenCount / 3))}</span>
          </span>

          {/* Gift */}
          <span className="hidden sm:flex items-center gap-1.5 text-gray-600 hover:text-gray-900">
            <Gift className="w-3.5 h-3.5 text-gray-400" />
            <span>{Math.max(1, Math.floor(voteCount / 10))}</span>
          </span>
        </div>

        {/* Right action icons: Share & More */}
        <div className="flex items-center gap-2 text-gray-400">
          <button
            onClick={handleShare}
            className="p-1 hover:text-gray-600 rounded transition"
            title="Share post"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectPost(post);
            }}
            className="p-1 hover:text-gray-600 rounded transition"
            title="More options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
};


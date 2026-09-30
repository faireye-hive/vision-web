import React, { useState } from 'react';
import {
  FileText,
  MessageSquare,
  Reply,
  AtSign,
  History,
  X,
  Heart,
  ExternalLink,
  Rss
} from 'lucide-react';
import { HivePost, getHiveAvatarUrl, getPostThumbnail, getPostSnippet } from '../../../services/hiveApi';
import { ProfileCustomStyle, BORDER_RADIUS_CLASSES } from '../profileStyleTypes';
import { getSmartTextColors } from '../profileColorUtils';
import { ProfileReplies, ProfileMentions } from '../../../components/ProfileInbox';
import { extractPostTags, isNoiseTag } from '../../../utils/postTags';
import { KeychainService } from '../../../services/keychain';
import { useAuth } from '../../../context/AuthContext';
import { VoteWeightDialog } from '../../../components/VoteWeightDialog';

export type ProfileTab = 'blog' | 'posts' | 'comments' | 'replies' | 'mentions' | 'history';

interface ProfileFeedSectionProps {
  currentUser: string;
  activeTab: ProfileTab;
  setActiveTab: (tab: ProfileTab) => void;
  posts: HivePost[];
  comments: HivePost[];
  history: any[];
  loadingMore: boolean;
  onLoadMore: () => void;
  selectedTag: string | null;
  onClearTagFilter: () => void;
  selectedTopic: string | null;
  onClearTopicFilter: () => void;
  onSelectPost: (post: HivePost) => void;
  onSelectTag: (tag: string) => void;
  style: ProfileCustomStyle;
}

export const ProfileFeedSection: React.FC<ProfileFeedSectionProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  posts,
  comments,
  history,
  loadingMore,
  onLoadMore,
  selectedTag,
  onClearTagFilter,
  selectedTopic,
  onClearTopicFilter,
  onSelectPost,
  onSelectTag,
  style
}) => {
  const roundedClass = BORDER_RADIUS_CLASSES[style.borderRadius];

  const cardStyleClass =
    style.cardStyle === 'glass'
      ? 'bg-white/75 dark:bg-slate-900/75 backdrop-blur-md border border-white/50 dark:border-slate-800/80 shadow-md'
      : style.cardStyle === 'outline'
      ? 'bg-transparent border-2 border-gray-200 dark:border-slate-800'
      : 'bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-xs';

  const displayedPosts = posts.filter((post) => {
    if (selectedTag) {
      const json = post.json_metadata;
      let tags: string[] = [];
      try {
        const parsed = typeof json === 'string' ? JSON.parse(json) : json;
        if (Array.isArray(parsed?.tags)) tags = parsed.tags;
      } catch {
        // Ignore
      }
      if (!tags.map((t) => t.toLowerCase()).includes(selectedTag.toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  // Grid container class based on postsLayout.feedView
  const feedContainerClass = {
    list: 'space-y-3',
    'grid-2': 'grid grid-cols-1 md:grid-cols-2 gap-4',
    'grid-3': 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
    magazine: 'space-y-4',
    compact: 'space-y-2'
  }[style.postsLayout?.feedView || 'list'];

  const smartColors = getSmartTextColors(style.textColor, style.textSecondaryColor, style.cardBackgroundColor);

  const tabCustomStyle: React.CSSProperties = {
    backgroundColor: style.cardBackgroundColor || undefined,
    color: smartColors.textColor || undefined,
    borderColor: style.cardBackgroundColor ? `${style.accentColor}33` : undefined
  };

  return (
    <div className="space-y-4">
      {/* Tab Selector & Filter Status Bar */}
      <div
        style={tabCustomStyle}
        className={`${cardStyleClass} ${roundedClass} p-2 px-4 transition-all duration-200`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 sm:gap-3 overflow-x-auto pb-1 max-w-full">
            <button
              type="button"
              onClick={() => setActiveTab('blog')}
              className={`inline-flex items-center gap-1.5 text-xs font-bold py-2 px-2.5 rounded-xl transition cursor-pointer ${
                activeTab === 'blog'
                  ? 'text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              style={activeTab === 'blog' ? { backgroundColor: style.accentColor } : undefined}
            >
              <Rss className="w-4 h-4" />
              <span>Blog</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('posts')}
              className={`inline-flex items-center gap-1.5 text-xs font-bold py-2 px-2.5 rounded-xl transition cursor-pointer ${
                activeTab === 'posts'
                  ? 'text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              style={activeTab === 'posts' ? { backgroundColor: style.accentColor } : undefined}
            >
              <FileText className="w-4 h-4" />
              <span>Posts ({posts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('comments')}
              className={`inline-flex items-center gap-1.5 text-xs font-bold py-2 px-2.5 rounded-xl transition cursor-pointer ${
                activeTab === 'comments'
                  ? 'text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              style={activeTab === 'comments' ? { backgroundColor: style.accentColor } : undefined}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Comments</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('replies')}
              className={`inline-flex items-center gap-1.5 text-xs font-bold py-2 px-2.5 rounded-xl transition cursor-pointer ${
                activeTab === 'replies'
                  ? 'text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              style={activeTab === 'replies' ? { backgroundColor: style.accentColor } : undefined}
            >
              <Reply className="w-4 h-4" />
              <span>Replies</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('mentions')}
              className={`inline-flex items-center gap-1.5 text-xs font-bold py-2 px-2.5 rounded-xl transition cursor-pointer ${
                activeTab === 'mentions'
                  ? 'text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              style={activeTab === 'mentions' ? { backgroundColor: style.accentColor } : undefined}
            >
              <AtSign className="w-4 h-4" />
              <span>Mentions</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`inline-flex items-center gap-1.5 text-xs font-bold py-2 px-2.5 rounded-xl transition cursor-pointer ${
                activeTab === 'history'
                  ? 'text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              style={activeTab === 'history' ? { backgroundColor: style.accentColor } : undefined}
            >
              <History className="w-4 h-4" />
              <span>History</span>
            </button>
          </div>

          {/* Active Tag or Topic Filter badge */}
          {(selectedTag || selectedTopic) && (
            <div className="flex items-center gap-2">
              {selectedTag && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full text-white"
                  style={{ backgroundColor: style.accentColor }}
                >
                  #{selectedTag}
                  <button type="button" onClick={onClearTagFilter} className="cursor-pointer">
                    <X className="w-3 h-3 hover:opacity-80" />
                  </button>
                </span>
              )}
              {selectedTopic && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full text-white"
                  style={{ backgroundColor: style.accentColor }}
                >
                  {selectedTopic}
                  <button type="button" onClick={onClearTopicFilter} className="cursor-pointer">
                    <X className="w-3 h-3 hover:opacity-80" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Posts Tab */}
      {activeTab === 'posts' && (
        <div className="space-y-4">
          {displayedPosts.length === 0 ? (
            <div className={`${cardStyleClass} ${roundedClass} p-12 text-center text-xs text-gray-500 dark:text-slate-400`}>
              No posts found for this user or tag filter.
            </div>
          ) : (
            <div className={feedContainerClass}>
              {displayedPosts.map((post) => (
                <CustomProfilePostCard
                  key={`${post.author}/${post.permlink}`}
                  post={post}
                  onOpen={() => onSelectPost(post)}
                  onTag={onSelectTag}
                  style={style}
                />
              ))}
            </div>
          )}

          {posts.length >= 20 && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="px-6 py-2 rounded-full border border-gray-200 dark:border-slate-800 text-xs font-bold text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer"
                style={{ borderRadius: style.borderRadius === 'none' ? '0' : '9999px' }}
              >
                {loadingMore ? 'Loading...' : 'Load more posts'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Comments Tab */}
      {activeTab === 'comments' && (
        <div className="space-y-3">
          {comments.length === 0 ? (
            <div className={`${cardStyleClass} ${roundedClass} p-12 text-center text-xs text-gray-500 dark:text-slate-400`}>
              No comments published by this account yet.
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={`${comment.author}/${comment.permlink}`}
                onClick={() => onSelectPost(comment)}
                className={`${cardStyleClass} ${roundedClass} p-4 hover:border-blue-400 dark:hover:border-blue-500 transition cursor-pointer`}
              >
                <div className="flex items-center gap-2 mb-1.5 text-xs text-gray-400">
                  <span className="font-semibold text-gray-700 dark:text-slate-300">
                    Replying to @{comment.parent_author}
                  </span>
                  <span>•</span>
                  <span>{new Date(`${comment.created}Z`).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-gray-800 dark:text-slate-200 line-clamp-3 leading-relaxed">
                  {comment.body}
                </p>
              </div>
            ))
          )}

          {comments.length >= 20 && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="px-6 py-2 rounded-full border border-gray-200 dark:border-slate-800 text-xs font-bold text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                {loadingMore ? 'Loading...' : 'Load more comments'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Replies Tab */}
      {activeTab === 'replies' && (
        <ProfileReplies username={currentUser} onOpenPost={onSelectPost} />
      )}

      {/* Mentions Tab */}
      {activeTab === 'mentions' && (
        <ProfileMentions username={currentUser} onOpenPost={onSelectPost} />
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className={`${cardStyleClass} ${roundedClass} divide-y divide-gray-100 dark:divide-slate-800 overflow-hidden`}>
          {history.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-400">
              No recent blockchain operations found.
            </div>
          ) : (
            history.map((entry, index) => {
              const item = Array.isArray(entry) ? entry[1] : entry;
              const opType = item?.op?.[0] || 'operation';
              const opData = item?.op?.[1] || {};
              const detail =
                opType === 'vote'
                  ? `voted @${opData.author}/${opData.permlink}`
                  : opType === 'transfer'
                  ? `sent ${opData.amount} to @${opData.to}`
                  : opType === 'comment'
                  ? `published ${opData.permlink}`
                  : opType === 'claim_reward_balance'
                  ? 'claimed rewards'
                  : '';

              const uniqueKey = `history-${item?.trx_id || item?.timestamp || 'time'}-${opType}-${index}`;

              return (
                <div key={uniqueKey} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex items-center gap-2">
                    <span
                      className="font-mono uppercase text-[10px] px-2 py-0.5 rounded font-bold"
                      style={{
                        backgroundColor: `${style.accentColor}15`,
                        color: style.accentColor
                      }}
                    >
                      {opType}
                    </span>
                    <span className="text-gray-700 dark:text-slate-300 truncate">{detail}</span>
                  </div>
                  <span className="text-gray-400 text-[11px] flex-shrink-0">
                    {item?.timestamp ? new Date(`${item.timestamp}Z`).toLocaleString() : ''}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Fully Customizable Post Card
 * Honors: imagePosition (top, right, left, hidden), titlePosition (above, below),
 * showSnippet, snippetLines, votePosition (bottom, top-right, hidden), showTags, and showPayout.
 */
function ClassicProfilePostCard({
  post,
  onOpen,
  onTag,
  style
}: {
  post: HivePost;
  onOpen: () => void;
  onTag: (tag: string) => void;
  style: ProfileCustomStyle;
}) {
  const { currentUser: authUser } = useAuth();
  const [voteDialogOpen, setVoteDialogOpen] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  const thumb = getPostThumbnail(post);
  const tags = extractPostTags(post).filter((tag) => !isNoiseTag(tag)).slice(0, 5);
  const payout = post.pending_payout_value || (post.is_paidout ? 'paid' : '0.000 HBD');

  const { postsLayout } = style;
  const roundedClass = BORDER_RADIUS_CLASSES[style.borderRadius];
  const smartCardColors = getSmartTextColors(style.textColor, style.textSecondaryColor, style.cardBackgroundColor);

  const cardStyleClass =
    style.cardStyle === 'glass'
      ? 'bg-white/75 dark:bg-slate-900/75 backdrop-blur-md border border-white/50 dark:border-slate-800/80 shadow-md'
      : style.cardStyle === 'outline'
      ? 'bg-transparent border-2 border-gray-200 dark:border-slate-800'
      : 'bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-xs';

  const imageAspectClass = {
    '16/9': 'aspect-video',
    '4/3': 'aspect-4/3',
    '1/1': 'aspect-square',
    wide: 'aspect-21/9'
  }[postsLayout.imageRatio || '16/9'];

  const lineClampClass = {
    1: 'line-clamp-1',
    2: 'line-clamp-2',
    3: 'line-clamp-3',
    4: 'line-clamp-4'
  }[postsLayout.snippetLines || 2];

  const showImage = postsLayout.imagePosition !== 'hidden' && Boolean(thumb);

  // Render elements
  const TitleElement = (
    <button type="button" onClick={onOpen} className="text-left group cursor-pointer block w-full">
      <h3
        style={{ color: smartCardColors.textColor || undefined }}
        className={`font-extrabold text-gray-900 dark:text-white leading-snug transition group-hover:opacity-80 ${
          postsLayout.feedView === 'magazine'
            ? 'text-xl sm:text-2xl'
            : postsLayout.feedView === 'compact'
            ? 'text-sm'
            : 'text-base sm:text-lg'
        }`}
      >
        {post.title || 'Untitled Post'}
      </h3>
    </button>
  );

  const ImageElement = showImage && (
    <button
      type="button"
      onClick={onOpen}
      className={`overflow-hidden rounded-2xl block bg-gray-100 dark:bg-slate-800 flex-shrink-0 cursor-pointer group ${
        postsLayout.imagePosition === 'top'
          ? `w-full ${imageAspectClass}`
          : 'w-28 sm:w-36 h-24 sm:h-28'
      }`}
    >
      <img
        src={thumb!}
        alt=""
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    </button>
  );

  const SnippetElement = postsLayout.showSnippet && (
    <p
      style={{ color: style.textSecondaryColor || undefined }}
      className={`text-xs sm:text-sm leading-relaxed text-gray-600 dark:text-slate-300 ${lineClampClass}`}
    >
      {getPostSnippet(post.body, 220)}
    </p>
  );

  const MetadataElement = (
    <div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-xs">
      {postsLayout.showTags &&
        tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTag(tag);
            }}
            className="text-[11px] font-semibold px-2 py-0.5 rounded-md transition cursor-pointer"
            style={{
              backgroundColor: `${style.accentColor}18`,
              color: style.accentColor
            }}
          >
            #{tag}
          </button>
        ))}

      <span
        style={{ color: style.textSecondaryColor || undefined }}
        className="text-[11px] text-gray-400 flex items-center gap-1 ml-auto"
      >
        <MessageSquare className="w-3 h-3" />
        {post.children || 0}
      </span>

      {postsLayout.showPayout && payout && (
        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-md">
          {payout}
        </span>
      )}

      {postsLayout.votePosition === 'bottom' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!authUser) {
              window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
              return;
            }
            setVoteDialogOpen(true);
          }}
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
            hasVoted
              ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/50'
              : 'text-gray-500 hover:text-rose-600 bg-gray-100 dark:bg-slate-800'
          }`}
        >
          <Heart className={`w-3 h-3 ${hasVoted ? 'fill-current' : ''}`} />
          <span>{hasVoted ? 'Voted' : 'Vote'}</span>
        </button>
      )}
    </div>
  );

  const postCardCustomStyle: React.CSSProperties = {
    backgroundColor: style.cardBackgroundColor || undefined,
    color: smartCardColors.textColor || undefined,
    borderColor: style.cardBackgroundColor ? `${style.accentColor}33` : undefined
  };

  return (
    <article
      style={postCardCustomStyle}
      className={`${cardStyleClass} ${roundedClass} p-5 relative transition-all duration-200 hover:border-gray-300 dark:hover:border-slate-700 flex flex-col justify-between`}
    >
      {/* Top Author and Top-Right Vote Button */}
      <div className="flex items-center justify-between gap-2.5 mb-3">
        <div className="flex items-center gap-2 text-xs">
          <img
            src={getHiveAvatarUrl(post.author, 'small')}
            alt=""
            className="w-6 h-6 rounded-full object-cover bg-gray-100"
          />
          <span
            style={{ color: style.textColor || undefined }}
            className="font-bold text-gray-800 dark:text-slate-200"
          >
            @{post.author}
          </span>
          <span className="text-gray-400">•</span>
          <span
            style={{ color: style.textSecondaryColor || undefined }}
            className="text-gray-400 text-[11px]"
          >
            {post.created ? new Date(`${post.created}Z`).toLocaleDateString() : ''}
          </span>
        </div>

        {postsLayout.votePosition === 'top-right' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!authUser) {
                window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
                return;
              }
              setVoteDialogOpen(true);
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
              hasVoted
                ? 'text-white bg-rose-600'
                : 'text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${hasVoted ? 'fill-current' : ''}`} />
            <span>{hasVoted ? 'Voted' : 'Vote'}</span>
          </button>
        )}
      </div>

      {/* Main Body Layout */}
      {postsLayout.imagePosition === 'top' ? (
        /* Image Top Layout (Magazine / Gallery / Bento) */
        <div className="space-y-3">
          {postsLayout.titlePosition === 'above-image' && TitleElement}
          {ImageElement}
          {postsLayout.titlePosition === 'below-image' && TitleElement}
          {SnippetElement}
          {MetadataElement}
        </div>
      ) : postsLayout.imagePosition === 'left' ? (
        /* Image Left Layout */
        <div className="flex gap-4 items-start">
          {ImageElement}
          <div className="min-w-0 flex-1 space-y-2">
            {TitleElement}
            {SnippetElement}
            {MetadataElement}
          </div>
        </div>
      ) : (
        /* Image Right or Hidden Layout (Default) */
        <div className="flex gap-4 items-start">
          <div className="min-w-0 flex-1 space-y-2">
            {TitleElement}
            {SnippetElement}
            {MetadataElement}
          </div>
          {ImageElement}
        </div>
      )}

      {/* Vote Dialog */}
      <VoteWeightDialog
        open={voteDialogOpen}
        username={authUser?.username || ''}
        author={post.author}
        permlink={post.permlink}
        onClose={() => setVoteDialogOpen(false)}
        onVoted={() => setHasVoted(true)}
      />
    </article>
  );
}

/**
 * Visual presets for the profile feed.
 * list      -> legacy/original card
 * magazine  -> new editorial card
 * compact   -> dense minimal card
 * grid-2    -> split/newsroom card
 * grid-3    -> visual gallery card
 *
 * Presentation only: post data, callbacks, API usage and actions are unchanged.
 */
function CustomProfilePostCard({
  post,
  onOpen,
  onTag,
  style
}: {
  post: HivePost;
  onOpen: () => void;
  onTag: (tag: string) => void;
  style: ProfileCustomStyle;
}) {
  const { currentUser: authUser } = useAuth();
  const [voteDialogOpen, setVoteDialogOpen] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  const thumb = getPostThumbnail(post);
  const tags = extractPostTags(post).filter((tag) => !isNoiseTag(tag)).slice(0, 5);
  const payout = post.pending_payout_value || (post.is_paidout ? 'paid' : '0.000 HBD');

  const { postsLayout } = style;
  const designMode = postsLayout?.feedView || 'list';

  // list = legacy/original card. Other values are independent visual presets.
  if (designMode === 'list') {
    return (
      <ClassicProfilePostCard
        post={post}
        onOpen={onOpen}
        onTag={onTag}
        style={style}
      />
    );
  }

  const roundedClass = BORDER_RADIUS_CLASSES[style.borderRadius];
  const smartCardColors = getSmartTextColors(style.textColor, style.textSecondaryColor, style.cardBackgroundColor);

  const cardStyleClass =
    style.cardStyle === 'glass'
      ? 'bg-white/75 dark:bg-slate-900/75 backdrop-blur-md border border-white/50 dark:border-slate-800/80 shadow-md'
      : style.cardStyle === 'outline'
      ? 'bg-transparent border-2 border-gray-200 dark:border-slate-800'
      : 'bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-xs';

  const imageAspectClass = {
    '16/9': 'aspect-video',
    '4/3': 'aspect-4/3',
    '1/1': 'aspect-square',
    wide: 'aspect-21/9'
  }[postsLayout.imageRatio || '16/9'];

  const lineClampClass = {
    1: 'line-clamp-1',
    2: 'line-clamp-2',
    3: 'line-clamp-3',
    4: 'line-clamp-4'
  }[postsLayout.snippetLines || 2];

  const showImage = postsLayout.imagePosition !== 'hidden' && Boolean(thumb);

  // Render elements
  const TitleElement = (
    <button type="button" onClick={onOpen} className="text-left group cursor-pointer block w-full">
      <h3
        style={{ color: smartCardColors.textColor || undefined }}
        className={`font-extrabold text-gray-900 dark:text-white leading-snug transition group-hover:opacity-80 ${
          designMode === 'magazine'
            ? 'text-xl sm:text-2xl tracking-tight'
            : designMode === 'compact'
            ? 'text-sm'
            : designMode === 'grid-3'
            ? 'text-sm sm:text-base'
            : 'text-base sm:text-lg'
        }`}
      >
        {post.title || 'Untitled Post'}
      </h3>
    </button>
  );

  const ImageElement = showImage && (
    <button
      type="button"
      onClick={onOpen}
      className={`overflow-hidden rounded-2xl block bg-gray-100 dark:bg-slate-800 flex-shrink-0 cursor-pointer group ${
        postsLayout.imagePosition === 'top'
          ? `w-full ${imageAspectClass}`
          : designMode === 'compact'
          ? 'w-24 sm:w-28 h-20 sm:h-24'
          : designMode === 'grid-3'
          ? 'w-24 h-24 sm:w-28 sm:h-28'
          : 'w-28 sm:w-36 h-24 sm:h-28'
      }`}
    >
      <img
        src={thumb!}
        alt=""
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    </button>
  );

  const SnippetElement = postsLayout.showSnippet && (
    <p
      style={{ color: style.textSecondaryColor || undefined }}
      className={`text-xs sm:text-sm leading-relaxed text-gray-600 dark:text-slate-300 ${lineClampClass}`}
    >
      {getPostSnippet(post.body, 220)}
    </p>
  );

  const MetadataElement = (
    <div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-xs">
      {postsLayout.showTags &&
        tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTag(tag);
            }}
            className="text-[11px] font-semibold px-2 py-0.5 rounded-md transition cursor-pointer"
            style={{
              backgroundColor: `${style.accentColor}18`,
              color: style.accentColor
            }}
          >
            #{tag}
          </button>
        ))}

      <span
        style={{ color: style.textSecondaryColor || undefined }}
        className="text-[11px] text-gray-400 flex items-center gap-1 ml-auto"
      >
        <MessageSquare className="w-3 h-3" />
        {post.children || 0}
      </span>

      {postsLayout.showPayout && payout && (
        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-md">
          {payout}
        </span>
      )}

      {postsLayout.votePosition === 'bottom' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!authUser) {
              window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
              return;
            }
            setVoteDialogOpen(true);
          }}
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
            hasVoted
              ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/50'
              : 'text-gray-500 hover:text-rose-600 bg-gray-100 dark:bg-slate-800'
          }`}
        >
          <Heart className={`w-3 h-3 ${hasVoted ? 'fill-current' : ''}`} />
          <span>{hasVoted ? 'Voted' : 'Vote'}</span>
        </button>
      )}
    </div>
  );

  const postCardCustomStyle: React.CSSProperties = {
    backgroundColor: style.cardBackgroundColor || undefined,
    color: smartCardColors.textColor || undefined,
    borderColor: style.cardBackgroundColor ? `${style.accentColor}33` : undefined
  };

  return (
    <article
      style={postCardCustomStyle}
      className={`${cardStyleClass} ${roundedClass} group relative overflow-hidden p-0 transition-all duration-300 ${
        designMode === 'compact'
          ? 'hover:shadow-[0_6px_18px_rgba(15,23,42,0.06)]'
          : designMode === 'grid-3'
          ? 'hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.09)]'
          : 'hover:-translate-y-[1px] hover:shadow-[0_12px_35px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_12px_35px_rgba(0,0,0,0.22)]'
      }`}
    >
      {designMode === 'magazine' && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 opacity-80"
          style={{ backgroundColor: style.accentColor }}
        />
      )}

      <div className={designMode === 'compact' ? 'p-3' : designMode === 'grid-3' ? 'p-3' : 'p-3.5 sm:p-4'}>
        {/* Compact author row */}
        <div className={`flex items-center justify-between gap-3 ${designMode === 'compact' ? 'mb-2' : 'mb-3'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={getHiveAvatarUrl(post.author, 'small')}
              alt=""
              loading="lazy"
              className="w-7 h-7 rounded-full object-cover bg-gray-100 dark:bg-slate-800 ring-2 ring-white/80 dark:ring-slate-900/80"
            />

            <div className="min-w-0 flex items-center gap-1.5 text-xs">
              <span
                style={{ color: style.textColor || undefined }}
                className="font-bold truncate"
              >
                @{post.author}
              </span>

              <span className="text-gray-300 dark:text-slate-600">•</span>

              <span
                style={{ color: style.textSecondaryColor || undefined }}
                className="text-[11px] whitespace-nowrap"
              >
                {post.created ? new Date(`${post.created}Z`).toLocaleDateString() : ''}
              </span>
            </div>
          </div>

          {postsLayout.votePosition === 'top-right' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!authUser) {
                  window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
                  return;
                }
                setVoteDialogOpen(true);
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                hasVoted
                  ? 'text-white bg-rose-500 shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 bg-gray-100/80 dark:bg-slate-800/80 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${hasVoted ? 'fill-current' : ''}`} />
              <span>{hasVoted ? 'Voted' : 'Vote'}</span>
            </button>
          )}
        </div>

        {postsLayout.imagePosition === 'top' || designMode === 'grid-3' ? (
          <div className="space-y-3.5">
            {postsLayout.titlePosition === 'above-image' && TitleElement}

            {showImage && (
              <div className="relative">
                {ImageElement}
                {tags[0] && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTag(tags[0]);
                    }}
                    className="absolute left-3 bottom-3 max-w-[calc(100%-24px)] truncate rounded-full px-3 py-1 text-[10px] font-bold text-white bg-slate-950/70 backdrop-blur-sm border border-white/15 cursor-pointer hover:bg-slate-950/85 transition"
                  >
                    #{tags[0]}
                  </button>
                )}
              </div>
            )}

            {postsLayout.titlePosition === 'below-image' && TitleElement}
            {SnippetElement}
            {MetadataElement}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-stretch">
            {postsLayout.imagePosition === 'left' && showImage && (
              <div className="relative flex-shrink-0">
                {ImageElement}
                {tags[0] && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTag(tags[0]);
                    }}
                    className="absolute left-2.5 bottom-2.5 max-w-[calc(100%-20px)] truncate rounded-full px-2.5 py-1 text-[10px] font-bold text-white bg-slate-950/70 backdrop-blur-sm border border-white/15 cursor-pointer hover:bg-slate-950/85 transition"
                  >
                    #{tags[0]}
                  </button>
                )}
              </div>
            )}

            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  {TitleElement}
                  {SnippetElement}
                </div>

                {postsLayout.imagePosition !== 'left' && showImage && (
                  <div className="relative shrink-0">
                    {ImageElement}
                    {tags[0] && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTag(tags[0]);
                        }}
                        className="absolute left-2.5 bottom-2.5 max-w-[calc(100%-20px)] truncate rounded-full px-2.5 py-1 text-[10px] font-bold text-white bg-slate-950/70 backdrop-blur-sm border border-white/15 cursor-pointer hover:bg-slate-950/85 transition"
                      >
                        #{tags[0]}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3">
                {MetadataElement}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vote dialog remains unchanged functionally */}
      <VoteWeightDialog
        open={voteDialogOpen}
        username={authUser?.username || ''}
        author={post.author}
        permlink={post.permlink}
        onClose={() => setVoteDialogOpen(false)}
        onVoted={() => setHasVoted(true)}
      />
    </article>
  );
}

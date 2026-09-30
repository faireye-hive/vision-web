import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, 
  MapPin, 
  Link as LinkIcon, 
  Calendar,
  Heart,
  MessageCircle,
  Repeat,
  Loader2,
  FileText,
  MessageSquare,
  Undo2,
  AtSign,
  Activity,
  UserPlus,
  UserMinus,
  PenLine,
  Volume2,
  VolumeX,
  Send,
  Rss,
  ExternalLink
} from 'lucide-react';
import { ProfileTheme, ThemeProps } from './themeTypes';
import { getHiveAvatarUrl, getPostThumbnail, getPostSnippet, HivePost } from '../../../services/hiveApi';
import { DEFAULT_PROFILE_STYLE } from '../profileStyleTypes';
import { useNavigation } from '../../../context/NavigationContext';
import { getSafeImageUrl } from '../../../utils/sanitize';

/**
 * THEME: Clean Slate (Default)
 * Replicates the modern, clean interface with integrated banner info,
 * left sidebar stats, card-based feed layout, infinite scroll,
 * reblog indicators, and inline comment replies.
 */

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const ThemeHeader: React.FC<ThemeProps> = (props) => {
  const { account, profile, reputation, isOwner, isFollowing, onFollowToggle, isMuted, onMuteToggle, onOpenCustomizer } = props;
  const metaProfile = profile?.metadata?.profile || {};
  const coverImage = metaProfile.cover_image ? getSafeImageUrl(metaProfile.cover_image, { width: 1400 }) : null;
  const avatarUrl = getHiveAvatarUrl(account?.name || '', 'large');

  return (
    <div className="relative mb-6">
      {/* Banner / Cover Section */}
      <div 
        className="w-full bg-slate-900 overflow-hidden relative shadow-2xl min-h-[200px] sm:min-h-[220px]"
        style={{ borderRadius: '15px' }}
      >
        {coverImage ? (
          <img 
            src={coverImage} 
            className="w-full h-full object-cover opacity-80 absolute inset-0" 
            alt="Cover" 
            style={{ 
              borderRadius: '15px', 
              borderStyle: 'solid', 
              borderColor: '#5c629d', 
              borderWidth: '1px'
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 absolute inset-0" />
        )}
        
        {/* Banner Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Name and Username inside banner */}
        <div 
          className="absolute bottom-4 sm:bottom-10 left-32 xs:left-36 sm:left-60 max-w-[calc(100%-140px)] sm:max-w-none z-10"
          style={{
            marginTop: '2px',
            marginLeft: '-59px',
            marginBottom: '23px'
          }}
        >
           <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight drop-shadow-lg truncate max-w-full">
                {metaProfile.name || account?.name}
              </h1>
              <div className="flex items-center gap-1.5 bg-blue-500/90 backdrop-blur-md px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-white text-[10px] sm:text-xs font-black shadow-lg shrink-0">
                 <Activity className="w-3 h-3" />
                 <span>{reputation}</span>
              </div>
           </div>
           <p className="text-white/80 font-bold text-xs sm:text-lg mt-0.5 sm:mt-1 tracking-wide truncate">
             @{account?.name}
           </p>
        </div>

        {/* Avatar overlapping bottom of banner */}
        <div className="absolute top-5 sm:top-10 left-4 sm:left-12 z-20">
           <div className="relative group/avatar">
                 {/* Main container with adaptive dimensions */}
                 <div className="w-[90px] h-[90px] sm:w-[120px] sm:h-[120px] rounded-full border-4 border-[#0a0f1d] overflow-hidden bg-slate-800 shadow-md">
                    <img 
                      src={avatarUrl} 
                      className="w-full h-full object-cover" 
                      alt="Avatar" 
                    />
                 </div>
              {/* Status dot */}
              <div className="absolute bottom-1 right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500 border-2 border-[#0a0f1d] shadow-lg" />
           </div>
        </div>

        {/* Action Buttons bottom right */}
        <div className="absolute bottom-4 sm:bottom-10 right-3 sm:right-8 flex items-center gap-2 sm:gap-3 z-20">
           {isOwner ? (
             <button 
                onClick={onOpenCustomizer}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold text-xs sm:text-sm transition-all shadow-xl active:scale-95 cursor-pointer"
             >
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Customize Profile</span>
                <span className="sm:hidden">Customize</span>
             </button>
           ) : (
             <>
               {/* Follow / Unfollow */}
               <button 
                  onClick={onFollowToggle}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3.5 py-1.5 sm:px-6 sm:py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all shadow-xl active:scale-95 cursor-pointer ${
                    isFollowing 
                    ? 'bg-white/10 text-white hover:bg-rose-500/50 backdrop-blur-md border border-white/20' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
               >
                  {isFollowing ? <UserMinus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  <span>{isFollowing ? 'Following' : 'Follow'}</span>
               </button>

               {/* Mute / Unmute */}
               {onMuteToggle && (
                 <button 
                    onClick={onMuteToggle}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-xl active:scale-95 cursor-pointer ${
                      isMuted 
                      ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/40 border border-rose-500/40 backdrop-blur-md' 
                      : 'bg-white/10 text-white hover:bg-rose-500/30 backdrop-blur-md border border-white/20'
                    }`}
                    title={isMuted ? 'Unmute this account' : 'Mute this account on Hive'}
                 >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                    <span>{isMuted ? 'Muted' : 'Mute'}</span>
                 </button>
               )}
             </>
           )}
        </div>
      </div>
    </div>
  );
};

const ThemeSidebar: React.FC<ThemeProps> = (props) => {
  const { profile, followerCount, followingCount, postCount, account } = props;
  const metaProfile = profile?.metadata?.profile || {};

  return (
    <div className="space-y-6 pt-4 sm:pt-20">
      {/* About Box */}
      <div 
        className="bg-white dark:bg-[#161b2e] border border-gray-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm w-full max-w-[420px]"
        style={{ paddingTop: '0px', minHeight: '380px', borderRadius: '15px' }}
      >
        <h3 
          className="font-black text-gray-500 dark:text-slate-300 uppercase tracking-[0.2em]"
          style={{ marginTop: '16px', marginBottom: '10px', marginLeft: '0px', marginRight: '0px', fontSize: '15px' }}
        >
          About
        </h3>
        <p 
          className="text-gray-700 dark:text-slate-200 font-medium leading-relaxed mb-6"
          style={{ marginBottom: '0px', marginTop: '-6px' }}
        >
          {metaProfile.about || "No bio available."}
        </p>

        <div className="space-y-4" style={{ marginTop: '17px' }}>
          <div className="flex items-center gap-4 text-sm font-bold text-gray-600 dark:text-slate-300" style={{ marginBottom: '5px' }}>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            </div>
            <span>{metaProfile.location || "Earth"}</span>
          </div>
          
          {metaProfile.website && (
            <a 
              href={String(metaProfile.website).startsWith('http') ? String(metaProfile.website) : `https://${String(metaProfile.website)}`} 
              target="_blank" rel="noopener noreferrer" 
              className="flex items-center gap-4 text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
              style={{ marginBottom: '5px' }}
            >
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <LinkIcon className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              </div>
              <span className="truncate">{String(metaProfile.website).replace(/^https?:\/\//, '')}</span>
            </a>
          )}

          <div className="flex items-center gap-4 text-sm font-bold text-gray-600 dark:text-slate-300">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-purple-500 dark:text-purple-400" />
            </div>
            <span>Joined {formatDate(account?.created || '')}</span>
          </div>
        </div>

        {/* Stats Grid inside Sidebar */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3" style={{ marginTop: '26px' }}>
          {[
            { label: 'Posts', value: postCount, color: 'text-blue-600 dark:text-blue-400', icon: FileText },
            { label: 'Followers', value: followerCount, color: 'text-emerald-600 dark:text-emerald-400', icon: UserPlus },
            { label: 'Following', value: followingCount, color: 'text-violet-600 dark:text-violet-400', icon: UserMinus }
          ].map((stat, idx) => (
            <div key={`${stat.label}-${idx}`} className="bg-gray-50 dark:bg-slate-900/70 rounded-2xl sm:rounded-3xl p-3 sm:p-4 text-center border border-gray-100 dark:border-slate-800 hover:scale-[1.02] transition-transform">
              <stat.icon className={`w-4 h-4 mx-auto mb-1.5 sm:mb-2 ${stat.color} opacity-80`} />
              <p className="text-lg sm:text-xl font-black text-gray-900 dark:text-white mb-0.5">{stat.value}</p>
              <p className="text-[9px] font-black text-gray-500 dark:text-slate-300 uppercase tracking-tighter">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ThemeFeed: React.FC<ThemeProps> = (props) => {
  const { 
    account, posts, comments, replies, mentions, activeTab, setActiveTab, onSelectPost, 
    onVote, onReblog, loadingMore, onLoadMore, onCommentReply, tabLoading, hasMore 
  } = props;

  const { openAuthorProfile } = useNavigation();

  const blogList = props.blog || props.blogPosts || posts;
  const displayPosts = 
    activeTab === 'comments' 
      ? comments 
      : activeTab === 'replies' 
      ? replies 
      : activeTab === 'posts' 
      ? posts 
      : activeTab === 'mentions'
      ? []
      : blogList;

  const mentionsList = mentions || [];

  // Inline Quick Reply state for Replies tab only
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<Record<string, boolean>>({});
  const [replyFeedback, setReplyFeedback] = useState<Record<string, string>>({});

  const handleSendReply = async (post: HivePost) => {
    const text = replyTexts[post.permlink]?.trim();
    if (!text || !onCommentReply) return;

    setSubmittingReply(prev => ({ ...prev, [post.permlink]: true }));
    try {
      const success = await onCommentReply(post, text);
      if (success) {
        setReplyTexts(prev => ({ ...prev, [post.permlink]: '' }));
        setReplyFeedback(prev => ({ ...prev, [post.permlink]: 'Reply broadcasted to Hive!' }));
        setTimeout(() => {
          setReplyFeedback(prev => {
            const next = { ...prev };
            delete next[post.permlink];
            return next;
          });
        }, 4000);
      }
    } finally {
      setSubmittingReply(prev => ({ ...prev, [post.permlink]: false }));
    }
  };

  // Infinite Scroll Observer Sentinel with hasMore protection
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentinelRef.current) return;
    if (hasMore === false) return; // Do not observe or re-trigger if end of feed reached!

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          onLoadMore();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadingMore, onLoadMore, hasMore]);

  const showQuickReply = activeTab === 'replies';

  return (
    <div className="space-y-6 pt-6 max-w-full" style={{ marginBottom: '18px', marginLeft: '-19px', width: '894px' }}>
      {/* Tab Navigation with Icons */}
      <div key="feed-tabs" className="flex items-center gap-4 border-b border-gray-100 dark:border-slate-800 pb-1 overflow-x-auto no-scrollbar">
        {[
          { id: 'blog', label: 'Blog', icon: Rss, pb: '12px' },
          { id: 'posts', label: 'Posts', icon: PenLine, pb: '12px' },
          { id: 'comments', label: 'Comments', icon: MessageSquare, pb: '14px' },
          { id: 'replies', label: 'Replies', icon: Undo2, pb: '12px' },
          { id: 'mentions', label: 'Mentions', icon: AtSign, pb: '12px' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`text-xs font-black uppercase tracking-widest transition-all relative flex-shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === tab.id 
              ? 'text-blue-600 dark:text-blue-400' 
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
            style={{ paddingLeft: '10px', paddingRight: '10px', paddingBottom: tab.pb }}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 dark:bg-blue-400 rounded-full" />}
          </button>
        ))}
      </div>

      {/* Feed Content */}
      <div key="feed-content" className="space-y-5 max-w-full" style={{ width: '893px' }}>
        {tabLoading ? (
          <div className="space-y-4 w-full">
            {[1, 2, 3].map((n) => (
              <div 
                key={n}
                className="bg-white dark:bg-[#161b2e] border border-gray-100 dark:border-slate-800/80 rounded-[15px] p-4 flex flex-col sm:flex-row gap-4 h-auto sm:h-[180px] w-full max-w-[894px] animate-pulse"
              >
                <div className="w-full sm:w-[262px] h-36 sm:h-full bg-slate-200 dark:bg-slate-800/70 rounded-[15px] shrink-0" />
                <div className="flex-1 flex flex-col justify-between py-1 space-y-2">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                      <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" />
                    </div>
                    <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-md" />
                    <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-3 w-4/5 bg-slate-200 dark:bg-slate-800 rounded" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <div className="h-7 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                    <div className="h-7 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                    <div className="h-7 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'mentions' ? (
          mentionsList.length === 0 ? (
            <div className="py-20 text-center bg-gray-50/50 dark:bg-[#161b2e] rounded-[24px] border-2 border-dashed border-gray-100 dark:border-slate-800">
              <AtSign className="w-8 h-8 mx-auto mb-2 text-blue-500 opacity-60" />
              <p className="text-gray-500 dark:text-slate-400 font-black uppercase tracking-widest text-xs">
                No mentions found for @{account?.name} yet.
              </p>
            </div>
          ) : (
            mentionsList.map((note: any, index: number) => {
              const actorMatch = (note.msg || '').match(/@([a-z0-9.-]+)/i);
              const actor = actorMatch ? actorMatch[1] : '';
              const cleanMsg = (note.msg || '').replace(/<[^>]*>/g, '').trim();
              
              const urlMatch = (note.url || '').match(/@([a-z0-9.-]+)\/([a-z0-9-]+)/i);
              const postAuthor = urlMatch ? urlMatch[1] : actor;
              const postPermlink = urlMatch ? urlMatch[2] : '';

              return (
                <div 
                  key={note.id || `${note.date}-${index}`}
                  className="bg-white dark:bg-[#161b2e] border border-gray-100 dark:border-slate-800/80 rounded-[15px] p-4 sm:p-5 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 w-full max-w-[894px] flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {actor ? (
                        <button
                          type="button"
                          onClick={() => openAuthorProfile(actor)}
                          className="flex items-center gap-2 group/actor cursor-pointer"
                        >
                          <img 
                            src={getHiveAvatarUrl(actor, 'small')} 
                            alt={actor}
                            className="w-6 h-6 rounded-full object-cover border border-gray-200 dark:border-slate-700 group-hover/actor:border-blue-500 transition-colors"
                          />
                          <span className="text-xs font-bold text-gray-800 dark:text-slate-200 group-hover/actor:text-blue-500 transition-colors">
                            @{actor}
                          </span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                          <AtSign className="w-4 h-4" />
                          <span>Mention</span>
                        </div>
                      )}
                      <span className="text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <AtSign className="w-3 h-3" />
                        <span>Mention</span>
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-gray-400 dark:text-slate-400">
                      {note.date ? new Date(note.date).toLocaleDateString() : ''}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 dark:text-slate-200 font-medium leading-relaxed">
                    {cleanMsg}
                  </p>

                  {postAuthor && postPermlink && (
                    <div className="pt-2 border-t border-gray-100 dark:border-slate-800/60 flex items-center justify-between">
                      <span className="text-xs text-gray-400 dark:text-slate-400 truncate max-w-[280px]">
                        {postPermlink}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPost({
                            author: postAuthor,
                            permlink: postPermlink,
                            title: postPermlink,
                            body: '',
                            category: '',
                            created: note.date || new Date().toISOString(),
                            depth: 0,
                            children: 0,
                            net_rshares: 0,
                            is_paidout: false,
                            payout: 0,
                            pending_payout_value: '0.000 HBD',
                            author_reputation: 25,
                            post_id: 0,
                            json_metadata: ''
                          });
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                      >
                        <span>View Post</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : displayPosts.length === 0 ? (
          <div className="py-24 text-center bg-gray-50/50 dark:bg-[#161b2e] rounded-[40px] border-2 border-dashed border-gray-100 dark:border-slate-800">
            <p className="text-gray-500 dark:text-slate-400 font-black uppercase tracking-widest text-xs">
              Nothing found here yet.
            </p>
          </div>
        ) : (
          displayPosts.map((post, index) => {
            const rawThumbnail = getPostThumbnail(post);
            const thumbnail = rawThumbnail ? getSafeImageUrl(rawThumbnail, { width: 600 }) : null;
            const snippet = getPostSnippet(post.body || '', 240);
            const isCommentOrReply = activeTab === 'comments' || activeTab === 'replies';
            
            // Check if this post is a reblog
            const isReblog = Boolean(
              (post.reblogged_by && post.reblogged_by.length > 0) ||
              (account?.name && post.author.toLowerCase() !== account.name.toLowerCase() && (activeTab === 'blog' || activeTab === 'posts'))
            );
            const rebloggedBy = post.reblogged_by?.[0] || (isReblog ? account?.name : null);
            
            return (
              <div 
                key={post.post_id || `${post.author}/${post.permlink}-${index}`} 
                className={`group bg-white dark:bg-[#161b2e] border border-gray-100 dark:border-slate-800/80 rounded-[15px] overflow-hidden hover:shadow-2xl hover:shadow-blue-500/5 transition-all duration-300 w-full max-w-[894px] ${
                  isCommentOrReply ? 'h-auto min-h-[140px]' : (showQuickReply ? 'h-auto min-h-[180px]' : 'h-auto sm:h-[180px]')
                }`}
                style={{ padding: '16px', width: '894px' }}
              >
                <div className="flex flex-col sm:flex-row h-full gap-3 sm:gap-0">
                  {/* Thumbnail OR Article Skeleton Placeholder - only for blog/posts */}
                  {!isCommentOrReply && (
                    thumbnail ? (
                      <div 
                        className="w-full sm:w-[262px] h-44 sm:h-full overflow-hidden cursor-pointer shrink-0 flex items-center justify-center"
                        onClick={() => onSelectPost(post)}
                      >
                        <img 
                          src={thumbnail} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                          alt="Thumbnail" 
                          loading="lazy"
                          style={{ 
                            maxHeight: '144px',
                            borderRadius: '15px', 
                            borderWidth: '1px', 
                            borderStyle: 'groove', 
                            borderColor: '#c2c2c2', 
                            marginLeft: '0px', 
                            marginRight: '12px'
                          }}
                        />
                      </div>
                    ) : (
                      <div 
                        className="w-full sm:w-[262px] h-36 sm:h-full overflow-hidden cursor-pointer shrink-0 flex items-center justify-center"
                        onClick={() => onSelectPost(post)}
                        title="Read article"
                      >
                        <div 
                          className="w-full h-full sm:max-h-[144px] rounded-[15px] bg-slate-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 p-4 flex flex-col justify-between group-hover/card:border-blue-400/50 transition-all duration-300 relative overflow-hidden"
                          style={{ marginRight: '12px' }}
                        >
                          {/* Decorative Watermark */}
                          <div className="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-[0.05] pointer-events-none transform rotate-12 group-hover/card:scale-110 transition-transform duration-500">
                            <FileText className="w-32 h-32 text-gray-900 dark:text-white" />
                          </div>

                          <div className="flex items-center justify-between z-10">
                            <div className="w-8 h-8 rounded-xl bg-blue-500/5 dark:bg-blue-400/5 flex items-center justify-center text-blue-600/60 dark:text-blue-400/60">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="h-1.5 w-12 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
                          </div>

                          <div className="space-y-2 z-10 flex-1 flex flex-col justify-center px-1">
                            <div className="h-2 w-full bg-slate-200/80 dark:bg-slate-800/80 rounded-full animate-pulse" />
                            <div className="h-2 w-4/5 bg-slate-200/60 dark:bg-slate-800/60 rounded-full animate-pulse [animation-delay:200ms]" />
                            <div className="h-2 w-5/6 bg-slate-200/40 dark:bg-slate-800/40 rounded-full animate-pulse [animation-delay:400ms]" />
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 dark:text-slate-500 z-10 pt-2 border-t border-gray-50 dark:border-slate-800/40">
                            <span className="truncate max-w-[100px]">#{post.category || 'hive'}</span>
                            <span className="text-blue-600/80 dark:text-blue-400/80 group-hover/card:translate-x-1 transition-transform flex items-center gap-1 text-[9px] uppercase tracking-wider font-black">
                              Open Article
                            </span>
                          </div>
                          
                          {/* Shimmer Effect */}
                          <div className="absolute inset-0 -translate-x-full group-hover/card:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 dark:via-white/5 to-transparent pointer-events-none" />
                        </div>
                      </div>
                    )
                  )}

                  <div 
                    className="flex-1 min-w-0 h-full flex flex-col justify-between overflow-hidden"
                  >
                    <div className="min-w-0 overflow-hidden flex flex-col justify-start">
                      {/* Parent Post Context for Comments/Replies */}
                      {isCommentOrReply && post.parent_author && (
                        <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg w-fit mb-2 font-bold shrink-0 border border-blue-100 dark:border-blue-900/40">
                          <span>In response to</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAuthorProfile(post.parent_author || '');
                            }}
                            className="font-black hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <img 
                              src={getHiveAvatarUrl(post.parent_author, 'small')} 
                              alt={post.parent_author} 
                              className="w-3.5 h-3.5 rounded-full inline-block object-cover border border-blue-200 dark:border-blue-800" 
                            />
                            <span>@{post.parent_author}</span>
                          </button>
                        </div>
                      )}

                      {/* Reblog Distinction Indicator */}
                      {isReblog && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-1 rounded-lg w-fit mb-2 shrink-0 border border-purple-200 dark:border-purple-800/60">
                          <Repeat className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Reblogged</span>
                          <span className="text-gray-300 dark:text-slate-600">•</span>
                          <span>Original by</span>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAuthorProfile(post.author);
                            }}
                            className="font-black text-purple-700 dark:text-purple-300 hover:underline cursor-pointer flex items-center gap-1 ml-0.5"
                          >
                            <img 
                              src={getHiveAvatarUrl(post.author, 'small')} 
                              alt={post.author} 
                              className="w-3.5 h-3.5 rounded-full inline-block object-cover border border-purple-300 dark:border-purple-700" 
                            />
                            <span>@{post.author}</span>
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-1.5 shrink-0 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                           <span className="text-[10px] font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-lg uppercase shrink-0">
                              {post.category}
                           </span>
                           <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 shrink-0">
                             {new Date(post.created).toLocaleDateString()}
                           </span>
                        </div>
                        
                        {/* Author Button - Clearly visible, readable, and clickable */}
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAuthorProfile(post.author);
                          }}
                          className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-2 truncate shrink-0 cursor-pointer group/author py-0.5 px-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800"
                          title={`View @${post.author}'s profile`}
                        >
                          <img 
                            src={getHiveAvatarUrl(post.author, 'small')} 
                            alt={post.author} 
                            className="w-4 h-4 rounded-full object-cover border border-gray-200 dark:border-slate-700" 
                          />
                          <span className="truncate">@{post.author}</span>
                        </button>
                      </div>

                      {post.title && !post.title.startsWith('RE:') && (
                        <h4 
                          className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-tight group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors cursor-pointer truncate block w-full min-w-0 shrink-0 mb-1"
                          onClick={() => onSelectPost(post)}
                          title={post.title}
                        >
                          {post.title}
                        </h4>
                      )}

                      <p 
                        className={`text-xs sm:text-sm text-gray-600 dark:text-slate-200 font-medium leading-relaxed overflow-hidden text-ellipsis min-w-0 ${
                          isCommentOrReply ? 'line-clamp-4' : 'line-clamp-2'
                        }`}
                        style={{ minHeight: '0px' }}
                      >
                        {snippet || post.body}
                      </p>
                    </div>

                    {/* Interactions Row - Anchored to bottom with mt-auto & shrink-0 */}
                    <div className="mt-auto pt-2 flex items-center justify-between shrink-0 w-full">
                       <div className="flex items-center gap-2 sm:gap-3">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onVote?.(post, 10000); }}
                            className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3 rounded-xl bg-gray-50 dark:bg-slate-900/80 text-gray-600 dark:text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 transition-colors font-black text-xs shrink-0 cursor-pointer"
                          >
                             <Heart className="w-4 h-4" />
                             <span>{post.active_votes?.length || 0}</span>
                          </button>
                          <button 
                            onClick={() => onSelectPost(post)}
                            className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3 rounded-xl bg-gray-50 dark:bg-slate-900/80 text-gray-600 dark:text-slate-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors font-black text-xs shrink-0 cursor-pointer"
                          >
                             <MessageCircle className="w-4 h-4" />
                             <span>{post.children}</span>
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); onReblog?.(post); }}
                            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3 rounded-xl bg-gray-50 dark:bg-slate-900/80 text-gray-600 dark:text-slate-300 hover:text-purple-500 dark:hover:text-purple-400 transition-colors font-black text-xs shrink-0 cursor-pointer ${isReblog ? 'text-purple-500' : ''}`}
                            title={isReblog ? 'Reblogged' : 'Reblog to your followers'}
                          >
                             <Repeat className="w-4 h-4" />
                          </button>
                       </div>

                       <div 
                        className="text-xs font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl border border-emerald-500/20 shrink-0"
                       >
                          ${Number(post.pending_payout_value?.split(' ')[0] || post.payout || 0).toFixed(2)}
                       </div>
                    </div>

                    {/* Direct Quick Reply ONLY for Replies Tab */}
                    {showQuickReply && (
                      <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-800/80 w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder={`Reply to @${post.author}...`}
                            value={replyTexts[post.permlink] || ''}
                            onChange={(e) => setReplyTexts(prev => ({ ...prev, [post.permlink]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendReply(post);
                              }
                            }}
                            className="flex-1 bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => handleSendReply(post)}
                            disabled={submittingReply[post.permlink] || !replyTexts[post.permlink]?.trim()}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer"
                          >
                            {submittingReply[post.permlink] ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            <span>Reply</span>
                          </button>
                        </div>
                        {replyFeedback[post.permlink] && (
                          <p className="text-[10px] font-bold text-emerald-500 mt-1 animate-in fade-in">
                            {replyFeedback[post.permlink]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Automatic Infinite Scroll Sentinel with hasMore protection */}
        {hasMore !== false && displayPosts.length > 0 && (
          <div ref={sentinelRef} className="py-8 flex justify-center items-center">
            {loadingMore ? (
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500 dark:text-slate-300">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span>Loading more posts...</span>
              </div>
            ) : (
              <div className="h-4" />
            )}
          </div>
        )}

        {hasMore === false && displayPosts.length > 0 && (
          <div className="py-8 text-center text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
            • All {activeTab} loaded •
          </div>
        )}
      </div>
    </div>
  );
};

const DefaultLayout: React.FC<ThemeProps> = (props) => {
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0a0f1d] animate-in fade-in duration-500 transition-colors selection:bg-blue-500/30 selection:text-blue-500">
      <ThemeHeader {...props} />
      
      <div 
        className="max-w-full mx-auto px-4 sm:px-12 pb-20"
        style={{ marginTop: '-23px', marginLeft: '0px', paddingLeft: '1px', paddingRight: '0px', paddingBottom: '40px' }}
      >
        <div 
          className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-12 items-start" 
          style={{ paddingLeft: '0px', paddingRight: '2px' }}
        >
          <aside className="lg:sticky lg:top-8 order-2 lg:order-1">
            <ThemeSidebar {...props} />
          </aside>
          
          <main className="order-1 lg:order-2">
            <ThemeFeed {...props} />
          </main>
        </div>
      </div>

      <footer className="py-24 text-center border-t border-gray-100 dark:border-slate-900">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] dark:text-white opacity-20">
          Redesigned with theme {defaultTheme.name}
        </p>
      </footer>
    </div>
  );
};

export const defaultTheme: ProfileTheme = {
  id: 'clean-slate',
  name: 'Clean Slate (Default)',
  badge: '✨ Original',
  description: 'A modern, professional dashboard with clean lines and high density',
  previewColor: '#2563eb',
  light: {
    ...DEFAULT_PROFILE_STYLE,
    backgroundColor: '#f8fafc',
    cardBackgroundColor: '#ffffff',
    textColor: '#0f172a',
    textSecondaryColor: '#64748b',
    accentColor: '#3b82f6'
  },
  dark: {
    ...DEFAULT_PROFILE_STYLE,
    backgroundColor: '#0a0f1d',
    cardBackgroundColor: '#161b2e',
    headerBackgroundColor: '#0a0f1d',
    textColor: '#f8fafc',
    textSecondaryColor: '#94a3b8',
    accentColor: '#3b82f6'
  },
  Layout: DefaultLayout
};

import React, { useState, useEffect, useRef } from 'react';
import { 
  Newspaper, 
  Calendar, 
  MapPin, 
  Link as LinkIcon, 
  Heart, 
  MessageCircle, 
  Repeat, 
  Award, 
  Clock, 
  ArrowRight, 
  UserPlus, 
  UserMinus, 
  Settings, 
  Volume2, 
  VolumeX, 
  AtSign, 
  Loader2, 
  Send, 
  ExternalLink, 
  Rss, 
  FileText, 
  MessageSquare, 
  Undo2, 
  Sparkles,
  BookOpen,
  Share2,
  Bookmark
} from 'lucide-react';
import { ProfileTheme, ThemeProps } from './themeTypes';
import { getHiveAvatarUrl, getPostThumbnail, getPostSnippet, HivePost } from '../../../services/hiveApi';
import { DEFAULT_PROFILE_STYLE } from '../profileStyleTypes';
import { useNavigation } from '../../../context/NavigationContext';
import { getSafeImageUrl } from '../../../utils/sanitize';

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

const formatDateFull = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

const calculateReadTime = (body: string) => {
  if (!body) return '1 min read';
  const words = body.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 220));
  return `${minutes} min read`;
};

export const JournalistLayout: React.FC<ThemeProps> = (props) => {
  const isMobile = useIsMobile();
  const { 
    account, 
    profile, 
    blog, 
    posts, 
    comments, 
    replies, 
    mentions, 
    reputation, 
    followerCount, 
    followingCount, 
    postCount, 
    isOwner, 
    isFollowing, 
    onFollowToggle, 
    isMuted, 
    onMuteToggle, 
    onOpenCustomizer, 
    onSelectPost, 
    onVote, 
    onReblog, 
    onCommentReply,
    activeTab, 
    setActiveTab, 
    loadingMore, 
    onLoadMore, 
    hasMore, 
    tabLoading 
  } = props;

  const { openAuthorProfile } = useNavigation();
  const metaProfile = profile?.metadata?.profile || {};
  const avatarUrl = getHiveAvatarUrl(account?.name || '', 'large');
  const coverImage = metaProfile.cover_image ? getSafeImageUrl(metaProfile.cover_image, { width: 1400 }) : null;

  // Quick reply state for comments & replies
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<Record<string, boolean>>({});
  const [replyFeedback, setReplyFeedback] = useState<Record<string, string>>({});

  const handleSendReply = async (post: HivePost) => {
    const text = replyTexts[post.permlink]?.trim();
    if (!text || !onCommentReply) return;
    setSubmittingReply(prev => ({ ...prev, [post.permlink]: true }));
    try {
      const ok = await onCommentReply(post, text);
      if (ok) {
        setReplyTexts(prev => ({ ...prev, [post.permlink]: '' }));
        setReplyFeedback(prev => ({ ...prev, [post.permlink]: 'Dispatch sent!' }));
        setTimeout(() => setReplyFeedback(prev => ({ ...prev, [post.permlink]: '' })), 3000);
      }
    } finally {
      setSubmittingReply(prev => ({ ...prev, [post.permlink]: false }));
    }
  };

  // Determine current active posts list
  const displayPosts: HivePost[] = 
    activeTab === 'blog' ? (blog && blog.length > 0 ? blog : posts) :
    activeTab === 'posts' ? posts :
    activeTab === 'comments' ? comments :
    activeTab === 'replies' ? replies : posts;

  const mentionsList = mentions || [];
  const leadStory = (activeTab === 'blog' || activeTab === 'posts') && displayPosts.length > 0 ? displayPosts[0] : null;
  const secondaryStories = leadStory ? displayPosts.slice(1) : displayPosts;

  // Extract covered topics from posts
  const coveredTopics = Array.from(
    new Set(
      (posts || [])
        .map(p => p.category)
        .filter(Boolean)
    )
  ).slice(0, 8);

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-[#080d16] text-gray-900 dark:text-slate-100 transition-colors duration-300 selection:bg-amber-500/20 selection:text-amber-800 dark:selection:text-amber-200">
      
      {/* Newspaper Top Header / Gazette Wrapper */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        
        {/* Newspaper Top Wire Info Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-300 dark:border-slate-800 text-[10px] sm:text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="font-black text-gray-900 dark:text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
              THE HIVE CHRONICLE
            </span>
            <span className="hidden sm:inline text-gray-300 dark:text-slate-700">•</span>
            <span className="hidden sm:inline">SPECIAL EDITORIAL EDITION</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-semibold">{todayStr}</span>
            <span className="hidden md:inline text-gray-300 dark:text-slate-700">•</span>
            <span className="hidden md:inline">VOL. {new Date().getFullYear()} • NO. {reputation}</span>
          </div>
        </div>

        {/* Newspaper Masthead */}
        <header className="py-6 sm:py-8 border-b-2 sm:border-b-4 border-gray-900 dark:border-slate-200 my-2 text-center relative">
          <div className="flex flex-col items-center justify-center space-y-2">
            
            {/* Small Kicker */}
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-gray-500 dark:text-slate-400">
              The Daily Web3 Gazette & Opinion Wire
            </p>

            {/* Main Newspaper Name / Journalist Headline */}
            <h1 className="font-serif text-3xl xs:text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-gray-950 dark:text-white uppercase leading-none drop-shadow-xs">
              {metaProfile.name ? `${metaProfile.name}` : `@${account?.name}`}
            </h1>

            {/* Sub-tagline */}
            <p className="font-serif italic text-xs sm:text-sm text-gray-600 dark:text-slate-300 max-w-2xl px-4">
              "{metaProfile.about || 'Independent reporting, decentralized opinion, and verified dispatches from the Hive blockchain ecosystem.'}"
            </p>
          </div>

          {/* Masthead Bottom Meta Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-3 border-t border-gray-200 dark:border-slate-800 text-xs font-medium text-gray-600 dark:text-slate-400">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-bold text-gray-900 dark:text-white">
                Chief Correspondent: <span className="text-blue-600 dark:text-blue-400">@{account?.name}</span>
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-500/20 text-[11px]">
                <Award className="w-3 h-3" />
                Reputation {reputation}
              </span>
              {metaProfile.location && (
                <span className="inline-flex items-center gap-1 text-[11px]">
                  <MapPin className="w-3 h-3 text-gray-400" />
                  {metaProfile.location}
                </span>
              )}
            </div>

            {/* Quick Actions in Masthead */}
            <div className="flex items-center gap-2">
              {isOwner ? (
                <button
                  type="button"
                  onClick={onOpenCustomizer}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Editor Desk</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onFollowToggle}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95 ${
                      isFollowing
                        ? 'border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 hover:border-rose-300'
                        : 'bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-gray-900'
                    }`}
                  >
                    {isFollowing ? <UserMinus className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                    <span>{isFollowing ? 'Subscribed' : 'Subscribe'}</span>
                  </button>

                  {onMuteToggle && (
                    <button
                      type="button"
                      onClick={onMuteToggle}
                      className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                        isMuted 
                          ? 'bg-rose-50 border-rose-300 text-rose-600 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-400' 
                          : 'border-gray-300 dark:border-slate-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'
                      }`}
                      title={isMuted ? 'Unmute Correspondent' : 'Mute Correspondent'}
                    >
                      {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </header>

        {/* Newspaper Sections Navigation (Tabs) */}
        <div className="flex items-center justify-between border-b border-gray-300 dark:border-slate-800 pb-2 mb-6 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 sm:gap-2">
            {[
              { id: 'blog', label: 'Front Page', icon: Newspaper, desc: 'Curated dispatches' },
              { id: 'posts', label: 'All Articles', icon: FileText, desc: 'Complete archives' },
              { id: 'comments', label: 'Public Letters', icon: MessageSquare, desc: 'Reader comments' },
              { id: 'replies', label: 'Correspondence', icon: Undo2, desc: 'Direct replies' },
              { id: 'mentions', label: 'Wire Mentions', icon: AtSign, desc: 'Press citations' }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-950 shadow-xs font-black'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-gray-400 dark:text-slate-500">
            <span>PRESS ID: {account?.id || 'HIVE-CHAIN'}</span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* MAIN LAYOUT: Lead Story + 2-Column Newspaper Grid              */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_350px] gap-8 lg:gap-10 items-start pb-20">
          
          {/* Main Editorial Feed Column */}
          <main className="space-y-8 min-w-0">
            
            {/* FRONT PAGE LEAD STORY (Featured Headline) */}
            {leadStory && !tabLoading && (
              <article 
                onClick={() => onSelectPost(leadStory)}
                className="group p-5 sm:p-7 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#0d1424] border-2 border-gray-900/90 dark:border-slate-700/80 hover:border-blue-600 dark:hover:border-blue-400 transition-all duration-300 shadow-lg hover:shadow-xl cursor-pointer relative overflow-hidden"
              >
                {/* Vintage Editorial Stamp */}
                <div className="flex items-center justify-between mb-3 border-b border-gray-200 dark:border-slate-800/80 pb-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/50">
                    <Sparkles className="w-3 h-3" />
                    Front Page Lead Story
                  </span>
                  <span className="text-xs font-mono text-gray-400 dark:text-slate-400">
                    {formatDateFull(leadStory.created)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6 items-center">
                  {/* Lead Image (if present) */}
                  {(() => {
                    const thumb = getPostThumbnail(leadStory);
                    const safeThumb = thumb ? getSafeImageUrl(thumb, { width: 800 }) : null;
                    if (!safeThumb) return null;
                    return (
                      <div className="md:col-span-5 h-56 sm:h-64 rounded-xl overflow-hidden relative group/img bg-slate-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-800">
                        <img 
                          src={safeThumb} 
                          alt={leadStory.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105"
                          loading="lazy"
                        />
                        <span className="absolute bottom-2 left-2 text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-black/75 text-white backdrop-blur-xs">
                          Archive Photo
                        </span>
                      </div>
                    );
                  })()}

                  {/* Lead Text Body */}
                  <div className={getPostThumbnail(leadStory) ? "md:col-span-7 space-y-3" : "md:col-span-12 space-y-3"}>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                        #{leadStory.category || 'dispatch'}
                      </span>
                      <span className="text-gray-300 dark:text-slate-700">•</span>
                      <span className="text-xs font-medium text-gray-500 dark:text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {calculateReadTime(leadStory.body || '')}
                      </span>
                    </div>

                    <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-black leading-tight text-gray-950 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {leadStory.title}
                    </h2>

                    <p className="text-xs sm:text-sm text-gray-700 dark:text-slate-300 leading-relaxed font-serif line-clamp-3">
                      {getPostSnippet(leadStory.body || '', 320)}
                    </p>

                    {/* Bottom Metadata Bar */}
                    <div className="pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-xs font-bold text-gray-600 dark:text-slate-300">
                          <Heart className="w-3.5 h-3.5 text-rose-500" />
                          {leadStory.active_votes?.length || 0}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-bold text-gray-600 dark:text-slate-300">
                          <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                          {leadStory.children || 0}
                        </span>
                      </div>

                      <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">
                        Read Investigation <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            )}

            {/* SECONDARY STORIES / MAIN LIST */}
            <div className="space-y-5">
              {tabLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(n => (
                    <div key={n} className="p-5 rounded-2xl bg-white dark:bg-[#0d1424] border border-gray-200 dark:border-slate-800 animate-pulse space-y-3">
                      <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                      <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
                      <div className="h-3.5 w-full bg-slate-200 dark:bg-slate-800 rounded" />
                      <div className="h-3.5 w-2/3 bg-slate-200 dark:bg-slate-800 rounded" />
                    </div>
                  ))}
                </div>
              ) : activeTab === 'mentions' ? (
                mentionsList.length === 0 ? (
                  <div className="py-20 text-center bg-white dark:bg-[#0d1424] rounded-2xl border border-dashed border-gray-300 dark:border-slate-800 p-8 font-serif">
                    <AtSign className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                    <p className="font-bold text-base text-gray-700 dark:text-slate-300">No Wire Mentions Recorded</p>
                    <p className="text-xs text-gray-500 mt-1">External correspondents have not cited this author yet.</p>
                  </div>
                ) : (
                  mentionsList.map((note: any, idx: number) => {
                    const cleanMsg = (note.msg || '').replace(/<[^>]*>/g, '').trim();
                    return (
                      <div 
                        key={note.id || idx}
                        className="p-5 rounded-2xl bg-white dark:bg-[#0d1424] border border-gray-200 dark:border-slate-800/80 shadow-xs space-y-2.5 font-serif"
                      >
                        <div className="flex items-center justify-between text-xs font-mono text-gray-400">
                          <span className="font-bold text-blue-600 dark:text-blue-400 uppercase">Wire Dispatch</span>
                          <span>{note.date ? new Date(note.date).toLocaleDateString() : ''}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 dark:text-slate-200 leading-relaxed">
                          {cleanMsg}
                        </p>
                      </div>
                    );
                  })
                )
              ) : secondaryStories.length === 0 && !leadStory ? (
                <div className="py-20 text-center bg-white dark:bg-[#0d1424] rounded-2xl border border-dashed border-gray-300 dark:border-slate-800 p-8 font-serif">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                  <p className="font-bold text-base text-gray-700 dark:text-slate-300">The Gazette Archives Are Empty</p>
                  <p className="text-xs text-gray-500 mt-1">No articles have been filed under this section yet.</p>
                </div>
              ) : (
                secondaryStories.map((post, index) => {
                  const rawThumb = getPostThumbnail(post);
                  const thumb = rawThumb ? getSafeImageUrl(rawThumb, { width: 600 }) : null;
                  const snippet = getPostSnippet(post.body || '', 220);
                  const isCommentOrReply = activeTab === 'comments' || activeTab === 'replies';

                  return (
                    <article
                      key={post.post_id || `${post.author}/${post.permlink}-${index}`}
                      className="group p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0d1424] border border-gray-200 dark:border-slate-800/80 hover:border-blue-500/50 dark:hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200"
                    >
                      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
                        {/* Thumbnail image if available */}
                        {!isCommentOrReply && thumb && (
                          <div 
                            onClick={() => onSelectPost(post)}
                            className="w-full sm:w-44 md:w-52 h-36 sm:h-36 rounded-xl overflow-hidden shrink-0 relative bg-slate-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 cursor-pointer group/thumb"
                          >
                            <img 
                              src={thumb} 
                              alt={post.title} 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover/thumb:opacity-100 transition-opacity" />
                          </div>
                        )}

                        {/* Article Content */}
                        <div className="flex-1 min-w-0 w-full space-y-2">
                          
                          {/* Parent context for comments */}
                          {isCommentOrReply && post.parent_author && (
                            <div className="text-xs font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-md w-fit mb-1 border border-blue-200 dark:border-blue-900/40">
                              <span>In response to </span>
                              <button
                                type="button"
                                onClick={() => openAuthorProfile(post.parent_author || '')}
                                className="font-bold underline hover:text-blue-700 cursor-pointer"
                              >
                                @{post.parent_author}
                              </button>
                            </div>
                          )}

                          {/* Kicker & Meta Row */}
                          <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200/60 dark:border-blue-900/40">
                                #{post.category || 'news'}
                              </span>
                              <span className="text-gray-400 dark:text-slate-500">•</span>
                              <span className="text-gray-500 dark:text-slate-400 font-mono text-[11px]">
                                {new Date(post.created).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>

                            <span className="text-[11px] font-mono text-gray-400 dark:text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {calculateReadTime(post.body || '')}
                            </span>
                          </div>

                          {/* Title */}
                          {post.title && !post.title.startsWith('RE:') && (
                            <h3 
                              onClick={() => onSelectPost(post)}
                              className="font-serif text-lg sm:text-xl font-bold leading-snug text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-pointer line-clamp-2"
                            >
                              {post.title}
                            </h3>
                          )}

                          {/* Snippet */}
                          <p 
                            className="font-serif text-xs sm:text-sm text-gray-700 dark:text-slate-300 leading-relaxed line-clamp-2"
                          >
                            {snippet || post.body}
                          </p>

                          {/* Interactions & Value Bar */}
                          <div className="pt-3 border-t border-gray-100 dark:border-slate-800/60 flex items-center justify-between flex-wrap gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onVote?.(post, 10000); }}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-slate-300 hover:text-rose-500 transition-colors font-bold cursor-pointer"
                              >
                                <Heart className="w-3.5 h-3.5" />
                                <span>{post.active_votes?.length || 0}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => onSelectPost(post)}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-slate-300 hover:text-blue-500 transition-colors font-bold cursor-pointer"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>{post.children || 0}</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onReblog?.(post); }}
                                className="p-1.5 rounded-lg bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-slate-300 hover:text-purple-500 transition-colors cursor-pointer"
                                title="Syndicate / Reblog"
                              >
                                <Repeat className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => onSelectPost(post)}
                                className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <span>Read</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Quick reply bar for replies tab */}
                          {activeTab === 'replies' && (
                            <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-800/80 w-full" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder={`Send telegraph reply to @${post.author}...`}
                                  value={replyTexts[post.permlink] || ''}
                                  onChange={(e) => setReplyTexts(prev => ({ ...prev, [post.permlink]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSendReply(post);
                                    }
                                  }}
                                  className="flex-1 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 font-serif"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSendReply(post)}
                                  disabled={submittingReply[post.permlink] || !replyTexts[post.permlink]?.trim()}
                                  className="px-3.5 py-1.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer disabled:opacity-40"
                                >
                                  {submittingReply[post.permlink] ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Send className="w-3.5 h-3.5" />
                                  )}
                                  <span>Dispatch</span>
                                </button>
                              </div>
                              {replyFeedback[post.permlink] && (
                                <p className="text-[10px] font-bold text-emerald-500 mt-1">
                                  {replyFeedback[post.permlink]}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {/* Pagination Sentinel */}
            {hasMore !== false && displayPosts.length > 0 && (
              <div className="py-8 flex justify-center items-center">
                {loadingMore ? (
                  <div className="flex items-center gap-2 text-xs font-mono uppercase text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    <span>Loading further dispatches...</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onLoadMore}
                    className="px-5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 font-bold text-xs cursor-pointer transition font-mono uppercase"
                  >
                    Load More Editions
                  </button>
                )}
              </div>
            )}
          </main>

          {/* ============================================================== */}
          {/* THE EDITORIAL DESK & CORRESPONDENT DOSSIER (Sidebar)           */}
          {/* ============================================================== */}
          <aside className="space-y-6 lg:sticky lg:top-24 w-full">
            
            {/* Correspondent Profile Card */}
            <div className="bg-white dark:bg-[#0d1424] border-2 border-gray-900 dark:border-slate-700/80 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-md relative overflow-hidden font-serif">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <img 
                    src={avatarUrl} 
                    alt={account?.name || ''} 
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-gray-900 dark:border-slate-600 shadow-md"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">
                    Press Dossier
                  </span>
                  <h3 className="font-serif text-lg font-black text-gray-900 dark:text-white truncate">
                    {metaProfile.name || `@${account?.name}`}
                  </h3>
                  <p className="text-xs font-mono text-blue-600 dark:text-blue-400">
                    @{account?.name}
                  </p>
                </div>
              </div>

              {/* Bio Excerpt */}
              <p className="text-xs sm:text-sm text-gray-700 dark:text-slate-300 leading-relaxed border-t border-b border-gray-200 dark:border-slate-800/80 py-3 my-3 italic">
                {metaProfile.about || "Correspondent covering decentralized topics, blockchain developments, and independent news on Hive."}
              </p>

              {/* Meta details */}
              <div className="space-y-2 text-xs font-medium text-gray-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{metaProfile.location || "Global Wire"}</span>
                </div>
                
                {metaProfile.website && (
                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <a 
                      href={String(metaProfile.website).startsWith('http') ? String(metaProfile.website) : `https://${String(metaProfile.website)}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                    >
                      {String(metaProfile.website).replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>
                    Accredited {account?.created ? new Date(account.created).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '2021'}
                  </span>
                </div>
              </div>

              {/* Circulation & Readership Counters */}
              <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-gray-200 dark:border-slate-800/80 text-center">
                <div className="p-2 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800">
                  <p className="font-serif font-black text-base text-gray-900 dark:text-white">{postCount || 0}</p>
                  <p className="text-[9px] font-mono uppercase text-gray-500">Articles</p>
                </div>
                <div className="p-2 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800">
                  <p className="font-serif font-black text-base text-emerald-600 dark:text-emerald-400">{followerCount || 0}</p>
                  <p className="text-[9px] font-mono uppercase text-gray-500">Subscribers</p>
                </div>
                <div className="p-2 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800">
                  <p className="font-serif font-black text-base text-purple-600 dark:text-purple-400">{followingCount || 0}</p>
                  <p className="text-[9px] font-mono uppercase text-gray-500">Wire Allies</p>
                </div>
              </div>
            </div>

            {/* Beats & Topics Covered Box */}
            {coveredTopics.length > 0 && (
              <div className="bg-white dark:bg-[#0d1424] border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white mb-3 flex items-center gap-1.5 font-serif">
                  <Newspaper className="w-3.5 h-3.5 text-blue-500" />
                  Editorial Beats Covered
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {coveredTopics.map(t => (
                    <span 
                      key={t}
                      className="text-xs font-mono px-2.5 py-1 rounded-md bg-gray-100 dark:bg-slate-800/80 text-gray-700 dark:text-slate-300 border border-gray-200/80 dark:border-slate-700/80 hover:border-blue-400 transition-colors"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Decentralized Press Guarantee Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-slate-900 dark:to-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-amber-900 dark:text-amber-200/90 text-xs font-serif leading-relaxed">
              <div className="flex items-center gap-2 font-black uppercase tracking-wider text-[10px] mb-1.5 text-amber-800 dark:text-amber-400">
                <Award className="w-3.5 h-3.5" />
                Immutable Press Guarantee
              </div>
              <p>
                All dispatches, letters, and investigative archives published under this desk are cryptographically signed with Hive Keychain and immutably stored across the decentralized network.
              </p>
            </div>
          </aside>

        </div>
      </div>

      {/* Editorial Footer */}
      <footer className="py-12 text-center border-t border-gray-300 dark:border-slate-800/80 bg-white dark:bg-[#090d16] font-serif">
        <p className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
          The Hive Chronicle • Published by @{account?.name} • All Rights Immutably Recorded
        </p>
      </footer>
    </div>
  );
};

export const journalistTheme: ProfileTheme = {
  id: 'journalist-news',
  name: 'Modern Journalist',
  badge: '📰 Editorial Gazette',
  description: 'Authentic multi-column newspaper layout with lead story spotlight, editorial masthead, and archive beats',
  previewColor: '#0f172a',
  light: {
    ...DEFAULT_PROFILE_STYLE,
    structure: 'editorial-magazine',
    fontFamily: 'serif',
    backgroundColor: '#fafaf9',
    cardBackgroundColor: '#ffffff',
    headerBackgroundColor: '#fafaf9',
    textColor: '#0f172a',
    textSecondaryColor: '#57534e',
    accentColor: '#1c1917'
  },
  dark: {
    ...DEFAULT_PROFILE_STYLE,
    structure: 'editorial-magazine',
    fontFamily: 'serif',
    backgroundColor: '#080d16',
    cardBackgroundColor: '#0d1424',
    headerBackgroundColor: '#080d16',
    textColor: '#f8fafc',
    textSecondaryColor: '#94a3b8',
    accentColor: '#38bdf8'
  },
  Layout: JournalistLayout
};

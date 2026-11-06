import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  BookOpen, 
  Bookmark, 
  PenTool, 
  Sparkles, 
  Calendar, 
  MapPin, 
  Link as LinkIcon, 
  MessageCircle, 
  Repeat, 
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
  FileText, 
  Award
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
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

const calculateReadingMinutes = (body: string) => {
  if (!body) return '2 min read';
  const words = body.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
};

export const AuthorLayout: React.FC<ThemeProps> = (props) => {
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

  // Inline comment / letter reply states
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
        setReplyFeedback(prev => ({ ...prev, [post.permlink]: 'Epistle dispatched!' }));
        setTimeout(() => setReplyFeedback(prev => ({ ...prev, [post.permlink]: '' })), 3000);
      }
    } finally {
      setSubmittingReply(prev => ({ ...prev, [post.permlink]: false }));
    }
  };

  // Active items based on current tab
  const displayPosts: HivePost[] = 
    activeTab === 'blog' ? (blog && blog.length > 0 ? blog : posts) :
    activeTab === 'posts' ? posts :
    activeTab === 'comments' ? comments :
    activeTab === 'replies' ? replies : posts;

  const mentionsList = mentions || [];
  const leadChapter = (activeTab === 'blog' || activeTab === 'posts') && displayPosts.length > 0 ? displayPosts[0] : null;
  const subsequentChapters = leadChapter ? displayPosts.slice(1) : displayPosts;

  // Extract literary tropes / topics covered
  const tropesList = Array.from(
    new Set(
      (posts || [])
        .map(p => p.category)
        .filter(Boolean)
    )
  ).slice(0, 8);

  return (
    <div className="min-h-screen bg-[#faf6f0] dark:bg-[#0c0810] text-[#29221d] dark:text-[#f3e8ee] transition-colors duration-300 selection:bg-rose-500/25 selection:text-rose-900 dark:selection:text-rose-200">
      
      {/* Container matching Navbar max-w-7xl */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">

        {/* Ambient Romance Header Banner */}
        <div className="relative rounded-3xl overflow-hidden shadow-xl border border-rose-200/60 dark:border-rose-950/60 bg-gradient-to-r from-rose-950 via-purple-950 to-slate-950 min-h-[220px] sm:min-h-[260px] flex items-end">
          {coverImage ? (
            <img 
              src={coverImage} 
              alt="Author Atelier" 
              className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-900/40 via-purple-950/60 to-black/80" />
          )}

          {/* Gentle vignette scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

          {/* Top Decorative Flourish Bar inside Banner */}
          <div className="absolute top-3 inset-x-4 sm:inset-x-8 flex items-center justify-between text-[10px] sm:text-xs font-serif uppercase tracking-widest text-rose-200/80 z-10 border-b border-rose-500/20 pb-2">
            <span className="flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-rose-400" />
              THE ROMANCE ATELIER & NOVEL ARCHIVE
            </span>
            <span className="hidden sm:inline font-mono text-[10px] text-rose-300/70">
              DECENTRALIZED PROSE • VOL. {reputation}
            </span>
          </div>

          {/* Banner Body Content: Author Identity */}
          <div className="relative z-20 w-full p-4 sm:p-8 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4">
            
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6 text-center sm:text-left">
              {/* Author Portrait Cameo with Rose Gold Halo */}
              <div className="relative shrink-0 group/portrait">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-[#faf6f0] dark:border-[#0c0810] shadow-2xl overflow-hidden bg-slate-900 ring-4 ring-rose-500/30">
                  <img 
                    src={avatarUrl} 
                    alt={account?.name || ''} 
                    className="w-full h-full object-cover group-hover/portrait:scale-105 transition-transform duration-500"
                  />
                </div>
                <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-rose-500 border-2 border-[#faf6f0] dark:border-[#0c0810] shadow-md flex items-center justify-center">
                  <Heart className="w-2.5 h-2.5 text-white fill-white" />
                </span>
              </div>

              {/* Names & Preface Tagline */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                  <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white drop-shadow-md">
                    {metaProfile.name || account?.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-black uppercase tracking-wider text-rose-200 bg-rose-500/25 px-2.5 py-0.5 rounded-full border border-rose-400/30 shadow-xs backdrop-blur-xs">
                    <PenTool className="w-3 h-3 text-rose-300" />
                    Romance Novelist
                  </span>
                </div>

                <p className="font-serif italic text-xs sm:text-sm text-rose-100/90 max-w-xl">
                  @{account?.name} • {metaProfile.about || "Crafting passionate stories, poetic memoirs, and unforgettable romance on the blockchain."}
                </p>
              </div>
            </div>

            {/* Actions: Follow / Customizer */}
            <div className="flex items-center gap-2.5 shrink-0 pb-1">
              {isOwner ? (
                <button
                  type="button"
                  onClick={onOpenCustomizer}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/25 text-xs font-bold transition-all cursor-pointer shadow-lg active:scale-95"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Author's Desk</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onFollowToggle}
                    className={`inline-flex items-center gap-2 px-5 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-lg active:scale-95 ${
                      isFollowing
                        ? 'bg-white/15 hover:bg-rose-500/40 text-white backdrop-blur-md border border-white/25'
                        : 'bg-gradient-to-r from-rose-500 via-rose-600 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-rose-500/30'
                    }`}
                  >
                    {isFollowing ? <Bookmark className="w-3.5 h-3.5" /> : <Heart className="w-3.5 h-3.5 fill-white" />}
                    <span>{isFollowing ? 'Dedicated Reader' : 'Subscribe to Novels'}</span>
                  </button>

                  {onMuteToggle && (
                    <button
                      type="button"
                      onClick={onMuteToggle}
                      className={`p-2 rounded-2xl border text-xs transition cursor-pointer backdrop-blur-md ${
                        isMuted 
                          ? 'bg-rose-500/30 border-rose-400/50 text-rose-200' 
                          : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
                      }`}
                      title={isMuted ? 'Unmute Author' : 'Mute Author'}
                    >
                      {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </>
              )}
            </div>

          </div>
        </div>

        {/* Decorative Literary Flourish Divider */}
        <div className="flex items-center justify-center my-6 text-rose-400 dark:text-rose-600/70 select-none">
          <div className="h-[1px] w-24 sm:w-48 bg-gradient-to-r from-transparent via-rose-300 dark:via-rose-900 to-transparent" />
          <span className="px-3 font-serif text-sm tracking-widest opacity-80">❦ ── ✦ ── ❦</span>
          <div className="h-[1px] w-24 sm:w-48 bg-gradient-to-r from-transparent via-rose-300 dark:via-rose-900 to-transparent" />
        </div>

        {/* Romance Novelist Section Navigation (Tabs) */}
        <div className="flex items-center justify-between border-b border-rose-200/70 dark:border-rose-950/80 pb-2 mb-8 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {[
              { id: 'blog', label: 'Serialized Chapters', icon: BookOpen, desc: 'Featured chapters' },
              { id: 'posts', label: 'Complete Bibliography', icon: FileText, desc: 'All works' },
              { id: 'comments', label: 'Reader Letters', icon: MessageCircle, desc: 'Reader notes' },
              { id: 'replies', label: 'Correspondence', icon: Heart, desc: 'Author epistles' },
              { id: 'mentions', label: 'Literary Citations', icon: AtSign, desc: 'Mentions & reviews' }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-serif font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    isActive
                      ? 'bg-rose-500 text-white shadow-sm font-black ring-1 ring-rose-400/40'
                      : 'text-[#6e584f] dark:text-[#a8969f] hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-100/60 dark:hover:bg-rose-950/40'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs font-serif italic text-rose-600 dark:text-rose-400 font-semibold">
            <span>Volume {reputation} • Hive Archive</span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* TWO-COLUMN LITERARY GRID: Stories + Author's Study Sidebar     */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_330px] xl:grid-cols-[1fr_360px] gap-8 lg:gap-10 items-start pb-24">
          
          {/* Main Story & Manuscript Column */}
          <main className="space-y-8 min-w-0">
            
            {/* FEATURED ROMANCE MASTERPIECE / LEAD CHAPTER */}
            {leadChapter && !tabLoading && (
              <article 
                onClick={() => onSelectPost(leadChapter)}
                className="group p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#140e1a] border-2 border-rose-200 dark:border-rose-900/60 hover:border-rose-400 dark:hover:border-rose-500/80 transition-all duration-300 shadow-xl hover:shadow-2xl cursor-pointer relative overflow-hidden"
              >
                {/* Ambient glow accent */}
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-rose-500 to-transparent pointer-events-none" />

                {/* Top Hallmark */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-rose-100 dark:border-rose-950 text-xs font-serif">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-3 py-1 rounded-full border border-rose-200 dark:border-rose-800/60">
                    <Bookmark className="w-3 h-3 text-rose-500" />
                    Featured Romance Chapter
                  </span>
                  <span className="text-gray-400 dark:text-rose-300/60 font-serif italic">
                    Published {formatDateFull(leadChapter.created)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  
                  {/* Book Cover Vignette */}
                  {(() => {
                    const thumb = getPostThumbnail(leadChapter);
                    const safeThumb = thumb ? getSafeImageUrl(thumb, { width: 800 }) : null;
                    if (!safeThumb) return null;
                    return (
                      <div className="md:col-span-5 h-64 sm:h-72 rounded-2xl overflow-hidden relative shadow-md border-2 border-rose-100 dark:border-rose-950 group/cover bg-slate-900">
                        <img 
                          src={safeThumb} 
                          alt={leadChapter.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover/cover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                        <span className="absolute bottom-3 left-3 text-[10px] font-serif font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-black/70 text-rose-100 backdrop-blur-xs border border-rose-500/20">
                          Cover Art
                        </span>
                      </div>
                    );
                  })()}

                  {/* Chapter Narrative Preview */}
                  <div className={getPostThumbnail(leadChapter) ? "md:col-span-7 space-y-3.5" : "md:col-span-12 space-y-3.5"}>
                    <div className="flex items-center gap-2 text-xs font-serif">
                      <span className="font-black text-[11px] uppercase tracking-wider text-rose-600 dark:text-rose-400">
                        #{leadChapter.category || 'romance'}
                      </span>
                      <span className="text-rose-300 dark:text-rose-900">•</span>
                      <span className="text-gray-500 dark:text-rose-300/70 italic flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {calculateReadingMinutes(leadChapter.body || '')}
                      </span>
                    </div>

                    <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-gray-950 dark:text-rose-50 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                      {leadChapter.title}
                    </h2>

                    <p className="font-serif text-sm sm:text-base text-gray-700 dark:text-rose-100/80 leading-relaxed line-clamp-3 italic">
                      "{getPostSnippet(leadChapter.body || '', 300)}"
                    </p>

                    {/* Chapter Action Footer */}
                    <div className="pt-4 border-t border-rose-100 dark:border-rose-950 flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/40">
                          <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                          {leadChapter.active_votes?.length || 0} Admirers
                        </span>

                        <span className="inline-flex items-center gap-1.5 font-bold text-[#6e584f] dark:text-rose-200">
                          <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                          {leadChapter.children || 0} Letters
                        </span>

                      </div>

                      <span className="inline-flex items-center gap-1.5 font-serif font-black text-rose-600 dark:text-rose-400 group-hover:translate-x-1 transition-transform">
                        <span>Begin Reading</span>
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>

                </div>
              </article>
            )}

            {/* MANUSCRIPT ARCHIVE (Remaining Chapters & Works) */}
            <div className="space-y-6">
              {tabLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(n => (
                    <div key={n} className="p-6 rounded-3xl bg-white dark:bg-[#140e1a] border border-rose-200/60 dark:border-rose-950 animate-pulse space-y-3">
                      <div className="h-4 w-28 bg-rose-100 dark:bg-rose-950 rounded" />
                      <div className="h-6 w-3/4 bg-rose-100 dark:bg-rose-950 rounded" />
                      <div className="h-3.5 w-full bg-rose-50 dark:bg-rose-950/50 rounded" />
                      <div className="h-3.5 w-2/3 bg-rose-50 dark:bg-rose-950/50 rounded" />
                    </div>
                  ))}
                </div>
              ) : activeTab === 'mentions' ? (
                mentionsList.length === 0 ? (
                  <div className="py-20 text-center bg-white dark:bg-[#140e1a] rounded-3xl border-2 border-dashed border-rose-200 dark:border-rose-950 p-8 font-serif">
                    <AtSign className="w-10 h-10 mx-auto mb-3 text-rose-300 dark:text-rose-800" />
                    <p className="font-bold text-lg text-gray-800 dark:text-rose-200">No Literary Citations Yet</p>
                    <p className="text-xs text-gray-500 mt-1 italic">When other authors and reviewers mention this novelist, their reviews will appear here.</p>
                  </div>
                ) : (
                  mentionsList.map((note: any, idx: number) => {
                    const cleanMsg = (note.msg || '').replace(/<[^>]*>/g, '').trim();
                    return (
                      <div 
                        key={note.id || idx}
                        className="p-6 rounded-3xl bg-white dark:bg-[#140e1a] border border-rose-200/80 dark:border-rose-900/50 shadow-sm space-y-2.5 font-serif"
                      >
                        <div className="flex items-center justify-between text-xs text-rose-500">
                          <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            Literary Mention
                          </span>
                          <span>{note.date ? new Date(note.date).toLocaleDateString() : ''}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 dark:text-rose-100 leading-relaxed italic">
                          "{cleanMsg}"
                        </p>
                      </div>
                    );
                  })
                )
              ) : subsequentChapters.length === 0 && !leadChapter ? (
                <div className="py-20 text-center bg-white dark:bg-[#140e1a] rounded-3xl border-2 border-dashed border-rose-200 dark:border-rose-950 p-8 font-serif">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 text-rose-300 dark:text-rose-800" />
                  <p className="font-bold text-lg text-gray-800 dark:text-rose-200">No Manuscripts Recorded</p>
                  <p className="text-xs text-gray-500 mt-1 italic">The novelist has not filed any stories under this section yet.</p>
                </div>
              ) : (
                subsequentChapters.map((post, index) => {
                  const rawThumb = getPostThumbnail(post);
                  const thumb = rawThumb ? getSafeImageUrl(rawThumb, { width: 600 }) : null;
                  const snippet = getPostSnippet(post.body || '', 220);
                  const isCommentOrReply = activeTab === 'comments' || activeTab === 'replies';

                  return (
                    <article
                      key={post.post_id || `${post.author}/${post.permlink}-${index}`}
                      className="group p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#140e1a] border border-rose-200/70 dark:border-rose-950 hover:border-rose-400 dark:hover:border-rose-500/70 hover:shadow-lg hover:shadow-rose-500/5 transition-all duration-300"
                    >
                      <div className="flex flex-col sm:flex-row gap-5 items-start">
                        {/* Story Vignette (Image) */}
                        {!isCommentOrReply && thumb && (
                          <div 
                            onClick={() => onSelectPost(post)}
                            className="w-full sm:w-44 md:w-52 h-40 sm:h-36 rounded-2xl overflow-hidden shrink-0 relative bg-slate-900 border border-rose-100 dark:border-rose-950 cursor-pointer group/thumb shadow-xs"
                          >
                            <img 
                              src={thumb} 
                              alt={post.title} 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                          </div>
                        )}

                        {/* Chapter Details */}
                        <div className="flex-1 min-w-0 w-full space-y-2">
                          
                          {/* Parent context for comments */}
                          {isCommentOrReply && post.parent_author && (
                            <div className="text-xs font-serif text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-3 py-1 rounded-lg w-fit mb-1 border border-rose-200 dark:border-rose-900/40">
                              <span>In correspondence with </span>
                              <button
                                type="button"
                                onClick={() => openAuthorProfile(post.parent_author || '')}
                                className="font-bold underline hover:text-rose-700 cursor-pointer"
                              >
                                @{post.parent_author}
                              </button>
                            </div>
                          )}

                          {/* Kicker & Reading Time */}
                          <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-serif font-black text-[10px] uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-md border border-rose-200/60 dark:border-rose-900/40">
                                #{post.category || 'prose'}
                              </span>
                              <span className="text-rose-200 dark:text-rose-900">•</span>
                              <span className="text-gray-500 dark:text-rose-300/60 font-serif text-[11px] italic">
                                {new Date(post.created).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>

                            <span className="text-[11px] font-serif italic text-gray-500 dark:text-rose-300/70 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-rose-400" />
                              {calculateReadingMinutes(post.body || '')}
                            </span>
                          </div>

                          {/* Chapter Title */}
                          {post.title && !post.title.startsWith('RE:') && (
                            <h3 
                              onClick={() => onSelectPost(post)}
                              className="font-serif text-lg sm:text-xl font-bold leading-snug text-gray-900 dark:text-rose-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors cursor-pointer line-clamp-2"
                            >
                              {post.title}
                            </h3>
                          )}

                          {/* Excerpt */}
                          <p className="font-serif text-xs sm:text-sm text-[#4b3c35] dark:text-[#d3c2cb] leading-relaxed line-clamp-2 italic">
                            "{snippet || post.body}"
                          </p>

                          {/* Interaction bar */}
                          <div className="pt-3 border-t border-rose-100 dark:border-rose-950/80 flex items-center justify-between flex-wrap gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onVote?.(post, 10000); }}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50/80 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors font-bold cursor-pointer"
                              >
                                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
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
                                title="Share Chapter"
                              >
                                <Repeat className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => onSelectPost(post)}
                                className="text-rose-600 dark:text-rose-400 font-serif font-black hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <span>Read Chapter</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Quick reply bar for correspondence */}
                          {activeTab === 'replies' && (
                            <div className="mt-3 pt-2.5 border-t border-rose-100 dark:border-rose-950 w-full" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder={`Inscribe a reply to @${post.author}...`}
                                  value={replyTexts[post.permlink] || ''}
                                  onChange={(e) => setReplyTexts(prev => ({ ...prev, [post.permlink]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSendReply(post);
                                    }
                                  }}
                                  className="flex-1 bg-white dark:bg-[#0c0810] border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder-rose-400/60 focus:outline-none focus:border-rose-500 font-serif italic"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSendReply(post)}
                                  disabled={submittingReply[post.permlink] || !replyTexts[post.permlink]?.trim()}
                                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer disabled:opacity-40"
                                >
                                  {submittingReply[post.permlink] ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Send className="w-3.5 h-3.5" />
                                  )}
                                  <span>Send Epistle</span>
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
                  <div className="flex items-center gap-2 text-xs font-serif italic text-rose-500">
                    <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                    <span>Turning pages...</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onLoadMore}
                    className="px-6 py-2.5 rounded-full border border-rose-300 dark:border-rose-800 hover:bg-rose-100/60 dark:hover:bg-rose-950 font-serif font-bold text-xs cursor-pointer transition shadow-xs"
                  >
                    Load More Chapters
                  </button>
                )}
              </div>
            )}
          </main>

          {/* ============================================================== */}
          {/* THE NOVELIST STUDY & LITERARY ATELIER (Sidebar)                */}
          {/* ============================================================== */}
          <aside className="space-y-6 lg:sticky lg:top-24 w-full">
            
            {/* Author's Preface Dossier */}
            <div className="bg-white dark:bg-[#140e1a] border border-rose-200/80 dark:border-rose-950 rounded-3xl p-6 shadow-md relative overflow-hidden font-serif">
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                  <PenTool className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-black text-base text-gray-950 dark:text-rose-100">
                    The Author's Study
                  </h3>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-serif italic">
                    Novelist & Storyteller
                  </p>
                </div>
              </div>

              {/* Bio / Preface */}
              <p className="text-xs sm:text-sm text-[#4b3c35] dark:text-[#d3c2cb] leading-relaxed border-t border-b border-rose-100 dark:border-rose-950 py-3 my-3 italic">
                "{metaProfile.about || "Writing love stories that linger between the pages of time, weaving emotion and prose on the blockchain."}"
              </p>

              {/* Geographical & Web Location */}
              <div className="space-y-2.5 text-xs font-serif text-[#6e584f] dark:text-rose-200/80">
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>{metaProfile.location || "The Rose Garden Atelier"}</span>
                </div>

                {metaProfile.website && (
                  <div className="flex items-center gap-2.5">
                    <LinkIcon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <a 
                      href={String(metaProfile.website).startsWith('http') ? String(metaProfile.website) : `https://${String(metaProfile.website)}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-rose-600 dark:text-rose-400 hover:underline truncate"
                    >
                      {String(metaProfile.website).replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-2.5">
                  <Calendar className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>
                    Inscribing prose since {account?.created ? new Date(account.created).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '2021'}
                  </span>
                </div>
              </div>

              {/* Circulation & Reader Metrics */}
              <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-rose-100 dark:border-rose-950 text-center">
                <div className="p-2.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40">
                  <p className="font-serif font-black text-base text-gray-950 dark:text-rose-100">{postCount || 0}</p>
                  <p className="text-[9px] uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400">Chapters</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40">
                  <p className="font-serif font-black text-base text-rose-600 dark:text-rose-400">{followerCount || 0}</p>
                  <p className="text-[9px] uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400">Devoted Readers</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40">
                  <p className="font-serif font-black text-base text-purple-600 dark:text-purple-400">{followingCount || 0}</p>
                  <p className="text-[9px] uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400">Fellow Authors</p>
                </div>
              </div>
            </div>

            {/* Romance Tropes & Themes Covered Box */}
            {tropesList.length > 0 && (
              <div className="bg-white dark:bg-[#140e1a] border border-rose-200/80 dark:border-rose-950 rounded-3xl p-5 shadow-xs font-serif">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-950 dark:text-rose-100 mb-3 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                  Literary Tropes & Genres
                </h4>
                <div className="flex flex-wrap gap-2">
                  {tropesList.map(t => (
                    <span 
                      key={t}
                      className="text-xs font-serif italic px-3 py-1 rounded-full bg-rose-50/70 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/40 hover:border-rose-400 transition-colors"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Inscribed Reader Promise */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-rose-50 via-pink-50/50 to-amber-50/30 dark:from-rose-950/30 dark:to-purple-950/20 border border-rose-200/70 dark:border-rose-900/50 text-[#4b3c35] dark:text-rose-200 text-xs font-serif leading-relaxed">
              <div className="flex items-center gap-2 font-black uppercase tracking-wider text-[10px] mb-2 text-rose-700 dark:text-rose-300">
                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                The Novelist's Promise
              </div>
              <p className="italic">
                "Every romance chapter, poem, and reader epistle is immutably published upon the Hive blockchain — words penned to outlive transient platforms and remain forever in the hearts of readers."
              </p>
            </div>

          </aside>

        </div>
      </div>

      {/* Romantic Literary Footer */}
      <footer className="py-12 text-center border-t border-rose-200/60 dark:border-rose-950 bg-white/50 dark:bg-[#0c0810] font-serif">
        <p className="text-xs font-serif italic text-rose-800/80 dark:text-rose-300/80 tracking-widest">
          ❦ Inscribed by @{account?.name} • Published Forever on the Hive Blockchain ❦
        </p>
      </footer>
    </div>
  );
};

export const authorTheme: ProfileTheme = {
  id: 'author-essayist',
  name: 'Author & Novelist',
  badge: '✍️ Romance Novelist',
  description: 'Enchanting romantic salon with parchment tones, velvet rose accents, and book cover showcases',
  previewColor: '#be123c',
  light: {
    ...DEFAULT_PROFILE_STYLE,
    structure: 'editorial-magazine',
    fontFamily: 'serif',
    backgroundColor: '#faf6f0',
    cardBackgroundColor: '#ffffff',
    headerBackgroundColor: '#faf6f0',
    textColor: '#29221d',
    textSecondaryColor: '#6e584f',
    accentColor: '#e11d48'
  },
  dark: {
    ...DEFAULT_PROFILE_STYLE,
    structure: 'editorial-magazine',
    fontFamily: 'serif',
    backgroundColor: '#0c0810',
    cardBackgroundColor: '#140e1a',
    headerBackgroundColor: '#0c0810',
    textColor: '#f3e8ee',
    textSecondaryColor: '#a8969f',
    accentColor: '#fb7185'
  },
  Layout: AuthorLayout
};

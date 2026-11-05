import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Image, 
  Eye, 
  Maximize2, 
  Sparkles, 
  Heart, 
  MessageCircle, 
  Repeat, 
  Award, 
  MapPin, 
  Calendar, 
  Link as LinkIcon, 
  ArrowRight, 
  UserPlus, 
  UserMinus, 
  Settings, 
  Volume2, 
  VolumeX, 
  AtSign, 
  Loader2, 
  Send, 
  X, 
  Grid, 
  Sliders, 
  Clock,
  Layers,
  FileText
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

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

export const PhotographerLayout: React.FC<ThemeProps> = (props) => {
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
  const coverImage = metaProfile.cover_image ? getSafeImageUrl(metaProfile.cover_image, { width: 1600 }) : null;

  // View mode: 'grid' (2-3 columns) vs 'immersive' (large horizontal gallery cards)
  const [galleryViewMode, setGalleryViewMode] = useState<'grid' | 'immersive'>('grid');

  // Lightbox preview modal state
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string; post: HivePost } | null>(null);

  // Quick reply state for guestbook / critiques
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
        setReplyFeedback(prev => ({ ...prev, [post.permlink]: 'Critique submitted!' }));
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
  
  // Find centerpiece: first post that has an image thumbnail
  const centerpiecePost = (activeTab === 'blog' || activeTab === 'posts') && displayPosts.length > 0 
    ? (displayPosts.find(p => getPostThumbnail(p)) || displayPosts[0]) 
    : null;

  const galleryItems = centerpiecePost 
    ? displayPosts.filter(p => (p.post_id || p.permlink) !== (centerpiecePost.post_id || centerpiecePost.permlink))
    : displayPosts;

  // Extract photography genres / topics
  const photographyThemes = Array.from(
    new Set(
      (posts || [])
        .map(p => p.category)
        .filter(Boolean)
    )
  ).slice(0, 8);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#070b12] text-slate-900 dark:text-slate-100 transition-colors duration-300 selection:bg-emerald-500/20 selection:text-emerald-900 dark:selection:text-emerald-200">
      
      {/* Container aligned with Navbar max-w-7xl */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">

        {/* Gallery Pavilion Exhibition Banner */}
        <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-gray-200/80 dark:border-slate-800/80 bg-slate-900 min-h-[240px] sm:min-h-[290px] flex items-end">
          {coverImage ? (
            <img 
              src={coverImage} 
              alt="Gallery Pavilion" 
              className="absolute inset-0 w-full h-full object-cover opacity-75"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-slate-900 to-cyan-950 opacity-90" />
          )}

          {/* Cinematic Vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20 pointer-events-none" />

          {/* Top Exhibition Hall Marker */}
          <div className="absolute top-3 inset-x-4 sm:inset-x-8 flex items-center justify-between text-[10px] sm:text-xs font-mono uppercase tracking-widest text-emerald-300/90 z-10 border-b border-white/10 pb-2">
            <span className="flex items-center gap-1.5 font-bold">
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              THE HIVE VISUAL EXHIBITION & FINE ART SALON
            </span>
            <span className="hidden sm:inline text-white/60">
              CURATORIAL GRADE • REPUTATION {reputation}
            </span>
          </div>

          {/* Banner Main Content: Lens Artist Identity */}
          <div className="relative z-20 w-full p-4 sm:p-8 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4">
            
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6 text-center sm:text-left">
              {/* Camera Viewfinder Avatar Frame */}
              <div className="relative shrink-0 group/lens">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-white/90 dark:border-slate-700 shadow-2xl overflow-hidden bg-slate-950 ring-4 ring-emerald-500/30">
                  <img 
                    src={avatarUrl} 
                    alt={account?.name || ''} 
                    className="w-full h-full object-cover group-hover/lens:scale-105 transition-transform duration-500"
                  />
                </div>
                {/* Viewfinder crosshairs overlay icon */}
                <span className="absolute -bottom-1 -right-1 p-1 rounded-lg bg-emerald-500 text-white shadow-md border-2 border-[#070b12]">
                  <Camera className="w-3.5 h-3.5" />
                </span>
              </div>

              {/* Artist Name & Curation Statement */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white drop-shadow-md">
                    {metaProfile.name || account?.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-200 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30 backdrop-blur-xs">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    Lens Artist & Curator
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-200 font-medium max-w-xl">
                  @{account?.name} • {metaProfile.about || "Curating fine-art photography, street landscapes, and visual stories captured across the globe."}
                </p>
              </div>
            </div>

            {/* Actions: Follow / Customizer */}
            <div className="flex items-center gap-2.5 shrink-0 pb-1">
              {isOwner ? (
                <button
                  type="button"
                  onClick={onOpenCustomizer}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/20 text-xs font-bold transition-all cursor-pointer shadow-lg active:scale-95"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Curator's Studio</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onFollowToggle}
                    className={`inline-flex items-center gap-2 px-5 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-lg active:scale-95 ${
                      isFollowing
                        ? 'bg-white/15 hover:bg-rose-500/40 text-white backdrop-blur-md border border-white/20'
                        : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-emerald-500/25'
                    }`}
                  >
                    {isFollowing ? <Eye className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                    <span>{isFollowing ? 'Patron Following' : 'Follow Gallery'}</span>
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
                      title={isMuted ? 'Unmute Artist' : 'Mute Artist'}
                    >
                      {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </>
              )}
            </div>

          </div>
        </div>

        {/* Gallery Wings Navigation Bar (Tabs) */}
        <div className="flex flex-wrap items-center justify-between border-b border-gray-200/80 dark:border-slate-800 pb-2 my-6 gap-3">
          
          {/* Wings Selection */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'blog', label: 'Curated Exhibition', icon: Camera, desc: 'Selected works' },
              { id: 'posts', label: 'Full Portfolio', icon: Layers, desc: 'Complete archives' },
              { id: 'comments', label: 'Critiques & Guestbook', icon: MessageCircle, desc: 'Visitor notes' },
              { id: 'replies', label: 'Artist Dialogue', icon: Repeat, desc: 'Curator responses' },
              { id: 'mentions', label: 'Press & Citations', icon: AtSign, desc: 'External reviews' }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-sm font-extrabold ring-1 ring-black/10 dark:ring-emerald-400/40'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* View Mode Toggle: Grid vs Immersive */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800/80 p-1 rounded-xl border border-gray-200/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setGalleryViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                galleryViewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900'
              }`}
              title="Gallery Grid View"
            >
              <Grid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>

            <button
              type="button"
              onClick={() => setGalleryViewMode('immersive')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                galleryViewMode === 'immersive'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900'
              }`}
              title="Immersive Showcase View"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Immersive</span>
            </button>
          </div>

        </div>

        {/* ============================================================== */}
        {/* MAIN EXHIBITION HALL: Gallery Wall + Curator's Studio          */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_350px] gap-8 lg:gap-10 items-start pb-24">
          
          {/* Main Exhibition Works Column */}
          <main className="space-y-8 min-w-0">
            
            {/* EXHIBITION CENTERPIECE / GRAND MASTERPIECE */}
            {centerpiecePost && !tabLoading && (
              <div className="group rounded-3xl bg-white dark:bg-[#0c111d] border border-gray-200/80 dark:border-slate-800 shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:border-emerald-500/40">
                {/* Centerpiece Image Frame with Lightbox Zoom Trigger */}
                {(() => {
                  const thumb = getPostThumbnail(centerpiecePost);
                  const safeThumb = thumb ? getSafeImageUrl(thumb, { width: 1200 }) : null;
                  if (!safeThumb) return null;
                  return (
                    <div className="relative w-full h-[320px] sm:h-[420px] bg-black overflow-hidden cursor-pointer group/art">
                      <img 
                        src={safeThumb} 
                        alt={centerpiecePost.title} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover/art:scale-105"
                        onClick={() => onSelectPost(centerpiecePost)}
                      />
                      
                      {/* Dark Vignette Overlay on Hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover/art:opacity-80 transition-opacity" />

                      {/* Top Badges */}
                      <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/70 text-emerald-400 backdrop-blur-md border border-emerald-500/30 text-xs font-mono font-bold uppercase tracking-wider">
                          <Award className="w-3.5 h-3.5" />
                          Exhibition Centerpiece
                        </span>
                      </div>

                      {/* Quick Fullscreen Lightbox Trigger */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxImage({ url: safeThumb, title: centerpiecePost.title, post: centerpiecePost });
                        }}
                        className="absolute top-4 right-4 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer z-10 hover:scale-110"
                        title="View Fullscreen Lightbox"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>

                      {/* Caption Plaque on Hero Bottom */}
                      <div className="absolute bottom-4 inset-x-4 sm:inset-x-6 z-10">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold block mb-1">
                          #{centerpiecePost.category || 'photography'} • {formatDate(centerpiecePost.created)}
                        </span>
                        <h2 
                          onClick={() => onSelectPost(centerpiecePost)}
                          className="text-xl sm:text-2xl lg:text-3xl font-black text-white hover:text-emerald-300 transition-colors cursor-pointer drop-shadow-md line-clamp-2"
                        >
                          {centerpiecePost.title}
                        </h2>
                      </div>
                    </div>
                  );
                })()}

                {/* Museum Exhibition Placard underneath Centerpiece */}
                <div className="p-5 sm:p-6 bg-white dark:bg-[#0c111d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-gray-100 dark:border-slate-800">
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {getPostSnippet(centerpiecePost.body || '', 200)}
                    </p>
                    <div className="flex items-center gap-3 text-xs font-mono text-gray-500 dark:text-slate-400 pt-1">
                      <span>Capture Date: {formatDate(centerpiecePost.created)}</span>
                      <span>•</span>
                      <span>Optics: Prime Lens</span>
                    </div>
                  </div>

                  {/* Placard Actions */}
                  <div className="flex items-center gap-3 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onVote?.(centerpiecePost, 10000)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-gray-700 dark:text-slate-300 hover:text-rose-600 transition-colors font-bold text-xs cursor-pointer"
                    >
                      <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                      <span>{centerpiecePost.active_votes?.length || 0}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectPost(centerpiecePost)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:text-blue-500 transition-colors font-bold text-xs cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                      <span>{centerpiecePost.children || 0}</span>
                    </button>

                    <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/20">
                      ${Number(centerpiecePost.pending_payout_value?.split(' ')[0] || centerpiecePost.payout || 0).toFixed(2)}
                    </span>

                    <button
                      type="button"
                      onClick={() => onSelectPost(centerpiecePost)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      <span>Explore Work</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* GALLERY WALL: Works Showcase */}
            {tabLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="rounded-3xl bg-white dark:bg-[#0c111d] border border-gray-200 dark:border-slate-800 p-4 animate-pulse space-y-3">
                    <div className="w-full h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
                    <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-3.5 w-1/2 bg-slate-200 dark:bg-slate-800 rounded" />
                  </div>
                ))}
              </div>
            ) : activeTab === 'mentions' ? (
              mentionsList.length === 0 ? (
                <div className="py-20 text-center bg-white dark:bg-[#0c111d] rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-800 p-8">
                  <AtSign className="w-10 h-10 mx-auto mb-3 text-emerald-500/60" />
                  <p className="font-bold text-base text-gray-800 dark:text-slate-200">No Gallery Reviews Recorded</p>
                  <p className="text-xs text-gray-500 mt-1">Citations from external art publications and critics will appear here.</p>
                </div>
              ) : (
                mentionsList.map((note: any, idx: number) => {
                  const cleanMsg = (note.msg || '').replace(/<[^>]*>/g, '').trim();
                  return (
                    <div 
                      key={note.id || idx}
                      className="p-5 rounded-2xl bg-white dark:bg-[#0c111d] border border-gray-200 dark:border-slate-800 shadow-sm space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                        <span className="font-bold uppercase tracking-wider">Art Critic Citation</span>
                        <span>{note.date ? new Date(note.date).toLocaleDateString() : ''}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-200 leading-relaxed">
                        {cleanMsg}
                      </p>
                    </div>
                  );
                })
              )
            ) : galleryItems.length === 0 && !centerpiecePost ? (
              <div className="py-20 text-center bg-white dark:bg-[#0c111d] rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-800 p-8">
                <Image className="w-10 h-10 mx-auto mb-3 text-emerald-500/60" />
                <p className="font-bold text-base text-gray-800 dark:text-slate-200">The Exhibition Wall Is Prepared</p>
                <p className="text-xs text-gray-500 mt-1">No photographic works have been cataloged in this collection yet.</p>
              </div>
            ) : (
              <div className={
                galleryViewMode === 'grid'
                  ? "grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6"
                  : "space-y-6"
              }>
                {galleryItems.map((post, index) => {
                  const rawThumb = getPostThumbnail(post);
                  const thumb = rawThumb ? getSafeImageUrl(rawThumb, { width: 800 }) : null;
                  const snippet = getPostSnippet(post.body || '', 180);
                  const isCommentOrReply = activeTab === 'comments' || activeTab === 'replies';

                  return (
                    <article
                      key={post.post_id || `${post.author}/${post.permlink}-${index}`}
                      className="group rounded-3xl bg-white dark:bg-[#0c111d] border border-gray-200/80 dark:border-slate-800/80 hover:border-emerald-500/50 dark:hover:border-emerald-500/40 hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between"
                    >
                      {/* Photo Display / Museum Frame */}
                      {!isCommentOrReply && thumb ? (
                        <div 
                          className="relative w-full h-56 sm:h-64 bg-slate-950 overflow-hidden cursor-pointer group/card"
                          onClick={() => onSelectPost(post)}
                        >
                          <img 
                            src={thumb} 
                            alt={post.title} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-40 group-hover/card:opacity-80 transition-opacity" />

                          {/* Quick Lightbox Enlarge Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxImage({ url: thumb, title: post.title, post });
                            }}
                            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 hover:bg-black text-white backdrop-blur-xs opacity-0 group-hover/card:opacity-100 transition-all cursor-pointer hover:scale-110"
                            title="Expand in Lightbox"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Category Tag pill over image */}
                          <span className="absolute bottom-3 left-3 text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-md bg-black/70 text-emerald-300 border border-emerald-500/20 backdrop-blur-xs">
                            #{post.category || 'art'}
                          </span>
                        </div>
                      ) : !isCommentOrReply ? (
                        /* Text Work Vignette Placeholder */
                        <div 
                          onClick={() => onSelectPost(post)}
                          className="w-full h-40 bg-gradient-to-br from-emerald-950/20 via-slate-900/10 to-teal-950/20 dark:from-slate-900 dark:to-[#080d16] p-4 flex flex-col justify-between border-b border-gray-100 dark:border-slate-800 cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                            <span className="font-bold uppercase tracking-wider">Typographic Work</span>
                            <span>#{post.category || 'text'}</span>
                          </div>
                          <FileText className="w-8 h-8 text-emerald-500/40" />
                          <span className="text-[10px] font-mono text-gray-400">View Catalog Entry &rarr;</span>
                        </div>
                      ) : null}

                      {/* Work Details & Title */}
                      <div className="p-4 sm:p-5 space-y-2 flex-1 flex flex-col justify-between">
                        <div className="space-y-1.5">
                          {/* Parent context for comments */}
                          {isCommentOrReply && post.parent_author && (
                            <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-md w-fit mb-1 border border-emerald-200 dark:border-emerald-900/40">
                              <span>In critique of </span>
                              <button
                                type="button"
                                onClick={() => openAuthorProfile(post.parent_author || '')}
                                className="font-bold underline hover:text-emerald-700 cursor-pointer"
                              >
                                @{post.parent_author}
                              </button>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 font-mono">
                            <span>{formatDate(post.created)}</span>
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3 text-emerald-500" />
                              Art Piece
                            </span>
                          </div>

                          {post.title && !post.title.startsWith('RE:') && (
                            <h3 
                              onClick={() => onSelectPost(post)}
                              className="text-base sm:text-lg font-bold leading-snug text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors cursor-pointer line-clamp-2"
                            >
                              {post.title}
                            </h3>
                          )}

                          <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                            {snippet || post.body}
                          </p>
                        </div>

                        {/* Museum Placard Interaction Footer */}
                        <div className="pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onVote?.(post, 10000); }}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:text-rose-500 transition-colors font-bold cursor-pointer"
                            >
                              <Heart className="w-3.5 h-3.5 text-rose-500" />
                              <span>{post.active_votes?.length || 0}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onSelectPost(post)}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:text-blue-500 transition-colors font-bold cursor-pointer"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                              <span>{post.children || 0}</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onReblog?.(post); }}
                              className="p-1 rounded-lg bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
                              title="Re-exhibit Work"
                            >
                              <Repeat className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            ${Number(post.pending_payout_value?.split(' ')[0] || post.payout || 0).toFixed(2)}
                          </span>
                        </div>

                        {/* Quick dialogue reply bar for artist correspondence */}
                        {activeTab === 'replies' && (
                          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-800/80 w-full" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder={`Critique reply to @${post.author}...`}
                                value={replyTexts[post.permlink] || ''}
                                onChange={(e) => setReplyTexts(prev => ({ ...prev, [post.permlink]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendReply(post);
                                  }
                                }}
                                className="flex-1 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleSendReply(post)}
                                disabled={submittingReply[post.permlink] || !replyTexts[post.permlink]?.trim()}
                                className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer disabled:opacity-40"
                              >
                                {submittingReply[post.permlink] ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Send className="w-3.5 h-3.5" />
                                )}
                                <span>Send</span>
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
                    </article>
                  );
                })}
              </div>
            )}

            {/* Pagination Sentinel */}
            {hasMore !== false && displayPosts.length > 0 && (
              <div className="py-8 flex justify-center items-center">
                {loadingMore ? (
                  <div className="flex items-center gap-2 text-xs font-mono uppercase text-emerald-600 dark:text-emerald-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading further visual pieces...</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onLoadMore}
                    className="px-6 py-2.5 rounded-full border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 font-mono font-bold text-xs cursor-pointer transition shadow-xs uppercase tracking-wider"
                  >
                    Load More Exhibition Pieces
                  </button>
                )}
              </div>
            )}
          </main>

          {/* ============================================================== */}
          {/* THE CURATOR'S STUDIO & DARKROOM (Sidebar)                      */}
          {/* ============================================================== */}
          <aside className="space-y-6 lg:sticky lg:top-24 w-full">
            
            {/* Artist Dossier Card */}
            <div className="bg-white dark:bg-[#0c111d] border border-gray-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-md relative overflow-hidden">
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                    The Curator's Studio
                  </h3>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                    Visual Storyteller Folio
                  </p>
                </div>
              </div>

              {/* Bio Statement */}
              <p className="text-xs sm:text-sm text-gray-700 dark:text-slate-300 leading-relaxed border-t border-b border-gray-100 dark:border-slate-800 py-3 my-3 italic">
                "{metaProfile.about || "Curating fine-art photography, street landscapes, and visual stories captured across the globe."}"
              </p>

              {/* Studio Geographical & Web details */}
              <div className="space-y-2.5 text-xs text-gray-600 dark:text-slate-400">
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>{metaProfile.location || "Global Light Atelier"}</span>
                </div>

                {metaProfile.website && (
                  <div className="flex items-center gap-2.5">
                    <LinkIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <a 
                      href={String(metaProfile.website).startsWith('http') ? String(metaProfile.website) : `https://${String(metaProfile.website)}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-emerald-600 dark:text-emerald-400 hover:underline truncate"
                    >
                      {String(metaProfile.website).replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-2.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>
                    Exhibiting on Hive since {account?.created ? new Date(account.created).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '2021'}
                  </span>
                </div>
              </div>

              {/* Collection Counters */}
              <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-gray-100 dark:border-slate-800 text-center font-mono">
                <div className="p-2.5 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
                  <p className="font-extrabold text-base text-gray-900 dark:text-white">{postCount || 0}</p>
                  <p className="text-[9px] uppercase tracking-wider text-gray-500">Exhibits</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
                  <p className="font-extrabold text-base text-emerald-600 dark:text-emerald-400">{followerCount || 0}</p>
                  <p className="text-[9px] uppercase tracking-wider text-gray-500">Patrons</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
                  <p className="font-extrabold text-base text-cyan-600 dark:text-cyan-400">{followingCount || 0}</p>
                  <p className="text-[9px] uppercase tracking-wider text-gray-500">Allies</p>
                </div>
              </div>
            </div>

            {/* Visual Themes & Disciplines Box */}
            {photographyThemes.length > 0 && (
              <div className="bg-white dark:bg-[#0c111d] border border-gray-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5 text-emerald-500" />
                  Exhibition Disciplines
                </h4>
                <div className="flex flex-wrap gap-2">
                  {photographyThemes.map(t => (
                    <span 
                      key={t}
                      className="text-xs font-mono px-3 py-1 rounded-full bg-gray-100 dark:bg-slate-800/80 text-gray-700 dark:text-slate-300 border border-gray-200/70 dark:border-slate-700/60 hover:border-emerald-500 transition-colors"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Provenance & Digital Negative Certificate */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-50 via-teal-50/50 to-slate-50 dark:from-emerald-950/30 dark:via-slate-900 dark:to-cyan-950/20 border border-emerald-200/70 dark:border-emerald-900/50 text-gray-800 dark:text-emerald-200 text-xs leading-relaxed">
              <div className="flex items-center gap-2 font-black uppercase tracking-wider text-[10px] mb-2 text-emerald-700 dark:text-emerald-300">
                <Award className="w-3.5 h-3.5" />
                Immutable Provenance Certificate
              </div>
              <p>
                Every photograph, high-resolution original, and gallery critique is cryptographically authored with Hive Keychain and permanently anchored to the decentralized ledger.
              </p>
            </div>

          </aside>

        </div>
      </div>

      {/* FULLSCREEN LIGHTBOX MODAL */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          {/* Lightbox Top Bar */}
          <div className="w-full max-w-5xl flex items-center justify-between text-white pb-3" onClick={(e) => e.stopPropagation()}>
            <div className="min-w-0 pr-4">
              <h3 className="font-bold text-base sm:text-lg truncate">{lightboxImage.title}</h3>
              <p className="text-xs text-emerald-400 font-mono">Exhibition Lightbox View • @{lightboxImage.post.author}</p>
            </div>

            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
              title="Close Lightbox"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Lightbox Main Image */}
          <div className="my-auto max-w-5xl max-h-[75vh] flex items-center justify-center p-2" onClick={(e) => e.stopPropagation()}>
            <img 
              src={lightboxImage.url} 
              alt={lightboxImage.title}
              className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl border border-white/10" 
            />
          </div>

          {/* Lightbox Bottom Controls */}
          <div className="w-full max-w-5xl pt-3 flex items-center justify-between text-white text-xs" onClick={(e) => e.stopPropagation()}>
            <span className="font-mono text-white/70">
              Captured: {formatDate(lightboxImage.post.created)} • ${Number(lightboxImage.post.pending_payout_value?.split(' ')[0] || lightboxImage.post.payout || 0).toFixed(2)}
            </span>

            <button
              type="button"
              onClick={() => {
                const targetPost = lightboxImage.post;
                setLightboxImage(null);
                onSelectPost(targetPost);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold transition-all cursor-pointer"
            >
              <span>View Full Story</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Gallery Footer */}
      <footer className="py-12 text-center border-t border-gray-200/80 dark:border-slate-800/80 bg-white dark:bg-[#070b12]">
        <p className="text-xs font-mono uppercase text-gray-500 dark:text-slate-400 tracking-widest">
          The Hive Visual Pavilion • Curated by @{account?.name} • All Visual Negatives Recorded
        </p>
      </footer>
    </div>
  );
};

export const photographerTheme: ProfileTheme = {
  id: 'photographer-folio',
  name: 'Visual Storyteller',
  badge: '📸 Gallery Exhibition',
  description: 'Contemporary fine-art photo gallery with museum centerpiece, fullscreen lightbox, and exhibition grid',
  previewColor: '#10b981',
  light: {
    ...DEFAULT_PROFILE_STYLE,
    structure: 'hero-wide',
    backgroundColor: '#f8fafc',
    cardBackgroundColor: '#ffffff',
    headerBackgroundColor: '#f8fafc',
    textColor: '#0f172a',
    textSecondaryColor: '#64748b',
    accentColor: '#10b981'
  },
  dark: {
    ...DEFAULT_PROFILE_STYLE,
    structure: 'hero-wide',
    backgroundColor: '#070b12',
    cardBackgroundColor: '#0c111d',
    headerBackgroundColor: '#070b12',
    textColor: '#f8fafc',
    textSecondaryColor: '#94a3b8',
    accentColor: '#34d399'
  },
  Layout: PhotographerLayout
};

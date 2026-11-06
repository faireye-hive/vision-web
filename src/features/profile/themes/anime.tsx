import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Flame, 
  Tv, 
  Heart, 
  MessageCircle, 
  Repeat, 
  MapPin, 
  Calendar, 
  Zap, 
  Swords, 
  Share2, 
  Send, 
  Layers, 
  Award, 
  Play, 
  Sliders, 
  Star, 
  UserPlus, 
  UserMinus, 
  Settings, 
  Link as LinkIcon, 
  Hash, 
  ChevronRight, 
  Loader2,
  Clock,
  Radio,
  Gamepad2,
  Volume2,
  VolumeX,
  Compass,
  Film,
  Shield
} from 'lucide-react';
import { ProfileTheme, ThemeProps } from './themeTypes';
import { getHiveAvatarUrl, getPostThumbnail, getPostSnippet, HivePost } from '../../../services/hiveApi';
import { DEFAULT_PROFILE_STYLE } from '../profileStyleTypes';
import { useNavigation } from '../../../context/NavigationContext';
import { getSafeImageUrl } from '../../../utils/sanitize';
import animeSceneryBg from '../../../assets/images/anime_scenery_background_1793208969751.jpg';

// Helper hook for responsive screen size
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

// Calculate Anime Guild Rank & Level based on Hive Reputation
const getAnimeRank = (rep: number) => {
  if (rep >= 75) return { rank: 'SSS-Rank Master', kanji: '超越者', color: 'from-amber-400 to-rose-500', title: 'Legendary Guild Leader' };
  if (rep >= 65) return { rank: 'S-Rank Protagonist', kanji: '勇者', color: 'from-rose-500 to-purple-600', title: 'Elite Shonen Hero' };
  if (rep >= 55) return { rank: 'A-Rank Veteran', kanji: '上級冒険者', color: 'from-indigo-500 to-cyan-400', title: 'Guild Veteran' };
  if (rep >= 40) return { rank: 'B-Rank Adventurer', kanji: '中級戦士', color: 'from-emerald-400 to-teal-500', title: 'Rising Champion' };
  return { rank: 'Novice Recruit', kanji: '見習い', color: 'from-blue-400 to-indigo-500', title: 'Apprentice Adventurer' };
};

export const AnimeLayout: React.FC<ThemeProps> = (props) => {
  const isMobile = useIsMobile();
  const { 
    account, 
    profile, 
    blog, 
    posts, 
    comments, 
    replies, 
    mentions, 
    history,
    reputation, 
    votingPower, 
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

  const { openAuthorProfile, openCommunity } = useNavigation();
  const metaProfile = profile?.metadata?.profile || {};
  const avatarUrl = getHiveAvatarUrl(account?.name || '', 'large');
  const customCover = metaProfile.cover_image ? getSafeImageUrl(metaProfile.cover_image, { width: 1600 }) : null;
  const rankInfo = getAnimeRank(reputation);

  // Background toggle between generic cinematic anime scenery and custom cover
  const [useSceneryBackdrop, setUseSceneryBackdrop] = useState(true);
  const activeBg = useSceneryBackdrop ? animeSceneryBg : (customCover || animeSceneryBg);

  // Genre / Anime tags filter state
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [quickReplyText, setQuickReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});

  // Popular anime tags for fan community
  const animeGenres = [
    { id: 'all', label: 'All Releases', kanji: 'すべて' },
    { id: 'anime', label: 'Anime & Seasonal', kanji: 'アニメ' },
    { id: 'gaming', label: 'Gaming & RPGs', kanji: 'ゲーム' },
    { id: 'manga', label: 'Manga & Light Novels', kanji: '漫画' },
    { id: 'art', label: 'Fan Art & Cosplay', kanji: 'アート' },
    { id: 'review', label: 'Episode Reviews', kanji: 'レビュー' }
  ];

  // Resolve current active item collection
  const allCollection: HivePost[] = 
    activeTab === 'comments' ? comments : 
    activeTab === 'replies' ? replies : 
    activeTab === 'posts' ? posts : 
    (blog && blog.length > 0 ? blog : posts);

  // Filter collection by genre tag if applicable
  const displayedPosts = allCollection.filter(post => {
    if (selectedTag === 'all') return true;
    const cat = (post.category || '').toLowerCase();
    const title = (post.title || '').toLowerCase();
    const body = (post.body || '').toLowerCase();
    return cat.includes(selectedTag) || title.includes(selectedTag) || body.includes(selectedTag);
  });

  // Spotlight Premier Episode (First post in blog/posts)
  const premierePost = (blog && blog.length > 0 ? blog[0] : posts[0]) || null;
  const premiereThumbnail = premierePost ? (getPostThumbnail(premierePost) || activeBg) : activeBg;

  // Handle voting
  const handleVote = async (e: React.MouseEvent, post: HivePost) => {
    e.stopPropagation();
    const key = `${post.author}/${post.permlink}`;
    setLikedPosts(prev => ({ ...prev, [key]: true }));
    if (onVote) {
      await onVote(post, 10000);
    }
  };

  // Handle quick fan club transmission
  const handleSendFanTransmission = async () => {
    if (!quickReplyText.trim() || !premierePost || !onCommentReply) return;
    setSendingReply(true);
    try {
      const ok = await onCommentReply(premierePost, quickReplyText);
      if (ok) {
        setQuickReplyText('');
        setReplySuccess(true);
        setTimeout(() => setReplySuccess(false), 3000);
      }
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans selection:bg-rose-500/30 selection:text-rose-200 relative overflow-x-hidden">
      
      {/* Anime Ambience Particles & Background Scenery */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 opacity-20 dark:opacity-25 blur-[1px] scale-105"
          style={{ backgroundImage: `url(${activeBg})` }}
        />
        {/* Neon Gradient Vignette that pairs with navbar */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#070b14]/70 via-[#070b14]/90 to-[#070b14]" />
        
        {/* Subtle Cyberpunk-Sakura Ambient Light Flares */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-20 space-y-8">
        
        {/* Top Anime Fan Portal Banner */}
        <header className="relative rounded-3xl overflow-hidden border border-rose-500/20 dark:border-rose-500/30 bg-slate-900/60 backdrop-blur-2xl shadow-2xl shadow-rose-950/20">
          
          {/* Hero Scenery Banner */}
          <div className="relative h-64 sm:h-80 md:h-96 w-full overflow-hidden group">
            <img 
              src={activeBg} 
              alt="Anime Scenery Backdrop" 
              className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-1000 ease-out"
            />
            {/* Dynamic Scenery Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/60" />

            {/* Anime HUD Watermark & Coordinates */}
            <div className="absolute top-4 left-6 flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/70 border border-rose-500/40 text-rose-300 text-xs font-mono tracking-wider backdrop-blur-md shadow-lg">
                <Radio className="w-3.5 h-3.5 animate-pulse text-rose-400" />
                ON-AIR • アニメ放送中
              </span>
              <span className="hidden sm:inline-block text-[11px] font-mono text-slate-300/80 tracking-widest bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10">
                CH-HIVE://SECTOR-7
              </span>
            </div>

            {/* Background Switcher (Scenery vs Custom) */}
            {customCover && (
              <div className="absolute top-4 right-6">
                <button
                  onClick={() => setUseSceneryBackdrop(!useSceneryBackdrop)}
                  className="px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs font-mono border border-slate-700/80 backdrop-blur-md flex items-center gap-2 transition-colors shadow-lg"
                  title="Toggle between generic anime scenery and user cover"
                >
                  <Film className="w-3.5 h-3.5 text-rose-400" />
                  <span>{useSceneryBackdrop ? 'Custom Cover' : 'Anime Scenery'}</span>
                </button>
              </div>
            )}

            {/* Floating Japanese Calligraphy Watermark */}
            <div className="absolute bottom-6 right-6 pointer-events-none select-none hidden md:block">
              <div className="text-right">
                <p className="text-3xl font-black tracking-widest text-white/10 font-serif">
                  新次元・ファンサークル
                </p>
                <p className="text-xs font-mono text-rose-400/30 uppercase tracking-[0.3em]">
                  Anime & Gaming Collective
                </p>
              </div>
            </div>
          </div>

          {/* Profile Identity Bar & Guild Master Passport */}
          <div className="px-6 sm:px-10 pb-8 pt-0 -mt-16 sm:-mt-20 relative z-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              
              {/* Avatar + Main Titles */}
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 text-center sm:text-left">
                
                {/* Anime Holographic Avatar Frame */}
                <div className="relative group">
                  <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl p-1 bg-gradient-to-tr from-rose-500 via-purple-500 to-cyan-400 shadow-xl shadow-rose-500/20 group-hover:shadow-rose-500/40 transition-all duration-300">
                    <div className="w-full h-full rounded-[14px] overflow-hidden bg-slate-950 relative">
                      <img 
                        src={avatarUrl} 
                        alt={account?.name || 'Anime Fan'} 
                        className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => {
                          // Fallback if avatar fails
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  
                  {/* Guild Rank Badge */}
                  <div className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase text-white bg-gradient-to-r ${rankInfo.color} border border-white/20 shadow-lg flex items-center gap-1`}>
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>{rankInfo.rank.split(' ')[0]}</span>
                  </div>
                </div>

                {/* Identity & Metadata */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight flex items-center gap-2">
                      <span>{metaProfile.name || account?.name}</span>
                    </h1>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      @{account?.name}
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      REP {reputation}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 max-w-xl line-clamp-2 italic">
                    {metaProfile.about || "Otaku by day, anime critic by night. Exploring the multiverse of animation, manga, and interactive worlds. ✨"}
                  </p>

                  {/* Micro Metadata */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-slate-400 pt-1 font-mono">
                    {metaProfile.location && (
                      <span className="flex items-center gap-1 text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-rose-400" />
                        {metaProfile.location}
                      </span>
                    )}
                    {metaProfile.website && (
                      <a 
                        href={metaProfile.website.startsWith('http') ? metaProfile.website : `https://${metaProfile.website}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-1 text-rose-400 hover:text-rose-300 transition-colors"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        Website
                      </a>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Joined {account?.created ? new Date(account.created).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Season 1'}
                    </span>
                  </div>
                </div>

              </div>

              {/* Action Controls & Guild Joining */}
              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 pt-2 md:pt-0">
                {isOwner ? (
                  <button
                    onClick={onOpenCustomizer}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-700/80 shadow-lg flex items-center gap-2 transition-all active:scale-95"
                  >
                    <Settings className="w-4 h-4 text-rose-400" />
                    <span>Customize Guild</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={onFollowToggle}
                      className={`px-6 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all duration-300 flex items-center gap-2 shadow-lg active:scale-95 ${
                        isFollowing 
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700' 
                          : 'bg-gradient-to-r from-rose-500 via-pink-500 to-purple-600 hover:from-rose-600 hover:to-purple-700 text-white border border-rose-400/40 shadow-rose-500/25'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserMinus className="w-4 h-4 text-slate-400" />
                          <span>Joined Party</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 text-white" />
                          <span>Join Party • 仲間になる</span>
                        </>
                      )}
                    </button>

                    {onMuteToggle && (
                      <button
                        onClick={onMuteToggle}
                        title={isMuted ? 'Unmute Transmission' : 'Mute Transmission'}
                        className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/80 transition-colors"
                      >
                        {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                    )}
                  </>
                )}
              </div>

            </div>

            {/* Anime Mana & Guild Counters Strip */}
            <div className="mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
              
              {/* Mana Gauge (Voting Power) */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1 text-cyan-400 font-bold">
                    <Zap className="w-3.5 h-3.5" />
                    MANA / KI
                  </span>
                  <span>{votingPower}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, votingPower))}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-400 mt-1">Voting Energy</span>
              </div>

              {/* Guild Members (Followers) */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
                <span className="text-[11px] font-mono text-rose-400 font-bold flex items-center gap-1">
                  <Swords className="w-3.5 h-3.5" />
                  PARTY MEMBERS
                </span>
                <span className="text-xl font-extrabold text-white font-mono mt-1">
                  {followerCount.toLocaleString()}
                </span>
                <span className="text-[10px] font-mono text-slate-400">Followers</span>
              </div>

              {/* Allied Guilds (Following) */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
                <span className="text-[11px] font-mono text-purple-400 font-bold flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5" />
                  ALLIED GUILDS
                </span>
                <span className="text-xl font-extrabold text-white font-mono mt-1">
                  {followingCount.toLocaleString()}
                </span>
                <span className="text-[10px] font-mono text-slate-400">Following</span>
              </div>

              {/* Chronicles Published (Posts) */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
                <span className="text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  CHRONICLES
                </span>
                <span className="text-xl font-extrabold text-white font-mono mt-1">
                  {postCount.toLocaleString()}
                </span>
                <span className="text-[10px] font-mono text-slate-400">Total Posts</span>
              </div>

            </div>

          </div>
        </header>

        {/* Featured Episode Showcase (Premiere Spotlight) */}
        {premierePost && activeTab !== 'history' && (
          <section className="relative rounded-3xl overflow-hidden border border-rose-500/20 bg-gradient-to-r from-slate-950 via-slate-900/90 to-slate-950 p-6 sm:p-8 backdrop-blur-xl shadow-xl">
            <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
              
              {/* Anime 16:9 Screen / Poster Frame */}
              <div 
                onClick={() => onSelectPost(premierePost)}
                className="w-full lg:w-5/12 aspect-video rounded-2xl overflow-hidden border border-rose-500/30 relative group cursor-pointer shadow-2xl flex-shrink-0 bg-slate-950"
              >
                <img 
                  src={premiereThumbnail} 
                  alt={premierePost.title}
                  className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
                
                {/* Anime Broadcast Play Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-rose-500/90 text-white flex items-center justify-center shadow-lg shadow-rose-500/50 group-hover:scale-110 transition-transform">
                    <Play className="w-6 h-6 fill-white translate-x-0.5" />
                  </div>
                </div>

                {/* Corner Tags */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-950/80 border border-rose-500/40 text-[10px] font-mono font-bold text-rose-300">
                  EPISODE 01 • PREMIERE
                </div>
                <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-white/90">
                  FHD 1080P
                </div>
              </div>

              {/* Premiere Details & Synopsis */}
              <div className="flex-1 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    FEATURED BROADCAST • 今週のイチオシ
                  </span>
                  <span className="text-slate-600">/</span>
                  <span className="text-xs font-mono text-slate-400">
                    {new Date(premierePost.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>

                <h2 
                  onClick={() => onSelectPost(premierePost)}
                  className="text-xl sm:text-2xl lg:text-3xl font-black text-white hover:text-rose-400 transition-colors cursor-pointer leading-snug line-clamp-2"
                >
                  『 {premierePost.title} 』
                </h2>

                <p className="text-sm text-slate-300 line-clamp-3 leading-relaxed">
                  {getPostSnippet(premierePost.body || '', 240)}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <button 
                      onClick={(e) => handleVote(e, premierePost)}
                      className="flex items-center gap-1.5 text-slate-300 hover:text-rose-400 transition-colors"
                    >
                      <Heart className={`w-4 h-4 ${likedPosts[`${premierePost.author}/${premierePost.permlink}`] ? 'fill-rose-500 text-rose-500' : ''}`} />
                      <span>{premierePost.active_votes?.length || 0} SUGOI</span>
                    </button>
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <MessageCircle className="w-4 h-4 text-indigo-400" />
                      <span>{premierePost.children} Fan Notes</span>
                    </span>
                  </div>

                  <button
                    onClick={() => onSelectPost(premierePost)}
                    className="px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-rose-500 hover:bg-rose-600 text-white transition-all shadow-lg shadow-rose-500/25 flex items-center gap-1.5"
                  >
                    <span>Read Chronicle</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          </section>
        )}

        {/* Main Grid: Content Feeds vs Otaku Guild Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Feed Section (8 cols) */}
          <main className="lg:col-span-8 space-y-6">
            
            {/* Anime Channel Navigation Tabs */}
            <div className="rounded-2xl p-1.5 bg-slate-900/80 border border-slate-800 backdrop-blur-xl flex flex-wrap gap-1 shadow-lg">
              {[
                { id: 'blog', label: 'Broadcast Log', kanji: '放送録', icon: Tv },
                { id: 'posts', label: 'Manga Archives', kanji: '全巻', icon: Layers },
                { id: 'comments', label: 'Fan Club Desk', kanji: '掲示板', icon: MessageCircle },
                { id: 'replies', label: 'Voice Actor Chat', kanji: '返信', icon: Radio },
                { id: 'history', label: 'Quest Radar', kanji: '履歴', icon: Flame }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      isActive 
                        ? 'bg-gradient-to-r from-rose-500 to-purple-600 text-white shadow-md shadow-rose-500/20' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    <span className="hidden sm:inline-block text-[10px] opacity-75 font-serif font-normal">
                      {tab.kanji}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Anime Subgenre Filter Tags (Interactive Buttons) */}
            {activeTab !== 'history' && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none text-xs">
                {animeGenres.map(genre => (
                  <button
                    key={genre.id}
                    onClick={() => setSelectedTag(genre.id)}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all font-mono text-[11px] flex items-center gap-1.5 border ${
                      selectedTag === genre.id
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm'
                        : 'bg-slate-900/50 hover:bg-slate-800 text-slate-400 border-slate-800/80 hover:text-slate-200'
                    }`}
                  >
                    <span>{genre.label}</span>
                    <span className="text-[9px] opacity-70">[{genre.kanji}]</span>
                  </button>
                ))}
              </div>
            )}

            {/* Feed Content Stream */}
            <div className="space-y-4">
              {tabLoading ? (
                <div className="py-24 text-center space-y-3 rounded-3xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-xl">
                  <Loader2 className="w-8 h-8 animate-spin text-rose-500 mx-auto" />
                  <p className="text-xs font-mono uppercase tracking-widest text-slate-400">
                    Transmitting from anime database...
                  </p>
                </div>
              ) : activeTab === 'history' ? (
                /* History / Activity Radar */
                <div className="space-y-3">
                  {history.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 rounded-3xl border border-slate-800 bg-slate-900/40">
                      No quest activity recorded yet.
                    </div>
                  ) : (
                    history.slice(0, 30).map((item, idx) => (
                      <div 
                        key={idx}
                        className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 flex items-center gap-4 hover:border-rose-500/30 transition-colors backdrop-blur-md"
                      >
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500/20 to-purple-500/20 border border-rose-500/30 flex items-center justify-center font-mono font-bold text-xs text-rose-300">
                          #{idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-rose-400 uppercase">
                              {item[1]?.op?.[0] || 'Quest Action'}
                            </span>
                            <span className="text-slate-600">·</span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {new Date(item[1]?.timestamp || Date.now()).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 font-mono truncate mt-0.5">
                            Block Action: {JSON.stringify(item[1]?.op?.[1] || {}).slice(0, 80)}...
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : displayedPosts.length === 0 ? (
                <div className="py-24 text-center space-y-3 rounded-3xl border border-dashed border-slate-800 bg-slate-900/30">
                  <Film className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-medium text-slate-400">
                    No broadcasts found for this frequency.
                  </p>
                  <p className="text-xs text-slate-500">
                    Try switching filters or check back for new seasonal releases.
                  </p>
                </div>
              ) : (
                /* Post Cards (Anime Episode Format) */
                displayedPosts.map((post, idx) => {
                  const thumbnail = getPostThumbnail(post);
                  const isReblog = post.author.toLowerCase() !== account?.name.toLowerCase();
                  const isLiked = likedPosts[`${post.author}/${post.permlink}`];

                  return (
                    <article
                      key={`${post.author}/${post.permlink}-${idx}`}
                      onClick={() => onSelectPost(post)}
                      className="group rounded-2xl border border-slate-800/80 hover:border-rose-500/40 bg-slate-900/60 hover:bg-slate-900/90 p-5 transition-all duration-300 cursor-pointer backdrop-blur-xl shadow-lg relative overflow-hidden flex flex-col sm:flex-row gap-5"
                    >
                      {/* Left Episode Thumbnail (16:9) */}
                      {thumbnail ? (
                        <div className="w-full sm:w-52 aspect-video rounded-xl overflow-hidden border border-slate-800 flex-shrink-0 relative bg-slate-950">
                          <img 
                            src={thumbnail} 
                            alt={post.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" 
                          />
                          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-mono text-rose-300 border border-rose-500/30">
                            EP {String(idx + 1).padStart(2, '0')}
                          </div>
                        </div>
                      ) : (
                        <div className="w-full sm:w-52 aspect-video rounded-xl border border-slate-800/80 bg-gradient-to-tr from-slate-950 to-slate-900 flex-shrink-0 flex items-center justify-center relative">
                          <Tv className="w-8 h-8 text-slate-700 group-hover:text-rose-500 transition-colors" />
                          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-mono text-slate-400">
                            LOG {String(idx + 1).padStart(2, '0')}
                          </div>
                        </div>
                      )}

                      {/* Content Body */}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div>
                          {/* Quiet Metadata Header (Anti-slop, unboxed text) */}
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400 mb-1.5">
                            <span className="text-rose-400 font-bold uppercase">{post.category || 'anime'}</span>
                            <span aria-hidden="true">·</span>
                            <span>{new Date(post.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            {isReblog && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-purple-400 font-bold">REBLOGGED FROM @{post.author}</span>
                              </>
                            )}
                          </div>

                          <h3 className="text-lg font-bold text-white group-hover:text-rose-400 transition-colors leading-snug line-clamp-2">
                            『 {post.title} 』
                          </h3>

                          <p className="text-xs text-slate-400 line-clamp-2 mt-2 leading-relaxed">
                            {getPostSnippet(post.body || '', 160)}
                          </p>
                        </div>

                        {/* Interactive Footer Controls */}
                        <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-800/80 text-xs font-mono">
                          <div className="flex items-center gap-4">
                            <button
                              onClick={(e) => handleVote(e, post)}
                              className={`flex items-center gap-1.5 transition-colors ${
                                isLiked ? 'text-rose-500 font-bold' : 'text-slate-400 hover:text-rose-400'
                              }`}
                            >
                              <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-rose-500' : ''}`} />
                              <span>{post.active_votes?.length || 0}</span>
                            </button>

                            <span className="flex items-center gap-1.5 text-slate-400">
                              <MessageCircle className="w-3.5 h-3.5 text-indigo-400" />
                              <span>{post.children}</span>
                            </span>

                            {!isReblog && onReblog && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onReblog(post); }}
                                className="flex items-center gap-1 text-slate-400 hover:text-purple-400 transition-colors"
                              >
                                <Repeat className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Broadcast</span>
                              </button>
                            )}
                          </div>

                        </div>
                      </div>

                    </article>
                  );
                })
              )}

              {/* Load More Trigger */}
              {hasMore && activeTab !== 'history' && (
                <div className="pt-6 flex justify-center">
                  <button
                    onClick={onLoadMore}
                    disabled={loadingMore}
                    className="px-8 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-rose-500/30 text-rose-300 font-bold text-xs uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Summoning Next Chapter...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Load Next Arc (More Posts)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

          </main>

          {/* Otaku Guild Dossier Sidebar (4 cols) */}
          <aside className="lg:col-span-4 space-y-6">
            
            {/* Guild Member License Card */}
            <div className="rounded-2xl border border-rose-500/30 bg-slate-900/70 backdrop-blur-xl p-6 shadow-xl relative overflow-hidden">
              {/* Background Japanese Seal Stamp */}
              <div className="absolute top-4 right-4 w-16 h-16 rounded-full border-2 border-red-500/20 flex items-center justify-center select-none pointer-events-none rotate-12">
                <span className="text-[10px] font-black font-serif text-red-500/40 leading-none text-center">
                  公認<br />認可
                </span>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-300">
                  Otaku Guild Passport • 冒険者証
                </h3>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-slate-400 font-mono text-[11px] block">GUILD CLASS & TITLE</span>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {rankInfo.rank}
                  </p>
                  <p className="text-[11px] text-rose-400/80 font-mono">
                    {rankInfo.title}
                  </p>
                </div>

                <div className="border-t border-slate-800 pt-3">
                  <span className="text-slate-400 font-mono text-[11px] block">CHARACTER LORE</span>
                  <p className="text-slate-300 italic mt-1 leading-relaxed text-[11px]">
                    "{metaProfile.about || "A wandering traveler who records legendary narratives across the blockchain realm."}"
                  </p>
                </div>

                <div className="border-t border-slate-800 pt-3 space-y-2">
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                    <span>GUILD RANK</span>
                    <span className="text-white font-bold">{rankInfo.kanji}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                    <span>REPUTATION SCORE</span>
                    <span className="text-rose-400 font-bold">{reputation} REP</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                    <span>REGISTERED REALM</span>
                    <span className="text-slate-200">{metaProfile.location || 'Neo Tokyo / Web3'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Favorite Anime Disciplines & Tropes */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl p-6 shadow-xl space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-purple-400" />
                <span>Specialized Genres • 専門分野</span>
              </h3>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  '#Shonen',
                  '#Cyberpunk',
                  '#Isekai',
                  '#SliceOfLife',
                  '#Mecha',
                  '#Gaming',
                  '#JRPG',
                  '#StudioGhibli',
                  '#MangaArt'
                ].map((tag, i) => (
                  <span 
                    key={i}
                    className="px-2.5 py-1 rounded-md bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-300 hover:border-rose-500/40 hover:text-rose-300 transition-colors"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Fast Transmission Dispatcher (Fan Club Message) */}
            {premierePost && onCommentReply && !isOwner && (
              <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-slate-900/90 to-slate-950 p-5 shadow-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-rose-400" />
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-300">
                    Fan Club Transmission • 送信
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400">
                  Send a quick encouragement note to @{account?.name}'s featured chronicle.
                </p>
                
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={quickReplyText}
                    onChange={(e) => setQuickReplyText(e.target.value)}
                    placeholder="Sugoi! Loved this release... ✨"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 focus:border-rose-500/50 text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                  />
                  <button
                    onClick={handleSendFanTransmission}
                    disabled={sendingReply || !quickReplyText.trim()}
                    className="w-full py-2 rounded-xl bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-600 hover:to-purple-700 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {sendingReply ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{sendingReply ? 'Transmitting...' : 'Dispatch Fan Note'}</span>
                  </button>
                  {replySuccess && (
                    <p className="text-[11px] text-emerald-400 font-mono text-center">
                      Transmission sent to blockchain!
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Authentic Blockchain Hanko Stamp */}
            <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/40 text-center space-y-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">
                IMMUTABLE OTUKU NETWORK
              </span>
              <p className="text-[11px] text-slate-300 font-mono">
                Decentralized on Hive Blockchain • Zero Centralized Gatekeepers
              </p>
            </div>

          </aside>

        </div>

      </div>

      {/* Anime Footer */}
      <footer className="py-10 text-center border-t border-slate-900 bg-slate-950/90 text-slate-400 text-xs font-mono">
        <p className="tracking-widest uppercase">
          新次元 • ANIME & GAMING ARCHIVES • POWERED BY HIVE
        </p>
      </footer>

    </div>
  );
};

export const animeTheme: ProfileTheme = {
  id: 'anime-gaming-fan',
  name: 'Anime & Gaming Fan',
  badge: '🎌 Anime Fan Hub',
  description: 'Authentic Japanese anime & gaming fan page with scenic twilight backdrop, guild passport, and episode streams',
  previewColor: '#f43f5e',
  light: {
    ...DEFAULT_PROFILE_STYLE,
    structure: 'hero-wide',
    backgroundColor: '#070b14',
    cardBackgroundColor: '#0f172a',
    headerBackgroundColor: '#070b14',
    textColor: '#f8fafc',
    textSecondaryColor: '#94a3b8',
    accentColor: '#f43f5e'
  },
  dark: {
    ...DEFAULT_PROFILE_STYLE,
    structure: 'hero-wide',
    backgroundColor: '#070b14',
    cardBackgroundColor: '#0f172a',
    headerBackgroundColor: '#070b14',
    textColor: '#f8fafc',
    textSecondaryColor: '#94a3b8',
    accentColor: '#fb7185'
  },
  Layout: AnimeLayout
};

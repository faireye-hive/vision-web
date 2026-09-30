import React from 'react';
import { 
  Heart, 
  MessageCircle, 
  Repeat, 
  MapPin, 
  Calendar,
  Sparkles,
  Gamepad2,
  Trophy,
  Users
} from 'lucide-react';
import { ProfileTheme, ThemeProps } from './themeTypes';
import { getHiveAvatarUrl, getPostThumbnail, getPostSnippet } from '../../../services/hiveApi';
import { DEFAULT_PROFILE_STYLE } from '../profileStyleTypes';

/**
 * THEME: Anime & Games (Inspired by the provided screenshot)
 */

const AnimeLayout: React.FC<ThemeProps> = (props) => {
  const { 
    account, 
    profile, 
    posts, 
    comments, 
    replies,
    isOwner, 
    isFollowing, 
    onFollowToggle, 
    onOpenCustomizer, 
    activeTab, 
    setActiveTab, 
    history, 
    loadingMore, 
    onLoadMore, 
    onSelectPost,
    onVote,
    onReblog,
    reputation,
    votingPower,
    followerCount,
    followingCount,
    postCount
  } = props;

  const metaProfile = profile?.metadata?.profile || {};
  const avatarUrl = getHiveAvatarUrl(account?.name || '', 'large');

  const tabs = [
    { id: 'posts', label: 'POSTS' },
    { id: 'comments', label: 'COMMENTS' },
    { id: 'replies', label: 'REPLIES' },
    { id: 'history', label: 'ACTIVITY' }
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8f9ff] font-['Pangolin'] text-slate-900">
      {/* Sidebar */}
      <aside className="w-full md:w-[320px] bg-[#f0f2ff] border-r-2 border-slate-900 p-6 flex flex-col gap-6">
        {/* Avatar Area */}
        <div className="relative">
          <div className="aspect-square rounded-[40px] bg-rose-400 border-[3px] border-slate-900 overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group">
            <div className="w-full h-full bg-white/20 p-2">
               <div className="w-full h-full rounded-[32px] bg-white border-2 border-slate-900 overflow-hidden relative">
                  <img 
                    src={avatarUrl} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    alt="Avatar" 
                  />
               </div>
            </div>
          </div>
          {/* Voting Power Badge */}
          <div className="absolute bottom-4 right-2 bg-slate-800 text-white text-xs font-mono px-2 py-1 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            {votingPower}%
          </div>
        </div>

        {/* Bio Box */}
        <div className="bg-white rounded-3xl border-[3px] border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
          <h3 className="text-xl font-bold text-indigo-600 mb-2 flex items-center gap-2">
            Moshi Moshi! <Sparkles className="w-4 h-4" />
          </h3>
          <p className="text-sm leading-relaxed text-slate-600 italic">
            {metaProfile.about || "Just a piece of time, but our actions echo for eternity. ✨ Anime enthusiast & Content Creator."}
          </p>
        </div>

        {/* Details Box */}
        <div className="bg-white rounded-3xl border-[3px] border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-3">
          {metaProfile.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-rose-500" />
              <span className="font-bold">Location:</span> {metaProfile.location}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-indigo-500" />
            <span className="font-bold">Joined:</span> {account?.created ? new Date(account.created).toLocaleDateString() : 'Unknown'}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-emerald-500" />
            <span className="font-bold">{followerCount}</span> Followers • <span className="font-bold">{followingCount}</span> Following
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          {isOwner ? (
            <button 
              onClick={onOpenCustomizer}
              className="w-full py-3 rounded-2xl bg-white border-[3px] border-slate-900 font-bold text-slate-900 hover:bg-slate-50 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1"
            >
              EDIT PROFILE
            </button>
          ) : (
            <button 
              onClick={onFollowToggle}
              className={`w-full py-3 rounded-2xl font-bold border-[3px] border-slate-900 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 ${
                isFollowing ? 'bg-slate-100 text-slate-500' : 'bg-rose-400 text-white hover:bg-rose-500'
              }`}
            >
              {isFollowing ? 'UNFOLLOW' : 'FOLLOW'}
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 relative overflow-hidden">
        {/* Background Hex Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
        
        {/* Header */}
        <div className="relative mb-10">
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 tracking-tight mb-4 drop-shadow-sm">
            {metaProfile.name || account?.name}
          </h1>
          <div className="inline-block bg-rose-400 border-2 border-slate-900 px-3 py-1 text-white font-mono text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            @{account?.name}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-8 mb-8 border-b-2 border-slate-100 font-mono text-sm">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 px-1 transition-all relative font-bold ${
                activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-[-2px] left-0 right-0 h-1 bg-indigo-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content Feed */}
        <div className="space-y-6">
          {(() => {
            const list = activeTab === 'comments' ? comments : 
                         activeTab === 'replies' ? replies : 
                         activeTab === 'history' ? [] : posts;
            
            if (list.length === 0 && !loadingMore && activeTab !== 'history') {
              return (
                <div className="py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl font-bold">
                  Nothing found here yet... 
                </div>
              );
            }

            if (activeTab === 'history') {
              return (
                <div className="space-y-4">
                  {history.length === 0 ? (
                     <div className="py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl font-bold">
                        No activity found.
                     </div>
                  ) : (
                    history.slice(0, 25).map((item, idx) => (
                      <div key={idx} className="bg-white rounded-2xl border-[3px] border-slate-900 p-4 text-sm flex items-center gap-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                        <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center border-2 border-slate-900 font-bold text-rose-600">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <span className="font-bold text-indigo-600 uppercase text-[10px] tracking-widest">{item[1]?.op?.[0] || 'Operation'}</span>
                          <p className="text-slate-500 text-xs mt-0.5">{new Date(item[1]?.timestamp || Date.now()).toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            }

            return list.map((post, idx) => {
              const thumbnail = getPostThumbnail(post);
              const snippet = getPostSnippet(post.body || '', 180);
              const isReblog = post.author.toLowerCase() !== account?.name.toLowerCase();
              
              return (
                <div 
                  key={`${post.author}/${post.permlink}-${idx}`}
                  className="bg-white rounded-[32px] border-[3px] border-slate-900 p-5 md:p-6 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-2px] transition-all cursor-pointer group flex flex-col md:flex-row gap-6 overflow-hidden"
                  onClick={() => onSelectPost(post)}
                >
                  {/* Thumbnail Area */}
                  {thumbnail && (
                    <div className="w-full md:w-56 h-40 md:h-32 rounded-2xl border-2 border-slate-900 overflow-hidden flex-shrink-0 relative">
                      <img src={thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Post" />
                    </div>
                  )}

                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 border border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase">
                          {post.category}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {new Date(post.created).toLocaleDateString()}
                        </span>
                        {isReblog && (
                           <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                             REBLOG @{post.author}
                           </span>
                        )}
                      </div>
                      <h2 className="text-2xl font-bold text-indigo-600 mb-2 leading-tight group-hover:text-rose-500 transition-colors">
                        {post.title}
                      </h2>
                      <p className="text-slate-600 text-sm line-clamp-2 leading-relaxed">
                        {snippet}
                      </p>
                    </div>

                    <div className="mt-4 pt-4 border-t-2 border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onVote?.(post, 10000); }}
                          className="flex items-center gap-1.5 hover:text-rose-500 transition-colors font-bold text-xs"
                        >
                          <Heart className="w-4 h-4" />
                          <span>{post.active_votes?.length || 0}</span>
                        </button>
                        <button className="flex items-center gap-1.5 hover:text-indigo-500 transition-colors font-bold text-xs">
                          <MessageCircle className="w-4 h-4" />
                          <span>{post.children}</span>
                        </button>
                        {!isReblog && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onReblog?.(post); }}
                            className="flex items-center gap-1.5 hover:text-emerald-500 transition-colors font-bold text-xs"
                          >
                            <Repeat className="w-4 h-4" />
                            <span>REBLOG</span>
                          </button>
                        )}
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        ${Number(post.pending_payout_value?.split(' ')[0] || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            });
          })()}

          {/* Load More */}
          {(activeTab === 'posts' || activeTab === 'comments' || activeTab === 'replies') && (
            <div className="pt-10 flex justify-center">
              <button 
                onClick={onLoadMore}
                disabled={loadingMore}
                className="px-10 py-4 rounded-2xl bg-indigo-500 border-[3px] border-slate-900 text-white font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-indigo-600 transition-all active:shadow-none active:translate-x-1 active:translate-y-1 disabled:opacity-50"
              >
                {loadingMore ? 'SUMMONING MORE...' : 'LOAD MORE POSTS'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export const animeTheme: ProfileTheme = {
  id: 'anime-gaming-fan',
  name: 'Anime & Gaming Fan',
  badge: '🎌 Anime & Gamers',
  description: 'Playful handwritten aesthetic with thick borders, bright boxes and manga-style layout',
  previewColor: '#f43f5e',
  light: {
    ...DEFAULT_PROFILE_STYLE,
    structure: 'sidebar-portrait',
    fontFamily: 'handwritten',
    accentColor: '#f43f5e',
    borderRadius: '3xl',
  },
  dark: {
    ...DEFAULT_PROFILE_STYLE,
    structure: 'sidebar-portrait',
    fontFamily: 'handwritten',
    backgroundColor: '#0f172a',
    cardBackgroundColor: '#1e293b',
    textColor: '#f1f5f9',
    textSecondaryColor: '#94a3b8',
    accentColor: '#fb7185',
    borderRadius: '3xl',
  },
  Layout: AnimeLayout
};

import React from 'react';
import { 
  Terminal, 
  Cpu, 
  Database, 
  Activity, 
  Code2, 
  Globe, 
  ShieldCheck,
  Zap,
  Hash,
  MessageCircle,
} from 'lucide-react';
import { ProfileTheme, ThemeProps } from './themeTypes';
import { getHiveAvatarUrl, getPostThumbnail } from '../../../services/hiveApi';
import { DEFAULT_PROFILE_STYLE } from '../profileStyleTypes';

const TechLayout: React.FC<ThemeProps> = (props) => {
  const { account, posts, comments, replies, reputation, votingPower, activeTab, setActiveTab, onSelectPost, onVote, onReblog, onLoadMore, loadingMore } = props;
  const avatarUrl = getHiveAvatarUrl(account?.name || '', 'large');

  return (
    <div className="font-mono text-slate-300 bg-slate-950 min-h-screen selection:bg-indigo-500/30 selection:text-white">
      <header className="border-b border-indigo-500/20 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-white font-black text-sm tracking-tighter uppercase">Node Explorer</h2>
              <div className="flex items-center gap-2 text-[10px] text-indigo-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                SYSTEM ONLINE • REPUTATION: {reputation}
              </div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            {(['posts', 'comments', 'history'] as const).map(t => (
              <button 
                key={`tab-${t}`}
                onClick={() => setActiveTab(t)}
                className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${activeTab === t ? 'text-indigo-400' : 'hover:text-white text-slate-500'}`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-12">
          <aside className="space-y-8">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000" />
              <div className="relative bg-slate-900 border border-slate-800 rounded-3xl p-8">
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-indigo-500/50 rotate-3 group-hover:rotate-0 transition-transform duration-500">
                      <img src={avatarUrl} className="w-full h-full object-cover" alt="Node Avatar" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-slate-950 border border-indigo-500 p-2 rounded-lg text-indigo-400">
                      <Cpu className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h1 className="text-2xl font-black text-white tracking-tight italic">@{account?.name}</h1>
                  <p className="text-xs text-slate-500 leading-relaxed font-bold">
                    {props.profile?.metadata?.profile?.about || "Standard developer node."}
                  </p>
                </div>
                
                <div className="mt-8 space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className="text-slate-500 text-xs">Voting Power</span>
                    <span className="text-indigo-400">{votingPower}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${votingPower}%` }} />
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-600 uppercase mb-1">Followers</p>
                    <p className="text-lg font-black text-white">{props.followerCount}</p>
                  </div>
                  <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-600 uppercase mb-1">Posts</p>
                    <p className="text-lg font-black text-white">{props.postCount}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/30 border border-slate-800/50 rounded-3xl p-6">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                <Hash className="w-3 h-3" /> Core Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {(['blockchain', 'development', 'hive', 'web3'] as const).map((tag, idx) => (
                  <span key={`${tag}-${idx}`} className="px-3 py-1 bg-slate-800 text-indigo-300 text-[10px] font-bold rounded-md border border-slate-700">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </aside>

          <main className="space-y-6">
            <div key="main-header" className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px bg-slate-800" />
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">Active Repositories</div>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            <div key="posts-list" className="space-y-6">
              {posts.map((post, index) => {
                const thumb = getPostThumbnail(post);
                return (
                  <div 
                    key={post.post_id || `${post.author}/${post.permlink}-${index}`}
                    onClick={() => onSelectPost(post)}
                    className="group relative bg-slate-900 border border-slate-800 rounded-3xl p-6 hover:border-indigo-500/50 transition-all cursor-pointer overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity">
                      <Code2 className="w-12 h-12 text-indigo-500" />
                    </div>
                    
                    <div className="relative flex flex-col md:flex-row gap-6">
                      {thumb && (
                        <div className="w-full md:w-48 h-32 rounded-xl overflow-hidden shrink-0 border border-slate-800">
                          <img src={thumb} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt="Preview" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 text-indigo-400 text-[10px] font-black tracking-widest uppercase">
                          <Activity className="w-3 h-3" />
                          <span>{post.category}</span>
                          <span className="text-slate-600">•</span>
                          <span>{new Date(post.created).toLocaleDateString()}</span>
                        </div>
                        <h3 className="text-xl font-black text-white group-hover:text-indigo-400 transition-colors mb-4 tracking-tight leading-tight">
                          {post.title}
                        </h3>
                        <div className="flex items-center gap-6 mt-auto">
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                            <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span>{post.active_votes?.length || 0} Votes</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                            <MessageCircle className="w-3 h-3 text-indigo-500" />
                            <span>{post.children} Commits</span>
                          </div>
                          <div className="ml-auto flex items-center gap-1 text-[10px] font-black text-emerald-400">
                            <Database className="w-3 h-3" />
                            ${Number(post.pending_payout_value?.split(' ')[0] || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        </div>
      </div>

      <footer className="py-20 border-t border-slate-900 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8 opacity-20 hover:opacity-100 transition-opacity duration-1000">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-indigo-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Distributed Network Node</span>
          </div>
          <div className="flex items-center gap-6">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Encryption Standard Enabled</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const techTheme: ProfileTheme = {
  id: 'tech-crypto-blog',
  name: 'Tech & Crypto Explorer',
  badge: '💻 Blockchain & Dev',
  description: 'Split sidebar with blockchain finance metrics, monospace headers and code styling',
  previewColor: '#6366f1',
  light: {
    ...DEFAULT_PROFILE_STYLE,
    structure: 'split-columns',
    fontFamily: 'mono',
    accentColor: '#6366f1',
    borderRadius: 'xl',
  },
  dark: {
    ...DEFAULT_PROFILE_STYLE,
    structure: 'split-columns',
    fontFamily: 'mono',
    accentColor: '#818cf8',
    borderRadius: 'xl',
    backgroundColor: '#0a0f1d',
    cardBackgroundColor: '#161b22',
    headerBackgroundColor: '#161b22',
    textColor: '#e6edf3',
    textSecondaryColor: '#8b949e'
  },
  Layout: TechLayout
};

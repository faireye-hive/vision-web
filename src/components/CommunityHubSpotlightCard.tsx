import React, { useState } from 'react';
import {
  Compass,
  Sparkles,
  Users,
  Layers,
  ChevronRight,
  Shuffle,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { getHiveAvatarUrl } from '../services/hiveApi';

interface SpotlightCommunity {
  name: string;
  title: string;
  about: string;
  subscribers: number;
  authors: number;
  category: string;
  badge: string;
}

const FEATURED_SPOTLIGHTS: SpotlightCommunity[] = [
  {
    name: 'hive-174578',
    title: 'Photography Lovers',
    about: 'The premier decentralized hub for photographers, shutterbugs, and visual artists across the globe.',
    subscribers: 19800,
    authors: 1420,
    category: 'Photos & Art',
    badge: 'Trending Hub'
  },
  {
    name: 'hive-167922',
    title: 'LeoFinance',
    about: 'Decentralized finance, crypto analysis, Web3 tokenomics, and market discussions on Hive blockchain.',
    subscribers: 14200,
    authors: 980,
    category: 'Crypto & Web3',
    badge: 'Popular Finance'
  },
  {
    name: 'hive-163772',
    title: 'Worldmappin',
    about: 'Travel the world on blockchain. Share travel logs, pin wanderlust memories, and discover destinations.',
    subscribers: 18490,
    authors: 1150,
    category: 'Travel & Nature',
    badge: 'Featured Travel'
  },
  {
    name: 'hive-193816',
    title: 'Music Community',
    about: 'Original tracks, acoustic sessions, music production, and indie artist collaborations on Hive.',
    subscribers: 11350,
    authors: 720,
    category: 'Music & Audio',
    badge: 'Creative Sound'
  },
  {
    name: 'hive-140217',
    title: 'Hive Gaming',
    about: 'Gaming reviews, livestreams, esports highlights, Web3 gaming strategies, and retro play.',
    subscribers: 16500,
    authors: 1310,
    category: 'Tech & Gaming',
    badge: 'Gaming Hub'
  },
  {
    name: 'hive-125125',
    title: 'Town Square',
    about: 'The open town square for Hive. Meet fellow creators, discuss governance, share ideas, and connect.',
    subscribers: 11910,
    authors: 890,
    category: 'General Hub',
    badge: 'Community Core'
  }
];

export const CommunityHubSpotlightCard: React.FC = () => {
  const { joinedCommunities, toggleJoinCommunity } = useAuth();
  const { openCommunity, openCommunitiesModal, openManageCommunitiesModal } = useNavigation();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isBusy, setIsBusy] = useState(false);

  const activeSpotlight = FEATURED_SPOTLIGHTS[currentIndex];
  const isJoined = Boolean(joinedCommunities[activeSpotlight.name]);
  const joinedTotal = Object.values(joinedCommunities || {}).filter(Boolean).length;

  const nextSpotlight = () => {
    setCurrentIndex((prev) => (prev + 1) % FEATURED_SPOTLIGHTS.length);
  };

  const handleToggleJoin = async () => {
    setIsBusy(true);
    try {
      await toggleJoinCommunity(activeSpotlight.name);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      id="community-hub-spotlight-card"
      className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/60 dark:border-slate-800 text-gray-900 dark:text-slate-100 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white leading-tight">
              Community Spotlight
            </h3>
            <p className="text-[10px] text-gray-400 dark:text-slate-500">
              Featured decentralized hubs
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={nextSpotlight}
          className="p-1.5 rounded-xl text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer"
          title="Shuffle to another featured community"
          aria-label="Next featured community"
        >
          <Shuffle className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Featured Community Body */}
      <div className="bg-gradient-to-br from-emerald-50/40 via-blue-50/20 to-transparent dark:from-emerald-950/20 dark:via-slate-800/40 dark:to-transparent rounded-2xl p-3.5 border border-emerald-100/50 dark:border-emerald-900/30 space-y-3">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={getHiveAvatarUrl(activeSpotlight.name, 'medium')}
              alt={activeSpotlight.title}
              className="w-10 h-10 rounded-2xl object-cover bg-gray-100 dark:bg-slate-800 flex-shrink-0 border border-emerald-200/50 dark:border-emerald-800/40"
              onError={(e) => {
                (e.target as HTMLImageElement).src = getHiveAvatarUrl('hive', 'small');
              }}
            />
            <div className="min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {activeSpotlight.badge}
              </span>
              <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                {activeSpotlight.title}
              </h4>
              <p className="text-[10px] font-mono text-gray-400 dark:text-slate-500 truncate">
                {activeSpotlight.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleJoin}
            disabled={isBusy}
            className={`text-xs px-3 py-1 rounded-full font-bold transition flex-shrink-0 cursor-pointer disabled:opacity-60 ${
              isJoined
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 hover:bg-rose-50 hover:text-rose-600'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
            }`}
          >
            {isBusy ? 'Signing...' : isJoined ? 'Joined' : 'Join'}
          </button>
        </div>

        <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed line-clamp-2">
          {activeSpotlight.about}
        </p>

        <div className="flex items-center justify-between pt-2 border-t border-emerald-100/60 dark:border-slate-800/60 text-[11px] text-gray-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-semibold text-gray-700 dark:text-slate-300">
              {activeSpotlight.subscribers.toLocaleString()}
            </span>{' '}
            members
          </span>

          <button
            type="button"
            onClick={() => openCommunity(activeSpotlight.name)}
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition cursor-pointer"
          >
            <span>Open feed</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Community Directory Quick Actions */}
      <div className="space-y-1.5 pt-1">
        <button
          type="button"
          onClick={openCommunitiesModal}
          className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Compass className="w-3.5 h-3.5" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold leading-tight">Explore 2,500+ Communities</p>
              <p className="text-[10px] text-gray-400 dark:text-slate-500">Filter by topic, lang & rank</p>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>

        <button
          type="button"
          onClick={openManageCommunitiesModal}
          className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-gray-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold leading-tight">Manage Subscriptions</p>
              <p className="text-[10px] text-gray-400 dark:text-slate-500">
                {joinedTotal > 0 ? `${joinedTotal} communities joined` : 'Manage on-chain subscriptions'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      <div className="pt-2 border-t border-gray-100 dark:border-slate-800 text-[10px] text-gray-400 dark:text-slate-500 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
        <span>Subscribing signs a zero-fee Posting custom_json on Hive.</span>
      </div>
    </div>
  );
};

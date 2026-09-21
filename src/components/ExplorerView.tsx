import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  Activity, 
  Layers, 
  Hash, 
  Users, 
  ArrowLeft, 
  TrendingUp, 
  ShieldCheck, 
  Search, 
  ExternalLink,
  Cpu,
  Coins
} from 'lucide-react';
import { 
  getDynamicGlobalProperties, 
  getTrendingTags, 
  listCommunities, 
  HiveGlobalProps, 
  HiveCommunity 
} from '../services/hiveApi';

interface ExplorerViewProps {
  onBackToFeed: () => void;
  onSelectTag: (tag: string) => void;
  onSelectAuthor: (author: string) => void;
  onSelectCommunity: (comm: string) => void;
}

export const ExplorerView: React.FC<ExplorerViewProps> = ({
  onBackToFeed,
  onSelectTag,
  onSelectAuthor,
  onSelectCommunity
}) => {
  const [globalProps, setGlobalProps] = useState<HiveGlobalProps | null>(null);
  const [trendingTags, setTrendingTags] = useState<Array<{ name: string; tag: string }>>([]);
  const [featuredCommunities, setFeaturedCommunities] = useState<HiveCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      getDynamicGlobalProperties().catch(() => null),
      getTrendingTags(30).catch(() => []),
      listCommunities('rank', 12).catch(() => [])
    ]).then(([props, tags, comms]) => {
      if (isMounted) {
        if (props) setGlobalProps(props);
        if (tags) setTrendingTags(tags);
        if (comms) setFeaturedCommunities(comms);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredTags = trendingTags.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Explorer Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToFeed}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Feed</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Compass className="w-5 h-5 text-blue-600" />
              <span>Hive Blockchain Explorer</span>
            </h1>
            <p className="text-xs text-gray-500">Live network statistics, trending tags, and top communities</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tags or communities..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-full text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Global Blockchain Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-sm flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase">Head Block</p>
            <p className="text-lg font-bold text-gray-900 font-mono">
              {globalProps ? `#${globalProps.head_block_number.toLocaleString()}` : 'Connecting...'}
            </p>
            <p className="text-[10px] text-emerald-600 font-medium">3-second block interval</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-sm flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase">Active Witness</p>
            <p className="text-lg font-bold text-gray-900 font-mono truncate max-w-[140px]">
              {globalProps ? `@${globalProps.current_witness}` : '...'}
            </p>
            <p className="text-[10px] text-purple-600 font-medium">Decentralized DPoS Node</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-sm flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase">HBD APR</p>
            <p className="text-lg font-bold text-emerald-600 font-mono">
              {globalProps ? `${(globalProps.hbd_interest_rate / 100).toFixed(1)}%` : '20.0%'}
            </p>
            <p className="text-[10px] text-gray-500">Savings Account Yield</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-sm flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase">HIVE Supply</p>
            <p className="text-sm font-bold text-gray-900 font-mono truncate max-w-[150px]">
              {globalProps ? globalProps.current_supply.split(' ')[0] : '...'}
            </p>
            <p className="text-[10px] text-amber-600 font-medium">Transparent On-Chain Supply</p>
          </div>
        </div>

      </div>

      {/* Main Explorer Content: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Trending Tags Cloud */}
        <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-gray-900">Trending Tags & Categories</h3>
            </div>
            <span className="text-xs text-gray-400">{filteredTags.length} active tags</span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {filteredTags.map((tag) => (
              <button
                key={tag.name}
                onClick={() => onSelectTag(tag.name)}
                className="px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-700 border border-gray-200 hover:border-blue-300 text-xs font-medium transition flex items-center gap-1 group"
              >
                <span className="text-gray-400 group-hover:text-blue-500">#</span>
                <span>{tag.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Top Communities */}
        <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-gray-900">Featured Communities</h3>
            </div>
            <span className="text-xs text-gray-400">{featuredCommunities.length} communities</span>
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {featuredCommunities.map((comm) => (
              <div
                key={comm.name}
                onClick={() => onSelectCommunity(comm.name)}
                className="p-3 rounded-xl border border-gray-150 hover:border-blue-200 hover:bg-blue-50/20 transition cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={`https://images.ecency.com/u/${comm.name}/avatar/small`}
                    alt={comm.title}
                    className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive-125125/avatar/small';
                    }}
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-xs sm:text-sm text-gray-900 truncate">
                      {comm.title}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {comm.subscribers.toLocaleString()} members
                    </p>
                  </div>
                </div>

                <span className="text-xs text-blue-600 font-semibold flex items-center gap-1 flex-shrink-0">
                  <span>Explore</span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};

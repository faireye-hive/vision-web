import React, { useState, useEffect } from 'react';
import { 
  X, 
  Layers, 
  Users, 
  Search, 
  Star, 
  Check, 
  Plus, 
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { HiveCommunity, listCommunities, getHiveAvatarUrl } from '../services/hiveApi';

interface ManageCommunitiesModalProps {
  onClose: () => void;
  onSelectCommunity: (communityName: string) => void;
  joinedCommunities: Record<string, boolean>;
  onToggleJoinCommunity: (communityName: string) => void;
}

export const ManageCommunitiesModal: React.FC<ManageCommunitiesModalProps> = ({
  onClose,
  onSelectCommunity,
  joinedCommunities,
  onToggleJoinCommunity
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'joined'>('all');
  const [communities, setCommunities] = useState<HiveCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'rank' | 'subs' | 'new'>('rank');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    listCommunities(sortOrder, 40)
      .then((data) => {
        if (isMounted) {
          setCommunities(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sortOrder]);

  const filteredCommunities = communities.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = 
      c.title.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.about && c.about.toLowerCase().includes(q));

    if (!matchesQuery) return false;
    if (activeTab === 'joined') {
      return !!joinedCommunities[c.name];
    }
    return true;
  });

  return (
    <div 
      id="manage-communities-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
    >
      <div 
        className="relative bg-white border border-gray-200 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-150 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Manage Communities</h2>
              <p className="text-xs text-gray-500">Discover, join and organize your decentralized Hive spaces</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab & Filter bar */}
        <div className="p-4 sm:px-6 bg-gray-50/70 border-b border-gray-150 space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            
            {/* Tabs */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                  activeTab === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                All Communities
              </button>
              <button
                onClick={() => setActiveTab('joined')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                  activeTab === 'joined'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                My Subscriptions ({Object.values(joinedCommunities).filter(Boolean).length})
              </button>
            </div>

            {/* Sort options */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs">
              <span className="text-gray-400 mr-1">Sort:</span>
              <button
                onClick={() => setSortOrder('rank')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  sortOrder === 'rank' ? 'bg-gray-200 text-gray-900 font-bold' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Rank
              </button>
              <button
                onClick={() => setSortOrder('subs')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  sortOrder === 'subs' ? 'bg-gray-200 text-gray-900 font-bold' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Subscribers
              </button>
              <button
                onClick={() => setSortOrder('new')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  sortOrder === 'new' ? 'bg-gray-200 text-gray-900 font-bold' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                New
              </button>
            </div>

          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search community by title, tag or description..."
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 shadow-sm"
            />
          </div>
        </div>

        {/* Communities List */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-3 flex-1">
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400 animate-pulse">
              Loading Hive communities...
            </div>
          ) : filteredCommunities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredCommunities.map((comm) => {
                const isJoined = !!joinedCommunities[comm.name];

                return (
                  <div
                    key={comm.name}
                    className="p-4 rounded-2xl border border-gray-150 bg-white hover:border-blue-200 hover:shadow-sm transition flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={`https://images.ecency.com/u/${comm.name}/avatar/small`}
                          alt={comm.title}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200 bg-gray-100 flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive-125125/avatar/small';
                          }}
                        />
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-gray-900 truncate">
                            {comm.title}
                          </h4>
                          <p className="text-xs text-gray-400 font-mono">
                            {comm.name}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => onToggleJoinCommunity(comm.name)}
                        className={`text-xs px-3.5 py-1 rounded-full font-semibold transition flex-shrink-0 ${
                          isJoined
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                        }`}
                      >
                        {isJoined ? 'Joined ✓' : '+ Join'}
                      </button>
                    </div>

                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                      {comm.about || 'No description provided by community administrators.'}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1 font-semibold text-gray-700">
                          <Users className="w-3.5 h-3.5 text-gray-400" />
                          {comm.subscribers.toLocaleString()} members
                        </span>
                        {comm.num_authors > 0 && (
                          <span className="text-gray-400">
                            {comm.num_authors} posters
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          onSelectCommunity(comm.name);
                          onClose();
                        }}
                        className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <span>View Feed</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-gray-400 space-y-2">
              <Layers className="w-8 h-8 mx-auto text-gray-300" />
              <p>No communities found matching your filter.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-150 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Direct on-chain community subscriptions</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 font-semibold transition"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};

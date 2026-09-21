import React, { useState, useEffect } from 'react';
import { 
  X, 
  Layers, 
  Users, 
  FileText, 
  ArrowRight, 
  Search,
  Check
} from 'lucide-react';
import { HiveCommunity, listCommunities, getHiveAvatarUrl } from '../services/hiveApi';

interface CommunitiesModalProps {
  onClose: () => void;
  onSelectCommunity: (communityName: string) => void;
  activeCommunity?: string;
}

export const CommunitiesModal: React.FC<CommunitiesModalProps> = ({
  onClose,
  onSelectCommunity,
  activeCommunity
}) => {
  const [communities, setCommunities] = useState<HiveCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'rank' | 'subs' | 'new'>('rank');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    listCommunities(sort, 30)
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
  }, [sort]);

  const filtered = communities.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.title?.toLowerCase().includes(q) ||
      c.name?.toLowerCase().includes(q) ||
      c.about?.toLowerCase().includes(q)
    );
  });

  return (
    <div 
      id="communities-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
    >
      <div 
        className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/95">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Hive Communities</h2>
              <p className="text-xs text-slate-400">Decentralized spaces and forums on the Hive blockchain</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-rose-500/20 border border-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter controls */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search community title or topic..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex items-center gap-1 self-start sm:self-auto text-xs">
            <span className="text-slate-500 mr-1 text-[11px]">Sort:</span>
            {(['rank', 'subs', 'new'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition ${
                  sort === s 
                    ? 'bg-rose-600 text-white' 
                    : 'text-slate-400 hover:text-slate-200 bg-slate-800/60'
                }`}
              >
                {s === 'rank' ? 'Top Ranked' : s === 'subs' ? 'Subscribers' : 'Newest'}
              </button>
            ))}
          </div>
        </div>

        {/* Community list */}
        <div className="overflow-y-auto p-4 space-y-2.5 flex-1">
          {loading ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Loading Hive communities...</p>
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((comm) => {
              const isActive = activeCommunity === comm.name;
              const avatar = getHiveAvatarUrl(comm.name, 'medium');

              return (
                <div
                  key={comm.id || comm.name}
                  onClick={() => {
                    onSelectCommunity(comm.name);
                    onClose();
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between gap-4 ${
                    isActive 
                      ? 'bg-rose-950/40 border-rose-500' 
                      : 'bg-slate-950/50 hover:bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img 
                      src={avatar} 
                      alt="" 
                      className="w-10 h-10 rounded-xl bg-slate-800 object-cover border border-slate-700 flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/medium';
                      }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-white truncate hover:text-rose-400">
                          {comm.title || comm.name}
                        </h3>
                        <span className="text-[10px] font-mono text-slate-500">
                          {comm.name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                        {comm.about || 'Hive community space'}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-slate-400" />
                          {comm.subscribers.toLocaleString()} subscribers
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-slate-400" />
                          {comm.num_authors.toLocaleString()} authors
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isActive ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-rose-400 bg-rose-950/60 px-2.5 py-1 rounded-lg border border-rose-800">
                        <Check className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 group-hover:text-white flex items-center gap-1">
                        Browse <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-slate-500 italic p-8 text-center">No communities found matching your search.</p>
          )}
        </div>
      </div>
    </div>
  );
};

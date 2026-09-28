import React from 'react';
import { Layers, Compass, ExternalLink, Check, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { DEFAULT_TOP_COMMUNITIES } from '../data/topCommunities';

interface SubscribedCommunitiesCardProps {
  onSelectCommunity: (communityName: string) => void;
}

export const SubscribedCommunitiesCard: React.FC<SubscribedCommunitiesCardProps> = ({
  onSelectCommunity
}) => {
  const { joinedCommunities, toggleJoinCommunity } = useAuth();
  const { openCommunitiesModal, openManageCommunitiesModal } = useNavigation();

  const subscribedList = Object.keys(joinedCommunities).filter((k) => joinedCommunities[k]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/60 dark:border-slate-800 text-gray-900 dark:text-slate-100 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">Community Shortcuts</h3>
            <p className="text-[10px] text-gray-400 dark:text-slate-500">Quick access to Hive hubs</p>
          </div>
        </div>

        <button
          onClick={openManageCommunitiesModal}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
        >
          Manage
        </button>
      </div>

      {/* Featured / Default Communities List */}
      <div className="space-y-3">
        {DEFAULT_TOP_COMMUNITIES.map((comm) => {
          const isJoined = Boolean(joinedCommunities[comm.name]);

          return (
            <div
              key={comm.name}
              className="group p-2.5 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800 transition border border-transparent hover:border-gray-100 dark:hover:border-slate-700"
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectCommunity(comm.name)}
                  className="flex items-center gap-2.5 text-left focus:outline-none min-w-0 cursor-pointer flex-1"
                >
                  <img
                    src={comm.avatar}
                    alt={comm.title}
                    className="w-8 h-8 rounded-xl object-cover bg-gray-100 dark:bg-slate-800 flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive-125125/avatar/small';
                    }}
                  />
                  <div className="truncate">
                    <span className="font-bold text-xs sm:text-sm text-gray-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate block">
                      {comm.title}
                    </span>
                    <span className="text-[11px] text-gray-400 dark:text-slate-500 block truncate">
                      {comm.subscribers.toLocaleString()} members
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    toggleJoinCommunity(comm.name).then((msg) => {
                      if (msg) alert(msg);
                    });
                  }}
                  className={`text-xs px-2.5 py-1 rounded-xl font-semibold transition flex-shrink-0 cursor-pointer ${
                    isJoined
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  {isJoined ? 'Joined' : 'Join'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-2">
        <button
          onClick={openCommunitiesModal}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100/70 dark:hover:bg-blue-900/50 transition cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            <span>Explore all communities</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

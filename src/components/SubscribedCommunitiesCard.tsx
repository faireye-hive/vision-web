import React from 'react';
import { Layers } from 'lucide-react';
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
  const { openManageCommunitiesModal } = useNavigation();

  const subscribedList = Object.keys(joinedCommunities).filter((k) => joinedCommunities[k]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[15px] p-2.5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/60 dark:border-slate-800 text-gray-900 dark:text-slate-100 space-y-4" style={{ marginTop: '0px' }}>
      <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">Community Shortcuts</h3>
            <p className="text-[10px] text-gray-400 dark:text-slate-500">Quick access to Hive hubs</p>
          </div>
        </div>

        <button
          onClick={openManageCommunitiesModal}
          className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:underline font-semibold cursor-pointer"
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
                    <span className="font-bold text-xs sm:text-sm text-gray-900 dark:text-slate-100 group-hover:text-slate-700 dark:group-hover:text-white truncate block">
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
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {isJoined ? 'Joined' : 'Join'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

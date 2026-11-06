import React, { useRef } from 'react';
import { Layers, Plus, Compass } from 'lucide-react';
import { getHiveAvatarUrl } from '../../services/hiveApi';

export interface FollowedCommunityItem {
  name: string;
  title: string;
}

interface CommunitiesSwipeBarProps {
  communities: FollowedCommunityItem[];
  currentTag: string;
  onSelectCommunity: (communityName: string) => void;
  onOpenExplore: () => void;
  loading?: boolean;
}

export const CommunitiesSwipeBar: React.FC<CommunitiesSwipeBarProps> = ({
  communities,
  currentTag,
  onSelectCommunity,
  onOpenExplore,
  loading = false
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAllActive = !currentTag || !currentTag.startsWith('hive-');

  return (
    <div
      id="communities-swipe-carousel"
      className="mt-1 mb-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl py-1.5 px-2 border border-gray-100 dark:border-slate-800 shadow-2xs flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth select-none"
      role="region"
      aria-label="Followed communities swipe carousel"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {/* "All Communities" Feed Pill */}
      <button
        type="button"
        onClick={() => onSelectCommunity('')}
        aria-pressed={isAllActive}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition flex-shrink-0 cursor-pointer ${
          isAllActive
          ? 'bg-slate-800 text-white shadow-xs dark:bg-slate-200 dark:text-slate-900'
            : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200/80 dark:hover:bg-slate-700'
        }`}
        title="Show feed from all followed communities"
      >
        <Layers className="w-3.5 h-3.5" />
        <span>All Communities</span>
      </button>

      {/* Loading Skeletons */}
      {loading && communities.length === 0 && (
        <div className="flex items-center gap-1.5 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-7 w-24 bg-gray-100 dark:bg-slate-800 rounded-xl flex-shrink-0"
            />
          ))}
        </div>
      )}

      {/* Followed Communities List */}
      {communities.map((comm) => {
        const isSelected = currentTag.toLowerCase() === comm.name.toLowerCase();

        return (
          <button
            key={comm.name}
            type="button"
            onClick={() => {
              if (isSelected) {
                // Clicking active community toggles back to all communities
                onSelectCommunity('');
              } else {
                onSelectCommunity(comm.name);
              }
            }}
            aria-pressed={isSelected}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition flex-shrink-0 cursor-pointer border ${
              isSelected
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold shadow-xs border-slate-300 dark:border-slate-600 ring-1 ring-slate-300/70 dark:ring-slate-600/70'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200/80 dark:hover:bg-slate-700 border-transparent'
            }`}
            title={`Load posts from ${comm.title || comm.name}`}
          >
            <img
              src={getHiveAvatarUrl(comm.name, 'small')}
              alt=""
              className="w-4 h-4 rounded-md object-cover bg-gray-200 dark:bg-slate-700 flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).src = getHiveAvatarUrl('hive', 'small');
              }}
            />
            <span className="truncate max-w-[130px] sm:max-w-[180px]">
              {comm.title || comm.name}
            </span>
          </button>
        );
      })}

      {/* "+ Explore" button at the end to discover more communities */}
      <button
        type="button"
        onClick={onOpenExplore}
        className="inline-flex lg:hidden items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex-shrink-0 cursor-pointer ml-auto"
        title="Explore and subscribe to more communities on Hive"
      >
        <Compass className="w-3.5 h-3.5" />
        <span>Explore More</span>
      </button>
    </div>
  );
};

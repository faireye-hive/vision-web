import React from 'react';
import { ArrowLeft, Compass, Layers, Rss } from 'lucide-react';

export type CommunitiesTab = 'feed' | 'explore' | 'manage';

interface CommunitiesTabNavProps {
  currentTab: CommunitiesTab;
  onSelectTab: (tab: CommunitiesTab) => void;
  joinedCount?: number;
  onBack?: () => void;
  showBack?: boolean;
}

export const CommunitiesTabNav: React.FC<CommunitiesTabNavProps> = ({
  currentTab,
  onSelectTab,
  joinedCount = 0,
  onBack,
  showBack = false
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      {showBack && onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Feed</span>
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
            <Layers className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm sm:text-base text-gray-900 dark:text-white">
            Communities
          </span>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex items-center gap-1.5 p-1 bg-gray-100/80 dark:bg-slate-800/80 rounded-2xl border border-gray-200/50 dark:border-slate-700/50"
        role="tablist"
        aria-label="Communities sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={currentTab === 'feed'}
          onClick={() => onSelectTab('feed')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            currentTab === 'feed'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Rss className="w-3.5 h-3.5" />
          <span>My Feed</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={currentTab === 'explore'}
          onClick={() => onSelectTab('explore')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            currentTab === 'explore'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Explore</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={currentTab === 'manage'}
          onClick={() => onSelectTab('manage')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            currentTab === 'manage'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Manage</span>
          {joinedCount > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                currentTab === 'manage'
                  ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
              }`}
            >
              {joinedCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

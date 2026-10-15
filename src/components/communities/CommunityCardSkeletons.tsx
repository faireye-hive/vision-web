import React from 'react';

interface CommunityCardSkeletonsProps {
  count?: number;
}

export const CommunityCardSkeletons: React.FC<CommunityCardSkeletonsProps> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" aria-label="Loading communities">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-4 flex flex-col gap-3 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-slate-800 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 rounded bg-gray-100 dark:bg-slate-800" />
              <div className="h-2.5 w-1/3 rounded bg-gray-100 dark:bg-slate-800" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-2.5 w-full rounded bg-gray-100 dark:bg-slate-800" />
            <div className="h-2.5 w-4/5 rounded bg-gray-100 dark:bg-slate-800" />
          </div>
          <div className="flex gap-1.5 pt-1">
            <div className="h-4 w-20 rounded-full bg-gray-100 dark:bg-slate-800" />
            <div className="h-4 w-16 rounded-full bg-gray-100 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
};

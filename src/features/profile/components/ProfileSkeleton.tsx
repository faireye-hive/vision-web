import React from 'react';

/**
 * Modern, shimmering skeleton placeholders for profile loading.
 * Replaces generic spinner boxes with an instant, smooth app shell.
 */

export const FeedCardsSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-5 animate-in fade-in duration-300 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`skeleton-card-${i}`}
          className="bg-white dark:bg-[#161b2e] border border-gray-100 dark:border-slate-800/80 rounded-[15px] p-4 flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-[894px] h-auto sm:h-[180px] min-h-[180px] animate-pulse"
        >
          {/* Thumbnail Skeleton */}
          <div className="w-full sm:w-[262px] h-44 sm:h-full bg-slate-200 dark:bg-slate-800/80 rounded-[15px] shrink-0" />

          {/* Text & Meta Skeleton */}
          <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
            <div className="space-y-3">
              {/* Category & Date / Author */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-16 bg-blue-100 dark:bg-blue-900/30 rounded-lg" />
                  <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded-md" />
                </div>
                <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded-md" />
              </div>

              {/* Title lines */}
              <div className="space-y-1.5">
                <div className="h-5 w-4/5 bg-slate-200 dark:bg-slate-700/60 rounded-md" />
                <div className="h-4 w-2/5 bg-slate-200 dark:bg-slate-700/40 rounded-md sm:hidden" />
              </div>

              {/* Snippet line */}
              <div className="space-y-1">
                <div className="h-3.5 w-full bg-slate-100 dark:bg-slate-800/80 rounded-md" />
                <div className="h-3.5 w-2/3 bg-slate-100 dark:bg-slate-800/80 rounded-md" />
              </div>
            </div>

            {/* Bottom Actions Skeleton */}
            <div className="mt-auto pt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-14 bg-slate-100 dark:bg-slate-800/70 rounded-xl" />
                <div className="h-7 w-12 bg-slate-100 dark:bg-slate-800/70 rounded-xl" />
                <div className="h-7 w-10 bg-slate-100 dark:bg-slate-800/70 rounded-xl" />
              </div>
              <div className="h-6 w-16 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const ProfilePageSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0a0f1d] animate-in fade-in duration-300">
      {/* Banner Skeleton */}
      <div className="relative mb-6">
        <div 
          className="w-full bg-slate-200 dark:bg-slate-800/60 relative shadow-2xl min-h-[200px] sm:min-h-[220px] animate-pulse"
          style={{ borderRadius: '15px' }}
        >
          {/* Avatar Skeleton */}
          <div className="absolute top-5 sm:top-10 left-4 sm:left-12 z-20">
            <div className="w-[90px] h-[90px] sm:w-[120px] sm:h-[120px] rounded-full border-4 border-[#0a0f1d] bg-slate-300 dark:bg-slate-700 animate-pulse shadow-md" />
          </div>

          {/* Name & Rep Skeleton */}
          <div 
            className="absolute bottom-4 sm:bottom-10 left-32 xs:left-36 sm:left-60 z-10 space-y-2"
            style={{ marginTop: '2px', marginLeft: '-59px', marginBottom: '23px' }}
          >
            <div className="flex items-center gap-3">
              <div className="h-7 sm:h-9 w-40 sm:w-60 bg-slate-300 dark:bg-slate-700 rounded-xl" />
              <div className="h-5 w-12 bg-blue-400/40 rounded-full" />
            </div>
            <div className="h-4 w-28 bg-slate-300/80 dark:bg-slate-700/60 rounded-md" />
          </div>

          {/* Action Button Skeleton */}
          <div className="absolute bottom-4 sm:bottom-10 right-3 sm:right-8 z-20">
            <div className="h-9 sm:h-11 w-28 sm:w-36 bg-slate-300/60 dark:bg-slate-700/60 rounded-2xl" />
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="max-w-full mx-auto px-4 sm:px-12 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-12 items-start">
          {/* Left Sidebar Skeleton */}
          <aside className="order-2 lg:order-1 space-y-6 pt-4 sm:pt-20">
            <div 
              className="bg-white dark:bg-[#161b2e] border border-gray-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm w-full max-w-[420px] space-y-6 animate-pulse"
              style={{ minHeight: '380px', borderRadius: '15px' }}
            >
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded-md" />
              <div className="space-y-2">
                <div className="h-3.5 w-full bg-slate-100 dark:bg-slate-800 rounded-md" />
                <div className="h-3.5 w-4/5 bg-slate-100 dark:bg-slate-800 rounded-md" />
              </div>

              <div className="space-y-3 pt-2">
                <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 rounded-md" />
                <div className="h-4 w-40 bg-slate-100 dark:bg-slate-800 rounded-md" />
                <div className="h-4 w-36 bg-slate-100 dark:bg-slate-800 rounded-md" />
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-4">
                <div className="h-20 bg-slate-50 dark:bg-slate-900/60 rounded-2xl" />
                <div className="h-20 bg-slate-50 dark:bg-slate-900/60 rounded-2xl" />
                <div className="h-20 bg-slate-50 dark:bg-slate-900/60 rounded-2xl" />
              </div>
            </div>
          </aside>

          {/* Right Feed Skeleton */}
          <main className="order-1 lg:order-2 space-y-6 pt-6">
            {/* Tab navigation skeleton */}
            <div className="flex items-center gap-4 border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="h-5 w-16 bg-blue-200 dark:bg-blue-900/40 rounded-lg animate-pulse" />
              <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              <div className="h-5 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              <div className="h-5 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
            </div>

            {/* Cards Skeleton */}
            <FeedCardsSkeleton count={3} />
          </main>
        </div>
      </div>
    </div>
  );
};

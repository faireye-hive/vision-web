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

const Placeholder: React.FC<{ className: string }> = ({ className }) => (
  <div className={`rounded-md bg-slate-200 dark:bg-slate-800 ${className}`} />
);

export const ProfilePageSkeleton: React.FC<{ isOwner?: boolean }> = ({ isOwner = false }) => (
  <div role="status" aria-label="Loading profile" className="mx-auto w-full max-w-[1392px] space-y-4 py-4 sm:space-y-5 sm:py-5 motion-safe:animate-pulse">
    <span className="sr-only">Loading profile…</span>
    <div aria-hidden="true" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#111827]">
      <Placeholder className="h-32 !rounded-none sm:h-40 lg:h-44" />
      <div className="relative px-4 pb-4 sm:px-6 sm:pb-5">
        <div className="flex items-end justify-between gap-3">
          <Placeholder className="-mt-9 h-20 w-20 shrink-0 !rounded-2xl border-4 border-white dark:border-[#111827] sm:-mt-11 sm:h-24 sm:w-24 sm:!rounded-3xl" />
          <div className="flex justify-end gap-2 pt-3">
            <Placeholder className="h-10 w-28 !rounded-xl" />
            {!isOwner && <Placeholder className="h-10 w-10 !rounded-xl" />}
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Placeholder className="h-8 w-40 sm:h-9 sm:w-48" />
            <Placeholder className="mt-1 h-5 w-28" />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 sm:gap-x-6">
            {[0, 1, 2].map(stat => (
              <div key={stat} className="flex items-baseline gap-1.5 sm:flex-col sm:gap-0.5">
                <Placeholder className="h-5 w-8 sm:h-7" />
                <Placeholder className="h-4 w-14" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    <div aria-hidden="true" className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-5">
      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-[#111827]">
          <div className="mb-2.5 flex h-8 items-center lg:h-5"><Placeholder className="h-5 w-16" /></div>
          <div className="space-y-2"><Placeholder className="h-4 w-full" /><Placeholder className="h-4 w-4/5" /></div>
          <div className="hidden lg:block">
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              {[0, 1, 2].map(row => <Placeholder key={row} className="h-4 w-3/4" />)}
            </div>
            <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800"><Placeholder className="h-4 w-28" /></div>
          </div>
        </div>
        {isOwner && <div className="hidden h-[70px] rounded-2xl border border-dashed border-slate-300 bg-white/50 dark:border-slate-700 dark:bg-slate-900/50 lg:block" />}
      </div>
      <div className="min-w-0 space-y-3">
        <div className="flex min-w-0 gap-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          {[64, 72, 104, 88, 104].map((width, index) => <div key={index} style={{ width }} className="h-10 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-800" />)}
        </div>
        {[0, 1, 2].map(card => (
          <div key={card} className="rounded-2xl border border-gray-100/90 bg-white p-4 dark:border-slate-800/80 dark:bg-[#161b2e] sm:p-5">
            <div className="flex min-w-0 flex-col items-start gap-3.5 sm:flex-row sm:gap-5">
              <Placeholder className="order-1 aspect-video w-full shrink-0 !rounded-xl sm:order-2 sm:aspect-[4/3] sm:w-36 lg:w-44" />
              <div className="order-2 w-full min-w-0 flex-1 self-stretch sm:order-1">
                <div className="mb-1.5 flex h-6 items-center justify-between gap-2"><Placeholder className="h-4 w-24" /><Placeholder className="h-4 w-20" /></div>
                <Placeholder className="my-1 h-6 w-4/5 sm:h-7" />
                <div className="mb-3 mt-1.5 space-y-2"><Placeholder className="h-4 w-full" /><Placeholder className="h-4 w-2/3" /></div>
                <div className="flex gap-2 border-t border-gray-100/90 pt-2.5 dark:border-slate-800/70 sm:pt-3">
                  {[0, 1, 2].map(action => <Placeholder key={action} className="h-8 w-10 !rounded-xl" />)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

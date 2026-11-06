import React from 'react';
import { ArrowUpRight, Check, Plus, ShieldAlert, Users } from 'lucide-react';
import { getHiveAvatarUrl } from '../../services/hiveApi';
import { ClassifiedCommunity } from '../../utils/communityTaxonomy';

interface CommunityCardProps {
  item: ClassifiedCommunity;
  joined: boolean;
  busy: boolean;
  onToggleJoin: () => void;
  onOpen: () => void;
  onPickCategory?: () => void;
}

export const CommunityCard: React.FC<CommunityCardProps> = ({
  item,
  joined,
  busy,
  onToggleJoin,
  onOpen,
  onPickCategory
}) => {
  const { community } = item;
  const name = community.title || community.name;
  const authors = community.num_authors || 0;

  return (
    <article className="group relative flex min-h-[184px] flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:shadow-black/20 [content-visibility:auto] [contain-intrinsic-size:auto_184px]">
      <div aria-hidden="true" className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700" />

      <div>
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onOpen}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            aria-label={`Open ${name}`}
          >
            <img
              src={community.avatar_url || getHiveAvatarUrl(community.name, 'small')}
              alt=""
              loading="lazy"
              className="h-12 w-12 shrink-0 rounded-xl border border-slate-200/80 bg-slate-50 object-cover shadow-sm dark:border-slate-700 dark:bg-slate-800"
              onError={(event) => {
                (event.target as HTMLImageElement).src = getHiveAvatarUrl('hive', 'small');
              }}
            />
            <span className="min-w-0">
              <span className="block line-clamp-2 text-[14px] font-bold leading-snug text-slate-900 transition group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
                {name}
              </span>
              <span className="mt-0.5 block truncate font-mono text-[10px] tracking-wide text-slate-400 dark:text-slate-500">
                {community.name}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleJoin}
            disabled={busy}
            aria-label={joined ? `Unsubscribe from ${name}` : `Subscribe to ${name}`}
            className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-wait disabled:opacity-60 ${
              joined
                ? 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                : 'bg-slate-900 text-white shadow-sm hover:bg-blue-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white'
            }`}
          >
            {busy ? (
              <span className="px-1">Signing…</span>
            ) : joined ? (
              <><Check className="h-3.5 w-3.5" /> Subscribed</>
            ) : (
              <><Plus className="h-3.5 w-3.5" /> Subscribe</>
            )}
          </button>
        </div>

        <p className="mt-3 min-h-9 line-clamp-2 text-xs leading-[1.45rem] text-slate-600 dark:text-slate-300">
          {community.about || 'A Hive community for sharing and discovering ideas.'}
        </p>

        <div className="mt-2.5 flex min-h-6 flex-wrap items-center gap-1.5">
          {onPickCategory ? (
            <button
              type="button"
              onClick={onPickCategory}
              title={`Filter by ${item.categoryLabel}`}
              className="max-w-full truncate rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {item.categoryIcon} {item.categoryLabel}
            </button>
          ) : (
            <span className="max-w-full truncate rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {item.categoryIcon} {item.categoryLabel}
            </span>
          )}

          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {item.language.flag} {item.language.name}
          </span>

          {community.is_nsfw && (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200/70 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400">
              <ShieldAlert className="h-3 w-3" /> Sensitive
            </span>
          )}
        </div>
      </div>

      <footer className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {(community.subscribers || 0).toLocaleString()}
          </span>
          <span>members</span>
          {authors > 0 && (
            <>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
              <span className="truncate">{authors.toLocaleString()} active</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          View feed <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </footer>
    </article>
  );
};

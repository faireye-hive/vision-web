import React from 'react';
import { ExternalLink, Users, ShieldAlert } from 'lucide-react';
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
  const authors = community.num_authors || 0;

  return (
    <article className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-4 flex flex-col justify-between gap-3 shadow-xs hover:border-gray-200 dark:hover:border-slate-700 transition duration-150 [content-visibility:auto] [contain-intrinsic-size:auto_190px]">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={community.avatar_url || getHiveAvatarUrl(community.name, 'small')}
              alt={community.title || community.name}
              loading="lazy"
              className="w-11 h-11 rounded-2xl object-cover bg-gray-100 dark:bg-slate-800 flex-shrink-0 border border-gray-100/80 dark:border-slate-700/60"
              onError={(event) => {
                (event.target as HTMLImageElement).src = getHiveAvatarUrl('hive', 'small');
              }}
            />
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                {community.title || community.name}
              </h3>
              <p className="text-[11px] font-mono text-gray-400 dark:text-slate-500 truncate">
                {community.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleJoin}
            disabled={busy}
            aria-label={
              joined
                ? `Unsubscribe from ${community.title || community.name}`
                : `Subscribe to ${community.title || community.name}`
            }
            className={`group text-xs px-3.5 py-1.5 rounded-full font-bold flex-shrink-0 transition-colors disabled:opacity-60 cursor-pointer ${
              joined
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-300'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
            }`}
          >
            {busy ? (
              'Signing...'
            ) : joined ? (
              <>
                <span className="group-hover:hidden">Subscribed</span>
                <span className="hidden group-hover:inline">Unsubscribe</span>
              </>
            ) : (
              'Subscribe'
            )}
          </button>
        </div>

        <p className="text-xs text-gray-600 dark:text-slate-300 line-clamp-2 min-h-[2rem] mt-2.5">
          {community.about || 'No description provided.'}
        </p>

        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {onPickCategory ? (
            <button
              type="button"
              onClick={onPickCategory}
              title={`Filter by ${item.categoryLabel}`}
              className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300 transition"
            >
              {item.categoryIcon} {item.categoryLabel}
            </button>
          ) : (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
              {item.categoryIcon} {item.categoryLabel}
            </span>
          )}

          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400">
            {item.language.flag} {item.language.name}
          </span>

          {community.is_nsfw && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/50">
              <ShieldAlert className="w-2.5 h-2.5" /> Sensitive
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 dark:border-slate-800 text-[11px] text-gray-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          <span className="font-semibold text-gray-700 dark:text-slate-300">
            {(community.subscribers || 0).toLocaleString()}
          </span>{' '}
          members
          {authors > 0 && (
            <span className="text-gray-400 dark:text-slate-500">
              &middot; {authors.toLocaleString()} active
            </span>
          )}
        </span>

        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition cursor-pointer"
        >
          View feed <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </article>
  );
};

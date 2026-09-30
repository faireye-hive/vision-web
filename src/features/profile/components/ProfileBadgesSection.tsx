import React from 'react';
import { Hash, Layers, ChevronRight } from 'lucide-react';
import { ProfileCustomStyle, BORDER_RADIUS_CLASSES } from '../profileStyleTypes';
import { getSmartTextColors } from '../profileColorUtils';
import { isNoiseTag } from '../../../utils/postTags';

interface ProfileBadgesSectionProps {
  tagStats: { tag: string; count: number }[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  communities: { name: string; title: string; count: number }[];
  onOpenCommunity?: (communityName: string) => void;
  style: ProfileCustomStyle;
}

export const ProfileBadgesSection: React.FC<ProfileBadgesSectionProps> = ({
  tagStats,
  selectedTag,
  onSelectTag,
  communities,
  onOpenCommunity,
  style
}) => {
  const { badgesConfig } = style;
  const roundedClass = BORDER_RADIUS_CLASSES[style.borderRadius];
  const smartColors = getSmartTextColors(style.textColor, style.textSecondaryColor, style.cardBackgroundColor);

  const cardStyleClass =
    style.cardStyle === 'glass'
      ? 'bg-white/75 dark:bg-slate-900/75 backdrop-blur-md border border-white/50 dark:border-slate-800/80 shadow-md'
      : style.cardStyle === 'outline'
      ? 'bg-transparent border-2 border-gray-200 dark:border-slate-800'
      : 'bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-xs';

  if (!badgesConfig.showTopics && !badgesConfig.showCommunities) {
    return null;
  }

  const validTags = tagStats
    .filter((stat) => !isNoiseTag(stat.tag))
    .slice(0, badgesConfig.maxTopicsCount || 16);

  // If only one is shown, take full width
  const isSingle = !badgesConfig.showTopics || !badgesConfig.showCommunities;

  // VARIANT: PILLS (compact inline ribbon)
  if (badgesConfig.styleVariant === 'pills' && badgesConfig.showTopics && !badgesConfig.showCommunities) {
    return (
      <div className="flex flex-wrap gap-1.5 items-center">
        {validTags.map((stat) => {
          const active = selectedTag === stat.tag;
          return (
            <button
              key={stat.tag}
              type="button"
              onClick={() => onSelectTag(active ? null : stat.tag)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                active
                  ? 'text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:border-gray-400'
              }`}
              style={active ? { backgroundColor: style.accentColor } : undefined}
            >
              #{stat.tag} <span className="opacity-70 text-[10px]">({stat.count})</span>
            </button>
          );
        })}
      </div>
    );
  }

  const cardCustomStyle: React.CSSProperties = {
    backgroundColor: style.cardBackgroundColor || undefined,
    color: smartColors.textColor || undefined,
    borderColor: style.cardBackgroundColor ? `${style.accentColor}33` : undefined
  };

  return (
    <div className={`grid grid-cols-1 ${isSingle ? 'md:grid-cols-1' : 'md:grid-cols-2'} gap-4`}>
      {/* Top Topics & Tags */}
      {badgesConfig.showTopics && (
        <section
          style={cardCustomStyle}
          className={`${cardStyleClass} ${roundedClass} p-5 space-y-3 transition-all duration-200`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4" style={{ color: style.accentColor }} />
              <h3
                style={{ color: style.textColor || undefined }}
                className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider"
              >
                Topics & Tags
              </h3>
            </div>
            <span
              style={{ color: style.textSecondaryColor || undefined }}
              className="text-[11px] text-gray-400 font-semibold"
            >
              {validTags.length} topics
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1 max-h-48 overflow-y-auto pr-1">
            {validTags.length === 0 ? (
              <p
                style={{ color: style.textSecondaryColor || undefined }}
                className="text-xs text-gray-400 italic"
              >
                No topics recorded yet.
              </p>
            ) : (
              validTags.map((stat) => {
                const active = selectedTag === stat.tag;
                return (
                  <button
                    key={stat.tag}
                    type="button"
                    onClick={() => onSelectTag(active ? null : stat.tag)}
                    className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                      active
                        ? 'text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                    }`}
                    style={active ? { backgroundColor: style.accentColor } : undefined}
                  >
                    #{stat.tag}{' '}
                    <span className="text-[10px] opacity-70 ml-0.5">({stat.count})</span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* Posted Communities */}
      {badgesConfig.showCommunities && (
        <section
          style={cardCustomStyle}
          className={`${cardStyleClass} ${roundedClass} p-5 space-y-3 transition-all duration-200`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" style={{ color: style.accentColor }} />
              <h3
                style={{ color: style.textColor || undefined }}
                className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider"
              >
                Communities
              </h3>
            </div>
            <span
              style={{ color: style.textSecondaryColor || undefined }}
              className="text-[11px] text-gray-400 font-semibold"
            >
              {communities.length}
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {communities.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No communities posted to yet.</p>
            ) : (
              communities.map((community) => (
                <button
                  key={community.name}
                  type="button"
                  onClick={() => onOpenCommunity?.(community.name)}
                  className="w-full flex items-center justify-between gap-3 p-1.5 rounded-xl hover:bg-gray-100/70 dark:hover:bg-slate-800 text-left transition cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={`https://images.ecency.com/u/${community.name}/avatar/small`}
                      alt=""
                      className="w-7 h-7 rounded-lg object-cover bg-gray-100 dark:bg-slate-800 flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.ecency.com/u/hive/avatar/small';
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 transition">
                        {community.title}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {community.count} {community.count === 1 ? 'post' : 'posts'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition" />
                </button>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
};

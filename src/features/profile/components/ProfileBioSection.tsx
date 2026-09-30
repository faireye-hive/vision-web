import React from 'react';
import { MapPin, Link as LinkIcon, Calendar, Users } from 'lucide-react';
import { HiveAccount } from '../../../services/hiveApi';
import { ProfileCustomStyle, BORDER_RADIUS_CLASSES } from '../profileStyleTypes';
import { getSmartTextColors } from '../profileColorUtils';

interface ProfileBioSectionProps {
  account: HiveAccount | null;
  metaProfile: any;
  profileStats: any;
  style: ProfileCustomStyle;
}

export const ProfileBioSection: React.FC<ProfileBioSectionProps> = ({
  account,
  metaProfile,
  profileStats,
  style
}) => {
  const roundedClass = BORDER_RADIUS_CLASSES[style.borderRadius];
  const smartColors = getSmartTextColors(style.textColor, style.textSecondaryColor, style.cardBackgroundColor);

  const cardStyleClass =
    style.cardStyle === 'glass'
      ? 'bg-white/75 dark:bg-slate-900/75 backdrop-blur-md border border-white/50 dark:border-slate-800/80 shadow-md'
      : style.cardStyle === 'outline'
      ? 'bg-transparent border-2 border-gray-200 dark:border-slate-800'
      : 'bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-xs';

  const joinedDate = account?.created
    ? new Date(`${account.created}Z`).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : '';

  const cardCustomStyle: React.CSSProperties = {
    backgroundColor: style.cardBackgroundColor || undefined,
    color: smartColors.textColor || undefined,
    borderColor: style.cardBackgroundColor ? `${style.accentColor}33` : undefined
  };

  return (
    <section
      style={cardCustomStyle}
      className={`${cardStyleClass} ${roundedClass} p-5 sm:p-6 transition-all duration-200 space-y-4`}
    >
      {/* Biography */}
      {metaProfile?.about ? (
        <p
          style={{ color: smartColors.textColor || undefined }}
          className="text-sm text-gray-700 dark:text-slate-200 leading-relaxed font-normal"
        >
          {metaProfile.about}
        </p>
      ) : (
        <p
          style={{ color: smartColors.textSecondaryColor || undefined }}
          className="text-xs text-gray-400 dark:text-slate-500 italic"
        >
          No biography provided yet.
        </p>
      )}

      {/* Profile Details List */}
      <div
        style={{ color: smartColors.textSecondaryColor || undefined }}
        className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500 dark:text-slate-400 pt-2 border-t border-gray-100 dark:border-slate-800/70"
      >
        {metaProfile?.location && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: style.accentColor }} />
            <span>{metaProfile.location}</span>
          </span>
        )}

        {metaProfile?.website && (
          <a
            href={metaProfile.website.startsWith('http') ? metaProfile.website : `https://${metaProfile.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:underline font-medium"
            style={{ color: style.accentColor }}
          >
            <LinkIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate max-w-[200px]">
              {String(metaProfile.website).replace(/^https?:\/\//, '')}
            </span>
          </a>
        )}

        {joinedDate && (
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
            <span>Joined {joinedDate}</span>
          </span>
        )}

        <span className="inline-flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
          <span>
            <strong className="text-gray-900 dark:text-white font-bold">
              {profileStats?.followers || 0}
            </strong>{' '}
            Followers
          </span>
          <span className="mx-1">•</span>
          <span>
            <strong className="text-gray-900 dark:text-white font-bold">
              {profileStats?.following || 0}
            </strong>{' '}
            Following
          </span>
        </span>
      </div>
    </section>
  );
};

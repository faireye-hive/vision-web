import React from 'react';
import { CheckCircle2, Settings, UserPlus, UserMinus } from 'lucide-react';
import { HiveAccount, calculateReputation, calculateVotingPower, getHiveAvatarUrl } from '../../../services/hiveApi';
import { ProfileCustomStyle, BORDER_RADIUS_CLASSES } from '../profileStyleTypes';
import { getSmartTextColors } from '../profileColorUtils';

interface ProfileHeaderSectionProps {
  currentUser: string;
  account: HiveAccount | null;
  metaProfile: any;
  style: ProfileCustomStyle;
  isOwner: boolean;
  isFollowing?: boolean;
  onFollowToggle?: () => void;
  onOpenCustomizer?: () => void;
}

export const ProfileHeaderSection: React.FC<ProfileHeaderSectionProps> = ({
  currentUser,
  account,
  metaProfile,
  style,
  isOwner,
  isFollowing,
  onFollowToggle,
  onOpenCustomizer
}) => {
  const reputation = account ? calculateReputation(account.reputation) : 25;
  const votingPower = account ? calculateVotingPower(account.voting_power, account.last_vote_time) : 100;

  const { headerConfig } = style;
  const strokeDasharray = 339.292;
  const strokeDashoffset = strokeDasharray - (strokeDasharray * votingPower) / 100;

  const roundedClass = BORDER_RADIUS_CLASSES[style.borderRadius];

  const cardStyleClass =
    style.cardStyle === 'glass'
      ? 'bg-white/75 dark:bg-slate-900/75 backdrop-blur-md border border-white/50 dark:border-slate-800/80 shadow-lg'
      : style.cardStyle === 'outline'
      ? 'bg-transparent border-2 border-gray-200 dark:border-slate-800'
      : 'bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-xs';

  const alignClass =
    style.headerAlignment === 'center'
      ? 'text-center items-center justify-center flex-col'
      : style.headerAlignment === 'right'
      ? 'text-right items-end justify-end flex-col sm:flex-row-reverse'
      : 'text-left items-start justify-between flex-col sm:flex-row';

  // Avatar Size Mapping
  const avatarSizeClasses = {
    sm: 'w-20 h-20 sm:w-24 sm:h-24',
    md: 'w-24 h-24 sm:w-28 sm:h-28',
    lg: 'w-28 h-28 sm:w-32 sm:h-32',
    xl: 'w-36 h-36 sm:w-44 sm:h-44'
  }[headerConfig.avatarSize || 'lg'];

  // Avatar Image Size
  const imgSizeClasses = {
    sm: 'w-16 h-16 sm:w-20 sm:h-20',
    md: 'w-20 h-20 sm:w-24 sm:h-24',
    lg: 'w-24 h-24 sm:w-28 sm:h-28',
    xl: 'w-32 h-32 sm:w-36 sm:h-36'
  }[headerConfig.avatarSize || 'lg'];

  // Avatar Shape Mapping
  const shapeClass = {
    circle: 'rounded-full',
    'rounded-square': 'rounded-2xl',
    squircle: 'rounded-[28px]',
    hexagon: 'rounded-3xl rotate-3'
  }[headerConfig.avatarShape || 'circle'];

  // Avatar Border Mapping
  const borderStyle: React.CSSProperties =
    headerConfig.avatarBorder === 'ring-accent'
      ? { boxShadow: `0 0 0 3px ${style.accentColor}` }
      : headerConfig.avatarBorder === 'glow'
      ? { boxShadow: `0 0 25px ${style.accentColor}70, 0 0 0 2px ${style.accentColor}` }
      : headerConfig.avatarBorder === 'double'
      ? { boxShadow: `0 0 0 2px #fff, 0 0 0 5px ${style.accentColor}` }
      : {};

  // Banner Height
  const bannerHeightClass = {
    compact: 'h-28 sm:h-36',
    normal: 'h-44 sm:h-60',
    tall: 'h-64 sm:h-80',
    hidden: 'hidden'
  }[headerConfig.bannerHeight || 'normal'];

  const showBanner = headerConfig.layout !== 'no-banner' && headerConfig.bannerHeight !== 'hidden';

  const bgEffective = style.headerBackgroundColor || style.cardBackgroundColor;
  const smartColors = getSmartTextColors(style.textColor, style.textSecondaryColor, bgEffective);

  const sectionCustomStyle: React.CSSProperties = {
    backgroundColor: bgEffective || undefined,
    color: smartColors.textColor || undefined,
    borderColor: bgEffective ? `${style.accentColor}33` : undefined
  };

  // ---------------------------------------------------------------------------
  // Reusable visual pieces. The data and callbacks remain exactly the same;
  // only the presentation changes according to headerConfig.layout.
  // ---------------------------------------------------------------------------

  const Banner = ({
    className = '',
    showDecorativeTag = true
  }: {
    className?: string;
    showDecorativeTag?: boolean;
  }) => (
    <div className={`relative bg-slate-950 overflow-hidden group ${className}`}>
      {metaProfile?.cover_image ? (
        <img
          src={metaProfile.cover_image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, ${style.accentColor}33 0%, transparent 60%)`
          }}
        />
      )}

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${style.accentColor}18, transparent 45%, rgba(0,0,0,.38))`
        }}
      />

      {showDecorativeTag && (
        <div className="absolute top-4 right-5 text-right hidden sm:block text-white/90 drop-shadow-md">
          <p className="text-[10px] font-semibold tracking-[0.18em] uppercase opacity-70">
            Hive Decentralized
          </p>
          <p className="text-xs font-bold">Web3 Creator</p>
        </div>
      )}

      {isOwner && onOpenCustomizer && (
        <button
          type="button"
          onClick={onOpenCustomizer}
          className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs font-semibold border border-white/20 transition cursor-pointer shadow-md"
          title="Edit profile layout and styles"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Customize Profile</span>
        </button>
      )}
    </div>
  );

  const Avatar = ({
    overlap = false,
    large = false
  }: {
    overlap?: boolean;
    large?: boolean;
  }) => (
    <div
      className={`relative flex-shrink-0 group ${
        overlap ? '-mt-14 sm:-mt-20' : ''
      }`}
    >
      <div
        className={`relative ${
          large
            ? 'w-32 h-32 sm:w-40 sm:h-40'
            : avatarSizeClasses
        } flex items-center justify-center`}
      >
        {headerConfig.showVotingRing && headerConfig.avatarShape === 'circle' && (
          <svg
            className="absolute inset-0 w-full h-full -rotate-90 transform"
            viewBox="0 0 120 120"
          >
            <circle
              cx="60"
              cy="60"
              r="54"
              className="stroke-gray-200/80 dark:stroke-slate-800"
              strokeWidth="5"
              fill="transparent"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              stroke={style.accentColor}
              strokeWidth="5"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
          </svg>
        )}

        <img
          src={getHiveAvatarUrl(currentUser, 'large')}
          alt={currentUser}
          style={borderStyle}
          className={`${
            large
              ? 'w-28 h-28 sm:w-36 sm:h-36'
              : imgSizeClasses
          } ${shapeClass} object-cover bg-slate-100 dark:bg-slate-800 shadow-md p-1 transition-all duration-300`}
        />

        <div
          className="absolute bottom-1 right-1 p-1 text-white rounded-full ring-2 ring-white dark:ring-slate-900 shadow-sm"
          style={{ backgroundColor: style.accentColor }}
          title={`Reputation: ${reputation}`}
        >
          <CheckCircle2 className="w-4 h-4 text-white" />
        </div>
      </div>

      {headerConfig.showVotingRing && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded-full whitespace-nowrap z-10 shadow-lg">
          Voting Power: {votingPower}%
        </div>
      )}
    </div>
  );

  const Actions = () => (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className="text-xs font-bold px-3 py-1 rounded-full border border-gray-100 dark:border-slate-700/60"
        style={{
          backgroundColor: `${style.accentColor}18`,
          color: style.accentColor
        }}
      >
        VP: {votingPower}%
      </span>

      <span className="text-xs font-bold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-1 rounded-full">
        Rep: {reputation}
      </span>

      {isOwner ? (
        onOpenCustomizer && (
          <button
            type="button"
            onClick={onOpenCustomizer}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-white text-xs font-bold shadow-sm transition hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: style.accentColor }}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Customize</span>
          </button>
        )
      ) : onFollowToggle ? (
        <button
          type="button"
          onClick={onFollowToggle}
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
            isFollowing
              ? 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-600'
              : 'text-white hover:opacity-95'
          }`}
          style={!isFollowing ? { backgroundColor: style.accentColor } : undefined}
        >
          {isFollowing ? (
            <UserMinus className="w-3.5 h-3.5" />
          ) : (
            <UserPlus className="w-3.5 h-3.5" />
          )}
          <span>{isFollowing ? 'Following' : 'Follow'}</span>
        </button>
      ) : null}
    </div>
  );

  const Identity = ({
    compact = false,
    centered = false
  }: {
    compact?: boolean;
    centered?: boolean;
  }) => (
    <div
      className={`${centered ? 'text-center' : 'text-left'} ${
        compact ? '' : 'mt-3.5'
      }`}
    >
      <div
        className={`flex items-center gap-2 ${
          centered ? 'justify-center' : 'justify-start'
        }`}
      >
        <h1
          style={{ color: smartColors.textColor || undefined }}
          className={`${
            compact
              ? 'text-xl sm:text-2xl'
              : 'text-2xl sm:text-3xl'
          } font-extrabold text-gray-900 dark:text-white tracking-tight`}
        >
          {metaProfile?.name || currentUser}
        </h1>

        <span style={{ color: style.accentColor }}>
          <CheckCircle2
            className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} fill-current text-white dark:text-slate-900`}
          />
        </span>
      </div>

      <p
        style={{ color: smartColors.textSecondaryColor || undefined }}
        className="text-xs font-semibold text-gray-400 dark:text-slate-500 mt-0.5"
      >
        @{currentUser}
      </p>
    </div>
  );

  const headerLayout = headerConfig.layout || 'standard';

  // ---------------------------------------------------------------------------
  // Header Display Styles
  //
  // standard       = classic banner + overlapping avatar
  // card-floating  = banner with a floating glass identity panel
  // no-banner      = clean author profile without cover
  // split-masthead = editorial two-column masthead
  // minimal-banner = compact social-profile header
  // ---------------------------------------------------------------------------

  if (headerLayout === 'card-floating') {
    return (
      <section
        style={sectionCustomStyle}
        className={`${cardStyleClass} ${roundedClass} overflow-hidden transition-all duration-200`}
      >
        <div className="relative">
          <Banner
            className={`${bannerHeightClass} ${
              bannerHeightClass === 'hidden' ? 'hidden' : ''
            }`}
          />

          <div className="relative px-4 sm:px-7 pb-5">
            <div className="relative -mt-14 sm:-mt-16">
              <div className="rounded-3xl bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border border-white/70 dark:border-slate-800 shadow-xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <Avatar overlap={false} large />

                  <div className="min-w-0 flex-1 pb-0.5">
                    <Identity compact />
                  </div>

                  <div className="sm:pb-1">
                    <Actions />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (headerLayout === 'no-banner') {
    return (
      <section
        style={sectionCustomStyle}
        className={`${cardStyleClass} ${roundedClass} overflow-hidden transition-all duration-200`}
      >
        <div className="px-5 sm:px-10 py-8 sm:py-10">
          <div className="flex flex-col items-center text-center">
            <div
              className="w-full h-1 rounded-full mb-8 opacity-80"
              style={{
                background: `linear-gradient(90deg, transparent, ${style.accentColor}, transparent)`
              }}
            />

            <Avatar overlap={false} large />

            <Identity centered />

            <div className="mt-5">
              <Actions />
            </div>

            <div
              className="mt-7 w-20 h-px"
              style={{ backgroundColor: `${style.accentColor}55` }}
            />
          </div>
        </div>
      </section>
    );
  }

  if (headerLayout === 'split-masthead') {
    return (
      <section
        style={sectionCustomStyle}
        className={`${cardStyleClass} ${roundedClass} overflow-hidden transition-all duration-200`}
      >
        <div className="grid grid-cols-1 md:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.4fr)] min-h-[280px]">
          <div className={`relative ${bannerHeightClass} md:h-full min-h-[180px]`}>
            <Banner
              className="absolute inset-0 h-full"
              showDecorativeTag={false}
            />
            <div className="absolute inset-0 flex items-end p-5 sm:p-7">
              <div className="rounded-2xl bg-black/35 backdrop-blur-md border border-white/15 px-3 py-2 text-white">
                <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/70">
                  Profile
                </span>
                <div className="text-sm font-bold">@{currentUser}</div>
              </div>
            </div>
          </div>

          <div className="relative px-5 sm:px-8 py-7 flex flex-col justify-center">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <Avatar overlap={false} />

              <div className="min-w-0 flex-1">
                <Identity />
                <div className="mt-4">
                  <Actions />
                </div>
              </div>
            </div>

            <div
              className="mt-7 h-1 w-16 rounded-full"
              style={{ backgroundColor: style.accentColor }}
            />
          </div>
        </div>
      </section>
    );
  }

  if (headerLayout === 'minimal-banner') {
    return (
      <section
        style={sectionCustomStyle}
        className={`${cardStyleClass} ${roundedClass} overflow-hidden transition-all duration-200`}
      >
        <div className="relative">
          <Banner
            className="h-24 sm:h-32"
            showDecorativeTag={false}
          />

          <div className="relative px-4 sm:px-6 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <Avatar overlap />

              <div className="min-w-0 flex-1 pb-0.5">
                <Identity compact />
              </div>

              <div className="sm:pb-1">
                <Actions />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // STANDARD — original profile presentation, kept as the default.
  return (
    <section
      style={sectionCustomStyle}
      className={`${cardStyleClass} ${roundedClass} overflow-hidden transition-all duration-200`}
    >
      {showBanner && (
        <Banner
          className={bannerHeightClass}
          showDecorativeTag
        />
      )}

      <div className={`px-6 sm:px-8 pb-6 relative ${!showBanner ? 'pt-8' : ''}`}>
        <div className={`flex flex-wrap items-end ${alignClass} gap-4`}>
          <Avatar overlap={showBanner} />

          <Actions />
        </div>

        <Identity />
      </div>
    </section>
  );
};
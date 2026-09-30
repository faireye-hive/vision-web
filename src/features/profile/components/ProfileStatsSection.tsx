import React from 'react';
import { Award, Zap, Coins, Wallet, Users } from 'lucide-react';
import { HiveAccount, calculateReputation, calculateVotingPower } from '../../../services/hiveApi';
import { ProfileCustomStyle, BORDER_RADIUS_CLASSES } from '../profileStyleTypes';
import { getSmartTextColors } from '../profileColorUtils';

interface ProfileStatsSectionProps {
  account: HiveAccount | null;
  profileStats: any;
  style: ProfileCustomStyle;
}

export const ProfileStatsSection: React.FC<ProfileStatsSectionProps> = ({
  account,
  profileStats,
  style
}) => {
  const { statsConfig } = style;
  const roundedClass = BORDER_RADIUS_CLASSES[style.borderRadius];
  const smartColors = getSmartTextColors(style.textColor, style.textSecondaryColor, style.cardBackgroundColor);

  const cardStyleClass =
    style.cardStyle === 'glass'
      ? 'bg-white/75 dark:bg-slate-900/75 backdrop-blur-md border border-white/50 dark:border-slate-800/80 shadow-md'
      : style.cardStyle === 'outline'
      ? 'bg-transparent border-2 border-gray-200 dark:border-slate-800'
      : 'bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-xs';

  const reputation = account ? calculateReputation(account.reputation) : 25;
  const votingPower = account ? calculateVotingPower(account.voting_power, account.last_vote_time) : 100;

  const hiveBalance = account?.balance || '0.000 HIVE';
  const hbdBalance = account?.hbd_balance || '0.000 HBD';
  const savingsBalance = account?.savings_hbd_balance || '0.000 HBD';

  // Check if at least one metric is enabled
  const hasAnyMetric =
    statsConfig.showReputation ||
    statsConfig.showVotingPower ||
    statsConfig.showFollowerCounts ||
    statsConfig.showHiveBalance ||
    statsConfig.showHbdBalance ||
    statsConfig.showSavingsBalance;

  if (!hasAnyMetric) return null;

  const cardCustomStyle: React.CSSProperties = {
    backgroundColor: style.cardBackgroundColor || undefined,
    color: smartColors.textColor || undefined,
    borderColor: style.cardBackgroundColor ? `${style.accentColor}33` : undefined
  };

  // VARIANT 1: MINIMAL ROW (for Writers & Journalists)
  if (statsConfig.styleVariant === 'minimal-row') {
    return (
      <section
        style={cardCustomStyle}
        className={`${cardStyleClass} ${roundedClass} px-5 py-3 transition-all duration-200`}
      >
        <div className="flex flex-wrap items-center justify-around gap-4 text-center divide-x divide-gray-100 dark:divide-slate-800">
          {statsConfig.showReputation && (
            <div className="px-3">
              <span
                style={{ color: style.textSecondaryColor || undefined }}
                className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block"
              >
                Reputation
              </span>
              <span
                style={{ color: style.textColor || undefined }}
                className="text-base font-extrabold text-gray-900 dark:text-white"
              >
                {reputation}
              </span>
            </div>
          )}

          {statsConfig.showFollowerCounts && (
            <div className="px-3">
              <span
                style={{ color: style.textSecondaryColor || undefined }}
                className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block"
              >
                Followers
              </span>
              <span
                style={{ color: style.textColor || undefined }}
                className="text-base font-extrabold text-gray-900 dark:text-white"
              >
                {profileStats?.followers || 0}
              </span>
            </div>
          )}

          {statsConfig.showVotingPower && (
            <div className="px-3">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block">Voting Power</span>
              <span className="text-base font-extrabold" style={{ color: style.accentColor }}>{votingPower}%</span>
            </div>
          )}

          {statsConfig.showHiveBalance && (
            <div className="px-3">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block">HIVE</span>
              <span className="text-base font-extrabold text-gray-900 dark:text-white">{hiveBalance.split(' ')[0]}</span>
            </div>
          )}

          {statsConfig.showHbdBalance && (
            <div className="px-3">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block">HBD</span>
              <span className="text-base font-extrabold text-gray-900 dark:text-white">{hbdBalance.split(' ')[0]}</span>
            </div>
          )}
        </div>
      </section>
    );
  }

  // VARIANT 2: PILLS RIBBON (Sleek modern badges)
  if (statsConfig.styleVariant === 'pills') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {statsConfig.showReputation && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs">
            <Award className="w-3.5 h-3.5" style={{ color: style.accentColor }} />
            <span>Rep {reputation}</span>
          </span>
        )}

        {statsConfig.showVotingPower && (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-xs"
            style={{ backgroundColor: `${style.accentColor}18`, color: style.accentColor }}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>VP {votingPower}%</span>
          </span>
        )}

        {statsConfig.showFollowerCounts && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 shadow-xs">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <span>{profileStats?.followers || 0} Followers</span>
          </span>
        )}

        {statsConfig.showHiveBalance && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 shadow-xs">
            <Coins className="w-3.5 h-3.5 text-rose-500" />
            <span>{hiveBalance}</span>
          </span>
        )}

        {statsConfig.showHbdBalance && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 shadow-xs">
            <Wallet className="w-3.5 h-3.5 text-emerald-500" />
            <span>{hbdBalance}</span>
          </span>
        )}
      </div>
    );
  }

  // VARIANT 3: FULL METRIC CARDS (Default)
  return (
    <section
      style={cardCustomStyle}
      className={`${cardStyleClass} ${roundedClass} p-5 sm:p-6 transition-all duration-200 space-y-4`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4" style={{ color: style.accentColor }} />
          <h3
            style={{ color: style.textColor || undefined }}
            className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider"
          >
            Stats & Balances
          </h3>
        </div>
        {statsConfig.showReputation && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
            style={{ backgroundColor: `${style.accentColor}18`, color: style.accentColor }}
          >
            Rep {reputation}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statsConfig.showVotingPower && (
          <div className="p-3 rounded-2xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800/60">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium">Voting Power</span>
              <Zap className="w-3.5 h-3.5" style={{ color: style.accentColor }} />
            </div>
            <p className="text-lg font-extrabold text-gray-900 dark:text-white">
              {votingPower}%
            </p>
            <div className="w-full bg-gray-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${votingPower}%`, backgroundColor: style.accentColor }}
              />
            </div>
          </div>
        )}

        {statsConfig.showFollowerCounts && (
          <div className="p-3 rounded-2xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800/60">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium">Community</span>
              <Users className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <p className="text-lg font-extrabold text-gray-900 dark:text-white">
              {profileStats?.followers || 0}
            </p>
            <span className="text-[10px] text-gray-400 font-semibold">Followers on Hive</span>
          </div>
        )}

        {statsConfig.showHiveBalance && (
          <div className="p-3 rounded-2xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800/60">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium">HIVE</span>
              <Coins className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <p className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white truncate" title={hiveBalance}>
              {hiveBalance.split(' ')[0]}
            </p>
            <span className="text-[10px] text-gray-400 font-semibold">Liquid Balance</span>
          </div>
        )}

        {statsConfig.showHbdBalance && (
          <div className="p-3 rounded-2xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800/60">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium">HBD</span>
              <Wallet className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <p className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white truncate" title={hbdBalance}>
              {hbdBalance.split(' ')[0]}
            </p>
            <span className="text-[10px] text-gray-400 font-semibold">Hive Dollars</span>
          </div>
        )}

        {statsConfig.showSavingsBalance && (
          <div className="p-3 rounded-2xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800/60">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium">Savings</span>
              <Coins className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <p className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white truncate" title={savingsBalance}>
              {savingsBalance.split(' ')[0]}
            </p>
            <span className="text-[10px] text-emerald-500 font-semibold">15% APR</span>
          </div>
        )}
      </div>
    </section>
  );
};

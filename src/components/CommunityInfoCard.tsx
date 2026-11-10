import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  FileText,
  PenSquare,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  UserCheck
} from 'lucide-react';
import { HiveCommunity, getCommunity, getHiveAvatarUrl } from '../services/hiveApi';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { CommunityAdminButton } from './CommunityAdminButton';

interface CommunityInfoCardProps {
  communityName: string;
  onSelectAuthor?: (author: string) => void;
}

export const CommunityInfoCard: React.FC<CommunityInfoCardProps> = ({
  communityName,
  onSelectAuthor
}) => {
  const { currentUser, joinedCommunities, toggleJoinCommunity } = useAuth();
  const { openWritePage, openAuthorProfile } = useNavigation();

  const [community, setCommunity] = useState<HiveCommunity | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showFullRules, setShowFullRules] = useState<boolean>(false);
  const [showFullAbout, setShowFullAbout] = useState<boolean>(false);
  const [showLeadership, setShowLeadership] = useState<boolean>(false);
  const [subscribing, setSubscribing] = useState<boolean>(false);

  const cleanName = communityName.trim().toLowerCase();
  const isSubscribed = Boolean(joinedCommunities[cleanName]);

  useEffect(() => {
    let isMounted = true;
    if (!cleanName || !cleanName.startsWith('hive-')) {
      setCommunity(null);
      setLoading(false);
      return;
    }

    setCommunity(null);
    setLoading(true);
    getCommunity(cleanName)
      .then((data) => {
        if (isMounted) {
          setCommunity(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load community info:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cleanName]);

  const handleToggleSubscribe = async () => {
    if (!cleanName) return;
    setSubscribing(true);
    try {
      const err = await toggleJoinCommunity(cleanName);
      if (err) {
        alert(err);
      }
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm animate-pulse dark:border-slate-800 dark:bg-slate-900">
        <div className="h-20 bg-slate-200 dark:bg-slate-800" />
        <div className="px-3 pb-3">
          <div className="-mt-7 flex items-end gap-3">
            <div className="h-14 w-14 rounded-2xl border-4 border-white bg-slate-300 dark:border-slate-900 dark:bg-slate-700" />
            <div className="mb-2 h-8 w-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800/70" />
            <div className="h-3 w-4/5 rounded bg-slate-100 dark:bg-slate-800/70" />
          </div>
        </div>
      </div>
    );
  }

  if (!community) {
    return null;
  }

  // Keep the cover neutral until the community image loads.
  const coverUrl = `https://images.ecency.com/u/${community.name}/cover`;
  const avatarUrl = community.avatar_url || `https://images.ecency.com/u/${community.name}/avatar/medium`;

  // Parse rules or guidelines from description or flag_text
  const rulesText = community.description || community.flag_text || '';
  const hasRules = Boolean(rulesText && rulesText.trim().length > 10);

  // Parse leadership team
  const leadership = (community.team || []).filter(
    ([username, role]) => username && (role === 'admin' || role === 'mod' || role === 'owner')
  );

  return (
    <article className="w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white text-gray-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
      <div className="relative h-24 w-full overflow-hidden bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900">
        <img
          src={coverUrl}
          alt={community.title}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />

        {community.is_nsfw && (
          <span className="absolute right-2 top-2 rounded-full border border-white/20 bg-black/55 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
            Sensitive community
          </span>
        )}
      </div>

      <div className="px-3 pb-3">
        <div className="relative z-10 -mt-7">
          <img
            src={avatarUrl}
            alt={community.title}
            className="relative z-10 h-16 w-16 rounded-2xl border-4 border-white bg-white object-cover shadow-md dark:border-slate-900 dark:bg-slate-800"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive-125125/avatar/medium';
            }}
          />
        </div>

        <div className="mt-2 min-w-0">
          <h2 className="text-base font-bold leading-tight text-gray-900 dark:text-white">
            {community.title}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-mono">{community.name}</span>
            {community.lang && (
              <>
                <span aria-hidden="true">·</span>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {community.lang}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleSubscribe}
            disabled={subscribing}
            className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition disabled:cursor-wait disabled:opacity-60 ${
              isSubscribed
                ? 'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                : 'bg-slate-900 text-white shadow-sm hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white'
            }`}
            title={isSubscribed ? 'Click to unsubscribe from this community' : 'Join this community on Hive'}
          >
            {subscribing ? (
              <span>Saving…</span>
            ) : isSubscribed ? (
              <>
                <Check className="h-4 w-4" />
                <span>Joined</span>
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4" />
                <span>Join community</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => openWritePage(cleanName)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            title="Write a post for this community"
            aria-label={`Write a post for ${community.title}`}
          >
            <PenSquare className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 divide-x divide-slate-200 rounded-xl border border-slate-200/70 bg-slate-50 px-2 py-2 dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="px-1 text-center">
            <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-800 dark:text-slate-100">
              <Users className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <span>{community.subscribers.toLocaleString()}</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Subscribers</span>
          </div>

          <div className="px-1 text-center">
            <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-800 dark:text-slate-100">
              <FileText className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <span>{community.num_authors.toLocaleString()}</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Active authors</span>
          </div>
        </div>

        <CommunityAdminButton communityName={cleanName} />
        {community.about && (
          <section className="mt-3">
            <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
              <Info className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              About
            </h3>
            <p className={`whitespace-pre-line text-xs leading-relaxed text-slate-600 dark:text-slate-300 ${showFullAbout ? '' : 'line-clamp-3'}`}>
              {community.about}
            </p>
            {community.about.length > 150 && (
              <button
                type="button"
                onClick={() => setShowFullAbout((prev) => !prev)}
                aria-expanded={showFullAbout}
                className="mt-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                {showFullAbout ? 'Show less' : 'Read more'}
              </button>
            )}
          </section>
        )}

        {hasRules && (
          <div className="mt-3 border-t border-slate-100 pt-2.5 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowFullRules((prev) => !prev)}
              aria-expanded={showFullRules}
              className="flex w-full items-center justify-between text-xs font-semibold text-slate-700 transition hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
            >
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                <span>Guidelines</span>
              </div>
              {showFullRules ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showFullRules && (
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Community guidelines</span>
                </div>
                <div className="max-h-48 overflow-y-auto whitespace-pre-line pr-1 text-[11px] leading-relaxed">
                  {rulesText}
                </div>
              </div>
            )}
          </div>
        )}

        {leadership.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-2.5 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowLeadership((prev) => !prev)}
              aria-expanded={showLeadership}
              className="flex w-full items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <span className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                Community team
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                {leadership.length}
                {showLeadership ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </span>
            </button>

            {showLeadership && <div className="mt-2 space-y-1">
              {leadership.slice(0, 5).map(([user, role, title]) => (
                <button
                  key={user}
                  type="button"
                  onClick={() => {
                    if (onSelectAuthor) onSelectAuthor(user);
                    else openAuthorProfile(user);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-xl p-1.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={getHiveAvatarUrl(user, 'small')}
                      alt={user}
                      className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                      }}
                    />
                    <div className="truncate">
                      <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                        @{user}
                      </span>
                      {title && <span className="text-[10px] text-gray-400 truncate block">{title}</span>}
                    </div>
                  </div>

                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                    {role}
                  </span>
                </button>
              ))}
            </div>}
          </div>
        )}
      </div>
    </article>
  );
};

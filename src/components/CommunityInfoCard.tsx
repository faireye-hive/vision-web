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
  DollarSign,
  UserCheck
} from 'lucide-react';
import { HiveCommunity, getCommunity, getHiveAvatarUrl } from '../services/hiveApi';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';

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
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/60 dark:border-slate-800 animate-pulse space-y-4">
        <div className="h-20 bg-gray-200 dark:bg-slate-800 rounded-2xl" />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-slate-800 -mt-8 ml-2 border-2 border-white dark:border-slate-900" />
          <div className="flex-1 space-y-2">
            <div className="w-2/3 h-4 bg-gray-200 dark:bg-slate-800 rounded" />
            <div className="w-1/3 h-3 bg-gray-200 dark:bg-slate-800 rounded" />
          </div>
        </div>
        <div className="space-y-2 pt-2">
          <div className="w-full h-3 bg-gray-200 dark:bg-slate-800 rounded" />
          <div className="w-4/5 h-3 bg-gray-200 dark:bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  if (!community) {
    return null;
  }

  // Cover image with fallback gradient
  const coverUrl = `https://images.ecency.com/u/${community.name}/cover`;
  const avatarUrl = community.avatar_url || `https://images.ecency.com/u/${community.name}/avatar/medium`;

  // Parse rules or guidelines from description or flag_text
  const rulesText = community.description || community.flag_text || '';
  const hasRules = Boolean(rulesText && rulesText.length > 10);

  // Parse leadership team
  const leadership = (community.team || []).filter(
    ([username, role]) => username && (role === 'admin' || role === 'mod' || role === 'owner')
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[15px] p-2.5 overflow-hidden shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/60 dark:border-slate-800 text-gray-900 dark:text-slate-100 space-y-0" style={{ marginTop: '39px' }}>
      {/* Cover Banner Header */}
      <div className="relative h-24 sm:h-28 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 overflow-hidden">
        <img
          src={coverUrl}
          alt={community.title}
          className="w-full h-full object-cover opacity-85"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

        {community.is_nsfw && (
          <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-xs">
            18+ NSFW
          </span>
        )}
      </div>

      {/* Community Profile Body */}
      <div className="px-5 pt-0 pb-5">
        {/* Avatar & Main Actions */}
        <div className="flex items-end justify-between -mt-9 mb-3">
          <img
            src={avatarUrl}
            alt={community.title}
            className="w-16 h-16 rounded-2xl object-cover border-3 border-white dark:border-slate-900 shadow-md bg-white dark:bg-slate-800"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive-125125/avatar/medium';
            }}
          />

          <div className="flex items-center gap-2">
            {/* Subscribe Toggle */}
            <button
              onClick={handleToggleSubscribe}
              disabled={subscribing}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 ${
                isSubscribed
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              title={isSubscribed ? 'Click to unsubscribe' : 'Join this community on Hive'}
            >
              {isSubscribed ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Joined</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Join</span>
                </>
              )}
            </button>

            {/* Quick Post Button */}
            <button
              onClick={() => openWritePage()}
              className="p-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 transition cursor-pointer"
              title="Post in this community"
            >
              <PenSquare className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Community Titles */}
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
            {community.title}
          </h2>
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            <span>{community.name}</span>
            {community.lang && (
              <>
                <span>•</span>
                <span className="uppercase text-[10px] font-semibold bg-gray-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                  {community.lang}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2 my-3 p-2.5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100/70 dark:border-slate-800 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-xs font-bold text-gray-900 dark:text-white">
              <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{community.subscribers.toLocaleString()}</span>
            </div>
            <span className="text-[10px] text-gray-400 dark:text-slate-500">Subscribers</span>
          </div>

          <div>
            <div className="flex items-center justify-center gap-1 text-xs font-bold text-gray-900 dark:text-white">
              <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{community.num_authors.toLocaleString()}</span>
            </div>
            <span className="text-[10px] text-gray-400 dark:text-slate-500">Active Posters</span>
          </div>
        </div>

        {/* Bio / About */}
        {community.about && (
          <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed mb-3">
            {community.about}
          </p>
        )}

        {/* Rules & Guidelines Section */}
        {hasRules && (
          <div className="border-t border-gray-100 dark:border-slate-800 pt-3 mt-3">
            <button
              onClick={() => setShowFullRules((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs font-bold text-gray-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Community Rules</span>
              </div>
              {showFullRules ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showFullRules && (
              <div className="mt-2.5 p-3 rounded-2xl bg-amber-50/60 dark:bg-slate-800/80 border border-amber-200/60 dark:border-slate-700 text-xs text-gray-700 dark:text-slate-300 space-y-2 animate-in fade-in">
                <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold text-[11px]">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Guidelines from Community Leaders</span>
                </div>
                <div className="whitespace-pre-line text-[11px] leading-relaxed max-h-56 overflow-y-auto pr-1">
                  {rulesText}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Leadership & Moderators */}
        {leadership.length > 0 && (
          <div className="border-t border-gray-100 dark:border-slate-800 pt-3 mt-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-slate-200 mb-2">
              <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Leadership Team</span>
            </div>

            <div className="space-y-1.5">
              {leadership.slice(0, 5).map(([user, role, title]) => (
                <div
                  key={user}
                  onClick={() => {
                    if (onSelectAuthor) onSelectAuthor(user);
                    else openAuthorProfile(user);
                  }}
                  className="flex items-center justify-between p-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer"
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
                      <span className="text-xs font-semibold text-gray-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 truncate block">
                        @{user}
                      </span>
                      {title && <span className="text-[10px] text-gray-400 truncate block">{title}</span>}
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md capitalize ${
                    role === 'owner'
                      ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                      : role === 'admin'
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

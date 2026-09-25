import React, { useState, useEffect } from 'react';
import { UserPlus, Check, Sparkles, RefreshCw, UserCheck } from 'lucide-react';
import { HivePost, getHiveAvatarUrl, hiveRpcCall, calculateReputation } from '../services/hiveApi';
import { CurrentUser, KeychainService } from '../services/keychain';

interface RecommendedUser {
  username: string;
  reputation: number;
  about?: string;
  tagline?: string;
}

interface RecommendedUsersCardProps {
  currentUser: CurrentUser | null;
  feedPosts?: HivePost[];
  onSelectAuthor: (author: string) => void;
  followingUsers?: string[];
  onFollowChange?: (targetUser: string, isNowFollowing: boolean) => void;
}

const CURATED_CREATORS: { username: string; tagline: string }[] = [
  { username: 'good-karma', tagline: 'Founder of Ecency & Hive Developer' },
  { username: 'ecency', tagline: 'Decentralized Social Network on Hive' },
  { username: 'arcange', tagline: 'Hive Witness & HiveSQL Creator' },
  { username: 'blocktrades', tagline: 'Core Hive Blockchain Developer' },
  { username: 'leofinance', tagline: 'Decentralized Web3 Finance & InLeo' },
  { username: 'acidyo', tagline: 'Curator, OCD & POSH Project Founder' },
  { username: 'tarazkp', tagline: 'Community builder & daily writer' },
  { username: 'taskmaster4450', tagline: 'Tech, AI, Crypto & Web3 analyst' },
  { username: 'aliento', tagline: 'Hispanic Hive community incubator' },
  { username: 'galenkp', tagline: 'Weekend Experiences & story teller' },
  { username: 'khaleelkazi', tagline: 'Founder of Leo & Web3 entrepreneur' },
  { username: 'theycallmedan', tagline: 'Decentralization advocate & Hive investor' }
];

export const RecommendedUsersCard: React.FC<RecommendedUsersCardProps> = ({
  currentUser,
  feedPosts = [],
  onSelectAuthor,
  followingUsers = [],
  onFollowChange
}) => {
  const [loading, setLoading] = useState(false);
  const [displayUsers, setDisplayUsers] = useState<RecommendedUser[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Sync following state from prop
  useEffect(() => {
    const map: Record<string, boolean> = {};
    for (const u of followingUsers) {
      map[u.toLowerCase()] = true;
    }
    setFollowingMap(map);
  }, [followingUsers]);

  // Load recommended creators
  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const currentLower = currentUser?.username?.toLowerCase() || '';

      // Collect candidate usernames: Curated + active authors from current feed
      const candidateMap = new Map<string, string>();
      for (const c of CURATED_CREATORS) {
        if (c.username.toLowerCase() !== currentLower) {
          candidateMap.set(c.username.toLowerCase(), c.tagline);
        }
      }

      for (const p of feedPosts) {
        const a = p.author?.toLowerCase();
        if (a && a !== currentLower && !candidateMap.has(a)) {
          candidateMap.set(a, p.community_title || 'Active content creator');
        }
      }

      // Prioritize creators the current user is NOT yet following
      const candidates = Array.from(candidateMap.entries()).sort(([userA], [userB]) => {
        const aFollowed = !!followingMap[userA];
        const bFollowed = !!followingMap[userB];
        if (!aFollowed && bFollowed) return -1;
        if (aFollowed && !bFollowed) return 1;
        return 0;
      });

      // Take top 6 candidates
      const topCandidates = candidates.slice(0, 6);
      const names = topCandidates.map(([name]) => name);

      // Query real account reputations from blockchain
      const accounts = await hiveRpcCall<Array<{ name: string; reputation: number | string; posting_json_metadata?: string }>>(
        'condenser_api.get_accounts',
        [names]
      );

      const resolved: RecommendedUser[] = topCandidates.map(([username, fallbackTagline]) => {
        const acc = accounts?.find((a: any) => a.name.toLowerCase() === username);
        const repScore = acc ? calculateReputation(acc.reputation) : 65;

        return {
          username,
          reputation: repScore,
          tagline: fallbackTagline
        };
      });

      setDisplayUsers(resolved);
    } catch (err) {
      console.error('Error loading recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
  }, [currentUser?.username, feedPosts.length]);

  // Handle follow / unfollow
  const handleToggleFollow = async (targetUser: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCurrentlyFollowing = !!followingMap[targetUser.toLowerCase()];
    const willFollow = !isCurrentlyFollowing;

    // Optimistic UI update
    setFollowingMap(prev => ({
      ...prev,
      [targetUser.toLowerCase()]: willFollow
    }));

    if (onFollowChange) {
      onFollowChange(targetUser, willFollow);
    }

    if (currentUser?.username) {
      setActionLoading(prev => ({ ...prev, [targetUser]: true }));
      try {
        await KeychainService.followUser(currentUser.username, targetUser, willFollow);
      } catch (err) {
        console.warn('Keychain follow action warning:', err);
      } finally {
        setActionLoading(prev => ({ ...prev, [targetUser]: false }));
      }
    }
  };

  return (
    <div id="recommended-users-card" className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/60 dark:border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
            <UserPlus className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">Who to follow</h3>
        </div>

        <button
          onClick={loadRecommendations}
          disabled={loading}
          className="text-gray-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded-lg transition cursor-pointer disabled:opacity-50"
          title="Refresh recommendations"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      </div>

      {/* User list */}
      <div className="space-y-3.5">
        {displayUsers.map((user) => {
          const isFollowing = !!followingMap[user.username.toLowerCase()];
          const isBusy = !!actionLoading[user.username];

          return (
            <div
              key={user.username}
              onClick={() => onSelectAuthor(user.username)}
              className="flex items-center justify-between gap-3 p-1.5 -mx-1.5 rounded-2xl hover:bg-gray-50/80 dark:hover:bg-slate-800/60 transition cursor-pointer group"
            >
              {/* Avatar + Info */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <img
                  src={getHiveAvatarUrl(user.username, 'small')}
                  alt={user.username}
                  className="w-9 h-9 rounded-full object-cover bg-gray-100 dark:bg-slate-800 flex-shrink-0 ring-1 ring-gray-100 dark:ring-slate-800"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                  }}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                      @{user.username}
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-1 py-0.2 rounded-sm flex-shrink-0">
                      {user.reputation}
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate leading-tight mt-0.5">
                    {user.tagline || 'Hive Creator'}
                  </p>
                </div>
              </div>

              {/* Follow Button */}
              <button
                type="button"
                onClick={(e) => handleToggleFollow(user.username, e)}
                disabled={isBusy}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition flex-shrink-0 cursor-pointer ${
                  isFollowing
                    ? 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800 border border-gray-200 dark:border-slate-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs'
                }`}
                title={isFollowing ? 'Click to unfollow' : 'Follow this creator'}
              >
                {isBusy ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : isFollowing ? (
                  <>
                    <UserCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3 h-3" />
                    <span>Follow</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

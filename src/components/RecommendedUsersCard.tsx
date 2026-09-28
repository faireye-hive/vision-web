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
  activeAuthor?: string | null;
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

// Chave para armazenamento no LocalStorage
const REPUTATION_CACHE_KEY = 'hive_recommended_users_cache_v1';

// Utilitários de leitura/escrita de Cache
const getCachedReputations = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(REPUTATION_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveCachedReputations = (newEntries: Record<string, number>) => {
  try {
    const current = getCachedReputations();
    const updated = { ...current, ...newEntries };
    localStorage.setItem(REPUTATION_CACHE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Falha ao salvar cache de reputações:', e);
  }
};

export const RecommendedUsersCard: React.FC<RecommendedUsersCardProps> = ({
  currentUser,
  feedPosts = [],
  onSelectAuthor,
  activeAuthor,
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

  // Load recommended creators (Com Cache Persistente)
  const loadRecommendations = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const currentLower = currentUser?.username?.toLowerCase() || '';

      // 1. Coleta candidatos: Curated + autores do feed atual
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

      // 2. Prioriza criadores que o usuário ainda NÃO segue
      const candidates = Array.from(candidateMap.entries()).sort(([userA], [userB]) => {
        const aFollowed = !!followingMap[userA];
        const bFollowed = !!followingMap[userB];
        if (!aFollowed && bFollowed) return -1;
        if (aFollowed && !bFollowed) return 1;
        return 0;
      });

      // Pega os 6 principais candidatos
      const topCandidates = candidates.slice(0, 6);
      const names = topCandidates.map(([name]) => name);

      // 3. Checa quais nomes já estão em CACHE no LocalStorage
      const reputationCache = getCachedReputations();
      const namesToFetch: string[] = [];

      if (forceRefresh) {
        namesToFetch.push(...names);
      } else {
        for (const name of names) {
          if (reputationCache[name] === undefined) {
            namesToFetch.push(name);
          }
        }
      }

      // 4. Busca na API apenas para quem AINDA NÃO TEM cache armazenado
      const newFetchedEntries: Record<string, number> = {};

      if (namesToFetch.length > 0) {
        const accounts = await hiveRpcCall<Array<{ name: string; reputation: number | string }>>(
          'condenser_api.get_accounts',
          [namesToFetch]
        ).catch(() => []);

        for (const acc of accounts || []) {
          if (acc?.name) {
            const repScore = calculateReputation(acc.reputation);
            newFetchedEntries[acc.name.toLowerCase()] = repScore;
          }
        }

        // Salva os novos resultados no cache do navegador
        saveCachedReputations(newFetchedEntries);
      }

      // Unifica cache existente + buscas novas
      const updatedCache = { ...reputationCache, ...newFetchedEntries };

      // 5. Monta a lista final para renderizar sem pendências de API
      const resolved: RecommendedUser[] = topCandidates.map(([username, fallbackTagline]) => {
        const repScore = updatedCache[username] ?? 65;

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
    loadRecommendations(false);
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

        {/* Botão de refresh manual para forçar nova atualização se desejar */}
        <button
          onClick={() => loadRecommendations(true)}
          disabled={loading}
          className="text-gray-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded-lg transition cursor-pointer disabled:opacity-50"
          title="Force refresh recommendations"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      </div>

      {/* User list */}
      <div className="space-y-3.5">
        {displayUsers.map((user) => {
          const isFollowing = !!followingMap[user.username.toLowerCase()];
          const isBusy = !!actionLoading[user.username];

          const isActive = Boolean(
            activeAuthor && 
            activeAuthor.trim().toLowerCase() === user.username.trim().toLowerCase()
          );

          return (
            <div
              key={user.username}
              onClick={() => onSelectAuthor(user.username)}
              className={`flex items-center justify-between gap-3 p-2 -mx-1.5 rounded-2xl transition-all cursor-pointer group ${
                isActive
                  ? 'bg-blue-100 dark:bg-blue-900/80 border-2 border-blue-500 shadow-md scale-[1.02]'
                  : 'hover:bg-gray-50/80 dark:hover:bg-slate-800/60 border-2 border-transparent'
              }`}
            >
              {/* Avatar + Info */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <img
                  src={getHiveAvatarUrl(user.username, 'small')}
                  alt={user.username}
                  className={`w-9 h-9 rounded-full object-cover bg-gray-100 dark:bg-slate-800 flex-shrink-0 transition-all ${
                    isActive
                      ? 'ring-2 ring-blue-600 scale-105'
                      : 'ring-1 ring-gray-100 dark:ring-slate-800'
                  }`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                  }}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-semibold text-xs truncate ${
                      isActive 
                        ? 'text-blue-700 dark:text-blue-300 font-extrabold' 
                        : 'text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400'
                    }`}>
                      @{user.username}
                    </span>

                    {/* Tag visual de confirmação */}
                    {isActive && (
                      <span className="text-[9px] font-black text-white bg-blue-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
                        Ativo
                      </span>
                    )}

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
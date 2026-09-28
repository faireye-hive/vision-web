import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Compass,
  ExternalLink,
  Layers,
  Search,
  ShieldCheck,
  Users
} from 'lucide-react';
import { getCommunity, getHiveAvatarUrl, getSubscriptions, HiveCommunity, listCommunities } from '../services/hiveApi';
import {
  categoryChoices,
  classifyCommunity,
  ClassifiedCommunity,
  describeLanguage
} from '../utils/communityTaxonomy';

interface CommunitiesPageProps {
  mode: 'explore' | 'manage';
  onClose: () => void;
  onSwitchMode: (mode: 'explore' | 'manage') => void;
  onSelectCommunity: (communityName: string) => void;
  joinedCommunities: Record<string, boolean>;
  onToggleJoinCommunity: (communityName: string) => Promise<string | null> | string | null;
  account?: string | null;
}

export const CommunitiesPage: React.FC<CommunitiesPageProps> = ({
  mode,
  onClose,
  onSwitchMode,
  onSelectCommunity,
  joinedCommunities,
  onToggleJoinCommunity,
  account = null
}) => {
  const [communities, setCommunities] = useState<HiveCommunity[]>([]);
  const [owned, setOwned] = useState<HiveCommunity[]>([]);
  const [searchResults, setSearchResults] = useState<HiveCommunity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [ownedLoading, setOwnedLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'rank' | 'subs' | 'new'>('rank');
  const [category, setCategory] = useState('all');
  const [language, setLanguage] = useState('all');
  const [onlySubscribed, setOnlySubscribed] = useState(false);
  const [hideSensitive, setHideSensitive] = useState(true);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setHasMore(true);
    listCommunities(sortOrder, 100)
      .then((listed) => {
        if (!mounted) return;
        setCommunities(listed || []);
        setHasMore((listed || []).length >= 100);
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [sortOrder]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2 || mode === 'manage') {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }
    let mounted = true;
    setSearchLoading(true);
    const handle = window.setTimeout(() => {
      listCommunities(sortOrder, 100, false, '', query)
        .then((listed) => {
          if (!mounted) return;
          setSearchResults(listed || []);
          setHasMore((listed || []).length >= 100);
          setSearchLoading(false);
        })
        .catch(() => {
          if (mounted) setSearchLoading(false);
        });
    }, 280);
    return () => {
      mounted = false;
      window.clearTimeout(handle);
    };
  }, [mode, searchQuery, sortOrder]);

  useEffect(() => {
    if (!account) {
      setOwned([]);
      setOwnedLoading(false);
      return;
    }
    let mounted = true;
    setOwnedLoading(true);
    getSubscriptions(account, true)
      .then(async (rows) => {
        const detailed: HiveCommunity[] = [];
        for (let index = 0; index < rows.length; index += 6) {
          const chunk = rows.slice(index, index + 6);
          const resolved = await Promise.all(chunk.map(async ([name, title]) => {
            const full = await getCommunity(name).catch(() => null);
            return full || {
              id: 0,
              name,
              title: title || name,
              about: '',
              subscribers: 0,
              num_pending: 0,
              num_authors: 0,
              is_nsfw: false
            };
          }));
          detailed.push(...resolved);
        }
        if (mounted) {
          setOwned(detailed);
          setOwnedLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setOwnedLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [account]);

  const catalog = useMemo(() => {
    const base = mode === 'manage' ? owned : (searchResults ?? communities);
    if (mode !== 'manage') return base;
    const copy = [...base];
    if (sortOrder === 'subs') copy.sort((a, b) => (b.subscribers || 0) - (a.subscribers || 0));
    if (sortOrder === 'new') copy.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return copy;
  }, [communities, mode, owned, searchResults, sortOrder]);
  const classified = useMemo(
    () => catalog.map(classifyCommunity),
    [catalog]
  );

  const query = searchQuery.trim().toLowerCase();
  const inScope = useMemo(() => {
    return classified.filter((item) => {
      if (hideSensitive && item.community.is_nsfw) return false;
      if (mode === 'explore' && onlySubscribed && !joinedCommunities[item.community.name]) return false;
      if (!query) return true;
      return (
        item.community.title?.toLowerCase().includes(query) ||
        item.community.name?.toLowerCase().includes(query) ||
        item.community.about?.toLowerCase().includes(query) ||
        item.categoryLabel.toLowerCase().includes(query)
      );
    });
  }, [classified, hideSensitive, joinedCommunities, mode, onlySubscribed, query]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    inScope.forEach((item) => {
      if (language !== 'all' && item.language.code !== language) return;
      counts.set(item.categoryTag, (counts.get(item.categoryTag) || 0) + 1);
    });
    return counts;
  }, [inScope, language]);

  const languageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    inScope.forEach((item) => {
      if (category !== 'all' && item.categoryTag !== category) return;
      counts.set(item.language.code, (counts.get(item.language.code) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [category, inScope]);

  const filtered = useMemo(() => {
    return inScope.filter((item) => {
      if (category !== 'all' && item.categoryTag !== category) return false;
      if (language !== 'all' && item.language.code !== language) return false;
      return true;
    });
  }, [category, inScope, language]);

  const topicTotal = [...categoryCounts.values()].reduce((sum, count) => sum + count, 0);
  const languageTotal = languageCounts.reduce((sum, [, count]) => sum + count, 0);

  const joinedCount = Object.values(joinedCommunities).filter(Boolean).length;
  const viewLoading = mode === 'manage'
    ? ownedLoading
    : searchQuery.trim().length >= 2
      ? searchLoading && searchResults === null
      : loading;

  const loadMore = async () => {
    const source = searchResults ?? communities;
    const last = source[source.length - 1]?.name;
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const batch = await listCommunities(sortOrder, 100, false, last, searchQuery.trim().length >= 2 ? searchQuery.trim() : '');
      const merge = (prev: HiveCommunity[]) => {
        const map = new Map(prev.map((community) => [community.name, community]));
        batch.forEach((community) => map.set(community.name, community));
        return [...map.values()];
      };
      if (searchResults) setSearchResults((prev) => merge(prev || []));
      else setCommunities(merge);
      setHasMore(batch.length >= 100);
    } finally {
      setLoadingMore(false);
    }
  };

  const subscribe = async (name: string) => {
    setBusyName(name);
    setActionError(null);
    try {
      const message = await onToggleJoinCommunity(name);
      if (message) {
        setActionError(message);
        return;
      }
      const nowSubscribed = !joinedCommunities[name];
      if (nowSubscribed) {
        const known = catalog.find((community) => community.name === name);
        if (known) {
          setOwned((prev) => prev.some((community) => community.name === name) ? prev : [...prev, known]);
        }
      } else {
        setOwned((prev) => prev.filter((community) => community.name !== name));
      }
    } finally {
      setBusyName(null);
    }
  };
  const choices = categoryChoices().filter((choice) => choice.tag === 'all' || categoryCounts.get(choice.tag));

  return (
    <div id="communities-page" className="animate-in fade-in duration-150">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSwitchMode('explore')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold ${
              mode === 'explore' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700'
            }`}
          >
            Explore
          </button>
          <button
            type="button"
            onClick={() => onSwitchMode('manage')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold ${
              mode === 'manage' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700'
            }`}
          >
            Manage ({joinedCount})
          </button>
        </div>
      </div>

      <header className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-5 mb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50">
            {mode === 'explore' ? <Compass className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
          </div>
          <div>
            <h1 className="text-xl font-bold">
              {mode === 'explore' ? 'Explore communities' : 'Manage communities'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              {mode === 'explore'
                ? 'Hive communities from the chain. Subscribe signs a posting custom_json.'
                : 'Communities this account subscribes to on Hive, not a local list.'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="communities-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, description, or topic"
              className="w-full pl-9 pr-3 py-2 rounded-2xl bg-gray-50 dark:bg-slate-800 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['rank', 'subs', 'new'] as const).map((sort) => (
              <button
                key={sort}
                type="button"
                onClick={() => setSortOrder(sort)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                  sortOrder === sort ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300'
                }`}
              >
                {sort === 'rank' ? 'Rank' : sort === 'subs' ? 'Subscribers' : 'New'}
              </button>
            ))}
            {mode === 'explore' && (
              <button
                type="button"
                onClick={() => setOnlySubscribed((value) => !value)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                  onlySubscribed ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-slate-800'
                }`}
              >
                Subscribed
              </button>
            )}
            <button
              type="button"
              onClick={() => setHideSensitive((value) => !value)}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-slate-800"
            >
              {hideSensitive ? 'Sensitive hidden' : 'Sensitive shown'}
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-4 items-start">
        <aside className="lg:sticky lg:top-20 space-y-4">
          <section className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-3">
            <h2 className="px-2 py-1 text-xs font-bold uppercase tracking-wide text-gray-400">Topic</h2>
            <div className="space-y-0.5 max-h-80 overflow-y-auto">
              {choices.map((choice) => (
                <button
                  key={choice.tag}
                  type="button"
                  onClick={() => setCategory(choice.tag)}
                  className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl text-left text-xs ${
                    category === choice.tag ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold' : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{choice.icon} {choice.label}</span>
                  <span className="text-[10px] text-gray-400">{choice.tag === 'all' ? topicTotal : categoryCounts.get(choice.tag) || 0}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-3">
            <h2 className="px-2 py-1 text-xs font-bold uppercase tracking-wide text-gray-400">Language</h2>
            <div className="space-y-0.5 max-h-72 overflow-y-auto">
              <FilterRow
                active={language === 'all'}
                label="All languages"
                count={languageTotal}
                onClick={() => setLanguage('all')}
              />
              {languageCounts.map(([code, count]) => {
                const info = describeLanguage(code);
                return (
                  <FilterRow
                    key={code}
                    active={language === code}
                    label={`${info.flag} ${info.name}`}
                    count={count}
                    onClick={() => setLanguage(code)}
                  />
                );
              })}
            </div>
          </section>
        </aside>

        <section className="min-w-0">
          {actionError && (
            <p className="mb-3 px-4 py-3 rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-sm">
              {actionError}
            </p>
          )}
          {mode === 'manage' && !account ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center space-y-2">
              <Layers className="w-8 h-8 mx-auto text-gray-300" />
              <p className="text-sm text-gray-600 dark:text-slate-300">Connect Hive Keychain to read your on-chain subscriptions.</p>
            </div>
          ) : viewLoading ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-16 text-center text-sm text-gray-500">
              {mode === 'manage' ? 'Reading subscriptions from Hive...' : 'Loading communities from Hive...'}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center space-y-3">
              <Layers className="w-8 h-8 mx-auto text-gray-300" />
              <p className="text-sm text-gray-500">
                {mode === 'manage' ? 'This account has no community subscriptions yet.' : 'No communities match these filters.'}
              </p>
              {mode === 'manage' && (
                <button type="button" onClick={() => onSwitchMode('explore')} className="text-xs font-bold text-blue-600">
                  Explore communities to subscribe
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filtered.map((item) => (
                  <CommunityCard
                    key={item.community.name}
                    item={item}
                    joined={!!joinedCommunities[item.community.name]}
                    busy={busyName === item.community.name}
                    onToggleJoin={() => subscribe(item.community.name)}
                    onOpen={() => onSelectCommunity(item.community.name)}
                  />
                ))}
              </div>
              {mode === 'explore' && hasMore && (
                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-5 py-2 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-xs font-bold"
                  >
                    {loadingMore ? 'Loading the next 100...' : `Load more communities (${catalog.length} loaded)`}
                  </button>
                </div>
              )}
            </>
          )}
          <p className="mt-4 flex items-center gap-1.5 text-[11px] text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            Subscriptions come from Hive. Topics are inferred from the title and description. Language is the community's own lang field.
          </p>
        </section>
      </div>
    </div>
  );
};

function FilterRow({
  active,
  label,
  count,
  onClick
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl text-left text-xs ${
        active ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold' : 'hover:bg-gray-50 dark:hover:bg-slate-800'
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="text-[10px] text-gray-400">{count}</span>
    </button>
  );
}

function CommunityCard({
  item,
  joined,
  busy,
  onToggleJoin,
  onOpen
}: {
  item: ClassifiedCommunity;
  joined: boolean;
  busy: boolean;
  onToggleJoin: () => void;
  onOpen: () => void;
}) {
  const { community } = item;
  return (
    <article className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={community.avatar_url || getHiveAvatarUrl(community.name, 'small')}
            alt=""
            className="w-11 h-11 rounded-2xl object-cover bg-gray-100"
            onError={(event) => {
              (event.target as HTMLImageElement).src = getHiveAvatarUrl('hive', 'small');
            }}
          />
          <div className="min-w-0">
            <h3 className="font-bold text-sm truncate">{community.title || community.name}</h3>
            <p className="text-[11px] font-mono text-gray-400 truncate">{community.name}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleJoin}
          disabled={busy}
          className={`text-xs px-3 py-1 rounded-full font-bold flex-shrink-0 disabled:opacity-60 ${
            joined ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-blue-600 text-white'
          }`}
        >
          {busy ? 'Signing...' : joined ? 'Subscribed' : 'Subscribe'}
        </button>
      </div>
      <p className="text-xs text-gray-600 dark:text-slate-300 line-clamp-2 min-h-[2rem]">
        {community.about || 'No description yet.'}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800">
          {item.categoryIcon} {item.categoryLabel}
        </span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800">
          {item.language.flag} {item.language.name}
        </span>
        {community.is_nsfw && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">Sensitive</span>
        )}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {(community.subscribers || 0).toLocaleString()} members
        </span>
        <button type="button" onClick={onOpen} className="inline-flex items-center gap-1 font-bold text-blue-600">
          View feed <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </article>
  );
}

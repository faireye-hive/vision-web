import React, { useEffect, useMemo, useState } from 'react';
import {
  Layers,
  Search,
  ShieldCheck,
  X,
  Compass,
  TrendingUp,
  Clock,
  LogIn
} from 'lucide-react';
import { getCommunity, getSubscriptions, HiveCommunity } from '../services/hiveApi';
import {
  categoryChoices,
  classifyCommunity,
  describeLanguage
} from '../utils/communityTaxonomy';
import { CommunityCard } from '../components/communities/CommunityCard';
import { CommunityFilterRow } from '../components/communities/CommunityFilterRow';
import { CommunityCardSkeletons } from '../components/communities/CommunityCardSkeletons';
import { CommunitiesTabNav } from '../components/communities/CommunitiesTabNav';
import { requestLogin } from '../utils/authEvents';

export interface ManageCommunitiesPageProps {
  onClose: () => void;
  onSwitchToExplore: () => void;
  onSwitchToFeed?: () => void;
  onSelectCommunity: (communityName: string) => void;
  joinedCommunities: Record<string, boolean>;
  onToggleJoinCommunity: (communityName: string) => Promise<string | null> | string | null;
  account?: string | null;
}

type SortOrder = 'rank' | 'subs' | 'new';

const SORT_OPTIONS: { id: SortOrder; label: string; icon: React.ReactNode }[] = [
  { id: 'rank', label: 'Default', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { id: 'subs', label: 'Subscribers', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'new', label: 'Newest', icon: <Clock className="w-3.5 h-3.5" /> }
];

const PREFS_KEY = 'nebulosa_manage_communities_prefs';

interface StoredPrefs {
  sortOrder: SortOrder;
  category: string;
  hideSensitive: boolean;
}

const DEFAULT_PREFS: StoredPrefs = { sortOrder: 'subs', category: 'all', hideSensitive: false };

function loadPrefs(): StoredPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    const validSorts: SortOrder[] = ['rank', 'subs', 'new'];
    return {
      sortOrder: validSorts.includes(parsed?.sortOrder) ? parsed.sortOrder : DEFAULT_PREFS.sortOrder,
      category: typeof parsed?.category === 'string' ? parsed.category : DEFAULT_PREFS.category,
      hideSensitive: typeof parsed?.hideSensitive === 'boolean' ? parsed.hideSensitive : DEFAULT_PREFS.hideSensitive
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

// Module-level cache to avoid N+1 redundant fetches
const communityCache = new Map<string, HiveCommunity>();

export const ManageCommunitiesPage: React.FC<ManageCommunitiesPageProps> = ({
  onClose,
  onSwitchToExplore,
  onSwitchToFeed,
  onSelectCommunity,
  joinedCommunities,
  onToggleJoinCommunity,
  account = null
}) => {
  const [initialPrefs] = useState(loadPrefs);

  const [owned, setOwned] = useState<HiveCommunity[]>([]);
  const [ownedLoading, setOwnedLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialPrefs.sortOrder);
  const [category, setCategory] = useState(initialPrefs.category);
  const [language, setLanguage] = useState('all');
  const [hideSensitive, setHideSensitive] = useState(initialPrefs.hideSensitive);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const joinedCount = useMemo(() => Object.values(joinedCommunities).filter(Boolean).length, [joinedCommunities]);

  // Persist preferences
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ sortOrder, category, hideSensitive }));
    } catch {
      // Storage unavailable
    }
  }, [sortOrder, category, hideSensitive]);

  // Fetch subscriptions from Hive
  useEffect(() => {
    if (!account) {
      setOwned([]);
      setOwnedLoading(false);
      return;
    }

    let mounted = true;
    setOwnedLoading(true);
    setLoadError(null);

    getSubscriptions(account, true)
      .then(async (rows) => {
        const detailed: HiveCommunity[] = [];
        for (let index = 0; index < rows.length; index += 6) {
          const chunk = rows.slice(index, index + 6);
          const resolved = await Promise.all(
            chunk.map(async ([name, title]) => {
              const cached = communityCache.get(name);
              if (cached) return cached;
              const full = await getCommunity(name).catch(() => null);
              if (full) communityCache.set(name, full);
              return (
                full || {
                  id: 0,
                  name,
                  title: title || name,
                  about: '',
                  subscribers: 0,
                  num_pending: 0,
                  num_authors: 0,
                  is_nsfw: false
                }
              );
            })
          );
          detailed.push(...resolved);
        }

        if (mounted) {
          setOwned(detailed);
          setOwnedLoading(false);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setLoadError('Could not read your subscriptions from the Hive blockchain.');
        setOwnedLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [account, reloadKey]);

  // Catalog sorting
  const catalog = useMemo(() => {
    const copy = [...owned];
    if (sortOrder === 'subs') {
      copy.sort((a, b) => (b.subscribers || 0) - (a.subscribers || 0));
    } else if (sortOrder === 'new') {
      copy.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    }
    return copy;
  }, [owned, sortOrder]);

  const classified = useMemo(() => catalog.map(classifyCommunity), [catalog]);

  const query = searchQuery.trim().toLowerCase();
  const inScope = useMemo(() => {
    return classified.filter((item) => {
      if (hideSensitive && item.community.is_nsfw) return false;
      if (!query) return true;
      return (
        item.community.title?.toLowerCase().includes(query) ||
        item.community.name?.toLowerCase().includes(query) ||
        item.community.about?.toLowerCase().includes(query) ||
        item.categoryLabel.toLowerCase().includes(query)
      );
    });
  }, [classified, hideSensitive, query]);

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

  const choices = useMemo(
    () =>
      categoryChoices().filter(
        (choice) => choice.tag === 'all' || choice.tag === category || categoryCounts.get(choice.tag)
      ),
    [categoryCounts, category]
  );

  const languageRows = useMemo<Array<[string, number]>>(() => {
    if (language === 'all' || languageCounts.some(([code]) => code === language)) return languageCounts;
    return [...languageCounts, [language, 0]];
  }, [languageCounts, language]);

  const filtered = useMemo(() => {
    return inScope.filter((item) => {
      if (category !== 'all' && item.categoryTag !== category) return false;
      if (language !== 'all' && item.language.code !== language) return false;
      return true;
    });
  }, [category, inScope, language]);

  const topicTotal = [...categoryCounts.values()].reduce((sum, count) => sum + count, 0);
  const languageTotal = languageCounts.reduce((sum, [, count]) => sum + count, 0);

  const subscribe = async (name: string) => {
    const isCurrentlyJoined = Boolean(joinedCommunities[name]);
    if (isCurrentlyJoined) {
      const label = catalog.find((c) => c.name === name)?.title || name;
      if (!window.confirm(`Unsubscribe from ${label}? This signs a custom_json transaction on Hive.`)) return;
    }
    setBusyName(name);
    setActionError(null);
    try {
      const message = await onToggleJoinCommunity(name);
      if (message) {
        setActionError(message);
        return;
      }
      // Update local state if successful
      if (isCurrentlyJoined) {
        setOwned((prev) => prev.filter((c) => c.name !== name));
      } else {
        const item = catalog.find((c) => c.name === name);
        if (item) {
          setOwned((prev) => (prev.some((c) => c.name === name) ? prev : [...prev, item]));
        }
      }
    } finally {
      setBusyName(null);
    }
  };

  const retry = () => {
    setLoadError(null);
    setReloadKey((k) => k + 1);
  };

  return (
    <div id="manage-communities-page" className="animate-in fade-in duration-150">
      {/* Top Switcher Navigation */}
      <CommunitiesTabNav
        currentTab="manage"
        onSelectTab={(tab) => {
          if (tab === 'feed') {
            if (onSwitchToFeed) onSwitchToFeed();
            else onClose();
          } else if (tab === 'explore') {
            onSwitchToExplore();
          }
        }}
        joinedCount={joinedCount}
        onBack={onSwitchToFeed || onClose}
        showBack={true}
      />

      {/* Hero Header & Search Bar */}
      <header className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-5 mb-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  Manage Subscriptions
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                  {owned.length} Joined
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1">
                {account
                  ? `Communities @${account} subscribes to on the Hive blockchain.`
                  : 'Connect your Hive account to view your subscriptions.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={onSwitchToExplore}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Explore All Communities</span>
            </button>
          </div>
        </div>

        {/* Search & Sort Controls (only if account has items or is logged in) */}
        {account && (
          <div className="mt-4 flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="manage-communities-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your subscribed communities..."
                aria-label="Search subscribed communities"
                className="w-full pl-9 pr-9 py-2.5 rounded-2xl bg-gray-50 dark:bg-slate-800/80 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 border border-transparent focus:border-emerald-500/40 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSortOrder(opt.id)}
                  aria-pressed={sortOrder === opt.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                    sortOrder === opt.id
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-xs'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => setHideSensitive((v) => !v)}
                aria-pressed={hideSensitive}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  hideSensitive
                    ? 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50'
                }`}
              >
                {hideSensitive ? 'Sensitive hidden' : 'Sensitive shown'}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Body */}
      {!account ? (
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-3xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <LogIn className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Log in to manage your communities
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 max-w-md mx-auto">
            Sign in with Hive Keychain or Hiveauth to view, organize, and manage your on-chain community subscriptions.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={requestLogin}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Connect Hive Account</span>
            </button>
            <button
              type="button"
              onClick={onSwitchToExplore}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>Explore Communities</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-4 items-start">
          {/* Desktop Taxonomy Sidebar */}
          {owned.length > 0 && (
            <aside className="hidden lg:block lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto space-y-4">
              <section className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-3 shadow-xs">
                <h2 className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                  Topic
                </h2>
                <div className="space-y-0.5 max-h-80 overflow-y-auto mt-1">
                  {choices.map((choice) => (
                    <CommunityFilterRow
                      key={choice.tag}
                      active={category === choice.tag}
                      label={`${choice.icon} ${choice.label}`}
                      count={choice.tag === 'all' ? topicTotal : categoryCounts.get(choice.tag) || 0}
                      onClick={() => setCategory(choice.tag)}
                    />
                  ))}
                </div>
              </section>

              {languageRows.length > 1 && (
                <section className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-3 shadow-xs">
                  <h2 className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                    Language
                  </h2>
                  <div className="space-y-0.5 max-h-72 overflow-y-auto mt-1">
                    <CommunityFilterRow
                      active={language === 'all'}
                      label="All languages"
                      count={languageTotal}
                      onClick={() => setLanguage('all')}
                    />
                    {languageRows.map(([code, count]) => {
                      const info = describeLanguage(code);
                      return (
                        <CommunityFilterRow
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
              )}
            </aside>
          )}

          {/* Communities Results Section */}
          <section className={`min-w-0 ${owned.length === 0 ? 'lg:col-span-2' : ''}`}>
            {/* Mobile Filter Chips */}
            {owned.length > 0 && (
              <div className="lg:hidden space-y-2 mb-3">
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="group" aria-label="Topic filter">
                  {choices.map((choice) => (
                    <button
                      key={choice.tag}
                      type="button"
                      onClick={() => setCategory(choice.tag)}
                      aria-pressed={category === choice.tag}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                        category === choice.tag
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300'
                      }`}
                    >
                      {choice.icon} {choice.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Error alerts */}
            {actionError && (
              <p role="alert" className="mb-3 px-4 py-3 rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-sm">
                {actionError}
              </p>
            )}

            {loadError && (
              <div role="alert" className="mb-3 px-4 py-3 rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-sm flex items-center justify-between gap-3">
                <span>{loadError}</span>
                <button type="button" onClick={retry} className="text-xs font-bold underline flex-shrink-0 cursor-pointer">
                  Try again
                </button>
              </div>
            )}

            {/* State views: Loading, Empty, or Cards */}
            {ownedLoading ? (
              <div aria-busy="true" aria-label="Reading subscriptions from Hive">
                <CommunityCardSkeletons count={4} />
              </div>
            ) : filtered.length === 0 ? (
              !loadError && (
                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-xs">
                  <Layers className="w-10 h-10 mx-auto text-gray-300 dark:text-slate-600" />
                  <h3 className="font-bold text-gray-800 dark:text-slate-200 text-base">
                    {owned.length === 0
                      ? 'No community subscriptions yet'
                      : 'No subscriptions match your search'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 max-w-md mx-auto">
                    {owned.length === 0
                      ? `Your account @${account} is not subscribed to any Hive communities yet. Explore topics and join groups to curate your feed.`
                      : 'Try clearing your search query or topic filter to see all your subscribed communities.'}
                  </p>
                  <div>
                    {owned.length === 0 ? (
                      <button
                        type="button"
                        onClick={onSwitchToExplore}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
                      >
                        <Compass className="w-4 h-4" />
                        <span>Explore communities to subscribe</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setCategory('all');
                          setLanguage('all');
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 transition cursor-pointer"
                      >
                        Show all {owned.length} subscriptions
                      </button>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filtered.map((item) => (
                  <CommunityCard
                    key={item.community.name}
                    item={item}
                    joined={Boolean(joinedCommunities[item.community.name])}
                    busy={busyName === item.community.name}
                    onToggleJoin={() => subscribe(item.community.name)}
                    onOpen={() => onSelectCommunity(item.community.name)}
                    onPickCategory={() => setCategory(item.categoryTag)}
                  />
                ))}
              </div>
            )}

            <p className="mt-5 flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                Subscriptions are read live from Hive blockchain custom_json records. Unsubscribing broadcasts a signed transaction.
              </span>
            </p>
          </section>
        </div>
      )}
    </div>
  );
};

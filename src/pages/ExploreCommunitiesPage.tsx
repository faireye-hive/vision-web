import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  Search,
  ShieldCheck,
  X,
  Layers,
  Sparkles,
  TrendingUp,
  Clock
} from 'lucide-react';
import { HiveCommunity, listCommunities } from '../services/hiveApi';
import { loadCommunityCatalog } from '../services/communityCatalog';
import {
  categoryChoices,
  classifyCommunity,
  describeLanguage
} from '../utils/communityTaxonomy';
import { CommunityCard } from '../components/communities/CommunityCard';
import { CommunityFilterRow } from '../components/communities/CommunityFilterRow';
import { CommunityCardSkeletons } from '../components/communities/CommunityCardSkeletons';
import { CommunitiesTabNav } from '../components/communities/CommunitiesTabNav';

export interface ExploreCommunitiesPageProps {
  embedded?: boolean;
  onClose: () => void;
  onSwitchToManage: () => void;
  onSwitchToFeed?: () => void;
  onSelectCommunity: (communityName: string) => void;
  joinedCommunities: Record<string, boolean>;
  onToggleJoinCommunity: (communityName: string) => Promise<string | null> | string | null;
  account?: string | null;
}

type SortOrder = 'rank' | 'subs' | 'new';

const PAGE_SIZE = 100;
const DISPLAY_PAGE_SIZE = 40;
const SORT_OPTIONS: { id: SortOrder; label: string; icon: React.ReactNode }[] = [
  { id: 'rank', label: 'Rank', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { id: 'subs', label: 'Subscribers', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'new', label: 'Newest', icon: <Clock className="w-3.5 h-3.5" /> }
];

const PREFS_KEY = 'nebulosa_explore_communities_prefs';

interface StoredPrefs {
  sortOrder: SortOrder;
  category: string;
  hideSensitive: boolean;
}

const DEFAULT_PREFS: StoredPrefs = { sortOrder: 'rank', category: 'all', hideSensitive: true };

function sortCatalog(communities: HiveCommunity[], order: SortOrder): HiveCommunity[] {
  if (order === 'rank') return communities;
  return [...communities].sort((a, b) => {
    if (order === 'subs') return (b.subscribers || 0) - (a.subscribers || 0);
    return Date.parse(b.created_at || '') - Date.parse(a.created_at || '');
  });
}

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

export const ExploreCommunitiesPage: React.FC<ExploreCommunitiesPageProps> = ({
  embedded = false,
  onClose,
  onSwitchToManage,
  onSwitchToFeed,
  onSelectCommunity,
  joinedCommunities,
  onToggleJoinCommunity,
  account = null
}) => {
  const [initialPrefs] = useState(loadPrefs);

  const [communities, setCommunities] = useState<HiveCommunity[]>([]);
  const [searchResults, setSearchResults] = useState<HiveCommunity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreList, setHasMoreList] = useState(true);
  const [hasMoreSearch, setHasMoreSearch] = useState(false);
  const [visibleCount, setVisibleCount] = useState(DISPLAY_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialPrefs.sortOrder);
  const [category, setCategory] = useState(initialPrefs.category);
  const [language, setLanguage] = useState('all');
  const [onlySubscribed, setOnlySubscribed] = useState(false);
  const [hideSensitive, setHideSensitive] = useState(initialPrefs.hideSensitive);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const forceLiveReload = useRef(false);

  const isSearching = searchQuery.trim().length >= 2;
  const hasMore = isSearching ? hasMoreSearch : hasMoreList;
  const joinedCount = useMemo(() => Object.values(joinedCommunities).filter(Boolean).length, [joinedCommunities]);

  // Save display preferences
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ sortOrder, category, hideSensitive }));
    } catch {
      // Storage unavailable
    }
  }, [sortOrder, category, hideSensitive]);

  // Sort the shared snapshot locally. Live queries are explicit user actions.
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError(null);
    setSearchResults(null);
    setHasMoreSearch(false);
    setVisibleCount(DISPLAY_PAGE_SIZE);
    const useLiveRefresh = forceLiveReload.current;
    forceLiveReload.current = false;

    const load = !useLiveRefresh
      ? loadCommunityCatalog().then((listed) => sortCatalog(listed, sortOrder))
      : listCommunities(sortOrder, PAGE_SIZE, true);

    load
      .then((listed) => {
        if (!mounted) return;
        setCommunities(listed || []);
        setHasMoreList(useLiveRefresh ? (listed || []).length >= PAGE_SIZE : true);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLoadError('Could not load communities from Hive network.');
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [sortOrder, reloadKey]);

  // Search the local catalog first; searching Hive is an explicit action below.
  useEffect(() => {
    setSearchResults(null);
    setHasMoreSearch(false);
    setSearchLoading(false);
    setVisibleCount(DISPLAY_PAGE_SIZE);
  }, [searchQuery, sortOrder]);

  const catalog = useMemo(() => {
    if (!searchResults?.length) return communities;
    const merged = new Map(communities.map((community) => [community.name, community]));
    searchResults.forEach((community) => merged.set(community.name, community));
    return [...merged.values()];
  }, [communities, searchResults]);

  const classified = useMemo(() => catalog.map(classifyCommunity), [catalog]);

  const query = searchQuery.trim().toLowerCase();
  const inScope = useMemo(() => {
    return classified.filter((item) => {
      if (hideSensitive && item.community.is_nsfw) return false;
      if (onlySubscribed && !joinedCommunities[item.community.name]) return false;
      if (!query) return true;
      return (
        item.community.title?.toLowerCase().includes(query) ||
        item.community.name?.toLowerCase().includes(query) ||
        item.community.about?.toLowerCase().includes(query) ||
        item.categoryLabel.toLowerCase().includes(query)
      );
    });
  }, [classified, hideSensitive, joinedCommunities, onlySubscribed, query]);

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

  const viewLoading = loading;
  const showSearchingHint = isSearching && searchLoading;

  const searchHive = async () => {
    if (searchLoading) return;
    setSearchLoading(true);
    setActionError(null);
    try {
      const listed = await listCommunities(sortOrder, PAGE_SIZE, true, '', searchQuery.trim());
      setSearchResults(listed);
      setHasMoreSearch(listed.length >= PAGE_SIZE);
      setVisibleCount(DISPLAY_PAGE_SIZE);
    } catch {
      setActionError('Could not search communities on Hive. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore) return;
    if (isSearching && searchResults === null) return;
    const source = isSearching ? (searchResults || []) : communities;
    const last = source[source.length - 1]?.name;
    if (!last) return;
    setLoadingMore(true);
    try {
      const batch = await listCommunities(sortOrder, PAGE_SIZE, false, last, isSearching ? searchQuery.trim() : '');
      const merge = (prev: HiveCommunity[]) => {
        const map = new Map(prev.map((c) => [c.name, c]));
        batch.forEach((c) => map.set(c.name, c));
        return [...map.values()];
      };
      const more = batch.length >= PAGE_SIZE;
      if (isSearching) {
        setSearchResults((prev) => merge(prev || []));
        setHasMoreSearch(more);
      } else {
        setCommunities(merge);
        setHasMoreList(more);
      }
    } catch {
      setActionError('Could not load more communities. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setVisibleCount(DISPLAY_PAGE_SIZE);
  }, [category, language, onlySubscribed, hideSensitive]);

  const subscribe = async (name: string) => {
    if (joinedCommunities[name]) {
      const label = catalog.find((c) => c.name === name)?.title || name;
      if (!window.confirm(`Unsubscribe from ${label}? This signs a custom_json transaction on Hive.`)) return;
    }
    setBusyName(name);
    setActionError(null);
    try {
      const message = await onToggleJoinCommunity(name);
      if (message) {
        setActionError(message);
      }
    } finally {
      setBusyName(null);
    }
  };

  const retry = () => {
    setLoadError(null);
    forceLiveReload.current = true;
    setReloadKey((key) => key + 1);
  };

  return (
    <div id="explore-communities-page" className="animate-in fade-in duration-150">
      {/* Top Switcher Navigation */}
      <CommunitiesTabNav
        currentTab="explore"
        onSelectTab={(tab) => {
          if (tab === 'feed') {
            if (onSwitchToFeed) onSwitchToFeed();
            else onClose();
          } else if (tab === 'manage') {
            onSwitchToManage();
          }
        }}
        joinedCount={joinedCount}
        onBack={onSwitchToFeed || onClose}
        showBack={true}
        mobileOnly={embedded}
      />

      {/* Hero Header & Search Bar */}
      <header className={`bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl ${embedded ? 'p-4 mb-3' : 'p-5 mb-4'} shadow-xs`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Explore Communities
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1">
                Discover decentralized hubs and interest groups on Hive blockchain.
              </p>
            </div>
          </div>

          {!embedded && <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={onSwitchToManage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 transition"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Manage Subscriptions ({joinedCount})</span>
            </button>
          </div>}
        </div>

        {/* Search & Sort Controls */}
        <div className="mt-4 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="explore-communities-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search the loaded community catalog..."
              aria-label="Search communities"
              className="w-full pl-9 pr-9 py-2.5 rounded-2xl bg-gray-50 dark:bg-slate-800/80 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 border border-transparent focus:border-blue-500/40 transition"
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

          {/* Sort & Quick Filter Chips */}
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
              onClick={() => setOnlySubscribed((v) => !v)}
              aria-pressed={onlySubscribed}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                onlySubscribed
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              Subscribed
            </button>

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
      </header>

      {/* Two-Column Responsive Layout (Taxonomy Sidebar + Communities Grid) */}
      <div className={`${embedded ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-4'} items-start`}>
        {/* Desktop Sidebar Filters */}
        <aside className={`${embedded ? 'hidden' : 'hidden lg:block lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto space-y-4'}`}>
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
        </aside>

        {/* Communities Results Section */}
        <section className="min-w-0">
          {embedded && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="mr-auto min-w-[120px] px-1">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Browse topics</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{catalog.length.toLocaleString()} cached communities</p>
              </div>
              <label className="sr-only" htmlFor="explore-category-select">Filter by topic</label>
              <select
                id="explore-category-select"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="min-w-[150px] max-w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {choices.map((choice) => (
                  <option key={choice.tag} value={choice.tag}>
                    {choice.icon} {choice.label} ({choice.tag === 'all' ? topicTotal : categoryCounts.get(choice.tag) || 0})
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="explore-language-select">Filter by language</label>
              <select
                id="explore-language-select"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="min-w-[145px] max-w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="all">All languages ({languageTotal})</option>
                {languageRows.filter(([code]) => code !== 'all').map(([code, count]) => {
                  const info = describeLanguage(code);
                  return <option key={code} value={code}>{info.flag} {info.name} ({count})</option>;
                })}
              </select>
            </div>
          )}

          {/* Mobile Horizontal Filter Chips */}
          {!embedded && <div className="lg:hidden space-y-2 mb-3">
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="group" aria-label="Topic filter">
              {choices.map((choice) => (
                <button
                  key={choice.tag}
                  type="button"
                  onClick={() => setCategory(choice.tag)}
                  aria-pressed={category === choice.tag}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                    category === choice.tag
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300'
                  }`}
                >
                  {choice.icon} {choice.label}
                </button>
              ))}
            </div>

            {languageRows.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="group" aria-label="Language filter">
                <button
                  type="button"
                  onClick={() => setLanguage('all')}
                  aria-pressed={language === 'all'}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                    language === 'all'
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300'
                  }`}
                >
                  All languages
                </button>
                {languageRows.map(([code]) => {
                  const info = describeLanguage(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLanguage(code)}
                      aria-pressed={language === code}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                        language === code
                          ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                          : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300'
                      }`}
                    >
                      {info.flag} {info.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>}

          {/* Feedback messages */}
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

          {showSearchingHint && (
            <p className="mb-3 text-xs text-gray-400" aria-live="polite">
              Searching communities on Hive...
            </p>
          )}

          {/* State views: Loading, Empty, or Grid */}
          {viewLoading ? (
            <div aria-busy="true" aria-label="Loading communities from Hive">
              <CommunityCardSkeletons count={6} />
            </div>
          ) : filtered.length === 0 ? (
            !loadError && (
              <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-8 sm:p-12 text-center space-y-3 shadow-xs">
                <Compass className="w-10 h-10 mx-auto text-gray-300 dark:text-slate-600" />
                <h3 className="font-bold text-gray-800 dark:text-slate-200 text-base">
                  No communities found
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 max-w-md mx-auto">
                  {loadingMore
                    ? 'Searching through more communities...'
                    : 'No Hive communities match your search or active filter combination.'}
                </p>
                {(category !== 'all' || language !== 'all' || searchQuery || onlySubscribed) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCategory('all');
                      setLanguage('all');
                      setSearchQuery('');
                      setOnlySubscribed(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition cursor-pointer"
                  >
                    Clear all filters
                  </button>
                )}
                {isSearching && !searchResults && (
                  <button
                    type="button"
                    onClick={searchHive}
                    disabled={searchLoading}
                    className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  >
                    {searchLoading ? 'Searching Hive…' : 'Search all Hive communities'}
                  </button>
                )}
              </div>
            )
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filtered.slice(0, visibleCount).map((item) => (
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

              {isSearching && !searchResults && (
                <div className="mt-5 text-center">
                  <button
                    type="button"
                    onClick={searchHive}
                    disabled={searchLoading}
                    className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {searchLoading ? 'Searching Hive…' : 'Search Hive for more matches'}
                  </button>
                </div>
              )}

              {filtered.length > visibleCount && (
                <div className="text-center mt-5">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((count) => count + DISPLAY_PAGE_SIZE)}
                    className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Show {Math.min(DISPLAY_PAGE_SIZE, filtered.length - visibleCount)} more from this catalog
                  </button>
                </div>
              )}

              {hasMore && filtered.length <= visibleCount && (!isSearching || Boolean(searchResults)) && (
                <div className="text-center mt-6">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-6 py-2.5 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition disabled:opacity-60 shadow-xs cursor-pointer"
                  >
                    {loadingMore
                      ? `Loading next ${PAGE_SIZE}...`
                      : isSearching ? 'Load more search results from Hive' : `Load next ${PAGE_SIZE} communities from Hive`}
                  </button>
                </div>
              )}
            </>
          )}

          <p className="mt-5 flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              The first 1,000 ranked communities are bundled locally. More communities and remote search results load from Hive when requested. Subscribing signs a Posting operation.
              {catalog.length > 0 && ` Currently showing from ${catalog.length} communities loaded.`}
            </span>
          </p>
        </section>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, User, Users, Hash, ArrowRight, Clock, X, Loader2, Sparkles } from 'lucide-react';
import { lookupCreatorsWithPreview, CreatorPreview, listCommunities, HiveCommunity } from '../services/hiveApi';
import { CATEGORY_DEFINITIONS } from '../data/categorySubtopics';

interface SearchPreviewPopoverProps {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectCreator: (username: string) => void;
  onSelectCommunity: (communityName: string) => void;
  onSelectTag: (tag: string) => void;
  onSubmitFullSearch: (query: string) => void;
  isMobile?: boolean;
}

const RECENT_SEARCHES_KEY = 'hive_recent_searches_v1';
const MAX_RECENTS = 5;

export const SearchPreviewPopover: React.FC<SearchPreviewPopoverProps> = ({
  query,
  isOpen,
  onClose,
  onSelectCreator,
  onSelectCommunity,
  onSelectTag,
  onSubmitFullSearch,
  isMobile = false,
}) => {
  const [creators, setCreators] = useState<CreatorPreview[]>([]);
  const [communities, setCommunities] = useState<HiveCommunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveRecentSearch = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const next = [trimmed, ...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENTS);
      setRecentSearches(next);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const clearRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // ignore
    }
  };

  // Find matching tags from category subtopics registry
  const matchedTags = useMemo(() => {
    const clean = query.trim().toLowerCase().replace(/^#/, '');
    if (!clean) return [];

    const matches: Array<{ tag: string; label: string; categoryName: string }> = [];
    const seen = new Set<string>();

    for (const cat of CATEGORY_DEFINITIONS) {
      if (cat.tag.toLowerCase().includes(clean)) {
        if (!seen.has(cat.tag)) {
          matches.push({ tag: cat.tag, label: cat.label, categoryName: cat.label });
          seen.add(cat.tag);
        }
      }
      for (const sub of cat.subtopics) {
        if (sub.tag.toLowerCase().includes(clean) || sub.label.toLowerCase().includes(clean)) {
          if (!seen.has(sub.tag)) {
            matches.push({ tag: sub.tag, label: sub.label, categoryName: cat.label });
            seen.add(sub.tag);
          }
        }
      }
      if (matches.length >= 4) break;
    }

    return matches.slice(0, 4);
  }, [query]);

  // Debounced live fetch for creators and communities
  useEffect(() => {
    const clean = query.trim().toLowerCase().replace(/^@/, '');
    if (!isOpen || clean.length < 2) {
      setCreators([]);
      setCommunities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let isCurrent = true;

    const timer = setTimeout(async () => {
      try {
        const [creatorsRes, communitiesRes] = await Promise.all([
          lookupCreatorsWithPreview(clean, 4).catch(() => []),
          listCommunities('rank', 4, false, '', clean).catch(() => [])
        ]);

        if (isCurrent) {
          setCreators(creatorsRes);
          setCommunities(communitiesRes);
          setLoading(false);
        }
      } catch {
        if (isCurrent) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [query, isOpen]);

  if (!isOpen) return null;

  const cleanQuery = query.trim();
  const hasResults = creators.length > 0 || communities.length > 0 || matchedTags.length > 0;

  return (
    <div
      id="search-preview-popover"
      ref={popoverRef}
      role="dialog"
      aria-label="Live search preview"
      onPointerDown={(e) => e.stopPropagation()}
      className={`${
        isMobile
          ? 'w-full mt-2 rounded-2xl'
          : 'absolute right-0 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-24px)] rounded-2xl'
      } bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-[120] max-h-[min(70vh,560px)] overflow-y-auto overscroll-contain text-xs animate-in fade-in zoom-in-95 duration-100 text-gray-800 dark:text-slate-200 select-none`}
    >
      {/* Quick Search Action when query is present */}
      {cleanQuery && (
        <button
          type="button"
          onClick={() => {
            saveRecentSearch(cleanQuery);
            onSubmitFullSearch(cleanQuery);
            onClose();
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50/80 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 transition cursor-pointer mb-2 font-medium"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">
              Search posts for <strong className="font-bold">"{cleanQuery}"</strong>
            </span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 ml-1.5 opacity-70" />
        </button>
      )}

      {/* Loading state indicator */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-3 text-gray-400 dark:text-slate-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
          <span className="text-[11px]">Searching Hive accounts & communities...</span>
        </div>
      )}

      {/* Recent Searches (when query is empty) */}
      {!cleanQuery && recentSearches.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Recent Searches
            </span>
            <button
              type="button"
              onClick={clearRecentSearches}
              className="text-rose-500 hover:text-rose-600 dark:text-rose-400 font-semibold cursor-pointer"
            >
              Clear
            </button>
          </div>
          <div className="space-y-0.5">
            {recentSearches.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  onSubmitFullSearch(item);
                  onClose();
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-gray-100/80 dark:hover:bg-slate-800 transition cursor-pointer text-left text-gray-700 dark:text-slate-300"
              >
                <span className="truncate">{item}</span>
                <ArrowRight className="w-3 h-3 text-gray-300 dark:text-slate-600 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Creators / Accounts Section */}
      {creators.length > 0 && (
        <div className="mb-2">
          <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-3 h-3 text-blue-500" />
            Creators
          </div>
          <div className="space-y-1">
            {creators.map((creator) => (
              <button
                key={creator.name}
                type="button"
                onClick={() => {
                  saveRecentSearch(`@${creator.name}`);
                  onSelectCreator(creator.name);
                  onClose();
                }}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-gray-100/80 dark:hover:bg-slate-800 transition cursor-pointer text-left group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={creator.avatarUrl}
                    alt={creator.name}
                    className="w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-700 object-cover flex-shrink-0 border border-gray-100 dark:border-slate-700"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://images.hive.blog/u/${creator.name}/avatar/small`;
                    }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-900 dark:text-white truncate">
                        @{creator.name}
                      </span>
                      {typeof creator.reputation === 'number' && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded-md font-mono">
                          {creator.reputation}
                        </span>
                      )}
                    </div>
                    {creator.about && (
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate">
                        {creator.about}
                      </p>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors flex-shrink-0 ml-2" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Communities Section */}
      {communities.length > 0 && (
        <div className="mb-2">
          <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3 h-3 text-emerald-500" />
            Communities
          </div>
          <div className="space-y-1">
            {communities.map((comm) => (
              <button
                key={comm.name}
                type="button"
                onClick={() => {
                  saveRecentSearch(comm.title || comm.name);
                  onSelectCommunity(comm.name);
                  onClose();
                }}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-gray-100/80 dark:hover:bg-slate-800 transition cursor-pointer text-left group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center flex-shrink-0 text-xs">
                    👥
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-gray-900 dark:text-white truncate block">
                      {comm.title}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                      {comm.subscribers ? `${comm.subscribers.toLocaleString()} subscribers` : comm.name}
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 group-hover:text-emerald-500 transition-colors flex-shrink-0 ml-2" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tags & Topics Section */}
      {matchedTags.length > 0 && (
        <div className="mb-1">
          <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Hash className="w-3 h-3 text-purple-500" />
            Topic Tags
          </div>
          <div className="flex flex-wrap gap-1 p-1">
            {matchedTags.map((t) => (
              <button
                key={t.tag}
                type="button"
                onClick={() => {
                  saveRecentSearch(`#${t.tag}`);
                  onSelectTag(t.tag);
                  onClose();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100/80 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/60 hover:text-purple-600 dark:hover:text-purple-400 transition text-[11px] font-semibold text-gray-700 dark:text-slate-300 cursor-pointer"
              >
                <span>#{t.tag}</span>
                <span className="text-[9px] text-gray-400 dark:text-slate-500 font-normal">
                  ({t.label})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty result note when typed but nothing matched */}
      {cleanQuery && !loading && !hasResults && (
        <div className="py-4 text-center text-gray-400 dark:text-slate-500">
          <p className="text-xs">No direct account or community matches found.</p>
          <p className="text-[10px] mt-0.5">Press Enter to search all posts containing "{cleanQuery}".</p>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import {
  Hash,
  Search,
  Star,
  Compass,
  TrendingUp,
  X,
  Sparkles
} from 'lucide-react';
import { HivePost, getTrendingTags } from '../services/hiveApi';
import {
  getNoiseTagsForContext,
  normalizeTag,
  addCustomNoiseTag,
  removeNoiseTag,
  resetContextNoise
} from '../data/topicNoiseConfig';
import {
  VolumeX,
  Volume2,
  RotateCcw,
  Info,
  EyeOff
} from 'lucide-react';

interface TrendingTopicsCardProps {
  currentTag: string;
  onSelectTag: (tag: string) => void;
  feedPosts?: HivePost[];
  currentSort?: string;
}

const DEFAULT_FALLBACK_TAGS = ['hive', 'technology', 'crypto', 'art', 'gaming', 'photography'];

export const TrendingTopicsCard: React.FC<TrendingTopicsCardProps> = ({
  currentTag,
  onSelectTag,
  feedPosts = [],
  currentSort = 'hot'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showMuted, setShowMuted] = useState(false);
  const [blockchainTags, setBlockchainTags] = useState<string[]>([]);
  const [loadingChainTags, setLoadingChainTags] = useState<boolean>(false);
  const [favTopics, setFavTopics] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nebulosa_fav_topics');
      return saved ? JSON.parse(saved) : ['photography', 'crypto', 'technology'];
    } catch {
      return ['photography', 'crypto', 'technology'];
    }
  });

  // Calculate current noise tags for this context
  const contextNoiseList = useMemo(() => {
    return getNoiseTagsForContext(currentTag);
  }, [currentTag]);

  const noiseSet = useMemo(() => {
    return new Set(contextNoiseList.map(normalizeTag));
  }, [contextNoiseList]);

  // Fetch global trending tags from Hive blockchain when no tag is selected
  useEffect(() => {
    let isMounted = true;
    if (!currentTag) {
      setLoadingChainTags(true);
      getTrendingTags(250)
        .then((tags) => {
          if (!isMounted) return;

          const cleanTags = (tags || [])
            .map((t) => ((t.tag || t.name) || '').toLowerCase().trim())
            .filter((t) => t.length >= 2 && !t.startsWith('hive-') && !noiseSet.has(t));

          setBlockchainTags(
            cleanTags.length > 0
              ? cleanTags
              : DEFAULT_FALLBACK_TAGS
          );
        })
        .catch((err) => {
          console.error("Erro ao carregar tags:", err);
          if (isMounted) {
            setBlockchainTags(DEFAULT_FALLBACK_TAGS);
          }
        })
        .finally(() => {
          if (isMounted) setLoadingChainTags(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [currentTag, noiseSet]);

  const toggleFavTopic = (topic: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavTopics((prev) => {
      const updated = prev.includes(topic)
        ? prev.filter((t) => t !== topic)
        : [...prev, topic];
      try {
        localStorage.setItem('nebulosa_fav_topics', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleMuteTopic = (topic: string, e: React.MouseEvent) => {
    e.stopPropagation();
    addCustomNoiseTag(currentTag, topic);
    // Refresh lists by triggering useMemo updates (noiseSet will change)
    // We force a state update if needed, but noiseSet depends on currentTag and noise mapping
    // so we might need a small state to force re-render since localStorage changes aren't reactive
    setBlockchainTags([...blockchainTags]); 
  };

  const handleUnmuteTopic = (topic: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeNoiseTag(currentTag, topic);
    setBlockchainTags([...blockchainTags]);
  };

  const handleResetNoise = () => {
    if (window.confirm("Restore all default tags for this context? This will clear your manual muted list for #" + (currentTag || 'global') + ".")) {
      resetContextNoise(currentTag);
      setBlockchainTags([...blockchainTags]);
    }
  };

  // Determine ranked topics:
  // 1. If NO tag is selected: show blockchain trending tags
  // 2. If a tag IS selected: extract local contextual tags from loaded feed posts
  const { rankedTopics, mutedTopics } = useMemo(() => {
    let pool: string[] = [];

    if (!currentTag) {
      pool = blockchainTags.length > 0 ? blockchainTags : DEFAULT_FALLBACK_TAGS;
    } else {
      const localCounts: Record<string, number> = {};
      feedPosts.forEach((p) => {
        const postTagsSet = new Set<string>();
        if (p.category && !p.category.startsWith('hive-')) {
          postTagsSet.add(p.category.toLowerCase().trim());
        }
        let metadataTags: string[] = [];
        if (typeof p.json_metadata === 'object' && p.json_metadata && Array.isArray((p.json_metadata as any).tags)) {
          metadataTags = (p.json_metadata as any).tags;
        } else if (typeof p.json_metadata === 'string') {
          try {
            const parsed = JSON.parse(p.json_metadata);
            if (parsed && Array.isArray(parsed.tags)) metadataTags = parsed.tags;
          } catch {}
        }
        metadataTags.forEach((t) => {
          if (typeof t === 'string') {
            const clean = t.toLowerCase().trim();
            if (clean && !clean.startsWith('hive-') && clean.length >= 2 && clean.length < 24) {
              postTagsSet.add(clean);
            }
          }
        });
        postTagsSet.forEach((t) => {
          localCounts[t] = (localCounts[t] || 0) + 1;
        });
      });

      const extractedKeys = Object.keys(localCounts);
      if (extractedKeys.length > 0) {
        pool = extractedKeys.sort((a, b) => (localCounts[b] || 0) - (localCounts[a] || 0));
      } else {
        pool = blockchainTags.length > 0 ? blockchainTags : DEFAULT_FALLBACK_TAGS;
      }
    }

    // Separate active and muted
    const active: string[] = [];
    const muted: string[] = [];

    pool.forEach(topic => {
      const clean = topic.toLowerCase().trim();
      if (noiseSet.has(clean)) {
        muted.push(topic);
      } else {
        active.push(topic);
      }
    });

    const filterBySearch = (list: string[]) => {
      if (!searchQuery.trim()) return list;
      const q = searchQuery.toLowerCase().trim();
      return list.filter(t => t.toLowerCase().includes(q));
    };

    const sortByFav = (list: string[]) => {
      return [...list].sort((a, b) => {
        const aFav = favTopics.includes(a);
        const bFav = favTopics.includes(b);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return 0;
      });
    };

    return {
      rankedTopics: sortByFav(filterBySearch(active)),
      mutedTopics: filterBySearch(muted)
    };
  }, [currentTag, blockchainTags, feedPosts, favTopics, searchQuery, noiseSet]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[15px] p-2.5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/60 dark:border-slate-800 space-y-3.5" style={{ marginTop: '0px' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">Trending Topics</h3>
              <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.2 rounded-full border border-blue-200/50 dark:border-blue-800/50">
                {!currentTag ? 'Hive' : 'Contextual'}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">
              {!currentTag
                ? 'Popular on Hive network'
                : `Contextual to #${currentTag}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setShowMuted(!showMuted)}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              showMuted 
                ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' 
                : 'bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:text-rose-500'
            }`}
            title={showMuted ? "Show trending tags" : "Manage noise/muted tags"}
          >
            <VolumeX className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-medium text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {showMuted ? mutedTopics.length : rankedTopics.length}
          </span>
        </div>
      </div>


      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={!currentTag ? 'Search blockchain topics...' : `Search in #${currentTag}...`}
          className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* "All Topics" quick button */}
      <button
        onClick={() => onSelectTag('')}
        title="Show all topics without tag filter"
        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer ${
          !currentTag
            ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold'
            : 'hover:bg-gray-50 dark:hover:bg-slate-800/60 text-gray-700 dark:text-slate-300'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-lg ${!currentTag ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
            <Compass className="w-3 h-3" />
          </div>
          <span>All Topics</span>
        </div>
        {!currentTag && (
          <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">
            active
          </span>
        )}
      </button>

      {/* Topics list */}
      <div className="max-h-[380px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
        {showMuted && (
          <div className="mb-3 p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100/50 dark:border-rose-900/30 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                <VolumeX className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Noise List for #{currentTag || 'global'}</span>
              </div>
              <button 
                onClick={handleResetNoise}
                className="p-1 text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-200 transition cursor-pointer"
                title="Restore default tags"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[10px] text-rose-600/70 dark:text-rose-400/60 leading-tight mb-1">
              Tags listed here are hidden from Trending while you browse <strong>#{currentTag || 'all topics'}</strong>.
            </p>
          </div>
        )}

        {(showMuted ? mutedTopics : rankedTopics).length > 0 ? (
          (showMuted ? mutedTopics : rankedTopics).map((topic) => {
            const isFav = favTopics.includes(topic);
            const isSelected = currentTag.toLowerCase() === topic.toLowerCase();
            const isMuted = noiseSet.has(topic.toLowerCase().trim());

            return (
              <div
                key={topic}
                onClick={() => !showMuted && onSelectTag(isSelected ? '' : topic)}
                className={`group flex items-center justify-between p-2 rounded-xl text-xs transition ${
                  showMuted ? 'cursor-default border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50' : 'cursor-pointer'
                } ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold shadow-xs'
                    : isFav
                      ? 'bg-amber-50/40 dark:bg-amber-950/30 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-gray-800 dark:text-slate-200'
                      : showMuted 
                        ? 'bg-rose-50/30 dark:bg-rose-950/10 text-rose-700 dark:text-rose-400 opacity-80'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800/60 text-gray-700 dark:text-slate-300'
                }`}
              >
                {/* Topic name */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`font-bold text-xs ${
                    showMuted 
                      ? 'text-rose-400 dark:text-rose-500' 
                      : isSelected 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-gray-400 dark:text-slate-500 group-hover:text-blue-500 dark:group-hover:text-blue-400'
                  }`}>
                    #
                  </span>
                  <span className="truncate">{topic}</span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isSelected && (
                    <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-full font-semibold">
                      active
                    </span>
                  )}

                  {showMuted ? (
                    <button
                      type="button"
                      onClick={(e) => handleUnmuteTopic(topic, e)}
                      className="p-1 rounded-lg transition cursor-pointer text-rose-400 hover:text-rose-600 dark:text-rose-500 dark:hover:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/30"
                      title="Remove from noise (Show tag)"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      {/* Mute button */}
                      <button
                        type="button"
                        onClick={(e) => handleMuteTopic(topic, e)}
                        className="p-1 rounded-lg transition cursor-pointer text-gray-300 dark:text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100"
                        title="Add to noise (Hide in this context)"
                      >
                        <VolumeX className="w-3.5 h-3.5" />
                      </button>

                      {/* Favorite pin button */}
                      <button
                        type="button"
                        onClick={(e) => toggleFavTopic(topic, e)}
                        className={`p-1 rounded-lg transition cursor-pointer ${
                          isFav
                            ? 'text-amber-500'
                            : 'text-gray-300 dark:text-slate-600 hover:text-amber-500 opacity-0 group-hover:opacity-100'
                        }`}
                        title={isFav ? 'Remove favorite' : 'Pin topic to top'}
                      >
                        <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center space-y-2">
            <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-slate-800 flex items-center justify-center mx-auto text-gray-300 dark:text-slate-700">
              {showMuted ? <Volume2 className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {showMuted 
                ? `No noise tags identified for #${currentTag || 'global'}`
                : loadingChainTags 
                  ? 'Loading trending tags...' 
                  : `No topics matching "${searchQuery}"`}
            </p>
          </div>
        )}
      </div>

      {currentTag && (
        <button
          onClick={() => onSelectTag('')}
          className="w-full py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold text-center block cursor-pointer border-t border-gray-100 dark:border-slate-800 pt-3"
        >
          Clear topic filter (#{currentTag})
        </button>
      )}
    </div>
  );
};
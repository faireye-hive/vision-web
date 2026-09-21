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

interface TrendingTopicsCardProps {
  currentTag: string;
  onSelectTag: (tag: string) => void;
  feedPosts: HivePost[];
}

const DEFAULT_BACKUP_TAGS = [
  'photography',
  'crypto',
  'finance',
  'travel',
  'art',
  'food',
  'hive',
  'gaming',
  'music',
  'nature',
  'technology',
  'lifestyle',
  'writing',
  'science',
  'sports'
];

export const TrendingTopicsCard: React.FC<TrendingTopicsCardProps> = ({
  currentTag,
  onSelectTag,
  feedPosts,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteTags, setRemoteTags] = useState<string[]>([]);
  const [favTopics, setFavTopics] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nebulosa_fav_topics');
      return saved ? JSON.parse(saved) : ['photography', 'crypto', 'technology'];
    } catch {
      return ['photography', 'crypto', 'technology'];
    }
  });

  // Fetch global trending tags from Hive RPC in background
  useEffect(() => {
    let isMounted = true;
    getTrendingTags(30).then((tags) => {
      if (isMounted && tags && tags.length > 0) {
        setRemoteTags(tags.map((t) => t.tag));
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

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

  // Rank topics extracted dynamically from current posts + remote trending
  const rankedTopics = useMemo(() => {
    const counts: { [key: string]: number } = {};

    feedPosts.forEach((p) => {
      if (p.category && !p.category.startsWith('hive-')) {
        const cat = p.category.toLowerCase().trim();
        counts[cat] = (counts[cat] || 0) + 2;
      }
      let metadataTags: string[] = [];
      if (typeof p.json_metadata === 'object' && p.json_metadata && Array.isArray((p.json_metadata as any).tags)) {
        metadataTags = (p.json_metadata as any).tags;
      } else if (typeof p.json_metadata === 'string') {
        try {
          const parsed = JSON.parse(p.json_metadata);
          if (parsed && Array.isArray(parsed.tags)) {
            metadataTags = parsed.tags;
          }
        } catch {}
      }

      metadataTags.forEach((t: string) => {
        if (typeof t === 'string') {
          const clean = t.toLowerCase().trim();
          if (clean && !clean.startsWith('hive-') && clean.length > 2 && clean.length < 24) {
            counts[clean] = (counts[clean] || 0) + 1;
          }
        }
      });
    });

    const pool = Array.from(
      new Set([
        ...Object.keys(counts),
        ...remoteTags,
        ...favTopics,
        ...DEFAULT_BACKUP_TAGS
      ])
    );

    let filtered = pool;
    if (searchQuery.trim()) {
      filtered = filtered.filter((topic) =>
        topic.toLowerCase().includes(searchQuery.toLowerCase().trim())
      );
    }

    return filtered.sort((a, b) => {
      const aFav = favTopics.includes(a);
      const bFav = favTopics.includes(b);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;

      const countA = counts[a] || 0;
      const countB = counts[b] || 0;
      if (countA !== countB) return countB - countA;
      return a.localeCompare(b);
    });
  }, [feedPosts, remoteTags, favTopics, searchQuery]);

  return (
    <div className="bg-white rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] border border-gray-100/60 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-gray-900">Trending Topics</h3>
            <p className="text-[11px] text-gray-400">Popular blockchain discussions</p>
          </div>
        </div>

        <span className="text-[11px] font-medium text-gray-500 bg-gray-50 px-2.5 py-0.5 rounded-full">
          {rankedTopics.length} tags
        </span>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search topics..."
          className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
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
          !currentTag ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50 text-gray-700'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-lg ${!currentTag ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
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
        {rankedTopics.length > 0 ? (
          rankedTopics.map((topic) => {
            const isFav = favTopics.includes(topic);
            const isSelected = currentTag.toLowerCase() === topic.toLowerCase();

            return (
              <div
                key={topic}
                onClick={() => onSelectTag(isSelected ? '' : topic)}
                title={`Filter posts tagged #${topic}`}
                className={`group flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50 text-blue-700 font-bold shadow-xs'
                    : isFav
                      ? 'bg-amber-50/40 hover:bg-amber-50 text-gray-800'
                      : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`font-bold text-xs ${isSelected ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'}`}>
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
                  <button
                    onClick={(e) => toggleFavTopic(topic, e)}
                    className={`p-1 rounded-lg transition cursor-pointer ${
                      isFav
                        ? 'text-amber-500'
                        : 'text-gray-300 hover:text-amber-500 opacity-0 group-hover:opacity-100'
                    }`}
                    title={isFav ? 'Remove favorite' : 'Pin topic to top'}
                  >
                    <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-4 text-center text-xs text-gray-400">
            No topics matching "{searchQuery}"
          </div>
        )}
      </div>

      {currentTag && (
        <button
          onClick={() => onSelectTag('')}
          className="w-full py-1.5 text-xs text-blue-600 hover:underline font-semibold text-center block cursor-pointer border-t border-gray-100 pt-3"
        >
          Clear topic filter (#{currentTag})
        </button>
      )}
    </div>
  );
};

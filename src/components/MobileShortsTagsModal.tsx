import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Hash,
  X,
  Search,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Flame,
  Check,
  ChevronRight,
  SlidersHorizontal,
  VolumeX,
  Camera,
  Heart,
  Coins,
  Gamepad2,
  Star
} from 'lucide-react';
import {
  processShortsTags,
  isSpamOrNoiseTag,
  SHORTS_TOPIC_CATEGORIES,
  ShortsTopicCategory,
  getFavoriteTags,
  saveFavoriteTags
} from '../utils/shortsNoiseFilter';

interface MobileShortsTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hashtags: { tag: string; count: number }[];
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  blockedWords: string[];
  onAddWord: (word: string) => void;
  onRemoveWord: (word: string) => void;
  onOpenFilterDrawer?: () => void;
  favoriteTags?: string[];
  onToggleFavorite?: (tag: string) => void;
}

export const MobileShortsTagsModal: React.FC<MobileShortsTagsModalProps> = ({
  isOpen,
  onClose,
  hashtags,
  selectedTag,
  onSelectTag,
  blockedWords,
  onAddWord,
  onRemoveWord,
  onOpenFilterDrawer,
  favoriteTags: propFavoriteTags,
  onToggleFavorite: propOnToggleFavorite
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ShortsTopicCategory>('all');
  const [noiseFilterActive, setNoiseFilterActive] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hive_shorts_tags_noise_filter') !== 'false';
    } catch {
      return true;
    }
  });

  // Local state for favorite / pinned tags if not controlled by parent
  const [localFavorites, setLocalFavorites] = useState<string[]>(() => getFavoriteTags());
  const favoriteTags = propFavoriteTags || localFavorites;

  const handleToggleFavorite = (tagToToggle: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const clean = tagToToggle.toLowerCase().replace(/^#/, '');
    if (propOnToggleFavorite) {
      propOnToggleFavorite(clean);
    } else {
      setLocalFavorites((prev) => {
        const exists = prev.includes(clean);
        const next = exists ? prev.filter((t) => t !== clean) : [...prev, clean];
        saveFavoriteTags(next);
        return next;
      });
    }
  };

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Persist noise filter preference
  const toggleNoiseFilter = () => {
    setNoiseFilterActive((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('hive_shorts_tags_noise_filter', String(next));
      } catch {}
      return next;
    });
  };

  // Close on Escape & focus input on open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => searchInputRef.current?.focus(), 120);
    } else {
      document.body.style.overflow = '';
      setSearchQuery('');
      setActiveCategory('all');
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Compute processed clean tags vs detected spam count
  const { cleanTags, spamTagsCount } = useMemo(() => {
    return processShortsTags(hashtags, {
      hideSpam: noiseFilterActive,
      searchQuery,
      blockedWords,
      category: activeCategory,
      favoriteTags
    });
  }, [hashtags, noiseFilterActive, searchQuery, blockedWords, activeCategory, favoriteTags]);

  if (!isOpen) return null;

  const normalizedCurrentTag = selectedTag.toLowerCase().replace(/^#/, '');
  const cleanSearchQuery = searchQuery.trim().toLowerCase().replace(/^#/, '');
  const hasExactSearchMatch = cleanTags.some((t) => t.tag === cleanSearchQuery);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Sheet Container: Space-optimized for mobile height */}
      <div
        className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-[24px] sm:rounded-[24px] border border-slate-200/80 dark:border-slate-800 shadow-2xl z-10 flex flex-col h-[88vh] sm:h-[82vh] max-h-[88vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Indicator */}
        <div className="sm:hidden pt-2 pb-0.5 flex justify-center">
          <div className="w-8 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* 1. Ultra-Compact Header (One Single Row) */}
        <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <Hash className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate leading-none">
              Shorts Tags
            </h3>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 flex-shrink-0">
              ({cleanTags.length})
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Compact Anti-Noise Toggle */}
            <button
              type="button"
              onClick={toggleNoiseFilter}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition cursor-pointer select-none ${
                noiseFilterActive
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}
              title={noiseFilterActive ? `Anti-Noise is ON (${spamTagsCount} hidden)` : 'Anti-Noise is OFF'}
            >
              <ShieldCheck className={`w-3 h-3 ${noiseFilterActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
              <span>Anti-Noise: {noiseFilterActive ? 'ON' : 'OFF'}</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Compact Search & All Shorts Strip */}
        <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 space-y-1.5 flex-shrink-0 bg-slate-50/40 dark:bg-slate-900/40">
          <div className="flex items-center gap-1.5">
            {/* Quick All Shorts Reset Button */}
            <button
              type="button"
              onClick={() => {
                onSelectTag('');
                onClose();
              }}
              className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                !selectedTag
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
              title="Clear tag filter"
            >
              <Sparkles className="w-3 h-3" />
              <span>All Shorts</span>
              {!selectedTag && <Check className="w-3 h-3" />}
            </button>

            {/* Slim Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold p-0.5 cursor-pointer"
                >
                  &times;
                </button>
              )}
            </div>
          </div>

          {/* Single-Line Topic Category Scroller */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
            {SHORTS_TOPIC_CATEGORIES.map((cat) => {
              const isCatActive = activeCategory === cat.id;
              const label =
                cat.id === 'favorites'
                  ? `Pinned (${favoriteTags.length})`
                  : cat.id === 'all'
                  ? 'All'
                  : cat.label;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold transition cursor-pointer select-none ${
                    isCatActive
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                  }`}
                >
                  {cat.id === 'all' && <Hash className="w-2.5 h-2.5" />}
                  {cat.id === 'favorites' && (
                    <Star className={`w-2.5 h-2.5 ${isCatActive ? 'fill-white text-white' : 'fill-amber-400 text-amber-500'}`} />
                  )}
                  {cat.id === 'popular' && <Flame className="w-2.5 h-2.5 text-amber-500" />}
                  {cat.id === 'art' && <Camera className="w-2.5 h-2.5 text-purple-400" />}
                  {cat.id === 'life' && <Heart className="w-2.5 h-2.5 text-rose-400" />}
                  {cat.id === 'crypto' && <Coins className="w-2.5 h-2.5 text-emerald-400" />}
                  {cat.id === 'tech' && <Gamepad2 className="w-2.5 h-2.5 text-blue-400" />}
                  {cat.id === 'noise' && <ShieldAlert className="w-2.5 h-2.5 text-amber-500" />}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Custom Search Match Button (if query not in list) */}
        {cleanSearchQuery && !hasExactSearchMatch && (
          <div className="px-3 pt-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                onSelectTag(cleanSearchQuery);
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 hover:bg-blue-100 transition cursor-pointer text-left"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Hash className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span className="truncate">Filter by custom tag: <strong>#{cleanSearchQuery}</strong></span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            </button>
          </div>
        )}

        {/* 4. Scrollable Space-Efficient 2-Column Grid (Maximizes Visible Tags on Mobile) */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 overscroll-contain">
          {cleanTags.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500 space-y-2">
              <Hash className="w-6 h-6 mx-auto opacity-30" />
              <p>
                {activeCategory === 'favorites'
                  ? 'No pinned tags yet. Tap the star icon on any tag to pin it for quick access!'
                  : 'No matching tags found.'}
              </p>
              {noiseFilterActive && spamTagsCount > 0 && activeCategory !== 'favorites' && (
                <button
                  type="button"
                  onClick={toggleNoiseFilter}
                  className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
                >
                  Show {spamTagsCount} hidden noise tags
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {cleanTags.map(({ tag, count, isSpam, isFavorite }) => {
                const isSelected = normalizedCurrentTag === tag.toLowerCase();
                const formattedTag = `#${tag}`;
                const isBlocked = blockedWords.some((w) => {
                  const cw = w.toLowerCase().trim();
                  return cw === tag || cw === formattedTag;
                });

                return (
                  <div
                    key={tag}
                    onClick={() => {
                      onSelectTag(isSelected ? '' : tag);
                      onClose();
                    }}
                    className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs transition cursor-pointer select-none ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-2xs font-bold'
                        : isBlocked
                        ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-200/50 dark:border-rose-900/40 opacity-70'
                        : isFavorite
                        ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-900/50 text-slate-900 dark:text-slate-100 hover:bg-amber-100/70'
                        : isSpam
                        ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/40 dark:border-amber-900/30 text-slate-700 dark:text-slate-300'
                        : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200/70 dark:border-slate-700/70 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {/* Tag Name & Hash/Star */}
                    <div className="flex items-center gap-1 min-w-0 flex-1 mr-1">
                      {isFavorite ? (
                        <Star className={`w-3 h-3 flex-shrink-0 ${isSelected ? 'fill-white text-white' : 'fill-amber-400 text-amber-500'}`} />
                      ) : (
                        <span className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-slate-400'}`}>#</span>
                      )}
                      <span className="truncate font-semibold text-xs leading-none">
                        {tag}
                      </span>
                    </div>

                    {/* Count & Star Pin Button */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span
                        className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                          isSelected
                            ? 'bg-blue-700 text-blue-100'
                            : isFavorite
                            ? 'bg-amber-100/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                            : 'bg-slate-200/70 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {count}
                      </span>

                      {/* Star / Pin Button */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(tag, e)}
                        className={`p-1 -mr-1 rounded-md transition cursor-pointer ${
                          isSelected
                            ? 'text-blue-100 hover:text-white'
                            : isFavorite
                            ? 'text-amber-500 hover:text-amber-600'
                            : 'text-slate-300 dark:text-slate-600 hover:text-amber-500'
                        }`}
                        title={isFavorite ? 'Unpin tag' : 'Pin tag to favorites'}
                      >
                        <Star
                          className={`w-3 h-3 ${
                            isFavorite
                              ? isSelected
                                ? 'fill-white text-white'
                                : 'fill-amber-400 text-amber-500'
                              : ''
                          }`}
                        />
                      </button>

                      {isBlocked && (
                        <span title="Tag in your block list">
                          <VolumeX className="w-2.5 h-2.5 text-rose-500 flex-shrink-0" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. Ultra-Slim Footer */}
        <div className="px-3.5 py-1.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between text-xs flex-shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {selectedTag ? (
              <>
                Active: <strong className="text-blue-600 dark:text-blue-400">#{selectedTag}</strong>
              </>
            ) : (
              'Tap any tag to filter feed'
            )}
          </span>

          <div className="flex items-center gap-2 flex-shrink-0">
            {selectedTag && (
              <button
                type="button"
                onClick={() => {
                  onSelectTag('');
                  onClose();
                }}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
              >
                Clear filter
              </button>
            )}

            {onOpenFilterDrawer && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFilterDrawer();
                }}
                className="text-[11px] font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 flex items-center gap-0.5 cursor-pointer"
                title="Manage noise word & author filters"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Filters</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

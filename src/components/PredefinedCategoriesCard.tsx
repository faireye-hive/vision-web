import React, { useState, useMemo } from 'react';
import {
  Camera,
  Coins,
  Laptop,
  Gamepad2,
  Palette,
  Compass,
  BookOpen,
  Music,
  Utensils,
  TrendingUp,
  Atom,
  Trophy,
  Trees,
  Sparkles,
  Wrench,
  PawPrint,
  Landmark,
  GraduationCap,
  HeartPulse,
  Clapperboard,
  Hexagon,
  Scale,
  Globe,
  Search,
  Star,
  X,
  Layers
} from 'lucide-react';
import { CATEGORY_DEFINITIONS } from '../data/categorySubtopics';

export interface PredefinedCategory {
  id: string;
  name: string;
  tag: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badgeBg: string;
}

interface CategoryStyle {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badgeBg: string;
}

// Visual de cada categoria, indexado pelo `tag` de CATEGORY_DEFINITIONS.
// Nome, descrição e tag vêm de categorySubtopics.ts (fonte única).
const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  animals:     { icon: PawPrint,      color: 'text-yellow-600',  badgeBg: 'bg-yellow-50 text-yellow-700' },
  art:         { icon: Palette,       color: 'text-pink-600',    badgeBg: 'bg-pink-50 text-pink-700' },
  crypto:      { icon: Coins,         color: 'text-amber-500',   badgeBg: 'bg-amber-50 text-amber-700' },
  culture:     { icon: Landmark,      color: 'text-stone-600',   badgeBg: 'bg-stone-50 text-stone-700' },
  diy:         { icon: Wrench,        color: 'text-lime-600',    badgeBg: 'bg-lime-50 text-lime-700' },
  education:   { icon: GraduationCap, color: 'text-sky-600',     badgeBg: 'bg-sky-50 text-sky-700' },
  finance:     { icon: TrendingUp,    color: 'text-green-600',   badgeBg: 'bg-green-50 text-green-700' },
  food:        { icon: Utensils,      color: 'text-orange-500',  badgeBg: 'bg-orange-50 text-orange-700' },
  gaming:      { icon: Gamepad2,      color: 'text-emerald-600', badgeBg: 'bg-emerald-50 text-emerald-700' },
  health:      { icon: HeartPulse,    color: 'text-red-500',     badgeBg: 'bg-red-50 text-red-700' },
  hive:        { icon: Hexagon,       color: 'text-yellow-500',  badgeBg: 'bg-yellow-50 text-yellow-700' },
  lifestyle:   { icon: Sparkles,      color: 'text-fuchsia-500', badgeBg: 'bg-fuchsia-50 text-fuchsia-700' },
  media:       { icon: Clapperboard,  color: 'text-violet-600',  badgeBg: 'bg-violet-50 text-violet-700' },
  music:       { icon: Music,         color: 'text-rose-600',    badgeBg: 'bg-rose-50 text-rose-700' },
  nature:      { icon: Trees,         color: 'text-emerald-500', badgeBg: 'bg-emerald-50 text-emerald-700' },
  photography: { icon: Camera,        color: 'text-purple-600',  badgeBg: 'bg-purple-50 text-purple-700' },
  politics:    { icon: Scale,         color: 'text-slate-600',   badgeBg: 'bg-slate-100 text-slate-700' },
  science:     { icon: Atom,          color: 'text-cyan-600',    badgeBg: 'bg-cyan-50 text-cyan-700' },
  sports:      { icon: Trophy,        color: 'text-red-500',     badgeBg: 'bg-red-50 text-red-700' },
  technology:  { icon: Laptop,        color: 'text-blue-600',    badgeBg: 'bg-blue-50 text-blue-700' },
  travel:      { icon: Compass,       color: 'text-teal-600',    badgeBg: 'bg-teal-50 text-teal-700' },
  world:       { icon: Globe,         color: 'text-indigo-500',  badgeBg: 'bg-indigo-50 text-indigo-700' },
  writing:     { icon: BookOpen,      color: 'text-indigo-600',  badgeBg: 'bg-indigo-50 text-indigo-700' },
};

const DEFAULT_STYLE: CategoryStyle = {
  icon: Layers,
  color: 'text-gray-500',
  badgeBg: 'bg-gray-50 text-gray-700',
};

export const PREDEFINED_CATEGORIES: PredefinedCategory[] = CATEGORY_DEFINITIONS.map((def) => {
  const style = CATEGORY_STYLES[def.tag] ?? DEFAULT_STYLE;
  return {
    id: def.tag,
    name: def.label,
    tag: def.tag,
    description: def.description ?? '',
    icon: style.icon,
    color: style.color,
    badgeBg: style.badgeBg,
  };
});

const FAV_STORAGE_KEY = 'nebulosa_fav_categories';
const DEFAULT_FAVS = ['photography', 'crypto', 'technology'];

// Ids antigos que mudaram de nome (favoritos já salvos no navegador)
const LEGACY_ID_MAP: Record<string, string> = {
  life: 'lifestyle',
};

function loadFavorites(): string[] {
  try {
    const saved = localStorage.getItem(FAV_STORAGE_KEY);
    if (!saved) return DEFAULT_FAVS;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return DEFAULT_FAVS;

    const validIds = new Set(PREDEFINED_CATEGORIES.map((c) => c.id));
    const migrated = parsed
      .map((id: string) => LEGACY_ID_MAP[id] ?? id)
      .filter((id: string) => validIds.has(id));
    return Array.from(new Set(migrated));
  } catch {
    return DEFAULT_FAVS;
  }
}

interface PredefinedCategoriesCardProps {
  currentTag: string;
  onSelectTag: (tag: string) => void;
}

export const PredefinedCategoriesCard: React.FC<PredefinedCategoriesCardProps> = ({
  currentTag,
  onSelectTag,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [favCategories, setFavCategories] = useState<string[]>(loadFavorites);

  const toggleFavCategory = (catId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavCategories((prev) => {
      const updated = prev.includes(catId)
        ? prev.filter((id) => id !== catId)
        : [...prev, catId];
      try {
        localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const filteredCategories = useMemo(() => {
    let list = PREDEFINED_CATEGORIES;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (cat) =>
          cat.name.toLowerCase().includes(q) ||
          cat.tag.toLowerCase().includes(q) ||
          cat.description.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      const aFav = favCategories.includes(a.id);
      const bFav = favCategories.includes(b.id);

      // 1. Favoritos no topo
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;

      // 2. Entre iguais, ordem A-Z pelo nome
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }, [searchQuery, favCategories]);

  return (
    <div
      className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/60 dark:border-slate-800 space-y-4"
      style={{ padding: '5px', borderRadius: '15px', width: '250px', paddingTop: '20px', marginTop: '39px', marginBottom: '0px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">Explore Categories</h3>
            <p className="text-[11px] text-gray-400 dark:text-slate-500">Curated discovery topics</p>
          </div>
        </div>

        <span className="text-[11px] font-medium text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
          {PREDEFINED_CATEGORIES.length} topics
        </span>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter categories..."
          className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* "All Categories" quick button */}
      <button
        onClick={() => onSelectTag('')}
        title="Show all categories without filter"
        className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-xs transition cursor-pointer ${
          !currentTag
            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold shadow-xs'
            : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-xl ${!currentTag ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
            <Compass className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold">All Categories</span>
        </div>
        {!currentTag && (
          <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">
            active
          </span>
        )}
      </button>

      {/* Categories List */}
      <div className="max-h-[380px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
        {filteredCategories.length > 0 ? (
          filteredCategories.map((category) => {
            const Icon = category.icon;
            const isFav = favCategories.includes(category.id);
            const isSelected = currentTag.toLowerCase() === category.tag.toLowerCase();

            return (
              <div
                key={category.id}
                onClick={() => onSelectTag(isSelected ? '' : category.tag)}
                title={`${category.name}: ${category.description}`}
                className={`group flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                    : isFav
                      ? 'bg-amber-50/40 dark:bg-amber-950/30 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-gray-800 dark:text-slate-200'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-1.5 rounded-xl bg-gray-50 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors flex-shrink-0 ${category.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-900 dark:text-slate-100 truncate">
                        {category.name}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 font-normal">
                        #{category.tag}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 font-normal truncate mt-0.5">
                      {category.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                  {isSelected && (
                    <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-semibold">
                      active
                    </span>
                  )}
                  <button
                    onClick={(e) => toggleFavCategory(category.id, e)}
                    className={`p-1 rounded-lg transition cursor-pointer ${
                      isFav
                        ? 'text-amber-500'
                        : 'text-gray-300 hover:text-amber-500 opacity-0 group-hover:opacity-100'
                    }`}
                    title={isFav ? 'Remove favorite' : 'Pin category to top'}
                  >
                    <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-4 text-center text-xs text-gray-400">
            No categories matching "{searchQuery}"
          </div>
        )}
      </div>

      {currentTag && (
        <button
          onClick={() => onSelectTag('')}
          className="w-full py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold text-center block cursor-pointer border-t border-gray-100 dark:border-slate-800 pt-3"
        >
          Clear category filter (#{currentTag})
        </button>
      )}
    </div>
  );
};
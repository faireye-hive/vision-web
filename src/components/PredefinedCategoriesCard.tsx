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
  Heart,
  Wrench,
  Search,
  Star,
  X,
  Layers
} from 'lucide-react';

export interface PredefinedCategory {
  id: string;
  name: string;
  tag: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badgeBg: string;
}

export const PREDEFINED_CATEGORIES: PredefinedCategory[] = [
  {
    id: 'photography',
    name: 'Photography',
    tag: 'photography',
    description: 'Street, portrait, visual arts and landscapes',
    icon: Camera,
    color: 'text-purple-600',
    badgeBg: 'bg-purple-50 text-purple-700',
  },
  {
    id: 'crypto',
    name: 'Crypto & Web3',
    tag: 'crypto',
    description: 'Blockchain news, Bitcoin, DeFi and Web3 tech',
    icon: Coins,
    color: 'text-amber-500',
    badgeBg: 'bg-amber-50 text-amber-700',
  },
  {
    id: 'technology',
    name: 'Technology & Dev',
    tag: 'technology',
    description: 'Programming, open-source, AI and hardware',
    icon: Laptop,
    color: 'text-blue-600',
    badgeBg: 'bg-blue-50 text-blue-700',
  },
  {
    id: 'gaming',
    name: 'Gaming & Esports',
    tag: 'gaming',
    description: 'Video games, Web3 gaming and walkthroughs',
    icon: Gamepad2,
    color: 'text-emerald-600',
    badgeBg: 'bg-emerald-50 text-emerald-700',
  },
  {
    id: 'art',
    name: 'Art & Design',
    tag: 'art',
    description: 'Digital art, illustrations and creative craft',
    icon: Palette,
    color: 'text-pink-600',
    badgeBg: 'bg-pink-50 text-pink-700',
  },
  {
    id: 'travel',
    name: 'Travel & Explore',
    tag: 'travel',
    description: 'Destinations, road trips and cultural journeys',
    icon: Compass,
    color: 'text-teal-600',
    badgeBg: 'bg-teal-50 text-teal-700',
  },
  {
    id: 'writing',
    name: 'Writing & Stories',
    tag: 'writing',
    description: 'Literature, poetry, storytelling and essays',
    icon: BookOpen,
    color: 'text-indigo-600',
    badgeBg: 'bg-indigo-50 text-indigo-700',
  },
  {
    id: 'music',
    name: 'Music & Audio',
    tag: 'music',
    description: 'Tracks, production, performances and reviews',
    icon: Music,
    color: 'text-rose-600',
    badgeBg: 'bg-rose-50 text-rose-700',
  },
  {
    id: 'food',
    name: 'Food & Cooking',
    tag: 'food',
    description: 'Recipes, culinary traditions and gastronomy',
    icon: Utensils,
    color: 'text-orange-500',
    badgeBg: 'bg-orange-50 text-orange-700',
  },
  {
    id: 'finance',
    name: 'Finance & Markets',
    tag: 'finance',
    description: 'Investing, personal finance and economics',
    icon: TrendingUp,
    color: 'text-green-600',
    badgeBg: 'bg-green-50 text-green-700',
  },
  {
    id: 'science',
    name: 'Science & Nature',
    tag: 'science',
    description: 'Discoveries, astronomy, biology and tech',
    icon: Atom,
    color: 'text-cyan-600',
    badgeBg: 'bg-cyan-50 text-cyan-700',
  },
  {
    id: 'sports',
    name: 'Sports & Fitness',
    tag: 'sports',
    description: 'Athletics, workouts and sports coverage',
    icon: Trophy,
    color: 'text-red-500',
    badgeBg: 'bg-red-50 text-red-700',
  },
  {
    id: 'nature',
    name: 'Nature & Wildlife',
    tag: 'nature',
    description: 'Forests, wildlife, ecology and gardening',
    icon: Trees,
    color: 'text-emerald-500',
    badgeBg: 'bg-emerald-50 text-emerald-700',
  },
  {
    id: 'life',
    name: 'Life & Reflections',
    tag: 'life',
    description: 'Personal experiences, life lessons and thoughts',
    icon: Heart,
    color: 'text-rose-500',
    badgeBg: 'bg-rose-50 text-rose-700',
  },
  {
    id: 'diy',
    name: 'DIY & Crafts',
    tag: 'diy',
    description: 'Do-it-yourself builds, crafts and makers',
    icon: Wrench,
    color: 'text-lime-600',
    badgeBg: 'bg-lime-50 text-lime-700',
  },
];

interface PredefinedCategoriesCardProps {
  currentTag: string;
  onSelectTag: (tag: string) => void;
}

export const PredefinedCategoriesCard: React.FC<PredefinedCategoriesCardProps> = ({
  currentTag,
  onSelectTag,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [favCategories, setFavCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nebulosa_fav_categories');
      return saved ? JSON.parse(saved) : ['photography', 'crypto', 'technology'];
    } catch {
      return ['photography', 'crypto', 'technology'];
    }
  });

  const toggleFavCategory = (catId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavCategories((prev) => {
      const updated = prev.includes(catId)
        ? prev.filter((id) => id !== catId)
        : [...prev, catId];
      try {
        localStorage.setItem('nebulosa_fav_categories', JSON.stringify(updated));
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
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });
  }, [searchQuery, favCategories]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/60 dark:border-slate-800 space-y-4">
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
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 font-normal truncate mt-0.2">
                      {category.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                  {isSelected && (
                    <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-full font-semibold">
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

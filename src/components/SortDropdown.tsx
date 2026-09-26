import React, { useState, useRef, useEffect } from 'react';
import {
  Flame,
  TrendingUp,
  Sparkles,
  DollarSign,
  VolumeX,
  ChevronDown,
  Check
} from 'lucide-react';

export type SortType = 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted';

interface SortDropdownProps {
  currentSort: SortType;
  onSortChange: (sort: SortType) => void;
  id?: string;
}

const SORT_OPTIONS = [
  {
    id: 'hot' as const,
    label: 'Hot',
    icon: Flame,
    iconColor: 'text-amber-500',
    description: 'Rapid momentum and recent active engagement',
    badge: null,
  },
  {
    id: 'trending' as const,
    label: 'Trending',
    icon: TrendingUp,
    iconColor: 'text-blue-600',
    description: 'Highest post rewards and top community votes',
    badge: null,
  },
  {
    id: 'created' as const,
    label: 'New',
    icon: Sparkles,
    iconColor: 'text-emerald-600',
    description: 'Real-time latest posts published on Hive',
    badge: 'Live',
  },
  {
    id: 'payout' as const,
    label: 'Payout',
    icon: DollarSign,
    iconColor: 'text-emerald-500',
    description: 'Posts with the highest pending rewards',
    badge: null,
  },
  {
    id: 'muted' as const,
    label: 'Muted',
    icon: VolumeX,
    iconColor: 'text-rose-500',
    description: 'Downvoted or filtered community posts',
    badge: null,
  },
];

export const SortDropdown: React.FC<SortDropdownProps> = ({
  currentSort,
  onSortChange,
  id = 'discover-sort-dropdown',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = SORT_OPTIONS.find((opt) => opt.id === currentSort) || SORT_OPTIONS[0];
  const SelectedIcon = selectedOption.icon;

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (sortId: SortType) => {
    onSortChange(sortId);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative inline-block text-left" id={id}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title={`Sort feed: currently ${selectedOption.label}. Click to select another ranking.`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer border ${
          isOpen
            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 shadow-xs'
            : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200/80 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 border-transparent dark:border-slate-700'
        }`}
      >
        <SelectedIcon className={`w-3.5 h-3.5 ${selectedOption.iconColor}`} />
        <span>{selectedOption.label}</span>
        {selectedOption.badge === 'Live' && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        )}
        <ChevronDown
          className={`w-3 h-3 text-gray-400 dark:text-slate-500 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
          }`}
        />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 mt-1.5 w-60 rounded-2xl bg-white dark:bg-slate-900 shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100 dark:border-slate-800 p-1.5 z-40 focus:outline-none animate-in fade-in zoom-in-95 duration-100 text-gray-800 dark:text-slate-200"
        >
          <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
            Sort feed by
          </div>

          <div className="space-y-0.5">
            {SORT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isCurrent = option.id === currentSort;

              return (
                <button
                  key={option.id}
                  role="option"
                  aria-selected={isCurrent}
                  onClick={() => handleSelect(option.id)}
                  title={option.description}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-xs text-left transition cursor-pointer group ${
                    isCurrent
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="p-1 rounded-lg bg-gray-50 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors mt-0.5 flex-shrink-0">
                      <Icon className={`w-3.5 h-3.5 ${option.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-gray-900 dark:text-white">{option.label}</span>
                        {option.badge === 'Live' && (
                          <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 px-1.5 py-0.2 rounded-full flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                            Live
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 dark:text-slate-500 font-normal line-clamp-1 mt-0.5">
                        {option.description}
                      </p>
                    </div>
                  </div>

                  {isCurrent && (
                    <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

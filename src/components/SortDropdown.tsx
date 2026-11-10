import React, { useState, useRef, useEffect } from 'react';
import {
  Flame,
  TrendingUp,
  Sparkles,
  DollarSign,
  VolumeX,
  ChevronDown,
  Check,
  Compass
} from 'lucide-react';

export type SortType = 'recommend' | 'hot' | 'trending' | 'created' | 'payout' | 'muted' | 'promoted';

interface SortDropdownProps {
  currentSort: SortType;
  onSortChange: (sort: SortType) => void;
  id?: string;
  hideRecommend?: boolean;
  iconOnly?: boolean;
}

const SORT_OPTIONS = [
  {
    id: 'recommend' as const,
    label: 'Recommend',
    icon: Compass,
    iconColor: 'text-slate-500 dark:text-slate-400',
    description: 'Personalized feed based on your upvoted posts & HiveSense',
    badge: 'Smart',
  },
  {
    id: 'hot' as const,
    label: 'Hot',
    icon: Flame,
    iconColor: 'text-slate-500 dark:text-slate-400',
    description: 'Rapid momentum and recent active engagement',
    badge: null,
  },
  {
    id: 'trending' as const,
    label: 'Trending',
    icon: TrendingUp,
    iconColor: 'text-slate-500 dark:text-slate-400',
    description: 'Highest post rewards and top community votes',
    badge: null,
  },
  {
    id: 'created' as const,
    label: 'Created',
    icon: Sparkles,
    iconColor: 'text-slate-500 dark:text-slate-400',
    description: 'Real-time latest posts published on Hive',
    badge: 'Live',
  },
  {
    id: 'payout' as const,
    label: 'Payout',
    icon: DollarSign,
    iconColor: 'text-slate-500 dark:text-slate-400',
    description: 'Posts with the highest pending rewards',
    badge: null,
  },
  {
    id: 'muted' as const,
    label: 'Muted',
    icon: VolumeX,
    iconColor: 'text-slate-500 dark:text-slate-400',
    description: 'Downvoted or filtered community posts',
    badge: null,
  },
];

export const SortDropdown: React.FC<SortDropdownProps> = ({
  currentSort,
  onSortChange,
  id = 'discover-sort-dropdown',
  hideRecommend = false,
  iconOnly = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableOptions = hideRecommend
    ? SORT_OPTIONS.filter((opt) => opt.id !== 'recommend')
    : SORT_OPTIONS;

  const effectiveSort = hideRecommend && currentSort === 'recommend' ? 'trending' : currentSort;
  const selectedOption = availableOptions.find((opt) => opt.id === effectiveSort) || availableOptions[0];
  const SelectedIcon = selectedOption.icon;

  // Check alignment relative to screen viewport
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const updatePosition = () => {
        if (!dropdownRef.current) return;
        const rect = dropdownRef.current.getBoundingClientRect();
        if (rect.left + 240 > window.innerWidth && rect.right >= 240) {
          setAlignRight(true);
        } else {
          setAlignRight(false);
        }
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, { passive: true });
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition);
      };
    }
  }, [isOpen]);

  // Close when clicking or tapping outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | PointerEvent) => {
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
      document.addEventListener('pointerdown', handleClickOutside);
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
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
        className={`inline-flex items-center gap-1 ${
          iconOnly ? 'p-1.5 sm:px-2 sm:py-1' : 'px-2 py-1 sm:px-2.5 sm:py-1'
        } rounded-full text-xs font-semibold transition cursor-pointer border select-none shrink-0 ${
          isOpen
            ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600 shadow-xs'
            : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200/80 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 border-transparent dark:border-slate-700'
        }`}
      >
        <SelectedIcon className={`w-3.5 h-3.5 flex-shrink-0 ${selectedOption.iconColor}`} />
        {!iconOnly && (
          <span className="text-[11px] sm:text-xs font-semibold leading-tight">{selectedOption.label}</span>
        )}
        {selectedOption.badge === 'Live' && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        )}
        <ChevronDown
          className={`w-2.5 h-2.5 text-gray-400 dark:text-slate-400 transition-transform duration-150 flex-shrink-0 ${
            isOpen ? 'rotate-180 text-slate-600 dark:text-slate-300' : ''
          }`}
        />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute ${
            alignRight ? 'right-0' : 'left-0'
          } mt-1.5 w-60 max-w-[calc(100vw-24px)] rounded-2xl bg-white dark:bg-slate-900 shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100 dark:border-slate-800 p-1.5 z-50 focus:outline-none animate-in fade-in zoom-in-95 duration-100 text-gray-800 dark:text-slate-200`}
        >
          <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
            Sort feed by
          </div>

          <div className="space-y-0.5">
            {availableOptions.map((option) => {
              const Icon = option.icon;
              const isCurrent = option.id === currentSort;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={isCurrent}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(option.id);
                  }}
                  title={option.description}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-xs text-left transition cursor-pointer select-none group ${
                    isCurrent
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-700'
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
                      <p className="text-[11px] text-gray-400 dark:text-slate-400 font-normal line-clamp-1 mt-0.5">
                        {option.description}
                      </p>
                    </div>
                  </div>

                  {isCurrent && (
                    <Check className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 flex-shrink-0 ml-1" />
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

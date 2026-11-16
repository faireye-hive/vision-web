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

import type { SortOption } from '../context/NavigationContext';

interface SortDropdownProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
  id?: string;
  iconOnly?: boolean;
}

const SORT_OPTIONS = [
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
  iconOnly = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = SORT_OPTIONS.find((opt) => opt.id === currentSort) || SORT_OPTIONS[0];
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

  const handleSelect = (sortId: SortOption) => {
    onSortChange(sortId);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="inline-block text-left sm:relative" id={id}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Sort feed: ${selectedOption.label}`}
        title={`Sort feed: currently ${selectedOption.label}. Click to select another ranking.`}
        className={`inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer select-none items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold transition sm:min-h-0 sm:min-w-0 sm:gap-1 sm:text-xs ${
          iconOnly ? 'sm:px-2' : ''
        } ${
          isOpen
            ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600 shadow-xs'
            : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200/80 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 border-transparent dark:border-slate-700'
        }`}
      >
        <SelectedIcon className={`size-4 shrink-0 sm:size-3.5 ${selectedOption.iconColor}`} />
        <span className={`leading-tight ${iconOnly ? 'max-[359px]:hidden sm:hidden' : ''}`}>{selectedOption.label}</span>
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
          aria-label="Sort feed by"
          className={`absolute top-full z-50 mt-1.5 max-h-[min(24rem,55dvh)] overflow-y-auto overscroll-contain rounded-2xl border border-gray-200 bg-white p-2 text-gray-800 shadow-[0_8px_24px_rgba(0,0,0,0.12)] max-sm:inset-x-1 sm:max-h-none sm:w-60 sm:p-1.5 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 ${
            alignRight ? 'sm:right-0' : 'sm:left-0'
          }`}
        >
          <div className="px-2.5 py-2 text-sm font-semibold text-slate-600 sm:py-1 sm:text-[10px] sm:uppercase sm:tracking-wider dark:text-slate-400">
            Sort feed by
          </div>

          <div className="space-y-0.5">
            {SORT_OPTIONS.map((option) => {
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
                  className={`group flex min-h-12 w-full cursor-pointer select-none items-center justify-between rounded-xl p-2 text-left text-sm transition sm:min-h-0 sm:text-xs ${
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
                      <p className="mt-0.5 line-clamp-1 text-xs font-normal text-slate-500 sm:text-[11px] dark:text-slate-400">
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

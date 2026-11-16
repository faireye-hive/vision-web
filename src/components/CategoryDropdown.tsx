import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Tag, Check } from 'lucide-react';
import { CATEGORY_DEFINITIONS, CategoryDefinition } from '../data/categorySubtopics';

interface CategoryDropdownProps {
  currentCategory?: CategoryDefinition;
  onSelectCategory: (categoryTag: string) => void;
  id?: string;
}

export const CategoryDropdown: React.FC<CategoryDropdownProps> = ({
  currentCategory,
  onSelectCategory,
  id = 'discover-category-dropdown',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [leftOffset, setLeftOffset] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Calculate viewport boundaries so the menu sits right under the button with mt-1.5,
  // while preventing overflow off-screen on the right or left.
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const updatePosition = () => {
        if (!dropdownRef.current || !menuRef.current || window.innerWidth < 640) return;
        const rect = dropdownRef.current.getBoundingClientRect();
        const menuWidth = menuRef.current.offsetWidth;
        const screenMargin = 8;
        const availableWidth = window.innerWidth;

        // How much it overflows to the right when left-aligned with the button:
        const rightEdge = rect.left + menuWidth;
        const overflow = rightEdge - (availableWidth - screenMargin);

        if (overflow > 0) {
          // Shift left by overflow, but clamp so left edge stays within screenMargin
          const maxShift = rect.left - screenMargin;
          const shift = Math.min(overflow, Math.max(0, maxShift));
          setLeftOffset(-shift);
        } else {
          setLeftOffset(0);
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

  // Close dropdown on click outside or Escape (identical to SortDropdown)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setExpandedCat(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setExpandedCat(null);
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

  const handleSelect = (tag: string) => {
    onSelectCategory(tag);
    setIsOpen(false);
    setExpandedCat(null);
  };

  const toggleExpand = (catTag: string) => {
    setExpandedCat((prev) => (prev === catTag ? null : catTag));
  };

  return (
    <div ref={dropdownRef} className="inline-block min-w-0 text-left sm:relative" id={id}>
      {/* Trigger Button - Identical sizing & styling to Trending/Hot/Created dropdown */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title="Filter by topic category"
        className={`inline-flex min-h-11 w-full min-w-0 cursor-pointer select-none items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold transition sm:min-h-0 sm:w-auto sm:gap-1.5 sm:px-2.5 sm:text-xs ${
          isOpen || currentCategory
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 shadow-xs'
            : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200/80 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 border-transparent dark:border-slate-700'
        }`}
      >
        {currentCategory ? (
          <span aria-hidden="true" className="shrink-0 text-base sm:text-xs">{currentCategory.icon}</span>
        ) : (
          <Tag className="size-4 shrink-0 text-slate-500 sm:size-3.5 dark:text-slate-400" />
        )}
        <span className="min-w-0 truncate leading-tight sm:max-w-[130px]">
          {currentCategory ? currentCategory.label : 'Categories'}
        </span>
        <ChevronDown
          className={`ms-auto size-4 shrink-0 text-gray-400 transition-transform duration-150 sm:size-3 dark:text-slate-400 ${
            isOpen ? 'rotate-180 text-slate-600 dark:text-slate-300' : ''
          }`}
        />
      </button>

      {/* Floating Menu - Sits directly below the trigger button (mt-1.5), styled identically to SortDropdown */}
      {isOpen && (
        <div
          ref={menuRef}
          role="listbox"
          aria-label="Filter by Category"
          style={{ '--dropdown-offset': `${leftOffset}px` } as React.CSSProperties}
          className="absolute inset-x-1 top-full z-50 mt-1.5 rounded-2xl border border-gray-200 bg-white p-2 text-gray-800 shadow-[0_8px_24px_rgba(0,0,0,0.12)] sm:right-auto sm:left-[var(--dropdown-offset)] sm:w-72 sm:max-w-[calc(100vw-16px)] sm:p-1.5 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          {/* Header */}
          <div className="flex min-h-10 items-center justify-between gap-2 px-2.5 text-sm font-semibold text-slate-600 sm:min-h-0 sm:py-1 sm:text-[10px] sm:uppercase sm:tracking-wider dark:text-slate-400">
            <span>Filter by Category</span>
            {currentCategory && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect('');
                }}
                className="min-h-11 cursor-pointer rounded-lg px-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 sm:min-h-0 sm:px-0 sm:text-[10px] dark:text-rose-400 dark:hover:bg-slate-800"
              >
                Reset
              </button>
            )}
          </div>

          <div className="max-h-[min(22.5rem,50dvh)] space-y-1 overflow-y-auto overscroll-contain sm:max-h-[min(65vh,360px)] sm:space-y-0.5">
            {/* All Categories Option */}
            <button
              type="button"
              role="option"
              aria-selected={!currentCategory}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelect('');
              }}
              title="Show all topics without category filtering"
              className={`group flex min-h-14 w-full cursor-pointer select-none items-center justify-between rounded-xl p-2.5 text-left text-sm transition sm:min-h-0 sm:p-2 sm:text-xs ${
                !currentCategory
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold'
                  : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-700'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="p-1 rounded-lg bg-gray-50 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors mt-0.5 flex-shrink-0 text-sm leading-none">
                  🌐
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-gray-900 dark:text-white block leading-tight">
                    All Categories
                  </span>
                  <p className="mt-0.5 line-clamp-1 text-xs font-normal text-slate-500 sm:text-[11px] dark:text-slate-400">
                    Browse all topics across Hive
                  </p>
                </div>
              </div>

              {!currentCategory && (
                <Check className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 flex-shrink-0 ml-1" />
              )}
            </button>

            {/* Individual Categories */}
            {CATEGORY_DEFINITIONS.map((cat) => {
              const isSelected = currentCategory?.tag === cat.tag;
              const isExpanded = expandedCat === cat.tag;

              return (
                <div key={cat.tag} className="rounded-xl overflow-hidden">
                  <div
                    className={`group flex min-h-14 w-full items-center gap-1 rounded-xl pe-1 transition sm:min-h-0 sm:pe-2 ${
                      isSelected
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(cat.tag)}
                      className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-xl p-2.5 text-left text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-500 sm:min-h-0 sm:p-2 sm:pr-0 sm:text-xs"
                    >
                      <span aria-hidden="true" className="p-1 rounded-lg bg-gray-50 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors mt-0.5 flex-shrink-0 text-sm leading-none">
                        {cat.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold text-gray-900 dark:text-white block leading-tight">
                          {cat.label}
                        </span>
                        <span className="mt-0.5 line-clamp-1 text-xs font-normal text-slate-500 sm:text-[11px] dark:text-slate-400">
                          #{cat.tag} &bull; {cat.subtopics.length} subtopics
                        </span>
                      </span>
                      {isSelected && (
                        <Check className="size-4 shrink-0 text-slate-600 sm:size-3.5 dark:text-slate-300" />
                      )}
                    </button>

                    {cat.subtopics.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(cat.tag)}
                        aria-label={`Subtopics for ${cat.label}`}
                        aria-expanded={isExpanded}
                        className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-600 transition hover:bg-gray-200/80 sm:size-auto sm:p-1 dark:text-slate-400 dark:hover:bg-slate-700 ${
                          isExpanded ? 'bg-gray-200/60 dark:bg-slate-700 text-slate-700 dark:text-slate-200' : ''
                        }`}
                      >
                        <ChevronDown
                          className={`size-5 transition-transform duration-150 sm:size-3.5 ${
                            isExpanded ? 'rotate-180 text-slate-700 dark:text-slate-200' : ''
                          }`}
                        />
                      </button>
                    )}
                  </div>

                  {/* Expandable Subtopics List */}
                  {isExpanded && cat.subtopics.length > 0 && (
                    <div className="pl-6 pr-2 py-1 my-0.5 ml-2 border-l-2 border-slate-200 dark:border-slate-700 space-y-0.5 bg-gray-50/50 dark:bg-slate-800/40 rounded-r-xl">
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(cat.tag);
                        }}
                        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:min-h-0 sm:text-[11px] dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <span>All in {cat.label}</span>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">#{cat.tag}</span>
                      </button>

                      {cat.subtopics.map((sub) => (
                        <button
                          key={sub.tag}
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(sub.tag);
                          }}
                          title={sub.description || sub.label}
                          className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-sm text-gray-700 transition hover:bg-gray-100 sm:min-h-0 sm:text-[11px] dark:text-slate-300 dark:hover:bg-slate-700/80"
                        >
                          <span className="min-w-0 font-medium">{sub.label}</span>
                          <span className="max-w-[42%] truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">
                            #{sub.tag}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

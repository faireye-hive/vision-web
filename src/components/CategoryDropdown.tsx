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

  // Calculate viewport boundaries so the menu sits right under the button with mt-1.5,
  // while preventing overflow off-screen on the right or left.
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const updatePosition = () => {
        if (!dropdownRef.current) return;
        const rect = dropdownRef.current.getBoundingClientRect();
        const menuWidth = 260; // w-64 / sm:w-66
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

  const toggleExpand = (catTag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCat((prev) => (prev === catTag ? null : catTag));
  };

  return (
    <div ref={dropdownRef} className="relative inline-block text-left" id={id}>
      {/* Trigger Button - Identical sizing & styling to Trending/Hot/Created dropdown */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title="Filter by topic category"
        className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1 rounded-full text-xs font-semibold transition cursor-pointer border select-none ${
          isOpen || currentCategory
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 shadow-xs'
            : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200/80 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 border-transparent dark:border-slate-700'
        }`}
      >
        {currentCategory ? (
          <span className="text-xs select-none flex-shrink-0">{currentCategory.icon}</span>
        ) : (
          <Tag className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
        )}
        <span className="text-[11px] sm:text-xs font-semibold leading-tight truncate max-w-[100px] sm:max-w-[130px]">
          {currentCategory ? currentCategory.label : 'Categories'}
        </span>
        <ChevronDown
          className={`w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-400 dark:text-slate-400 transition-transform duration-150 flex-shrink-0 ${
            isOpen ? 'rotate-180 text-slate-600 dark:text-slate-300' : ''
          }`}
        />
      </button>

      {/* Floating Menu - Sits directly below the trigger button (mt-1.5), styled identically to SortDropdown */}
      {isOpen && (
        <div
          role="listbox"
          style={{
            left: leftOffset !== 0 ? `${leftOffset}px` : 0,
          }}
          className="absolute top-full mt-1.5 w-64 sm:w-72 max-w-[calc(100vw-16px)] rounded-2xl bg-white dark:bg-slate-900 shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100 dark:border-slate-800 p-1.5 z-50 focus:outline-none animate-in fade-in zoom-in-95 duration-100 text-gray-800 dark:text-slate-200"
        >
          {/* Header */}
          <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Filter by Category</span>
            {currentCategory && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect('');
                }}
                className="text-[10px] font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          <div className="space-y-0.5 max-h-[min(65vh,360px)] overflow-y-auto">
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
              className={`w-full flex items-center justify-between p-2 rounded-xl text-xs text-left transition cursor-pointer select-none group ${
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
                  <p className="text-[11px] text-gray-400 dark:text-slate-400 font-normal line-clamp-1 mt-0.5">
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
                    role="option"
                    aria-selected={isSelected}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(cat.tag);
                    }}
                    title={cat.label}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs text-left transition cursor-pointer select-none group ${
                      isSelected
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="p-1 rounded-lg bg-gray-50 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors mt-0.5 flex-shrink-0 text-sm leading-none">
                        {cat.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-gray-900 dark:text-white block leading-tight">
                          {cat.label}
                        </span>
                        <p className="text-[11px] text-gray-400 dark:text-slate-400 font-normal line-clamp-1 mt-0.5">
                          #{cat.tag} &bull; {cat.subtopics.length} subtopics
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0 ml-1.5">
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 flex-shrink-0 mr-0.5" />
                      )}

                      {cat.subtopics.length > 0 && (
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => toggleExpand(cat.tag, e)}
                          title={`${isExpanded ? 'Hide' : 'Show'} subtopics for ${cat.label}`}
                          className={`p-1 rounded-lg hover:bg-gray-200/80 dark:hover:bg-slate-700 transition cursor-pointer text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 ${
                            isExpanded ? 'bg-gray-200/60 dark:bg-slate-700 text-slate-700 dark:text-slate-200' : ''
                          }`}
                        >
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-150 ${
                              isExpanded ? 'rotate-180 text-slate-700 dark:text-slate-200' : ''
                            }`}
                          />
                        </button>
                      )}
                    </div>
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
                        className="w-full text-left py-1 px-2 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer flex items-center justify-between"
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
                          className="w-full flex items-center justify-between text-left py-1 px-2 rounded-lg text-[11px] text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/80 transition cursor-pointer"
                        >
                          <span className="truncate mr-2 font-medium">{sub.label}</span>
                          <span className="text-[10px] text-gray-400 dark:text-slate-400 font-mono flex-shrink-0">
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

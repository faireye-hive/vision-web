import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Hash, Search, X } from 'lucide-react';
import { CategoryDefinition, Subtopic } from '../data/categorySubtopics';

interface SubcategoryDropdownProps {
  category: CategoryDefinition;
  currentTag: string;
  onSelectTag: (tag: string) => void;
  id?: string;
}

export const SubcategoryDropdown: React.FC<SubcategoryDropdownProps> = ({
  category,
  currentTag,
  onSelectTag,
  id = 'discover-subcategory-dropdown',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [leftOffset, setLeftOffset] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const updatePosition = () => {
        if (!dropdownRef.current || !menuRef.current || window.innerWidth < 640) return;
        const rect = dropdownRef.current.getBoundingClientRect();
        const menuWidth = menuRef.current.offsetWidth;
        const screenMargin = 8;
        const availableWidth = window.innerWidth;

        const rightEdge = rect.left + menuWidth;
        const overflow = rightEdge - (availableWidth - screenMargin);

        if (overflow > 0) {
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

  // Close when clicking outside or pressing Escape
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

    let focusTimer: number | undefined;
    if (isOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      if (category.subtopics.length > 5 && window.innerWidth >= 640) {
        focusTimer = window.setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, category.subtopics.length]);

  const activeSubtopic = useMemo(() => {
    return category.subtopics.find(
      (sub) => sub.tag.toLowerCase() === currentTag.toLowerCase()
    );
  }, [category.subtopics, currentTag]);

  const isCategoryRoot = currentTag.toLowerCase() === category.tag.toLowerCase();

  const filteredSubtopics = useMemo(() => {
    if (!searchQuery.trim()) return category.subtopics;
    const q = searchQuery.toLowerCase().trim();
    return category.subtopics.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.tag.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q))
    );
  }, [category.subtopics, searchQuery]);

  const handleSelect = (tag: string) => {
    onSelectTag(tag);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={dropdownRef} className="col-span-full inline-block min-w-0 text-left sm:relative" id={id}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title={`Subtopics for ${category.label}. Currently: ${
          activeSubtopic ? activeSubtopic.label : isCategoryRoot ? `All in ${category.label}` : 'Select subtopic'
        }`}
        className={`inline-flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold transition sm:min-h-0 sm:w-auto sm:gap-1.5 sm:px-2.5 sm:text-xs ${
          activeSubtopic
            ? 'bg-slate-800 text-white border-slate-800 shadow-xs dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200'
            : isOpen
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 shadow-xs'
              : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200/80 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 border-transparent dark:border-slate-700'
        }`}
      >
        <Hash className={`size-4 shrink-0 sm:size-3 ${activeSubtopic ? 'text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'}`} />
        <span className="min-w-0 truncate sm:max-w-[120px]">
          {activeSubtopic ? activeSubtopic.label : 'Subtopics'}
        </span>
        <ChevronDown
          className={`ms-auto size-4 shrink-0 transition-transform duration-150 sm:size-3 ${
            activeSubtopic ? 'text-white/80' : 'text-gray-400 dark:text-slate-500'
          } ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Floating Menu - Sits directly below button with mt-1.5, matching SortDropdown */}
      {isOpen && (
        <div
          ref={menuRef}
          role="listbox"
          aria-label={`Subtopics for ${category.label}`}
          style={{ '--dropdown-offset': `${leftOffset}px` } as React.CSSProperties}
          className="absolute inset-x-1 top-full z-50 mt-1.5 rounded-2xl border border-gray-200 bg-white p-2 text-gray-800 shadow-[0_8px_24px_rgba(0,0,0,0.12)] sm:right-auto sm:left-[var(--dropdown-offset)] sm:w-72 sm:max-w-[calc(100vw-16px)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          {/* Header */}
          <div className="px-2 py-1 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 mb-1.5 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm select-none">{category.icon}</span>
              <span className="text-sm font-semibold text-gray-900 sm:max-w-[140px] sm:truncate sm:text-xs dark:text-white">
                {category.label}
              </span>
            </div>
            <span className="shrink-0 text-xs text-slate-500 sm:text-[10px] dark:text-slate-400">
              {category.subtopics.length} topics
            </span>
          </div>

          {/* Quick search if > 5 subtopics */}
          {category.subtopics.length > 5 && (
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input
                ref={searchInputRef}
                type="text"
                aria-label="Filter subtopics"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter subtopics..."
                className="min-h-11 w-full rounded-xl border border-gray-100 bg-gray-50 py-1 pe-12 ps-8 text-base text-gray-800 placeholder-gray-400 transition focus:ring-1 focus:ring-slate-500 focus:outline-none sm:min-h-0 sm:pe-7 sm:text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear subtopic search"
                  className="absolute end-0 top-1/2 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-xl text-slate-500 hover:text-gray-600 sm:end-2 sm:size-auto dark:hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* "All in Category" Option */}
          <button
            type="button"
            role="option"
            aria-selected={isCategoryRoot}
            onClick={() => handleSelect(category.tag)}
            className={`mb-1 flex min-h-12 w-full cursor-pointer items-center justify-between rounded-xl p-2 text-left text-sm transition sm:min-h-0 sm:text-xs ${
              isCategoryRoot
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold'
                : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className={`p-1 rounded-lg ${isCategoryRoot ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
                <Hash className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <div className="font-semibold text-gray-900 dark:text-white">
                  All in {category.label}
                </div>
                <div className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                  #{category.tag}
                </div>
              </div>
            </div>
            {isCategoryRoot && <Check className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 flex-shrink-0 ml-1" />}
          </button>

          <div className="border-t border-gray-100 dark:border-slate-800 my-1" />

          {/* Subtopics List */}
          <div className="max-h-[min(16rem,38dvh)] space-y-1 overflow-y-auto overscroll-contain pe-0.5 sm:max-h-60 sm:space-y-0.5">
            {filteredSubtopics.map((sub: Subtopic) => {
              const isSelected = currentTag.toLowerCase() === sub.tag.toLowerCase();
              return (
                <button
                  key={sub.tag}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(sub.tag)}
                  title={sub.description || sub.label}
                  className={`flex min-h-12 w-full cursor-pointer items-center justify-between rounded-xl p-2 text-left text-sm transition sm:min-h-0 sm:text-xs ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {sub.label}
                      </span>
                    </div>
                    <div className="truncate font-mono text-xs text-slate-500 sm:text-[10px] dark:text-slate-400">
                      #{sub.tag}
                    </div>
                    {sub.description && (
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate mt-0.5">
                        {sub.description}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 flex-shrink-0 ml-1" />
                  )}
                </button>
              );
            })}

            {filteredSubtopics.length === 0 && (
              <div className="py-4 text-center text-xs text-gray-400 dark:text-slate-500">
                No matching subtopics found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

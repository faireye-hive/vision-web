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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside or pressing Escape
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
      if (category.subtopics.length > 5) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    return () => {
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
    <div ref={dropdownRef} className="relative inline-block text-left" id={id}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title={`Subtopics for ${category.label}. Currently: ${
          activeSubtopic ? activeSubtopic.label : isCategoryRoot ? `All in ${category.label}` : 'Select subtopic'
        }`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer border ${
          activeSubtopic
            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
            : isOpen
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 shadow-xs'
              : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200/80 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 border-transparent dark:border-slate-700'
        }`}
      >
        <Hash className={`w-3 h-3 ${activeSubtopic ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
        <span className="truncate max-w-[120px]">
          {activeSubtopic ? activeSubtopic.label : 'Subtopics'}
        </span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-150 ${
            activeSubtopic ? 'text-white/80' : 'text-gray-400 dark:text-slate-500'
          } ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 mt-1.5 w-64 rounded-2xl bg-white dark:bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.12)] border border-gray-100 dark:border-slate-800 p-2 z-50 focus:outline-none animate-in fade-in zoom-in-95 duration-100 text-gray-800 dark:text-slate-200"
        >
          {/* Header */}
          <div className="px-2 py-1 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 mb-1.5 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm select-none">{category.icon}</span>
              <span className="font-bold text-gray-900 dark:text-white text-xs truncate max-w-[140px]">
                {category.label}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 dark:text-slate-500">
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter subtopics..."
                className="w-full pl-8 pr-7 py-1 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer"
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
            className={`w-full flex items-center justify-between p-2 rounded-xl text-xs text-left transition cursor-pointer mb-1 ${
              isCategoryRoot
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className={`p-1 rounded-lg ${isCategoryRoot ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
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
            {isCategoryRoot && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-1" />}
          </button>

          <div className="border-t border-gray-100 dark:border-slate-800 my-1" />

          {/* Subtopics List */}
          <div className="max-h-60 overflow-y-auto space-y-0.5 pr-0.5">
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
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-xs text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {sub.label}
                      </span>
                    </div>
                    <div className="text-[10px] text-blue-600/80 dark:text-blue-400/80 font-mono truncate">
                      #{sub.tag}
                    </div>
                    {sub.description && (
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate mt-0.5">
                        {sub.description}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-1" />
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

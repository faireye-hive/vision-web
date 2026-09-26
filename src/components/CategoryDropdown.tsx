import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Tag, Check, Sparkles } from 'lucide-react';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Escape
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

  const handleSelect = (tag: string) => {
    onSelectCategory(tag);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative inline-block text-left" id={id}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title="Browse topic categories"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer border ${
          currentCategory
            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 shadow-xs'
            : isOpen
              ? 'bg-gray-200/90 dark:bg-slate-700 text-gray-800 dark:text-slate-100 border-gray-300 dark:border-slate-600'
              : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200/80 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 border-transparent dark:border-slate-700'
        }`}
      >
        {currentCategory ? (
          <span className="text-xs select-none">{currentCategory.icon}</span>
        ) : (
          <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        )}
        <span className="truncate max-w-[120px]">
          {currentCategory ? currentCategory.label : 'Categories'}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-gray-400 dark:text-slate-500 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100 text-gray-800 dark:text-slate-200">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <span className="font-bold text-gray-800 dark:text-white text-[11px] uppercase tracking-wider">
              Browse Categories
            </span>
            <span className="text-[10px] text-gray-400 dark:text-slate-500">
              {CATEGORY_DEFINITIONS.length} topics
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {CATEGORY_DEFINITIONS.map((cat) => {
              const isSelected = currentCategory?.tag === cat.tag;
              return (
                <button
                  key={cat.tag}
                  type="button"
                  onClick={() => handleSelect(cat.tag)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base select-none">{cat.icon}</span>
                    <div className="truncate">
                      <div className="font-medium text-gray-900 dark:text-slate-100 leading-tight">
                        {cat.label}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                        #{cat.tag} &bull; {cat.subtopics.length} subtopics
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2" />
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

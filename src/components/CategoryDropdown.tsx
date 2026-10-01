import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Tag, Check, Hash } from 'lucide-react';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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
    setExpandedCat(null);
  };

  const toggleExpand = (catTag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCat((prev) => (prev === catTag ? null : catTag));
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
        <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800 py-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-100 text-gray-800 dark:text-slate-200">
          <div className="px-3 pb-2 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <span className="font-bold text-gray-800 dark:text-white text-[11px] uppercase tracking-wider">
              Browse Categories
            </span>
            <span className="text-[10px] text-gray-400 dark:text-slate-500">
              {CATEGORY_DEFINITIONS.length} topics
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto py-1 px-1 space-y-1">
            {CATEGORY_DEFINITIONS.map((cat) => {
              const isSelected = currentCategory?.tag === cat.tag;
              const isExpanded = expandedCat === cat.tag;

              return (
                <div key={cat.tag} className="rounded-xl overflow-hidden">
                  <div
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition cursor-pointer group ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                    onClick={() => handleSelect(cat.tag)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-base select-none">{cat.icon}</span>
                      <div className="truncate min-w-0">
                        <div className="font-medium text-gray-900 dark:text-slate-100 leading-tight truncate">
                          {cat.label}
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                          #{cat.tag} &bull; {cat.subtopics.length} subtopics
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mr-1" />
                      )}

                      {/* Subtopics toggle arrow */}
                      {cat.subtopics.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => toggleExpand(cat.tag, e)}
                          title={`${isExpanded ? 'Hide' : 'Show'} subtopics for ${cat.label}`}
                          className={`p-1 rounded-lg hover:bg-gray-200/80 dark:hover:bg-slate-700 transition cursor-pointer text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 ${
                            isExpanded ? 'bg-gray-200/60 dark:bg-slate-700 text-blue-600 dark:text-blue-400' : ''
                          }`}
                        >
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-150 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable Subtopics List */}
                  {isExpanded && cat.subtopics.length > 0 && (
                    <div className="pl-6 pr-2 py-1.5 my-1 ml-3 border-l-2 border-blue-200 dark:border-blue-900/60 space-y-1 bg-gray-50/50 dark:bg-slate-800/40 rounded-r-xl">
                      <button
                        type="button"
                        onClick={() => handleSelect(cat.tag)}
                        className="w-full text-left py-1 px-2 rounded-lg text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-950/60 transition cursor-pointer flex items-center justify-between"
                      >
                        <span>All in {cat.label}</span>
                        <span className="text-[10px] font-mono text-blue-500/70">#{cat.tag}</span>
                      </button>

                      {cat.subtopics.map((sub) => (
                        <button
                          key={sub.tag}
                          type="button"
                          onClick={() => handleSelect(sub.tag)}
                          title={sub.description || sub.label}
                          className="w-full flex items-center justify-between text-left py-1 px-2 rounded-lg text-[11px] text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/80 transition cursor-pointer"
                        >
                          <span className="truncate mr-2 font-medium">{sub.label}</span>
                          <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono flex-shrink-0">
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

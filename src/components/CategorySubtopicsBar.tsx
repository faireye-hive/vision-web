import React, { useRef } from 'react';
import { ChevronRight, ChevronLeft, Layers, X, Hash } from 'lucide-react';
import { CategoryDefinition, Subtopic } from '../data/categorySubtopics';

interface CategorySubtopicsBarProps {
  category: CategoryDefinition;
  currentTag: string;
  onSelectTag: (tag: string) => void;
  onClearCategory?: () => void;
  id?: string;
}

export const CategorySubtopicsBar: React.FC<CategorySubtopicsBarProps> = ({
  category,
  currentTag,
  onSelectTag,
  onClearCategory,
  id = 'discover-category-subtopics-bar'
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const isPrimaryActive = currentTag.toLowerCase() === category.tag.toLowerCase();

  return (
    <div
      id={id}
      className="mt-3 pt-3 border-t border-gray-100/90 flex flex-col sm:flex-row sm:items-center gap-2.5"
    >
      {/* Category Indicator Label */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-sm select-none" role="img" aria-label={category.label}>
          {category.icon}
        </span>
        <span className="text-xs font-bold text-gray-800 tracking-tight whitespace-nowrap">
          {category.label}
        </span>
        <span className="text-gray-300 select-none hidden sm:inline">|</span>
      </div>

      {/* Horizontal Scrollable Pills */}
      <div className="relative flex-1 flex items-center min-w-0">
        {/* Left Scroll Arrow for Desktop */}
        <button
          type="button"
          onClick={() => scroll('left')}
          className="hidden md:flex p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition cursor-pointer mr-1 z-10 flex-shrink-0"
          title="Scroll subtopics left"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Scroll Container */}
        <div
          ref={scrollContainerRef}
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-0.5 w-full scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Primary "All in Category" Pill */}
          <button
            type="button"
            onClick={() => onSelectTag(category.tag)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer flex-shrink-0 ${
              isPrimaryActive
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 hover:bg-gray-200/90 text-gray-700'
            }`}
            title={`View all posts in #${category.tag}`}
          >
            <span>All {category.label.split('&')[0].trim()}</span>
          </button>

          {/* Subtopic Pills */}
          {category.subtopics.map((sub: Subtopic) => {
            const isSubActive = currentTag.toLowerCase() === sub.tag.toLowerCase();
            return (
              <button
                key={sub.tag}
                type="button"
                onClick={() => onSelectTag(sub.tag)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer flex-shrink-0 ${
                  isSubActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'bg-gray-100 hover:bg-gray-200/90 text-gray-700'
                }`}
                title={`Filter by #${sub.tag}${sub.description ? `: ${sub.description}` : ''}`}
              >
                <span>{sub.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Scroll Arrow for Desktop */}
        <button
          type="button"
          onClick={() => scroll('right')}
          className="hidden md:flex p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition cursor-pointer ml-1 z-10 flex-shrink-0"
          title="Scroll subtopics right"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Optional Clear Category Button */}
        {onClearCategory && (
          <button
            type="button"
            onClick={onClearCategory}
            className="ml-1.5 p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition flex-shrink-0 cursor-pointer"
            title="Close category subtopics"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

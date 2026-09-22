import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Globe,
  ChevronDown,
  Check,
  Search,
  X,
  Sparkles
} from 'lucide-react';
import {
  LanguageOption,
  getCombflowLanguages,
  PREDEFINED_TOP_LANGUAGES
} from '../services/combflowApi';

interface LanguageDropdownProps {
  selectedLanguage: string; // 'global' or 'en', 'es', 'de', etc.
  onSelectLanguage: (langCode: string) => void;
  id?: string;
}

export const LanguageDropdown: React.FC<LanguageDropdownProps> = ({
  selectedLanguage,
  onSelectLanguage,
  id = 'discover-language-dropdown',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [languages, setLanguages] = useState<LanguageOption[]>(PREDEFINED_TOP_LANGUAGES);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load latest live language counts on mount
  useEffect(() => {
    let isMounted = true;
    getCombflowLanguages().then((langs) => {
      if (isMounted && langs && langs.length > 0) {
        setLanguages(langs);
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle clicking outside
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
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const currentOption = useMemo(() => {
    if (selectedLanguage === 'global') {
      return {
        code: 'global',
        name: 'Global',
        nativeName: 'All languages',
        flag: '🌐',
      };
    }
    return (
      languages.find((l) => l.code.toLowerCase() === selectedLanguage.toLowerCase()) || {
        code: selectedLanguage,
        name: selectedLanguage.toUpperCase(),
        nativeName: selectedLanguage,
        flag: '🌐',
      }
    );
  }, [selectedLanguage, languages]);

  const filteredLanguages = useMemo(() => {
    if (!searchQuery.trim()) return languages;
    const q = searchQuery.toLowerCase().trim();
    return languages.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [languages, searchQuery]);

  const handleSelect = (code: string) => {
    onSelectLanguage(code);
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
        title={`Language filter: currently ${currentOption.name}. Click to change language.`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer border ${
          selectedLanguage !== 'global'
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-xs'
            : isOpen
              ? 'bg-gray-200/90 text-gray-800 border-gray-300'
              : 'bg-gray-100 hover:bg-gray-200/80 text-gray-700 border-transparent'
        }`}
      >
        {selectedLanguage === 'global' ? (
          <Globe className="w-3.5 h-3.5 text-indigo-600" />
        ) : (
          <span className="text-xs leading-none">{currentOption.flag}</span>
        )}
        <span>{currentOption.name}</span>
        {selectedLanguage !== 'global' && (
          <span className="text-[10px] font-mono px-1 py-0.2 bg-indigo-100/70 rounded text-indigo-800 uppercase font-bold">
            {selectedLanguage}
          </span>
        )}
        <ChevronDown
          className={`w-3 h-3 text-gray-400 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-indigo-600' : ''
          }`}
        />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 sm:left-auto sm:right-0 md:left-0 mt-1.5 w-64 rounded-2xl bg-white shadow-[0_10px_30px_rgba(0,0,0,0.12)] border border-gray-100 p-2 z-40 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Search bar */}
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 20+ languages..."
              className="w-full pl-8 pr-7 py-1 text-xs bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Option: Global */}
          {(!searchQuery || 'global'.includes(searchQuery.toLowerCase())) && (
            <div className="mb-1 pb-1 border-b border-gray-100">
              <button
                type="button"
                role="option"
                aria-selected={selectedLanguage === 'global'}
                onClick={() => handleSelect('global')}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-xs text-left transition cursor-pointer group ${
                  selectedLanguage === 'global'
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1 rounded-lg ${selectedLanguage === 'global' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-gray-900">
                      <span>Global Feed</span>
                      <span className="text-[10px] text-gray-400 font-normal">All languages</span>
                    </div>
                    <p className="text-[11px] text-gray-400 font-normal">
                      Standard worldwide Hive blockchain feed
                    </p>
                  </div>
                </div>

                {selectedLanguage === 'global' && (
                  <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                )}
              </button>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <span>Top 20 Popular (Combflow)</span>
            <span className="text-[9px] font-normal text-indigo-500 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              AI Indexed
            </span>
          </div>

          {/* Language Options List */}
          <div className="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar pr-0.5">
            {filteredLanguages.length > 0 ? (
              filteredLanguages.map((lang) => {
                const isCurrent = selectedLanguage.toLowerCase() === lang.code.toLowerCase();

                return (
                  <button
                    key={lang.code}
                    type="button"
                    role="option"
                    aria-selected={isCurrent}
                    onClick={() => handleSelect(lang.code)}
                    title={`Filter Hive posts published in ${lang.name} (${lang.formattedCount || ''} posts)`}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs text-left transition cursor-pointer group ${
                      isCurrent
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base leading-none flex-shrink-0">{lang.flag}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-900 truncate">{lang.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono">({lang.code})</span>
                        </div>
                        {lang.nativeName && lang.nativeName !== lang.name && (
                          <span className="text-[11px] text-gray-400 font-normal truncate block">
                            {lang.nativeName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                      {lang.formattedCount && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-mono">
                          {lang.formattedCount}
                        </span>
                      )}
                      {isCurrent && (
                        <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-gray-400">
                No language found matching "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

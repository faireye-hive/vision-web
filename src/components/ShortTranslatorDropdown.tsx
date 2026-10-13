import React, { useState, useRef, useEffect } from 'react';
import { Languages, ChevronDown, Check, Loader2, Sparkles, RotateCcw } from 'lucide-react';
import { POPULAR_TRANSLATION_LANGUAGES, TranslationTarget } from '../services/translationService';

interface ShortTranslatorDropdownProps {
  currentLanguage: string | null; // null means original
  isTranslating: boolean;
  onSelectLanguage: (langCode: string) => void;
  onResetOriginal: () => void;
  compact?: boolean;
}

export const ShortTranslatorDropdown: React.FC<ShortTranslatorDropdownProps> = ({
  currentLanguage,
  isTranslating,
  onSelectLanguage,
  onResetOriginal,
  compact = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const currentLangObj = POPULAR_TRANSLATION_LANGUAGES.find((l) => l.code === currentLanguage);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={isTranslating}
        className={`flex items-center gap-1 py-1.5 px-2.5 rounded-full text-xs font-semibold transition cursor-pointer select-none ${
          currentLanguage
            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs font-bold'
            : 'text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/30'
        }`}
        title="Translate Short (Free, preserves markdown, tags & media)"
      >
        {isTranslating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
            <span className="text-[11px]">Translating...</span>
          </>
        ) : (
          <>
            <Languages className="w-3.5 h-3.5" />
            <span className={compact ? 'hidden xs:inline' : 'inline'}>
              {currentLangObj ? `${currentLangObj.flag} ${currentLangObj.name}` : 'Translate'}
            </span>
            <ChevronDown className={`w-3 h-3 opacity-75 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 bottom-full mb-1.5 sm:bottom-auto sm:top-full sm:mt-1.5 w-48 sm:w-56 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-100 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-500" />
              Translate Short
            </span>
            <span className="text-[10px] text-slate-400">Free</span>
          </div>

          {currentLanguage && (
            <div className="p-1 border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onResetOriginal();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer text-left"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Show Original Text</span>
              </button>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto p-1 space-y-0.5 overscroll-contain">
            {POPULAR_TRANSLATION_LANGUAGES.map((lang: TranslationTarget) => {
              const isSelected = currentLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer text-left ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">{lang.flag}</span>
                    <span>{lang.name}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                      ({lang.nativeName})
                    </span>
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

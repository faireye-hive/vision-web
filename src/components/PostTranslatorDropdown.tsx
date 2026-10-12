import React, { useState, useRef, useEffect } from 'react';
import { Languages, ChevronDown, Check, Loader2, Sparkles, RotateCcw } from 'lucide-react';
import { POPULAR_TRANSLATION_LANGUAGES, TranslationTarget } from '../services/translationService';

interface PostTranslatorDropdownProps {
  currentLanguage: string | null; // null means original
  isTranslating: boolean;
  translationProgress?: number;
  onSelectLanguage: (langCode: string) => void;
  onResetOriginal: () => void;
}

export const PostTranslatorDropdown: React.FC<PostTranslatorDropdownProps> = ({
  currentLanguage,
  isTranslating,
  translationProgress = 0,
  onSelectLanguage,
  onResetOriginal
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
        onClick={() => setIsOpen(!isOpen)}
        disabled={isTranslating}
        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-semibold transition border shadow-2xs cursor-pointer select-none ${
          currentLanguage
            ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 dark:border-blue-500'
            : 'bg-blue-50/90 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-900/60'
        }`}
        title="Translate post text (Free, preserves markdown)"
      >
        {isTranslating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>
              Translating
              {translationProgress > 0 ? ` (${translationProgress}%)` : '...'}
            </span>
          </>
        ) : (
          <>
            <Languages className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">
              {currentLangObj ? `${currentLangObj.flag} ${currentLangObj.name}` : 'Translate'}
            </span>
            <span className="xs:hidden">
              {currentLangObj ? currentLangObj.flag : 'Translate'}
            </span>
            <ChevronDown className={`w-3 h-3 opacity-75 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-52 sm:w-60 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-gray-100 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 border-b border-gray-100 dark:border-slate-800 text-[11px] font-semibold text-gray-500 dark:text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-500" />
              Free Translation
            </span>
            <span className="text-[10px] text-gray-400">Markdown safe</span>
          </div>

          {currentLanguage && (
            <div className="p-1 border-b border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
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

          <div className="max-h-64 overflow-y-auto p-1 space-y-0.5 overscroll-contain">
            {POPULAR_TRANSLATION_LANGUAGES.map((lang: TranslationTarget) => {
              const isSelected = currentLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    onSelectLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer text-left ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                      : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">{lang.flag}</span>
                    <span>{lang.name}</span>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 font-normal">
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

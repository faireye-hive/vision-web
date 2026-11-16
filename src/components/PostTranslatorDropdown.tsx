import React, { useState, useRef, useEffect, useId } from 'react';
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
  const menuId = useId();

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
    <div className="min-w-0 flex-1 text-start sm:relative sm:flex-none" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isTranslating}
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={currentLangObj && !isTranslating ? `Translate post: ${currentLangObj.name}` : undefined}
        className={`flex h-11 w-full min-w-0 cursor-pointer select-none items-center justify-center gap-1.5 rounded-xl border px-2.5 text-sm font-semibold shadow-2xs transition focus-visible:outline-2 focus-visible:outline-blue-500 max-[359px]:gap-0.5 max-[359px]:px-1 max-[359px]:text-xs sm:h-8 sm:w-auto sm:rounded-full sm:px-3 sm:text-xs ${
          currentLanguage
            ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 dark:border-blue-500'
            : 'bg-blue-50/90 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-900/60'
        }`}
        title="Translate post text (Free, preserves markdown)"
      >
        {isTranslating ? (
          <>
            <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin sm:size-3.5" />
            <span className="min-w-0 truncate">
              Translating
              {translationProgress > 0 ? ` (${translationProgress}%)` : '...'}
            </span>
          </>
        ) : (
          <>
            <Languages aria-hidden="true" className="size-4 shrink-0 max-[359px]:hidden sm:size-3.5" />
            <span className="min-w-0 truncate">
              {currentLangObj ? <><span className="sm:hidden">{currentLangObj.flag}</span><span className="hidden sm:inline">{currentLangObj.flag} {currentLangObj.name}</span></> : 'Translate'}
            </span>
            <ChevronDown aria-hidden="true" className={`size-3 shrink-0 opacity-75 transition-transform max-[359px]:hidden ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {isOpen && (
        <div id={menuId} className="absolute inset-x-2 top-full z-50 mt-1.5 rounded-2xl border border-gray-100 bg-white py-1.5 shadow-xl sm:right-0 sm:left-auto sm:w-60 dark:border-slate-800 dark:bg-slate-900">
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
                className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50 sm:min-h-0 sm:text-xs dark:text-rose-400 dark:hover:bg-rose-950/40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Show Original Text</span>
              </button>
            </div>
          )}

          <div className="max-h-[min(16rem,45dvh)] space-y-0.5 overflow-y-auto overscroll-contain p-1 sm:max-h-64">
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
                  className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-sm font-medium transition sm:min-h-0 sm:text-xs ${
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

import React, { useEffect, useRef, useState } from 'react';
import { Check, Languages } from 'lucide-react';
import { UI_LOCALES, UiLocale } from '../i18n/messages';
import { useI18n } from '../i18n/I18nContext';

function LanguageChoices({ onSelect }: { onSelect?: (locale: UiLocale) => void }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div>
      <p className="px-1.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {t('menu.language')}
      </p>
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={t('menu.language')}>
        {UI_LOCALES.map((item) => {
          const selected = locale === item.code;
          return (
            <button
              key={item.code}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setLocale(item.code);
                onSelect?.(item.code);
              }}
              className={`flex min-h-10 items-center justify-center gap-1 rounded-xl border px-1 text-center text-[11px] font-semibold transition cursor-pointer ${
                selected
                  ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
                  : 'border-slate-200/80 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-900 dark:hover:bg-blue-950/30'
              }`}
            >
              {selected && <Check className="h-3 w-3 shrink-0" />}
              <span>{item.native}</span>
            </button>
          );
        })}
      </div>
      <p className="px-1.5 pt-1.5 text-[10px] text-slate-400 dark:text-slate-500">{t('menu.languageHint')}</p>
    </div>
  );
}

/** Inline choices for an already open menu. */
export function UiLanguagePicker({ onSelect }: { onSelect?: (locale: UiLocale) => void }) {
  return <LanguageChoices onSelect={onSelect} />;
}

/** Standalone menu for visitors who are not signed in. */
export function UiLanguageButton() {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = UI_LOCALES.find((item) => item.code === locale);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative hidden sm:block">
      <button
        id="ui-language-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        title={t('menu.languageHint')}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-800 cursor-pointer"
      >
        <Languages className="h-3.5 w-3.5" />
        <span className="hidden md:inline">{current?.native}</span>
      </button>
      {open && (
        <div
          id="ui-language-menu"
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
        >
          <LanguageChoices onSelect={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

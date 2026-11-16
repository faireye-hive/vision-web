import React, { useEffect, useRef, useState } from 'react';
import { Rss, Sparkles, Users } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { useI18n } from '../i18n/I18nContext';

const sections = [
  ['for-you', Sparkles, 'feed.forYou'],
  ['following', Rss, 'feed.myFeed'],
  ['communities', Users, 'feed.myCommunities'],
] as const;

export function FeedSectionNav({ horizontal = false }: { horizontal?: boolean }) {
  const { feedSection, openFeedSection } = useNavigation();
  const { t } = useI18n();
  const [visibleOnScrollUp, setVisibleOnScrollUp] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (!horizontal) return;

    lastScrollY.current = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY.current;

      if (currentScrollY < 80) {
        setVisibleOnScrollUp(true);
      } else if (Math.abs(delta) >= 8) {
        setVisibleOnScrollUp(delta < 0);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [horizontal]);

  return (
    <nav
      aria-label={t('nav.feed')}
      className={`rounded-2xl border border-slate-200/70 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${horizontal ? `sticky top-2 z-30 mb-3 grid grid-cols-3 gap-1 transition-transform duration-200 motion-reduce:transition-none ${visibleOnScrollUp ? 'translate-y-0' : '-translate-y-[calc(100%+1rem)]'}` : 'space-y-0.5'}`}
    >
      {sections.map(([section, Icon, label]) => {
        const active = feedSection === section;
        return (
          <button
            key={section}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => openFeedSection(section)}
            className={`flex min-h-9 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-semibold transition sm:gap-2 sm:px-2.5 ${horizontal ? 'justify-center text-center' : 'text-left'} ${active ? 'bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200/80 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900/70' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span>{t(label)}</span>
          </button>
        );
      })}
    </nav>
  );
}

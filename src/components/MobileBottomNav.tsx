import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronUp, Clock, Compass, DollarSign, Flame, Hash, Menu, Rss, TrendingUp, Users, X, Zap } from 'lucide-react';
import type { SortOption } from '../context/NavigationContext';
import type { HivePost } from '../services/hiveApi';
import { useI18n } from '../i18n/I18nContext';
import { MobileMenu } from './MobileMenu';
import type { MobileMenuProps } from './MobileMenu';

export interface MobileBottomNavProps extends Omit<MobileMenuProps, 'onClose'> {
  activeNav: 'feed' | 'discover' | 'shorts' | 'communities' | 'waves';
  onNavChange: (nav: 'feed' | 'discover' | 'shorts' | 'communities') => void;
  selectedPost?: HivePost | null;
  onClosePost?: () => void;
  currentSort?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  currentTag?: string;
  onSelectTag?: (tag: string) => void;
  hasStandalonePage?: boolean;
}

const POPULAR_MOBILE_TAGS = [
  'all',
  'hive',
  'photography',
  'crypto',
  'gaming',
  'travel',
  'art',
  'food',
  'music',
  'technology',
  'nature',
  'finance'
];

const DISCOVER_SORT_OPTIONS = [
  ['hot', Flame, 'shorts.hot'],
  ['trending', TrendingUp, 'mobile.trending'],
  ['created', Clock, 'mobile.new'],
  ['payout', DollarSign, 'mobile.payout'],
] as const;

const controlFocus = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500';
const selectedControl = 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300';
const idleControl = 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100';
const controlState = (selected: boolean) => selected ? selectedControl : idleControl;

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeNav,
  onNavChange,
  selectedPost,
  onClosePost,
  currentSort = 'hot',
  onSortChange,
  currentTag = '',
  onSelectTag,
  hasStandalonePage = false,
  ...menuProps
}) => {
  const { t } = useI18n();
  const location = useLocation();
  const { unreadNotificationsCount = 0 } = menuProps;
  const [showMenu, setShowMenu] = useState(false);
  const [showDiscoverSortPopover, setShowDiscoverSortPopover] = useState(false);
  const discoverButtonRef = useRef<HTMLButtonElement>(null);
  const discoverPanelRef = useRef<HTMLElement>(null);
  const discoverTopicsRef = useRef<HTMLDivElement>(null);

  const closeDiscoverOptions = () => {
    setShowDiscoverSortPopover(false);
    discoverButtonRef.current?.focus({ preventScroll: true });
  };

  const closeMenu = useCallback(() => setShowMenu(false), []);
  useEffect(() => {
    closeMenu();
    setShowDiscoverSortPopover(false);
  }, [closeMenu, location.key]);

  useEffect(() => {
    if (!showDiscoverSortPopover) return;
    const panel = discoverPanelRef.current;
    const desktop = window.matchMedia('(min-width: 48rem)');
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setShowDiscoverSortPopover(false);
    };

    if (discoverButtonRef.current?.matches(':focus-visible')) {
      panel?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus({ preventScroll: true });
    }
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, [showDiscoverSortPopover]);

  useEffect(() => {
    const topics = discoverTopicsRef.current;
    if (!showDiscoverSortPopover || !topics) return;

    let hideTimer: number | undefined;
    const hideScrollbar = () => {
      delete topics.dataset.scrolling;
    };
    const showScrollbar = () => {
      topics.dataset.scrolling = 'true';
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(hideScrollbar, 500);
    };

    topics.addEventListener('scroll', showScrollbar, { passive: true });
    return () => {
      topics.removeEventListener('scroll', showScrollbar);
      window.clearTimeout(hideTimer);
      hideScrollbar();
    };
  }, [showDiscoverSortPopover]);

  const handleTabClick = (tab: 'feed' | 'discover' | 'shorts' | 'communities') => {
    if (selectedPost && tab !== 'feed') {
      if (onClosePost) {
        onClosePost();
      }
      // If tapping the already active tab while post is open, just close the post
      // and keep the current category/filter intact:
      if (tab === activeNav) {
        setShowDiscoverSortPopover(false);
        return;
      }
    }

    // When tapping Discover while ALREADY on Discover: toggle Sort / Tags popover!
    if (tab === 'discover' && activeNav === 'discover' && !selectedPost && !hasStandalonePage) {
      setShowDiscoverSortPopover((prev) => !prev);
      return;
    }

    setShowDiscoverSortPopover(false);
    onNavChange(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectSort = (sortOption: (typeof DISCOVER_SORT_OPTIONS)[number][0]) => {
    if (onSortChange) {
      onSortChange(sortOption);
    }
    closeDiscoverOptions();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectTopicTag = (tagOption: string) => {
    if (onSelectTag) {
      onSelectTag(tagOption === 'all' ? '' : tagOption);
    }
    closeDiscoverOptions();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isFeedActive = activeNav === 'feed' && !selectedPost && !hasStandalonePage;
  const isDiscoverActive = activeNav === 'discover' && !selectedPost && !hasStandalonePage;
  const isShortsActive = (activeNav === 'shorts' || activeNav === 'waves') && !hasStandalonePage;
  const isCommunitiesActive = activeNav === 'communities' && !selectedPost && !hasStandalonePage;
  const tabs = [
    ['feed', Rss, 'nav.feed', 'nav.feedDesc', isFeedActive],
    ['discover', Compass, 'nav.discover', 'nav.discoverDesc', isDiscoverActive],
    ['shorts', Zap, 'nav.shorts', 'nav.shortsDesc', isShortsActive],
    ['communities', Users, 'nav.groups', 'nav.communitiesDesc', isCommunitiesActive],
    ['menu', Menu, 'nav.menu', 'nav.menuDesc', showMenu],
  ] as const;

  return (
    <>
      {showDiscoverSortPopover && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-45 bg-slate-950/25 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150 md:hidden dark:bg-black/45"
          onClick={closeDiscoverOptions}
        />
      )}

      <div
        className={`pointer-events-none fixed inset-x-0 bottom-0 px-2 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))] md:hidden ${showDiscoverSortPopover ? 'z-[46]' : 'z-40'}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && showDiscoverSortPopover) {
            event.stopPropagation();
            closeDiscoverOptions();
          }
        }}
      >
        <div className="pointer-events-auto mx-auto flex max-h-[calc(100dvh-1rem-env(safe-area-inset-bottom,0px))] max-w-md flex-col overflow-hidden rounded-[1.25rem] border border-slate-200/90 bg-white/95 shadow-[0_4px_20px_rgba(15,23,42,0.14)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-black/40">
          {showDiscoverSortPopover && (
            <section
              ref={discoverPanelRef}
              id="mobile-discover-options"
              aria-labelledby="mobile-discover-options-title"
              className="min-h-0 overflow-y-auto overscroll-contain border-b border-slate-200/80 p-3 dark:border-slate-800"
            >
              <header className="mb-1 flex items-center justify-between gap-2">
                <h2 id="mobile-discover-options-title" className="px-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t('mobile.discoverSort')}
                </h2>
                <button
                  type="button"
                  onClick={closeDiscoverOptions}
                  aria-label={t('mobile.close')}
                  className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl ${controlFocus} ${idleControl}`}
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
              </header>

              <div className="grid grid-cols-4 gap-1 rounded-2xl bg-slate-100/75 p-1 dark:bg-slate-900">
                {DISCOVER_SORT_OPTIONS.map(([sort, Icon, label]) => {
                  const selected = currentSort === sort;
                  return (
                    <button
                      key={sort}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleSelectSort(sort)}
                      className={`flex min-h-14 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center text-xs leading-tight transition-colors ${controlFocus} ${controlState(selected)} ${selected ? 'font-semibold' : 'font-medium'}`}
                    >
                      <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={selected ? 2.4 : 2} />
                      <span className="max-w-full [overflow-wrap:anywhere]">{t(label)}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-2.5 flex min-h-8 items-center justify-between gap-2 px-1">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <Hash aria-hidden="true" className="size-4 shrink-0" />
                  {t('mobile.popularTopics')}
                </h3>
                {currentTag && (
                  <button
                    type="button"
                    onClick={() => handleSelectTopicTag('all')}
                    className={`min-h-11 shrink-0 cursor-pointer rounded-xl px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/50 ${controlFocus}`}
                  >
                    {t('mobile.clearFilter')}
                  </button>
                )}
              </div>

              <div ref={discoverTopicsRef} className="mobile-discover-topics flex items-center gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5">
                {POPULAR_MOBILE_TAGS.map((tag) => {
                  const selected = (tag === 'all' && !currentTag) || currentTag.toLowerCase() === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleSelectTopicTag(tag)}
                      className={`min-h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-xl border border-slate-200 px-3 text-sm font-medium transition-colors dark:border-slate-800 ${controlFocus} ${controlState(selected)}`}
                    >
                      {tag === 'all' ? t('mobile.allTopics') : `#${tag}`}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <nav id="mobile-bottom-bar" aria-label={t('mobile.navLabel')} className="shrink-0">
            <div className="grid h-15 grid-cols-5 gap-0.5 px-1 py-0.5">
              {tabs.map(([tab, Icon, label, description, active]) => {
                const isMenu = tab === 'menu';
                const hasDiscoverOptions = tab === 'discover' && active;
                const expanded = isMenu ? showMenu : hasDiscoverOptions ? showDiscoverSortPopover : undefined;
                const hasUnread = isMenu && unreadNotificationsCount > 0;

                return (
                  <button
                    key={tab}
                    ref={tab === 'discover' ? discoverButtonRef : undefined}
                    type="button"
                    aria-current={active && !isMenu ? 'page' : undefined}
                    aria-haspopup={isMenu ? 'dialog' : undefined}
                    aria-expanded={expanded}
                    aria-controls={expanded ? isMenu ? 'mobile-menu-sheet' : 'mobile-discover-options' : undefined}
                    title={t(hasDiscoverOptions ? 'mobile.discoverSort' : description)}
                    onClick={() => {
                      if (tab === 'menu') {
                        setShowDiscoverSortPopover(false);
                        setShowMenu(true);
                      } else {
                        handleTabClick(tab);
                      }
                    }}
                    className={`flex h-full min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-0.5 text-center transition-colors active:bg-blue-100 dark:active:bg-blue-950/70 ${controlFocus} ${controlState(active)}`}
                  >
                    <span
                      aria-hidden="true"
                      className="relative grid h-7 w-12 max-w-full place-items-center rounded-full"
                    >
                      <Icon className="size-5 shrink-0" strokeWidth={active ? 2.4 : 2} />
                      {hasDiscoverOptions && <ChevronUp className={`absolute end-0.5 size-2.5 ${expanded ? 'rotate-180' : ''}`} />}
                      {hasUnread && <span className="absolute end-2 top-0 size-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-950" />}
                    </span>
                    <span className={`max-w-full truncate text-[0.75rem] leading-tight tracking-[0.015em] max-[359px]:text-[0.6875rem] ${active ? 'font-semibold' : 'font-medium'}`}>
                      {t(label)}
                    </span>
                    {hasUnread && <span className="sr-only">{t('nav.unread', { count: unreadNotificationsCount })}</span>}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {showMenu && <MobileMenu {...menuProps} onClose={closeMenu} />}
    </>
  );
};

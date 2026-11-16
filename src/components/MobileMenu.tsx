import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Activity, Bell, ChevronRight, Compass, Filter, Key, Layers, LogOut, Moon,
  PenLine, Sun, Users, X, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import type { CurrentUser } from '../services/keychain';
import { requestLogin } from '../utils/authEvents';
import { getHiveAvatarUrl } from '../utils/hiveAvatar';
import { handleImageFallback } from '../utils/imageFallback';
import { NsfwPreference } from './NsfwGate';
import { UiLanguagePicker } from './UiLanguagePicker';

export interface MobileMenuProps {
  currentUser: CurrentUser | null;
  unreadNotificationsCount?: number;
  isDark?: boolean;
  onClose: () => void;
  onOpenWrite?: () => void;
  onOpenNotifications?: () => void;
  onOpenStats?: () => void;
  onOpenCommunities?: () => void;
  onOpenManageCommunities?: () => void;
  onOpenManageFollowing?: () => void;
  onOpenAccount?: (username: string) => void;
  onToggleTheme?: () => void;
  onOpenLogin?: () => void;
  onLogout?: () => void;
  onOpenFilters?: () => void;
}

const focus = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500';
const row = `flex min-h-12 w-full items-center gap-3 px-3 py-2 text-start text-base font-normal leading-snug tracking-[0.015em] text-slate-800 transition hover:bg-slate-50 active:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 dark:active:bg-slate-800 ${focus}`;
const iconClass = 'h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400';
const card = 'overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';
const group = `${card} divide-y divide-slate-100 dark:divide-slate-800`;
const heading = 'mb-2 px-1 text-xs font-semibold text-slate-600 dark:text-slate-400';
const quickAction = `flex min-h-12 items-center justify-center gap-2 rounded-xl border px-2.5 py-2.5 text-center text-sm font-semibold leading-tight transition active:scale-[0.98] ${focus}`;

function MenuRow({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" className={row} onClick={onClick}>
      <Icon aria-hidden="true" className={iconClass} />
      <span className="min-w-0 flex-1 break-words">{label}</span>
      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400 rtl:rotate-180" />
    </button>
  );
}

export function MobileMenu({
  currentUser, unreadNotificationsCount = 0, isDark = false, onClose, onOpenWrite,
  onOpenNotifications, onOpenStats, onOpenCommunities, onOpenManageCommunities,
  onOpenManageFollowing, onOpenAccount, onToggleTheme, onOpenLogin, onLogout, onOpenFilters,
}: MobileMenuProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const desktop = window.matchMedia('(min-width: 48rem)');
    if (desktop.matches) {
      onClose();
      return;
    }

    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) onClose();
    };
    desktop.addEventListener('change', closeOnDesktop);

    return () => {
      desktop.removeEventListener('change', closeOnDesktop);
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const dismiss = () => {
    dialogRef.current?.close();
    onClose();
  };

  const activate = (action: () => void) => {
    dismiss();
    action();
  };

  return createPortal(
    <dialog
      id="mobile-menu-sheet"
      ref={dialogRef}
      aria-labelledby="mobile-menu-title"
      className="fixed inset-x-0 bottom-0 top-auto m-0 mx-auto max-h-[min(90dvh,44rem)] w-full max-w-lg overflow-hidden rounded-t-[1.75rem] border border-b-0 border-slate-200 bg-slate-50 p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 open:flex open:flex-col dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
        <h2 id="mobile-menu-title" className="text-lg font-semibold leading-snug tracking-[0.015em]">{t('nav.menu')}</h2>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('mobile.close')}
          className={`grid size-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 ${focus}`}
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </header>

      <div
        className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 pt-3"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className={card}>
          {currentUser ? (
            <button
              type="button"
              disabled={!onOpenAccount}
              onClick={() => onOpenAccount && activate(() => onOpenAccount(currentUser.username))}
              className={`${row} gap-3 py-3 disabled:cursor-default`}
            >
              <img
                src={currentUser.avatar}
                alt=""
                onError={(event) => handleImageFallback(event, getHiveAvatarUrl(currentUser.username, 'small'))}
                className="size-10 shrink-0 rounded-full bg-slate-100 object-cover dark:bg-slate-800"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">@{currentUser.username}</span>
                <span className="block text-sm text-slate-500 dark:text-slate-400">
                  {currentUser.isDemo ? t('menu.demo') : t('menu.viewProfile')}
                </span>
              </span>
              {onOpenAccount && <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400 rtl:rotate-180" />}
            </button>
          ) : (
            <MenuRow icon={Key} label={t('mobile.signInHive')} onClick={() => activate(onOpenLogin ?? requestLogin)} />
          )}
        </div>

        {(onOpenWrite || onOpenNotifications) && (
          <div className="grid auto-cols-fr grid-flow-col gap-2">
            {onOpenWrite && (
              <button
                type="button"
                onClick={() => activate(onOpenWrite)}
                className={`${quickAction} border-blue-600 bg-blue-600 text-white hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500`}
              >
                <PenLine aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="min-w-0 break-words">{t('mobile.publish')}</span>
              </button>
            )}
            {onOpenNotifications && (
              <button
                type="button"
                onClick={() => activate(onOpenNotifications)}
                className={`${quickAction} border-slate-200 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800`}
              >
                <span className="relative shrink-0">
                  <Bell aria-hidden="true" className="h-4 w-4" />
                  {unreadNotificationsCount > 0 && <span aria-hidden="true" className="absolute -end-1 -top-1 size-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />}
                </span>
                <span className="min-w-0 break-words">
                  {t('menu.notifications')}
                  {unreadNotificationsCount > 0 && <span className="mt-0.5 block text-xs font-medium text-rose-700 dark:text-rose-400">
                    {t('menu.newCount', { count: unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount })}
                  </span>}
                </span>
              </button>
            )}
          </div>
        )}

        <section aria-labelledby="mobile-menu-shortcuts">
          <h3 id="mobile-menu-shortcuts" className={heading}>{t('menu.quickLinks')}</h3>
          <div className={group}>
            <Link to="/snaps" onClick={dismiss} className={row}>
              <Zap aria-hidden="true" className={iconClass} />
              <span className="min-w-0 flex-1 break-words">Nebulosa Snaps</span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400 rtl:rotate-180" />
            </Link>
            {onOpenCommunities && <MenuRow icon={Compass} label={t('menu.exploreCommunities')} onClick={() => activate(onOpenCommunities)} />}
            {currentUser && onOpenManageCommunities && <MenuRow icon={Layers} label={t('menu.manageCommunities')} onClick={() => activate(onOpenManageCommunities)} />}
            {currentUser && onOpenManageFollowing && <MenuRow icon={Users} label={t('menu.manageFollowing')} onClick={() => activate(onOpenManageFollowing)} />}
          </div>
        </section>

        <section aria-labelledby="mobile-menu-preferences">
          <h3 id="mobile-menu-preferences" className={heading}>{t('menu.network')}</h3>
          <div className={group}>
            {onToggleTheme && (
              <button type="button" onClick={onToggleTheme} aria-label={t('theme.toggle')} aria-pressed={isDark} className={row}>
                {isDark ? <Moon aria-hidden="true" className={iconClass} /> : <Sun aria-hidden="true" className={iconClass} />}
                <span className="flex-1">{t('menu.appearance')}</span>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-end text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {t(isDark ? 'menu.darkMode' : 'menu.lightMode')}
                </span>
              </button>
            )}
            <div className="px-1 [&_select]:min-h-11">
              <UiLanguagePicker compact />
            </div>
            <NsfwPreference className="px-3 py-1 [&_button]:min-h-11" />
            {onOpenFilters && <MenuRow icon={Filter} label={t('mobile.filters')} onClick={() => activate(onOpenFilters)} />}
            {onOpenStats && <MenuRow icon={Activity} label={t('mobile.nodesStats')} onClick={() => activate(onOpenStats)} />}
          </div>
        </section>

        {currentUser && onLogout && (
          <button
            type="button"
            onClick={() => activate(onLogout)}
            className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-medium text-rose-700 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 ${focus}`}
          >
            <LogOut aria-hidden="true" className="h-5 w-5 shrink-0" />
            {t('menu.disconnect')}
          </button>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
